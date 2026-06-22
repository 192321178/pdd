import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initShare() {
    const photoBox = document.getElementById('photo-upload-box');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const btnSubmit = document.getElementById('btn-submit-listing');

    let activeCategory = 'Cooked Meal';

    photoBox?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                photoPreview.src = re.target.result;
                photoPreview.classList.remove('hidden');
                photoBox.querySelector('.camera-icon-circle').classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.getAttribute('data-cat');
        });
    });

    const submitLogic = async () => {
        const user = auth.currentUser;
        if (!user) return alert('Please login first');

        const foodName = document.getElementById('share-food-name').value.trim();
        const quantity = document.getElementById('share-quantity').value.trim();
        const location = document.getElementById('share-location').value.trim();

        if (!foodName || !quantity) return alert('Required fields missing');

        btnSubmit.disabled = true;
        btnSubmit.textContent = '...';

        try {
            const newItemRef = push(ref(rtdb, 'food_items'));
            const expiry = Date.now() + (6 * 3600000);

            await set(newItemRef, {
                foodId: newItemRef.key,
                foodName,
                category: activeCategory,
                quantity,
                location: location || 'Coimbatore, TN',
                imageUri: photoPreview.src || '',
                userUid: user.uid,
                userName: document.getElementById('profile-display-name')?.textContent || user.displayName || 'Donor',
                donorName: document.getElementById('profile-display-name')?.textContent || user.displayName || 'Donor',
                sharedAt: serverTimestamp(),
                expiryTimeMillis: expiry,
                isClaimed: false,
                lat: 11.0168,
                lng: 76.9558
            });

            // Update user impact stats
            const statsRef = ref(rtdb, `users/${user.uid}/impact_stats`);
            onValue(statsRef, snapshot => {
                const current = snapshot.val() || { donations: 0, kg_saved: 0.0, co2_reduced: 0.0 };
                set(statsRef, {
                    ...current,
                    donations: (current.donations || 0) + 1,
                    kg_saved: (current.kg_saved || 0.0) + 0.9, // Default impact per donation
                    co2_reduced: (current.co2_reduced || 0.0) + 2.5
                });
            }, { onlyOnce: true });

            alert('🚀 Shared successfully!');
            window.navigateTo('home');

            // Reset
            document.getElementById('share-food-name').value = '';
            photoPreview.classList.add('hidden');
            photoBox.querySelector('.camera-icon-circle').classList.remove('hidden');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'SHARE';

        } catch (err) {
            alert('Error: ' + err.message);
            btnSubmit.disabled = false;
        }
    };

    btnSubmit?.addEventListener('click', submitLogic);
}
