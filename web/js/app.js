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
        if (detailOverlay) detailOverlay.style.display = 'block';
        return;
    }

    if (detailOverlay) detailOverlay.style.display = 'none';

    // Update screen visibility
    SCREENS.forEach(id => {
        const el = document.getElementById(`${id}-screen`);
        if (el) el.classList.remove('active');
    });

    const target = document.getElementById(`${screenId}-screen`);
    if (target) {
        target.classList.add('active');
        target.scrollTop = 0;
    }

    // Update Bottom Nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.getElementById(`nav-${screenId}`);
    if (navItem) navItem.classList.add('active');

    // Module-specific reloads
    if (screenId === 'map') setTimeout(() => window.loadMap?.(), 200);
    if (screenId === 'messages') window.loadChatList?.();
    if (screenId === 'profile') window.loadProfile?.();
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = "background:rgba(0,0,0,0.8); color:#fff; padding:12px 24px; border-radius:24px; margin-bottom:12px; font-size:14px; font-weight:600; opacity:0; transform:translateY(10px); transition:0.3s; pointer-events:auto;";
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
    // Auth Switches
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

    // Nav Items
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.getAttribute('data-screen'));
        });
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
            .then(({ signOut }) => signOut(auth));
    });

    // Init modules
    initAuthHandlers();
    initFeed();
    initShare();
    initChat();
    initMap();
    initProfile();

    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const mainApp = document.getElementById('main-app');
        const bottomNav = document.getElementById('bottom-nav');

        if (user) {
            authWrapper.classList.add('hidden');
            mainApp.classList.remove('hidden');
            bottomNav.classList.remove('hidden');
            navigateTo('feed');
            window.currentUser = user;
        } else {
            mainApp.classList.add('hidden');
            bottomNav.classList.add('hidden');
            authWrapper.classList.remove('hidden');
            document.getElementById('login-screen').classList.add('active');
            document.getElementById('signup-screen').classList.remove('active');
        }
    });
});

window.navigateTo = navigateTo;
window.showToast = showToast;
