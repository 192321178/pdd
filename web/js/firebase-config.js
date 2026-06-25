import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyASpiUpENpi4h7pL726E1SyKMJDeCQsXvk",
  authDomain: "sharebite-7143d.firebaseapp.com",
  databaseURL: "https://sharebite-7143d-default-rtdb.firebaseio.com",
  projectId: "sharebite-7143d",
  storageBucket: "sharebite-7143d.firebasestorage.app",
  messagingSenderId: "8553918823",
  appId: "1:8553918823:web:6823adfba2f4b67f399d38"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);   // Firestore — food_items, users, user_chats
export const rtdb = getDatabase(app);  // Realtime DB — chats/{chatId} messages only
export const googleProvider = new GoogleAuthProvider();
