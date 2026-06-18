import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { rtdb, storage, auth } from "./firebase-config.js";

export function initShare() {
    const form = document.getElementById('share-form');
    const photoBox = document.getElementById('photo-upload-box');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const submitBtn = document.getElementById('btn-share-submit');
    const categoryChips = document.getElementById('category-chips');
    const dietaryChips = document.getElementById('dietary-chips');

    let selectedCategory = 'Cooked Meal';
    let selectedTags = [];
    let selectedPhotoFile = null;

    // Photo upload
    photoBox?.addEventListener('click', (e) => {
        if (e.target !== photoInput) photoInput?.click();
    });
    photoInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        selectedPhotoFile = file;
        const reader = new FileReader();
        reader.onload = ev => {
            photoPreview.src = ev.target.result;
            photoPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });

    // Category chip selection
    categoryChips?.addEventListener('click', e => {
        const chip = e.target.closest('.cat-chip');
        if (!chip) return;
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedCategory = chip.getAttribute('data-cat');
    });

    // Dietary tag selection
    dietaryChips?.addEventListener('click', e => {
        const chip = e.target.closest('.diet-chip');
        if (!chip) return;
        chip.classList.toggle('active');
        const tag = chip.getAttribute('data-tag');
        if (chip.classList.contains('active')) {
            selectedTags.push(tag);
        } else {
            selectedTags = selectedTags.filter(t => t !== tag);
        }
    });

    // Share food submit
    submitBtn?.addEventListener('click', () => submitShare());
    form?.addEventListener('submit', e => { e.preventDefault(); submitShare(); });

    async function submitShare() {
        const user = auth.currentUser;
        if (!user) { window.showToast?.('Please login first', 'error'); return; }

        const foodName = document.getElementById('share-food-name')?.value.trim();
        const quantity = document.getElementById('share-quantity')?.value.trim();
        const location = document.getElementById('share-location')?.value.trim();
        const hours = parseInt(document.getElementById('share-hours')?.value || '0');
        const mins = parseInt(document.getElementById('share-mins')?.value || '0');
        const description = document.getElementById('share-description')?.value.trim();
        const isAnonymous = document.getElementById('anon-toggle')?.checked;

        if (!foodName) { window.showToast?.('Enter a food name', 'error'); return; }
        if (!quantity) { window.showToast?.('Enter quantity', 'error'); return; }
        if (!location) { window.showToast?.('Enter pickup location', 'error'); return; }

        const expiryMs = Date.now() + (hours * 3600000) + (mins * 60000);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sharing...';

        try {
            let imageData = '';

            // ✅ Convert photo to Base64 to match mobile app's pattern
            // This avoids potential Firebase Storage hangs/permission issues
            if (selectedPhotoFile) {
                console.log("Encoding image to Base64...");
                imageData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = err => reject(err);
                    reader.readAsDataURL(selectedPhotoFile);
                });
            }

            console.log("Generating new item ref...");
            const newItemRef = push(ref(rtdb, 'food_items'));

            // ✅ Aligning data structure with mobile app (location, userUid)
            const itemData = {
                id: newItemRef.key,
                foodName,
                category: selectedCategory,
                quantity,
                location: location, // Changed from pickupLocation to match mobile
                expiryTimeMillis: expiryMs,
                description: description || '',
                dietaryTags: selectedTags,
                imageUri: imageData, // Storing Base64 data directly
                isClaimed: false,
                claimedByUid: "",
                userUid: isAnonymous ? "" : user.uid, // Mobile app sets to empty string if anonymous
                userName: isAnonymous ? 'Anonymous' : (user.displayName || user.email?.split('@')[0] || 'User'),
                isAnonymous,
                sharedAt: serverTimestamp()
            };

            console.log("Saving to RTDB:", itemData);
            await set(newItemRef, itemData);

            window.showToast?.('🌿 Food shared successfully!', 'success');
            resetForm();
            window.navigateTo?.('feed');
        } catch (err) {
            console.error('Share error:', err);
            window.showToast?.('Failed to share: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Share';
        }
    }

    function resetForm() {
        form?.reset();
        photoPreview.src = '';
        photoPreview.classList.add('hidden');
        selectedPhotoFile = null;
        selectedTags = [];
        selectedCategory = 'Cooked Meal';
        document.querySelectorAll('.cat-chip').forEach((c, i) => {
            c.classList.toggle('active', i === 0);
        });
        document.querySelectorAll('.diet-chip').forEach(c => c.classList.remove('active'));
    }
}
