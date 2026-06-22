import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, googleProvider, rtdb } from "./firebase-config.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export async function initAuthHandlers() {
    // ✅ Handle Google redirect result on page load
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            const user = result.user;
            await update(ref(rtdb, 'users/' + user.uid), {
                name: user.displayName || "User",
                email: user.email,
                lastLogin: Date.now()
            });
        }
    } catch (err) {
        console.warn('Redirect result error:', err.message);
    }

    // ----- EMAIL LOGIN -----
    const loginForm = document.getElementById('login-form');
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login');
        if (!email || !password) return alert('Please enter email and password');
        if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            const msg = err.code === 'auth/invalid-credential' ? 'Wrong email or password.'
                : err.code === 'auth/user-not-found' ? 'No account with this email.'
                    : err.code === 'auth/wrong-password' ? 'Wrong password.'
                        : err.message;
            alert('Login failed: ' + msg);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'LOGIN'; }
        }
    });

    // ----- EMAIL SIGNUP -----
    const signupForm = document.getElementById('signup-form');
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const btn = document.getElementById('btn-signup');
        if (!name || !email || !password) return alert('Please fill in all fields');
        if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: name });
            await set(ref(rtdb, 'users/' + cred.user.uid), {
                name,
                email,
                location: 'Coimbatore',
                lastLogin: Date.now()
            });
        } catch (err) {
            const msg = err.code === 'auth/email-already-in-use' ? 'Email already registered. Please login.'
                : err.code === 'auth/weak-password' ? 'Password must be at least 6 characters.'
                    : err.message;
            alert('Signup failed: ' + msg);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'SIGN UP'; }
        }
    });

    // ----- GOOGLE LOGIN (Redirect — works on GitHub Pages) -----
    document.getElementById('btn-google-login')?.addEventListener('click', async () => {
        try {
            await signInWithRedirect(auth, googleProvider);
            // Page will redirect to Google and come back
        } catch (err) {
            alert('Google Sign-in Error: ' + err.message);
        }
    });
}
