export type Servicio = 'QUEBRADO' | 'RECORTE';
export type TipoTrabajo = Servicio | 'AMBOS';
export type EstadoTrabajadora = 'ACTIVA' | 'INACTIVA' | 'SUSPENDIDA';
export type EstadoLote = 'RECIBIDO' | 'EN_PROCESO' | 'PARCIALMENTE_TERMINADO' | 'TERMINADO' | 'ENTREGADO' | 'CERRADO';
export type EstadoEntrega = 'ENTREGADA' | 'EN_PROCESO' | 'DEVOLUCION_PARCIAL' | 'TERMINADA' | 'ATRASADA' | 'REQUIERE_REPROCESO';

export interface Empresa {
  id: number;
  codigo: string;
  nombre: string;
  servicio_principal: Servicio;
  responsable: string;
  telefono: string;
  direccion: string;
  precio_servicio_centavos: number;
  forma_pago: string;
  observaciones: string;
  activa: number;
  creado_en: string;
  actualizado_en: string;
}

export interface Trabajadora {
  id: number;
  codigo: string;
  nombre_completo: string;
  cedula: string;
  telefono: string;
  direccion: string;
  tipo_trabajo: TipoTrabajo;
  precio_quebrado_centavos: number;
  precio_recorte_centavos: number;
  fecha_ingreso: string;
  observaciones: string;
  estado: EstadoTrabajadora;
  creado_en: string;
  actualizado_en: string;
}

export interface Lote {
  id: number;
  codigo: string;
  empresa_id: number;
  empresa_nombre?: string;
  empresa_codigo?: string;
  tipo_servicio: Servicio;
  fecha_recepcion: string;
  hora_recepcion: string;
  persona_entrega: string;
  persona_recibe: string;
  peso_bruto_g: number;
  peso_envases_g: number;
  peso_neto_g: number;
  cantidad_bolsas: number;
  precio_servicio_centavos: number;
  fecha_estimada_entrega: string;
  estado: EstadoLote;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
}

export interface Entrega {
  id: number;
  numero: string;
  lote_id: number;
  lote_codigo?: string;
  trabajadora_id: number;
  trabajadora_nombre?: string;
  tipo_servicio?: Servicio;
  fecha_entrega: string;
  hora_entrega: string;
  peso_bruto_g: number;
  peso_envase_g: number;
  peso_neto_g: number;
  cantidad_bolsas: number;
  fecha_limite: string;
  hora_limite: string;
  precio_trabajadora_centavos: number;
  responsable_entrega: string;
  estado: EstadoEntrega;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
}

export interface Recepcion {
  id: number;
  numero: string;
  entrega_id: number;
  fecha_recepcion: string;
  hora_recepcion: string;
  peso_procesado_g: number;
  producto_bueno_g: number;
  producto_danado_g: number;
  producto_podrido_g: number;
  producto_amarillo_g: number;
  producto_con_cascara_g: number;
  cascara_g: number;
  producto_quemado_g: number;
  producto_manchado_g: number;
  recorte_incompleto_g: number;
  descarte_g: number;
  residuos_g: number;
  otros_g: number;
  diferencia_no_justificada_g: number;
  es_recepcion_final: number;
  requiere_reproceso: number;
  total_pago_centavos: number;
  responsable_recepcion: string;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
}

export interface RetiroEmpresa {
  id: number;
  numero: string;
  empresa_id: number;
  empresa_nombre?: string;
  empresa_codigo?: string;
  tipo_servicio: Servicio;
  fecha_retiro: string;
  hora_retiro: string;
  persona_entrega: string;
  persona_recoge: string;
  lugar_retiro: string;
  transporte: string;
  peso_bruto_g: number;
  peso_envases_g: number;
  peso_neto_g: number;
  cantidad_bolsas: number;
  estado: string;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
}

export interface PrecioCategoria {
  id: number;
  tipo_servicio: Servicio;
  categoria: string;
  nombre: string;
  precio_centavos: number;
  activa: number;
  actualizado_en: string;
}

export interface Configuracion {
  nombre_negocio: string;
  responsable: string;
  telefono: string;
  direccion: string;
  tolerancia_diferencia_g: number;
  carpeta_respaldos: string;
  moneda: string;
  unidad_peso: string;
}

export interface DashboardData {
  lotesActivos: number;
  lotesTerminados: number;
  kgRecibidos: number;
  kgDisponibles: number;
  kgEnManos: number;
  entregasPendientes: number;
  entregasAtrasadas: number;
  trabajadorasActivas: number;
  rendimientoQuebrado: number;
  rendimientoRecorte: number;
  proximas: Entrega[];
  atrasadas: Entrega[];
}

export interface LoteResumen {
  lote: Lote;
  entregado_g: number;
  disponible_g: number;
  procesado_g: number;
  pendiente_trabajadoras_g: number;
  producto_bueno_g: number;
  descarte_g: number;
  residuos_g: number;
  diferencia_no_justificada_g: number;
  rendimiento: number;
}

export interface TrabajadoraResumen {
  trabajadora: Trabajadora;
  cantidad_entregas: number;
  kg_recibidos_g: number;
  kg_procesados_g: number;
  kg_pendientes_g: number;
  rendimiento_promedio: number;
  rendimiento_ponderado: number;
  productividad_promedio: number;
  tiempo_promedio_horas: number;
  entregas_terminadas: number;
  entregas_atrasadas: number;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
