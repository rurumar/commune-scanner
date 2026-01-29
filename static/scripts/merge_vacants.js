const fs = require('fs');
const csv = require('csv-parser');

// 1. CONFIGURATION DES CHEMINS
const csvVacantsFile = ('static/scripts/logements_vacants_clean.csv');
const geojsonInputFile = ('static/data/old_final.geojson');
const finalOutputFile = ('static/data/final.geojson');

const vacantData = {};

console.log("Étape 1 : Chargement des données de vacances immobilières...");

// 2. CHARGEMENT DU CSV DANS UN DICTIONNAIRE
fs.createReadStream(csvVacantsFile)
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (row.codgeo) {
      // On stocke la valeur numérique (on s'assure que c'est bien un nombre)
      vacantData[row.codgeo] = parseFloat(row.vacants2025) || 0;
    }
  })
  .on('end', () => {
    console.log("Données CSV prêtes. Étape 2 : Fusion avec le GeoJSON...");
    mergeData();
  });

// 3. FUSION DANS LE GEOJSON
function mergeData() {
  try {
    const geojsonData = JSON.parse(fs.readFileSync(geojsonInputFile, 'utf8'));
    let successCount = 0;

    geojsonData.features.forEach(feature => {
      const codeCommune = feature.properties.code; // Le code de la commune (ex: "03252")

      // On injecte la propriété 'vacants'
      // Si le code existe dans le CSV, on met la valeur, sinon 0
      if (vacantData[codeCommune] !== undefined) {
        feature.properties['vacants'] = vacantData[codeCommune];
        successCount++;
      } else {
        feature.properties['vacants'] = 0;
      }
    });

    // 4. SAUVEGARDE DU FICHIER FINAL
    fs.writeFileSync(finalOutputFile, JSON.stringify(geojsonData), 'utf8');

    console.log("--- FUSION FINALE RÉUSSIE ---");
    console.log(`Fichier créé : ${finalOutputFile}`);
    console.log(`${successCount} communes ont reçu leurs données de logements vacants.`);

  } catch (err) {
    console.error("Erreur lors de la fusion finale :", err.message);
  }
}