import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

const SCREENS = ['home', 'map', 'share', 'message', 'profile'];

export function navigateTo(screenId) {
    if (!SCREENS.includes(screenId)) return;

    // Hide all screens
    document.querySelectorAll('.main-screen').forEach(s => {
        s.classList.remove('active');
    });

    // Show target
    const target = document.getElementById(`${screenId}-screen`);
    if (target) {
        target.classList.add('active');
    }

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`[data-screen="${screenId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Trigger section-specific logic
    if (screenId === 'map') {
        setTimeout(() => window.loadMap?.(), 300);
    } else if (screenId === 'message') {
        window.loadChatList?.();
    } else if (screenId === 'profile') {
        window.loadProfile?.();
    }
}

export function setupApp() {
    // Auth state guard — runs once Firebase resolves
    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const appWrapper = document.querySelector('.app-wrapper');

        if (user) {
            // Authenticated: show main app
            if (authWrapper) authWrapper.style.display = 'none';
            if (appWrapper) { appWrapper.classList.remove('hidden'); appWrapper.style.display = 'flex'; }
            window.currentUser = user;
            navigateTo('home');
        } else {
            // Unauthenticated: show login
            if (appWrapper) appWrapper.style.display = 'none';
            if (authWrapper) authWrapper.style.display = 'flex';
            // Reset to login tab
            document.getElementById('login-screen')?.classList.add('active');
            document.getElementById('signup-screen')?.classList.remove('active');
        }
    });

    // Sidebar navigation clicks
    document.addEventListener('click', e => {
        const navItem = e.target.closest('[data-screen]');
        if (navItem) {
            e.preventDefault();
            navigateTo(navItem.getAttribute('data-screen'));
        }

        // Logout
        if (e.target.closest('#logout-btn')) {
            signOut(auth).then(() => window.location.reload()).catch(console.error);
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

// Expose globally so map popups / other inline handlers can call it
window.navigateTo = navigateTo;
