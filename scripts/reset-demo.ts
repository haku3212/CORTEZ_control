import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';

if (!process.argv.includes('--confirmar')) {
  console.log('Este comando elimina trabajadoras, lotes, entregas y recepciones demo. Ejecuta: npm run reset:demo -- --confirmar');
  process.exit(0);
}

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'control-almendra', 'control-almendra.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.transaction(() => {
  db.prepare('DELETE FROM recepciones').run();
  db.prepare('DELETE FROM entregas').run();
  db.prepare('DELETE FROM lotes').run();
  db.prepare('DELETE FROM trabajadoras').run();
})();
db.close();
console.log('Datos demo eliminados. Las empresas iniciales se conservan.');
