import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyASpiUpENpi4h7pL726E1SyKMJDeCQsXvk",
    authDomain: "sharebite-7143d.firebaseapp.com",
    databaseURL: "https://sharebite-7143d-default-rtdb.firebaseio.com",
    projectId: "sharebite-7143d",
    storageBucket: "sharebite-7143d.firebasestorage.app",
    messagingSenderId: "8553918823",
    appId: "1:8553918823:web:placeholder"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
