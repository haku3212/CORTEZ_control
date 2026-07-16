import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'control-almendra', 'control-almendra.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const now = new Date().toISOString();
const today = now.slice(0, 10);
const count = db.prepare('SELECT COUNT(*) AS total FROM trabajadoras').get() as { total: number };

if (count.total === 0) {
  db.prepare(`
    INSERT INTO trabajadoras (codigo,nombre_completo,tipo_trabajo,precio_quebrado_centavos,precio_recorte_centavos,fecha_ingreso,estado,creado_en,actualizado_en)
    VALUES ('TRA-001','Trabajadora Demo','AMBOS',250,300,?,'ACTIVA',?,?)
  `).run(today, now, now);
  console.log('Datos demo agregados.');
} else {
  console.log('No se agregaron datos demo porque ya existen trabajadoras.');
}

db.close();
