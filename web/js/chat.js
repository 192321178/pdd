import {
    collection, query, onSnapshot, doc, updateDoc,
    setDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref as rtdbRef, onValue, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db, rtdb, auth } from "./firebase-config.js";

let currentChatId = null;
let currentChatMeta = null;
let messagesUnsub = null;
let chatListUnsub = null;

export function initChat() {
    // Handled via loadChatList called from app.js navigation
}

export function loadChatList() {
    const user = auth.currentUser;
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (!user || !chatList || !chatDetail) return;

    if (chatListUnsub) chatListUnsub();
    chatList.classList.remove('hidden');
    chatDetail.classList.add('hidden');

    // Handle auto-open from food detail "Message Donor"
    const autoOpen = window.activeClaimChat;
    if (autoOpen?.isAutoOpen) {
        delete window.activeClaimChat;
        _ensureChatMeta(user, autoOpen).then(() => {
            openChatDetail(autoOpen);
        });
        return;
    }

    // Real-time Firestore user_chats listener
    const q = query(
        collection(db, 'user_chats', user.uid, 'chats'),
        orderBy('timestamp', 'desc')
    );
    chatListUnsub = onSnapshot(q, snap => {
        chatList.innerHTML = '';
        if (snap.empty) {
            chatList.innerHTML = `
                <div class="empty-inbox">
                    <i class="fa fa-comments"></i>
                    <h3>Your Inbox is Empty</h3>
                    <p>When you start or receive a food claim, messages will appear here.</p>
                </div>`;
            return;
        }
        snap.forEach(d => {
            const chat = { id: d.id, ...d.data() };
            chatList.appendChild(_createChatRow(chat));
        });
    }, err => console.error('Chat list snapshot error:', err));
}

function _createChatRow(chat) {
    const card = document.createElement('div');
    card.className = 'chat-row';

    const initial = chat.otherUserName?.charAt(0).toUpperCase() || 'U';
    const unread = chat.unreadCount || 0;
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
                ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
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

    // Update header
    const nameEl = document.querySelector('.chat-title-info h3');
    const subEl = document.querySelector('.chat-title-info p');
    if (nameEl) nameEl.textContent = chat.otherUserName || 'User';
    if (subEl) subEl.textContent = `Regarding: ${chat.foodName || ''}`;

    // Mark as read — reset unreadCount + lastReadTimestamp in Firestore
    const chatDocRef = doc(db, 'user_chats', user.uid, 'chats', chat.chatId);
    updateDoc(chatDocRef, {
        unreadCount: 0,
        lastReadTimestamp: Date.now()
    }).catch(() => { });

    loadMessages(chat.chatId);
}

window.backToInbox = () => {
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.remove('hidden');
    if (chatDetail) chatDetail.classList.add('hidden');
    currentChatId = null;
    currentChatMeta = null;
    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
    loadChatList();
};

function loadMessages(chatId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    if (messagesUnsub) messagesUnsub();

    messagesUnsub = onValue(rtdbRef(rtdb, `chats/${chatId}`), snapshot => {
        container.innerHTML = '';
        if (!snapshot.exists()) return;

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
            const isSystem = msg.isSystem || msg.senderId === 'system';

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

    const msgRef = push(rtdbRef(rtdb, `chats/${currentChatId}`));
    await set(msgRef, {
        messageId: msgRef.key,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'User',
        message: text,
        timestamp: now
    });

    // Update Firestore user_chats preview for both sides
    if (currentChatMeta) {
        const myRef = doc(db, 'user_chats', user.uid, 'chats', currentChatId);
        await updateDoc(myRef, { lastMessage: text, timestamp: now }).catch(() => { });

        const otherId = currentChatMeta.otherUserId;
        if (otherId) {
            const otherRef = doc(db, 'user_chats', otherId, 'chats', currentChatId);
            await setDoc(otherRef, {
                chatId: currentChatId,
                otherUserId: user.uid,
                otherUserName: user.displayName || user.email?.split('@')[0] || 'User',
                foodName: currentChatMeta.foodName || '',
                lastMessage: text,
                timestamp: now,
                unreadCount: 1,
                lastReadTimestamp: 0
            }, { merge: true });
        }
    }
};

// Enter key sends message
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement?.id === 'chat-input-field') {
        window.sendMessage();
    }
});

async function _ensureChatMeta(user, chatInfo) {
    const chatDocRef = doc(db, 'user_chats', user.uid, 'chats', chatInfo.chatId);
    await setDoc(chatDocRef, {
        chatId: chatInfo.chatId,
        otherUserId: chatInfo.donorId,
        otherUserName: chatInfo.donorName,
        foodName: chatInfo.foodName,
        lastMessage: '',
        timestamp: Date.now(),
        unreadCount: 0,
        lastReadTimestamp: Date.now()
    }, { merge: true });
}

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

window.loadChatList = loadChatList;
window.openChatDetail = openChatDetail;
