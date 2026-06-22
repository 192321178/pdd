import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initProfile() {
    window.loadProfile = () => {
        const user = auth.currentUser;
        if (!user) return;

        const nameEl = document.getElementById('profile-display-name');
        const avatarEl = document.querySelector('.profile-avatar-circle');

        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        nameEl.textContent = displayName;
        avatarEl.textContent = displayName.charAt(0).toUpperCase();

        // Load Stats (Parity with fragment_profile.xml and 3rd reference image)
        onValue(ref(rtdb, `users/${user.uid}/impact_stats`), snapshot => {
            const stats = snapshot.val() || { donations: 0, claims: 0, kg_saved: 0.0, co2_reduced: 0.0 };

            document.getElementById('stat-donations').textContent = stats.donations || 0;
            document.getElementById('stat-claims').textContent = stats.claims || 0;
            document.getElementById('stat-kg').textContent = (stats.kg_saved || 0.0).toFixed(1);
            document.getElementById('stat-co2').textContent = (stats.co2_reduced || 0.0).toFixed(1);
        });
    };
}
