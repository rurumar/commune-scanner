"use strict";

let markers = [];
let activeLayerField = "loyer"; // loyer | vrime | vacants

window.onload = async () => {
    let map = L.map("map", {
        center: [48.856667, 2.352222],
        zoom: 8,
    });

    let layer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 15,
            attribution: '© OpenStreetMap',
        }
    );
    layer.addTo(map);


    fetch("./static/data/Final.geojson")
        .then(response => response.json())
        .then(geojsonData => {

        function getColor(value) {
        // Seuils adaptés au calque actif
        let thresholds;
        if (activeLayerField === "loyer") {
            thresholds = [10, 15, 20, 25]; // €/m²
        } else if (activeLayerField === "crime") {
            thresholds = [30, 60, 90, 130]; // crimes/1000 hab
        } else if (activeLayerField === "vacants") {
            thresholds = [5000, 15000, 25000, 40000]; // nb vacants
        }

        if (!value || isNaN(value)) return "#a5a5a5";
        if (value <= thresholds[0]) return "#fffd7d"; // vert clair
        if (value <= thresholds[1]) return "#FD8D3C"; // orange
        if (value <= thresholds[2]) return "#E31A1C"; // rouge
        if (value <= thresholds[3]) return "#BD0026"; // rouge foncé
        return "#800026"; // très rouge
        }

        function styleFeature(feature) {
            const props = feature.properties;
            let value;

            if (activeLayerField === "loyer") {
                value = props.loyer;
            } else if (activeLayerField === "crime") {
                value = props.taux_pour_mille_2024;
            } else if (activeLayerField === "vacants") {
                value = props.vacants;
            }

            return {
                fillColor: getColor(value),
                weight: 1,
                opacity: 1,
                color: "#555",
                fillOpacity: 0.7,
            };
        }

        function onEachCommune(feature, layer) {
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

                        const communeMarker = markers.find(m => m.code == props.code);
                        if (!communeMarker){
                            console.log(communeMarker);
                            
                            const bounds = l.getBounds();
                            const center = bounds.getCenter();
                            
                            const marker = L.marker([center.lat, center.lng]).addTo(map);
                            marker.code = props.code; 
                            markers.push(marker);

                            addCommuneCard(props);
                        }    
                    }
                });
        }

        let communesIndex = {}; // {nom: {props, layer}}
        let searchInput, autocompleteList, selectedIndex = -1;

        // Index des communes pour recherche rapide
        geojsonData.features.forEach(feature => {
            const nom = feature.properties.nom || 'Inconnu';
            communesIndex[nom.toLowerCase()] = { props: feature.properties, feature };
        });

        // Autocomplete
        searchInput = document.getElementById('searchInput');
        autocompleteList = document.getElementById('autocompleteList');

        searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        selectedIndex = -1;
        
        if (query.length < 2) {
            autocompleteList.style.display = 'none';
            return;
        }

        const matches = Object.keys(communesIndex)
            .filter(nom => nom.includes(query))
            .slice(0, 8) // max 8 résultats
            .map(nom => communesIndex[nom]);

        autocompleteList.innerHTML = matches.map((item, i) => 
            `<div class="autocomplete-item" data-index="${i}">${item.props.nom}</div>`
        ).join('');

        autocompleteList.style.display = matches.length ? 'block' : 'none';
        
        // Clic sur résultat
        autocompleteList.querySelectorAll('.autocomplete-item').forEach((item, i) => {
            item.addEventListener('click', () => selectCommune(matches[i]));
            item.addEventListener('mouseenter', () => {
            autocompleteList.querySelector('.selected')?.classList.remove('selected');
            item.classList.add('selected');
            selectedIndex = i;
            });
        });
        });

        // Navigation clavier
        searchInput.addEventListener('keydown', (e) => {
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            const matches = Array.from(autocompleteList.querySelectorAll('.autocomplete-item'))
            .map((item, i) => communesIndex[item.textContent.toLowerCase()]);
            selectCommune(matches[selectedIndex]);
        } else if (e.key === 'Escape') {
            autocompleteList.style.display = 'none';
        }
        });

        function updateSelection(items) {
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === selectedIndex);
        });
        }

        function selectCommune(data) {
        searchInput.value = data.props.nom;
        autocompleteList.style.display = 'none';
        
        // Ajoute marker + card (comme le clic sur carte)
        const bounds = geojsonLayer.getLayers()
            .find(layer => layer.feature?.properties?.code === data.props.code)
            ?.getBounds();
        
        if (bounds) {
            const center = bounds.getCenter();
            const communeMarker = markers.find(m => m.code == cardId);
            if(!communeMarker){
                const marker = L.marker([center.lat, center.lng]).addTo(map);
                
                marker.code = data.props.code;
                markers.push(marker);
                addCommuneCard(data.props);
            }
            // Zoom sur la commune
            map.fitBounds(bounds, { padding: [20, 20] });

        }
        
        }

            const geojsonLayer = L.geoJSON(geojsonData, {
                style: styleFeature,
                onEachFeature: onEachCommune
            }).addTo(map);

            updateLegend();


            const layerSelect = document.getElementById("layerSelect");
            layerSelect.addEventListener("change", () => {
                const value = layerSelect.value;
                if (value === "loyer") activeLayerField = "loyer";
                if (value === "crime") activeLayerField = "crime";
                if (value === "vacants") activeLayerField = "vacants";
                geojsonLayer.setStyle(styleFeature);
                updateLegend();

            });

            const vacantsSlider = document.getElementById("vacantsSlider");
            const vacantsValue = document.getElementById("vacantsValue");

            vacantsSlider.addEventListener("input", () => {
                vacantsValue.textContent = vacantsSlider.value;
                applyFilters();
            });

            const loyerSlider = document.getElementById("loyerSlider");
            const loyerValue = document.getElementById("loyerValue");

            loyerSlider.addEventListener("input", () => {
                loyerValue.textContent = loyerSlider.value;
                applyFilters();
            });

            const crimeSlider = document.getElementById("crimeSlider");
            const crimeValue = document.getElementById("crimeValue");

            crimeSlider.addEventListener("input", () => {
                crimeValue.textContent = crimeSlider.value;
                applyFilters();
            });

            function applyFilters() {
                const maxLoyer = Number(document.getElementById("loyerSlider").value);
                const maxCrime = Number(document.getElementById("crimeSlider").value);
                const maxVacants = Number(document.getElementById("vacantsSlider").value);

                geojsonLayer.eachLayer(layer => {
                    const p = layer.feature.properties;
                    
                    // null/undefined → OK pour les sliders max
                    const loyerOk = !p.loyer || p.loyer <= maxLoyer;
                    const crimeOk = !p.taux_pour_mille_2024 || p.taux_pour_mille_2024 <= maxCrime;
                    const vacantsOk = !p.vacants || p.vacants <= maxVacants;
                    
                    // vacantsOnly : true seulement si vacants existe ET > 0, sinon OK
                    const vacantsOnlyOk = !p.vacants || p.vacants > 0;

                    const visible = loyerOk && crimeOk && vacantsOk && vacantsOnlyOk;
                    
                    if (visible) {
                        layer.addTo(map);
                    } else {
                        map.removeLayer(layer);
                    }
                });


            }


        });
};


// Fonction pour ajouter une carte de commune dans la sidebar
function addCommuneCard(properties) {
    const sidebar = document.querySelector('.cards-container');
    
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
        <div class="commune-card" id="${cardId}">
            <div class="header-card">
                <p class="commune-title">Commune</p>
                <button class="delete-btn" onclick="deleteCard(${cardId})" title="Supprimer cette commune">
                ✕
                </button>
            </div>
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
    const sidebar = document.querySelector('.cards-container');
    
    if (card) {

        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(-20px)';

        card.remove();

        const communeMarker = markers.find(m => m.code == cardId);
        
        if (communeMarker) {
            communeMarker.remove(map);
            markers = markers.filter(m => m.code != cardId);
        }
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
}
}

function updateLegend() {
    let legendDiv = document.getElementById('legend');

  const thresholds = activeLayerField === "loyer" ? [10, 15, 20, 25] :
                    activeLayerField === "crime" ? [30, 60, 90, 130] :
                    [5000, 15000, 25000, 40000];

  const labels = [`< ${thresholds[0]}`];
  for (let i = 0; i < thresholds.length - 1; i++) {
    labels.push(`${thresholds[i]} - ${thresholds[i+1]}`);
  }
  labels.push(`> ${thresholds[thresholds.length-1]}`);

  const colors = ["#fffd7d", "#FD8D3C", "#E31A1C", "#BD0026", "#800026"];

  const title = activeLayerField === "loyer" ? "Loyer (€/m²)" : 
                activeLayerField === "crime" ? "Crimes/1000 hab" : "Vacants";

  let html = `<div class="legend-title">${title}</div>`;
  for (let i = 0; i < colors.length; i++) {
    html += `<div class="legend-item">
      <div class="legend-color" style="background-color: ${colors[i]}"></div>
      ${labels[i]}
    </div>`;
  }

  console.log(legendDiv);
  
  legendDiv.innerHTML = html;
  legendDiv.style.display = 'block';
}

