import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, googleProvider } from "./firebase-config.js";

export function initAuthHandlers() {

    // ----- LOGIN -----
    const loginForm = document.getElementById('login-form');
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login');
        const err = document.getElementById('login-error');
        if (err) err.textContent = '';
        if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            if (err) err.textContent = friendlyAuthError(error.code);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'LOGIN'; }
        }
    });

    // ----- FORGOT PASSWORD -----
    document.getElementById('forgot-password-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        if (!email) {
            alert('Please enter your email address above first.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert(`✅ Password reset email sent to ${email}. Check your inbox.`);
        } catch (error) {
            alert('Error: ' + friendlyAuthError(error.code));
        }
    });

    // ----- SIGNUP -----
    const signupForm = document.getElementById('signup-form');
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm-password').value;
        const location = document.getElementById('signup-location').value.trim() || 'Coimbatore';
        const btn = document.getElementById('btn-signup');
        const err = document.getElementById('signup-error');
        if (err) err.textContent = '';

        if (password !== confirm) {
            if (err) err.textContent = 'Passwords do not match.';
            return;
        }
        if (password.length < 6) {
            if (err) err.textContent = 'Password must be at least 6 characters.';
            return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: name });
            // Save to Firestore users/{uid}
            await setDoc(doc(db, 'users', cred.user.uid), {
                name,
                email,
                location,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            if (err) err.textContent = friendlyAuthError(error.code);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'SIGN UP'; }
        }
    });

    // ----- GOOGLE LOGIN -----
    document.getElementById('btn-google-login')?.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            // Upsert user doc in Firestore
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                name: user.displayName || 'User',
                email: user.email,
                location: 'Coimbatore'
            }, { merge: true });
        } catch (error) {
            alert('Google Sign-In failed: ' + friendlyAuthError(error.code));
        }
    });
}

function friendlyAuthError(code) {
    const map = {
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/email-already-in-use': 'This email is already registered. Try logging in.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
        'auth/invalid-credential': 'Incorrect email or password. Please try again.',
        'auth/popup-closed-by-user': 'Google sign-in was cancelled.'
    };
    return map[code] || 'An error occurred. Please try again.';
}
