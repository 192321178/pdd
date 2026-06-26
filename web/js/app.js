import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, db, rtdb } from "./firebase-config.js";

const SCREENS = ['home', 'map', 'share', 'message', 'profile', 'food-detail'];
let _unreadUnsub = null;

export function navigateTo(screenId) {
    const isMain = ['home', 'map', 'share', 'message', 'profile'].includes(screenId);

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const target = (screenId === 'food-detail')
        ? document.getElementById('food-detail-screen')
        : document.getElementById(`${screenId}-screen`);

    if (target) {
        target.classList.add('active');
        target.classList.remove('hidden'); // Ensure it's not hidden
    }

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (isMain) {
        document.querySelector(`[data-screen="${screenId}"]`)?.classList.add('active');
    }

    if (screenId === 'map') setTimeout(() => window.loadMap?.(), 300);
    else if (screenId === 'message') window.loadChatList?.();
    else if (screenId === 'profile') window.loadProfile?.();
}
window.navigateTo = navigateTo;

export function setupApp() {
    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const appWrapper = document.querySelector('.app-wrapper');

        if (user) {
            if (authWrapper) authWrapper.style.display = 'none';
            if (appWrapper) { appWrapper.classList.remove('hidden'); appWrapper.style.display = 'flex'; }
            window.currentUser = user;
            navigateTo('home');
            _subscribeUnreadBadge(user.uid);
        } else {
            if (_unreadUnsub) { _unreadUnsub(); _unreadUnsub = null; }
            window.currentUser = null;
            if (appWrapper) appWrapper.style.display = 'none';
            if (authWrapper) authWrapper.style.display = 'flex';
            document.getElementById('login-screen')?.classList.add('active');
            document.getElementById('signup-screen')?.classList.remove('active');
            _setBellBadge(0);
        }
    });

    // Sidebar / bottom nav clicks
    document.addEventListener('click', e => {
        const navItem = e.target.closest('[data-screen]');
        if (navItem) {
            e.preventDefault();
            navigateTo(navItem.getAttribute('data-screen'));
        }

        // Bell icon → Messages
        if (e.target.closest('#bell-btn')) {
            navigateTo('message');
        }

        // Logout
        if (e.target.closest('#logout-btn')) {
            const ok = confirm('Are you sure you want to logout?');
            if (!ok) return;
            signOut(auth).then(() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
            }).catch(console.error);
        }
    });

    // Auth screen toggle (Login ↔ Signup)
    document.addEventListener('click', e => {
        if (e.target.id === 'go-signup') {
            e.preventDefault();
            document.getElementById('login-screen')?.classList.remove('active');
            document.getElementById('signup-screen')?.classList.add('active');
        }
        if (e.target.id === 'go-login') {
            e.preventDefault();
            document.getElementById('signup-screen')?.classList.remove('active');
            document.getElementById('login-screen')?.classList.add('active');
        }
    });
}

function _subscribeUnreadBadge(uid) {
    if (_unreadUnsub) _unreadUnsub();

    // Switch to RTDB user_chats to match mobile
    const userChatsRef = ref(rtdb, `user_chats/${uid}`);
    _unreadUnsub = onValue(userChatsRef, snapshot => {
        let total = 0;
        snapshot.forEach(child => {
            const chat = child.val();
            // Matching mobile: check lastMessage timestamp against simulated lastRead
            const lastRead = localStorage.getItem(`lastRead_${child.key}`) || 0;
            if (chat.timestamp > lastRead && chat.lastMessage) {
                total += 1;
            }
        });
        _setBellBadge(total);
    });
}

function _setBellBadge(count) {
    const bell = document.getElementById('bell-badge');
    const tab = document.getElementById('msg-tab-badge');
    [bell, tab].forEach(el => {
        if (!el) return;
        if (count > 0) {
            el.textContent = count;
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    });
}
