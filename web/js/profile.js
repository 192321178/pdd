import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initProfile() {
    window.loadProfile = () => {
        const user = auth.currentUser;
        if (!user) return;

        const nameEl = document.getElementById('profile-display-name');
        const avatarEl = document.querySelector('.profile-avatar-circle');
        const locationEl = document.getElementById('profile-location');

        // Real-time Name/Location listener
        onValue(ref(rtdb, `users/${user.uid}`), snap => {
            const data = snap.val() || {};
            const name = data.name || user.displayName || user.email?.split('@')[0] || 'User';
            const location = data.location || 'Coimbatore';

            nameEl.textContent = name;
            avatarEl.textContent = name.charAt(0).toUpperCase();
            if (locationEl) locationEl.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${location}`;
        });

        // 🚀 DYNAMIC STATS (Matching ProfileFragment.kt logic)
        onValue(ref(rtdb, 'food_items'), snapshot => {
            let donations = 0;
            let claims = 0;

            snapshot.forEach(child => {
                const item = child.val();
                const dUid = item.userUid || item.userUID;
                const cUid = item.claimedByUid || item.claimedBy;

                if (dUid === user.uid) donations++;
                if (cUid === user.uid) claims++;
            });

            const foodKg = donations * 0.9;
            const co2Kg = donations * 2.5;

            document.getElementById('stat-donations').textContent = donations;
            document.getElementById('stat-claims').textContent = claims;
            document.getElementById('stat-kg').textContent = foodKg.toFixed(1);
            document.getElementById('stat-co2').textContent = co2Kg.toFixed(1);
        });

        updateLeaderboard();
    };

    // Modal logic
    const modal = document.getElementById('edit-profile-modal');
    document.addEventListener('click', e => {
        if (e.target.id === 'btn-edit-profile' || e.target.closest('#btn-edit-profile')) {
            const user = auth.currentUser;
            if (!user) return;
            modal.classList.remove('hidden');
            document.getElementById('edit-name').value = document.getElementById('profile-display-name').textContent;
        }
        if (e.target.id === 'btn-cancel-edit') modal.classList.add('hidden');
    });

    document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        const newName = document.getElementById('edit-name').value.trim();
        const newLoc = document.getElementById('edit-location').value.trim();

        const updates = {};
        if (newName) updates.name = newName;
        if (newLoc) updates.location = newLoc;
        updates.email = user.email || "";

        await set(ref(rtdb, `users/${user.uid}`), updates);
        modal.classList.add('hidden');
    });
}

function updateLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    onValue(ref(rtdb, 'food_items'), snapshot => {
        const userStats = {}; // Map of UID -> { name, count }

        snapshot.forEach(child => {
            const item = child.val();
            const uid = item.userUid || item.userUID || "unknown";
            const name = item.donorName || item.userName || "User";

            if (!userStats[uid]) {
                userStats[uid] = { name: name, count: 0 };
            }
            userStats[uid].count++;
        });

        const sorted = Object.values(userStats).sort((a, b) => b.count - a.count).slice(0, 5);
        leaderboardList.innerHTML = '';
        const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

        sorted.forEach((u, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-item';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '12px';
            row.style.padding = '12px 0';
            row.style.borderBottom = '1px solid #222';
            row.innerHTML = `
                <span style="font-size: 20px;">${medals[index] || '▪'}</span>
                <div style="flex: 1;">
                    <span style="font-weight: 700; color: #fff; display: block;">${u.name}</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 13px; color: var(--primary); font-weight:700;">${u.count} donations · ${(u.count * 0.9).toFixed(1)}kg</span>
                </div>`;
            leaderboardList.appendChild(row);
        });
    });
}
