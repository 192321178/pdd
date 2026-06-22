import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Screen Registry matching Android Fragments
const SCREENS = ['home', 'map', 'share', 'message', 'profile'];

export function navigateTo(screenId) {
    if (!SCREENS.includes(screenId)) return;

    // Toggle screen visibility
    SCREENS.forEach(id => {
        const el = document.getElementById(`${id}-screen`);
        if (el) el.classList.remove('active');
    });

    const target = document.getElementById(`${screenId}-screen`);
    if (target) target.classList.add('active');

    // Update Sidebar Navigation state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`[data-screen="${screenId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Section-specific reloads
    if (screenId === 'map') setTimeout(() => window.loadMap?.(), 300);
    if (screenId === 'message') window.loadChatList?.();
    if (screenId === 'profile') window.loadProfile?.();
}

export function showToast(message, type = 'info') {
    // Simple alert-based toast for performance, or keep DOM version if needed
    alert(message);
}

document.addEventListener('DOMContentLoaded', () => {

    // Navigation Routing logic
    document.body.addEventListener('click', e => {
        const navItem = e.target.closest('[data-screen]');
        if (navItem) {
            e.preventDefault();
            navigateTo(navItem.getAttribute('data-screen'));
        }
    });

    // Logout Handler (Now located in Profile Fragment)
    document.body.addEventListener('click', e => {
        if (e.target.closest('#logout-btn')) {
            signOut(auth).then(() => {
                window.location.reload();
            });
        }
    });

    // Authentication Guard
    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const appWrapper = document.querySelector('.app-wrapper');

        if (user) {
            if (authWrapper) authWrapper.classList.add('hidden');
            if (appWrapper) appWrapper.classList.remove('hidden');
            window.currentUser = user;
            navigateTo('home');
        } else {
            if (appWrapper) appWrapper.classList.add('hidden');
            if (authWrapper) authWrapper.classList.remove('hidden');
        }
    });
});

window.navigateTo = navigateTo;
