// 1. IMPORTATION DES MODULES
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// 2. CONFIGURATION DES CHEMINS
// On simplifie pour être sûr de trouver les fichiers
const csvRentFile = path.join(__dirname, 'Data', 'loyers.csv');
const geojsonInputFile = path.join(__dirname, 'Data', 'communes_crime.geojson');
const finalOutputFile = path.join(__dirname, 'Data', 'communes_crime_loyer.geojson');

const rentData = {};

console.log("Lecture du fichier : " + csvRentFile);

// 4. ÉTAPE 1 : CHARGEMENT DU CSV
fs.createReadStream(csvRentFile)
  .pipe(csv({ separator: ';' })) 
  .on('data', (row) => {
    // On nettoie les noms de colonnes (enlève espaces et met en minuscule)
    const cleanRow = {};
    Object.keys(row).forEach(key => {
      cleanRow[key.trim().toLowerCase()] = row[key];
    });

    // On utilise 'code' et 'prix' en minuscules
    if (cleanRow.code && cleanRow.prix) {
      // Nettoyage du Code (on s'assure qu'il fait 5 caractères)
      const code = cleanRow.code.toString().trim().padStart(5, '0');
      
      // Nettoyage du Prix (on remplace la virgule par un point)
      const prixString = cleanRow.prix.toString().replace(',', '.').trim();
      const prixNombre = parseFloat(prixString);
      
      rentData[code] = prixNombre;
    }
  })
  .on('end', () => {
    const count = Object.keys(rentData).length;
    console.log(`CSV chargé : ${count} communes trouvées.`);
    
    // Petit test pour toi dans la console
    console.log("Test Saint-Pont (03252) :", rentData["03252"]);

    mergeRentToGeoJSON();
  })
  .on('error', (err) => console.error("Erreur lecture CSV:", err.message));

// 5. ÉTAPE 2 : FUSION DANS LE GEOJSON
function mergeRentToGeoJSON() {
  try {
    if (!fs.existsSync(geojsonInputFile)) {
       console.error("Fichier GeoJSON introuvable : " + geojsonInputFile);
       return;
    }

    const geojsonData = JSON.parse(fs.readFileSync(geojsonInputFile, 'utf8'));
    let matchCount = 0;

    geojsonData.features.forEach(feature => {
      const codeCommune = feature.properties.code; 
      
      // On cherche le code dans notre dictionnaire
      if (rentData[codeCommune] !== undefined) {
        feature.properties['loyer'] = rentData[codeCommune];
        matchCount++;
      } else {
        feature.properties['loyer'] = 0;
      }
    });

    fs.writeFileSync(finalOutputFile, JSON.stringify(geojsonData), 'utf8');
    console.log(`Fusion terminée ! ${matchCount} communes mises à jour.`);
    console.log(`Fichier disponible : ${finalOutputFile}`);

  } catch (err) {
    console.error("Erreur lors de la fusion :", err.message);
  }
}