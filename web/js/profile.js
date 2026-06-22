import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initProfile() {
    window.loadProfile = () => {
        const user = auth.currentUser;
        if (!user) return;

        const nameEl = document.getElementById('profile-display-name');
        const avatarEl = document.querySelector('.profile-avatar-circle');

        const nameRef = ref(rtdb, `users/${user.uid}/displayName`);
        const locationRef = ref(rtdb, `users/${user.uid}/location`);

        onValue(nameRef, snap => {
            const name = snap.val() || user.displayName || user.email?.split('@')[0] || 'User';
            nameEl.textContent = name;
            avatarEl.textContent = name.charAt(0).toUpperCase();
        });

        // Load Stats
        onValue(ref(rtdb, `users/${user.uid}/impact_stats`), snapshot => {
            const stats = snapshot.val() || { donations: 0, claims: 0, kg_saved: 0.0, co2_reduced: 0.0 };
            document.getElementById('stat-donations').textContent = stats.donations || 0;
            document.getElementById('stat-claims').textContent = stats.claims || 0;
            document.getElementById('stat-kg').textContent = (stats.kg_saved || 0.0).toFixed(1);
            document.getElementById('stat-co2').textContent = (stats.co2_reduced || 0.0).toFixed(1);
        });

        // Leaderboard listener already in setup, but ensuring it's robust
        updateLeaderboard();
    };

    const modal = document.getElementById('edit-profile-modal');
    document.addEventListener('click', e => {
        if (e.target.closest('.profile-edit-btn') || e.target.closest('#btn-edit-profile')) {
            modal.classList.remove('hidden');
            const user = auth.currentUser;
            document.getElementById('edit-name').value = document.getElementById('profile-display-name').textContent;
        }
        if (e.target.id === 'btn-cancel-edit') modal.classList.add('hidden');
    });

    document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        const newName = document.getElementById('edit-name').value.trim();
        const newLocation = document.getElementById('edit-location').value.trim();

        if (newName) {
            await set(ref(rtdb, `users/${user.uid}/displayName`), newName);
            // Updating all items by this user is complex, but the leaderboard uses the user node directly
        }
        if (newLocation) {
            await set(ref(rtdb, `users/${user.uid}/location`), newLocation);
        }
        modal.classList.add('hidden');
        window.showToast?.('Profile updated!', 'success');
    });
}

function updateLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    onValue(ref(rtdb, 'users'), snapshot => {
        const users = [];
        snapshot.forEach(child => {
            const u = child.val();
            const stats = u.impact_stats || { donations: 0, kg_saved: 0 };
            users.push({
                name: u.displayName || u.email?.split('@')[0] || 'User',
                donations: stats.donations || 0,
                kg: stats.kg_saved || 0
            });
        });

        users.sort((a, b) => (b.donations - a.donations) || (b.kg - a.kg));
        leaderboardList.innerHTML = '';
        users.slice(0, 5).forEach((u, index) => {
            const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
            const row = document.createElement('div');
            row.className = 'leaderboard-item';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '12px';
            row.style.padding = '12px 0';
            row.style.borderBottom = '1px solid #222';
            row.innerHTML = `
                <span style="font-size: 20px;">${medals[index] || '🏅'}</span>
                <div style="flex: 1;">
                    <span style="font-weight: 700; color: #fff; display: block;">${u.name}</span>
                    <span style="font-size: 12px; color: #888;">${u.donations} donations · ${u.kg.toFixed(1)}kg</span>
                </div>`;
            leaderboardList.appendChild(row);
        });
    });
}
