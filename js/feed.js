import { ref, onValue, off, update, runTransaction, push, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

let feedUnsub = null;

export function initFeed() {
    window.loadFeed = loadFeed; // ✅ expose so app.js can call on Home nav
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

    const homeMenuBtn = document.getElementById('home-hamburger-btn');
    homeMenuBtn?.addEventListener('click', () => {
        if (window.showGlobalHamburgerMenu) {
            window.showGlobalHamburgerMenu();
        }
    });
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
            const itemId = child.key;

            // Rule #2: Never show expired items + Auto-delete from Firebase
            if (val.expiryTimeMillis > 0 && now > val.expiryTimeMillis) {
                const itemRef = ref(rtdb, `food_items/${itemId}`);
                set(itemRef, null).catch(err => console.error("Auto-cleanup failed:", err));
                return;
            }

            // Filter by search and category
            const matchesCategory = category === 'all' || val.category === category;
            const matchesSearch = val.foodName.toLowerCase().includes(searchQuery) ||
                (val.description && val.description.toLowerCase().includes(searchQuery));

            if (matchesCategory && matchesSearch) {
                items.push({ id: itemId, ...val });
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

    const initial = item.userName?.charAt(0).toUpperCase() || 'U';
    const timeStr = _getTimeLeft(item.expiryTimeMillis);
    const isClaimed = item.isClaimed === true;

    // Async fetch donor rating for feed card
    const ratingSpanId = `card-rating-${item.id}`;
    if (item.userUid) {
        get(ref(rtdb, `user_stats/${item.userUid}`)).then(snap => {
            if (snap.exists()) {
                const avg = snap.val()?.avgRating;
                const el = document.getElementById(ratingSpanId);
                if (el && avg > 0) el.textContent = `★ ${avg}`;
            }
        }).catch(() => {});
    }

    card.innerHTML = `
        <div class="card-image-wrap" style="position:relative;">
            ${item.imageUri ? `<img src="${item.imageUri}" alt="${item.foodName}">` : `<div class="no-image-placeholder"><i class="fas fa-utensils"></i></div>`}
            <div class="card-cat-badge">${item.category}</div>
            ${isClaimed ? `
                <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(34,197,94,0.85);padding:8px 0;text-align:center;pointer-events:none;">
                    <span style="color:#fff;font-weight:700;font-size:14px;">✓ Claimed</span>
                </div>` : ''}
        </div>
        <div class="card-body">
            <div class="card-row-top">
                <span class="card-time-left ${timeStr.includes('m left') && !timeStr.includes('h') ? 'urgent' : ''}">${timeStr}</span>
                <span class="star-rating" id="${ratingSpanId}">★ 4.8</span>
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

// ✅ Track listener so we can detach it on next open
let _detailUnsub = null;

function openFoodDetail(item) {
    const detailScreen = document.getElementById('food-detail-screen');
    window.navigateTo('food-detail');
    window.currentDetailItem = item;

    if (_detailUnsub) {
        _detailUnsub();
        _detailUnsub = null;
    }
    if (window.detailTimer) { clearInterval(window.detailTimer); window.detailTimer = null; }

    const itemRef = ref(rtdb, `food_items/${item.id}`);

    _detailUnsub = onValue(itemRef, snap => {
        if (!snap.exists()) {
            window.navigateTo('home');
            return;
        }
        const d = { id: item.id, ...snap.val() };
        window.currentDetailItem = d;
        const user = auth.currentUser;
        const myUid = user?.uid || '';
        const myName = user?.displayName || user?.email?.split('@')[0] || 'User';

        const initial = d.userName?.charAt(0).toUpperCase() || 'U';
        const dietary = (d.dietaryTags || []).map(t => `<span class="diet-chip">${t}</span>`).join('');

        // Check if claimer owes a pending rating
        if (d.pendingRatingFor === myUid && d.userUid !== myUid) {
            setTimeout(() => {
                if (window.showRatingModal) {
                    window.showRatingModal(d, myUid, myName, d.userUid);
                }
            }, 300);
        }

        detailScreen.innerHTML = `
            <div class="detail-web-layout">
                <!-- LEFT: back button + image + hamburger menu -->
                <div class="detail-web-left">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <button class="btn-back-detail-web" onclick="window.navigateTo('home')">
                            <i class="fas fa-arrow-left"></i> Back to Feed
                        </button>
                        <button id="btn-hamburger-menu" style="background:#F8F9FA;border:1px solid #E0E0E0;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#333;">
                            ≡
                        </button>
                    </div>
                    <div class="detail-web-image-box">
                        ${d.imageUri
                ? `<img src="${d.imageUri}" alt="${d.foodName}">`
                : `<div class="detail-no-img"><i class="fas fa-utensils fa-4x" style="color:#ccc;"></i></div>`}
                    </div>
                    <!-- Donor card below image on left -->
                    <div class="detail-web-donor-card">
                        <div class="donor-avatar">${initial}</div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong style="font-size:15px;">${d.isAnonymous ? 'Anonymous' : (d.userName || 'User')}</strong>
                                <span class="star-rating" id="donor-detail-rating">★ New</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                                <span style="font-size:12px;color:#5F6368;" id="donor-detail-donations">Neighborhood Hero</span>
                                <button id="btn-view-reviews" style="background:none;border:none;color:var(--primary, #22c55e);font-size:12px;font-weight:700;cursor:pointer;padding:0;">View Reviews →</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT: details -->
                <div class="detail-web-right">
                    <div class="detail-web-top-row">
                        <h1 class="detail-web-title">${d.foodName}</h1>
                        <div class="detail-web-countdown">
                            <i class="far fa-clock"></i>
                            <span id="detail-countdown">${_getTimeLeft(d.expiryTimeMillis)}</span>
                        </div>
                    </div>

                    <div class="detail-meta-chips">
                        <span class="cat-chip-detail">${d.category}</span>
                        ${dietary}
                    </div>

                    <div class="detail-info-grid">
                        <div class="detail-info-cell">
                            <i class="fas fa-balance-scale"></i>
                            <div>
                                <div class="info-cell-label">Quantity</div>
                                <div class="info-cell-value">${d.quantity}</div>
                            </div>
                        </div>
                        <div class="detail-info-cell">
                            <i class="fas fa-map-marker-alt"></i>
                            <div>
                                <div class="info-cell-label">Pickup Location</div>
                                <div class="info-cell-value">${d.location}</div>
                            </div>
                        </div>
                        <div class="detail-info-cell">
                            <i class="fas fa-clock"></i>
                            <div>
                                <div class="info-cell-label">Pickup window</div>
                                <div class="info-cell-value">Now · Nearby</div>
                            </div>
                        </div>
                    </div>

                    <div class="detail-web-section">
                        <h3>About this listing</h3>
                        <p>${d.description || 'No description provided.'}</p>
                    </div>

                    <div class="detail-web-actions">
                        ${_getDetailButtons(d)}
                    </div>
                </div>
            </div>
        `;

        // Hamburger click listener
        const btnMenu = detailScreen.querySelector('#btn-hamburger-menu');
        if (btnMenu) {
            btnMenu.onclick = () => {
                const donorUid = d.userUid;
                const donorDisplay = d.isAnonymous ? "Anonymous" : (d.userName || "User");
                const chatId = myUid < donorUid ? `${myUid}_${donorUid}` : `${donorUid}_${myUid}`;
                if (window.showHamburgerMenu) {
                    window.showHamburgerMenu(d, myUid, myName, donorUid, donorDisplay, chatId);
                }
            };
        }

        // View Reviews click listener
        const btnReviews = detailScreen.querySelector('#btn-view-reviews');
        if (btnReviews) {
            btnReviews.onclick = () => {
                if (window.showReviewsScreen) {
                    window.showReviewsScreen(d.userUid, d.userName);
                }
            };
        }

        // Load live donor stats (average rating + donation count)
        if (d.userUid) {
            get(ref(rtdb, `user_stats/${d.userUid}`)).then(statsSnap => {
                if (statsSnap.exists()) {
                    const data = statsSnap.val();
                    const avg = data.avgRating || 0;
                    const count = data.totalRatings || 0;
                    const donations = data.donations || 0;

                    const ratingEl = document.getElementById('donor-detail-rating');
                    const donEl = document.getElementById('donor-detail-donations');

                    if (ratingEl) {
                        ratingEl.textContent = count > 0 ? `★ ${avg}` : '★ New';
                    }
                    if (donEl) {
                        donEl.textContent = donations > 0 ? `${donations} donation${donations !== 1 ? 's' : ''}` : 'Neighborhood Hero';
                    }
                }
            }).catch(() => {});
        }

        // Live countdown ticker
        if (window.detailTimer) clearInterval(window.detailTimer);
        window.detailTimer = setInterval(() => {
            const el = document.getElementById('detail-countdown');
            if (el) el.textContent = _getTimeLeft(d.expiryTimeMillis);
            else clearInterval(window.detailTimer);
        }, 1000);

    });
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
                <button class="btn-web-msg" onclick="window.triggerMessageCurrentDonor()">
                    <i class="fas fa-comment"></i> MESSAGE DONOR
                </button>
            `;
        } else {
            return `<button class="btn-web-claim" disabled style="background:#BDC1C6;">SOMEONE ELSE CLAIMED THIS</button>`;
        }
    }
    return `<button class="btn-web-claim" onclick="window.triggerClaimCurrentFood()">CLAIM FOOD</button>`;
}

window.triggerClaimCurrentFood = () => {
    const item = window.currentDetailItem;
    if (item) window.claimFood(item.id, item.foodName, item.userUid, item.userName);
};

window.triggerMessageCurrentDonor = () => {
    const item = window.currentDetailItem;
    if (item) window.messageDonor(item.id, item.userUid, item.userName, item.foodName);
};

window.claimFood = async (id, name, donorId, donorName) => {
    const user = auth.currentUser;
    if (!user) return alert("Please login to claim.");

    const itemRef = ref(rtdb, `food_items/${id}`);

    // ✅ STEP 1: Fresh server GET — never trust cache
    let freshData;
    try {
        const snap = await get(itemRef);
        freshData = snap.val();
    } catch (e) {
        return alert("Network error. Please try again.");
    }

    if (!freshData) return alert("Food item not found.");

    // ✅ Block same-user re-claim
    if (freshData.claimedByUid === user.uid) {
        return alert("You already claimed this food!");
    }

    // ✅ Block if already claimed by anyone else
    if (freshData.isClaimed) {
        return alert("This food has already been claimed by someone else.");
    }

    // ✅ STEP 2: Fetch current profile name from RTDB (not stale auth.displayName)
    let myName;
    try {
        const profileSnap = await get(ref(rtdb, `users/${user.uid}`));
        myName = profileSnap.val()?.name || user.displayName || user.email?.split('@')[0] || 'User';
    } catch {
        myName = user.displayName || user.email?.split('@')[0] || 'User';
    }

    // ✅ STEP 3: Atomic transaction on server
    const otp = Math.floor(1000 + Math.random() * 9000); // 4-digit OTP like Android

    try {
        await runTransaction(itemRef, (currentData) => {
            if (currentData === null) return currentData; // retry
            if (currentData.isClaimed) return currentData; // abort — already claimed
            if (currentData.claimedByUid === user.uid) return currentData; // abort — same user
            return {
                ...currentData,
                isClaimed: true,
                claimedByUid: user.uid,
                claimOtp: otp,
                claimedAt: Date.now()
            };
        });

        // Re-check after transaction
        const afterSnap = await get(itemRef);
        const afterData = afterSnap.val();

        if (!afterData || afterData.claimedByUid !== user.uid) {
            return alert("Claim failed — someone else claimed it first!");
        }

        // ✅ chatId = smaller_uid + "_" + larger_uid — matches Android exactly
        const chatId = user.uid < donorId
            ? `${user.uid}_${donorId}`
            : `${donorId}_${user.uid}`;

        const now = Date.now();

        // ✅ Fix: OTP format matches Android exactly
        const timeStr = new Date(now).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const sysText = `[ShareBite System] ✅ Claim Confirmed\nFood: ${name}\nClaimed by: ${myName}\nClaim OTP: ${otp}\nTime: ${timeStr}`;

        // Push system message
        const msgRef = push(ref(rtdb, `chats/${chatId}`));
        await set(msgRef, {
            messageId: msgRef.key,
            senderId: 'SYSTEM', // ✅ uppercase matches Android
            senderName: 'ShareBite',
            message: sysText,
            timestamp: now,
            isSystem: true
        });

        // ✅ Fix: write chat previews with correct donorId from fresh server data
        const myChatRef = ref(rtdb, `user_chats/${user.uid}/${chatId}`);
        const donorChatRef = ref(rtdb, `user_chats/${donorId}/${chatId}`);

        const baseMeta = { chatId, foodName: name, lastMessage: '✅ Claim confirmed', timestamp: now };
        await set(myChatRef, { ...baseMeta, otherUserId: donorId, otherUserName: donorName || 'Donor', unreadCount: 0 });
        await set(donorChatRef, { ...baseMeta, otherUserId: user.uid, otherUserName: myName, unreadCount: 1 });

        // Increment permanent claims counter
        const statsRef = ref(rtdb, `user_stats/${user.uid}`);
        const statsSnap = await get(statsRef);
        const currentClaims = statsSnap.val()?.claims || 0;
        const currentDonations = statsSnap.val()?.donations || 0;
        await set(statsRef, { userName: myName, donations: currentDonations, claims: currentClaims + 1 });

        alert(`Food Claimed! 🎉 Your OTP: ${otp}\nShow this to the donor when you collect.`);

        // Navigate to messages
        window.activeClaimChat = { chatId, otherUserId: donorId, otherUserName: donorName || 'Donor', foodName: name };
        document.querySelector('[data-screen="message"]')?.click();

    } catch (err) {
        console.error("Claim error:", err);
        alert("Failed to claim: " + err.message);
    }
};

window.messageDonor = async (foodId, donorId, donorName, foodName) => {
    const user = auth.currentUser;
    if (!user) return alert("Please login first!");

    const chatId = user.uid < donorId
        ? `${user.uid}_${donorId}`
        : `${donorId}_${user.uid}`;

    let realDonorName = donorName;
    try {
        const donorSnap = await get(ref(rtdb, `users/${donorId}`));
        if (donorSnap.val()?.name) realDonorName = donorSnap.val().name;
    } catch (e) {}

    window.activeClaimChat = { chatId, otherUserId: donorId, otherUserName: realDonorName || 'Donor', foodName: foodName || 'Food', isAutoOpen: true };
    document.querySelector('[data-screen="message"]')?.click();
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
