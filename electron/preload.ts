import { contextBridge, ipcRenderer } from 'electron';

const allowedChannels = new Set([
  'dashboard:get',
  'empresas:list',
  'empresas:create',
  'empresas:update',
  'empresas:deactivate',
  'trabajadoras:list',
  'trabajadoras:create',
  'trabajadoras:update',
  'trabajadoras:deactivate',
  'trabajadoras:resumen',
  'lotes:list',
  'lotes:create',
  'lotes:updateEstado',
  'lotes:resumen',
  'entregas:list',
  'entregas:create',
  'entregas:detail',
  'recepciones:list',
  'recepciones:create',
  'rendimiento:list',
  'historial:list',
  'config:get',
  'config:update',
  'backups:info',
  'backups:create',
  'backups:list',
  'backups:restore'
]);

contextBridge.exposeInMainWorld('almendra', {
  invoke: (channel: string, payload?: unknown) => {
    if (!allowedChannels.has(channel)) {
      return Promise.resolve({ ok: false, error: 'Operacion no permitida.' });
    }
    return ipcRenderer.invoke(channel, payload);
  }
});
