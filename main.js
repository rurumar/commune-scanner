"use strict";

// ============================================================================
// CONFIG ET GLOBALES
// ============================================================================

const CONFIG = {
  MAP: {
    CENTER: [48.856667, 2.352222],
    ZOOM: 8,
    TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    MAX_ZOOM: 15,
    ATTRIBUTION: "© OpenStreetMap",
  },
  GEOJSON_URL: "./static/data/Final.geojson",
  THRESHOLDS: {
    loyer: [10, 15, 20, 25],
    crime: [30, 60, 90, 130],
    vacants: [5000, 15000, 25000, 40000],
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
      title: "Nb crimes pour 1000 habitants",
      ranges: ["< 30", "30-60", "60-90", "90-130", "> 130", "Pas de données"],
    },
    vacants: {
      title: "Logements vacants",
      ranges: ["< 5k", "5k-15k", "15k-25k", "25k-40k", "> 40k", "Pas de données"],
    },
  },
  AUTOCOMPLETE_MAX_RESULTS: 8,
  FIELD_MAPPINGS: {
    loyer: "loyer",
    crime: "taux_pour_mille_2024",
    vacants: "vacants",
  },
};

let markers = [];
let activeLayerField = "loyer";
let geojsonLayer = null;
let filters = {
  loyer: 30,
  crime: 1000,
  vacants: 70000,
};

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

  // Si la valeur est null/undefined, on laisse passer (sera gris dans getColor)
  // Sinon on vérifie qu'elle respecte le filtre
  const passesLoyerFilter = loyer == null || loyer <= filters.loyer;
  const passesCrimeFilter = crime == null || crime <= filters.crime;
  const passesVacantsFilter = vacants == null || vacants <= filters.vacants;

  return passesLoyerFilter && passesCrimeFilter && passesVacantsFilter;
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

  return `
<strong>${nomCommune}</strong><br/>
Loyer : ${loyer} €/m²<br/>
Taux criminalité : ${tauxCriminalite}<br/>
Logements vacants : ${vacants}
  `.trim();
}

function handleMouseOver(e, layer) {
  const props = layer.feature.properties || {};
  if (!passesFilters(props)) return; // Pas de tooltip si filtré

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
  geojsonLayer.resetStyle(target);
  if (target.getTooltip()) {
    target.closeTooltip();
    target.unbindTooltip();
  }
}

function handleClick(e, map, feature) {
  const props = feature.properties || {};
  if (!passesFilters(props)) return; // Pas de clic si filtré

  const existingMarker = markers.find((m) => m.code === props.code);
  if (existingMarker) return;

  addMarker(e.target.getBounds(), map, props.code);

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
  return layer;
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

  let html = `<h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">${legendConfig.title}</h4>`;

  legendConfig.ranges.forEach((label, i) => {
    html += `
      <div style="display: flex; align-items: center; margin-bottom: 5px;">
        <div style="width: 20px; height: 20px; background: ${colors[i]}; margin-right: 8px; border-radius: 3px;"></div>
        <span style="font-size: 13px;">${label}</span>
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

  const cardHTML = `
    <div class="commune-card" data-card-id="${cardId}">
      <h3 style="margin: 0 0 12px; font-size: 18px; color: #0175ff">${nom}</h3>
      <p style="margin: 6px 0; color: #4b5563; font-size: 14px">
        <strong>INSEE :</strong> ${insee}
      </p>
      <p style="margin: 6px 0; color: #4b5563; font-size: 14px">
        <strong>Loyer :</strong> ${loyer} €/m²
      </p>
      <p style="margin: 6px 0; color: #4b5563; font-size: 14px">
        <strong>Taux criminalité :</strong> ${tauxCriminalite}
      </p>
      <p style="margin: 6px 0; color: #4b5563; font-size: 14px">
        <strong>Logements vacants :</strong> ${vacants}
      </p>
      <button 
        class="remove-card-btn" 
        onclick="removeCard('${cardId}')"
        style="
          margin-top: 10px;
          padding: 6px 12px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">
        Retirer
      </button>
    </div>
  `;

  sidebar.insertAdjacentHTML("beforeend", cardHTML);
}

function removeCard(cardId) {
  const card = document.querySelector(`[data-card-id="${cardId}"]`);
  if (card) card.remove();

  const markerIndex = markers.findIndex((m) => m.code == cardId);
  if (markerIndex !== -1) {
    markers[markerIndex].remove();
    markers.splice(markerIndex, 1);
  }

  const sidebar = document.querySelector(".cards-container");
  if (sidebar && !sidebar.querySelector(".commune-card")) {
    sidebar.innerHTML = `
      <div class="empty-message" style="text-align: center; padding: 40px 20px; color: #9ca3af; font-size: 15px">
        <p style="font-size: 48px; margin: 0">🗺️</p>
        <p style="margin: 16px 0 8px; font-weight: 600; color: #6b7280">
          Aucune commune sélectionnée
        </p>
        <p style="margin: 0; font-size: 14px">
          Cliquez sur une commune de la carte pour voir ses informations
        </p>
      </div>
    `;
  }
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

function setupSearchAutocomplete(communesIndex, map) {
  const searchInput = document.getElementById("searchInput");
  const autocompleteList = document.getElementById("autocompleteList");

  if (!searchInput || !autocompleteList) return;

  let selectedIndex = -1;

  function getMatches(query) {
    const lowerQuery = query.toLowerCase();
    return Object.keys(communesIndex)
      .filter((nom) => nom.includes(lowerQuery))
      .slice(0, CONFIG.AUTOCOMPLETE_MAX_RESULTS)
      .map((nom) => communesIndex[nom]);
  }

  function renderAutocompleteList(matches) {
    if (!matches.length) {
      autocompleteList.style.display = "none";
      return;
    }

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
      .join("");

    autocompleteList.style.display = "block";
  }

  function focusMatch(index) {
    const items = autocompleteList.querySelectorAll(".autocomplete-item");
    items.forEach((item, i) => {
      item.classList.toggle("selected", i === index);
    });
  }

function selectMatch(index) {
  const matches = getMatches(searchInput.value);
  const match = matches[index];
  if (!match) return;

  const props = match.props;
  const feature = match.feature;

  // Vérifier si la commune passe les filtres
  if (!passesFilters(props)) {
    alert("Cette commune ne correspond pas aux filtres actuels");
    autocompleteList.style.display = "none";
    searchInput.value = "";
    return;
  }

  // Vérifier si un marker existe déjà pour cette commune
  const existingMarker = markers.find((m) => m.code === props.code);
  if (!existingMarker) {
    addMarker(L.geoJSON(feature).getBounds(), map, props.code);

    // Ajouter la carte dans la sidebar
    addCommuneCard(props);
  }

  // Zoomer sur la commune
  zoomOnCommuneFeature(feature, map);
  
  autocompleteList.style.display = "none";
  searchInput.value = "";
  searchInput.blur();
}


  searchInput.addEventListener("input", () => {
    const query = searchInput.value;
    selectedIndex = -1;

    if (query.length < 2) {
      autocompleteList.style.display = "none";
      return;
    }

    const matches = getMatches(query);
    renderAutocompleteList(matches);
  });

  searchInput.addEventListener("keydown", (e) => {
    const matches = getMatches(searchInput.value);
    const maxIndex = matches.length - 1;

    if (!matches.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = selectedIndex < maxIndex ? selectedIndex + 1 : 0;
      focusMatch(selectedIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : maxIndex;
      focusMatch(selectedIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0) {
        selectMatch(selectedIndex);
      }
    } else if (e.key === "Escape") {
      autocompleteList.style.display = "none";
    }
  });

  autocompleteList.addEventListener("click", (e) => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;
    const index = Number(item.dataset.index);
    selectMatch(index);
  });

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
  const loyerSlider = document.getElementById("loyerSlider");
  const loyerValue = document.getElementById("loyerValue");
  const crimeSlider = document.getElementById("crimeSlider");
  const crimeValue = document.getElementById("crimeValue");
  const vacantsSlider = document.getElementById("vacantsSlider");
  const vacantsValue = document.getElementById("vacantsValue");
  const resetBtn = document.getElementById("resetFilters");

  if (loyerSlider && loyerValue) {
    loyerSlider.addEventListener("input", (e) => {
      const value = Number(e.target.value);
      loyerValue.textContent = value;
      filters.loyer = value;
      geojsonLayer.setStyle(styleFeature);
    });
  }

  if (crimeSlider && crimeValue) {
    crimeSlider.addEventListener("input", (e) => {
      const value = Number(e.target.value);
      crimeValue.textContent = value;
      filters.crime = value;
      geojsonLayer.setStyle(styleFeature);
    });
  }

  if (vacantsSlider && vacantsValue) {
    vacantsSlider.addEventListener("input", (e) => {
      const value = Number(e.target.value);
      vacantsValue.textContent = value;
      filters.vacants = value;
      geojsonLayer.setStyle(styleFeature);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      filters = { loyer: 30, crime: 3000, vacants: 70000 };

        if (loyerSlider) loyerSlider.value = 30;
        if (loyerValue) loyerValue.textContent = 30;
        if (crimeSlider) crimeSlider.value = 1000;
        if (crimeValue) crimeValue.textContent = 1000;
        if (vacantsSlider) vacantsSlider.value = 70000;
        if (vacantsValue) vacantsValue.textContent = 70000;

        const layerSelect = document.getElementById("layerSelect");
        layerSelect.value = "loyer";
        activeLayerField = "loyer";
        geojsonLayer.setStyle(styleFeature);
        updateLegend();

    });
  }
}
