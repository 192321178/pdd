import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
// In a production app, these would be in an environment variable
const firebaseConfig = {
  apiKey: "AIzaSyASpiUpENpi4h7pL726E1SyKMJDeCQsXvk",
  authDomain: "sharebite-7143d.firebaseapp.com",
  databaseURL: "https://sharebite-7143d-default-rtdb.firebaseio.com",
  projectId: "sharebite-7143d",
  storageBucket: "sharebite-7143d.firebasestorage.app",
  messagingSenderId: "8553918823",
  appId: "1:8553918823:web:placeholder" // Web usually needs its own ID, but API Key is the primary driver for RTDB/Firestore
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

console.log("Firebase initialized successfully for ShareBite Web");
