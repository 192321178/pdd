import { ref, onValue, push, set, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

let currentChatId = null;
let currentChatMeta = null;
let messagesUnsub = null;   // ✅ holds the unsubscribe fn returned by onValue()
let chatListUnsub = null;   // ✅ holds the unsubscribe fn returned by onValue()

export function initChat() {
    window.loadChatList = loadChatList;
}

// ─── Helper: always get the freshest display name from RTDB ──────────────────
async function _getMyName(user) {
    try {
        const snap = await get(ref(rtdb, `users/${user.uid}`));
        return snap.val()?.name || user.displayName || user.email?.split('@')[0] || 'User';
    } catch {
        return user.displayName || user.email?.split('@')[0] || 'User';
    }
}
// ─────────────────────────────────────────────────────────────────────────────

export function loadChatList() {
    const user = auth.currentUser;
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (!user || !chatList || !chatDetail) return;

    // ✅ Fix: call the unsub function, NOT off()
    if (chatListUnsub) { chatListUnsub(); chatListUnsub = null; }

    // ✅ Only show inbox / hide detail when explicitly navigating here, not on every data refresh
    chatList.classList.remove('hidden');
    chatDetail.classList.add('hidden');

    // Auto-open after claim / message-donor
    const autoOpen = window.activeClaimChat;
    if (autoOpen?.isAutoOpen || autoOpen?.chatId) {
        delete window.activeClaimChat;
        openChatDetail({
            chatId: autoOpen.chatId,
            otherUserId: autoOpen.otherUserId || autoOpen.donorId,
            otherUserName: autoOpen.otherUserName || autoOpen.donorName || 'Donor',
            foodName: autoOpen.foodName || ''
        });
        return;
    }

    _subscribeInbox(user);
}

// Separate function so the onValue doesn't manage layout
function _subscribeInbox(user) {
    const chatList = document.getElementById('chat-list');
    if (!chatList) return;
    if (chatListUnsub) { chatListUnsub(); chatListUnsub = null; }

    // Real-time inbox listener
    const userChatsRef = ref(rtdb, `user_chats/${user.uid}`);
    chatListUnsub = onValue(userChatsRef, snapshot => {
        // ✅ CRITICAL FIX: if the chat detail view is open, don't touch the DOM at all
        const chatDetail = document.getElementById('chat-detail-view');
        if (chatDetail && !chatDetail.classList.contains('hidden')) {
            // Update only the unread badge in the bell without touching DOM
            return;
        }

        chatList.innerHTML = '';

        if (!snapshot.exists()) {
            chatList.innerHTML = `
                <div class="empty-inbox">
                    <i class="fa fa-comments"></i>
                    <h3>Your Inbox is Empty</h3>
                    <p>When you start or receive a food claim, messages will appear here.</p>
                </div>`;
            return;
        }

        const chatPromises = [];
        snapshot.forEach(child => {
            const chatObj = child.val();
            const chatId = child.key;
            chatPromises.push((async () => {
                let liveName = chatObj.otherUserName;
                if (chatObj.otherUserId) {
                    try {
                        const snap = await get(ref(rtdb, `users/${chatObj.otherUserId}`));
                        if (snap.val()?.name) liveName = snap.val().name;
                    } catch (e) {
                        // ignore and use cached
                    }
                }
                const lastRead = parseInt(localStorage.getItem(`lastRead_${chatId}`) || 0);
                const isUnread = (chatObj.unreadCount > 0) || (chatObj.timestamp > lastRead && chatObj.lastMessage);
                return { ...chatObj, chatId, isUnread, otherUserName: liveName };
            })());
        });

        Promise.all(chatPromises).then(chats => {
            chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            chats.forEach(chat => chatList.appendChild(_createChatRow(chat)));
        });

    }, err => {
        console.error("Chat list listener error:", err);
        chatList.innerHTML = `<div style="padding:20px;text-align:center;color:red;">Error loading chats.</div>`;
    });
}

function _createChatRow(chat) {
    const card = document.createElement('div');
    card.className = 'chat-row';

    const lastRead = parseInt(localStorage.getItem(`lastRead_${chat.chatId}`) || 0);
    const isUnread = (chat.unreadCount > 0) || (chat.timestamp > lastRead && chat.lastMessage);
    const initial = chat.otherUserName?.charAt(0).toUpperCase() || 'U';
    const timeStr = _formatTime(chat.timestamp);

    card.innerHTML = `
        <div class="chat-avatar">${initial}</div>
        <div class="chat-row-info">
            <div class="chat-row-top">
                <span class="chat-name">${chat.otherUserName || 'User'}</span>
                <span class="chat-time">${timeStr}</span>
            </div>
            <div class="chat-row-regarding">Regarding: ${chat.foodName || ''}</div>
            <div class="chat-row-bottom">
                <span class="chat-preview">${chat.lastMessage ? _truncate(chat.lastMessage, 45) : 'Start a conversation'}</span>
                ${isUnread ? `<span class="unread-badge">!</span>` : ''}
            </div>
        </div>
    `;
    card.onclick = () => openChatDetail(chat);
    return card;
}

function openChatDetail(chat) {
    const user = auth.currentUser;
    if (!chat.chatId || !user) return;

    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.add('hidden');
    if (chatDetail) chatDetail.classList.remove('hidden');

    currentChatId = chat.chatId;
    currentChatMeta = chat;

    const nameEl = document.querySelector('.chat-title-info h3');
    const subEl = document.querySelector('.chat-title-info p');
    if (nameEl) nameEl.textContent = chat.otherUserName || 'User';
    if (subEl) subEl.textContent = `Regarding: ${chat.foodName || ''}`;

    // Mark as read
    localStorage.setItem(`lastRead_${chat.chatId}`, Date.now().toString());
    update(ref(rtdb, `user_chats/${user.uid}/${chat.chatId}`), { unreadCount: 0 }).catch(() => { });

    loadMessages(chat.chatId);
}

window.backToInbox = () => {
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.remove('hidden');
    if (chatDetail) chatDetail.classList.add('hidden');

    // ✅ Fix: call the unsub function before clearing state
    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
    currentChatId = null;
    currentChatMeta = null;

    // Refresh inbox data without navigation side-effects
    const user = auth.currentUser;
    if (user) _subscribeInbox(user);
};

function loadMessages(chatId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // ✅ Fix: call unsub properly — old off(ref) was killing the NEW listener immediately
    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }

    const msgsRef = ref(rtdb, `chats/${chatId}`);
    messagesUnsub = onValue(msgsRef, snapshot => {
        container.innerHTML = '';
        if (!snapshot.exists()) {
            container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">No messages yet.</div>`;
            return;
        }

        const msgs = [];
        snapshot.forEach(child => msgs.push({ key: child.key, ...child.val() }));
        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        let lastDateStr = '';
        msgs.forEach(msg => {
            const dateStr = _getDateLabel(msg.timestamp);
            if (dateStr !== lastDateStr) {
                lastDateStr = dateStr;
                const sep = document.createElement('div');
                sep.className = 'date-separator';
                sep.innerHTML = `<span>${dateStr}</span>`;
                container.appendChild(sep);
            }

            const isMe = msg.senderId === auth.currentUser?.uid;
            const isSystem = msg.isSystem || msg.senderId === 'SYSTEM' || msg.senderId === 'system';

            const bubble = document.createElement('div');
            bubble.className = isSystem ? 'msg-bubble system-msg' : (isMe ? 'msg-bubble sent' : 'msg-bubble received');
            bubble.innerHTML = `
                <div class="msg-text">${msg.message ? msg.message.replace(/\n/g, '<br>') : ''}</div>
                <div class="msg-time">${_formatTime(msg.timestamp)}</div>
            `;
            container.appendChild(bubble);
        });
        container.scrollTop = container.scrollHeight;
    });
}

// ─── Helper: always get fresh display name for any UID from RTDB ───────────────
async function _getUserName(uid) {
    if (!uid) return 'User';
    try {
        const snap = await get(ref(rtdb, `users/${uid}`));
        return snap.val()?.name || auth.currentUser?.displayName || 'User';
    } catch {
        return auth.currentUser?.displayName || 'User';
    }
}
// ─────────────────────────────────────────────────────────────────────────────

window.sendMessage = async () => {
    const input = document.getElementById('chat-input-field');
    const user = auth.currentUser;
    if (!input || !user || !currentChatId || !input.value.trim()) return;

    const text = input.value.trim();
    const now = Date.now();
    input.value = '';

    // Extract recipient UID from chatId (format: uid1_uid2)
    let otherId = currentChatMeta?.otherUserId;
    if (!otherId && currentChatId && currentChatId.includes('_')) {
        const parts = currentChatId.split('_');
        otherId = parts.find(p => p !== user.uid);
    }

    // Always fetch fresh names from RTDB
    const myName = await _getUserName(user.uid);
    const otherName = otherId ? await _getUserName(otherId) : (currentChatMeta?.otherUserName || 'User');
    const foodName = currentChatMeta?.foodName || 'Food';

    const msgRef = push(ref(rtdb, `chats/${currentChatId}`));
    await set(msgRef, {
        messageId: msgRef.key,
        senderId: user.uid,
        senderName: myName,
        message: text,
        timestamp: now
    });

    // Update recipient preview
    if (otherId) {
        update(ref(rtdb, `user_chats/${otherId}/${currentChatId}`), {
            lastMessage: text,
            timestamp: now,
            unreadCount: 1,
            otherUserId: user.uid,
            otherUserName: myName,
            foodName: foodName,
            chatId: currentChatId
        }).catch(err => console.error("Recipient preview error:", err));
    }

    // Update my own preview
    update(ref(rtdb, `user_chats/${user.uid}/${currentChatId}`), {
        lastMessage: text,
        timestamp: now,
        unreadCount: 0,
        otherUserId: otherId || '',
        otherUserName: otherName,
        foodName: foodName,
        chatId: currentChatId
    }).catch(err => console.error("My preview error:", err));
};

// Enter key to send
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const input = document.getElementById('chat-input-field');
    if (document.activeElement === input && input?.value.trim()) {
        e.preventDefault();
        window.sendMessage();
    }
});

function _formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function _getDateLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
}
