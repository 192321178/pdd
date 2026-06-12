import { ref, onValue, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";

export function initFeed() {
    const feedScreen = document.getElementById('feed-screen');

    // Inject Feed Structure
    feedScreen.innerHTML = `
        <div class="feed-header">
            <h2>Fresh Neighborly Shares</h2>
            <div class="feed-filters">
                <button class="chip active" data-cat="all">All</button>
                <button class="chip" data-cat="Cooked Meal">Cooked</button>
                <button class="chip" data-cat="Fresh Produce">Produce</button>
            </div>
        </div>
        <div id="feed-grid" class="feed-grid">
            <div class="loader">Loading fresh shares...</div>
        </div>
    `;

    const feedGrid = document.getElementById('feed-grid');
    const foodItemsRef = ref(rtdb, 'food_items');

    // Real-time listener using RTDB
    onValue(foodItemsRef, (snapshot) => {
        feedGrid.innerHTML = '';
        if (!snapshot.exists()) {
            feedGrid.innerHTML = '<div class="empty-state">No listings found. Be the first to share!</div>';
            return;
        }

        const items = [];
        snapshot.forEach((child) => {
            const item = child.val();
            items.push(item);
        });

        // Sort by expiry (descending)
        items.sort((a, b) => b.expiryTimeMillis - a.expiryTimeMillis);

        items.forEach((item) => {
            const card = createFoodCard(item);
            feedGrid.appendChild(card);
        });

        lucide.createIcons();
    });

    // Chip logic
    feedScreen.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip')) {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            // Filter logic can be added here
        }
    });
}

function createFoodCard(item) {
    const card = document.createElement('div');
    card.className = 'food-card glass';

    const now = Date.now();
    const timeLeft = item.expiryTimeMillis - now;
    const hours = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const timeText = timeLeft > 0 ? `${hours}h ${mins}m left` : "Expired";

    card.innerHTML = `
        <div class="card-image">
            ${item.imageUri ? `<img src="${item.imageUri}" alt="${item.foodName}">` : `<div class="no-image"><i data-lucide="image"></i></div>`}
            ${item.isClaimed ? '<span class="badge claimed">Claimed</span>' : `<span class="badge timer">${timeText}</span>`}
        </div>
        <div class="card-body">
            <div class="card-meta">
                <span class="category">${item.category}</span>
                <span class="quantity">${item.quantity}</span>
            </div>
            <h3>${item.foodName}</h3>
            <p class="desc">${item.description || 'Fresh and ready to pick up!'}</p>
            <div class="card-footer">
                <div class="user-info">
                    <div class="avatar">${item.userName.charAt(0)}</div>
                    <span>${item.userName}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-chat-mini" onclick="window.startChat('${item.userUid}', '${item.userName}', '${item.foodName}')">
                        <i data-lucide="message-square"></i>
                    </button>
                    <button class="btn-claim" ${item.isClaimed ? 'disabled' : ''} onclick="window.claimFood('${item.id}')">
                        ${item.isClaimed ? 'Taken' : 'Claim'}
                    </button>
                </div>
            </div>
        </div>
    `;

    return card;
}

// Global claim function
import { set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { showToast } from "./app.js";

window.claimFood = async (itemId) => {
    const user = rtdb.app.container.getProvider("auth").getImmediate().currentUser;
    if (!user) return showToast("Please login first", "error");

    try {
        await set(ref(rtdb, `food_items/${itemId}/isClaimed`), true);
        await set(ref(rtdb, `food_items/${itemId}/claimedByUid`), user.uid);
        showToast("Food claimed! Check your messages.", "success");
    } catch (error) {
        showToast("Claim failed. Try again.", "error");
    }
};

window.loadFeed = initFeed;
