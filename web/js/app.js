import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Screen Registry matching Android Fragments
const SCREENS = ['home', 'map', 'share', 'message', 'profile'];

export function navigateTo(screenId) {
    if (!SCREENS.includes(screenId)) return;

    // Toggle screen visibility
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
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

document.addEventListener('DOMContentLoaded', () => {

    // 1. Navigation Routing (Sidebar)
    document.body.addEventListener('click', e => {
        const navItem = e.target.closest('[data-screen]');
        if (navItem) {
            e.preventDefault();
            navigateTo(navItem.getAttribute('data-screen'));
        }
    });

    // 2. Auth Screen Toggles
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

    // 3. Logout Logic
    document.body.addEventListener('click', e => {
        if (e.target.closest('#logout-btn')) {
            signOut(auth).then(() => {
                window.location.reload();
            });
        }
    });

    // 4. Authentication State Guard
    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const appWrapper = document.querySelector('.app-wrapper');

        if (user) {
            authWrapper.classList.add('hidden');
            appWrapper.classList.remove('hidden');
            window.currentUser = user;
            navigateTo('home');
        } else {
            appWrapper.classList.add('hidden');
            authWrapper.classList.remove('hidden');
            document.getElementById('login-screen').classList.add('active');
            document.getElementById('signup-screen').classList.remove('active');
        }
    });
});

window.navigateTo = navigateTo;
