import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";

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

function openFoodDetail(item) {
    const screen = document.getElementById('food-detail-screen');
    const timeLeft = (item.expiryTimeMillis || 0) - Date.now();
    const hrs = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const timeText = timeLeft > 0 ? `${hrs}h ${mins}m left` : 'Expired';

    screen.innerHTML = `
        <div class="detail-header-android">
            <button onclick="window.navigateTo('home')" class="btn-back"><i class="fas fa-arrow-left"></i></button>
            <h1>Details</h1>
        </div>
        <div class="detail-content-android">
            <div class="detail-image-box">
                ${item.imageUri ? `<img src="${item.imageUri}">` : `<div class="img-placeholder-lg">🍲</div>`}
                <div class="detail-category-badge">${item.category}</div>
            </div>
            <div class="detail-info-box">
                <h2 class="detail-title">${item.foodName}</h2>
                <div class="detail-meta-row">
                    <span><i class="fas fa-box"></i> ${item.quantity}</span>
                    <span style="color:var(--error); font-weight:800;"><i class="fas fa-clock"></i> ${timeText}</span>
                </div>
                <p class="detail-location"><i class="fas fa-map-marker-alt"></i> ${item.location || 'Coimbatore, TN'}</p>
                <div class="detail-description-section">
                    <h3>Description</h3>
                    <p>${item.description || 'No description provided.'}</p>
                </div>
                <div class="detail-action-row">
                    <button id="btn-claim-final" class="btn btn-claim-main">CLAIM FOOD</button>
                    <button onclick="window.navigateTo('message')" class="btn btn-msg-icon"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        </div>
    `;

    // Reset visibility logic
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');

    const claimBtn = screen.querySelector('#btn-claim-final');
    if (item.isClaimed) {
        claimBtn.disabled = true;
        claimBtn.classList.add('btn-disabled');
        claimBtn.textContent = 'CLAIMED';
    } else {
        claimBtn.onclick = () => {
            alert('🎉 Request sent! Contact donor via Message.');
            window.navigateTo('home');
        };
    }
}
