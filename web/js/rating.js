import { ref, get, set, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";

// ─── Hamburger Menu ─────────────────────────────────────────────────────────
export function showHamburgerMenu(item, myUid, myName, donorUid, donorDisplay, chatId) {
    const isMyListing = myUid === item.userUid;

    const options = [];
    if (isMyListing && item.isClaimed) {
        options.push({ text: "✅ Verify OTP", action: "verify_otp" });
    }
    options.push({ text: "⭐ Feedback & Reviews", action: "reviews" });
    options.push({ text: "📋 Food History", action: "history" });

    // Build modal dropdown or alert
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.className = 'modal-content-android';
    modal.style.maxWidth = '320dp';
    modal.style.width = '90%';
    modal.style.borderRadius = '16px';
    modal.style.padding = '20px';

    modal.innerHTML = `
        <h3 style="margin-top:0;margin-bottom:16px;font-size:18px;color:#1A1A1A;">Menu</h3>
        <div style="display:flex;flex-direction:column;gap:8px;">
            ${options.map((opt, idx) => `
                <button class="btn-menu-option" data-idx="${idx}" style="width:100%;text-align:left;padding:12px 16px;background:#F8F9FA;border:1px solid #E0E0E0;border-radius:10px;font-size:15px;font-weight:600;color:#333;cursor:pointer;">
                    ${opt.text}
                </button>
            `).join('')}
        </div>
        <div style="text-align:right;margin-top:16px;">
            <button class="btn-cancel-menu" style="background:none;border:none;color:#666;font-weight:700;cursor:pointer;padding:8px 12px;">CANCEL</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.querySelector('.btn-cancel-menu').onclick = () => overlay.remove();

    modal.querySelectorAll('.btn-menu-option').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx);
            const selected = options[idx];
            overlay.remove();

            if (selected.action === "verify_otp") {
                showVerifyOtpModal(item, myUid, myName);
            } else if (selected.action === "reviews") {
                showReviewsScreen(item.userUid, item.userName);
            } else if (selected.action === "history") {
                showFoodHistoryScreen();
            }
        };
    });
}
window.showHamburgerMenu = showHamburgerMenu;

// ─── Verify OTP Modal ────────────────────────────────────────────────────────
export function showVerifyOtpModal(item, myUid, myName) {
    if (myUid !== item.userUid) {
        return alert("Only the donor can verify OTP");
    }
    if (!item.isClaimed) {
        return alert("This food has not been claimed yet");
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.className = 'modal-content-android';
    modal.style.maxWidth = '360px';
    modal.style.width = '90%';
    modal.style.borderRadius = '16px';
    modal.style.padding = '24px';

    modal.innerHTML = `
        <h3 style="margin-top:0;margin-bottom:8px;font-size:18px;color:#1A1A1A;">🔐 Verify OTP</h3>
        <p style="font-size:13px;color:#666;margin-bottom:16px;">Ask the claimer to show their OTP and enter it below:</p>
        <div class="android-input-field" style="margin-bottom:16px;">
            <input type="number" id="otp-input-field" placeholder="Enter claimer's 4-digit OTP" style="width:100%;padding:12px;font-size:16px;border:1px solid #ccc;border-radius:8px;outline:none;" min="1000" max="9999">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button id="btn-otp-cancel" style="background:none;border:none;color:#666;font-weight:700;cursor:pointer;padding:8px 12px;">CANCEL</button>
            <button id="btn-otp-verify" style="background:var(--primary, #22c55e);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;padding:8px 16px;">VERIFY</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-otp-cancel').onclick = () => overlay.remove();

    overlay.querySelector('#btn-otp-verify').onclick = async () => {
        const inputField = overlay.querySelector('#otp-input-field');
        const enteredOtp = inputField.value.trim();
        const actualOtp = String(item.claimOtp || '');

        if (!enteredOtp || enteredOtp !== actualOtp) {
            return alert("❌ Invalid OTP. Please try again.");
        }

        // OTP matched — verification successful
        const now = Date.now();
        const timeStr = new Date(now).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const claimerUid = item.claimedByUid;
        const claimerName = item.claimerName || 'Claimer';
        const chatId = myUid < claimerUid ? `${myUid}_${claimerUid}` : `${claimerUid}_${myUid}`;

        try {
            // Mark as verified in Firebase
            await update(ref(rtdb, `food_items/${item.id}`), {
                isVerified: true,
                verifiedAt: now
            });

            // Save to food history — donor side
            await set(ref(rtdb, `food_history/${myUid}/donated/${item.id}`), {
                foodName: item.foodName || '',
                claimerName: claimerName,
                claimerUid: claimerUid,
                verifiedAt: now,
                location: item.location || '',
                category: item.category || ''
            });

            // Save to food history — claimer side
            await set(ref(rtdb, `food_history/${claimerUid}/claimed/${item.id}`), {
                foodName: item.foodName || '',
                donorName: myName,
                donorUid: myUid,
                receivedAt: now,
                location: item.location || '',
                category: item.category || ''
            });

            // Send success message into claimer's chat
            const successMsg = `${claimerName}, you successfully received '${item.foodName}' at ${timeStr} 🎉`;
            const chatsRef = ref(rtdb, `chats/${chatId}`);
            const msgRef = push(chatsRef);
            await set(msgRef, {
                messageId: msgRef.key,
                senderId: "SYSTEM",
                senderName: "ShareBite",
                message: successMsg,
                timestamp: now,
                isSystem: true
            });

            // Update chat preview
            update(ref(rtdb, `user_chats/${claimerUid}/${chatId}`), {
                lastMessage: successMsg,
                timestamp: now
            }).catch(() => {});
            update(ref(rtdb, `user_chats/${myUid}/${chatId}`), {
                lastMessage: successMsg,
                timestamp: now
            }).catch(() => {});

            // Set pending rating flag for claimer
            await update(ref(rtdb, `food_items/${item.id}`), {
                pendingRatingFor: claimerUid
            });

            overlay.remove();
            alert(`✅ Verified!\n${myName}, you successfully donated '${item.foodName}' to ${claimerName} at ${timeStr}`);

        } catch (err) {
            console.error("Verification error:", err);
            alert("Verification failed: " + err.message);
        }
    };
}
window.showVerifyOtpModal = showVerifyOtpModal;

// ─── Rating Dialog ───────────────────────────────────────────────────────────
export function showRatingModal(item, myUid, myName, donorUid) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.className = 'modal-content-android';
    modal.style.maxWidth = '380px';
    modal.style.width = '90%';
    modal.style.borderRadius = '16px';
    modal.style.padding = '24px';

    let currentRating = 5;

    modal.innerHTML = `
        <h3 style="margin-top:0;margin-bottom:8px;font-size:18px;color:#1A1A1A;">⭐ Rate This Food</h3>
        <p style="font-size:14px;color:#444;margin-bottom:16px;">Rate ${item.isAnonymous ? "this food" : (item.userName || "the donor") + "'s food"}</p>

        <!-- Star Rating Control -->
        <div id="star-rating-box" style="display:flex;gap:8px;font-size:28px;color:#FFB800;cursor:pointer;margin-bottom:16px;justify-content:center;">
            <span data-star="1">★</span>
            <span data-star="2">★</span>
            <span data-star="3">★</span>
            <span data-star="4">★</span>
            <span data-star="5">★</span>
        </div>

        <textarea id="rating-feedback-text" rows="3" placeholder="Write your feedback about this food..." style="width:100%;padding:10px;font-size:14px;border:1px solid #ccc;border-radius:8px;outline:none;margin-bottom:16px;box-sizing:border-box;"></textarea>

        <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button id="btn-rating-skip" style="background:none;border:none;color:#666;font-weight:700;cursor:pointer;padding:8px 12px;">SKIP</button>
            <button id="btn-rating-submit" style="background:var(--primary, #22c55e);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;padding:8px 16px;">SUBMIT</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const stars = modal.querySelectorAll('#star-rating-box span');
    const updateStars = (val) => {
        currentRating = val;
        stars.forEach((s, idx) => {
            s.textContent = (idx < val) ? '★' : '☆';
            s.style.color = (idx < val) ? '#FFB800' : '#CCC';
        });
    };

    stars.forEach(s => {
        s.onclick = () => updateStars(parseInt(s.dataset.star));
    });

    overlay.querySelector('#btn-rating-skip').onclick = async () => {
        overlay.remove();
        // Clear pending rating flag on skip
        update(ref(rtdb, `food_items/${item.id}`), { pendingRatingFor: "" }).catch(() => {});
    };

    overlay.querySelector('#btn-rating-submit').onclick = async () => {
        const feedback = overlay.querySelector('#rating-feedback-text').value.trim();
        const now = Date.now();

        try {
            // Save rating to Firebase
            await set(ref(rtdb, `ratings/${donorUid}/${item.id}`), {
                rating: currentRating,
                feedback: feedback,
                reviewerName: myName,
                reviewerUid: myUid,
                foodName: item.foodName || '',
                timestamp: now
            });

            // Recalculate donor's average rating
            const ratingsSnap = await get(ref(rtdb, `ratings/${donorUid}`));
            if (ratingsSnap.exists()) {
                let total = 0;
                let count = 0;
                ratingsSnap.forEach(child => {
                    const r = child.val()?.rating || 0;
                    total += r;
                    count++;
                });
                const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
                await update(ref(rtdb, `user_stats/${donorUid}`), {
                    avgRating: avg,
                    totalRatings: count
                });
            }

            // Save rating to claimer's food history entry
            update(ref(rtdb, `food_history/${myUid}/claimed/${item.id}`), {
                rating: currentRating,
                feedback: feedback
            }).catch(() => {});

            // Clear pending rating flag
            await update(ref(rtdb, `food_items/${item.id}`), { pendingRatingFor: "" });

            overlay.remove();
            alert("Thank you for your feedback! ⭐");

        } catch (err) {
            console.error("Rating error:", err);
            alert("Failed to submit rating: " + err.message);
        }
    };
}
window.showRatingModal = showRatingModal;

// ─── Show Feedback / Reviews Screen ──────────────────────────────────────────
export function showReviewsScreen(donorUid, donorName) {
    window.navigateTo('reviews');
    const container = document.getElementById('reviews-list-container');
    const tvSummary = document.getElementById('reviews-summary-text');
    const tvTitle = document.getElementById('reviews-title');

    if (tvTitle) tvTitle.textContent = `Reviews for ${donorName || 'User'}`;
    if (!container) return;

    container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">Loading reviews...</div>`;

    onValue(ref(rtdb, `ratings/${donorUid}`), snapshot => {
        container.innerHTML = '';
        if (!snapshot.exists()) {
            if (tvSummary) tvSummary.textContent = "No reviews yet";
            container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">No reviews yet for this donor.</div>`;
            return;
        }

        let total = 0;
        let count = 0;
        const reviews = [];

        snapshot.forEach(child => {
            const val = child.val();
            total += val.rating || 0;
            count++;
            reviews.push(val);
        });

        const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
        if (tvSummary) tvSummary.textContent = `★ ${avg} average · ${count} review${count !== 1 ? 's' : ''}`;

        reviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        reviews.forEach(review => {
            const rating = review.rating || 0;
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            const dateStr = review.timestamp ? new Date(review.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

            const card = document.createElement('div');
            card.className = 'history-card';
            card.style.background = '#FFFFFF';
            card.style.padding = '16px';
            card.style.borderRadius = '12px';
            card.style.border = '1px solid #E0E0E0';
            card.style.marginBottom = '12px';

            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-weight:700;color:#FFB800;font-size:15px;">${stars} <span style="color:#1A1A1A;margin-left:6px;">${review.reviewerName || 'User'}</span></span>
                    <span style="font-size:11px;color:#999;">${dateStr}</span>
                </div>
                ${review.foodName ? `<div style="font-size:12px;color:var(--primary, #22c55e);font-weight:600;margin-bottom:4px;">Food: ${review.foodName}</div>` : ''}
                ${review.feedback ? `<div style="font-size:13px;color:#555;font-style:italic;">"${review.feedback}"</div>` : ''}
            `;
            container.appendChild(card);
        });
    });
}
window.showReviewsScreen = showReviewsScreen;

// ─── Show Food History Screen ────────────────────────────────────────────────
export function showFoodHistoryScreen() {
    window.navigateTo('history');
    const user = auth.currentUser;
    if (!user) return;

    const btnDonated = document.getElementById('tab-btn-donated');
    const btnClaimed = document.getElementById('tab-btn-claimed');

    let currentTab = 'donated';

    const loadTab = (type) => {
        currentTab = type;
        if (type === 'donated') {
            btnDonated.classList.add('active-tab');
            btnClaimed.classList.remove('active-tab');
        } else {
            btnClaimed.classList.add('active-tab');
            btnDonated.classList.remove('active-tab');
        }
        _loadHistoryData(user.uid, type);
    };

    btnDonated.onclick = () => loadTab('donated');
    btnClaimed.onclick = () => loadTab('claimed');

    loadTab('donated');
}
window.showFoodHistoryScreen = showFoodHistoryScreen;

function _loadHistoryData(uid, type) {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">Loading history...</div>`;

    onValue(ref(rtdb, `food_history/${uid}/${type}`), snapshot => {
        container.innerHTML = '';
        if (!snapshot.exists()) {
            container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">${type === 'donated' ? 'No donated food yet — share food to see history!' : 'No claimed food yet — claim food to see history!'}</div>`;
            return;
        }

        const items = [];
        snapshot.forEach(child => {
            items.push({ id: child.key, ...child.val() });
        });

        items.sort((a, b) => {
            const timeA = a.verifiedAt || a.receivedAt || 0;
            const timeB = b.verifiedAt || b.receivedAt || 0;
            return timeB - timeA;
        });

        items.forEach(item => {
            const ts = item.verifiedAt || item.receivedAt || 0;
            const dateStr = ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const otherName = type === 'donated' ? item.claimerName : item.donorName;

            const card = document.createElement('div');
            card.style.background = '#FFFFFF';
            card.style.padding = '16px';
            card.style.borderRadius = '12px';
            card.style.border = '1px solid #E0E0E0';
            card.style.marginBottom = '12px';

            card.innerHTML = `
                <div style="font-weight:700;font-size:16px;color:#1A1A1A;margin-bottom:2px;">🍛 ${item.foodName || 'Food'}</div>
                <div style="font-size:12px;color:var(--primary, #22c55e);font-weight:600;margin-bottom:6px;">${item.category || ''}</div>
                <div style="font-size:12px;color:#666;margin-bottom:6px;">📍 ${item.location || 'Nearby'} · ${dateStr}</div>
                ${otherName ? `<div style="font-size:13px;color:#333;font-weight:500;">👤 ${type === 'donated' ? 'Claimed by' : 'From'}: <strong>${otherName}</strong></div>` : ''}
                ${type === 'donated' ? `<div style="font-size:12px;color:var(--primary, #22c55e);font-weight:700;margin-top:6px;">✅ Verified & Collected</div>` : ''}
                ${type === 'claimed' && item.rating ? `
                    <div style="margin-top:6px;font-size:13px;color:#FFB800;font-weight:700;">
                        ⭐ You rated: ${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}
                    </div>
                    ${item.feedback ? `<div style="font-size:12px;color:#666;font-style:italic;margin-top:2px;">"${item.feedback}"</div>` : ''}
                ` : ''}
            `;
            container.appendChild(card);
        });
    });
}
