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
    if (!user || !chatList) return;

    onValue(ref(rtdb, `user_chats/${user.uid}`), snapshot => {
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
    // This could be a floating panel or a full screen
    // For "Real Web", let's use a centered wide modal or expand the card
    // For now, let's use a prompt since the user wants a "Real Web Application"
    window.showToast?.(`Connecting to ${chat.otherUserName}...`, 'info');
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.loadChatList = loadChatList;
