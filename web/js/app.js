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
        detailOverlay?.classList.remove('hidden');
        return;
    }

    detailOverlay?.classList.add('hidden');

    // Update screen visibility
    SCREENS.forEach(id => {
        const el = document.getElementById(`${id}-screen`);
        if (el) el.classList.remove('active');
    });

    const target = document.getElementById(`${screenId}-screen`);
    if (target) target.classList.add('active');

    // Update Nav Actions (Desktop Sidebar & Mobile Bottom)
    document.querySelectorAll('.side-item, .bottom-nav div').forEach(n => n.classList.remove('active'));
    document.querySelectorAll(`[data-screen="${screenId}"]`).forEach(n => n.classList.add('active'));

    // Trigger Screen Re-loads
    if (screenId === 'map') setTimeout(() => window.loadMap?.(), 200);
    if (screenId === 'messages') window.loadChatList?.();
    if (screenId === 'profile') window.loadProfile?.();
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = "background:rgba(0,0,0,0.85); color:#fff; padding:12px 32px; border-radius:30px; margin-bottom:12px; font-size:15px; font-weight:700; opacity:0; transform:translateY(10px); transition:0.3s; pointer-events:auto; backdrop-filter:blur(5px);";
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
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Navigation Listeners (Sidebar & Bottom Nav)
    document.body.addEventListener('click', e => {
        const navItem = e.target.closest('[data-screen]');
        if (navItem) {
            navigateTo(navItem.getAttribute('data-screen'));
        }
    });

    // Auth Toggles
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

    // Logout (Both desktop and profile buttons)
    const handleLogout = () => {
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
            .then(({ signOut }) => signOut(auth));
    };
    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-logout-desktop')?.addEventListener('click', handleLogout);

    // Initializations
    initAuthHandlers();
    initFeed();
    initShare();
    initChat();
    initMap();
    initProfile();

    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const mainApp = document.getElementById('main-app');
        const sidebar = document.querySelector('.sidebar');
        const bottomNav = document.getElementById('bottom-nav');

        if (user) {
            authWrapper.classList.add('hidden');
            mainApp.classList.remove('hidden');
            if (sidebar) sidebar.classList.remove('hidden');
            if (bottomNav) bottomNav.classList.remove('hidden');
            navigateTo('feed');
            window.currentUser = user;
        } else {
            mainApp.classList.add('hidden');
            if (sidebar) sidebar.classList.add('hidden');
            if (bottomNav) bottomNav.classList.add('hidden');
            authWrapper.classList.remove('hidden');
            document.getElementById('login-screen').classList.add('active');
            document.getElementById('signup-screen').classList.remove('active');
        }
    });
});

window.navigateTo = navigateTo;
window.showToast = showToast;
