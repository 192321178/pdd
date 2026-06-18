import { ref, onValue, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

let currentChatId = null;
let messagesUnsub = null;

export function initChat() {
    document.getElementById('chat-send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') sendMessage();
    });
}

export function loadChatList() {
    const user = auth.currentUser;
    const chatList = document.getElementById('chat-list');
    if (!user || !chatList) return;

    chatList.innerHTML = '<div style="padding:20px;color:#9CA3AF;text-align:center;font-size:13px">Loading...</div>';

    // ✅ Mobile structure: user_chats/${uid}/${chatId}
    const chatsRef = ref(rtdb, `user_chats/${user.uid}`);
    onValue(chatsRef, snapshot => {
        chatList.innerHTML = '';
        let found = false;

        if (snapshot.exists()) {
            // Sort by timestamp descending
            const chatPreviews = [];
            snapshot.forEach(child => {
                chatPreviews.push({ id: child.key, ...child.val() });
            });
            chatPreviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            chatPreviews.forEach(meta => {
                found = true;
                chatList.appendChild(createChatItem(meta.id, meta, user.uid));
            });
        }

        if (!found) {
            chatList.innerHTML = `
                <div class="empty-state" style="padding:40px 20px">
                    <div class="empty-emoji">💬</div>
                    <p>No messages yet</p>
                    <small>Claim food to start a conversation</small>
                </div>`;
        }
    });
}

function createChatItem(chatId, meta, myUid) {
    const item = document.createElement('div');
    item.className = 'chat-item';
    const name = meta.otherUserName || 'ShareBite User';
    const initial = name.charAt(0).toUpperCase();
    item.innerHTML = `
        <div class="chat-avatar">${initial}</div>
        <div class="chat-info">
            <p class="chat-name">${name}</p>
            <p class="chat-food-ref">Regarding: ${meta.foodName || 'Food'}</p>
            <p class="chat-last">${meta.lastMessage || 'Start the conversation...'}</p>
        </div>
        <span class="chat-time">${formatTime(meta.timestamp)}</span>`;
    item.addEventListener('click', () => {
        document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        openChat(chatId, name, meta.otherUserId, meta.foodName);
    });
    return item;
}

function openChat(chatId, partnerName, otherUserId, foodName) {
    currentChatId = chatId;
    const detailPanel = document.getElementById('chat-detail-panel');

    detailPanel.innerHTML = `
        <div class="chat-header">
            <div class="chat-avatar" style="width:38px;height:38px;font-size:15px">${partnerName.charAt(0).toUpperCase()}</div>
            <div class="chat-header-info">
                <p class="chat-partner-name">${partnerName}</p>
                <p class="chat-food-ref">Regarding: ${foodName || 'Food'}</p>
            </div>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-input-row">
            <input type="text" id="chat-input" class="chat-input" placeholder="Type a message...">
            <button class="chat-send-btn" id="chat-send-btn" data-other-id="${otherUserId}" data-food="${foodName}" data-other-name="${partnerName}">➤</button>
        </div>`;

    // Re-bind send
    document.getElementById('chat-send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') sendMessage();
    });

    // Unsubscribe previous listener
    if (messagesUnsub) messagesUnsub();

    // ✅ Mobile structure: chats/${chatId}/${msgId} (no /messages subnode)
    const msgsRef = ref(rtdb, `chats/${chatId}`);
    messagesUnsub = onValue(msgsRef, snapshot => {
        const msgsDiv = document.getElementById('chat-messages');
        if (!msgsDiv) return;
        msgsDiv.innerHTML = '';
        if (!snapshot.exists()) {
            msgsDiv.innerHTML = '<div style="text-align:center;color:#9CA3AF;padding:40px;font-size:13px">Send a message to start the conversation 👋</div>';
            return;
        }

        const msgs = [];
        snapshot.forEach(child => {
            const data = child.val();
            if (data.message || data.text) { // Support both 'message' (mobile) and 'text' (web)
                msgs.push(data);
            }
        });

        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        msgs.forEach(msg => {
            const isSent = msg.senderId === auth.currentUser?.uid;
            const bubble = document.createElement('div');
            bubble.className = `msg-bubble ${isSent ? 'sent' : 'received'}`;
            bubble.innerHTML = `${msg.message || msg.text}<div class="msg-time">${formatTime(msg.timestamp)}</div>`;
            msgsDiv.appendChild(bubble);
        });
        msgsDiv.scrollTop = msgsDiv.scrollHeight;
    });
}

async function sendMessage() {
    const user = auth.currentUser;
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const text = input?.value.trim();
    if (!user || !text || !currentChatId) return;

    const otherUserId = sendBtn.dataset.otherId;
    const foodName = sendBtn.dataset.food;
    const otherName = sendBtn.dataset.otherName;
    const myName = user.displayName || user.email?.split('@')[0] || 'User';

    input.value = '';
    try {
        const now = Date.now();
        const msgRef = ref(rtdb, `chats/${currentChatId}`);
        const newMsgRef = push(msgRef);

        // ✅ Message structure: message, senderId, senderName, timestamp
        const msgData = {
            messageId: newMsgRef.key,
            senderId: user.uid,
            senderName: myName,
            message: text,
            timestamp: now
        };

        await set(newMsgRef, msgData);

        // ✅ Update user_chats previews for both (real-time sync)
        const myPreviewRef = ref(rtdb, `user_chats/${user.uid}/${currentChatId}`);
        const otherPreviewRef = ref(rtdb, `user_chats/${otherUserId}/${currentChatId}`);

        const myPreviewData = {
            chatId: currentChatId,
            otherUserId: otherUserId,
            otherUserName: otherName,
            foodName: foodName,
            lastMessage: text,
            timestamp: now
        };

        const otherPreviewData = {
            chatId: currentChatId,
            otherUserId: user.uid,
            otherUserName: myName,
            foodName: foodName,
            lastMessage: text,
            timestamp: now
        };

        await set(myPreviewRef, myPreviewData);
        if (otherUserId) {
            await set(otherPreviewRef, otherPreviewData);
        }

    } catch (err) {
        console.error("SendMessage Error:", err);
        window.showToast?.('Failed to send message', 'error');
    }
}

function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.loadChatList = loadChatList;
window.openChat = openChat;
