import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initProfile() {
    window.loadProfile = () => {
        const user = auth.currentUser;
        if (!user) return;

        const nameEl = document.getElementById('profile-name');
        const avatarEl = document.getElementById('profile-avatar');

        nameEl.textContent = user.displayName || user.email.split('@')[0];
        avatarEl.textContent = nameEl.textContent.charAt(0).toUpperCase();

        // Load Stats (Parity with fragment_profile.xml)
        onValue(ref(rtdb, `users/${user.uid}/impact_stats`), snapshot => {
            const stats = snapshot.val() || { donations: 0, claims: 0, kg_saved: 0, co2_reduced: 0 };

            document.getElementById('stat-donations').textContent = stats.donations || 0;
            document.getElementById('stat-claims').textContent = stats.claims || 0;
            document.getElementById('stat-kg').textContent = (stats.kg_saved || 0).toFixed(1);
            document.getElementById('stat-co2').textContent = (stats.co2_reduced || 0).toFixed(1);
        });

        // Location Parity
        document.getElementById('profile-location').textContent = "📍 Coimbatore, TN · Community Member";
    };
}
