import { ref, onValue, off, push, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

let currentChatId = null;
let currentChatMeta = null;
let messagesUnsub = null;
let chatListUnsub = null;

export function initChat() {
    window.loadChatList = loadChatList;
}

export function loadChatList() {
    const user = auth.currentUser;
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (!user || !chatList || !chatDetail) return;

    if (chatListUnsub) off(ref(rtdb, `user_chats/${user.uid}`), 'value', chatListUnsub);
    chatList.classList.remove('hidden');
    chatDetail.classList.add('hidden');

    // Handle auto-open (Message Donor / after claim)
    const autoOpen = window.activeClaimChat;
    if (autoOpen?.isAutoOpen || autoOpen?.chatId) {
        delete window.activeClaimChat;
        // ✅ Fix: normalize field names from both old and new claimFood/messageDonor
        openChatDetail({
            chatId: autoOpen.chatId,
            otherUserId: autoOpen.otherUserId || autoOpen.donorId,
            otherUserName: autoOpen.otherUserName || autoOpen.donorName || 'Donor',
            foodName: autoOpen.foodName || ''
        });
        return;
    }

    // Real-time RTDB user_chats listener — Matching MessagesFragment.kt
    const userChatsRef = ref(rtdb, `user_chats/${user.uid}`);
    chatListUnsub = onValue(userChatsRef, snapshot => {
        if (!chatList) return;
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

        const chats = [];
        snapshot.forEach(child => {
            const chatObj = child.val();
            // Rule #9: Compare timestamp to localStorage lastRead
            const chatId = child.key;
            const lastRead = localStorage.getItem(`lastRead_${chatId}`) || 0;
            const isUnread = chatObj.timestamp > lastRead && chatObj.lastMessage;

            chats.push({
                ...chatObj,
                chatId: chatId,
                isUnread: isUnread
            });
        });

        // Sort by timestamp desc (Newest first)
        chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        chats.forEach(chat => {
            chatList.appendChild(_createChatRow(chat));
        });
    }, err => {
        console.error("Chat list listener error:", err);
        chatList.innerHTML = `<div style="padding:20px;text-align:center;color:red;">Error loading chats.</div>`;
    });
}

function _createChatRow(chat) {
    const card = document.createElement('div');
    card.className = 'chat-row';

    // Per-chat unread: compare timestamp to lastRead (simulated)
    const lastRead = localStorage.getItem(`lastRead_${chat.chatId}`) || 0;
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

    // Header updates
    const nameEl = document.querySelector('.chat-title-info h3');
    const subEl = document.querySelector('.chat-title-info p');
    if (nameEl) nameEl.textContent = chat.otherUserName || 'User';
    if (subEl) subEl.textContent = `Regarding: ${chat.foodName || ''}`;

    // Mark as read locally and in RTDB
    localStorage.setItem(`lastRead_${chat.chatId}`, Date.now());
    const myChatRef = ref(rtdb, `user_chats/${user.uid}/${chat.chatId}`);
    update(myChatRef, { unreadCount: 0 }).catch(() => { });

    loadMessages(chat.chatId);
}

window.backToInbox = () => {
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.remove('hidden');
    if (chatDetail) chatDetail.classList.add('hidden');
    // ✅ Fix: save chatId before clearing — was clearing then trying to use it
    const leavingChatId = currentChatId;
    currentChatId = null;
    currentChatMeta = null;
    if (messagesUnsub && leavingChatId) {
        off(ref(rtdb, `chats/${leavingChatId}`));
        messagesUnsub = null;
    }
    loadChatList();
};

function loadMessages(chatId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    if (messagesUnsub) off(ref(rtdb, `chats/${chatId}`));

    const msgsRef = ref(rtdb, `chats/${chatId}`);
    messagesUnsub = onValue(msgsRef, snapshot => {
        container.innerHTML = '';
        if (!snapshot.exists()) {
            container.innerHTML = `<div style="padding: 40px; text-align: center; color: #999;">No messages yet.</div>`;
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
            // ✅ Fix: check both 'SYSTEM' (Android/fixed web) and 'system' (old web) for compatibility
            const isSystem = msg.isSystem || msg.senderId === 'SYSTEM' || msg.senderId === 'system';

            const bubble = document.createElement('div');
            bubble.className = isSystem ? 'msg-bubble system-msg' : (isMe ? 'msg-bubble sent' : 'msg-bubble received');

            const lines = msg.message ? msg.message.replace(/\n/g, '<br>') : '';
            bubble.innerHTML = `
                <div class="msg-text">${lines}</div>
                <div class="msg-time">${_formatTime(msg.timestamp)}</div>
            `;
            container.appendChild(bubble);
        });
        container.scrollTop = container.scrollHeight;
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chat-input-field');
    const user = auth.currentUser;
    if (!input || !user || !currentChatId || !input.value.trim()) return;

    const text = input.value.trim();
    const now = Date.now();
    input.value = '';

    const msgRef = push(ref(rtdb, `chats/${currentChatId}`));
    await set(msgRef, {
        messageId: msgRef.key,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'User',
        message: text,
        timestamp: now
    });

    // Update RTDB user_chats previews for both (Matching MessagesFragment.kt)
    const myName = user.displayName || user.email?.split('@')[0] || 'User';
    const otherId = currentChatMeta.otherUserId;

    if (otherId) {
        const otherChatRef = ref(rtdb, `user_chats/${otherId}/${currentChatId}`);
        update(otherChatRef, {
            lastMessage: text,
            timestamp: now,
            unreadCount: 1, // Simple increment
            otherUserId: user.uid,
            otherUserName: myName,
            foodName: currentChatMeta.foodName,
            chatId: currentChatId
        });
    }

    const myChatRef = ref(rtdb, `user_chats/${user.uid}/${currentChatId}`);
    update(myChatRef, { lastMessage: text, timestamp: now });
};

// Enter key to send
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement?.id === 'chat-input-field') {
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
