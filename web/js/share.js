import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initShare() {
    const photoBox = document.getElementById('photo-upload-box');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const btnSubmit = document.getElementById('btn-share-submit');

    let activeCategory = 'Cooked Meal';

    photoBox?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                photoPreview.src = re.target.result;
                photoPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cat-chip').forEach(c => {
                c.classList.remove('active');
                c.style.background = 'none';
                c.style.borderColor = 'var(--border)';
                c.style.color = 'var(--text-primary)';
            });
            chip.classList.add('active');
            chip.style.background = 'rgba(0,200,83,0.1)';
            chip.style.borderColor = 'var(--primary)';
            chip.style.color = 'var(--primary)';
            activeCategory = chip.getAttribute('data-cat');
        });
    });

    btnSubmit?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            window.showToast?.('Please login to share food', 'error');
            return;
        }

        const foodName = document.getElementById('share-food-name').value.trim();
        const quantity = document.getElementById('share-quantity').value.trim();
        const location = document.getElementById('share-location').value.trim();
        const description = document.getElementById('share-description').value.trim();

        if (!foodName || !quantity) {
            window.showToast?.('Please fill required fields', 'error');
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'PUBLISHING...';

        try {
            const newItemRef = push(ref(rtdb, 'food_items'));
            const expiry = Date.now() + (4 * 3600000); // Default 4 hours parity

            await set(newItemRef, {
                foodId: newItemRef.key,
                foodName,
                category: activeCategory,
                quantity,
                location: location || 'Coimbatore',
                description,
                imageUri: photoPreview.src || '',
                userUid: user.uid,
                userName: user.displayName || user.email.split('@')[0],
                sharedAt: serverTimestamp(),
                expiryTimeMillis: expiry,
                isClaimed: false,
                lat: 11.0168, // Default
                lng: 76.9558
            });

            window.showToast?.('🚀 Food Listing Live!', 'success');
            window.navigateTo('feed');

            // Reset form
            document.getElementById('share-food-name').value = '';
            document.getElementById('share-quantity').value = '';
            document.getElementById('share-description').value = '';
            photoPreview.classList.add('hidden');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'SUBMIT LISTING';

        } catch (err) {
            window.showToast?.('Error publishing: ' + err.message, 'error');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'SUBMIT LISTING';
        }
    });
}
