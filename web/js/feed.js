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
                // Parity: Ignore expired items
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
            feedGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:80px;">
                    <i class="fa fa-plate-wheat" style="font-size:64px; color:var(--text-hint); margin-bottom:20px;"></i>
                    <h2 style="color:var(--text-primary)">No Live Food Found</h2>
                    <p style="color:var(--text-secondary)">Try a different category or wait for a community share.</p>
                </div>`;
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

    div.innerHTML = `
        <div class="card-img-wrap">
            ${item.imageUri ? `<img src="${item.imageUri}">` : `<div style="height:100%; display:flex; align-items:center; justify-content:center; font-size:40px;">🍲</div>`}
            <div style="position:absolute; top:12px; right:12px; background:rgba(255,82,82,0.9); color:#fff; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700;">
                LIVE · ${timeText}
            </div>
            ${item.isClaimed ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; letter-spacing:3px;">CLAIMED</div>` : ''}
        </div>
        <div class="card-body">
            <h3 class="card-title">${item.foodName}</h3>
            <p class="card-meta">${item.quantity} · ${item.category}</p>
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:28px; height:28px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">${item.userName?.charAt(0).toUpperCase() || 'S'}</div>
                <span style="font-size:14px; color:var(--text-secondary)">By <b>${item.userName}</b></span>
            </div>
        </div>
    `;

    div.onclick = () => openDetail(item);
    return div;
}

function openDetail(item) {
    const overlay = document.getElementById('food-detail');
    const content = document.getElementById('detail-content');

    content.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
            <div style="height:400px; background:var(--surface);">
                ${item.imageUri ? `<img src="${item.imageUri}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="height:100%; display:flex; align-items:center; justify-content:center; font-size:80px;">🍱</div>`}
            </div>
            <div style="padding:40px;">
                <span style="padding:4px 12px; background:rgba(0,200,83,0.1); color:var(--primary); border-radius:30px; font-size:12px; font-weight:700;">${item.category}</span>
                <h1 style="font-size:36px; margin:12px 0;">${item.foodName}</h1>
                <p style="color:var(--text-secondary); margin-bottom:24px;">📍 ${item.location || 'Chennai'}</p>
                
                <div class="profile-stats-grid" style="margin-bottom:32px;">
                    <div class="stat-card" style="padding:16px; text-align:center;">
                        <div style="font-size:12px; color:var(--text-secondary)">Quantity</div>
                        <div style="font-weight:700; font-size:18px;">${item.quantity}</div>
                    </div>
                    <div class="stat-card" style="padding:16px; text-align:center;">
                        <div style="font-size:12px; color:var(--text-secondary)">Availability</div>
                        <div style="font-weight:700; font-size:18px; color:var(--error)">Live Listing</div>
                    </div>
                </div>

                <p style="font-size:12px; font-weight:900; color:var(--primary); margin-bottom:12px; letter-spacing:1px;">DESCRIPTION</p>
                <p style="line-height:1.7; color:var(--text-secondary); margin-bottom:40px;">${item.description || 'No description provided by donor.'}</p>

                <div style="display:flex; gap:16px;">
                    <button id="btn-claim-web" class="btn-primary" style="flex:2;">CLAIM THIS FOOD</button>
                    <button onclick="window.navigateTo('messages')" style="flex:1; background:var(--surface); border:none; border-radius:16px; cursor:pointer;"><i class="fa fa-comment" style="font-size:20px;"></i></button>
                </div>
            </div>
        </div>
    `;

    overlay.classList.remove('hidden');

    const claimBtn = content.querySelector('#btn-claim-web');
    if (item.isClaimed) {
        claimBtn.disabled = true;
        claimBtn.textContent = 'ALREADY CLAIMED';
        claimBtn.style.background = '#ccc';
    } else {
        claimBtn.onclick = async () => {
            claimBtn.disabled = true;
            claimBtn.textContent = 'Processing...';
            // Simulating successful claim
            setTimeout(() => {
                window.showToast?.('🎉 Food Claimed! Contact the donor in Chat.', 'success');
                overlay.classList.add('hidden');
            }, 800);
        };
    }
}
