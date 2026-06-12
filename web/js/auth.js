import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, googleProvider, rtdb } from "./firebase-config.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { showToast } from "./app.js";

export function initAuthHandlers() {
    const form = document.getElementById('auth-form');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const btnGoogle = document.getElementById('btn-google-auth');

    let mode = 'login';

    tabLogin.addEventListener('click', () => {
        mode = 'login';
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        btnSubmit.textContent = 'Login';
    });

    tabSignup.addEventListener('click', () => {
        mode = 'signup';
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        btnSubmit.textContent = 'Sign Up';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Processing...';

        try {
            if (mode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
                showToast("Welcome back!", "success");
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Save user meta to RTDB (mirroring Android app logic)
                await set(ref(rtdb, 'users/' + user.uid), {
                    name: email.split('@')[0],
                    email: email,
                    location: "Coimbatore" // Default mirroring
                });

                showToast("Account created!", "success");
            }
        } catch (error) {
            console.error("Auth error:", error);
            if (error.code === 'auth/unauthorized-domain') {
                showToast("Domain not authorized in Firebase Console!", "error");
                console.error("FIX: Add 'localhost' to Authorized Domains in Firebase Console > Auth > Settings");
            } else {
                showToast(error.message, "error");
            }
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = mode === 'login' ? 'Login' : 'Sign Up';
        }
    });

    btnGoogle.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            showToast("Logged in with Google", "success");
        } catch (error) {
            console.error("Google Auth error:", error);
            if (error.code === 'auth/unauthorized-domain') {
                showToast("Unauthorized Domain! Add 'localhost' to Firebase Console.", "error");
            } else {
                showToast("Google login failed: " + error.code, "error");
            }
        }
    });
}

// Global logout function
window.logout = () => {
    signOut(auth).then(() => {
        showToast("Logged out successfully");
    });
};
