const map = L.map('map').setView([24.8949, 91.8687], 10); 

// 2. Add standard map tiles (Streets/Background)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 3. Fetch and add your real-time Dynamic Flood Forecast Layer from your backend API
// Your API should update this JSON file automatically as weather forecasts change
fetch('/api/v1/forecast-flood-layer?timeline=24h')
    .then(response => response.json())
    .then(geojsonData => {
        L.geoJSON(geojsonData, {
            style: function(feature) {
                // Color code zones based on predicted water depth
                switch (feature.properties.riskLevel) {
                    case 'High': return {color: "#ff0000", fillColor: "#ff0000", fillOpacity: 0.5};
                    case 'Medium': return {color: "#ffa500", fillColor: "#ffa500", fillOpacity: 0.5};
                    default: return {color: "#00ff00", fillColor: "#00ff00", fillOpacity: 0.2};
                }
            }
        }).addTo(map);
    });