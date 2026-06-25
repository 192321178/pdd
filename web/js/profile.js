import {
    doc, getDoc, setDoc, collection, query,
    where, onSnapshot, orderBy, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

let donationUnsub = null;
let claimUnsub = null;
let userUnsub = null;

export function initProfile() {
    window.loadProfile = () => {
        const user = auth.currentUser;
        if (!user) return;

        _setupUserListener(user);
        _setupStatsListeners(user);
        _setupLeaderboard();
    };

    // Edit Profile Modal
    const modal = document.getElementById('edit-profile-modal');
    document.addEventListener('click', e => {
        if (e.target.id === 'btn-edit-profile' || e.target.closest('#btn-edit-profile')) {
            if (!auth.currentUser) return;
            modal?.classList.remove('hidden');
            document.getElementById('edit-name').value =
                document.getElementById('profile-display-name')?.textContent || '';
            document.getElementById('edit-location').value =
                document.getElementById('profile-location-text')?.textContent?.replace(/📍\s*/, '') || '';
        }
        if (e.target.id === 'btn-cancel-edit') modal?.classList.add('hidden');
    });

    document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        const newName = document.getElementById('edit-name').value.trim();
        const newLoc = document.getElementById('edit-location').value.trim();
        if (!newName) return alert('Name cannot be empty.');
        try {
            await setDoc(doc(db, 'users', user.uid), {
                name: newName,
                email: user.email || '',
                location: newLoc || 'Coimbatore'
            }, { merge: true });
            modal?.classList.add('hidden');
        } catch (err) {
            alert('Failed to save: ' + err.message);
        }
    });
}

function _setupUserListener(user) {
    if (userUnsub) userUnsub();
    userUnsub = onSnapshot(doc(db, 'users', user.uid), snap => {
        const data = snap.exists() ? snap.data() : {};
        const name = data.name || user.displayName || user.email?.split('@')[0] || 'User';
        const location = data.location || 'Coimbatore';

        const nameEl = document.getElementById('profile-display-name');
        const avatarEl = document.querySelector('.profile-avatar-circle');
        const locationEl = document.getElementById('profile-location-text');

        if (nameEl) nameEl.textContent = name;
        if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
        if (locationEl) locationEl.textContent = `📍 ${location}`;
    }, () => { });
}

function _setupStatsListeners(user) {
    if (donationUnsub) donationUnsub();
    if (claimUnsub) claimUnsub();

    const donationQ = query(collection(db, 'food_items'), where('userUid', '==', user.uid));
    donationUnsub = onSnapshot(donationQ, snap => {
        const donations = snap.size;
        const foodKg = (donations * 0.9).toFixed(1);
        const co2Kg = (donations * 2.5).toFixed(1);

        const el = document.getElementById('stat-donations');
        if (el) el.textContent = donations;
        const kgEl = document.getElementById('stat-kg');
        if (kgEl) kgEl.textContent = foodKg;
        const co2El = document.getElementById('stat-co2');
        if (co2El) co2El.textContent = co2Kg;

        _updateBadges(donations, null);
    }, () => { });

    const claimQ = query(collection(db, 'food_items'), where('claimedByUid', '==', user.uid));
    claimUnsub = onSnapshot(claimQ, snap => {
        const claims = snap.size;
        const el = document.getElementById('stat-claims');
        if (el) el.textContent = claims;
        _updateBadges(null, claims);
    }, () => { });
}

let _cachedDonations = null;
let _cachedClaims = null;

function _updateBadges(donations, claims) {
    if (donations !== null) _cachedDonations = donations;
    if (claims !== null) _cachedClaims = claims;

    const d = _cachedDonations ?? 0;
    const c = _cachedClaims ?? 0;

    const badgeContainer = document.getElementById('badges-container');
    if (!badgeContainer) return;

    const earned = [];
    if (d >= 1) earned.push({ icon: '⭐', label: 'First Share', desc: '1st donation' });
    if (d >= 5) earned.push({ icon: '🌿', label: 'Eco Starter', desc: '5 donations' });
    if (d >= 10) earned.push({ icon: '👥', label: 'Community Star', desc: '10 donations' });
    if (d >= 20) earned.push({ icon: '🏆', label: 'Food Hero', desc: '20 donations' });
    if (c >= 1) earned.push({ icon: '🤚', label: 'First Claim', desc: '1st claim' });

    if (earned.length === 0) {
        badgeContainer.innerHTML = `<div class="badge-lock"><i class="fas fa-lock"></i> <span>No badges yet — start sharing food!</span></div>`;
    } else {
        badgeContainer.innerHTML = earned.map(b =>
            `<div class="badge-item"><span class="badge-icon">${b.icon}</span><div><strong>${b.label}</strong><p>${b.desc}</p></div></div>`
        ).join('');
    }
}

function _setupLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    onSnapshot(collection(db, 'food_items'), snapshot => {
        const userStats = {};
        snapshot.forEach(d => {
            const item = d.data();
            const uid = item.userUid || '';
            const name = item.isAnonymous ? 'Anonymous' : (item.userName || 'User');
            const key = uid || name;
            if (!userStats[key]) userStats[key] = { name, count: 0 };
            userStats[key].count++;
        });

        const sorted = Object.values(userStats).sort((a, b) => b.count - a.count).slice(0, 5);
        leaderboardList.innerHTML = '';
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        sorted.forEach((u, i) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-row';
            row.innerHTML = `
                <span class="medal">${medals[i] || '▪'}</span>
                <div style="flex:1">
                    <span class="lb-name">${u.name}</span>
                </div>
                <div class="lb-stats">
                    <span>${u.count} donation${u.count !== 1 ? 's' : ''}</span>
                    <span style="color:var(--text-hint);font-size:12px;">${(u.count * 0.9).toFixed(1)} kg saved</span>
                </div>`;
            leaderboardList.appendChild(row);
        });
    }, () => { });
}
