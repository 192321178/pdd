import { ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

let currentChatId = null;
let messagesUnsub = null;

export function initChat() {
    // Handled via dynamic rendering in Chat detail
}

export function loadChatList() {
    const user = auth.currentUser;
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (!user || !chatList || !chatDetail) return;

    // 🚀 Ensure we start fresh
    if (window.chatListUnsub) window.chatListUnsub();

    chatList.classList.remove('hidden');
    chatDetail.classList.add('hidden');

    window.chatListUnsub = onValue(ref(rtdb, `user_chats/${user.uid}`), snapshot => {
        chatList.innerHTML = '';
        if (!snapshot.exists()) {
            chatList.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:100px; color:var(--text-hint);">
                    <i class="fa fa-comments" style="font-size:64px; margin-bottom:16px;"></i>
                    <h3>Your Inbox is Empty</h3>
                    <p>When you start or receive a food claim, messages will appear here.</p>
                </div>`;
            return;
        }

        const previews = [];
        snapshot.forEach(child => previews.push({ id: child.key, ...child.val() }));
        previews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        previews.forEach(chat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.cursor = 'pointer';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '20px';

            const initial = chat.otherUserName?.charAt(0).toUpperCase() || 'U';

            card.innerHTML = `
                <div style="width:60px; height:60px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:800; flex-shrink:0;">${initial}</div>
                <div style="flex:1; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h4 style="font-size:18px;">${chat.otherUserName}</h4>
                        <span style="font-size:12px; color:var(--text-hint);">${formatTime(chat.timestamp)}</span>
                    </div>
                    <p style="font-size:13px; color:var(--primary); font-weight:700; margin-bottom:4px;">Regarding: ${chat.foodName}</p>
                    <p style="font-size:14px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.lastMessage || 'Start a conversation'}</p>
                </div>
            `;

            card.onclick = () => openChatDetail(chat);
            chatList.appendChild(card);
        });
    });
}

function openChatDetail(chat) {
    if (!chat.chatId) return;

    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.add('hidden');
    if (chatDetail) chatDetail.classList.remove('hidden');

    // UI Update - Show Chat Header
    const chatTitle = document.querySelector('.chat-title-info h3');
    const chatSub = document.querySelector('.chat-title-info p');
    if (chatTitle) chatTitle.textContent = chat.otherUserName;
    if (chatSub) chatSub.textContent = `Regarding: ${chat.foodName}`;

    currentChatId = chat.chatId;
    loadMessages(chat.chatId);
}

window.backToInbox = () => {
    const chatList = document.getElementById('chat-list');
    const chatDetail = document.getElementById('chat-detail-view');
    if (chatList) chatList.classList.remove('hidden');
    if (chatDetail) chatDetail.classList.add('hidden');

    currentChatId = null;
    if (messagesUnsub) {
        messagesUnsub();
        messagesUnsub = null;
    }

    // 🚀 CRITICAL: Re-run loadChatList to ensure the inbox is fresh!
    loadChatList();
};

function loadMessages(chatId) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    if (messagesUnsub) messagesUnsub(); // Clean up old listener

    messagesUnsub = onValue(ref(rtdb, `chats/${chatId}`), snapshot => {
        messagesContainer.innerHTML = '';
        if (!snapshot.exists()) return;

        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement('div');
            const isMe = msg.senderId === auth.currentUser.uid;

            // Layout logic for bubbles
            div.style.alignSelf = isMe ? 'flex-end' : 'flex-start';
            div.style.background = isMe ? 'var(--primary)' : '#fff';
            div.style.color = isMe ? '#fff' : '#000';
            div.style.padding = '10px 16px';
            div.style.borderRadius = '16px';
            div.style.maxWidth = '70%';
            div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            div.style.fontSize = '14px';
            div.style.position = 'relative';

            div.innerHTML = `
                <div>${msg.message}</div>
                <div style="font-size: 10px; opacity: 0.7; margin-top: 4px; text-align: right;">${formatTime(msg.timestamp)}</div>
            `;
            messagesContainer.appendChild(div);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Global Send Message Function
window.sendMessage = async () => {
    const input = document.getElementById('chat-input-field');
    const user = auth.currentUser;
    if (!input || !user || !currentChatId || !input.value.trim()) return;

    const text = input.value.trim();
    const now = Date.now();
    const msgRef = push(ref(rtdb, `chats/${currentChatId}`));

    try {
        await set(msgRef, {
            messageId: msgRef.key,
            senderId: user.uid,
            senderName: user.displayName || user.email?.split('@')[0] || "User",
            message: text,
            timestamp: now
        });
        input.value = '';
    } catch (err) {
        console.error(err);
        window.showToast?.("Failed to send message", "error");
    }
};

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// 🚀 Check if we were redirected from a food item and need to auto-open/repair metadata
document.addEventListener('click', e => {
    const navItem = e.target.closest('.nav-item');
    if (navItem && navItem.getAttribute('data-screen') === 'message') {
        const autoOpen = window.activeClaimChat;
        if (autoOpen && autoOpen.isAutoOpen) {
            // Repair metadata if missing from inbox
            const user = auth.currentUser;
            if (user) {
                const metaRef = ref(rtdb, `user_chats/${user.uid}/${autoOpen.chatId}`);
                set(metaRef, {
                    chatId: autoOpen.chatId,
                    otherUserId: autoOpen.donorId,
                    otherUserName: autoOpen.donorName,
                    foodName: autoOpen.foodName,
                    lastMessage: "Hi, I'm interested in this!",
                    timestamp: Date.now()
                });
            }
            openChatDetail(autoOpen);
            delete window.activeClaimChat; // Clear after use
        } else {
            loadChatList();
        }
    }
});

// Internal helper for global accessibility
window.loadChatList = loadChatList;
window.openChatDetail = openChatDetail;
