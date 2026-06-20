import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initShare() {
    const photoBox = document.getElementById('photo-upload-box');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const submitBtn = document.getElementById('btn-share-submit');
    const categoryChips = document.getElementById('category-chips');

    let selectedCategory = 'Cooked Meal';
    let selectedPhotoBase64 = null;

    photoBox?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            photoPreview.src = ev.target.result;
            photoPreview.classList.remove('hidden');
            selectedPhotoBase64 = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    categoryChips?.addEventListener('click', e => {
        const chip = e.target.closest('.cat-chip');
        if (!chip) return;
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedCategory = chip.getAttribute('data-cat');
    });

    submitBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) { window.showToast?.('Please login first', 'error'); return; }

        const foodName = document.getElementById('share-food-name')?.value.trim();
        const quantity = document.getElementById('share-quantity')?.value.trim();
        const location = document.getElementById('share-location')?.value.trim();
        const hrs = parseInt(document.getElementById('share-hours')?.value || '0');
        const mins = parseInt(document.getElementById('share-mins')?.value || '0');
        const desc = document.getElementById('share-description')?.value.trim();

        if (!foodName || !quantity || !location) {
            window.showToast?.('Please fill required fields', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sharing...';

        try {
            const newItemRef = push(ref(rtdb, 'food_items'));
            const expiry = Date.now() + (hrs * 3600000) + (mins * 60000);

            const itemData = {
                id: newItemRef.key,
                foodName,
                category: selectedCategory,
                quantity,
                location,
                expiryTimeMillis: expiry,
                description: desc || '',
                imageUri: selectedPhotoBase64 || '',
                isClaimed: false,
                claimedByUid: "",
                userUid: user.uid,
                userName: user.displayName || user.email?.split('@')[0] || 'User',
                sharedAt: serverTimestamp()
            };

            await set(newItemRef, itemData);
            window.showToast?.('🌿 Food shared successfully!', 'success');
            resetForm();
            window.navigateTo?.('feed');
        } catch (err) {
            console.error('Share error:', err);
            window.showToast?.('Failed to share', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'SHARE FOOD';
        }
    });

    function resetForm() {
        document.getElementById('share-food-name').value = '';
        document.getElementById('share-quantity').value = '';
        document.getElementById('share-location').value = '';
        document.getElementById('share-hours').value = '';
        document.getElementById('share-mins').value = '';
        document.getElementById('share-description').value = '';
        photoPreview.src = '';
        photoPreview.classList.add('hidden');
        selectedPhotoBase64 = null;
    }
}
