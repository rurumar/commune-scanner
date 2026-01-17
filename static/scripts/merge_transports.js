const fs = require('fs');
const readline = require('readline');
const path = require('path');
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');
const turfBbox = require('@turf/bbox').default; // npm install @turf/bbox

const pointsFile = path.join(__dirname, '../../old/old/stations.geojson');
const polygonsFile = path.join(__dirname, '../data/old_Final.geojson');
const outputFile = path.join(__dirname, '../data/Final.geojson');

async function run() {
    console.log("🚀 Chargement des données...");
    const communesData = JSON.parse(fs.readFileSync(polygonsFile, 'utf8'));

    // 1. On prépare les communes (Initialisation + BBox)
    communesData.features.forEach(f => {
        f.properties['Transports 2025'] = 0;
        f.bbox = turfBbox(f); // On stocke le petit rectangle [minX, minY, maxX, maxY]
    });

    const rl = readline.createInterface({ 
        input: fs.createReadStream(pointsFile), 
        crlfDelay: Infinity 
    });

    let count = 0, found = 0;
    const startTime = Date.now();

    for await (const line of rl) {
        // Nettoyage pour éviter l'erreur "Unexpected token"
        let cleanLine = line.trim().replace(/^[^{]*/, '');
        if (!cleanLine.startsWith('{')) continue;
        if (cleanLine.endsWith(',')) cleanLine = cleanLine.slice(0, -1);

        try {
            const station = JSON.parse(cleanLine);
            const coords = station.geometry.coordinates;
            const lng = coords[0];
            const lat = coords[1];

            // 2. Boucle sur les communes
            for (let commune of communesData.features) {
                const b = commune.bbox;

                // --- LE TEST BBOX (L'optimisation) ---
                // On ne fait le calcul lourd QUE si le point est dans le rectangle
                if (lng >= b[0] && lat >= b[1] && lng <= b[2] && lat <= b[3]) {
                    if (booleanPointInPolygon(point(coords), commune)) {
                        commune.properties['Transports 2025']++;
                        found++;
                        break;
                    }
                }
            }
        } catch (e) { /* Ligne corrompue ignorée */ }

        count++;
        if (count % 20000 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            process.stdout.write(`\r📍 Stations : ${count} | Trouvées : ${found} | Vitesse : ${Math.round(count/elapsed)} pts/s`);
        }
    }

    console.log("\n💾 Nettoyage et Sauvegarde...");
    // On retire les BBox pour que le fichier Final.geojson reste léger
    communesData.features.forEach(f => delete f.bbox);
    
    fs.writeFileSync(outputFile, JSON.stringify(communesData), 'utf8');
    console.log("✅ Terminé !");
}

run();