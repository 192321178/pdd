import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, googleProvider, rtdb } from "./firebase-config.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function toast(msg, type) {
    window.showToast?.(msg, type);
}

export function initAuthHandlers() {
    // ----- LOGIN -----
    const loginForm = document.getElementById('login-form');
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login');
        btn.disabled = true; btn.textContent = 'Logging in...';
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast("Welcome back! 🎉", "success");
        } catch (err) {
            toast(friendlyError(err.code), "error");
        } finally {
            btn.disabled = false; btn.textContent = 'Login';
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
        btn.disabled = true; btn.textContent = 'Creating account...';
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: name });
            await set(ref(rtdb, 'users/' + cred.user.uid), {
                name,
                email,
                location: "Coimbatore",
                donations: 0,
                claims: 0
            });
            toast("Account created! Welcome to ShareBite 🌿", "success");
        } catch (err) {
            toast(friendlyError(err.code), "error");
        } finally {
            btn.disabled = false; btn.textContent = 'Create Account';
        }
    });

    // ----- GOOGLE LOGIN/SIGNUP -----
    const handleGoogleAuth = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // ✅ Sync user data to RTDB upon Google login
            const userRef = ref(rtdb, 'users/' + user.uid);
            await update(userRef, {
                name: user.displayName || user.email?.split('@')[0] || "User",
                email: user.email,
                avatar: user.photoURL || "",
                lastLogin: Date.now()
            });

            toast("Welcome to ShareBite! 👋", "success");
        } catch (err) {
            console.error("Google Auth Error:", err);
            if (err.code === 'auth/unauthorized-domain') {
                toast("Unauthorized domain. Please add this URL to Firebase Console Authorized Domains.", "error");
            } else if (err.code === 'auth/popup-closed-by-user') {
                toast("Login cancelled", "info");
            } else {
                toast(friendlyError(err.code), "error");
            }
        }
    };

    document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleAuth);
    document.getElementById('btn-google-signup')?.addEventListener('click', handleGoogleAuth);

    // ----- FORGOT PASSWORD -----
    document.getElementById('forgot-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        if (!email) { toast("Enter your email first", "error"); return; }
        try {
            await sendPasswordResetEmail(auth, email);
            toast("Password reset email sent!", "success");
        } catch (err) {
            toast(friendlyError(err.code), "error");
        }
    });

    // ----- LOGOUT -----
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await signOut(auth);
        toast("Logged out successfully");
    });
}

function friendlyError(code) {
    const map = {
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'Email already in use',
        'auth/weak-password': 'Password must be at least 6 characters',
        'auth/invalid-email': 'Invalid email address',
        'auth/unauthorized-domain': 'Add localhost to Firebase Authorized Domains',
        'auth/popup-closed-by-user': 'Google sign-in was cancelled',
        'auth/network-request-failed': 'Network error. Check your connection',
    };
    return map[code] || 'Something went wrong. Try again.';
}
