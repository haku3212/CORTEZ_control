import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { App } from 'electron';
import {
  assertNoSobreentrega,
  calculateNetWeight,
  nextSequentialCode,
  productividadKgHora,
  rendimiento,
  saldoDisponible,
  saldoPendiente,
  hoursBetween
} from '../../shared/calculations';
import type {
  Configuracion,
  DashboardData,
  Empresa,
  Entrega,
  EstadoEntrega,
  EstadoLote,
  Lote,
  LoteResumen,
  PrecioCategoria,
  Recepcion,
  RetiroEmpresa,
  Servicio,
  Trabajadora,
  TrabajadoraResumen
} from '../../shared/types';

let db: Database.Database | null = null;
let databasePath = '';
let userDataPath = '';
let dirty = false;

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

function database(): Database.Database {
  if (!db) throw new Error('La base de datos no esta inicializada.');
  return db;
}

function touch(): void {
  dirty = true;
}

export function hasDatabaseChanges(): boolean {
  return dirty;
}

export function getDatabasePath(): string {
  return databasePath;
}

export function initializeDatabase(basePath: string): void {
  userDataPath = basePath;
  fs.mkdirSync(basePath, { recursive: true });
  databasePath = path.join(basePath, 'control-almendra.db');
  db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  migrate();
  seedInitialData();
}

export function closeDatabase(): void {
  if (db) db.close();
  db = null;
}

function migrate(): void {
  const sql = `
    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      servicio_principal TEXT NOT NULL CHECK(servicio_principal IN ('QUEBRADO','RECORTE')),
      responsable TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL DEFAULT '',
      direccion TEXT NOT NULL DEFAULT '',
      precio_servicio_centavos INTEGER NOT NULL DEFAULT 0,
      forma_pago TEXT NOT NULL DEFAULT '',
      observaciones TEXT NOT NULL DEFAULT '',
      activa INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trabajadoras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre_completo TEXT NOT NULL,
      cedula TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL DEFAULT '',
      direccion TEXT NOT NULL DEFAULT '',
      tipo_trabajo TEXT NOT NULL CHECK(tipo_trabajo IN ('QUEBRADO','RECORTE','AMBOS')),
      precio_quebrado_centavos INTEGER NOT NULL DEFAULT 0,
      precio_recorte_centavos INTEGER NOT NULL DEFAULT 0,
      fecha_ingreso TEXT NOT NULL,
      observaciones TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL CHECK(estado IN ('ACTIVA','INACTIVA','SUSPENDIDA')),
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id),
      tipo_servicio TEXT NOT NULL CHECK(tipo_servicio IN ('QUEBRADO','RECORTE')),
      fecha_recepcion TEXT NOT NULL,
      hora_recepcion TEXT NOT NULL,
      persona_entrega TEXT NOT NULL,
      persona_recibe TEXT NOT NULL,
      peso_bruto_g INTEGER NOT NULL,
      peso_envases_g INTEGER NOT NULL,
      peso_neto_g INTEGER NOT NULL,
      cantidad_bolsas INTEGER NOT NULL DEFAULT 0,
      precio_servicio_centavos INTEGER NOT NULL DEFAULT 0,
      fecha_estimada_entrega TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL,
      observaciones TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entregas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      lote_id INTEGER NOT NULL REFERENCES lotes(id),
      trabajadora_id INTEGER NOT NULL REFERENCES trabajadoras(id),
      fecha_entrega TEXT NOT NULL,
      hora_entrega TEXT NOT NULL,
      peso_bruto_g INTEGER NOT NULL,
      peso_envase_g INTEGER NOT NULL,
      peso_neto_g INTEGER NOT NULL,
      cantidad_bolsas INTEGER NOT NULL DEFAULT 0,
      fecha_limite TEXT NOT NULL,
      hora_limite TEXT NOT NULL,
      precio_trabajadora_centavos INTEGER NOT NULL DEFAULT 0,
      responsable_entrega TEXT NOT NULL,
      estado TEXT NOT NULL,
      observaciones TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recepciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      entrega_id INTEGER NOT NULL REFERENCES entregas(id),
      fecha_recepcion TEXT NOT NULL,
      hora_recepcion TEXT NOT NULL,
      peso_procesado_g INTEGER NOT NULL,
      producto_bueno_g INTEGER NOT NULL DEFAULT 0,
      producto_danado_g INTEGER NOT NULL DEFAULT 0,
      producto_podrido_g INTEGER NOT NULL DEFAULT 0,
      producto_amarillo_g INTEGER NOT NULL DEFAULT 0,
      producto_con_cascara_g INTEGER NOT NULL DEFAULT 0,
      cascara_g INTEGER NOT NULL DEFAULT 0,
      producto_quemado_g INTEGER NOT NULL DEFAULT 0,
      producto_manchado_g INTEGER NOT NULL DEFAULT 0,
      recorte_incompleto_g INTEGER NOT NULL DEFAULT 0,
      descarte_g INTEGER NOT NULL DEFAULT 0,
      residuos_g INTEGER NOT NULL DEFAULT 0,
      otros_g INTEGER NOT NULL DEFAULT 0,
      diferencia_no_justificada_g INTEGER NOT NULL DEFAULT 0,
      es_recepcion_final INTEGER NOT NULL DEFAULT 0,
      requiere_reproceso INTEGER NOT NULL DEFAULT 0,
      total_pago_centavos INTEGER NOT NULL DEFAULT 0,
      responsable_recepcion TEXT NOT NULL,
      observaciones TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_hora TEXT NOT NULL,
      modulo TEXT NOT NULL,
      accion TEXT NOT NULL,
      registro_id INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      datos_anteriores TEXT,
      datos_nuevos TEXT
    );
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS retiros_empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id),
      tipo_servicio TEXT NOT NULL CHECK(tipo_servicio IN ('QUEBRADO','RECORTE')),
      fecha_retiro TEXT NOT NULL,
      hora_retiro TEXT NOT NULL,
      persona_entrega TEXT NOT NULL,
      persona_recoge TEXT NOT NULL,
      lugar_retiro TEXT NOT NULL DEFAULT '',
      transporte TEXT NOT NULL DEFAULT '',
      peso_bruto_g INTEGER NOT NULL,
      peso_envases_g INTEGER NOT NULL,
      peso_neto_g INTEGER NOT NULL,
      cantidad_bolsas INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'RETIRADO',
      observaciones TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS precios_categoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_servicio TEXT NOT NULL CHECK(tipo_servicio IN ('QUEBRADO','RECORTE')),
      categoria TEXT NOT NULL,
      nombre TEXT NOT NULL,
      precio_centavos INTEGER NOT NULL DEFAULT 0,
      activa INTEGER NOT NULL DEFAULT 1,
      actualizado_en TEXT NOT NULL,
      UNIQUE(tipo_servicio, categoria)
    );
    CREATE INDEX IF NOT EXISTS idx_entregas_lote ON entregas(lote_id);
    CREATE INDEX IF NOT EXISTS idx_recepciones_entrega ON recepciones(entrega_id);
  `;
  database().exec(sql);
  ensureColumn('recepciones', 'total_pago_centavos', 'INTEGER NOT NULL DEFAULT 0');
}

function seedInitialData(): void {
  const count = database().prepare('SELECT COUNT(*) AS total FROM empresas').get() as { total: number };
  if (count.total === 0) {
    const stmt = database().prepare(`
      INSERT INTO empresas (codigo,nombre,servicio_principal,creado_en,actualizado_en)
      VALUES (@codigo,@nombre,@servicio,@fecha,@fecha)
    `);
    stmt.run({ codigo: 'SA', nombre: 'San Agustín', servicio: 'QUEBRADO', fecha: now() });
    stmt.run({ codigo: 'HB', nombre: 'Hermanos Blacut', servicio: 'RECORTE', fecha: now() });
  }
  database().prepare('UPDATE empresas SET nombre=? WHERE codigo=? AND nombre=?').run('San Agustín', 'SA', 'San Agustin');
  const defaults: Configuracion = {
    nombre_negocio: 'Control de Almendra',
    responsable: '',
    telefono: '',
    direccion: '',
    tolerancia_diferencia_g: 100,
    carpeta_respaldos: path.join(userDataPath, 'respaldos'),
    moneda: 'Bs',
    unidad_peso: 'kg'
  };
  const insert = database().prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)');
  Object.entries(defaults).forEach(([key, value]) => insert.run(key, String(value)));
  fs.mkdirSync(defaults.carpeta_respaldos, { recursive: true });
  seedPreciosCategoria();
}

function ensureColumn(table: string, column: string, definition: string): void {
  const columns = database().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedPreciosCategoria(): void {
  const defaults: Array<Pick<PrecioCategoria, 'tipo_servicio' | 'categoria' | 'nombre' | 'precio_centavos'>> = [
    { tipo_servicio: 'QUEBRADO', categoria: 'producto_bueno_g', nombre: 'Almendra buena', precio_centavos: 300 },
    { tipo_servicio: 'QUEBRADO', categoria: 'producto_danado_g', nombre: 'Almendra dañada o quebrada', precio_centavos: 100 },
    { tipo_servicio: 'QUEBRADO', categoria: 'producto_podrido_g', nombre: 'Almendra podrida', precio_centavos: 50 },
    { tipo_servicio: 'QUEBRADO', categoria: 'producto_amarillo_g', nombre: 'Almendra amarilla', precio_centavos: 80 },
    { tipo_servicio: 'QUEBRADO', categoria: 'producto_con_cascara_g', nombre: 'Almendra con cascara', precio_centavos: 0 },
    { tipo_servicio: 'QUEBRADO', categoria: 'cascara_g', nombre: 'Cascara', precio_centavos: 0 },
    { tipo_servicio: 'QUEBRADO', categoria: 'descarte_g', nombre: 'Descarte', precio_centavos: 0 },
    { tipo_servicio: 'QUEBRADO', categoria: 'residuos_g', nombre: 'Residuos', precio_centavos: 0 },
    { tipo_servicio: 'QUEBRADO', categoria: 'otros_g', nombre: 'Otros', precio_centavos: 0 },
    { tipo_servicio: 'RECORTE', categoria: 'producto_bueno_g', nombre: 'Almendra recortada buena', precio_centavos: 300 },
    { tipo_servicio: 'RECORTE', categoria: 'producto_danado_g', nombre: 'Almendra quebrada en recorte', precio_centavos: 100 },
    { tipo_servicio: 'RECORTE', categoria: 'producto_podrido_g', nombre: 'Almendra podrida retirada', precio_centavos: 50 },
    { tipo_servicio: 'RECORTE', categoria: 'producto_amarillo_g', nombre: 'Almendra amarilla retirada', precio_centavos: 80 },
    { tipo_servicio: 'RECORTE', categoria: 'producto_quemado_g', nombre: 'Almendra quemada', precio_centavos: 50 },
    { tipo_servicio: 'RECORTE', categoria: 'producto_manchado_g', nombre: 'Almendra manchada', precio_centavos: 50 },
    { tipo_servicio: 'RECORTE', categoria: 'recorte_incompleto_g', nombre: 'Recorte incompleto', precio_centavos: 0 },
    { tipo_servicio: 'RECORTE', categoria: 'descarte_g', nombre: 'Descarte', precio_centavos: 0 },
    { tipo_servicio: 'RECORTE', categoria: 'residuos_g', nombre: 'Residuos de recorte', precio_centavos: 0 },
    { tipo_servicio: 'RECORTE', categoria: 'otros_g', nombre: 'Otros', precio_centavos: 0 }
  ];
  const stmt = database().prepare(`
    INSERT OR IGNORE INTO precios_categoria (tipo_servicio, categoria, nombre, precio_centavos, activa, actualizado_en)
    VALUES (@tipo_servicio, @categoria, @nombre, @precio_centavos, 1, @fecha)
  `);
  defaults.forEach((item) => stmt.run({ ...item, fecha: now() }));
}

function history(modulo: string, accion: string, registroId: number, descripcion: string, before?: unknown, after?: unknown): void {
  database().prepare(`
    INSERT INTO historial (fecha_hora, modulo, accion, registro_id, descripcion, datos_anteriores, datos_nuevos)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(now(), modulo, accion, registroId, descripcion, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function requireText(value: unknown, label: string): string {
  const text = asString(value);
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

export function listEmpresas(search = ''): Empresa[] {
  const term = `%${search.trim()}%`;
  return database().prepare('SELECT * FROM empresas WHERE nombre LIKE ? OR codigo LIKE ? ORDER BY activa DESC, nombre').all(term, term) as Empresa[];
}

export function createEmpresa(input: Row): Empresa {
  const codigo = requireText(input.codigo, 'Codigo').toUpperCase();
  const nombre = requireText(input.nombre, 'Nombre');
  const servicio = requireText(input.servicio_principal, 'Servicio principal') as Servicio;
  const result = database().prepare(`
    INSERT INTO empresas (codigo,nombre,servicio_principal,responsable,telefono,direccion,precio_servicio_centavos,forma_pago,observaciones,activa,creado_en,actualizado_en)
    VALUES (@codigo,@nombre,@servicio,@responsable,@telefono,@direccion,@precio,@formaPago,@observaciones,1,@fecha,@fecha)
  `).run({
    codigo,
    nombre,
    servicio,
    responsable: asString(input.responsable),
    telefono: asString(input.telefono),
    direccion: asString(input.direccion),
    precio: asNumber(input.precio_servicio_centavos),
    formaPago: asString(input.forma_pago),
    observaciones: asString(input.observaciones),
    fecha: now()
  });
  const created = getById<Empresa>('empresas', Number(result.lastInsertRowid));
  history('Empresas', 'CREAR', created.id, `Empresa ${created.codigo} creada`, null, created);
  touch();
  return created;
}

export function updateEmpresa(input: Row): Empresa {
  const id = asNumber(input.id);
  const before = getById<Empresa>('empresas', id);
  database().prepare(`
    UPDATE empresas SET nombre=@nombre, servicio_principal=@servicio, responsable=@responsable, telefono=@telefono,
    direccion=@direccion, precio_servicio_centavos=@precio, forma_pago=@formaPago, observaciones=@observaciones, actualizado_en=@fecha
    WHERE id=@id
  `).run({
    id,
    nombre: requireText(input.nombre, 'Nombre'),
    servicio: requireText(input.servicio_principal, 'Servicio principal'),
    responsable: asString(input.responsable),
    telefono: asString(input.telefono),
    direccion: asString(input.direccion),
    precio: asNumber(input.precio_servicio_centavos),
    formaPago: asString(input.forma_pago),
    observaciones: asString(input.observaciones),
    fecha: now()
  });
  const updated = getById<Empresa>('empresas', id);
  history('Empresas', 'EDITAR', id, `Empresa ${updated.codigo} editada`, before, updated);
  touch();
  return updated;
}

export function deactivateEmpresa(id: number): void {
  const before = getById<Empresa>('empresas', id);
  database().prepare('UPDATE empresas SET activa=0, actualizado_en=? WHERE id=?').run(now(), id);
  history('Empresas', 'DESACTIVAR', id, `Empresa ${before.codigo} desactivada`, before, { ...before, activa: 0 });
  touch();
}

export function listTrabajadoras(filters: Row = {}): Trabajadora[] {
  const clauses = ['1=1'];
  const params: unknown[] = [];
  const search = asString(filters.search);
  if (search) {
    clauses.push('(nombre_completo LIKE ? OR codigo LIKE ? OR cedula LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const tipo = asString(filters.tipo);
  if (tipo) {
    clauses.push("(tipo_trabajo = ? OR tipo_trabajo = 'AMBOS')");
    params.push(tipo);
  }
  const estado = asString(filters.estado);
  if (estado) {
    clauses.push('estado = ?');
    params.push(estado);
  }
  return database().prepare(`SELECT * FROM trabajadoras WHERE ${clauses.join(' AND ')} ORDER BY estado, nombre_completo`).all(...params) as Trabajadora[];
}

export function createTrabajadora(input: Row): Trabajadora {
  const max = database().prepare('SELECT COALESCE(MAX(id),0) AS max FROM trabajadoras').get() as { max: number };
  const codigo = nextSequentialCode('TRA-', max.max, 3);
  const result = database().prepare(`
    INSERT INTO trabajadoras (codigo,nombre_completo,cedula,telefono,direccion,tipo_trabajo,precio_quebrado_centavos,precio_recorte_centavos,fecha_ingreso,observaciones,estado,creado_en,actualizado_en)
    VALUES (@codigo,@nombre,@cedula,@telefono,@direccion,@tipo,@precioQ,@precioR,@fechaIngreso,@observaciones,'ACTIVA',@fecha,@fecha)
  `).run({
    codigo,
    nombre: requireText(input.nombre_completo, 'Nombre completo'),
    cedula: asString(input.cedula),
    telefono: asString(input.telefono),
    direccion: asString(input.direccion),
    tipo: requireText(input.tipo_trabajo, 'Tipo de trabajo'),
    precioQ: asNumber(input.precio_quebrado_centavos),
    precioR: asNumber(input.precio_recorte_centavos),
    fechaIngreso: asString(input.fecha_ingreso, today()),
    observaciones: asString(input.observaciones),
    fecha: now()
  });
  const created = getById<Trabajadora>('trabajadoras', Number(result.lastInsertRowid));
  history('Trabajadoras', 'CREAR', created.id, `Trabajadora ${created.codigo} creada`, null, created);
  touch();
  return created;
}

export function updateTrabajadora(input: Row): Trabajadora {
  const id = asNumber(input.id);
  const before = getById<Trabajadora>('trabajadoras', id);
  database().prepare(`
    UPDATE trabajadoras SET nombre_completo=@nombre, cedula=@cedula, telefono=@telefono, direccion=@direccion,
    tipo_trabajo=@tipo, precio_quebrado_centavos=@precioQ, precio_recorte_centavos=@precioR, fecha_ingreso=@fechaIngreso,
    observaciones=@observaciones, estado=@estado, actualizado_en=@fecha WHERE id=@id
  `).run({
    id,
    nombre: requireText(input.nombre_completo, 'Nombre completo'),
    cedula: asString(input.cedula),
    telefono: asString(input.telefono),
    direccion: asString(input.direccion),
    tipo: requireText(input.tipo_trabajo, 'Tipo de trabajo'),
    precioQ: asNumber(input.precio_quebrado_centavos),
    precioR: asNumber(input.precio_recorte_centavos),
    fechaIngreso: asString(input.fecha_ingreso, today()),
    observaciones: asString(input.observaciones),
    estado: asString(input.estado, 'ACTIVA'),
    fecha: now()
  });
  const updated = getById<Trabajadora>('trabajadoras', id);
  history('Trabajadoras', 'EDITAR', id, `Trabajadora ${updated.codigo} editada`, before, updated);
  touch();
  return updated;
}

export function deactivateTrabajadora(id: number): void {
  const before = getById<Trabajadora>('trabajadoras', id);
  database().prepare("UPDATE trabajadoras SET estado='INACTIVA', actualizado_en=? WHERE id=?").run(now(), id);
  history('Trabajadoras', 'DESACTIVAR', id, `Trabajadora ${before.codigo} desactivada`, before, { ...before, estado: 'INACTIVA' });
  touch();
}

export function listLotes(): Lote[] {
  return database().prepare(`
    SELECT l.*, e.nombre AS empresa_nombre, e.codigo AS empresa_codigo
    FROM lotes l JOIN empresas e ON e.id = l.empresa_id
    ORDER BY l.fecha_recepcion DESC, l.id DESC
  `).all() as Lote[];
}

export function listRetirosEmpresa(): RetiroEmpresa[] {
  return database().prepare(`
    SELECT r.*, e.nombre AS empresa_nombre, e.codigo AS empresa_codigo
    FROM retiros_empresas r
    JOIN empresas e ON e.id = r.empresa_id
    ORDER BY r.fecha_retiro DESC, r.id DESC
  `).all() as RetiroEmpresa[];
}

export function createRetiroEmpresa(input: Row): RetiroEmpresa {
  const tx = database().transaction(() => {
    const empresa = getById<Empresa>('empresas', asNumber(input.empresa_id));
    if (!empresa.activa) throw new Error('No se puede registrar un retiro de una empresa inactiva.');
    const tipo = requireText(input.tipo_servicio, 'Tipo de servicio') as Servicio;
    const gross = asNumber(input.peso_bruto_g);
    const tare = asNumber(input.peso_envases_g);
    const net = calculateNetWeight(gross, tare);
    const max = database().prepare('SELECT COALESCE(MAX(id),0) AS max FROM retiros_empresas').get() as { max: number };
    const numero = nextSequentialCode('RET-', max.max, 6);
    const result = database().prepare(`
      INSERT INTO retiros_empresas (numero,empresa_id,tipo_servicio,fecha_retiro,hora_retiro,persona_entrega,persona_recoge,lugar_retiro,transporte,peso_bruto_g,peso_envases_g,peso_neto_g,cantidad_bolsas,estado,observaciones,creado_en,actualizado_en)
      VALUES (@numero,@empresa,@tipo,@fechaRetiro,@horaRetiro,@personaEntrega,@personaRecoge,@lugar,@transporte,@bruto,@envases,@neto,@bolsas,'RETIRADO',@observaciones,@fecha,@fecha)
    `).run({
      numero,
      empresa: empresa.id,
      tipo,
      fechaRetiro: asString(input.fecha_retiro, today()),
      horaRetiro: asString(input.hora_retiro, currentTime()),
      personaEntrega: requireText(input.persona_entrega, 'Persona que entrega en la empresa'),
      personaRecoge: requireText(input.persona_recoge, 'Persona que recoge'),
      lugar: asString(input.lugar_retiro),
      transporte: asString(input.transporte),
      bruto: gross,
      envases: tare,
      neto: net,
      bolsas: asNumber(input.cantidad_bolsas),
      observaciones: asString(input.observaciones),
      fecha: now()
    });
    const created = getById<RetiroEmpresa>('retiros_empresas', Number(result.lastInsertRowid));
    history('Retiros', 'CREAR', created.id, `Retiro ${created.numero} registrado`, null, created);
    touch();
    return created;
  });
  return tx();
}

export function listPreciosCategoria(): PrecioCategoria[] {
  return database().prepare('SELECT * FROM precios_categoria ORDER BY tipo_servicio, id').all() as PrecioCategoria[];
}

export function updatePrecioCategoria(input: Row): PrecioCategoria {
  const id = asNumber(input.id);
  const before = getById<PrecioCategoria>('precios_categoria', id);
  database().prepare('UPDATE precios_categoria SET nombre=?, precio_centavos=?, activa=?, actualizado_en=? WHERE id=?')
    .run(requireText(input.nombre, 'Nombre'), asNumber(input.precio_centavos), input.activa ? 1 : 0, now(), id);
  const updated = getById<PrecioCategoria>('precios_categoria', id);
  history('Precios', 'EDITAR', id, `Precio ${updated.nombre} actualizado`, before, updated);
  touch();
  return updated;
}

function calculatePagoRecepcion(tipo: Servicio, values: Record<string, number>): number {
  const prices = database().prepare('SELECT categoria, precio_centavos FROM precios_categoria WHERE tipo_servicio=? AND activa=1').all(tipo) as Array<{ categoria: string; precio_centavos: number }>;
  return prices.reduce((sum, price) => sum + Math.round((values[price.categoria] || 0) * price.precio_centavos / 1000), 0);
}

export function createLote(input: Row): Lote {
  const tx = database().transaction(() => {
    const empresa = getById<Empresa>('empresas', asNumber(input.empresa_id));
    if (!empresa.activa) throw new Error('No se puede crear un lote para una empresa inactiva.');
    const tipo = requireText(input.tipo_servicio, 'Tipo de servicio') as Servicio;
    const gross = asNumber(input.peso_bruto_g);
    const tare = asNumber(input.peso_envases_g);
    const net = calculateNetWeight(gross, tare);
    const letter = tipo === 'QUEBRADO' ? 'Q' : 'R';
    const max = database().prepare('SELECT COUNT(*) AS total FROM lotes WHERE empresa_id=? AND tipo_servicio=?').get(empresa.id, tipo) as { total: number };
    const codigo = `${empresa.codigo}-${letter}-${String(max.total + 1).padStart(3, '0')}`;
    const result = database().prepare(`
      INSERT INTO lotes (codigo,empresa_id,tipo_servicio,fecha_recepcion,hora_recepcion,persona_entrega,persona_recibe,peso_bruto_g,peso_envases_g,peso_neto_g,cantidad_bolsas,precio_servicio_centavos,fecha_estimada_entrega,estado,observaciones,creado_en,actualizado_en)
      VALUES (@codigo,@empresa,@tipo,@fechaRecepcion,@horaRecepcion,@personaEntrega,@personaRecibe,@bruto,@envases,@neto,@bolsas,@precio,@fechaEstimada,'RECIBIDO',@observaciones,@fecha,@fecha)
    `).run({
      codigo,
      empresa: empresa.id,
      tipo,
      fechaRecepcion: asString(input.fecha_recepcion, today()),
      horaRecepcion: asString(input.hora_recepcion, currentTime()),
      personaEntrega: requireText(input.persona_entrega, 'Persona que entrega'),
      personaRecibe: requireText(input.persona_recibe, 'Persona que recibe'),
      bruto: gross,
      envases: tare,
      neto: net,
      bolsas: asNumber(input.cantidad_bolsas),
      precio: asNumber(input.precio_servicio_centavos, empresa.precio_servicio_centavos),
      fechaEstimada: asString(input.fecha_estimada_entrega),
      observaciones: asString(input.observaciones),
      fecha: now()
    });
    const created = getById<Lote>('lotes', Number(result.lastInsertRowid));
    history('Lotes', 'CREAR', created.id, `Lote ${created.codigo} creado`, null, created);
    touch();
    return created;
  });
  return tx();
}

export function updateLoteEstado(id: number, estado: EstadoLote): void {
  const resumen = getLoteResumen(id);
  if (estado === 'CERRADO' && resumen.pendiente_trabajadoras_g > 0) {
    throw new Error('No se puede cerrar un lote con entregas pendientes.');
  }
  const before = resumen.lote;
  database().prepare('UPDATE lotes SET estado=?, actualizado_en=? WHERE id=?').run(estado, now(), id);
  history('Lotes', 'CAMBIO_ESTADO', id, `Lote ${before.codigo} cambio a ${estado}`, before, { ...before, estado });
  touch();
}

export function getLoteResumen(id: number): LoteResumen {
  const lote = getById<Lote>('lotes', id);
  const totals = database().prepare(`
    SELECT
      COALESCE(SUM(e.peso_neto_g),0) AS entregado_g,
      COALESCE(SUM((SELECT COALESCE(SUM(r.peso_procesado_g),0) FROM recepciones r WHERE r.entrega_id=e.id)),0) AS procesado_g,
      COALESCE(SUM((SELECT COALESCE(SUM(r.producto_bueno_g),0) FROM recepciones r WHERE r.entrega_id=e.id)),0) AS producto_bueno_g,
      COALESCE(SUM((SELECT COALESCE(SUM(r.descarte_g),0) FROM recepciones r WHERE r.entrega_id=e.id)),0) AS descarte_g,
      COALESCE(SUM((SELECT COALESCE(SUM(r.residuos_g + r.cascara_g + r.otros_g),0) FROM recepciones r WHERE r.entrega_id=e.id)),0) AS residuos_g,
      COALESCE(SUM((SELECT COALESCE(SUM(r.diferencia_no_justificada_g),0) FROM recepciones r WHERE r.entrega_id=e.id)),0) AS diferencia_no_justificada_g
    FROM entregas e WHERE e.lote_id=?
  `).get(id) as Record<string, number>;
  return {
    lote,
    entregado_g: totals.entregado_g,
    disponible_g: saldoDisponible(lote.peso_neto_g, totals.entregado_g),
    procesado_g: totals.procesado_g,
    pendiente_trabajadoras_g: saldoPendiente(totals.entregado_g, totals.procesado_g),
    producto_bueno_g: totals.producto_bueno_g,
    descarte_g: totals.descarte_g,
    residuos_g: totals.residuos_g,
    diferencia_no_justificada_g: totals.diferencia_no_justificada_g,
    rendimiento: rendimiento(totals.producto_bueno_g, totals.entregado_g)
  };
}

export function listEntregas(): Entrega[] {
  refreshAtrasadas();
  return database().prepare(`
    SELECT e.*, l.codigo AS lote_codigo, l.tipo_servicio AS tipo_servicio, t.nombre_completo AS trabajadora_nombre
    FROM entregas e
    JOIN lotes l ON l.id=e.lote_id
    JOIN trabajadoras t ON t.id=e.trabajadora_id
    ORDER BY e.fecha_entrega DESC, e.id DESC
  `).all() as Entrega[];
}

export function createEntrega(input: Row): Entrega {
  const tx = database().transaction(() => {
    const lote = getById<Lote>('lotes', asNumber(input.lote_id));
    const trabajadora = getById<Trabajadora>('trabajadoras', asNumber(input.trabajadora_id));
    if (trabajadora.estado !== 'ACTIVA') throw new Error('No se puede entregar almendra a una trabajadora inactiva.');
    if (!(trabajadora.tipo_trabajo === 'AMBOS' || trabajadora.tipo_trabajo === lote.tipo_servicio)) {
      throw new Error(`La trabajadora no realiza ${lote.tipo_servicio.toLowerCase()}.`);
    }
    const gross = asNumber(input.peso_bruto_g);
    const tare = asNumber(input.peso_envase_g);
    const net = calculateNetWeight(gross, tare);
    const resumen = getLoteResumen(lote.id);
    assertNoSobreentrega(net, resumen.disponible_g);
    const max = database().prepare('SELECT COALESCE(MAX(id),0) AS max FROM entregas').get() as { max: number };
    const numero = nextSequentialCode('ENT-', max.max, 6);
    const precioDefault = lote.tipo_servicio === 'QUEBRADO' ? trabajadora.precio_quebrado_centavos : trabajadora.precio_recorte_centavos;
    const result = database().prepare(`
      INSERT INTO entregas (numero,lote_id,trabajadora_id,fecha_entrega,hora_entrega,peso_bruto_g,peso_envase_g,peso_neto_g,cantidad_bolsas,fecha_limite,hora_limite,precio_trabajadora_centavos,responsable_entrega,estado,observaciones,creado_en,actualizado_en)
      VALUES (@numero,@lote,@trabajadora,@fechaEntrega,@horaEntrega,@bruto,@envase,@neto,@bolsas,@fechaLimite,@horaLimite,@precio,@responsable,'ENTREGADA',@observaciones,@fecha,@fecha)
    `).run({
      numero,
      lote: lote.id,
      trabajadora: trabajadora.id,
      fechaEntrega: asString(input.fecha_entrega, today()),
      horaEntrega: asString(input.hora_entrega, currentTime()),
      bruto: gross,
      envase: tare,
      neto: net,
      bolsas: asNumber(input.cantidad_bolsas),
      fechaLimite: requireText(input.fecha_limite, 'Fecha limite'),
      horaLimite: asString(input.hora_limite, '18:00'),
      precio: asNumber(input.precio_trabajadora_centavos, precioDefault),
      responsable: requireText(input.responsable_entrega, 'Responsable de entrega'),
      observaciones: asString(input.observaciones),
      fecha: now()
    });
    database().prepare("UPDATE lotes SET estado='EN_PROCESO', actualizado_en=? WHERE id=? AND estado='RECIBIDO'").run(now(), lote.id);
    const created = getById<Entrega>('entregas', Number(result.lastInsertRowid));
    history('Entregas', 'CREAR', created.id, `Entrega ${created.numero} registrada`, null, created);
    touch();
    return created;
  });
  return tx();
}

export function getEntregaDetail(id: number): Row {
  const entrega = (database().prepare(`
    SELECT e.*, l.codigo AS lote_codigo, l.tipo_servicio, emp.nombre AS empresa_nombre, t.nombre_completo AS trabajadora_nombre
    FROM entregas e
    JOIN lotes l ON l.id=e.lote_id
    JOIN empresas emp ON emp.id=l.empresa_id
    JOIN trabajadoras t ON t.id=e.trabajadora_id
    WHERE e.id=?
  `).get(id) as Row | undefined);
  if (!entrega) throw new Error('Entrega no encontrada.');
  const recibido = database().prepare('SELECT COALESCE(SUM(peso_procesado_g),0) AS total FROM recepciones WHERE entrega_id=?').get(id) as { total: number };
  return { ...entrega, procesado_anterior_g: recibido.total, pendiente_g: saldoPendiente(Number(entrega.peso_neto_g), recibido.total) };
}

export function listRecepciones(): Recepcion[] {
  return database().prepare('SELECT * FROM recepciones ORDER BY fecha_recepcion DESC, id DESC').all() as Recepcion[];
}

export function createRecepcion(input: Row): Recepcion {
  const tx = database().transaction(() => {
    const entrega = getById<Entrega>('entregas', asNumber(input.entrega_id));
    const detail = getEntregaDetail(entrega.id);
    const pending = Number(detail.pendiente_g);
    const categories = [
      'producto_bueno_g', 'producto_danado_g', 'producto_podrido_g', 'producto_amarillo_g',
      'producto_con_cascara_g', 'cascara_g', 'producto_quemado_g', 'producto_manchado_g',
      'recorte_incompleto_g', 'descarte_g', 'residuos_g', 'otros_g'
    ];
    const values = Object.fromEntries(categories.map((key) => [key, Math.max(0, asNumber(input[key]))])) as Record<string, number>;
    const processed = Object.values(values).reduce((sum, value) => sum + value, 0);
    if (processed <= 0) throw new Error('Debe registrar al menos una categoria procesada.');
    const final = Boolean(input.es_recepcion_final);
    if (processed > pending && !input.confirmar_exceso) {
      throw new Error('La recepcion supera el saldo pendiente. Confirme el exceso y agregue una observacion.');
    }
    if (processed > pending && !asString(input.observaciones)) {
      throw new Error('La observacion es obligatoria cuando se procesa mas que el saldo pendiente.');
    }
    const difference = pending - processed;
    if (final && difference !== 0 && !asString(input.observaciones)) {
      throw new Error('La observacion es obligatoria para finalizar con diferencia.');
    }
    const max = database().prepare('SELECT COALESCE(MAX(id),0) AS max FROM recepciones').get() as { max: number };
    const numero = nextSequentialCode('REC-', max.max, 6);
    const totalPago = calculatePagoRecepcion(String(detail.tipo_servicio) as Servicio, values);
    const result = database().prepare(`
      INSERT INTO recepciones (numero,entrega_id,fecha_recepcion,hora_recepcion,peso_procesado_g,producto_bueno_g,producto_danado_g,producto_podrido_g,producto_amarillo_g,producto_con_cascara_g,cascara_g,producto_quemado_g,producto_manchado_g,recorte_incompleto_g,descarte_g,residuos_g,otros_g,diferencia_no_justificada_g,es_recepcion_final,requiere_reproceso,total_pago_centavos,responsable_recepcion,observaciones,creado_en,actualizado_en)
      VALUES (@numero,@entrega,@fechaRecepcion,@horaRecepcion,@procesado,@producto_bueno_g,@producto_danado_g,@producto_podrido_g,@producto_amarillo_g,@producto_con_cascara_g,@cascara_g,@producto_quemado_g,@producto_manchado_g,@recorte_incompleto_g,@descarte_g,@residuos_g,@otros_g,@diferencia,@final,@reproceso,@totalPago,@responsable,@observaciones,@fecha,@fecha)
    `).run({
      numero,
      entrega: entrega.id,
      fechaRecepcion: asString(input.fecha_recepcion, today()),
      horaRecepcion: asString(input.hora_recepcion, currentTime()),
      procesado: processed,
      ...values,
      diferencia: difference,
      final: final ? 1 : 0,
      reproceso: input.requiere_reproceso ? 1 : 0,
      totalPago,
      responsable: requireText(input.responsable_recepcion, 'Responsable de recepcion'),
      observaciones: asString(input.observaciones),
      fecha: now()
    });
    const newPending = Math.max(0, pending - processed);
    const estado: EstadoEntrega = input.requiere_reproceso ? 'REQUIERE_REPROCESO' : final || newPending === 0 ? 'TERMINADA' : 'DEVOLUCION_PARCIAL';
    database().prepare('UPDATE entregas SET estado=?, actualizado_en=? WHERE id=?').run(estado, now(), entrega.id);
    updateLoteStateFromRecepcion(entrega.lote_id);
    const created = getById<Recepcion>('recepciones', Number(result.lastInsertRowid));
    history('Recepciones', 'CREAR', created.id, `Recepcion ${created.numero} registrada`, null, created);
    touch();
    return created;
  });
  return tx();
}

function updateLoteStateFromRecepcion(loteId: number): void {
  const resumen = getLoteResumen(loteId);
  const estado: EstadoLote = resumen.pendiente_trabajadoras_g === 0 && resumen.disponible_g === 0
    ? 'TERMINADO'
    : resumen.procesado_g > 0
      ? 'PARCIALMENTE_TERMINADO'
      : 'EN_PROCESO';
  database().prepare("UPDATE lotes SET estado=?, actualizado_en=? WHERE id=? AND estado NOT IN ('ENTREGADO','CERRADO')").run(estado, now(), loteId);
}

export function getTrabajadoraResumen(id: number): TrabajadoraResumen {
  const trabajadora = getById<Trabajadora>('trabajadoras', id);
  const rows = database().prepare(`
    SELECT e.*, l.tipo_servicio,
      COALESCE((SELECT SUM(r.peso_procesado_g) FROM recepciones r WHERE r.entrega_id=e.id),0) AS procesado_g,
      COALESCE((SELECT SUM(r.producto_bueno_g) FROM recepciones r WHERE r.entrega_id=e.id),0) AS bueno_g,
      (SELECT r.fecha_recepcion FROM recepciones r WHERE r.entrega_id=e.id AND r.es_recepcion_final=1 ORDER BY r.id DESC LIMIT 1) AS fecha_final,
      (SELECT r.hora_recepcion FROM recepciones r WHERE r.entrega_id=e.id AND r.es_recepcion_final=1 ORDER BY r.id DESC LIMIT 1) AS hora_final
    FROM entregas e JOIN lotes l ON l.id=e.lote_id WHERE e.trabajadora_id=?
  `).all(id) as Array<Entrega & { procesado_g: number; bueno_g: number; fecha_final?: string; hora_final?: string }>;
  const terminadas = rows.filter((row) => row.estado === 'TERMINADA');
  const totalEntregado = rows.reduce((sum, row) => sum + row.peso_neto_g, 0);
  const totalProcesado = rows.reduce((sum, row) => sum + row.procesado_g, 0);
  const totalBuenoTerminado = terminadas.reduce((sum, row) => sum + row.bueno_g, 0);
  const totalEntregadoTerminado = terminadas.reduce((sum, row) => sum + row.peso_neto_g, 0);
  const tiempos = terminadas.map((row) => hoursBetween(row.fecha_entrega, row.hora_entrega, row.fecha_final || row.fecha_entrega, row.hora_final || row.hora_entrega)).filter((h) => h > 0);
  return {
    trabajadora,
    cantidad_entregas: rows.length,
    kg_recibidos_g: totalEntregado,
    kg_procesados_g: totalProcesado,
    kg_pendientes_g: saldoPendiente(totalEntregado, totalProcesado),
    rendimiento_promedio: terminadas.length ? terminadas.reduce((sum, row) => sum + rendimiento(row.bueno_g, row.peso_neto_g), 0) / terminadas.length : 0,
    rendimiento_ponderado: rendimiento(totalBuenoTerminado, totalEntregadoTerminado),
    productividad_promedio: tiempos.length ? terminadas.reduce((sum, row) => sum + productividadKgHora(row.procesado_g, hoursBetween(row.fecha_entrega, row.hora_entrega, row.fecha_final || row.fecha_entrega, row.hora_final || row.hora_entrega)), 0) / tiempos.length : 0,
    tiempo_promedio_horas: tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0,
    entregas_terminadas: terminadas.length,
    entregas_atrasadas: rows.filter((row) => isLate(row) || row.estado === 'ATRASADA').length
  };
}

export function listRendimiento(filters: Row = {}): TrabajadoraResumen[] {
  const tipo = asString(filters.tipo_servicio);
  return listTrabajadoras({ tipo, estado: 'ACTIVA' }).map((t) => getTrabajadoraResumen(t.id));
}

export function getDashboard(): DashboardData {
  refreshAtrasadas();
  const lotes = listLotes();
  const resumenes = lotes.map((l) => getLoteResumen(l.id));
  const entregas = listEntregas();
  const kgRecibidos = lotes.reduce((sum, lote) => sum + lote.peso_neto_g, 0) / 1000;
  const kgDisponibles = resumenes.reduce((sum, item) => sum + item.disponible_g, 0) / 1000;
  const kgEnManos = resumenes.reduce((sum, item) => sum + item.pendiente_trabajadoras_g, 0) / 1000;
  const rendimientoServicio = (servicio: Servicio) => {
    const selected = resumenes.filter((r) => r.lote.tipo_servicio === servicio);
    const bueno = selected.reduce((sum, r) => sum + r.producto_bueno_g, 0);
    const entregado = selected.reduce((sum, r) => sum + r.entregado_g, 0);
    return rendimiento(bueno, entregado);
  };
  const nowDate = new Date();
  const limit = new Date(nowDate.getTime() + 2 * 86400000);
  const pending = entregas.filter((e) => e.estado !== 'TERMINADA');
  return {
    lotesActivos: lotes.filter((l) => !['TERMINADO', 'ENTREGADO', 'CERRADO'].includes(l.estado)).length,
    lotesTerminados: lotes.filter((l) => ['TERMINADO', 'ENTREGADO', 'CERRADO'].includes(l.estado)).length,
    kgRecibidos,
    kgDisponibles,
    kgEnManos,
    entregasPendientes: pending.length,
    entregasAtrasadas: pending.filter(isLate).length,
    trabajadorasActivas: listTrabajadoras({ estado: 'ACTIVA' }).length,
    rendimientoQuebrado: rendimientoServicio('QUEBRADO'),
    rendimientoRecorte: rendimientoServicio('RECORTE'),
    proximas: pending.filter((e) => {
      const due = new Date(`${e.fecha_limite}T${e.hora_limite}:00`);
      return due >= nowDate && due <= limit;
    }),
    atrasadas: pending.filter(isLate)
  };
}

function isLate(entrega: Pick<Entrega, 'fecha_limite' | 'hora_limite' | 'estado'>): boolean {
  if (entrega.estado === 'TERMINADA') return false;
  return new Date(`${entrega.fecha_limite}T${entrega.hora_limite || '23:59'}:00`).getTime() < Date.now();
}

function refreshAtrasadas(): void {
  const rows = database().prepare("SELECT * FROM entregas WHERE estado NOT IN ('TERMINADA','ATRASADA')").all() as Entrega[];
  const late = rows.filter(isLate);
  const stmt = database().prepare("UPDATE entregas SET estado='ATRASADA', actualizado_en=? WHERE id=?");
  late.forEach((row) => stmt.run(now(), row.id));
}

export function getConfiguracion(): Configuracion {
  const rows = database().prepare('SELECT clave, valor FROM configuracion').all() as Array<{ clave: keyof Configuracion; valor: string }>;
  const result = Object.fromEntries(rows.map((row) => [row.clave, row.valor])) as unknown as Configuracion;
  return {
    ...result,
    tolerancia_diferencia_g: Number(result.tolerancia_diferencia_g || 100)
  };
}

export function updateConfiguracion(input: Row): Configuracion {
  const config = { ...getConfiguracion(), ...input };
  const stmt = database().prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)');
  Object.entries(config).forEach(([key, value]) => stmt.run(key, String(value)));
  fs.mkdirSync(String(config.carpeta_respaldos), { recursive: true });
  history('Configuracion', 'EDITAR', 1, 'Configuracion actualizada', null, config);
  touch();
  return getConfiguracion();
}

export function backupInfo(): Row {
  return { databasePath, backupFolder: getConfiguracion().carpeta_respaldos };
}

export async function createBackup(folder?: string): Promise<string> {
  const targetFolder = folder || getConfiguracion().carpeta_respaldos;
  fs.mkdirSync(targetFolder, { recursive: true });
  const stamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
  const target = path.join(targetFolder, `control-almendra_${stamp}.db`);
  await database().backup(target);
  dirty = false;
  return target;
}

export function createAutomaticBackup(): Promise<string> {
  const folder = path.join(getConfiguracion().carpeta_respaldos, 'automaticos');
  return createBackup(folder);
}

export function listBackups(folder?: string): Row[] {
  const targetFolder = folder || getConfiguracion().carpeta_respaldos;
  if (!fs.existsSync(targetFolder)) return [];
  return fs.readdirSync(targetFolder)
    .filter((file) => file.endsWith('.db'))
    .map((file) => {
      const full = path.join(targetFolder, file);
      const stat = fs.statSync(full);
      return { nombre: file, ruta: full, fecha: stat.mtime.toISOString(), tamano: stat.size };
    })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

export function restoreBackup(filePath: string): void {
  if (!fs.existsSync(filePath)) throw new Error('El respaldo seleccionado no existe.');
  const safetyFolder = path.join(getConfiguracion().carpeta_respaldos, 'antes-de-restaurar');
  fs.mkdirSync(safetyFolder, { recursive: true });
  fs.copyFileSync(databasePath, path.join(safetyFolder, `control-almendra_${new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19)}.db`));
  closeDatabase();
  fs.copyFileSync(filePath, databasePath);
  db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  dirty = false;
}

export function listHistorial(): Row[] {
  return database().prepare('SELECT * FROM historial ORDER BY id DESC LIMIT 300').all() as Row[];
}

function getById<T>(table: string, id: number): T {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Identificador invalido.');
  const row = database().prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) as T | undefined;
  if (!row) throw new Error('Registro no encontrado.');
  return row;
}

export function dialogBackups(appRef: App): Row {
  return { userData: appRef.getPath('userData'), databasePath };
}
