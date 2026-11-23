# Hojas de vida — Equipos de gases medicinales · Clínica Reina Catalina

PWA para llenar la hoja de vida de los equipos del Departamento de Gases Medicinales (compresores, bombas de vacío, SAM, generadores de oxígeno, secadores, tanques pulmón…), registrar sus mantenimientos —hechos por técnicos de la clínica o por un proveedor— y sacar el PDF con el formato **FMT-004 · Versión 1 · 25/03/2012**.

Funciona sin señal: todo se guarda primero en el teléfono y se sube a la hoja de Google cuando vuelve la conexión.

## Archivos

- Van al repositorio de GitHub: `index.html`, `app.js`, `iconos.js`, `config.js`, `sw.js`, `manifest.webmanifest`, `logo.jpg`, los tres íconos y la carpeta `lib` (generador de PDF).
- Van al Apps Script de la hoja: `apps-script/Code.gs` y `apps-script/appsscript.json`.

## Paso 1: hoja y Apps Script (desde el PC, con la cuenta cilindrocrc@gmail.com)

1. En Drive crea una hoja de cálculo nueva y llámala **Hojas de vida - Gases medicinales**.
2. Abre **Extensiones → Apps Script**.
3. En **Configuración del proyecto** (engranaje) marca **Mostrar el archivo de manifiesto "appsscript.json" en el editor**.
4. Vuelve al **Editor**: en `appsscript.json` pega el contenido de `apps-script/appsscript.json`; en `Código.gs` borra lo que haya y pega `apps-script/Code.gs`. Guarda.
   (El manifiesto activa el servicio **Google Sheets API**, que se necesita para las tablas y los chips de Drive.)
5. En la lista de funciones elige **configurar** y toca **Ejecutar**. Autoriza los permisos (hoja y Drive).
   Se crean las pestañas **Equipos** y **Mantenimientos** como tablas, **Resumen**, **Historial**, **Config** y dos ocultas (**Archivos**, **Miniaturas**), y cuatro carpetas junto a la hoja: Fotos, Firmas, Informes de proveedores y PDF.
6. En la pestaña **Config** cambia el **Código de acceso** (nace como `CAMBIAR-ESTE-CODIGO`) y escribe el nombre del coordinador en **Coordinador (firma Revisó)**.
7. **Implementar → Nueva implementación → Aplicación web**: Ejecutar como **Yo**, acceso **Cualquier usuario**. Copia la URL que termina en `/exec`.

## Paso 2: pegar la URL en la app

En GitHub abre `config.js`, toca el lápiz, reemplaza `PEGA_AQUI_LA_URL_DE_APPS_SCRIPT/exec` por la URL y toca **Commit changes**.

## Paso 3: GitHub Pages (una sola vez)

**Settings → Pages → Branch: main, / (root) → Save**. En un par de minutos queda en https://geol21.github.io/Hojas-de-vida/

## Instalarla

- **Celular (Chrome):** abre el enlace, entra con el código, elige sede y técnico, y en el menú ⋮ toca **Instalar app** (o **Ajustes → Instalar** dentro de la app).
- **PC (Chrome o Edge):** abre el enlace y toca el ícono de instalar en la barra de direcciones. En el PC se ve como tablero: menú lateral, vista general con los preventivos, tabla de equipos y la ficha del equipo a la derecha.

## Qué hay en la hoja

- **Equipos** (tabla): identificación, adquisición, datos técnicos, plan de mantenimiento (periodicidad editable), último y próximo preventivo, foto del equipo y PDF de la hoja de vida como **chips de Drive**.
- **Mantenimientos** (tabla): una fila por intervención: tipo, descripción, repuestos, horómetro, estado al terminar, quién lo hizo (técnico de la clínica o proveedor: empresa, nombre, orden), quién recibe, y fotos, firmas e informe del proveedor como chips.
- **Resumen**: próximos preventivos ordenados por fecha (fórmula).
- **Historial**: quién registró, editó o generó PDF, y cuándo.
- **Config**: sedes, técnicos, tipos de equipo, ubicaciones, empresas proveedoras, coordinador y código de acceso. Las ubicaciones, empresas y tipos nuevos que se agregan desde la app se suman solos aquí.

## Si cambias archivos de la app

Sube `VERSION` en `sw.js` (`hojas-vida-v1` → `hojas-vida-v2`). Al abrir la app sale **Hay una versión nueva · Actualizar**.

## Subir el Apps Script con clasp (sin copiar y pegar)

clasp es la herramienta de Google para subir el `Code.gs` desde el PC. Se hace **siempre con la cuenta cilindrocrc@gmail.com**.

Una sola vez, en el PC con Windows:

1. Instala Node.js (versión LTS) desde nodejs.org.
2. Abre «Símbolo del sistema» y escribe: `npm i -g @google/clasp@2`
3. Entra con cilindrocrc a https://script.google.com/home/usersettings y activa **API de Google Apps Script**.
4. Escribe `clasp login`, se abre el navegador: elige **cilindrocrc@gmail.com** y acepta.
5. En el editor del Apps Script → ⚙ **Configuración del proyecto** → copia el **ID de la secuencia de comandos** y pégalo en `apps-script/.clasp.json` (en vez de `PEGAR_AQUI_EL_ID_DEL_SCRIPT`).
6. En **Implementar → Gestionar implementaciones** copia el **ID de implementación** (empieza por `AKfycb…`, es el mismo de la URL).

Cada vez que cambie el `Code.gs`, dentro de la carpeta `apps-script`:

```
clasp push
clasp deploy -i ID_DE_IMPLEMENTACION -d "cambio"
```

`deploy -i` actualiza la implementación que ya existe, así **la URL no cambia** y la app sigue funcionando.

### Opcional: que GitHub lo suba solo

El archivo `.github/workflows/apps-script.yml` sube el script cada vez que cambia `apps-script/` en `main`. Necesita dos secretos en GitHub (Settings → Secrets and variables → Actions):

- `CLASPRC_JSON`: el contenido del archivo `C:\Users\<tu usuario>\.clasprc.json` que crea `clasp login`.
- `DEPLOYMENT_ID`: el ID de implementación.

⚠️ El `.clasprc.json` es la llave de la cuenta cilindrocrc: **solo va en el secreto**, nunca en el repositorio ni en un chat.
