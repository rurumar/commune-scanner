const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const csvFile = path.join(__dirname, '/Data/resultat_agregation.csv');
const geojsonFile = path.join(__dirname, '/Data/communes.geojson'); // Vérifiez le nom de votre fichier
const outputFile = path.join(__dirname, '/Data/communes_crime.geojson');

const crimeData = {};

// 1. Charger le CSV en mémoire
console.log("Chargement des données CSV...");
fs.createReadStream(csvFile)
  .pipe(csv())
  .on('data', (row) => {
    const code = row.CODGEO_2025;
    const annee = row.annee;

    if (!crimeData[code]) {
      crimeData[code] = {};
    }

    // On stocke les données par année pour ce code géo
    crimeData[code][annee] = {
      total: row.somme_nombre,
      taux: row.taux_pour_mille
    };
  })
  .on('end', () => {
    console.log("CSV chargé. Fusion avec le GeoJSON...");
    mergeGeoJSON();
  });

// 2. Fusionner avec le GeoJSON
function mergeGeoJSON() {
  try {
    const geojsonData = JSON.parse(fs.readFileSync(geojsonFile, 'utf8'));

    geojsonData.features.forEach(feature => {
      const codeCommune = feature.properties.code; // La clé dans votre GeoJSON

      if (crimeData[codeCommune]) {
        // Pour chaque année trouvée dans le CSV pour cette commune
        Object.keys(crimeData[codeCommune]).forEach(annee => {
          const data = crimeData[codeCommune][annee];
          
          // Ajout des propriétés demandées avec le suffixe de l'année
          feature.properties[`total_crime_${annee}`] = parseFloat(data.total);
          feature.properties[`taux_pour_mille_${annee}`] = parseFloat(data.taux);
        });
      }
    });

    // 3. Écrire le nouveau fichier
    fs.writeFileSync(outputFile, JSON.stringify(geojsonData), 'utf8');
    console.log(`\nFusion terminée !`);
    console.log(`Fichier généré : ${outputFile}`);

  } catch (err) {
    console.error("Erreur lors de la lecture ou de l'écriture du GeoJSON :", err.message);
  }
}