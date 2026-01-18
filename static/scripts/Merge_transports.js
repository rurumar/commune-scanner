// Importation des modules standards de Node.js pour le système de fichiers et les chemins
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Importation des outils de calcul géospatial de la bibliothèque Turf
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');
const turfBbox = require('@turf/bbox').default;

// Définition des chemins d'accès aux fichiers de données
const pointsFile = path.join(__dirname, '../../old/old/stations.geojson');
const polygonsFile = path.join(__dirname, '../data/old_Final.geojson');
const outputFile = path.join(__dirname, '../data/Final.geojson');

async function run() {
    console.log("Chargement des polygones des communes...");
    
    // Lecture synchrone du fichier des communes (chargé entièrement en mémoire car moins lourd que les stations)
    const communesData = JSON.parse(fs.readFileSync(polygonsFile, 'utf8'));

    // Preparation des communes : initialisation du compteur et calcul des boîtes englobantes (BBox)
    // La BBox est un rectangle simplifié (min/max X et Y) qui entoure le polygone complexe.
    communesData.features.forEach(f => {
        f.properties['Transports 2025'] = 0;
        f.bbox = turfBbox(f); 
    });

    // Utilisation d'une interface de lecture ligne par ligne (Stream)
    // Indispensable pour traiter un fichier de 1.32 Go sans saturer la mémoire RAM
    const rl = readline.createInterface({ 
        input: fs.createReadStream(pointsFile), 
        crlfDelay: Infinity 
    });

    let count = 0; // Compteur de lignes traitées
    let found = 0; // Compteur de correspondances trouvées
    const startTime = Date.now();

    // Boucle asynchrone sur chaque ligne du fichier des stations
    for await (const line of rl) {
        
        // Nettoyage de la chaîne de caractères :
        // 1. .trim() retire les espaces inutiles en début/fin
        // 2. .replace(/^[^{]*/, '') retire tout caractère parasite avant la première accolade '{' (BOM UTF-8, etc.)
        let cleanLine = line.trim().replace(/^[^{]*/, '');
        
        // On ignore les lignes vides ou celles qui ne contiennent pas un objet JSON valide
        if (!cleanLine.startsWith('{')) continue;
        
        // Si le fichier GeoJSON est une liste d'objets séparés par des virgules, on retire la virgule finale
        if (cleanLine.endsWith(',')) cleanLine = cleanLine.slice(0, -1);

        try {
            const station = JSON.parse(cleanLine);
            const coords = station.geometry.coordinates;
            const lng = coords[0];
            const lat = coords[1];

            // Itération sur chaque commune pour vérifier l'appartenance géographique
            for (let commune of communesData.features) {
                const b = commune.bbox;

                // Optimisation algorithmique (Bounding Box Test) :
                // On compare d'abord les coordonnées avec les 4 bords du rectangle simplifié.
                // C'est un test numérique très rapide qui permet d'éliminer 99% des cas inutiles.
                if (lng >= b[0] && lat >= b[1] && lng <= b[2] && lat <= b[3]) {
                    
                    // Si le point est dans la BBox, on effectue le calcul géométrique précis (Point-in-Polygon)
                    if (booleanPointInPolygon(point(coords), commune)) {
                        commune.properties['Transports 2025']++;
                        found++;
                        break; // Une station ne peut appartenir qu'à une seule commune
                    }
                }
            }
        } catch (e) {
            // En cas d'erreur de parsing JSON sur une ligne, on passe à la suivante
        }

        count++;
        // Affichage de la progression tous les 20 000 points
        if (count % 20000 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            process.stdout.write(`\rStations traitees : ${count} | Trouvees : ${found} | Vitesse : ${Math.round(count/elapsed)} pts/s`);
        }
    }

    console.log("\nSauvegarde du fichier final...");
    
    // Nettoyage des propriétés temporaires avant exportation pour limiter le poids du fichier final
    communesData.features.forEach(f => delete f.bbox);
    
    // Écriture du résultat sur le disque
    fs.writeFileSync(outputFile, JSON.stringify(communesData), 'utf8');
    console.log("Traitement termine avec succes.");
}

run();