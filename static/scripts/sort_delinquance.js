// 1. IMPORTATION DES BIBLIOTHÈQUES
const fs = require('fs'); // Module pour manipuler les fichiers (lecture/écriture)
const csv = require('csv-parser'); // Module pour transformer le texte CSV en objets JavaScript
const path = require('path'); // Module pour gérer les chemins de fichiers de façon universelle

// 2. CONFIGURATION DES CHEMINS
// path.join permet de construire une adresse de fichier propre
// __dirname représente le dossier où se trouve le script actuel
const inputFile = path.join(__dirname, 'delinquance.csv'); 
const outputFile = path.join(__dirname, 'resultat_agregation.csv');

// 3. INITIALISATION DU STOCKAGE
// On utilise un objet vide {} pour stocker les résultats.
// Il servira de dictionnaire pour regrouper les données par ville et par année.
const results = {};

console.log(`Lecture du fichier : ${inputFile}...`);

// 4. LECTURE DU FICHIER EN FLUX (STREAMING)
// On lit le fichier morceau par morceau pour ne pas surcharger la mémoire vive.
fs.createReadStream(inputFile)
  .pipe(csv({ separator: ';' })) // On indique que le séparateur dans le fichier est le point-virgule
  .on('data', (row) => {
    // On extrait les valeurs de la ligne actuelle (row)
    const codgeo = row.CODGEO_2025;
    const annee = row.annee;
    
    // parseFloat transforme le texte en nombre décimal (ex: "1.5" -> 1.5)
    const nombre = parseFloat(row.nombre);
    const pop = parseFloat(row.insee_pop);

    // LOGIQUE DE FILTRAGE :
    // 1. On ignore la ligne si la colonne 'nombre' ne contient pas un chiffre valide (NaN)
    if (isNaN(nombre)) return;

    // CRÉATION D'UNE CLÉ UNIQUE :
    // On combine le code géo et l'année pour créer un identifiant (ex: "01001_2024")
    const key = `${codgeo}_${annee}`;

    // INITIALISATION DU GROUPE :
    // Si cette clé n'existe pas encore dans notre objet 'results', on crée l'entrée
    if (!results[key]) {
      results[key] = {
        CODGEO_2025: codgeo,
        annee: annee,
        somme_nombre: 0,
        // Si la population n'est pas un chiffre, on met 0 par sécurité
        insee_pop: isNaN(pop) ? 0 : pop
      };
    }

    // ACCUMULATION :
    // On ajoute la valeur de la ligne actuelle à la somme totale pour ce groupe
    results[key].somme_nombre += nombre;
  })
  .on('end', () => {
    // Cette partie s'exécute quand tout le fichier a été lu
    const finalData = [];

    // On parcourt chaque groupe stocké dans notre dictionnaire 'results'
    for (const key in results) {
      const item = results[key];
      
      // CALCUL DU TAUX POUR MILLE :
      // Formule : (Total des crimes / Population) * 1000
      let taux = 0;
      if (item.insee_pop > 0) {
        taux = (item.somme_nombre / item.insee_pop) * 1000;
      }

      // On ajoute l'objet finalisé dans le tableau 'finalData'
      finalData.push({
        CODGEO_2025: item.CODGEO_2025,
        annee: item.annee,
        // toFixed(x) limite le nombre de chiffres après la virgule
        somme_nombre: item.somme_nombre.toFixed(2),
        taux_pour_mille: taux.toFixed(4)
      });
    }

    // On appelle la fonction pour écrire le résultat dans un nouveau CSV
    writeToCSV(finalData);
  })
  .on('error', (err) => {
    // En cas de problème de lecture (fichier manquant, etc.)
    console.error("Erreur lors de la lecture du fichier :", err.message);
  });

// 5. FONCTION D'ÉCRITURE DU RÉSULTAT
function writeToCSV(data) {
  // Sécurité : on vérifie s'il y a des données à écrire
  if (data.length === 0) {
    console.log("Aucune donnée valide trouvée (vérifiez le séparateur ou les noms de colonnes).");
    return;
  }

  // On crée l'en-tête du fichier à partir des clés du premier objet
  const header = Object.keys(data[0]).join(',');
  
  // On transforme chaque objet en une ligne de texte séparée par des virgules
  const rows = data.map(row => Object.values(row).join(','));
  
  // On assemble le tout avec des retours à la ligne
  const csvContent = [header, ...rows].join('\n');

  try {
    // On enregistre le fichier sur le disque
    fs.writeFileSync(outputFile, csvContent, 'utf8');
    console.log(`\nSuccès !`);
    console.log(`Fichier créé : ${outputFile}`);
    console.log(`Nombre de lignes agrégées : ${data.length}`);
  } catch (err) {
    console.error("Erreur lors de l'écriture du fichier :", err.message);
  }
}