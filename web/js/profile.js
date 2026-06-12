import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

export function initProfile() {
    const profileScreen = document.getElementById('profile-screen');

    const handleAuth = (user) => {
        if (!user) return;

        profileScreen.innerHTML = `
            <div class="profile-container">
                <div class="profile-card glass">
                    <div class="profile-avatar-large">${user.email.charAt(0).toUpperCase()}</div>
                    <h2>${user.displayName || user.email.split('@')[0]}</h2>
                    <p>${user.email}</p>
                    <button class="btn-secondary" onclick="window.logout()" style="width: auto; margin: 1rem auto; padding: 10px 24px;">Logout</button>
                    
                    <div class="stats-row">
                        <div class="stat-item glass">
                            <span id="stat-shares" class="stat-value">0</span>
                            <span class="stat-label">Shared</span>
                        </div>
                        <div class="stat-item glass">
                            <span id="stat-claims" class="stat-value">0</span>
                            <span class="stat-label">Claimed</span>
                        </div>
                        <div class="stat-item glass">
                            <span id="stat-impact" class="stat-value">0</span>
                            <span class="stat-label">CO2 Saved (kg)</span>
                        </div>
                        <div class="stat-item glass">
                            <span id="stat-meals" class="stat-value">0</span>
                            <span class="stat-label">Meals Provided</span>
                        </div>
                    </div>
                </div>

                <div class="leaderboard-section glass">
                    <h3>Impact Leaderboard</h3>
                    <div id="leaderboard-list"></div>
                </div>
            </div>
        `;

        loadUserStats(user.uid);
    };

    auth.onAuthStateChanged(handleAuth);
}

function loadUserStats(uid) {
    const foodItemsRef = ref(rtdb, 'food_items');

    onValue(foodItemsRef, (snapshot) => {
        if (!snapshot.exists()) return;

        let shareCount = 0;
        let claimCount = 0;

        snapshot.forEach((child) => {
            const item = child.val();
            if (item.userUid === uid) shareCount++;
            if (item.claimedByUid === uid) claimCount++;
        });

        const sharesEl = document.getElementById('stat-shares');
        const impactEl = document.getElementById('stat-impact');
        const mealsEl = document.getElementById('stat-meals');
        const claimsEl = document.getElementById('stat-claims');

        if (sharesEl) sharesEl.textContent = shareCount;
        if (impactEl) impactEl.textContent = (shareCount * 2.5).toFixed(1);
        if (mealsEl) mealsEl.textContent = (shareCount * 1.5).toFixed(0);
        if (claimsEl) claimsEl.textContent = claimCount;
    });
}

window.loadProfile = initProfile;
