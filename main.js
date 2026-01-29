"use strict";

// ============================================================================
// CONFIG ET GLOBALES
// ============================================================================

const CONFIG = {
  MAP: {
    CENTER: [48.856667, 2.352222],
    ZOOM: 7,
    TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    MAX_ZOOM: 15,
    ATTRIBUTION: "© OpenStreetMap",
  },
  GEOJSON_URL: "./static/data/final.geojson",
  THRESHOLDS: {
    loyer: [10, 15, 20, 25],
    crime: [30, 60, 90, 130],
    vacants: [50, 250, 500, 1000],
    transports: [50, 250, 500, 1000]
  },
  COLORS: {
    valid: ["#fffd7d", "#FD8D3C", "#E31A1C", "#BD0026", "#800026"],
    invalid: "#a5a5a5",
  },
  LEGEND_LABELS: {
    loyer: {
      title: "Loyer (€/m²)",
      ranges: ["< 10", "10-15", "15-20", "20-25", "> 25", "Pas de données"],
    },
    crime: {
      title: "Nb crimes/délits pour 1000 habitants",
      ranges: ["< 30", "30-60", "60-90", "90-130", "> 130", "Pas de données"],
    },
    vacants: {
      title: "Logements vacants",
      ranges: ["< 50", "50-250", "250-500", "500-1000", "> 1k", "Pas de données"],
    },
    transports: {
      title: "Nb arrêts de transports",
      ranges: ["< 50", "50-250", "250-500", "500-1000", "> 1k", "Pas de données"],
    },
  },
  AUTOCOMPLETE_MAX_RESULTS: 16,
  FIELD_MAPPINGS: {
    loyer: "loyer",
    crime: "taux_pour_mille_2024",
    vacants: "vacants",
    transports: "Transports 2025"
  },
};

let markers = [];
let activeLayerField = "loyer";
let geojsonLayer = null;
let filters = {
  loyer: 30,
  crime: 1000,
  vacants: 100000,
  transports: 100000
};
let isMapMoving = false;  


// ============================================================================
// POINT D'ENTRÉE
// ============================================================================

window.onload = async () => {
  const map = initMap();
  const geojsonData = await loadGeoJson(CONFIG.GEOJSON_URL);
  
  if (!geojsonData) return;

  const communesIndex = buildCommunesIndex(geojsonData);
  geojsonLayer = createGeoJsonLayer(geojsonData, map);
  
  setupSearchAutocomplete(communesIndex, map);
  setupLayerSwitching();
  setupFilters();
  setupFiltersButton();
  updateLegend();
};

// ============================================================================
// INITIALISATION CARTE
// ============================================================================

function initMap() {
  const map = L.map("map", {
    center: CONFIG.MAP.CENTER,
    zoom: CONFIG.MAP.ZOOM,
  });

  L.tileLayer(CONFIG.MAP.TILE_URL, {
    maxZoom: CONFIG.MAP.MAX_ZOOM,
    attribution: CONFIG.MAP.ATTRIBUTION,
  }).addTo(map);

  return map;
}

// ============================================================================
// CHARGEMENT DES DONNÉES
// ============================================================================

async function loadGeoJson(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Erreur lors du chargement du GeoJSON:", error);
    return null;
  }
}

// ============================================================================
// INDEX DES COMMUNES POUR L'AUTOCOMPLETE
// ============================================================================

function buildCommunesIndex(geojsonData) {
  const index = {};
  geojsonData.features.forEach((feature) => {
    const props = feature.properties || {};
    const nom = (props.nom || "Inconnu").toLowerCase();
    index[nom] = { props, feature };
  });
  return index;
}

// ============================================================================
// GESTION DES SEUILS ET COULEURS
// ============================================================================

function getColor(value) {
  const thresholds = CONFIG.THRESHOLDS[activeLayerField] || [];
  const colors = CONFIG.COLORS.valid;

  if (!value || isNaN(value)) return CONFIG.COLORS.invalid;
  if (value <= thresholds[0]) return colors[0];
  if (value <= thresholds[1]) return colors[1];
  if (value <= thresholds[2]) return colors[2];
  if (value <= thresholds[3]) return colors[3];
  return colors[4];
}

function getActiveFieldValue(props) {
  const fieldKey = CONFIG.FIELD_MAPPINGS[activeLayerField];
  return fieldKey ? props[fieldKey] : null;
}

// ============================================================================
// FILTRES
// ============================================================================

function passesFilters(props) {
  const loyer = props.loyer;
  const crime = props.taux_pour_mille_2024;
  const vacants = props.vacants;
  const transports = props["Transports 2025"];

  // Si la valeur est null/undefined, on laisse passer (sera gris dans getColor)
  // Sinon on vérifie qu'elle respecte le filtre
  const passesLoyerFilter = loyer == null || loyer <= filters.loyer;
  const passesCrimeFilter = crime == null || crime <= filters.crime;
  const passesVacantsFilter = vacants == null || vacants <= filters.vacants;
  const transportsFilter = transports == null || transports <= filters.transports;

  return passesLoyerFilter && passesCrimeFilter && passesVacantsFilter && transportsFilter;
}

// ============================================================================
// STYLE ET INTERACTIONS DES FEATURES
// ============================================================================

function styleFeature(feature) {
  const props = feature.properties || {};
  const value = getActiveFieldValue(props);

  // Si la commune ne passe pas les filtres, on la rend invisible
  if (!passesFilters(props)) {
    return {
      fillColor: "transparent",
      color: "transparent",
      weight: 0,
      fillOpacity: 0,
    };
  }

  return {
    fillColor: getColor(value),
    weight: 1,
    opacity: 1,
    color: "#555",
    fillOpacity: 0.7,
  };
}

function createTooltipContent(props) {
  const nomCommune = props.nom || "Nom inconnu";
  const loyer = props.loyer ?? "N/A";
  const tauxCriminalite = props.taux_pour_mille_2024 ?? "N/A";
  const vacants = props.vacants ?? "N/A";
  const transports = props["Transports 2025"];
  return `
<strong>${nomCommune}</strong><br/>
Loyer : ${loyer} €/m²<br/>
Taux criminalité : ${tauxCriminalite}<br/>
Logements vacants : ${vacants}<br/>
Nombre d'arrêt de transport : ${transports}
  `.trim();
}

function handleMouseOver(e, layer) {
  const props = layer.feature.properties || {};
  if (!passesFilters(props) || isMapMoving) return; // Pas de tooltip si filtré

  const target = e.target;
  target.setStyle({
    weight: 3,
    color: "#fff",
    fillOpacity: 0.9,
  });
  target.bringToFront();
  target
    .bindTooltip(createTooltipContent(props), { sticky: true })
    .openTooltip();
}

function handleMouseOut(e) {
  const target = e.target;
  geojsonLayer.resetStyle(target);  // Déjà bon
  target.closeTooltip();
  target.unbindTooltip();
}

function handleMoveEnd() {
  geojsonLayer.eachLayer(layer => {
    if (layer.closeTooltip) layer.closeTooltip();
    if (layer.unbindTooltip) layer.unbindTooltip(); 
    geojsonLayer.resetStyle(layer);
  });
  // SUpprime tous les tooltips orphelins directement depuis le DOM (bug Leaflet)
  setTimeout(() => {
    document.querySelectorAll('.leaflet-tooltip').forEach(el => el.remove());
  }, 50);
}

function handleClick(e, map, feature) {
  const props = feature.properties || {};
  if (!passesFilters(props)) return; // Pas de clic si filtré

  const existingMarker = markers.find((m) => m.code === props.code);
  if (existingMarker) return;

  addMarker(e.target.getBounds(), map, props.code);
  console.log(props);
  
  addCommuneCard(props);
}

function onEachCommuneFactory(map) {
  return function onEachCommune(feature, layer) {
    layer.on({
      mouseover: (e) => handleMouseOver(e, layer),
      mouseout: (e) => handleMouseOut(e),
      click: (e) => handleClick(e, map, feature),
    });
  };
}

// ============================================================================
// CRÉATION DU CALQUE GEOJSON
// ============================================================================

function createGeoJsonLayer(geojsonData, map) {
  const layer = L.geoJSON(geojsonData, {
    style: styleFeature,
    onEachFeature: onEachCommuneFactory(map),
  });

  layer.addTo(map);
  map.on('movestart', () => { isMapMoving = true; });
  map.on('moveend zoomend', () => { 
    isMapMoving = false; 
    handleMoveEnd();  // Reset styles/tooltips
  });  return layer;
}

// ============================================================================
// LÉGENDE
// ============================================================================

function updateLegend() {
  const legendDiv = document.getElementById("legend");
  if (!legendDiv) return;

  const legendConfig = CONFIG.LEGEND_LABELS[activeLayerField];
  let colors = CONFIG.COLORS.valid;
  colors.push(CONFIG.COLORS.invalid);

  let html = `<h4 class="legend-title">${legendConfig.title}</h4>`;

  legendConfig.ranges.forEach((label, i) => {
    html += `
      <div class="legent-content">
        <div style="background: ${colors[i]};" class="legent-color"></div>
        <span class="legent-span">${label}</span>
      </div>
    `;
  });

  legendDiv.innerHTML = html;
  legendDiv.style.display = "block";
}

// ============================================================================
// CARTES / FICHES COMMUNES
// ============================================================================

function addCommuneCard(properties) {
  const sidebar = document.querySelector(".cards-container");
  if (!sidebar) return;

  // Supprimer le message d'information s'il existe
  const emptyMessage = sidebar.querySelector(".empty-message");
  if (emptyMessage) {
    emptyMessage.remove();
  }

  const cardId = properties.code;
  const nom = properties.nom || "Nom inconnu";
  const insee = properties.code || "N/A";
  const loyer = properties.loyer || "N/A";
  const tauxCriminalite = properties.taux_pour_mille_2024 || "N/A";
  const vacants = properties.vacants || "N/A";
  const transports = properties["Transports 2025"] || "N/A";
  const cardHTML = `
    <div class="commune-card" data-card-id="${cardId}">
      <h3 class="commune-card-title">${nom}</h3>
      <p class="commune-card-data"><strong>INSEE</strong> ${insee}</p>
      <p class="commune-card-data"><strong>Loyer</strong> <span class="value-loyer">${loyer} m²</span> </p>
      <p class="commune-card-data"><strong>Taux criminalité</strong> <span class="value-crime">${tauxCriminalite}</span></p>
      <p class="commune-card-data"><strong>Logements vacants</strong> <span class="value-vacants">${vacants}</span></p>
      <p class="commune-card-data"><strong>Nb arrêt de transport</strong> <span class="value-transports">${transports}</span></p>
      <button class="remove-card-button" onclick="removeCard('${cardId}')">Retirer</button>
    </div>
  `;


  sidebar.insertAdjacentHTML("beforeend", cardHTML);
  highlightMinMaxValues();

}

function removeCard(cardId) {
  const card = document.querySelector(`[data-card-id="${cardId}"]`);
  if (card) card.remove();

  const markerIndex = markers.findIndex((m) => m.code == cardId);
  if (markerIndex !== -1) {
    markers[markerIndex].remove();
    markers.splice(markerIndex, 1);
  }
  highlightMinMaxValues();


  const sidebar = document.querySelector(".cards-container");
  if (sidebar && !sidebar.querySelector(".commune-card")) {
    sidebar.innerHTML = `
      <div class="empty-message">
        <p class="empty-message-emoji">🗺️</p>
        <p class="empty-message-title">
          Aucune commune sélectionnée
        </p>
        <p class="empty-message-subtitle">
          Cliquez sur une commune de la carte pour voir ses informations
        </p>
      </div>
    `;
  }
}

function highlightMinMaxValues() {
  const cards = document.querySelectorAll('.commune-card');
  if (cards.length < 2) return;

  const fields = [
    { selector: '.value-loyer',    parse: parseFloat },
    { selector: '.value-crime',    parse: parseFloat },
    { selector: '.value-vacants',  parse: parseFloat },
    // Pour transports : on inverse min/max
    { selector: '.value-transports', parse: parseFloat, invert: true }
  ];

  fields.forEach(field => {
    const elements = Array.from(document.querySelectorAll(field.selector));
    if (!elements.length) return;

    // reset classes
    elements.forEach(el => {
      el.classList.remove('value-min', 'value-max');
    });

    const values = elements
      .map(el => field.parse(el.textContent.replace(/\s/g, '').replace(',', '.'))) // Transforme la valeur dans le span en number
      .filter(v => !isNaN(v));

    if (values.length === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);

    elements.forEach(el => {
      const v = field.parse(el.textContent.replace(/\s/g, '').replace(',', '.'));
      if (isNaN(v)) return;
      
      if (field.invert) {
        // Pour transports : vert = max, rouge = min
        if (v === max) el.classList.add('value-min'); 
        if (v === min) el.classList.add('value-max'); 
      } else {
        // Pour les autres : vert = min, rouge = max
        if (v === min) el.classList.add('value-min');
        if (v === max) el.classList.add('value-max');
      }
    });
  });
}



function addMarker(bounds, map, code){
    const center = bounds.getCenter();

    const marker = L.marker([center.lat, center.lng]).addTo(map);
    marker.code = code;
    markers.push(marker);
}

// ============================================================================
// AUTOCOMPLETE RECHERCHE COMMUNE
// ============================================================================

// Configure l'autocomplete de recherche de communes
function setupSearchAutocomplete(communesIndex, map) {
  const searchInput = document.getElementById("searchInput");
  const autocompleteList = document.getElementById("autocompleteList");

  if (!searchInput || !autocompleteList) return;

  // Index de l'élément sélectionné par les flèches (aucun par défaut)
  let selectedIndex = -1;

  // 1. Recherche les communes correspondant à la saisie
  function getMatches(query) {
    const lowerQuery = query.toLowerCase();
    return Object.keys(communesIndex)
      // Filtre les noms contenant la requête
      .filter((nom) => nom.includes(lowerQuery))
      .slice(0, CONFIG.AUTOCOMPLETEMAXRESULTS)
      // Retourne l'objet complet {props, feature}
      .map((nom) => communesIndex[nom]);
  }

  // 2. Affiche la liste déroulante avec les résultats
  function renderAutocompleteList(matches) {
    if (!matches.length) {
      autocompleteList.style.display = "none"; // Cache si vide
      return;
    }

    // Génère le HTML des <li> avec map()
    autocompleteList.innerHTML = matches
      .map((item, i) => {
        const { props } = item;
        const nom = props.nom || "Commune inconnue";
        const insee = props.code || "N/A";
        return `
          <li class="autocomplete-item" data-index="${i}">
            <strong>${nom}</strong><br/>
            INSEE : ${insee}
          </li>
        `;
      })
      .join(""); // Concatène sans virgules

    autocompleteList.style.display = "block"; // Affiche la liste
  }

  // 3. Surligne l'élément sélectionné (flèches clavier)
  function focusMatch(index) {
    const items = autocompleteList.querySelectorAll(".autocomplete-item");
    items.forEach((item, i) => {
      item.classList.toggle("selected", i === index); // Surligne seulement l'actif
    });
  }

  // 4. Sélectionne une commune (Enter ou clic)
  function selectMatch(index) {
    const matches = getMatches(searchInput.value);
    const match = matches[index];
    if (!match) return;

    const props = match.props;
    const feature = match.feature;

    console.log(props);
    

    // Vérifie si la commune respecte les filtres actuels
    if (!passesFilters(props)) {
      alert("Cette commune ne correspond pas aux filtres actuels");
      autocompleteList.style.display = "none";
      searchInput.value = "";
      return;
    }

    // Évite les doublons (vérifie les markers existants)
    const existingMarker = markers.find((m) => m.code === props.code);
    if (!existingMarker) {
      // Ajoute marker + card seulement si nouvelle commune
      addMarker(L.geoJSON(feature).getBounds(), map, props.code);
      addCommuneCard(props);
    }

    // Zoom sur la commune
    zoomOnCommuneFeature(feature, map);
    
    // Reset UI
    autocompleteList.style.display = "none";
    searchInput.value = "";
    searchInput.blur();
  }

  // 5. Écoute la saisie (mise à jour live de la liste)
  searchInput.addEventListener("input", () => {
    const query = searchInput.value;
    selectedIndex = -1; // Reset sélection

    if (query.length < 2) { // Active après 2 caractères
      autocompleteList.style.display = "none";
      return;
    }

    const matches = getMatches(query);
    renderAutocompleteList(matches);
  });

  // 6. Navigation clavier (flèches + Enter/Escape)
  searchInput.addEventListener("keydown", (e) => {
    const matches = getMatches(searchInput.value);
    const maxIndex = matches.length - 1;

    if (!matches.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault(); // Empêche curseur input
      selectedIndex = selectedIndex < maxIndex ? selectedIndex + 1 : 0; // Boucle
      focusMatch(selectedIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : maxIndex; // Boucle
      focusMatch(selectedIndex);
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0) {
        selectMatch(selectedIndex);
      }
    } else if (e.key === "Escape") {
      autocompleteList.style.display = "none";
    }
  });

  // 7. Clic sur un élément de la liste
  autocompleteList.addEventListener("click", (e) => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;
    const index = Number(item.dataset.index);
    selectMatch(index);
  });

  // 8. Ferme la liste en cliquant ailleurs
  document.addEventListener("click", (e) => {
    if (!autocompleteList.contains(e.target) && e.target !== searchInput) {
      autocompleteList.style.display = "none";
    }
  });
}


function zoomOnCommuneFeature(feature, map) {
  const layer = L.geoJSON(feature);
  const bounds = layer.getBounds();
  map.fitBounds(bounds);
}

// ============================================================================
// CHANGEMENT DE COUCHE
// ============================================================================

function setupLayerSwitching() {
  const layerSelect = document.getElementById("layerSelect");
  if (!layerSelect) return;

  layerSelect.addEventListener("change", (e) => {
    activeLayerField = e.target.value;
    geojsonLayer.setStyle(styleFeature);
    updateLegend();
  });
}

// ============================================================================
// SETUP DES FILTRES
// ============================================================================

function setupFilters() {
  const filtersConfig = [
    { slider: 'loyerSlider', value: 'loyerValue', key: 'loyer', min: 0, max: 30, step: 1 },
    { slider: 'crimeSlider', value: 'crimeValue', key: 'crime', min: 0, max: 1000, step: 5 },
    { slider: 'vacantsSlider', value: 'vacantsValue', key: 'vacants', min: 0, max: 100000, step: 100 },
    { slider: 'transportsSlider', value: 'transportsValue', key: 'transports', min: 0, max: 100000, step: 5 }
  ];

  filtersConfig.forEach(({ slider, value, key, min, max }) => {
    const sliderEl = document.getElementById(slider);
    const valueEl = document.getElementById(value);

    if (!sliderEl || !valueEl) return;

    // Fonction sync bidirectionnelle
    const sync = (val) => {
      const clamped = Math.max(min, Math.min(max, Number(val) || min));
      sliderEl.value = clamped;
      valueEl.value = clamped;
      filters[key] = clamped;
      geojsonLayer.setStyle(styleFeature);
    };

    // Slider → number input
    sliderEl.addEventListener('input', () => sync(sliderEl.value));

    // Number input → slider (flèches + saisie)
    valueEl.addEventListener('input', () => sync(valueEl.value));
  });

  // Reset
  const resetBtn = document.getElementById('resetFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Reset valeurs globales
      filters = { loyer: 30, crime: 1000, vacants: 100000, transports: 100000 };
      
      // Reset sliders
      document.getElementById('loyerSlider').value = 30;
      document.getElementById('crimeSlider').value = 1000;
      document.getElementById('vacantsSlider').value = 100000;
      document.getElementById('transportsSlider').value = 100000;
      
      // Reset inputs number
      document.getElementById('loyerValue').value = 30;
      document.getElementById('crimeValue').value = 1000;
      document.getElementById('vacantsValue').value = 100000;
      document.getElementById('transportsValue').value = 100000;
      
      // Reset calque + légende
      const layerSelect = document.getElementById('layerSelect');
      layerSelect.value = 'loyer';
      activeLayerField = 'loyer';
      geojsonLayer.setStyle(styleFeature);
      updateLegend();
    });
  }

}



function setupFiltersButton() {
  const toggleBtn = document.getElementById('toggleFilters');
  const filtersPanel = document.querySelector('.filters-panel');
  
  if (!toggleBtn || !filtersPanel) return;

  let isVisible = true; // visible par défaut

  toggleBtn.addEventListener('click', () => {
    isVisible = !isVisible;
    
    if (isVisible) {
      filtersPanel.classList.remove('hidden');
      toggleBtn.classList.remove('active');
      toggleBtn.querySelector('.toggle-icon').textContent = '▼';
    } else {
      filtersPanel.classList.add('hidden');
      toggleBtn.classList.add('active');
      toggleBtn.querySelector('.toggle-icon').textContent = '▲';
    }
  });
}

