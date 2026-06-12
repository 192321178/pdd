import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";

export function initMap() {
    const mapScreen = document.getElementById('map-screen');
    mapScreen.innerHTML = `
        <div class="map-container glass">
            <div id="google-map" style="width: 100%; height: 100%; border-radius: 16px;"></div>
        </div>
    `;

    const mapOptions = {
        center: { lat: 11.0168, lng: 76.9558 }, // Coimbatore
        zoom: 12,
        styles: [
            { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffffff" }] },
            { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 13 }] },
            { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 20 }] },
            { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 20 }] },
            { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 21 }] },
            { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 17 }] },
            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 17 }] }
        ]
    };

    const map = new google.maps.Map(document.getElementById("google-map"), mapOptions);

    // Load Food Markers from RTDB
    const foodRef = ref(rtdb, 'food_items');
    onValue(foodRef, (snapshot) => {
        if (!snapshot.exists()) return;

        snapshot.forEach((child) => {
            const item = child.val();
            if (item.lat && item.lng) {
                new google.maps.Marker({
                    position: { lat: parseFloat(item.lat), lng: parseFloat(item.lng) },
                    map,
                    title: item.foodName,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#00C853',
                        fillOpacity: 1,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 2,
                        scale: 8
                    }
                });
            }
        });
    });
}

window.loadMap = initMap;
