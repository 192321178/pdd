import { ref, onValue, push, set, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

let currentChatId = null;
let currentChatMeta = null;
let messagesUnsub = null;
let chatListUnsub = null;

export function initChat() {
    window.loadChatList = loadChatList;
}

// ─── Get fresh name from RTDB for any uid ────────────────────────────────────
async function _getUserName(uid) {
    if (!uid) return 'User';
    try {
        const snap = await get(ref(rtdb, `users/${uid}`));
        return snap.val()?.name || 'User';
    } catch {
        return 'User';
    }
}

// ─── Canonical chatId: always smaller_uid + "_" + larger_uid ────────────────
function _canonicalChatId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function loadChatList() {
    const user = auth.currentUser;
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (!user || !chatList || !chatDetail) return;

    // Stop any existing inbox listener
    if (chatListUnsub) { chatListUnsub(); chatListUnsub = null; }

    // Show inbox, hide chat detail
    chatList.classList.remove('hidden');
    chatDetail.classList.add('hidden');

    // Auto-open after claim / message-donor
    const autoOpen = window.activeClaimChat;
    if (autoOpen && (autoOpen.isAutoOpen || autoOpen.chatId)) {
        delete window.activeClaimChat;
        // Ensure canonical chatId
        let chatId = autoOpen.chatId;
        const otherUserId = autoOpen.otherUserId || autoOpen.donorId;
        if (otherUserId && user.uid) {
            chatId = _canonicalChatId(user.uid, otherUserId);
        }
        openChatDetail({
            chatId,
            otherUserId,
            otherUserName: autoOpen.otherUserName || autoOpen.donorName || 'User',
            foodName: autoOpen.foodName || ''
        });
        return;
    }

    _subscribeInbox(user);
}

// ─── Inbox listener — NEVER touches layout when chat detail is open ──────────
function _subscribeInbox(user) {
    const chatList = document.getElementById('chat-list');
    if (!chatList) return;
    if (chatListUnsub) { chatListUnsub(); chatListUnsub = null; }

    const userChatsRef = ref(rtdb, `user_chats/${user.uid}`);
    chatListUnsub = onValue(userChatsRef, async snapshot => {
        // If chat detail is open, don't touch DOM
        const chatDetail = document.getElementById('chat-detail-view');
        if (chatDetail && !chatDetail.classList.contains('hidden')) return;

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

        // Collect all chat entries, deduplicate by canonical chatId
        const chatsMap = new Map();

        const promises = [];
        snapshot.forEach(child => {
            const chatObj = child.val();
            if (!chatObj) return;

            const rawKey = child.key;

            promises.push((async () => {
                // Recover partner UID from rawKey or stored field
                let otherId = chatObj.otherUserId;
                if ((!otherId || otherId === user.uid) && rawKey && rawKey.includes('_')) {
                    const parts = rawKey.split('_');
                    const candidate = parts.find(p => p.length > 10 && p !== user.uid);
                    if (candidate) otherId = candidate;
                }

                // Compute canonical chatId
                const canonicalId = (otherId && otherId !== user.uid)
                    ? _canonicalChatId(user.uid, otherId)
                    : rawKey;

                // Get live partner name
                let liveName = chatObj.otherUserName || 'User';
                if (otherId && otherId !== user.uid) {
                    try {
                        const snap = await get(ref(rtdb, `users/${otherId}`));
                        if (snap.val()?.name) liveName = snap.val().name;
                    } catch (e) {}
                }

                const isUnread = Number(chatObj.unreadCount) > 0;
                const entry = {
                    ...chatObj,
                    chatId: canonicalId,
                    otherUserId: otherId || '',
                    otherUserName: liveName,
                    isUnread
                };

                // Keep newest entry per canonical chatId
                const existing = chatsMap.get(canonicalId);
                if (!existing || (entry.timestamp || 0) > (existing.timestamp || 0)) {
                    chatsMap.set(canonicalId, entry);
                }
            })());
        });

        await Promise.all(promises);

        const chats = Array.from(chatsMap.values());
        chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        chats.forEach(chat => chatList.appendChild(_createChatRow(chat)));

    }, err => {
        console.error("Chat list listener error:", err);
        chatList.innerHTML = `<div style="padding:20px;text-align:center;color:red;">Error loading chats.</div>`;
    });
}

// ─── Create a single inbox row ───────────────────────────────────────────────
function _createChatRow(chat) {
    const card = document.createElement('div');
    card.className = 'chat-row';

    const isUnread = Boolean(chat.isUnread);
    const initial = (chat.otherUserName || 'U').charAt(0).toUpperCase();
    const timeStr = _formatTime(chat.timestamp);
    const preview = chat.lastMessage ? _truncate(String(chat.lastMessage), 45) : 'Start a conversation';

    card.innerHTML = `
        <div class="chat-avatar">${initial}</div>
        <div class="chat-row-info">
            <div class="chat-row-top">
                <span class="chat-name">${chat.otherUserName || 'User'}</span>
                <span class="chat-time">${timeStr}</span>
            </div>
            <div class="chat-row-regarding" style="font-size:11px;color:var(--primary);font-weight:600;">Regarding: ${chat.foodName || ''}</div>
            <div class="chat-row-bottom">
                <span class="chat-preview">${preview}</span>
                ${isUnread ? `<span class="unread-badge">!</span>` : ''}
            </div>
        </div>
    `;
    card.onclick = () => openChatDetail(chat);
    return card;
}

// ─── Open chat detail view ───────────────────────────────────────────────────
function openChatDetail(chat) {
    const user = auth.currentUser;
    if (!chat.chatId || !user) return;

    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.add('hidden');
    if (chatDetail) chatDetail.classList.remove('hidden');

    currentChatId = chat.chatId;
    currentChatMeta = { ...chat };

    // Update header
    const nameEl = document.querySelector('.chat-title-info h3');
    const subEl = document.querySelector('.chat-title-info p');
    if (nameEl) nameEl.textContent = chat.otherUserName || 'User';
    if (subEl) subEl.textContent = `Regarding: ${chat.foodName || ''}`;

    // Clear unread badge immediately in RTDB
    update(ref(rtdb, `user_chats/${user.uid}/${chat.chatId}`), { unreadCount: 0 }).catch(() => {});

    loadMessages(chat.chatId);
}

window.backToInbox = () => {
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.remove('hidden');
    if (chatDetail) chatDetail.classList.add('hidden');

    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
    currentChatId = null;
    currentChatMeta = null;

    const user = auth.currentUser;
    if (user) _subscribeInbox(user);
};

// ─── Load + listen to messages in a chat thread ──────────────────────────────
function loadMessages(chatId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }

    container.innerHTML = `<div style="padding:40px;text-align:center;color:#aaa;font-size:13px;">Loading messages…</div>`;

    const msgsRef = ref(rtdb, `chats/${chatId}`);
    messagesUnsub = onValue(msgsRef, snapshot => {
        try {
            container.innerHTML = '';

            if (!snapshot.exists()) {
                container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">No messages yet. Say hello! 👋</div>`;
                return;
            }

            const msgs = [];
            snapshot.forEach(child => {
                const val = child.val();
                if (val && typeof val === 'object') {
                    msgs.push({ key: child.key, ...val });
                }
            });
            msgs.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

            const myUid = auth.currentUser?.uid || '';
            let lastDateStr = '';

            msgs.forEach(msg => {
                try {
                    const ts = Number(msg.timestamp) || 0;
                    const dateStr = ts ? _getDateLabel(ts) : 'Today';

                    if (dateStr !== lastDateStr) {
                        lastDateStr = dateStr;
                        const sep = document.createElement('div');
                        sep.className = 'date-separator';
                        sep.innerHTML = `<span>${dateStr}</span>`;
                        container.appendChild(sep);
                    }

                    const senderId = String(msg.senderId || '');
                    const isSystem = msg.isSystem === true || senderId === 'SYSTEM' || senderId === 'system';
                    const isMe = !isSystem && senderId === myUid;

                    const msgText = String(msg.message || '').replace(/\n/g, '<br>');
                    const timeStr = ts ? _formatTime(ts) : '';

                    const bubble = document.createElement('div');
                    bubble.className = isSystem
                        ? 'msg-bubble system-msg'
                        : (isMe ? 'msg-bubble sent' : 'msg-bubble received');
                    bubble.innerHTML = `
                        <div class="msg-text">${msgText}</div>
                        <div class="msg-time">${timeStr}</div>
                    `;
                    container.appendChild(bubble);
                } catch (msgErr) {
                    console.warn('Error rendering message:', msgErr, msg);
                }
            });

            container.scrollTop = container.scrollHeight;
        } catch (err) {
            console.error('Error in message listener:', err);
        }
    }, err => {
        console.error('Messages listener error:', err);
        container.innerHTML = `<div style="padding:20px;text-align:center;color:red;">Failed to load messages.</div>`;
    });
}

// ─── Send a message ──────────────────────────────────────────────────────────
window.sendMessage = async () => {
    const input = document.getElementById('chat-input-field');
    const user = auth.currentUser;
    if (!input || !user || !currentChatId) return;

    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const now = Date.now();

    // Resolve partner UID from chatId
    let otherId = currentChatMeta?.otherUserId || '';
    if ((!otherId || otherId === user.uid) && currentChatId.includes('_')) {
        const parts = currentChatId.split('_');
        otherId = parts.find(p => p.length > 10 && p !== user.uid) || '';
    }

    // Always fetch fresh names
    const myName = await _getUserName(user.uid);
    const otherName = otherId ? await _getUserName(otherId) : (currentChatMeta?.otherUserName || 'User');
    const foodName = currentChatMeta?.foodName || 'Food';

    // Write message to chats/
    const msgRef = push(ref(rtdb, `chats/${currentChatId}`));
    try {
        await set(msgRef, {
            messageId: msgRef.key,
            senderId: user.uid,
            senderName: myName,
            message: text,
            timestamp: now
        });
    } catch (err) {
        console.error("Failed to send message:", err);
        input.value = text; // restore on failure
        return;
    }

    // Update recipient's inbox preview
    if (otherId && otherId !== user.uid) {
        update(ref(rtdb, `user_chats/${otherId}/${currentChatId}`), {
            lastMessage: text,
            timestamp: now,
            unreadCount: 1,
            otherUserId: user.uid,
            otherUserName: myName,
            foodName,
            chatId: currentChatId
        }).catch(err => console.error("Recipient preview error:", err));
    }

    // Update my own inbox preview
    update(ref(rtdb, `user_chats/${user.uid}/${currentChatId}`), {
        lastMessage: text,
        timestamp: now,
        unreadCount: 0,
        otherUserId: otherId,
        otherUserName: otherName,
        foodName,
        chatId: currentChatId
    }).catch(err => console.error("My preview error:", err));

    // Update stored meta with resolved partner info for future sends
    if (otherId) currentChatMeta = { ...currentChatMeta, otherUserId: otherId, otherUserName: otherName, foodName };
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _formatTime(ts) {
    const n = Number(ts);
    if (!n) return '';
    try {
        return new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function _getDateLabel(ts) {
    const n = Number(ts);
    if (!n) return 'Today';
    try {
        const d = new Date(n);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return 'Today'; }
}

function _truncate(str, n) {
    const s = String(str || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
}
