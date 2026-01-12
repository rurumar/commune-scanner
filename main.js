"use strict";

window.onload = async () => {
    let map = L.map("map", {
        center: [48.856667, 2.352222],
        zoom: 11,
    });

    let layer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 15,
            attribution: '© OpenStreetMap',
        }
    );
    layer.addTo(map);

    let markers = [];

    fetch("./static/data/Final.geojson")
        .then(response => response.json())
        .then(geojsonData => {

            function getColor(value) {
                if (value > 25) return '#800026';
                if (value > 20) return '#BD0026';
                if (value > 15) return '#E31A1C';
                if (value > 10) return '#FD8D3C';
                if (!value) return '#a5a5a5'
                return '#FFFFB2';
            }

            function styleFeature(feature) {
                return {
                    fillColor: getColor(feature.properties.loyer),
                    weight: 1,
                    opacity: 1,
                    color: '#555',
                    fillOpacity: 0.7
                };
            }

            function onEachFeature(feature, layer) {
                const nomCommune = feature.properties.nom || "Nom inconnu";
                const loyer = feature.properties.loyer || "N/A";
                const tauxCriminalité = feature.properties.taux_pour_mille_2024 || "N/A";
                const vacants = feature.properties.vacants || "N/A";
                layer.on({
                    mouseover: function(e) {
                        const l = e.target;
                        l.setStyle({
                            weight: 3,
                            color: '#fff',
                            fillOpacity: 0.9
                        });
                        l.bringToFront();
                        l.bindTooltip(`<strong>${nomCommune}</strong><br>Loyer: ${loyer} €<br>Taux criminalité: ${tauxCriminalité}<br>Logements vacants: ${vacants}`, {
                            sticky: true
                        }).openTooltip();
                    },
                    mouseout: function(e) {
                        const l = e.target;
                        geojsonLayer.resetStyle(l);
                        if (l.getTooltip()) {
                            l.closeTooltip();
                            l.unbindTooltip();
                        }
                    },
                    click: function(e) {
                        const l = e.target;
                        const props = feature.properties;
                        
                        const bounds = l.getBounds();
                        const center = bounds.getCenter();
                        
                        const marker = L.marker([center.lat, center.lng], {
                            icon: L.icon({
                                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                                shadowSize: [41, 41]
                            })
                        }).addTo(map);
                        
                        markers.push(marker);
                        addCommuneCard(props);
                    }
                });
            }

            const geojsonLayer = L.geoJSON(geojsonData, {
                style: styleFeature,
                onEachFeature: onEachFeature
            }).addTo(map);
        });
};

// Fonction pour ajouter une carte de commune dans la sidebar
function addCommuneCard(properties) {
    const sidebar = document.querySelector('.side-panel');
    
    // Supprimer le message d'information s'il existe
    const emptyMessage = sidebar.querySelector('.empty-message');
    if (emptyMessage) {
        emptyMessage.remove();
    }
    
    const cardId = properties.code;
    const nom = properties.nom || "Nom inconnu";
    const insee = properties.code || "N/A";
    const loyer = properties.loyer || "N/A";
    const tauxCriminalité = properties.taux_pour_mille_2024 || "N/A";
    const vacants = properties.vacants || "N/A";
    
    const cardHTML = `
        <div class="commune-card">
            <button class="delete-btn" onclick="deleteCard('${cardId}')" title="Supprimer cette commune">
              ✕
            </button>
            <p class="commune-title">Commune</p>
            <a href="#" class="commune-link">${nom}</a>
            <p class="insee">INSEE: ${insee}</p>
            <ul class="indicators">
                <li>
                    <span class="label">Loyer moyen</span>
                    <span class="value">${loyer}€</span>
                </li>
                <li>
                    <span class="label">Taux de criminalité</span>
                    <span class="value warning">${tauxCriminalité}</span>
                </li>
                <li>
                    <span class="label">Logements vacants</span>
                    <span class="value warning">${vacants}</span>
                </li>
            </ul>
        </div>
    `;
    
    sidebar.insertAdjacentHTML('beforeend', cardHTML);
}

// Fonction pour supprimer une carte et son marqueur
function deleteCard(cardId) {
    const card = document.getElementById(cardId);
    const sidebar = document.querySelector('.side-panel');
    
    if (card) {
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            card.remove();
            
            const remainingCards = sidebar.querySelectorAll('.commune-card');
            if (remainingCards.length === 0) {
                const emptyHTML = `
                    <div class="empty-message" style="
                        text-align: center;
                        padding: 40px 20px;
                        color: #9ca3af;
                        font-size: 15px;
                    ">
                        <p style="font-size: 48px; margin: 0;">🗺️</p>
                        <p style="margin: 16px 0 8px; font-weight: 600; color: #6b7280;">
                            Aucune commune sélectionnée
                        </p>
                        <p style="margin: 0; font-size: 14px;">
                            Cliquez sur une commune de la carte pour voir ses informations
                        </p>
                    </div>
                `;
                sidebar.insertAdjacentHTML('beforeend', emptyHTML);
            }
        }, 300);
    }
}
