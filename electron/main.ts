import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { registerIpcHandlers } from './ipc/handlers';
import { closeDatabase, initializeDatabase, hasDatabaseChanges, createAutomaticBackup } from './database/store';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'Control de Almendra',
    backgroundColor: '#f6f7f3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function logStartupError(error: unknown): void {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'errores.log'), `[${new Date().toISOString()}] ${String(error)}\n`);
}

app.whenReady().then(() => {
  try {
    initializeDatabase(app.getPath('userData'));
    registerIpcHandlers(ipcMain, app);
    createWindow();
  } catch (error) {
    logStartupError(error);
    throw error;
  }
});

app.on('window-all-closed', async () => {
  if (hasDatabaseChanges()) {
    try {
      await createAutomaticBackup();
    } catch (error) {
      logStartupError(error);
    }
  }
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
