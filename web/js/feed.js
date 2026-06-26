import { ref, onValue, off, update, runTransaction, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

let feedUnsub = null;

export function initFeed() {
    const filterChips = document.querySelectorAll('.chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            loadFeed();
        });
    });

    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', () => loadFeed());
}

export function loadFeed() {
    const feedGrid = document.getElementById('feed-grid');
    const category = document.querySelector('.chip.active')?.dataset.cat || 'all';
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase() || '';

    if (feedUnsub) off(ref(rtdb, 'food_items'), 'value', feedUnsub);

    const foodRef = ref(rtdb, 'food_items');
    feedUnsub = onValue(foodRef, snapshot => {
        feedGrid.innerHTML = '';
        const items = [];
        const now = Date.now();

        snapshot.forEach(child => {
            const val = child.val();
            // Matching mobile: Keep history visible. We only filter if we strictly want "active only"
            // For the main feed, we show items but mark them as Expired.
            // if (val.expiryTimeMillis > 0 && now > val.expiryTimeMillis) return; 

            // Filter by search and category
            const matchesCategory = category === 'all' || val.category === category;
            const matchesSearch = val.foodName.toLowerCase().includes(searchQuery) ||
                val.description.toLowerCase().includes(searchQuery);

            if (matchesCategory && matchesSearch) {
                items.push({ id: child.key, ...val });
            }
        });

        items.sort((a, b) => {
            const timeA = a.createdAt || a.timestamp || 0;
            const timeB = b.createdAt || b.timestamp || 0;
            return timeB - timeA;
        });

        document.getElementById('listing-count').textContent = `${items.length} listings`;

        if (items.length === 0) {
            feedGrid.innerHTML = `
                <div class="empty-state">
                    <img src="https://cdni.iconscout.com/illustration/premium/thumb/empty-state-2130362-1800926.png" width="150" style="opacity:0.5">
                    <p>No food listings near you right now.</p>
                </div>`;
            return;
        }

        items.forEach(item => {
            const card = _createFoodCard(item);
            feedGrid.appendChild(card);
        });
    }, err => console.error('Feed RTDB error:', err));
}

function _createFoodCard(item) {
    const card = document.createElement('div');
    card.className = 'food-card';

    const isExpired = item.expiryTimeMillis > 0 && Date.now() > item.expiryTimeMillis;
    const timeStr = isExpired ? 'Expired' : _getTimeLeft(item.expiryTimeMillis);
    const initial = item.userName?.charAt(0).toUpperCase() || 'U';

    card.innerHTML = `
        <div class="card-image-wrap ${isExpired ? 'expired-wrap' : ''}">
            ${item.imageUri ? `<img src="${item.imageUri}" alt="${item.foodName}">` : `<div class="no-image-placeholder"><i class="fas fa-utensils"></i></div>`}
            <div class="card-cat-badge">${item.category}</div>
            ${isClaimed ? `<div class="claimed-banner"><span>CLAIMED ✓</span></div>` : ''}
            ${isExpired && !isClaimed ? `<div class="expired-banner"><span>EXPIRED</span></div>` : ''}
        </div>
        <div class="card-body">
            <div class="card-row-top">
                <span class="card-time-left ${isExpired ? 'expired' : (timeStr.includes('mins') ? 'urgent' : '')}">${timeStr}</span>
                <span class="star-rating">★ 4.8</span>
            </div>
            <h3 class="card-title">${item.foodName}</h3>
            <p class="card-text-secondary">${_truncate(item.description || 'Fresh and ready to pick up!', 60)}</p>
            <div class="card-footer">
                <div class="user-pill">
                    <div class="avatar-small">${initial}</div>
                    <span>${item.isAnonymous ? 'Anonymous' : (item.userName || 'User')}</span>
                </div>
            </div>
        </div>
    `;
    card.onclick = () => openFoodDetail(item);
    return card;
}

function openFoodDetail(item) {
    const detailScreen = document.getElementById('food-detail-screen');
    detailScreen.classList.remove('hidden');

    const itemRef = ref(rtdb, `food_items/${item.id}`);

    // Use onValue as the primary driver for the detail page UI
    onValue(itemRef, snap => {
        if (!snap.exists()) {
            detailScreen.classList.add('hidden');
            return;
        }
        const updatedItem = { id: item.id, ...snap.val() };

        detailScreen.innerHTML = `
            <div class="detail-android-layout">
                <div class="detail-image-box">
                    <button class="btn-back-detail" onclick="document.getElementById('food-detail-screen').classList.add('hidden')">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    ${updatedItem.imageUri ? `<img src="${updatedItem.imageUri}">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#E8EAED;"><i class="fas fa-utensils fa-3x" style="color:#999;"></i></div>`}
                </div>
                <div class="detail-content-scroll">
                    <div class="detail-title-row">
                        <h2 class="detail-food-name">${updatedItem.foodName}</h2>
                        <div class="countdown-box">
                            <i class="far fa-clock"></i>
                            <span id="detail-countdown">${_getTimeLeft(updatedItem.expiryTimeMillis)}</span>
                        </div>
                    </div>
                    <div class="detail-category-row">
                        <span class="cat-chip-detail">${updatedItem.category}</span>
                    </div>
                    
                    <div class="detail-info-rows">
                        <div class="info-row"><i class="fas fa-balance-scale"></i> <span>Quantity: ${updatedItem.quantity}</span></div>
                        <div class="info-row"><i class="fas fa-map-marker-alt"></i> <span>${updatedItem.location}</span></div>
                        <div class="info-row"><i class="fas fa-clock"></i> <span>Pickup: Now · Nearby</span></div>
                    </div>

                    <div class="dietary-chips-row">
                        ${(updatedItem.dietaryTags || []).map(t => `<span class="diet-chip">${t}</span>`).join('')}
                    </div>

                    <div class="about-section">
                        <h3>About this listing</h3>
                        <p style="color:#5F6368; line-height:1.6;">${updatedItem.description || 'No description provided.'}</p>
                    </div>

                    <div class="about-section">
                        <h3>Donor</h3>
                        <div class="donor-card">
                            <div class="donor-avatar">${updatedItem.userName?.charAt(0).toUpperCase() || 'U'}</div>
                            <div style="flex:1">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <strong>${updatedItem.isAnonymous ? 'Anonymous' : (updatedItem.userName || 'User')}</strong>
                                    <span class="star-rating">★ 4.8</span>
                                </div>
                                <span style="font-size:12px;color:#5F6368;">Neighborhood Hero · 12 donations</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-actions" id="detail-actions-box">
                        ${_getDetailButtons(updatedItem)}
                    </div>
                </div>
            </div>
        `;

        // Start countdown refresh
        if (window.detailTimer) clearInterval(window.detailTimer);
        window.detailTimer = setInterval(() => {
            const el = document.getElementById('detail-countdown');
            if (el) el.textContent = _getTimeLeft(updatedItem.expiryTimeMillis);
            else clearInterval(window.detailTimer);
        }, 1000);

    }, { onlyOnce: false });
}

function _getDetailButtons(item) {
    const user = auth.currentUser;
    if (!user) return '';

    if (item.userUid === user.uid) {
        return `<p style="text-align:center;color:var(--primary);font-weight:700;">You are the donor of this item</p>`;
    }
    if (item.isClaimed) {
        if (item.claimedByUid === user.uid) {
            return `
                <div style="background:#E8F5E9;padding:16px;border-radius:12px;text-align:center;margin-bottom:12px;">
                    <p style="color:#2E7D32;font-weight:800;margin-bottom:4px;">Claimed by you! ✓</p>
                    <p style="font-size:13px;color:#333;">Your OTP: <strong style="font-size:18px;color:var(--primary);">${item.claimOtp || '----'}</strong></p>
                </div>
                <button class="btn-web-msg" onclick="window.messageDonor('${item.id}', '${item.userUid}', '${item.userName}', '${item.foodName}')">
                    <i class="fas fa-comment"></i> MESSAGE DONOR
                </button>
            `;
        } else {
            return `<button class="btn-web-claim" disabled style="background:#BDC1C6;">SOMEONE ELSE CLAIMED THIS</button>`;
        }
    }
    return `<button class="btn-web-claim" onclick="window.claimFood('${item.id}', '${item.foodName}', '${item.userUid}', '${item.userName}')">CLAIM FOOD</button>`;
}

window.claimFood = async (id, name, donorId, donorName) => {
    const user = auth.currentUser;
    if (!user) return alert("Please login to claim.");

    const otp = Math.floor(1000 + Math.random() * 9000);
    const itemRef = ref(rtdb, `food_items/${id}`);

    try {
        await runTransaction(itemRef, (currentData) => {
            if (currentData === null) return currentData;
            if (currentData.isClaimed) return; // Already claimed/cancelled

            return {
                ...currentData,
                isClaimed: true,
                claimedByUid: user.uid,
                claimOtp: otp,
                claimedAt: Date.now()
            };
        });

        // Send System Message to donor chat
        const chatId = [user.uid, donorId].sort().join('_') + '_' + id.substring(0, 5);
        const msgRef = push(ref(rtdb, `chats/${chatId}`));
        const now = Date.now();
        const sysText = `System: ${user.displayName || 'A user'} has claimed your "${name}".\nOTP: ${otp}\nPlease coordinate pickup.`;

        await set(msgRef, {
            messageId: msgRef.key,
            senderId: 'system',
            senderName: 'System',
            message: sysText,
            timestamp: now,
            isSystem: true
        });

        // Update previews in user_chats
        const myName = user.displayName || user.email?.split('@')[0] || 'User';
        const myChatRef = ref(rtdb, `user_chats/${user.uid}/${chatId}`);
        const donorChatRef = ref(rtdb, `user_chats/${donorId}/${chatId}`);

        const baseMeta = {
            chatId: chatId,
            foodName: name,
            lastMessage: sysText,
            timestamp: now
        };

        await set(myChatRef, { ...baseMeta, otherUserId: donorId, otherUserName: donorName, unreadCount: 0 });
        await set(donorChatRef, { ...baseMeta, otherUserId: user.uid, otherUserName: myName, unreadCount: 1 });

        alert(`Claimed! Your OTP is ${otp}. Use the Messages tab to contact the donor.`);
    } catch (err) {
        alert("Failed to claim: " + err.message);
    }
};

window.messageDonor = (foodId, donorId, donorName, foodName) => {
    const user = auth.currentUser;
    if (!user) return;
    const chatId = [user.uid, donorId].sort().join('_');
    window.activeClaimChat = { chatId, donorId, donorName, foodName, isAutoOpen: true };
    document.querySelector('[data-screen="message"]').click();
};

function _getTimeLeft(expiry) {
    if (!expiry) return '20 mins left';
    const rem = expiry - Date.now();
    if (rem <= 0) return 'Expired';
    const hrs = Math.floor(rem / 3600000);
    const mins = Math.floor((rem % 3600000) / 60000);
    return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
}

function _truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
}
