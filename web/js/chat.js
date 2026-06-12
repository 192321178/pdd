import { ref, onValue, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

export function initChat() {
    const chatScreen = document.getElementById('chat-screen');

    chatScreen.innerHTML = `
        <div class="chat-layout">
            <div class="chat-sidebar glass">
                <div class="sidebar-header">
                    <h3>Messages</h3>
                </div>
                <div id="chat-list" class="chat-list">
                    <div class="loader">Loading conversations...</div>
                </div>
            </div>
            <div id="chat-window" class="chat-window glass">
                <div class="empty-chat">
                    <i data-lucide="message-circle"></i>
                    <p>Select a conversation to start chatting</p>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();

    const chatList = document.getElementById('chat-list');

    // Listener for active chats
    const handleAuth = (user) => {
        if (!user) return;

        const userChatsRef = ref(rtdb, `user_chats/${user.uid}`);
        onValue(userChatsRef, (snapshot) => {
            chatList.innerHTML = '';
            if (!snapshot.exists()) {
                chatList.innerHTML = '<div class="empty-state">No conversations yet</div>';
                return;
            }

            snapshot.forEach((child) => {
                const chat = child.val();
                const item = createChatListItem(chat);
                chatList.appendChild(item);

                item.onclick = () => openChat(chat);
            });
        });
    };

    auth.onAuthStateChanged(handleAuth);
}

function createChatListItem(chat) {
    const item = document.createElement('div');
    item.className = 'chat-item';
    item.innerHTML = `
        <div class="avatar">${chat.otherUserName.charAt(0)}</div>
        <div class="chat-item-info">
            <div class="chat-item-header">
                <span class="name">${chat.otherUserName}</span>
                <span class="time">${new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="last-msg">${chat.lastMessage}</p>
            <span class="food-tag">${chat.foodName}</span>
        </div>
    `;
    return item;
}

function openChat(chat) {
    const chatWindow = document.getElementById('chat-window');
    chatWindow.innerHTML = `
        <div class="chat-header">
            <div class="user-info">
                <div class="avatar">${chat.otherUserName.charAt(0)}</div>
                <div>
                    <h4>${chat.otherUserName}</h4>
                    <span class="subtext">Regarding: ${chat.foodName}</span>
                </div>
            </div>
        </div>
        <div id="messages-container" class="messages-container"></div>
        <form id="message-form" class="message-input-area">
            <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off">
            <button type="submit" class="btn-send"><i data-lucide="send"></i></button>
        </form>
    `;
    lucide.createIcons();

    const msgContainer = document.getElementById('messages-container');
    const msgForm = document.getElementById('message-form');
    const msgInput = document.getElementById('msg-input');

    // Subscribe to messages
    const messagesRef = ref(rtdb, `chats/${chat.chatId}`);
    onValue(messagesRef, (snapshot) => {
        msgContainer.innerHTML = '';
        snapshot.forEach((child) => {
            const msg = child.val();
            const msgEl = document.createElement('div');
            msgEl.className = `message ${msg.senderId === auth.currentUser.uid ? 'sent' : 'received'}`;
            msgEl.innerHTML = `
                <div class="msg-content">${msg.message}</div>
                <div class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            `;
            msgContainer.appendChild(msgEl);
        });
        msgContainer.scrollTop = msgContainer.scrollHeight;
    });

    msgForm.onsubmit = async (e) => {
        e.preventDefault();
        const text = msgInput.value.trim();
        if (!text) return;

        const myUid = auth.currentUser.uid;
        const myName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];

        const newMsgRef = push(ref(rtdb, `chats/${chat.chatId}`));
        const now = Date.now();

        const messageData = {
            messageId: newMsgRef.key,
            senderId: myUid,
            senderName: myName,
            message: text,
            timestamp: now
        };

        await set(newMsgRef, messageData);

        // Update previews for both users
        const previewData = {
            chatId: chat.chatId,
            otherUserId: chat.otherUserId,
            otherUserName: chat.otherUserName,
            foodName: chat.foodName,
            lastMessage: text,
            timestamp: now
        };

        const myPreviewPath = `user_chats/${myUid}/${chat.chatId}`;
        const otherPreviewPath = `user_chats/${chat.otherUserId}/${chat.chatId}`;

        await set(ref(rtdb, myPreviewPath), previewData);
        await set(ref(rtdb, otherPreviewPath), {
            ...previewData,
            otherUserId: myUid,
            otherUserName: myName
        });

        msgInput.value = '';
    };

    // Re-bind submit (fix for dynamic innerHTML)
    msgForm.addEventListener('submit', msgForm.onsubmit);
}

// Global function to start chat from feed
window.startChat = (otherUid, otherName, foodName) => {
    const user = auth.currentUser;
    if (!user) return showToast("Please login", "error");
    if (user.uid === otherUid) return showToast("You shared this!", "info");

    const chatId = [user.uid, otherUid].sort().join("_") + "_" + foodName.replace(/\s+/g, '').toLowerCase();

    const chat = {
        chatId,
        otherUserId: otherUid,
        otherUserName: otherName,
        foodName,
        lastMessage: "Started a conversation...",
        timestamp: Date.now()
    };

    navigateTo('chat');
    setTimeout(() => openChat(chat), 100);
};

import { navigateTo, showToast } from "./app.js";
window.loadChat = initChat;
