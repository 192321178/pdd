import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";
import { loadFeed } from "./feed.js";

export function initShare() {
    const photoBox = document.getElementById('photo-upload-box');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const btnSubmit = document.getElementById('btn-submit-listing');

    photoBox?.addEventListener('click', () => photoInput?.click());

    photoInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                photoPreview.src = e.target.result;
                photoPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    btnSubmit?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return alert("Please login first.");

        const foodName = document.getElementById('share-food-name').value.trim();
        const quantity = document.getElementById('share-quantity').value.trim();
        const location = document.getElementById('share-location').value.trim();
        const category = document.querySelector('.cat-chip.active')?.dataset.cat || 'Cooked Meal';
        const description = document.getElementById('share-description').value.trim();
        const hours = parseInt(document.getElementById('share-hours').value) || 0;
        const mins = parseInt(document.getElementById('share-minutes').value) || 20;
        const isAnonymous = document.getElementById('share-anonymous').checked;

        if (!foodName || !quantity || !location) {
            return alert("Food name, quantity, and location are required.");
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = "SHARING...";

        const expiryMillis = Date.now() + (hours * 3600000) + (mins * 60000);

        const dietaryTags = [];
        document.querySelectorAll('.diet-tag.active').forEach(tag => {
            dietaryTags.push(tag.dataset.tag);
        });

        // Match Android FoodItem structure exactly
        const foodRef = ref(rtdb, 'food_items');
        const newItemRef = push(foodRef);
        const foodId = newItemRef.key;

        const foodItem = {
            id: foodId,
            foodName: foodName,
            quantity: quantity,
            category: category,
            description: description,
            location: location,
            userName: user.displayName || user.email?.split('@')[0] || 'User',
            userUid: user.uid,
            imageUri: photoPreview.src.startsWith('data:') ? photoPreview.src : null,
            expiryTimeMillis: expiryMillis,
            isClaimed: false,
            claimedByUid: "",
            dietaryTags: dietaryTags,
            isAnonymous: isAnonymous,
            createdAt: serverTimestamp(), // Added for sorting
            timestamp: Date.now()         // Fallback for immediate web sorting
        };

        try {
            await set(newItemRef, foodItem);
            alert("Food shared successfully! 🎉");
            // Reset form and navigate
            _resetForm(photoPreview);
            document.querySelector('[data-screen="home"]').click();

            // Critical: Trigger feed reload to show the new item immediately
            setTimeout(() => {
                loadFeed();
            }, 100);
        } catch (err) {
            alert("Failed to share: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "SHARE";
        }
    });

    // Category chips
    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });

    // Dietary tags
    document.querySelectorAll('.diet-tag').forEach(tag => {
        tag.addEventListener('click', () => tag.classList.toggle('active'));
    });
}
