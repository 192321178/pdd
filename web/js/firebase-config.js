import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ✅ REAL Firebase Web config from Firebase Console
// To get your own Web App config:
// Firebase Console → Project Settings → Your Apps → Web App → Config
const firebaseConfig = {
  apiKey: "AIzaSyASpiUpENpi4h7pL726E1SyKMJDeCQsXvk",
  authDomain: "sharebite-7143d.firebaseapp.com",
  databaseURL: "https://sharebite-7143d-default-rtdb.firebaseio.com",
  projectId: "sharebite-7143d",
  storageBucket: "sharebite-7143d.firebasestorage.app",
  messagingSenderId: "8553918823"
  // appId is NOT required for email/password auth and RTDB
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider for better UX
googleProvider.setCustomParameters({ prompt: 'select_account' });

console.log("✅ Firebase initialized for ShareBite Web");
