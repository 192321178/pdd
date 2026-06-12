import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";
import { navigateTo, showToast } from "./app.js";

export function initShare() {
    const shareScreen = document.getElementById('share-screen');

    shareScreen.innerHTML = `
        <div class="share-container">
            <h2>Share Surplus Food</h2>
            <p class="subtitle">Enter details of the food you'd like to share with the community.</p>
            
            <form id="share-form" class="glass-form">
                <div id="photo-upload" class="photo-upload-box">
                    <i data-lucide="camera"></i>
                    <span>Add Food Photo</span>
                    <input type="file" id="input-photo" accept="image/*" style="display:none">
                    <img id="share-preview" src="" style="display:none; width:100%; height:100%; object-fit:cover; border-radius:12px;">
                </div>

                <div class="input-group">
                    <label>Food Item Name</label>
                    <input type="text" id="share-name" placeholder="E.g. Homemade Pasta" required>
                </div>

                <div class="form-grid">
                    <div class="input-group">
                        <label>Category</label>
                        <select id="share-category">
                            <option>Cooked Meal</option>
                            <option>Fresh Produce</option>
                            <option>Bakery</option>
                            <option>Packaged</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Quantity</label>
                        <input type="text" id="share-quantity" placeholder="E.g. 2 Servings" required>
                    </div>
                </div>

                <div class="input-group">
                    <label>Description</label>
                    <textarea id="share-desc" placeholder="Details about freshness or pickup..."></textarea>
                </div>

                <div class="form-grid">
                    <div class="input-group">
                        <label>Location</label>
                        <input type="text" id="share-location" placeholder="E.g. Main Street" required>
                    </div>
                    <div class="input-group">
                        <label>Expiry (Hours)</label>
                        <input type="number" id="share-expiry" value="4" min="1" required>
                    </div>
                </div>

                <button type="submit" id="btn-share-submit" class="btn-primary">Post Listing</button>
            </form>
        </div>
    `;

    lucide.createIcons();

    const photoBox = document.getElementById('photo-upload');
    const inputPhoto = document.getElementById('input-photo');
    const preview = document.getElementById('share-preview');
    const form = document.getElementById('share-form');

    let base64Image = null;

    photoBox.addEventListener('click', () => inputPhoto.click());

    inputPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                const img = new Image();
                img.src = re.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 600;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    base64Image = canvas.toDataURL('image/jpeg', 0.7);

                    preview.src = base64Image;
                    preview.style.display = 'block';
                    photoBox.querySelector('i').style.display = 'none';
                    photoBox.querySelector('span').style.display = 'none';
                };
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return showToast("Please login first", "error");

        const btn = document.getElementById('btn-share-submit');
        btn.disabled = true;
        btn.textContent = "Posting...";

        const itemId = crypto.randomUUID();
        const foodData = {
            id: itemId,
            foodName: document.getElementById('share-name').value,
            category: document.getElementById('share-category').value,
            quantity: document.getElementById('share-quantity').value,
            description: document.getElementById('share-desc').value,
            location: document.getElementById('share-location').value,
            expiryTimeMillis: Date.now() + (parseInt(document.getElementById('share-expiry').value) * 3600000),
            userName: user.displayName || user.email.split('@')[0],
            userUid: user.uid,
            imageUri: base64Image,
            isClaimed: false,
            claimedByUid: ""
        };

        try {
            await set(ref(rtdb, 'food_items/' + itemId), foodData);
            showToast("Food shared successfully! 🎉", "success");
            navigateTo('feed');
        } catch (error) {
            console.error("Posting error:", error);
            showToast("Failed to post. Try again.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Post Listing";
        }
    });
}

window.loadShare = initShare;
