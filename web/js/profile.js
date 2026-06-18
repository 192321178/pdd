import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initProfile() {
    // Profile is loaded on demand
}

function loadProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const name = user.displayName || user.email?.split('@')[0] || 'User';
    const initial = name.charAt(0).toUpperCase();

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('profile-avatar', initial);
    setEl('profile-name', name);
    setEl('profile-email', user.email || '');

    // Location from RTDB
    onValue(ref(rtdb, 'users/' + user.uid), snap => {
        const data = snap.val() || {};
        setEl('profile-location', `📍 ${data.location || 'Coimbatore'}`);
    });

    // Count activity from food_items & Load Leaderboard
    onValue(ref(rtdb, 'food_items'), snap => {
        let donations = 0, claims = 0;
        const userStats = {}; // To calculate leaderboard

        if (snap.exists()) {
            snap.forEach(child => {
                const item = child.val();

                // Track stats for the current user
                if (item.userUid === user.uid) donations++;
                if (item.claimedByUid === user.uid) claims++;

                // Collect stats for leaderboard (only donor items count)
                const donorId = item.userUid || item.userName || 'Anonymous';
                const donorName = item.userName || 'ShareBite User';

                if (!userStats[donorId]) {
                    userStats[donorId] = { name: donorName, count: 0 };
                }
                userStats[donorId].count++;
            });
        }

        // Stats for current user
        const foodKg = (donations * 0.9).toFixed(1); // 0.9kg per donation as per mobile app
        const co2 = (donations * 2.5).toFixed(1); // 2.5kg CO2 per donation

        setEl('stat-donations', donations);
        setEl('stat-claims', claims);
        setEl('stat-food', foodKg);
        setEl('stat-co2', co2);

        // Update Leaderboard List
        const leaderboardList = document.getElementById('leaderboard-list');
        if (leaderboardList) {
            // Sort users by donation count
            const sortedUsers = Object.values(userStats)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            leaderboardList.innerHTML = '';
            const medals = ["🥇", "🥈", "🥉", "4", "5"];

            sortedUsers.forEach((u, index) => {
                const isYou = (u.name === name);
                const row = document.createElement('div');
                row.className = `lb-row ${isYou ? 'lb-row-you' : ''}`;

                const rank = medals[index] || (index + 1);
                const kg = (u.count * 0.9).toFixed(1);
                const pts = u.count * 20;

                row.innerHTML = `
                    <span class="lb-rank">${rank}</span>
                    <div class="lb-info">
                        <b>${u.name}</b>
                        <span>${u.count} donations · ${kg} kg saved</span>
                    </div>
                    <span class="lb-pts">${pts} pts</span>
                `;
                leaderboardList.appendChild(row);
            });

            // If user not in top 5, add "You" row at bottom
            const inTop5 = sortedUsers.some(u => u.name === name);
            if (!inTop5) {
                const youRow = document.createElement('div');
                youRow.className = 'lb-row lb-row-you';
                youRow.innerHTML = `
                    <span class="lb-rank">You</span>
                    <div class="lb-info">
                        <b>${name}</b>
                        <span>${donations} donations · ${foodKg} kg saved</span>
                    </div>
                    <span class="lb-pts">${donations * 20} pts</span>
                `;
                leaderboardList.appendChild(youRow);
            }
        }

        // Badge unlock visual
        const badges = document.querySelectorAll('.badge-item');
        if (badges[0] && donations >= 1) badges[0].classList.remove('locked');
        if (badges[1] && donations >= 5) badges[1].classList.remove('locked');
        if (badges[2] && donations >= 10) badges[2].classList.remove('locked');
        if (badges[3] && donations >= 20) badges[3].classList.remove('locked');
        if (badges[4] && (donations + claims) >= 1) badges[4].classList.remove('locked');
    });
}

window.loadProfile = loadProfile;
