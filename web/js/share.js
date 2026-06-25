import {
    collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, auth } from "./firebase-config.js";

export function initShare() {
    const photoBox = document.getElementById('photo-upload-box');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const btnSubmit = document.getElementById('btn-submit-listing');

    let activeCategory = 'Cooked Meal';
    let selectedTags = [];
    let imageDataUri = '';

    photoBox?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = re => {
            imageDataUri = re.target.result;
            photoPreview.src = imageDataUri;
            photoPreview.classList.remove('hidden');
            photoBox.querySelector('.camera-icon-circle')?.classList.add('hidden');
            photoBox.querySelector('.upload-text')?.classList.add('hidden');
            photoBox.querySelector('.upload-hint')?.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    });

    // Category chips — single active
    document.querySelectorAll('#category-chips-share .cat-chip').forEach(chip => {
        chip.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('#category-chips-share .cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.getAttribute('data-cat');
        });
    });

    // Dietary tags — multi-toggle
    document.querySelectorAll('.diet-tag').forEach(tag => {
        tag.addEventListener('click', e => {
            e.preventDefault();
            tag.classList.toggle('active');
            const val = tag.getAttribute('data-tag');
            if (selectedTags.includes(val)) selectedTags = selectedTags.filter(t => t !== val);
            else selectedTags.push(val);
        });
    });

    btnSubmit?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return alert('Please login first.');

        const foodName = document.getElementById('share-food-name').value.trim();
        const quantity = document.getElementById('share-quantity').value.trim();
        const location = document.getElementById('share-location').value.trim();
        const description = document.getElementById('share-description')?.value.trim() || '';
        const isAnon = document.getElementById('share-anonymous')?.checked || false;
        const hours = parseInt(document.getElementById('share-hours')?.value) || 0;
        const minutes = parseInt(document.getElementById('share-minutes')?.value) || 0;
        const totalMs = hours * 3600000 + minutes * 60000;

        if (!foodName) return alert('Please enter a food name.');
        if (!quantity) return alert('Please enter a quantity.');
        if (totalMs <= 0) return alert('Please set an available-until time (more than 0 minutes).');

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Sharing...';

        try {
            const displayName = user.displayName || user.email?.split('@')[0] || 'User';
            await addDoc(collection(db, 'food_items'), {
                foodName,
                category: activeCategory,
                quantity,
                location: location || 'Coimbatore, TN',
                description,
                dietaryTags: selectedTags,
                imageUri: imageDataUri || '',
                userUid: user.uid,
                userName: isAnon ? 'Anonymous' : displayName,
                isAnonymous: isAnon,
                expiryTimeMillis: Date.now() + totalMs,
                isClaimed: false,
                claimedByUid: '',
                createdAt: serverTimestamp()
            });

            alert('✅ Food shared successfully!');
            window.navigateTo('home');
            _resetShareForm();
        } catch (err) {
            alert('Error sharing food: ' + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'SHARE';
        }
    });

    function _resetShareForm() {
        document.getElementById('share-food-name').value = '';
        document.getElementById('share-quantity').value = '';
        document.getElementById('share-location').value = '';
        document.getElementById('share-description').value = '';
        document.getElementById('share-hours').value = '0';
        document.getElementById('share-minutes').value = '20';
        document.getElementById('share-anonymous').checked = false;
        photoPreview.classList.add('hidden');
        imageDataUri = '';
        photoBox.querySelector('.camera-icon-circle')?.classList.remove('hidden');
        photoBox.querySelector('.upload-text')?.classList.remove('hidden');
        photoBox.querySelector('.upload-hint')?.classList.remove('hidden');
        selectedTags = [];
        document.querySelectorAll('.diet-tag').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#category-chips-share .cat-chip').forEach((c, i) => {
            c.classList.toggle('active', i === 0);
        });
        activeCategory = 'Cooked Meal';
    }
}
