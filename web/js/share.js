import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb, auth } from "./firebase-config.js";

export function initShare() {
    const photoBox = document.getElementById('photo-upload-box');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const btnSubmit = document.getElementById('btn-submit-listing');

    let activeCategory = 'Cooked Meal';
    let selectedTags = [];

    photoBox?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                photoPreview.src = re.target.result;
                photoPreview.classList.remove('hidden');
                photoBox.querySelector('.camera-icon-circle')?.classList.add('hidden');
                photoBox.querySelector('.upload-text')?.classList.add('hidden');
                photoBox.querySelector('.upload-hint')?.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // Category chips
    document.querySelectorAll('#category-chips-share .cat-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#category-chips-share .cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.getAttribute('data-cat');
        });
    });

    // Dietary tag chips (toggle)
    document.querySelectorAll('.diet-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.preventDefault();
            tag.classList.toggle('active');
            const tagVal = tag.getAttribute('data-tag');
            if (selectedTags.includes(tagVal)) {
                selectedTags = selectedTags.filter(t => t !== tagVal);
            } else {
                selectedTags.push(tagVal);
            }
        });
    });

    const submitLogic = async () => {
        const user = auth.currentUser;
        if (!user) return alert('Please login first');

        const foodName = document.getElementById('share-food-name').value.trim();
        const quantity = document.getElementById('share-quantity').value.trim();
        const location = document.getElementById('share-location').value.trim();
        const description = document.getElementById('share-description')?.value.trim() || '';
        const isAnon = document.getElementById('share-anonymous')?.checked || false;

        // Read hours and minutes from the inputs
        const hours = parseInt(document.getElementById('share-hours')?.value) || 0;
        const minutes = parseInt(document.getElementById('share-minutes')?.value) || 0;
        const totalMs = (hours * 3600000) + (minutes * 60000);

        if (!foodName || !quantity) return alert('Required fields missing');
        if (totalMs <= 0) return alert('Please set an Available Until time');

        btnSubmit.disabled = true;
        btnSubmit.textContent = '...';

        try {
            const newItemRef = push(ref(rtdb, 'food_items'));
            const expiry = Date.now() + totalMs;

            const donorName = isAnon ? 'Anonymous' :
                (document.getElementById('profile-display-name')?.textContent || user.displayName || 'Donor');

            await set(newItemRef, {
                id: newItemRef.key,
                foodName,
                category: activeCategory,
                quantity,
                description,
                dietaryTags: selectedTags,
                location: location || 'Coimbatore, TN',
                imageUri: photoPreview.src || '',
                userUid: user.uid,
                userName: donorName,
                sharedAt: serverTimestamp(),
                expiryTimeMillis: expiry,
                isClaimed: false,
                lat: 11.0168,
                lng: 76.9558
            });

            alert('🚀 Shared successfully!');
            window.navigateTo('home');

            // Reset form
            document.getElementById('share-food-name').value = '';
            document.getElementById('share-quantity').value = '';
            document.getElementById('share-location').value = '';
            document.getElementById('share-description').value = '';
            document.getElementById('share-hours').value = '0';
            document.getElementById('share-minutes').value = '20';
            document.getElementById('share-anonymous').checked = false;
            photoPreview.classList.add('hidden');
            photoBox.querySelector('.camera-icon-circle')?.classList.remove('hidden');
            photoBox.querySelector('.upload-text')?.classList.remove('hidden');
            photoBox.querySelector('.upload-hint')?.classList.remove('hidden');
            selectedTags = [];
            document.querySelectorAll('.diet-tag').forEach(t => t.classList.remove('active'));
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'SHARE';

        } catch (err) {
            alert('Error: ' + err.message);
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'SHARE';
        }
    };

    btnSubmit?.addEventListener('click', submitLogic);
}
