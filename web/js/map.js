import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";

let leafletMap = null;
let markersLayer = null;

export function initMap() {
    // Loaded via navigateTo
}

function loadLeafletMap() {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;

    if (leafletMap) {
        leafletMap.invalidateSize();
        return;
    }

    // Coimbatore Default
    leafletMap = L.map('map').setView([11.0168, 76.9558], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);

    // Get User Location (Parity with MapFragment.kt)
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude: lat, longitude: lng } = pos.coords;
            leafletMap.setView([lat, lng], 14);

            // Android Parity: Yellow marker for user
            L.circleMarker([lat, lng], {
                radius: 12,
                fillColor: '#FBC02D', // Hue Yellow
                color: '#fff',
                weight: 4,
                fillOpacity: 1
            }).addTo(leafletMap).bindPopup('<b>📍 Your Location</b>');

            loadFoodPins(lat, lng);
        }, () => loadFoodPins(11.0168, 76.9558));
    } else {
        loadFoodPins(11.0168, 76.9558);
    }
}

function loadFoodPins(userLat, userLng) {
    onValue(ref(rtdb, 'food_items'), snapshot => {
        markersLayer.clearLayers();
        if (!snapshot.exists()) return;

        const now = Date.now();
        snapshot.forEach(child => {
            const item = child.val();
            // Parity: Ignore expired
            if (item.expiryTimeMillis && now > item.expiryTimeMillis) return;

            // ✅ ANDROID PARITY: Randomized offsets (±0.02)
            const latOffset = (Math.random() - 0.5) * 0.02;
            const lngOffset = (Math.random() - 0.5) * 0.02;
            const pinLat = userLat + latOffset;
            const pinLng = userLng + lngOffset;

            // ✅ ANDROID PARITY: Marker Colors
            // Green = Available, Blue = Claimed
            const color = item.isClaimed ? '#1E88E5' : '#00C853';

            const timeLeft = (item.expiryTimeMillis || 0) - now;
            const hrs = Math.floor(timeLeft / 3600000);
            const mins = Math.floor((timeLeft % 3600000) / 60000);
            const timeText = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;

            const marker = L.circleMarker([pinLat, pinLng], {
                radius: 10,
                fillColor: color,
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9
            });

            marker.bindPopup(`
                <div style="font-family:Inter, sans-serif; min-width:160px;">
                    <h3 style="font-size:14px; margin-bottom:4px;">${item.foodName}</h3>
                    <p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">By ${item.userName} · <b>${timeText}</b></p>
                    <button onclick="window.navigateTo('feed')" style="width:100%; padding:6px; background:var(--primary); color:#fff; border:none; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">VIEW DETAILS</button>
                </div>
            `);

            markersLayer.addLayer(marker);
        });
    });
}

window.loadMap = loadLeafletMap;
