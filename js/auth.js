import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, googleProvider, rtdb } from "./firebase-config.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export function initAuthHandlers() {
    // ----- LOGIN -----
    const loginForm = document.getElementById('login-form');
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'LOGIN'; }
        }
    });

    // ----- SIGNUP -----
    const signupForm = document.getElementById('signup-form');
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const btn = document.getElementById('btn-signup');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: name });
            await set(ref(rtdb, 'users/' + cred.user.uid), {
                name,
                email,
                lastLogin: Date.now()
            });
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'SIGN UP'; }
        }
    });

    // ----- GOOGLE LOGIN -----
    const handleGoogleAuth = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            await update(ref(rtdb, 'users/' + user.uid), {
                name: user.displayName || "User",
                email: user.email,
                lastLogin: Date.now()
            });
        } catch (err) {
            alert('Google Auth Error: ' + err.message);
        }
    };

    document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleAuth);
}
