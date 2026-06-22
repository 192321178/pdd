import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Exact screen IDs as per section IDs in index.html
const SCREENS = ['home', 'map', 'share', 'message', 'profile'];

export function navigateTo(screenId) {
    if (!SCREENS.includes(screenId)) {
        console.warn('Navigation failed: screenId not found', screenId);
        return;
    }

    // Toggle screen visibility
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; // Force hide
    });

    const target = document.getElementById(`${screenId}-screen`);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block'; // Force show
        console.log('Navigated to', screenId);
    }

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

    console.log('App JS Loaded - Initializing Navigation');

    // 1. Precise Navigation Listeners
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.getAttribute('data-screen');
            navigateTo(screen);
        });
    });

    // 2. Auth Screen Toggles (Android style)
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
            console.log('Logging out...');
            signOut(auth).then(() => {
                window.location.reload();
            });
        }
    });

    // 4. Global Auth Guard
    onAuthStateChanged(auth, user => {
        const authWrapper = document.getElementById('auth-wrapper');
        const appWrapper = document.querySelector('.app-wrapper');

        if (user) {
            console.log('User authenticated:', user.email);
            if (authWrapper) authWrapper.style.display = 'none';
            if (appWrapper) {
                appWrapper.classList.remove('hidden');
                appWrapper.style.display = 'flex';
            }
            window.currentUser = user;
            navigateTo('home');
        } else {
            console.log('No user authenticated. Showing Login.');
            if (appWrapper) appWrapper.style.display = 'none';
            if (authWrapper) {
                authWrapper.style.display = 'flex';
                document.getElementById('login-screen').classList.add('active');
                document.getElementById('signup-screen').classList.remove('active');
            }
        }
    });
});

window.navigateTo = navigateTo;
