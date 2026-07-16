# Control de Almendra

Aplicacion local de escritorio para Windows destinada al control de servicios de quebrado y recorte de almendra. Funciona sin internet y guarda la informacion en SQLite dentro de la carpeta persistente de Electron.

## Tecnologias

- Electron con `contextIsolation: true` y `nodeIntegration: false`.
- React, TypeScript y Vite.
- SQLite con `better-sqlite3`.
- Vitest para pruebas unitarias.
- electron-builder para instalador de Windows.

## Requisitos

- Node.js 20 o superior.
- Windows para generar y probar el instalador NSIS.

## Instalacion y ejecucion

```bash
npm install
npm run dev
```

## Comandos disponibles

```bash
npm test
npm run typecheck
npm run build
npm run dist
npm run seed:demo
npm run reset:demo -- --confirmar
```

## Ubicacion de la base de datos

La base se crea en `app.getPath('userData')` con el nombre `control-almendra.db`. En Windows normalmente queda en:

```text
%APPDATA%\control-almendra\control-almendra.db
```

La pantalla Respaldos muestra la ruta exacta en cada instalacion.

## Respaldos y restauracion

En Respaldos se puede crear una copia manual, listar archivos existentes y restaurar un respaldo. Antes de restaurar se genera una copia automatica en la carpeta `antes-de-restaurar`. Al cerrar la aplicacion se crea un respaldo automatico si hubo cambios.

## Estructura

```text
electron/          Proceso principal, preload, IPC y SQLite
src/               Interfaz React
shared/            Tipos y calculos reutilizables
tests/             Pruebas unitarias
scripts/           Datos demo opcionales
resources/         Recursos para empaquetado
```

## Instalador

```bash
npm run dist
```

El instalador se genera en `release/`.

## Errores comunes

- Si `better-sqlite3` falla durante instalacion, verifique que Node.js sea compatible y que exista acceso a las herramientas de compilacion requeridas por paquetes nativos.
- Si la app no abre en modo desarrollo, ejecute primero `npm run build` para confirmar que Electron compila.
- Si un respaldo no aparece, revise que la carpeta configurada exista y tenga permisos de escritura.
