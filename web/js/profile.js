import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initProfile() {
    // Only init if needed
}

function loadProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const name = user.displayName || user.email?.split('@')[0] || 'User';
    const initial = name.charAt(0).toUpperCase();

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('profile-avatar', initial);
    setEl('profile-name', name);

    // Location from RTDB
    onValue(ref(rtdb, 'users/' + user.uid), snap => {
        const data = snap.val() || {};
        const loc = data.location || 'Chennai, India';
        const locEl = document.querySelector('#profile-screen p'); // The location paragraph
        if (locEl) locEl.textContent = `📍 ${loc}`;
    });

    // Count activity from food_items
    onValue(ref(rtdb, 'food_items'), snap => {
        let donations = 0, claims = 0;
        if (snap.exists()) {
            snap.forEach(child => {
                const item = child.val();
                if (item.userUid === user.uid) donations++;
                if (item.claimedByUid === user.uid) claims++;
            });
        }

        const foodKg = (donations * 0.9).toFixed(1);
        const co2 = (donations * 2.5).toFixed(1);

        setEl('stat-donations', donations);
        setEl('stat-claims', claims);
        setEl('stat-kg', foodKg);
        setEl('stat-co2', co2);
    });
}

window.loadProfile = loadProfile;
