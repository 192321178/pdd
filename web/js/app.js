import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { initAuthHandlers } from "./auth.js";
import { initFeed } from "./feed.js";
import { initShare } from "./share.js";
import { initChat } from "./chat.js";
import { initMap } from "./map.js";
import { initProfile } from "./profile.js";

const SCREENS = ['feed', 'share', 'map', 'messages', 'profile'];

export function navigateTo(screenId) {
    const detailOverlay = document.getElementById('food-detail');

    if (screenId === 'food-detail') {
        // Show full-screen overlay, keep main app behind it
        if (detailOverlay) detailOverlay.style.display = 'block';
        return;
    }

    // Hide detail overlay when navigating anywhere else
    if (detailOverlay) detailOverlay.style.display = 'none';

    // Hide all pages
    SCREENS.forEach(id => {
        const el = document.getElementById(`${id}-screen`);
        if (el) el.classList.remove('active');
    });

    // Deactivate all nav buttons
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));

    const target = document.getElementById(`${screenId}-screen`);
    if (target) {
        target.classList.add('active');
        target.scrollTop = 0;
    }

    const navBtn = document.getElementById(`nav-${screenId}`);
    if (navBtn) navBtn.classList.add('active');

    // Trigger map init when switching to map
    if (screenId === 'map') {
        setTimeout(() => window.loadMap?.(), 100);
    }
    // Reload chat list when switching to messages
    if (screenId === 'messages') {
        window.loadChatList?.();
    }
    // Reload profile when switching
    if (screenId === 'profile') {
        window.loadProfile?.();
    }
}

// Global Toast
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    // Auth screen switches
    document.getElementById('go-signup')?.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('signup-screen').classList.add('active');
    });
    document.getElementById('go-login')?.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('signup-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
    });

    // Nav buttons (topbar + Share Food button)
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-screen');
            navigateTo(id);
        });
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
            .then(({ signOut }) => signOut(auth));
    });

    // Init all modules
    initAuthHandlers();
    initFeed();
    initShare();
    initChat();
    initMap();
    initProfile();

    // Firebase Auth State
    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const mainApp = document.getElementById('main-app');

        if (user) {
            authWrapper.style.display = 'none';
            mainApp.classList.remove('hidden');
            navigateTo('feed');

            // Update topbar user info
            const name = user.displayName || user.email?.split('@')[0] || 'User';
            const initial = name.charAt(0).toUpperCase();
            const avatarEl = document.getElementById('topbar-avatar');
            const nameEl = document.getElementById('topbar-name');
            const profileAvatar = document.getElementById('profile-avatar');
            const profileName = document.getElementById('profile-name');

            if (avatarEl) avatarEl.textContent = initial;
            if (nameEl) nameEl.textContent = name;
            if (profileAvatar) profileAvatar.textContent = initial;
            if (profileName) profileName.textContent = name;

            window.currentUser = user;
        } else {
            mainApp.classList.add('hidden');
            authWrapper.style.display = 'flex';
            document.getElementById('login-screen').classList.add('active');
            document.getElementById('signup-screen').classList.remove('active');
        }
    });
});

window.navigateTo = navigateTo;
window.showToast = showToast;
