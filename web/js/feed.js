import {
    collection, onSnapshot, query, orderBy, doc,
    runTransaction, serverTimestamp, addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref as rtdbRef, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db, rtdb, auth } from "./firebase-config.js";

let allItems = [];
let activeFilter = 'all';
let searchQuery = '';
let feedUnsub = null;
let detailTimer = null;
let detailUnsub = null;

export function initFeed() {
    const feedGrid = document.getElementById('feed-grid');
    const searchInput = document.getElementById('search-input');
    const filterChips = document.getElementById('filter-chips');

    // Subscribe to Firestore food_items with real-time onSnapshot
    const q = query(collection(db, 'food_items'), orderBy('createdAt', 'desc'));
    feedUnsub = onSnapshot(q, snapshot => {
        const now = Date.now();
        allItems = [];
        snapshot.forEach(d => {
            const item = { id: d.id, ...d.data() };
            // Skip expired items
            if (item.expiryTimeMillis && now > item.expiryTimeMillis) return;
            allItems.push(item);
        });
        renderFeed();
    }, err => console.error('Feed snapshot error:', err));

    searchInput?.addEventListener('input', e => { searchQuery = e.target.value; renderFeed(); });
    filterChips?.addEventListener('click', e => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.getAttribute('data-cat');
        renderFeed();
    });

    function renderFeed() {
        let filtered = allItems;
        if (activeFilter !== 'all') filtered = filtered.filter(i => i.category === activeFilter);
        if (searchQuery) {
            const q2 = searchQuery.toLowerCase();
            filtered = filtered.filter(i => (i.foodName + ' ' + (i.description || '')).toLowerCase().includes(q2));
        }

        // Update listing count
        const countEl = document.getElementById('listing-count');
        if (countEl) countEl.textContent = `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`;

        feedGrid.innerHTML = '';
        if (!filtered.length) {
            feedGrid.innerHTML = `<div class="empty-state"><i class="fas fa-leaf" style="font-size:48px;color:var(--primary);opacity:0.4;margin-bottom:16px;"></i><p>No food listings near you right now.</p></div>`;
            return;
        }
        filtered.forEach(item => feedGrid.appendChild(createFoodCard(item)));
    }
}

function createFoodCard(item) {
    const div = document.createElement('div');
    div.className = 'food-card';

    const timeLeft = (item.expiryTimeMillis || 0) - Date.now();
    const hrs = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const timeText = timeLeft > 0
        ? hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`
        : 'Expired';

    const isFresh = item.createdAt && (Date.now() - (item.createdAt.toMillis?.() || item.createdAt)) < 7200000;
    const donorName = item.isAnonymous ? 'Anonymous' : (item.userName || 'User');
    const initial = donorName.charAt(0).toUpperCase();

    div.innerHTML = `
        <div class="card-image-wrap">
            ${item.imageUri ? `<img src="${item.imageUri}" alt="${item.foodName}">` : `<div class="img-placeholder">🍱</div>`}
            ${isFresh ? `<div class="fresh-tag">Fresh!</div>` : ''}
            <div class="card-cat-badge">${item.category || 'Cooked Meal'}</div>
            ${item.isClaimed ? `<div class="claimed-banner"><span>Claimed ✓</span></div>` : ''}
        </div>
        <div class="card-body">
            <h3 class="card-title">${item.foodName}</h3>
            <p class="card-text-secondary">${item.quantity || '1 portion'}</p>
            <p class="card-time-left ${timeLeft < 600000 ? 'urgent' : ''}">${timeText}</p>
            <p class="card-text-secondary" style="font-size:12px;">${item.description || ''}</p>
            <div class="card-footer">
                <div class="user-pill">
                    <div class="avatar-small">${initial}</div>
                    <span>${donorName}</span>
                </div>
                <div class="star-rating"><i class="fas fa-star" style="color:#FFC107"></i> 5.0</div>
            </div>
        </div>
    `;

    div.onclick = () => openFoodDetail(item.id);
    return div;
}

export function openFoodDetail(itemId) {
    // Unsubscribe from previous detail listener
    if (detailUnsub) { detailUnsub(); detailUnsub = null; }
    if (detailTimer) { clearInterval(detailTimer); detailTimer = null; }

    const screen = document.getElementById('food-detail-screen');
    screen.innerHTML = `<div style="padding:60px;text-align:center;"><i class="fas fa-spinner fa-spin" style="font-size:32px;color:var(--primary);"></i></div>`;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');

    // Real-time listener on this specific food doc
    detailUnsub = onSnapshot(doc(db, 'food_items', itemId), docSnap => {
        if (!docSnap.exists()) {
            screen.innerHTML = `<p style="padding:40px;">Food item not found.</p>`;
            return;
        }
        const item = { id: docSnap.id, ...docSnap.data() };
        _renderDetail(item, screen);
    }, err => console.error('Detail snapshot error:', err));
}
window.openFoodDetail = openFoodDetail;

function _renderDetail(item, screen) {
    if (detailTimer) clearInterval(detailTimer);

    const donorName = item.isAnonymous ? 'Anonymous' : (item.userName || 'User');
    const donorInitial = donorName.charAt(0).toUpperCase();
    const tags = item.dietaryTags || [];
    const tagsHtml = tags.length ? tags.map(t => `<span class="diet-chip">${t}</span>`).join('') : '';
    const currentUser = auth.currentUser;
    const donorUid = item.userUid;

    // Determine button state
    let claimBtnHtml = '';
    let msgBtnHtml = '';
    const isMyFood = currentUser && donorUid === currentUser.uid;
    const alreadyClaimedByMe = currentUser && item.claimedByUid === currentUser.uid;
    const claimedBySomeoneElse = item.isClaimed && !alreadyClaimedByMe;

    if (!isMyFood) {
        if (item.isClaimed) {
            if (alreadyClaimedByMe) {
                claimBtnHtml = `<button class="btn-web-claim" disabled style="opacity:0.6;cursor:default;">Already claimed by you ✓</button>`;
                msgBtnHtml = `<button class="btn-web-msg" id="btn-msg-donor"><i class="fas fa-comment-alt"></i> MESSAGE DONOR</button>`;
            } else {
                claimBtnHtml = `<button class="btn-web-claim" disabled style="opacity:0.5;cursor:default;background:#aaa;">Already Claimed</button>`;
            }
        } else {
            claimBtnHtml = `<button class="btn-web-claim" id="btn-claim-final">CLAIM FOOD</button>`;
            msgBtnHtml = `<button class="btn-web-msg" id="btn-msg-donor"><i class="fas fa-comment-alt"></i> MESSAGE DONOR</button>`;
        }
    }

    screen.innerHTML = `
        <div class="detail-android-layout">
            <div class="detail-image-box">
                ${item.imageUri
            ? `<img src="${item.imageUri}" alt="${item.foodName}" style="width:100%;height:100%;object-fit:cover;">`
            : `<div class="img-placeholder-lg">🍲</div>`}
                <button onclick="window.navigateTo('home')" class="btn-back-detail">
                    <i class="fas fa-arrow-left"></i>
                </button>
            </div>
            <div class="detail-content-scroll">
                <div class="detail-title-row">
                    <h2 class="detail-food-name">${item.foodName}</h2>
                    <div class="countdown-box">
                        <i class="fas fa-clock"></i>
                        <span id="detail-timer-val">--:--:--</span>
                    </div>
                </div>

                <div style="margin-bottom:16px;">
                    <span class="cat-chip-detail">${item.category || 'Cooked Meal'}</span>
                </div>

                <div class="detail-info-rows">
                    <div class="info-row">
                        <i class="fas fa-utensils"></i>
                        <span><strong>Quantity:</strong> ${item.quantity || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-map-marker-alt"></i>
                        <span><strong>Location:</strong> ${item.location || 'Not specified'}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-clock"></i>
                        <span><strong>Pickup:</strong> Available now</span>
                    </div>
                </div>

                ${tagsHtml ? `<div class="dietary-chips-row">${tagsHtml}</div>` : ''}

                <div class="about-section">
                    <h3>About this listing</h3>
                    <p>${item.description || 'Freshly prepared and ready for pickup.'}</p>
                </div>

                <div class="about-section">
                    <h3>Donor</h3>
                    <div class="donor-card">
                        <div class="donor-avatar">${donorInitial}</div>
                        <div>
                            <strong>${donorName}</strong>
                            <p style="font-size:13px;color:var(--text-hint);margin:2px 0 0;">⭐ Community contributor</p>
                        </div>
                    </div>
                </div>

                <div class="detail-actions">
                    ${claimBtnHtml}
                    ${msgBtnHtml}
                </div>
            </div>
        </div>
    `;

    // Live countdown
    function updateTimer() {
        const timeLeft = (item.expiryTimeMillis || 0) - Date.now();
        const el = document.getElementById('detail-timer-val');
        if (!el) return;
        if (timeLeft <= 0) { el.textContent = 'EXPIRED'; el.style.color = '#ff4444'; return; }
        const h = Math.floor(timeLeft / 3600000);
        const m = Math.floor((timeLeft % 3600000) / 60000);
        const s = Math.floor((timeLeft % 60000) / 1000);
        el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    updateTimer();
    detailTimer = setInterval(updateTimer, 1000);

    // CLAIM BUTTON
    document.getElementById('btn-claim-final')?.addEventListener('click', () => _claimFood(item));

    // MESSAGE DONOR BUTTON
    document.getElementById('btn-msg-donor')?.addEventListener('click', () => {
        if (!auth.currentUser) return window.navigateTo('profile');
        const chatId = auth.currentUser.uid < donorUid
            ? `${auth.currentUser.uid}_${donorUid}`
            : `${donorUid}_${auth.currentUser.uid}`;
        window.activeClaimChat = {
            chatId,
            donorId: donorUid,
            donorName: donorName,
            foodName: item.foodName,
            isAutoOpen: true
        };
        window.navigateTo('message');
    });
}

async function _claimFood(item) {
    const currentUser = auth.currentUser;
    if (!currentUser) return window.navigateTo('profile');

    const ok = confirm(`Claim "${item.foodName}"? A system message will be sent to the donor with your OTP.`);
    if (!ok) return;

    const foodRef = doc(db, 'food_items', item.id);
    try {
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(foodRef);
            if (!snap.exists()) throw new Error('Food item no longer exists.');
            if (snap.data().isClaimed) throw new Error('This food was just claimed by someone else!');
            transaction.update(foodRef, {
                isClaimed: true,
                claimedByUid: currentUser.uid,
                claimedAt: serverTimestamp()
            });
        });
    } catch (err) {
        alert('❌ ' + err.message);
        return;
    }

    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000);
    const claimerName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    const donorUid = item.userUid;
    const chatId = currentUser.uid < donorUid
        ? `${currentUser.uid}_${donorUid}`
        : `${donorUid}_${currentUser.uid}`;

    const now = Date.now();
    const timeStr = new Date(now).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const systemMsg = `[ShareBite System] ✅ Claim Confirmed\nFood: ${item.foodName}\nClaimed by: ${claimerName}\nClaim OTP: ${otp}\nTime: ${timeStr}`;

    // Send system message to RTDB chats
    try {
        const msgRef = push(rtdbRef(rtdb, `chats/${chatId}`));
        await set(msgRef, {
            messageId: msgRef.key,
            senderId: 'system',
            senderName: 'ShareBite System',
            message: systemMsg,
            timestamp: now,
            isSystem: true
        });

        // Update user_chats previews in Firestore
        const { setDoc: fsSetDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const donorName2 = item.isAnonymous ? 'Anonymous' : (item.userName || 'Donor');
        await fsSetDoc(fsDoc(db, 'user_chats', donorUid, 'chats', chatId), {
            chatId,
            otherUserId: currentUser.uid,
            otherUserName: claimerName,
            foodName: item.foodName,
            lastMessage: systemMsg,
            timestamp: now,
            unreadCount: 1,
            lastReadTimestamp: 0
        }, { merge: true });
        await fsSetDoc(fsDoc(db, 'user_chats', currentUser.uid, 'chats', chatId), {
            chatId,
            otherUserId: donorUid,
            otherUserName: donorName2,
            foodName: item.foodName,
            lastMessage: systemMsg,
            timestamp: now,
            unreadCount: 0,
            lastReadTimestamp: now
        }, { merge: true });
    } catch (err) {
        console.error('Error sending claim system message:', err);
    }

    alert(`🎉 Food claimed! Your OTP is: ${otp}\nShow this to the donor to verify your claim.`);
    window.navigateTo('home');
}
