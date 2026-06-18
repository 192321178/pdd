import { ref, onValue, set, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";
import { auth } from "./firebase-config.js";

export function initFeed() {
    const feedGrid = document.getElementById('feed-grid');
    const listingCount = document.getElementById('listing-count');
    const filterChips = document.getElementById('filter-chips');
    const searchInput = document.getElementById('search-input');

    let allItems = [];
    let activeFilter = 'all';
    let searchQuery = '';

    const foodItemsRef = ref(rtdb, 'food_items');

    // Real-time listener
    onValue(foodItemsRef, (snapshot) => {
        allItems = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                allItems.push({ id: child.key, ...child.val() });
            });
            allItems.sort((a, b) => (b.expiryTimeMillis || 0) - (a.expiryTimeMillis || 0));
        }
        renderFeed();
    });

    function renderFeed() {
        let filtered = allItems;

        if (activeFilter !== 'all') {
            filtered = filtered.filter(i => i.category === activeFilter);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(i =>
                (i.foodName || '').toLowerCase().includes(q) ||
                (i.category || '').toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q)
            );
        }

        if (listingCount) listingCount.textContent = `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`;

        if (!filtered.length) {
            feedGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-emoji">🍱</div>
                    <p>${activeFilter !== 'all' ? 'No listings in this category' : 'No food listings yet. Be the first to share!'}</p>
                </div>`;
            return;
        }

        feedGrid.innerHTML = '';
        filtered.forEach(item => feedGrid.appendChild(createFoodCard(item)));
    }

    // Filter chip clicks
    filterChips?.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        document.querySelectorAll('#filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-cat');
        renderFeed();
    });

    // Search
    searchInput?.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderFeed();
    });
}

function createFoodCard(item) {
    const card = document.createElement('div');
    card.className = 'food-card';

    const now = Date.now();
    const timeLeft = (item.expiryTimeMillis || 0) - now;
    const hours = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const timeText = timeLeft > 0 ? `${hours}h ${mins}m left` : 'Expired';

    const userName = item.userName || (item.isAnonymous ? 'Anonymous' : 'User');
    const initial = userName.charAt(0).toUpperCase();

    card.innerHTML = `
        <div class="card-image">
            ${item.imageUri
            ? `<img src="${item.imageUri}" alt="${item.foodName || 'Food'}">`
            : `<span>🍱</span>`}
            <span class="badge-timer">🔴 ${timeText}</span>
            ${item.category ? `<span class="badge-category">${item.category}</span>` : ''}
            ${item.isClaimed ? `<div class="badge-claimed">CLAIMED</div>` : ''}
        </div>
        <div class="card-body">
            <p class="card-food-name">${item.foodName || 'Untitled Food'}</p>
            <p class="card-quantity">${item.quantity || ''}</p>
            <div class="card-divider"></div>
            <div class="card-footer" style="margin-top:auto;">
                <div class="user-row">
                    <div class="user-avatar">${initial}</div>
                    <span class="user-name">${userName}</span>
                </div>
                <span class="card-rating">⭐ 5.0</span>
            </div>
        </div>`;

    card.addEventListener('click', () => openFoodDetail(item));

    return card;
}

let detailTimerInterval = null;

function openFoodDetail(item) {
    const detailSec = document.getElementById('food-detail');
    if (!detailSec) return;

    // Header & Image
    const imgContainer = document.getElementById('detail-image-container');
    if (imgContainer) {
        imgContainer.style.backgroundImage = item.imageUri ? `url(${item.imageUri})` : 'none';
        imgContainer.innerHTML = item.imageUri ? '' : '<span style="font-size:100px; display:flex; align-items:center; justify-content:center; height:100%;">🍱</span>';
    }

    // Basic Info
    document.getElementById('detail-food-name').textContent = item.foodName || 'Untitled Food';
    document.getElementById('detail-category').textContent = item.category || 'Food';
    document.getElementById('detail-quantity').textContent = item.quantity || '-';
    document.getElementById('detail-location').textContent = item.location || '-';
    document.getElementById('detail-pickup-loc').textContent = item.location || '-';
    document.getElementById('detail-description').textContent = item.description || 'No description provided.';

    // Category badge
    const catBadge = document.getElementById('detail-category-badge');
    if (catBadge) catBadge.textContent = item.category || 'Food';

    // Topbar title
    const topbarTitle = document.getElementById('detail-topbar-title');
    if (topbarTitle) topbarTitle.textContent = item.foodName || 'Food Detail';

    // Tags
    const tagsContainer = document.getElementById('detail-tags');
    tagsContainer.innerHTML = '';
    if (item.dietaryTags && item.dietaryTags.length) {
        item.dietaryTags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'detail-tag';
            span.textContent = tag;
            tagsContainer.appendChild(span);
        });
    }

    // Donor
    const userName = item.userName || (item.isAnonymous ? 'Anonymous' : 'User');
    document.getElementById('detail-donor-name').textContent = userName;
    document.getElementById('detail-donor-avatar').textContent = userName.charAt(0).toUpperCase();

    // Timer — updates both the main timer display and the image badge  
    if (detailTimerInterval) clearInterval(detailTimerInterval);
    const updateTimer = () => {
        const now = Date.now();
        const timeLeft = (item.expiryTimeMillis || 0) - now;
        const claimBtn = document.getElementById('btn-detail-claim');
        if (timeLeft <= 0) {
            document.getElementById('detail-timer').textContent = '00 : 00 : 00';
            const timerBadge = document.getElementById('detail-timer-badge');
            if (timerBadge) timerBadge.textContent = '⏱ Expired';
            if (claimBtn) { claimBtn.disabled = true; claimBtn.textContent = 'EXPIRED'; }
            clearInterval(detailTimerInterval);
            return;
        }
        const h = Math.floor(timeLeft / 3600000).toString().padStart(2, '0');
        const m = Math.floor((timeLeft % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((timeLeft % 60000) / 1000).toString().padStart(2, '0');
        document.getElementById('detail-timer').textContent = `${h} : ${m} : ${s}`;
        const timerBadge = document.getElementById('detail-timer-badge');
        if (timerBadge) timerBadge.textContent = `⏱ ${h}h ${m}m left`;
    };
    updateTimer();
    detailTimerInterval = setInterval(updateTimer, 1000);

    // Action buttons (new desktop IDs)
    const claimBtn = document.getElementById('btn-detail-claim');
    const msgBtn = document.getElementById('btn-detail-message');

    if (item.isClaimed) {
        claimBtn.disabled = true;
        claimBtn.textContent = 'ALREADY CLAIMED';
    } else {
        claimBtn.disabled = false;
        claimBtn.textContent = 'CLAIM FOOD';
        claimBtn.style.background = '';
        claimBtn.onclick = async () => {
            claimBtn.disabled = true;
            claimBtn.textContent = 'Claiming...';
            await handleClaim(item.id, item.userUid, item.userName, item.foodName);
            claimBtn.textContent = 'CLAIMED! ✓';
        };
    }

    msgBtn.onclick = () => {
        window.navigateTo?.('messages');
    };

    // Back Button
    document.getElementById('btn-detail-back').onclick = () => {
        if (detailTimerInterval) { clearInterval(detailTimerInterval); detailTimerInterval = null; }
        window.navigateTo?.('feed');
    };

    // Show the overlay
    window.navigateTo?.('food-detail');
}

async function handleClaim(itemId, donorUid, donorName, foodName) {
    const user = auth.currentUser;
    if (!user) { window.showToast?.('Please login first', 'error'); return; }
    if (!itemId) return;

    try {
        await set(ref(rtdb, `food_items/${itemId}/isClaimed`), true);
        await set(ref(rtdb, `food_items/${itemId}/claimedByUid`), user.uid);
        window.showToast?.('🎉 Food claimed! Message the donor.', 'success');

        // Auto-start a chat thread
        if (donorUid && donorUid !== user.uid) {
            const chatId = [user.uid, donorUid].sort().join('_');
            const now = Date.now();

            const msgRef = ref(rtdb, `chats/${chatId}`);
            const newMsgRef = push(msgRef);

            const myName = user.displayName || user.email?.split('@')[0] || 'User';
            const msgText = `Hi! I just claimed your "${foodName}". When can I pick it up?`;

            await set(newMsgRef, {
                messageId: newMsgRef.key,
                text: msgText, // web uses text, mobile uses message. I'll provide both for compatibility
                message: msgText,
                senderId: user.uid,
                senderName: myName,
                timestamp: now
            });

            // Update user_chats previews for both
            const myPreviewData = {
                chatId,
                otherUserId: donorUid,
                otherUserName: donorName || 'ShareBite User',
                foodName,
                lastMessage: msgText,
                timestamp: now
            };
            const otherPreviewData = {
                chatId,
                otherUserId: user.uid,
                otherUserName: myName,
                foodName,
                lastMessage: msgText,
                timestamp: now
            };

            await set(ref(rtdb, `user_chats/${user.uid}/${chatId}`), myPreviewData);
            await set(ref(rtdb, `user_chats/${donorUid}/${chatId}`), otherPreviewData);
        }
    } catch (err) {
        console.error('Claim error:', err);
        window.showToast?.('Claim failed. Try again.', 'error');
    }
}

window.loadFeed = initFeed;
