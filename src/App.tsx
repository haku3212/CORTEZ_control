import { useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, BarChart3, BriefcaseBusiness, Check, ClipboardList, Factory, Gauge, History, Home, PackageCheck, Settings, Users } from 'lucide-react';
import { bsToCents, centsToBs, gramsToKg, kgToGrams } from '../shared/calculations';
import type { Configuracion, DashboardData, Empresa, Entrega, Lote, LoteResumen, Recepcion, Servicio, Trabajadora, TrabajadoraResumen } from '../shared/types';

type View = 'inicio' | 'empresas' | 'trabajadoras' | 'lotes' | 'entregas' | 'recepciones' | 'rendimiento' | 'respaldos' | 'configuracion' | 'historial';
type Notice = { type: 'ok' | 'error'; text: string } | null;
type Form = Record<string, string | number | boolean>;
type ConfirmDialog = { text: string; action: () => Promise<void> } | null;

const today = new Date().toISOString().slice(0, 10);
const timeNow = new Date().toTimeString().slice(0, 5);

function fmtKg(g: number | undefined): string {
  return `${gramsToKg(Number(g || 0)).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`;
}

function fmtBs(c: number | undefined): string {
  return `${centsToBs(Number(c || 0)).toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs`;
}

function fmtDate(value?: string): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

async function api<T>(channel: string, payload?: unknown): Promise<T> {
  const result = await window.almendra.invoke<T>(channel, payload);
  if (!result.ok) throw new Error(result.error || 'Operacion no completada.');
  return result.data as T;
}

const menu: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'empresas', label: 'Empresas', icon: Factory },
  { id: 'trabajadoras', label: 'Trabajadoras', icon: Users },
  { id: 'lotes', label: 'Lotes', icon: BriefcaseBusiness },
  { id: 'entregas', label: 'Entregas', icon: ClipboardList },
  { id: 'recepciones', label: 'Recepciones', icon: PackageCheck },
  { id: 'rendimiento', label: 'Rendimiento', icon: BarChart3 },
  { id: 'respaldos', label: 'Respaldos', icon: ArchiveRestore },
  { id: 'configuracion', label: 'Configuracion', icon: Settings },
  { id: 'historial', label: 'Historial', icon: History }
];

export default function App() {
  const [view, setView] = useState<View>('inicio');
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [trabajadoras, setTrabajadoras] = useState<Trabajadora[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [rendimiento, setRendimiento] = useState<TrabajadoraResumen[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [historial, setHistorial] = useState<Array<Record<string, unknown>>>([]);
  const [backups, setBackups] = useState<Array<Record<string, unknown>>>([]);
  const [backupInfo, setBackupInfo] = useState<Record<string, unknown>>({});
  const [selectedTrabajadora, setSelectedTrabajadora] = useState<TrabajadoraResumen | null>(null);
  const [selectedLote, setSelectedLote] = useState<LoteResumen | null>(null);
  const [selectedEntrega, setSelectedEntrega] = useState<Record<string, unknown> | null>(null);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [editingTrabajadora, setEditingTrabajadora] = useState<Trabajadora | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);

  const [empresaForm, setEmpresaForm] = useState<Form>({ codigo: '', nombre: '', servicio_principal: 'QUEBRADO', precio_servicio: '0' });
  const [trabForm, setTrabForm] = useState<Form>({ nombre_completo: '', tipo_trabajo: 'QUEBRADO', precio_quebrado: '0', precio_recorte: '0', fecha_ingreso: today });
  const [loteForm, setLoteForm] = useState<Form>({ empresa_id: '', tipo_servicio: 'QUEBRADO', fecha_recepcion: today, hora_recepcion: timeNow, persona_entrega: '', persona_recibe: '', peso_bruto: '', peso_envases: '0', cantidad_bolsas: 0, precio_servicio: '0', fecha_estimada_entrega: '' });
  const [entregaForm, setEntregaForm] = useState<Form>({ lote_id: '', trabajadora_id: '', fecha_entrega: today, hora_entrega: timeNow, peso_bruto: '', peso_envase: '0', cantidad_bolsas: 0, fecha_limite: today, hora_limite: '18:00', precio_trabajadora: '0', responsable_entrega: '' });
  const [recepcionForm, setRecepcionForm] = useState<Form>({ entrega_id: '', fecha_recepcion: today, hora_recepcion: timeNow, producto_bueno: '', producto_danado: '0', producto_podrido: '0', producto_amarillo: '0', producto_con_cascara: '0', cascara: '0', producto_quemado: '0', producto_manchado: '0', recorte_incompleto: '0', descarte: '0', residuos: '0', otros: '0', es_recepcion_final: false, requiere_reproceso: false, confirmar_exceso: false, responsable_recepcion: '', observaciones: '' });

  const selectedLoteForEntrega = lotes.find((l) => l.id === Number(entregaForm.lote_id));
  const compatibleTrabajadoras = useMemo(() => {
    if (!selectedLoteForEntrega) return trabajadoras.filter((t) => t.estado === 'ACTIVA');
    return trabajadoras.filter((t) => t.estado === 'ACTIVA' && (t.tipo_trabajo === 'AMBOS' || t.tipo_trabajo === selectedLoteForEntrega.tipo_servicio));
  }, [trabajadoras, selectedLoteForEntrega]);

  async function loadAll() {
    setLoading(true);
    try {
      const [d, e, t, l, en, r, c] = await Promise.all([
        api<DashboardData>('dashboard:get'),
        api<Empresa[]>('empresas:list'),
        api<Trabajadora[]>('trabajadoras:list'),
        api<Lote[]>('lotes:list'),
        api<Entrega[]>('entregas:list'),
        api<Recepcion[]>('recepciones:list'),
        api<Configuracion>('config:get')
      ]);
      setDashboard(d); setEmpresas(e); setTrabajadoras(t); setLotes(l); setEntregas(en); setRecepciones(r); setConfig(c);
      setRendimiento(await api<TrabajadoraResumen[]>('rendimiento:list', {}));
      setHistorial(await api<Array<Record<string, unknown>>>('historial:list'));
      setBackupInfo(await api<Record<string, unknown>>('backups:info'));
      setBackups(await api<Array<Record<string, unknown>>>('backups:list'));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  function showOk(text: string) {
    setNotice({ type: 'ok', text });
    window.setTimeout(() => setNotice(null), 4200);
  }

  function showError(error: unknown) {
    setNotice({ type: 'error', text: error instanceof Error ? error.message : String(error) });
  }

  function setForm(setter: (value: Form) => void, form: Form, key: string, value: string | boolean) {
    setter({ ...form, [key]: value });
  }

  function fieldText(value: Form[string] | undefined): string | number {
    return typeof value === 'boolean' ? '0' : value || '0';
  }

  function askConfirm(text: string, action: () => Promise<void>) {
    setConfirmDialog({ text, action });
  }

  function payloadEmpresa(): Form {
    return { ...empresaForm, precio_servicio_centavos: bsToCents(fieldText(empresaForm.precio_servicio)) };
  }

  async function saveEmpresa() {
    try {
      if (editingEmpresa) await api('empresas:update', { ...editingEmpresa, ...payloadEmpresa() });
      else await api('empresas:create', payloadEmpresa());
      setEmpresaForm({ codigo: '', nombre: '', servicio_principal: 'QUEBRADO', precio_servicio: '0' });
      setEditingEmpresa(null);
      showOk('Empresa guardada correctamente.');
      await loadAll();
    } catch (error) { showError(error); }
  }

  async function saveTrabajadora() {
    try {
      const payload = { ...trabForm, precio_quebrado_centavos: bsToCents(fieldText(trabForm.precio_quebrado)), precio_recorte_centavos: bsToCents(fieldText(trabForm.precio_recorte)) };
      if (editingTrabajadora) await api('trabajadoras:update', { ...editingTrabajadora, ...payload });
      else await api('trabajadoras:create', payload);
      setTrabForm({ nombre_completo: '', tipo_trabajo: 'QUEBRADO', precio_quebrado: '0', precio_recorte: '0', fecha_ingreso: today });
      setEditingTrabajadora(null);
      showOk('Trabajadora guardada correctamente.');
      await loadAll();
    } catch (error) { showError(error); }
  }

  async function saveLote() {
    try {
      await api('lotes:create', {
        ...loteForm,
        peso_bruto_g: kgToGrams(fieldText(loteForm.peso_bruto)),
        peso_envases_g: kgToGrams(fieldText(loteForm.peso_envases)),
        precio_servicio_centavos: bsToCents(fieldText(loteForm.precio_servicio))
      });
      setLoteForm({ empresa_id: '', tipo_servicio: 'QUEBRADO', fecha_recepcion: today, hora_recepcion: timeNow, persona_entrega: '', persona_recibe: '', peso_bruto: '', peso_envases: '0', cantidad_bolsas: 0, precio_servicio: '0', fecha_estimada_entrega: '' });
      showOk('Lote creado correctamente.');
      await loadAll();
    } catch (error) { showError(error); }
  }

  async function saveEntrega() {
    try {
      await api('entregas:create', {
        ...entregaForm,
        peso_bruto_g: kgToGrams(fieldText(entregaForm.peso_bruto)),
        peso_envase_g: kgToGrams(fieldText(entregaForm.peso_envase)),
        precio_trabajadora_centavos: bsToCents(fieldText(entregaForm.precio_trabajadora))
      });
      setEntregaForm({ lote_id: '', trabajadora_id: '', fecha_entrega: today, hora_entrega: timeNow, peso_bruto: '', peso_envase: '0', cantidad_bolsas: 0, fecha_limite: today, hora_limite: '18:00', precio_trabajadora: '0', responsable_entrega: '' });
      showOk('Entrega registrada correctamente.');
      await loadAll();
    } catch (error) { showError(error); }
  }

  async function saveRecepcion() {
    try {
      const kgFields = ['producto_bueno', 'producto_danado', 'producto_podrido', 'producto_amarillo', 'producto_con_cascara', 'cascara', 'producto_quemado', 'producto_manchado', 'recorte_incompleto', 'descarte', 'residuos', 'otros'];
      const payload: Form = { ...recepcionForm };
      kgFields.forEach((field) => { payload[`${field}_g`] = kgToGrams(fieldText(recepcionForm[field])); });
      await api('recepciones:create', payload);
      setRecepcionForm({ entrega_id: '', fecha_recepcion: today, hora_recepcion: timeNow, producto_bueno: '', producto_danado: '0', producto_podrido: '0', producto_amarillo: '0', producto_con_cascara: '0', cascara: '0', producto_quemado: '0', producto_manchado: '0', recorte_incompleto: '0', descarte: '0', residuos: '0', otros: '0', es_recepcion_final: false, requiere_reproceso: false, confirmar_exceso: false, responsable_recepcion: '', observaciones: '' });
      setSelectedEntrega(null);
      showOk('Recepcion registrada correctamente.');
      await loadAll();
    } catch (error) { showError(error); }
  }

  async function inspectEntrega(id: number) {
    try {
      const detail = await api<Record<string, unknown>>('entregas:detail', { id });
      setSelectedEntrega(detail);
    } catch (error) { showError(error); }
  }

  async function inspectLote(id: number) {
    try { setSelectedLote(await api<LoteResumen>('lotes:resumen', { id })); } catch (error) { showError(error); }
  }

  async function inspectTrabajadora(id: number) {
    try { setSelectedTrabajadora(await api<TrabajadoraResumen>('trabajadoras:resumen', { id })); } catch (error) { showError(error); }
  }

  async function createBackupNow() {
    try {
      const path = await api<string>('backups:create', {});
      showOk(`Respaldo creado: ${path}`);
      await loadAll();
    } catch (error) { showError(error); }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><Gauge size={30} /><div><strong>Control de Almendra</strong><span>Gestion local</span></div></div>
        <nav>
          {menu.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><Icon size={18} />{item.label}</button>;
          })}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div><h1>{menu.find((m) => m.id === view)?.label}</h1><p>Sistema local para quebrado y recorte de almendra</p></div>
          <button className="primary" onClick={() => void loadAll()} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar'}</button>
        </header>
        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
        {view === 'inicio' && dashboard && <Dashboard data={dashboard} />}
        {view === 'empresas' && <section><Panel title={editingEmpresa ? 'Editar empresa' : 'Registrar empresa'}><div className="grid form">
          <Input label="Codigo" value={empresaForm.codigo} disabled={Boolean(editingEmpresa)} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'codigo', v)} />
          <Input label="Nombre" value={empresaForm.nombre} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'nombre', v)} />
          <Select label="Servicio" value={empresaForm.servicio_principal} options={['QUEBRADO', 'RECORTE']} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'servicio_principal', v)} />
          <Input label="Responsable" value={empresaForm.responsable} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'responsable', v)} />
          <Input label="Telefono" value={empresaForm.telefono} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'telefono', v)} />
          <Input label="Precio servicio Bs/kg" value={empresaForm.precio_servicio} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'precio_servicio', v)} />
          <Input label="Direccion" value={empresaForm.direccion} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'direccion', v)} />
          <Input label="Forma de pago" value={empresaForm.forma_pago} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'forma_pago', v)} />
          <Input label="Observaciones" value={empresaForm.observaciones} onChange={(v) => setForm(setEmpresaForm, empresaForm, 'observaciones', v)} />
        </div><Actions><button className="primary" onClick={() => void saveEmpresa()}>Guardar empresa</button>{editingEmpresa && <button onClick={() => setEditingEmpresa(null)}>Cancelar edicion</button>}</Actions></Panel>
        <Panel title="Empresas registradas"><Table headers={['Codigo','Nombre','Servicio','Precio','Estado','Acciones']} rows={empresas.map((e) => [e.codigo, e.nombre, e.servicio_principal, fmtBs(e.precio_servicio_centavos), e.activa ? 'Activa' : 'Inactiva', <RowActions key={e.id}><button onClick={() => { setEditingEmpresa(e); setEmpresaForm({ ...e, precio_servicio: centsToBs(e.precio_servicio_centavos).toString() }); }}>Editar</button><button onClick={() => askConfirm('Desactivar esta empresa?', async () => { await api('empresas:deactivate', { id: e.id }); await loadAll(); showOk('Empresa desactivada.'); })}>Desactivar</button></RowActions>])} /></Panel></section>}
        {view === 'trabajadoras' && <section><Panel title={editingTrabajadora ? 'Editar trabajadora' : 'Registrar trabajadora'}><div className="grid form">
          <Input label="Nombre completo" value={trabForm.nombre_completo} onChange={(v) => setForm(setTrabForm, trabForm, 'nombre_completo', v)} />
          <Input label="Cedula" value={trabForm.cedula} onChange={(v) => setForm(setTrabForm, trabForm, 'cedula', v)} />
          <Input label="Telefono" value={trabForm.telefono} onChange={(v) => setForm(setTrabForm, trabForm, 'telefono', v)} />
          <Select label="Tipo de trabajo" value={trabForm.tipo_trabajo} options={['QUEBRADO', 'RECORTE', 'AMBOS']} onChange={(v) => setForm(setTrabForm, trabForm, 'tipo_trabajo', v)} />
          <Input label="Precio quebrado Bs/kg" value={trabForm.precio_quebrado} onChange={(v) => setForm(setTrabForm, trabForm, 'precio_quebrado', v)} />
          <Input label="Precio recorte Bs/kg" value={trabForm.precio_recorte} onChange={(v) => setForm(setTrabForm, trabForm, 'precio_recorte', v)} />
          <Input label="Fecha ingreso" type="date" value={trabForm.fecha_ingreso} onChange={(v) => setForm(setTrabForm, trabForm, 'fecha_ingreso', v)} />
          {editingTrabajadora && <Select label="Estado" value={trabForm.estado} options={['ACTIVA', 'INACTIVA', 'SUSPENDIDA']} onChange={(v) => setForm(setTrabForm, trabForm, 'estado', v)} />}
          <Input label="Direccion" value={trabForm.direccion} onChange={(v) => setForm(setTrabForm, trabForm, 'direccion', v)} />
        </div><Actions><button className="primary" onClick={() => void saveTrabajadora()}>Guardar trabajadora</button>{editingTrabajadora && <button onClick={() => setEditingTrabajadora(null)}>Cancelar edicion</button>}</Actions></Panel>
        <Panel title="Trabajadoras"><Table headers={['Codigo','Nombre','Tipo','Estado','Q Bs/kg','R Bs/kg','Acciones']} rows={trabajadoras.map((t) => [t.codigo, t.nombre_completo, t.tipo_trabajo, tag(t.estado), fmtBs(t.precio_quebrado_centavos), fmtBs(t.precio_recorte_centavos), <RowActions key={t.id}><button onClick={() => { setEditingTrabajadora(t); setTrabForm({ ...t, precio_quebrado: centsToBs(t.precio_quebrado_centavos).toString(), precio_recorte: centsToBs(t.precio_recorte_centavos).toString() }); }}>Editar</button><button onClick={() => void inspectTrabajadora(t.id)}>Ficha</button><button onClick={() => askConfirm('Desactivar esta trabajadora?', async () => { await api('trabajadoras:deactivate', { id: t.id }); await loadAll(); showOk('Trabajadora desactivada.'); })}>Desactivar</button></RowActions>])} /></Panel>{selectedTrabajadora && <FichaTrabajadora item={selectedTrabajadora} />}</section>}
        {view === 'lotes' && <section><Panel title="Recibir lote"><div className="grid form">
          <Select label="Empresa" value={loteForm.empresa_id} options={empresas.filter(e => e.activa).map(e => [e.id, `${e.codigo} - ${e.nombre}`])} onChange={(v) => setForm(setLoteForm, loteForm, 'empresa_id', v)} />
          <Select label="Servicio" value={loteForm.tipo_servicio} options={['QUEBRADO','RECORTE']} onChange={(v) => setForm(setLoteForm, loteForm, 'tipo_servicio', v)} />
          <Input label="Fecha recepcion" type="date" value={loteForm.fecha_recepcion} onChange={(v) => setForm(setLoteForm, loteForm, 'fecha_recepcion', v)} />
          <Input label="Hora recepcion" type="time" value={loteForm.hora_recepcion} onChange={(v) => setForm(setLoteForm, loteForm, 'hora_recepcion', v)} />
          <Input label="Persona entrega" value={loteForm.persona_entrega} onChange={(v) => setForm(setLoteForm, loteForm, 'persona_entrega', v)} />
          <Input label="Persona recibe" value={loteForm.persona_recibe} onChange={(v) => setForm(setLoteForm, loteForm, 'persona_recibe', v)} />
          <Input label="Peso bruto kg" value={loteForm.peso_bruto} onChange={(v) => setForm(setLoteForm, loteForm, 'peso_bruto', v)} />
          <Input label="Peso envases kg" value={loteForm.peso_envases} onChange={(v) => setForm(setLoteForm, loteForm, 'peso_envases', v)} />
          <Input label="Bolsas" value={loteForm.cantidad_bolsas} onChange={(v) => setForm(setLoteForm, loteForm, 'cantidad_bolsas', v)} />
          <Input label="Precio servicio Bs/kg" value={loteForm.precio_servicio} onChange={(v) => setForm(setLoteForm, loteForm, 'precio_servicio', v)} />
          <Input label="Fecha estimada" type="date" value={loteForm.fecha_estimada_entrega} onChange={(v) => setForm(setLoteForm, loteForm, 'fecha_estimada_entrega', v)} />
        </div><Actions><button className="primary" onClick={() => void saveLote()}>Crear lote</button></Actions></Panel><Panel title="Lotes"><Table headers={['Codigo','Empresa','Servicio','Neto','Estado','Acciones']} rows={lotes.map((l) => [l.codigo, l.empresa_nombre, l.tipo_servicio, fmtKg(l.peso_neto_g), tag(l.estado), <RowActions key={l.id}><button onClick={() => void inspectLote(l.id)}>Ficha</button><button onClick={() => void api('lotes:updateEstado', { id: l.id, estado: 'CERRADO' }).then(loadAll).then(() => showOk('Lote cerrado.')).catch(showError)}>Cerrar</button></RowActions>])} /></Panel>{selectedLote && <FichaLote item={selectedLote} />}</section>}
        {view === 'entregas' && <section><Panel title="Entregar almendra a trabajadora"><div className="grid form">
          <Select label="Lote" value={entregaForm.lote_id} options={lotes.filter(l => !['CERRADO','ENTREGADO'].includes(l.estado)).map(l => [l.id, `${l.codigo} - ${l.empresa_nombre} - ${fmtKg(l.peso_neto_g)}`])} onChange={(v) => setForm(setEntregaForm, entregaForm, 'lote_id', v)} />
          <Select label="Trabajadora compatible" value={entregaForm.trabajadora_id} options={compatibleTrabajadoras.map(t => [t.id, `${t.codigo} - ${t.nombre_completo}`])} onChange={(v) => {
            const t = trabajadoras.find(x => x.id === Number(v)); const price = selectedLoteForEntrega?.tipo_servicio === 'RECORTE' ? t?.precio_recorte_centavos : t?.precio_quebrado_centavos;
            setEntregaForm({ ...entregaForm, trabajadora_id: v, precio_trabajadora: centsToBs(price || 0).toString() });
          }} />
          <Input label="Fecha entrega" type="date" value={entregaForm.fecha_entrega} onChange={(v) => setForm(setEntregaForm, entregaForm, 'fecha_entrega', v)} />
          <Input label="Hora entrega" type="time" value={entregaForm.hora_entrega} onChange={(v) => setForm(setEntregaForm, entregaForm, 'hora_entrega', v)} />
          <Input label="Peso bruto kg" value={entregaForm.peso_bruto} onChange={(v) => setForm(setEntregaForm, entregaForm, 'peso_bruto', v)} />
          <Input label="Peso envase kg" value={entregaForm.peso_envase} onChange={(v) => setForm(setEntregaForm, entregaForm, 'peso_envase', v)} />
          <Input label="Bolsas" value={entregaForm.cantidad_bolsas} onChange={(v) => setForm(setEntregaForm, entregaForm, 'cantidad_bolsas', v)} />
          <Input label="Fecha limite" type="date" value={entregaForm.fecha_limite} onChange={(v) => setForm(setEntregaForm, entregaForm, 'fecha_limite', v)} />
          <Input label="Hora limite" type="time" value={entregaForm.hora_limite} onChange={(v) => setForm(setEntregaForm, entregaForm, 'hora_limite', v)} />
          <Input label="Precio trabajadora Bs/kg" value={entregaForm.precio_trabajadora} onChange={(v) => setForm(setEntregaForm, entregaForm, 'precio_trabajadora', v)} />
          <Input label="Responsable entrega" value={entregaForm.responsable_entrega} onChange={(v) => setForm(setEntregaForm, entregaForm, 'responsable_entrega', v)} />
        </div>{selectedLoteForEntrega && <p className="hint">Lote seleccionado: {selectedLoteForEntrega.empresa_nombre}, servicio {selectedLoteForEntrega.tipo_servicio}. Use ficha de lote para ver saldo disponible exacto.</p>}<Actions><button className="primary" onClick={() => void saveEntrega()}>Registrar entrega</button></Actions></Panel><Panel title="Entregas"><Table headers={['Numero','Lote','Trabajadora','Neto','Limite','Estado']} rows={entregas.map((e) => [e.numero, e.lote_codigo, e.trabajadora_nombre, fmtKg(e.peso_neto_g), `${fmtDate(e.fecha_limite)} ${e.hora_limite}`, tag(e.estado)])} /></Panel></section>}
        {view === 'recepciones' && <section><Panel title="Registrar devolucion parcial o final"><div className="grid form">
          <Select label="Entrega" value={recepcionForm.entrega_id} options={entregas.filter(e => e.estado !== 'TERMINADA').map(e => [e.id, `${e.numero} - ${e.trabajadora_nombre} - ${fmtKg(e.peso_neto_g)}`])} onChange={(v) => { setForm(setRecepcionForm, recepcionForm, 'entrega_id', v); void inspectEntrega(Number(v)); }} />
          <Input label="Fecha recepcion" type="date" value={recepcionForm.fecha_recepcion} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'fecha_recepcion', v)} />
          <Input label="Hora recepcion" type="time" value={recepcionForm.hora_recepcion} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'hora_recepcion', v)} />
          <Input label="Producto bueno kg" value={recepcionForm.producto_bueno} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'producto_bueno', v)} />
          <Input label="Danado/quebrado kg" value={recepcionForm.producto_danado} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'producto_danado', v)} />
          <Input label="Podrido kg" value={recepcionForm.producto_podrido} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'producto_podrido', v)} />
          <Input label="Amarillo kg" value={recepcionForm.producto_amarillo} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'producto_amarillo', v)} />
          {selectedEntrega?.tipo_servicio === 'QUEBRADO' && <><Input label="Con cascara kg" value={recepcionForm.producto_con_cascara} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'producto_con_cascara', v)} /><Input label="Cascara kg" value={recepcionForm.cascara} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'cascara', v)} /></>}
          {selectedEntrega?.tipo_servicio === 'RECORTE' && <><Input label="Quemado kg" value={recepcionForm.producto_quemado} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'producto_quemado', v)} /><Input label="Manchado kg" value={recepcionForm.producto_manchado} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'producto_manchado', v)} /><Input label="Recorte incompleto kg" value={recepcionForm.recorte_incompleto} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'recorte_incompleto', v)} /></>}
          <Input label="Descarte kg" value={recepcionForm.descarte} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'descarte', v)} />
          <Input label="Residuos kg" value={recepcionForm.residuos} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'residuos', v)} />
          <Input label="Otros kg" value={recepcionForm.otros} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'otros', v)} />
          <Input label="Responsable recepcion" value={recepcionForm.responsable_recepcion} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'responsable_recepcion', v)} />
          <Input label="Observaciones" value={recepcionForm.observaciones} onChange={(v) => setForm(setRecepcionForm, recepcionForm, 'observaciones', v)} />
        </div><div className="checks"><label><input type="checkbox" checked={Boolean(recepcionForm.es_recepcion_final)} onChange={(e) => setForm(setRecepcionForm, recepcionForm, 'es_recepcion_final', e.target.checked)} /> Recepcion final</label><label><input type="checkbox" checked={Boolean(recepcionForm.requiere_reproceso)} onChange={(e) => setForm(setRecepcionForm, recepcionForm, 'requiere_reproceso', e.target.checked)} /> Requiere reproceso</label><label><input type="checkbox" checked={Boolean(recepcionForm.confirmar_exceso)} onChange={(e) => setForm(setRecepcionForm, recepcionForm, 'confirmar_exceso', e.target.checked)} /> Confirmar exceso</label></div>{selectedEntrega && <p className="hint">Pendiente antes de recepcion: {fmtKg(Number(selectedEntrega.pendiente_g))}. Lote {String(selectedEntrega.lote_codigo)} de {String(selectedEntrega.empresa_nombre)}.</p>}<Actions><button className="primary" onClick={() => void saveRecepcion()}>Registrar recepcion</button></Actions></Panel><Panel title="Recepciones"><Table headers={['Numero','Entrega','Fecha','Procesado','Bueno','Final']} rows={recepciones.map((r) => [r.numero, r.entrega_id, fmtDate(r.fecha_recepcion), fmtKg(r.peso_procesado_g), fmtKg(r.producto_bueno_g), r.es_recepcion_final ? 'Si' : 'No'])} /></Panel></section>}
        {view === 'rendimiento' && <section><Panel title="Rendimiento de trabajadoras"><Table headers={['Nombre','Trabajos','Procesado','Bueno','Rendimiento','Productividad','Atrasadas']} rows={rendimiento.map((r) => [r.trabajadora.nombre_completo, r.entregas_terminadas, fmtKg(r.kg_procesados_g), `${r.rendimiento_ponderado.toFixed(2)}%`, `${r.rendimiento_ponderado.toFixed(2)}%`, `${r.productividad_promedio.toFixed(2)} kg/h`, r.entregas_atrasadas])} /></Panel></section>}
        {view === 'respaldos' && <section><Panel title="Base de datos y respaldos"><p><strong>Base SQLite:</strong> {String(backupInfo.databasePath || '')}</p><p><strong>Carpeta de respaldos:</strong> {String(backupInfo.backupFolder || '')}</p><Actions><button className="primary" onClick={() => void createBackupNow()}>Crear copia manual</button></Actions></Panel><Panel title="Respaldos existentes"><Table headers={['Archivo','Fecha','Tamano','Acciones']} rows={backups.map((b) => [String(b.nombre), fmtDate(String(b.fecha)), `${(Number(b.tamano) / 1024).toFixed(1)} KB`, <button key={String(b.ruta)} onClick={() => askConfirm('Restaurar este respaldo? Se creara una copia antes de restaurar.', async () => { await api('backups:restore', { path: b.ruta }); await loadAll(); showOk('Respaldo restaurado.'); })}>Restaurar</button>])} /></Panel></section>}
        {view === 'configuracion' && config && <section><Panel title="Configuracion"><div className="grid form"><Input label="Nombre del negocio" value={config.nombre_negocio} onChange={(v) => setConfig({ ...config, nombre_negocio: v })} /><Input label="Responsable" value={config.responsable} onChange={(v) => setConfig({ ...config, responsable: v })} /><Input label="Telefono" value={config.telefono} onChange={(v) => setConfig({ ...config, telefono: v })} /><Input label="Direccion" value={config.direccion} onChange={(v) => setConfig({ ...config, direccion: v })} /><Input label="Tolerancia kg" value={gramsToKg(config.tolerancia_diferencia_g).toString()} onChange={(v) => setConfig({ ...config, tolerancia_diferencia_g: kgToGrams(v || '0') })} /><Input label="Carpeta respaldos" value={config.carpeta_respaldos} onChange={(v) => setConfig({ ...config, carpeta_respaldos: v })} /><Input label="Moneda" value={config.moneda} onChange={(v) => setConfig({ ...config, moneda: v })} /><Input label="Unidad peso" value={config.unidad_peso} onChange={(v) => setConfig({ ...config, unidad_peso: v })} /></div><Actions><button className="primary" onClick={() => void api('config:update', config).then(loadAll).then(() => showOk('Configuracion guardada.')).catch(showError)}>Guardar configuracion</button></Actions></Panel></section>}
        {view === 'historial' && <section><Panel title="Historial del sistema"><Table headers={['Fecha','Modulo','Accion','Descripcion']} rows={historial.map((h) => [fmtDate(String(h.fecha_hora)), String(h.modulo), String(h.accion), String(h.descripcion)])} /></Panel></section>}
        {confirmDialog && <div className="modal-backdrop"><div className="modal"><h2>Confirmar accion</h2><p>{confirmDialog.text}</p><Actions><button onClick={() => setConfirmDialog(null)}>Cancelar</button><button className="primary" onClick={() => {
          const action = confirmDialog.action;
          setConfirmDialog(null);
          void action().catch(showError);
        }}><Check size={16} />Confirmar</button></Actions></div></div>}
      </main>
    </div>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const cards = [
    ['Lotes activos', data.lotesActivos], ['Lotes terminados', data.lotesTerminados], ['Kg recibidos', data.kgRecibidos.toFixed(2)], ['Kg disponibles', data.kgDisponibles.toFixed(2)], ['Kg en manos', data.kgEnManos.toFixed(2)], ['Entregas pendientes', data.entregasPendientes], ['Entregas atrasadas', data.entregasAtrasadas], ['Trabajadoras activas', data.trabajadorasActivas], ['Rend. quebrado', `${data.rendimientoQuebrado.toFixed(2)}%`], ['Rend. recorte', `${data.rendimientoRecorte.toFixed(2)}%`]
  ];
  return <section><div className="metrics">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="two"><Panel title="Entregas proximas a vencer"><Table headers={['Numero','Trabajadora','Limite','Estado']} rows={data.proximas.map(e => [e.numero, e.trabajadora_nombre, `${fmtDate(e.fecha_limite)} ${e.hora_limite}`, tag(e.estado)])} /></Panel><Panel title="Entregas atrasadas"><Table headers={['Numero','Trabajadora','Limite','Estado']} rows={data.atrasadas.map(e => [e.numero, e.trabajadora_nombre, `${fmtDate(e.fecha_limite)} ${e.hora_limite}`, tag(e.estado)])} /></Panel></div></section>;
}

function FichaLote({ item }: { item: LoteResumen }) {
  return <Panel title={`Ficha de lote ${item.lote.codigo}`}><div className="metrics small">{[['Neto recibido', fmtKg(item.lote.peso_neto_g)], ['Entregado', fmtKg(item.entregado_g)], ['Disponible', fmtKg(item.disponible_g)], ['Procesado', fmtKg(item.procesado_g)], ['Pendiente trabajadoras', fmtKg(item.pendiente_trabajadoras_g)], ['Producto bueno', fmtKg(item.producto_bueno_g)], ['Descarte', fmtKg(item.descarte_g)], ['Residuos', fmtKg(item.residuos_g)], ['Diferencia', fmtKg(item.diferencia_no_justificada_g)], ['Rendimiento', `${item.rendimiento.toFixed(2)}%`]].map(([a,b]) => <article key={a}><span>{a}</span><strong>{b}</strong></article>)}</div></Panel>;
}

function FichaTrabajadora({ item }: { item: TrabajadoraResumen }) {
  return <Panel title={`Ficha de ${item.trabajadora.nombre_completo}`}><div className="metrics small">{[['Entregas', item.cantidad_entregas], ['Kg recibidos', fmtKg(item.kg_recibidos_g)], ['Kg procesados', fmtKg(item.kg_procesados_g)], ['Kg pendientes', fmtKg(item.kg_pendientes_g)], ['Rend. promedio', `${item.rendimiento_promedio.toFixed(2)}%`], ['Rend. ponderado', `${item.rendimiento_ponderado.toFixed(2)}%`], ['Productividad', `${item.productividad_promedio.toFixed(2)} kg/h`], ['Tiempo promedio', `${item.tiempo_promedio_horas.toFixed(2)} h`], ['Terminadas', item.entregas_terminadas], ['Atrasadas', item.entregas_atrasadas]].map(([a,b]) => <article key={a}><span>{a}</span><strong>{b}</strong></article>)}</div></Panel>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="actions">{children}</div>;
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="row-actions">{children}</div>;
}

function Input({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: unknown; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label><span>{label}</span><input disabled={disabled} type={type} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: unknown; options: Array<string | [string | number, string]>; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}><option value="">Seleccione</option>{options.map((option) => Array.isArray(option) ? <option key={option[0]} value={option[0]}>{option[1]}</option> : <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  if (rows.length === 0) return <div className="empty">No hay registros para mostrar.</div>;
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function tag(value: string) {
  return <span className={`tag ${value.toLowerCase()}`}>{value.replace(/_/g, ' ')}</span>;
}
