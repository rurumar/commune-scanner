const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// 1. CONFIGURATION DES CHEMINS
const inputFile = path.join(__dirname, 'Data', 'logements_vacants.csv');
const outputFile = path.join(__dirname, 'Data', 'logements_vacants_clean.csv');

const results = [];

console.log("Traitement simplifié des logements vacants...");

// 2. LECTURE ET EXTRACTION
fs.createReadStream(inputFile)
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    // Logique de repli (Coalesce) : prend la première année disponible
    let valeur = row.pp_total_24 || row.pp_total_23 || row.pp_total_22 || row.pp_total_21 || row.pp_total_20 || "0";
    
    // Nettoyage du format (virgule -> point pour le JS)
    valeur = valeur.toString().replace(',', '.').trim();

    // On ne garde que les deux colonnes spécifiées
    results.push({
        codgeo: row.CODGEO_25,
        vacants2025: valeur
    });
  })
  .on('end', () => {
    if (results.length === 0) {
        console.error("Erreur : Aucune donnée lue. Vérifie le séparateur ';' du fichier source.");
        return;
    }

    // 3. ÉCRITURE DU CSV FINAL (uniquement 2 colonnes)
    const header = "codgeo;vacants2025";
    const body = results.map(r => `${r.codgeo};${r.vacants2025}`).join('\n');
    
    fs.writeFileSync(outputFile, header + '\n' + body, 'utf8');

    console.log("--- TERMINÉ ---");
    console.log(`Fichier créé : ${outputFile}`);
    console.log(`Colonnes : codgeo, vacants2025`);
    console.log(`Lignes : ${results.length}`);
  });