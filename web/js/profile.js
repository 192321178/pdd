import { ref, onValue, off, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

let statsUnsub = null;
let userUnsub = null;

export function initProfile() {
    window.loadProfile = () => {
        const user = auth.currentUser;
        if (!user) return;

        _setupUserListener(user);
        _setupStatsListeners(user);
        _setupLeaderboard();
    };

    // Edit Profile Logic
    const modal = document.getElementById('edit-profile-modal');
    document.addEventListener('click', e => {
        if (e.target.id === 'btn-edit-profile' || e.target.closest('#btn-edit-profile')) {
            modal?.classList.remove('hidden');
            document.getElementById('edit-name').value = document.getElementById('profile-display-name')?.textContent || '';
            document.getElementById('edit-location').value = document.getElementById('profile-location-text')?.textContent?.replace('📍 ', '') || '';
        }
        if (e.target.id === 'btn-cancel-edit') modal?.classList.add('hidden');
    });

    document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        const newName = document.getElementById('edit-name').value.trim();
        const newLoc = document.getElementById('edit-location').value.trim();
        if (!newName) return alert("Name is required.");

        try {
            await update(ref(rtdb, `users/${user.uid}`), {
                name: newName,
                location: newLoc || 'Coimbatore'
            });
            modal?.classList.add('hidden');
        } catch (err) {
            alert("Failed to save: " + err.message);
        }
    });
}

function _setupUserListener(user) {
    if (userUnsub) off(ref(rtdb, `users/${user.uid}`), 'value', userUnsub);

    const userRef = ref(rtdb, `users/${user.uid}`);
    userUnsub = onValue(userRef, snap => {
        const data = snap.val() || {};
        const name = data.name || user.displayName || user.email?.split('@')[0] || 'User';
        const location = data.location || 'Coimbatore';

        document.getElementById('profile-display-name').textContent = name;
        document.getElementById('profile-location-text').textContent = `📍 ${location}`;
        const avatar = document.querySelector('.profile-avatar-circle');
        if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    });
}

function _setupStatsListeners(user) {
    if (statsUnsub) off(ref(rtdb, 'food_items'), 'value', statsUnsub);

    const foodRef = ref(rtdb, 'food_items');
    statsUnsub = onValue(foodRef, snapshot => {
        let donations = 0;
        let claims = 0;
        const uid = user.uid;

        snapshot.forEach(child => {
            const item = child.val();
            if (item.userUid === uid) donations++;
            if (item.claimedByUid === uid) claims++;
        });

        document.getElementById('stat-donations').textContent = donations;
        document.getElementById('stat-claims').textContent = claims;
        document.getElementById('stat-kg').textContent = (donations * 0.9).toFixed(1);
        document.getElementById('stat-co2').textContent = (donations * 2.5).toFixed(1);

        _updateBadges(donations, claims);
    });
}

function _updateBadges(d, c) {
    const container = document.getElementById('badges-container');
    if (!container) return;

    const earned = [];
    if (d >= 1) earned.push({ icon: '⭐', label: 'First Share', desc: '1st donation' });
    if (d >= 5) earned.push({ icon: '🌿', label: 'Eco Starter', desc: '5 donations' });
    if (d >= 10) earned.push({ icon: '👥', label: 'Community Star', desc: '10 donations' });
    if (d >= 20) earned.push({ icon: '🏆', label: 'Food Hero', desc: '20 donations' });
    if (c >= 1) earned.push({ icon: '🤚', label: 'First Claim', desc: '1st claim' });

    if (earned.length === 0) {
        container.innerHTML = `<div class="badge-lock"><i class="fas fa-lock"></i> <span>No badges yet — share food to unlock!</span></div>`;
    } else {
        container.innerHTML = earned.map(b => `
            <div class="badge-item">
                <span class="badge-icon">${b.icon}</span>
                <div>
                    <strong>${b.label}</strong>
                    <p>${b.desc}</p>
                </div>
            </div>
        `).join('');
    }
}

function _setupLeaderboard() {
    const lbContainer = document.getElementById('leaderboard-list');
    if (!lbContainer) return;

    onValue(ref(rtdb, 'food_items'), snapshot => {
        const stats = {};
        snapshot.forEach(child => {
            const item = child.val();
            const key = item.userUid || item.userName || 'Anonymous';
            if (!stats[key]) stats[key] = { name: item.isAnonymous ? 'Anonymous' : (item.userName || 'User'), count: 0 };
            stats[key].count++;
        });

        const sorted = Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 5);
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

        lbContainer.innerHTML = sorted.map((u, i) => `
            <div class="leaderboard-row">
                <span class="medal">${medals[i] || '▪'}</span>
                <div style="flex:1">
                    <span class="lb-name">${u.name}</span>
                </div>
                <div class="lb-stats">
                    <span>${u.count} donation${u.count !== 1 ? 's' : ''}</span>
                    <span style="color:var(--text-hint);font-size:12px;">${(u.count * 0.9).toFixed(1)} kg saved</span>
                </div>
            </div>
        `).join('');
    });
}
