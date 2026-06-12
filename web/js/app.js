import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { initAuthHandlers } from "./auth.js";
import { initFeed } from "./feed.js";
import { initShare } from "./share.js";
import { initChat } from "./chat.js";
import { initMap } from "./map.js";
import { initProfile } from "./profile.js";

// DOM Elements
const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');

// Navigation Function
export function navigateTo(screenId) {
    console.log("Navigating to:", screenId);
    screens.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetScreen = document.getElementById(`${screenId}-screen`);
    const targetNav = document.getElementById(`btn-${screenId}`);

    if (targetScreen) targetScreen.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Trigger specific screen loaders
    if (screenId === 'feed') window.loadFeed?.();
    if (screenId === 'map') window.loadMap?.();
}

// Initial state
document.addEventListener('DOMContentLoaded', () => {
    initAuthHandlers();
    initFeed();
    initShare();
    initChat();
    initMap();
    initProfile();

    // Set up navigation event listeners
    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const screenId = btn.id.replace('btn-', '');
            navigateTo(screenId);
        });
    });

    // Firebase Auth State Listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User logged in:", user.email);
            // Hide auth screen if visible
            if (document.getElementById('auth-screen').classList.contains('active')) {
                navigateTo('feed');
            }
            document.querySelector('.glass-nav').style.display = 'block';
        } else {
            console.log("User logged out");
            screens.forEach(s => s.classList.remove('active'));
            document.getElementById('auth-screen').classList.add('active');
            document.querySelector('.glass-nav').style.display = 'none';
        }
    });
});

// Global Toast Utility
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast glass ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
