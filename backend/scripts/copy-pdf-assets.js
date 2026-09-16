// tsc no copia archivos que no sean .ts (el logo de los PDF, por ejemplo):
// este paso lo lleva a dist/ despues de compilar, para que exista en produccion.
const fs = require('node:fs');
const path = require('node:path');

const origen = path.join(__dirname, '..', 'src', 'shared', 'infrastructure', 'pdf', 'assets');
const destino = path.join(__dirname, '..', 'dist', 'shared', 'infrastructure', 'pdf', 'assets');

fs.mkdirSync(destino, { recursive: true });
for (const archivo of fs.readdirSync(origen)) {
  fs.copyFileSync(path.join(origen, archivo), path.join(destino, archivo));
}
