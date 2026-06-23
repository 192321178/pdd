import { ref, onValue, update, set, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initFeed() {
    const feedGrid = document.getElementById('feed-grid');
    const searchInput = document.getElementById('search-input');
    const filterChips = document.getElementById('filter-chips');

    let allItems = [];
    let activeFilter = 'all';
    let searchQuery = '';

    onValue(ref(rtdb, 'food_items'), (snapshot) => {
        allItems = [];
        const now = Date.now();
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const item = { id: child.key, ...child.val() };
                if (item.expiryTimeMillis && now > item.expiryTimeMillis) return;
                allItems.push(item);
            });
            allItems.sort((a, b) => (b.sharedAt || 0) - (a.sharedAt || 0));
        }
        renderFeed();
    });

    function renderFeed() {
        let filtered = allItems;
        if (activeFilter !== 'all') filtered = filtered.filter(i => i.category === activeFilter);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(i => (i.foodName + i.description).toLowerCase().includes(q));
        }

        feedGrid.innerHTML = '';
        if (!filtered.length) {
            feedGrid.innerHTML = `<div class="empty-state">No listings found near you.</div>`;
            return;
        }

        filtered.forEach(item => {
            const card = createFoodCard(item);
            feedGrid.appendChild(card);
        });
    }

    searchInput?.addEventListener('input', e => { searchQuery = e.target.value; renderFeed(); });
    filterChips?.addEventListener('click', e => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.getAttribute('data-cat');
        renderFeed();
    });
}

function createFoodCard(item) {
    const div = document.createElement('div');
    div.className = 'food-card';

    const timeLeft = (item.expiryTimeMillis || 0) - Date.now();
    const hrs = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const timeText = timeLeft > 0 ? `${hrs}h ${mins}m left` : 'Expired';

    // Parity: Determine "Fresh!" status (e.g. shared in last 2 hours)
    const isFresh = (Date.now() - (item.sharedAt || 0)) < 7200000;

    div.innerHTML = `
        <div class="card-image-wrap">
            ${item.imageUri ? `<img src="${item.imageUri}">` : `<div class="img-placeholder">🍱</div>`}
            ${isFresh ? `<div class="fresh-tag">Fresh!</div>` : ''}
            <div style="position:absolute; bottom:12px; left:12px; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">
                ${item.category || 'Cooked Meal'}
            </div>
        </div>
        <div class="card-body">
            <div class="card-row-top">
                <span style="color:var(--text-hint); font-size:11px;">← SKIP</span>
                <span style="color:var(--primary); font-size:11px;">CLAIM →</span>
            </div>
            <h3 class="card-title">${item.foodName}</h3>
            <p class="card-text-secondary">${item.quantity || '1 portion'}</p>
            <p style="color:var(--error); font-size:12px; font-weight:700; margin-bottom:4px;">${timeText}</p>
            <p class="card-text-secondary" style="font-size:12px;">${item.description || 'Tasty'}</p>
            <div class="card-footer">
                <div class="user-pill">
                    <div class="avatar-small">${item.userName?.charAt(0).toUpperCase() || 'U'}</div>
                    <span>${item.userName || 'Anonymous'}</span>
                </div>
                <div style="font-weight:900; font-size:13px;"><i class="fas fa-star" style="color:#FFC107"></i> 5.0</div>
            </div>
        </div>
    `;

    div.onclick = () => openFoodDetail(item);
    return div;
}

let detailTimer = null;

export function openFoodDetail(item) {
    const screen = document.getElementById('food-detail-screen');

    function updateTimer() {
        const timeLeft = (item.expiryTimeMillis || 0) - Date.now();
        const timeEl = document.getElementById('detail-timer-val');
        if (!timeEl) return;

        if (timeLeft <= 0) {
            timeEl.textContent = "EXPIRED";
            timeEl.style.color = "#ff4444";
            return;
        }

        const hrs = Math.floor(timeLeft / 3600000);
        const mins = Math.floor((timeLeft % 3600000) / 60000);
        const secs = Math.floor((timeLeft % 60000) / 1000);
        timeEl.textContent = `${hrs.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
    }

    if (detailTimer) clearInterval(detailTimer);
    detailTimer = setInterval(updateTimer, 1000);

    const donorInitial = (item.donorName || 'U').charAt(0).toUpperCase();
    const tags = item.dietaryTags || ['halal'];
    const tagsHtml = tags.map(t => `<span>${t}</span>`).join('');

    screen.innerHTML = `
        <div class="detail-web-layout">
            <div class="detail-web-image">
                ${item.imageUri ? `<img src="${item.imageUri}" alt="${item.foodName}">` : `<div class="img-placeholder-lg">🍲</div>`}
            </div>
            <div class="detail-web-info">
                <button onclick="window.navigateTo('home')" class="btn-back-web"><i class="fas fa-arrow-left"></i> Back to Feed</button>

                <h2>${item.foodName}</h2>
                <div class="detail-meta">
                    <span class="cat-chip active">${item.category}</span>
                    <div class="countdown-box">
                        <i class="fas fa-clock"></i>
                        <span id="detail-timer-val">00 : 00 : 00</span>
                    </div>
                </div>

                <div class="info-cards-row">
                    <div class="info-card-web">
                        <i class="fas fa-egg"></i>
                        <span class="label">Quantity</span>
                        <span class="value">${item.quantity}</span>
                    </div>
                    <div class="info-card-web">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="label">Location</span>
                        <span class="value">${item.location || 'Poonamallee'}</span>
                    </div>
                    <div class="info-card-web">
                        <i class="fas fa-truck"></i>
                        <span class="label">Pickup</span>
                        <span class="value">Now</span>
                    </div>
                </div>

                <div class="dietary-chips">${tagsHtml}</div>

                <div class="about-section">
                    <h3>About this listing</h3>
                    <p>${item.description || 'Freshly prepared and ready for pickup.'}</p>
                </div>

                <div class="about-section">
                    <h3>Donor</h3>
                    <div class="donor-card-web">
                        <div class="donor-avatar-web">${donorInitial}</div>
                        <div>
                            <strong>${item.donorName || 'User'}</strong>
                            <p style="font-size:13px; color:var(--text-hint);">⭐ Community contributor</p>
                        </div>
                    </div>
                </div>

                <div class="detail-web-actions">
                    <button id="btn-claim-final" class="btn-web-claim">CLAIM FOOD</button>
                    <button id="btn-msg-donor" class="btn-web-msg"><i class="far fa-comment-alt"></i> MESSAGE DONOR</button>
                </div>
            </div>
        </div>
    `;

    // Initialize timer immediately
    updateTimer();

    // Show screen
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');

    const donorUid = item.userUid || item.userUID;
    const msgBtn = document.getElementById('btn-msg-donor');
    const claimBtnFinal = document.getElementById('btn-claim-final');

    // Check if food belongs to current user
    if (currentUser && donorUid === currentUser.uid) {
        if (claimBtnFinal) {
            claimBtnFinal.disabled = true;
            claimBtnFinal.style.opacity = '0.5';
            claimBtnFinal.textContent = "YOUR DONATION";
        }
        if (msgBtn) msgBtn.style.display = 'none'; // Cannot message self
    } else if (item.isClaimed) {
        if (claimBtnFinal) {
            claimBtnFinal.disabled = true;
            claimBtnFinal.style.opacity = '0.5';
            claimBtnFinal.textContent = 'ALREADY CLAIMED';
        }

        // 🚀 ONLY the person who claimed it can message the donor
        const claimerUid = item.claimedByUid || item.claimedBy;
        if (currentUser && currentUser.uid === claimerUid) {
            if (msgBtn) msgBtn.style.display = 'inline-flex';
        } else {
            if (msgBtn) msgBtn.style.display = 'none';
        }
    } else {
        if (claimBtnFinal) {
            claimBtnFinal.onclick = async () => {
                if (!currentUser) return window.navigateTo('profile');

                const confirmClaim = confirm(`Claim ${item.foodName}? A message will be sent to the donor.`);
                if (!confirmClaim) return;

                try {
                    // 1. Mark as claimed in RTDB (using 'id' for parity)
                    const foodRef = ref(rtdb, `food_items/${item.id}`);
                    await update(foodRef, {
                        isClaimed: true,
                        claimedBy: currentUser.uid,
                        claimedByUid: currentUser.uid,
                        claimedAt: Date.now()
                    });

                    // 🚀 STATS are dynamic now, no manual increment needed for claims!
                    // Calculated in profile.js by counting items where claimedByUid === user.uid

                    // 2. Send auto-message to donor
                    if (donorUid) {
                        const chatId = currentUser.uid < donorUid ? `${currentUser.uid}_${donorUid}` : `${donorUid}_${currentUser.uid}`;
                        const msgRef = push(ref(rtdb, `messages/${chatId}`));

                        const claimMsg = `Hi, I claimed your food - ${item.foodName} -. Thank you!`;

                        await set(msgRef, {
                            senderId: currentUser.uid,
                            text: claimMsg,
                            timestamp: Date.now(),
                            foodName: item.foodName
                        });

                        // 🚀 Alignment with com.sharebite.fragments.ChatPreview
                        const metaForDonor = {
                            chatId: chatId,
                            otherUserId: currentUser.uid,
                            otherUserName: currentUser.displayName || 'Receiver',
                            lastMessage: claimMsg,
                            timestamp: Date.now(),
                            foodName: item.foodName
                        };
                        const metaForMe = {
                            chatId: chatId,
                            otherUserId: donorUid,
                            otherUserName: item.userName || 'Donor',
                            lastMessage: claimMsg,
                            timestamp: Date.now(),
                            foodName: item.foodName
                        };

                        await update(ref(rtdb, `user_chats/${donorUid}`), { [currentUser.uid]: metaForDonor });
                        await update(ref(rtdb, `user_chats/${currentUser.uid}`), { [donorUid]: metaForMe });
                    }

                } catch (err) {
                    console.error(err);
                    alert('Error claiming food.');
                }

                alert('🎉 Food claimed successfully!');
                window.navigateTo('home');
            };
        }
    }

    if (msgBtn) {
        msgBtn.addEventListener('click', () => {
            if (!auth.currentUser) return window.navigateTo('profile');
            window.navigateTo('message');
        });
    }
}
