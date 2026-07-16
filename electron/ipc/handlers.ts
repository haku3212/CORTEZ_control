import type { App, IpcMain } from 'electron';
import {
  backupInfo,
  createBackup,
  createEmpresa,
  createEntrega,
  createLote,
  createRecepcion,
  createTrabajadora,
  deactivateEmpresa,
  deactivateTrabajadora,
  dialogBackups,
  getConfiguracion,
  getDashboard,
  getEntregaDetail,
  getLoteResumen,
  getTrabajadoraResumen,
  listBackups,
  listEmpresas,
  listEntregas,
  listHistorial,
  listLotes,
  listRecepciones,
  listRendimiento,
  listTrabajadoras,
  restoreBackup,
  updateConfiguracion,
  updateEmpresa,
  updateLoteEstado,
  updateTrabajadora
} from '../database/store';
import type { ApiResult, EstadoLote } from '../../shared/types';

type Handler = (payload: unknown) => unknown;

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function fail(error: unknown): ApiResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
}

export function registerIpcHandlers(ipcMain: IpcMain, app: App): void {
  const handlers: Record<string, Handler> = {
    'dashboard:get': () => getDashboard(),
    'empresas:list': (payload) => listEmpresas(String(asRecord(payload).search || '')),
    'empresas:create': (payload) => createEmpresa(asRecord(payload)),
    'empresas:update': (payload) => updateEmpresa(asRecord(payload)),
    'empresas:deactivate': (payload) => deactivateEmpresa(Number(asRecord(payload).id)),
    'trabajadoras:list': (payload) => listTrabajadoras(asRecord(payload)),
    'trabajadoras:create': (payload) => createTrabajadora(asRecord(payload)),
    'trabajadoras:update': (payload) => updateTrabajadora(asRecord(payload)),
    'trabajadoras:deactivate': (payload) => deactivateTrabajadora(Number(asRecord(payload).id)),
    'trabajadoras:resumen': (payload) => getTrabajadoraResumen(Number(asRecord(payload).id)),
    'lotes:list': () => listLotes(),
    'lotes:create': (payload) => createLote(asRecord(payload)),
    'lotes:updateEstado': (payload) => updateLoteEstado(Number(asRecord(payload).id), String(asRecord(payload).estado) as EstadoLote),
    'lotes:resumen': (payload) => getLoteResumen(Number(asRecord(payload).id)),
    'entregas:list': () => listEntregas(),
    'entregas:create': (payload) => createEntrega(asRecord(payload)),
    'entregas:detail': (payload) => getEntregaDetail(Number(asRecord(payload).id)),
    'recepciones:list': () => listRecepciones(),
    'recepciones:create': (payload) => createRecepcion(asRecord(payload)),
    'rendimiento:list': (payload) => listRendimiento(asRecord(payload)),
    'historial:list': () => listHistorial(),
    'config:get': () => getConfiguracion(),
    'config:update': (payload) => updateConfiguracion(asRecord(payload)),
    'backups:info': () => ({ ...backupInfo(), ...dialogBackups(app) }),
    'backups:create': (payload) => createBackup(String(asRecord(payload).folder || '')),
    'backups:list': (payload) => listBackups(String(asRecord(payload).folder || '')),
    'backups:restore': (payload) => restoreBackup(String(asRecord(payload).path || ''))
  };

  Object.entries(handlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return ok(await handler(payload));
      } catch (error) {
        return fail(error);
      }
    });
  });
}
