import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb, googleProvider } from "./firebase-config.js";

export function initAuthHandlers() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const googleBtn = document.getElementById('btn-google-login');
    const forgotLink = document.getElementById('forgot-password-link');

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            errorEl.textContent = _getFriendlyError(err.code);
        }
    });

    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const location = document.getElementById('signup-location').value || 'Coimbatore';
        const pass = document.getElementById('signup-password').value;
        const confirmPass = document.getElementById('signup-confirm-password').value;
        const errorEl = document.getElementById('signup-error');

        errorEl.textContent = '';

        if (pass !== confirmPass) {
            errorEl.textContent = "Passwords do not match.";
            return;
        }

        try {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });
            // Save to RTDB /users/{uid} — Matching ProfileFragment.kt
            await set(ref(rtdb, `users/${res.user.uid}`), {
                name: name,
                email: email,
                location: location
            });
        } catch (err) {
            errorEl.textContent = _getFriendlyError(err.code);
        }
    });

    googleBtn?.addEventListener('click', async () => {
        try {
            const res = await signInWithPopup(auth, googleProvider);
            const user = res.user;
            // Check if user exists in RTDB, if not create
            const userRef = ref(rtdb, `users/${user.uid}`);
            const snap = await get(userRef);
            if (!snap.exists()) {
                await set(userRef, {
                    name: user.displayName || user.email?.split('@')[0] || 'User',
                    email: user.email || '',
                    location: 'Coimbatore'
                });
            }
        } catch (err) {
            console.error('Google login error:', err);
        }
    });

    forgotLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        if (!email) return alert("Please enter your email above to reset password.");
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Password reset link sent to your email!");
        } catch (err) {
            alert(_getFriendlyError(err.code));
        }
    });

    // Toggle screens
    document.getElementById('go-signup')?.addEventListener('click', () => {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('signup-screen').classList.add('active');
    });
    document.getElementById('go-login')?.addEventListener('click', () => {
        document.getElementById('signup-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
    });
}

function _getFriendlyError(code) {
    switch (code) {
        case 'auth/user-not-found': return 'Account not found.';
        case 'auth/wrong-password': return 'Incorrect password.';
        case 'auth/email-already-in-use': return 'Email already registered.';
        case 'auth/weak-password': return 'Password is too weak.';
        case 'auth/invalid-email': return 'Invalid email address.';
        default: return 'Authentication failed. Please try again.';
    }
}
