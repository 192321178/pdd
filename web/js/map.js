import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";
import { auth } from "./firebase-config.js";

let leafletMap = null;
let markersLayer = null;

export function initMap() {
    // initMap is called at startup; actual map load deferred to navigateTo('map')
    // window.loadMap is set here for the navigateTo trigger
}

function loadLeafletMap() {
    const mapDiv = document.getElementById('google-map');
    if (!mapDiv) return;

    if (leafletMap) {
        leafletMap.invalidateSize();
        return;
    }

    leafletMap = L.map('google-map', {
        center: [11.0168, 76.9558],
        zoom: 13,
        zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);

    // Current user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude: lat, longitude: lng } = pos.coords;
            leafletMap.setView([lat, lng], 14);
            L.circleMarker([lat, lng], {
                radius: 10, fillColor: '#F59E0B',
                color: '#fff', weight: 3, fillOpacity: 1,
            }).addTo(leafletMap).bindPopup('<b>📍 You</b>');
        }, () => { });
    }

    // Food markers from Firebase
    const foodRef = ref(rtdb, 'food_items');
    onValue(foodRef, snapshot => {
        markersLayer.clearLayers();
        if (!snapshot.exists()) return;
        snapshot.forEach(child => {
            const item = child.val();
            if (!item.lat || !item.lng) return;
            const marker = L.circleMarker(
                [parseFloat(item.lat), parseFloat(item.lng)],
                {
                    radius: 11,
                    fillColor: item.isClaimed ? '#1565C0' : '#005028',
                    color: '#fff', weight: 2.5, fillOpacity: 0.9,
                }
            );
            marker.bindPopup(`
                <div style="font-family:Inter,sans-serif;min-width:140px">
                    <b style="color:#005028">${item.foodName || 'Food'}</b><br>
                    <span style="color:#6B7280;font-size:12px">${item.category || ''}</span><br>
                    <span style="font-size:11px">${item.isClaimed ? '🔵 Claimed' : '🟢 Available'}</span>
                </div>
            `);
            markersLayer.addLayer(marker);
        });
    });
}

window.loadMap = loadLeafletMap;
