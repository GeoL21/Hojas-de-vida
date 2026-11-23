# Hojas de vida — Equipos de gases medicinales (Clínica Reina Catalina)

PWA en español para las hojas de vida de los equipos del Departamento de Gases Medicinales (compresores, bombas de vacío, SAM, generadores de oxígeno…), sus mantenimientos (técnico de la clínica o proveedor) y el PDF con formato **FMT-004 · Versión 1 · 25/03/2012**. Dueño: Jorge Ortiz (técnico de gases medicinales). Todo se le explica en español sencillo.

## Estructura

- `index.html` (estilos PixelUI) · `app.js` (toda la app) · `iconos.js` (Material Symbols Rounded en SVG) · `config.js` (URL del Apps Script) · `sw.js` (sin señal) · `lib/` (jsPDF + autotable).
- `apps-script/Code.gs` + `appsscript.json`: servidor en la hoja **Hojas de vida - Gases medicinales** de la cuenta **cilindrocrc@gmail.com** (nunca la personal). Se sube con clasp (ver README).
- Sin compilación: se publica tal cual en GitHub Pages (`main`, raíz) → https://geol21.github.io/Hojas-de-vida/

## Reglas que no se rompen

1. **Bosquejo antes de cambiar la interfaz** y esperar aprobación de Jorge. Arreglos de fallas sí se hacen directo.
2. **Celular (menos de 1024 px): PixelUI** (skill `nueva-pwa`, paso 5): fondo `#FFFBFA`, filas `#F5EEEF`, principal `#84303F`, contenedor `#FFCCD4`; letra Google Sans Flex con grosores 560/660/760/860; filas por estado (ámbar `#FFF3DC`, rojo que late `#FCE4E1→#F6C6C0`); chip «Listo» con sello `verified`; aviso «Falta: … · Ir»; horas «a. m./p. m.».
   **PC (desde 1024 px): tablero de tres columnas** (aprobado por Jorge el 23 nov 2026): riel de íconos, menú lateral (vistas, tipos de equipo, sedes, estado de subida), centro con vista general, anillos de preventivos y tabla, y desde 1280 px la ficha del equipo a la derecha. Paleta: fondo `#F4F5F7`, tarjetas blancas con borde `#E7E9EE`, botón principal negro `#111827`, acentos azul `#2F6BFF`, naranja `#F97316`, verde `#16A34A`; letra Inter 400/500/600; degradado pastel en la ficha. Código en `marcoPC`/`htmlEquiposPC`/`fichaPC` (app.js) y el bloque «PC: tablero de tres columnas» de index.html, todo dentro de `.tz`. No mezclar los dos estilos.
3. **Cada cambio de archivos de la app sube `VERSION` en `sw.js`** (`hojas-vida-vN`). Si no, los teléfonos no ven el cambio.
4. Almacenamiento del teléfono con prefijo propio: localStorage `hojas-vida:`, IndexedDB `hojas-vida`, cachés `hojas-vida-…`. Nunca tocar claves de otras apps del portal.
5. **Apps Script escribe por nombre de encabezado** (`COLS_EQ`, `COLS_MT`). Las claves internas no cambian; para renombrar un encabezado se usa `RENOMBRES`. Las pestañas Equipos y Mantenimientos son **tablas** (las crea `configurar`); archivos de Drive como **chips**.
6. Si cambia la forma de los datos entre app y servidor, cambiar los dos y avisar que hay que subir el Apps Script (clasp) y actualizar la implementación **sin cambiar la URL**.
7. Al buscar un elemento por id (`$('#…')`), comprobar que exista en la vista: así falló «Iniciar ronda» en Ronda de tomas.

## Antes de publicar

- `node --check app.js sw.js iconos.js` y el `Code.gs` (el hook de `.claude/settings.json` lo hace al editar).
- Prueba con servidor simulado: `python3 .claude/scripts/prueba_humo.py` (entrar, equipo con foto, mantenimiento con firma sin señal, PDF, anchos 320/390/768/1024/1440). Debe terminar sin errores.
- Commit, push a `main` y esperar que «pages build and deployment» termine en verde.

## Datos

- Mantenimientos se enlazan al equipo por **Código** (GM-CP-01…). El servidor puede cambiar el código si estaba repetido; la app lo actualiza al sincronizar.
- Próximo preventivo = último preventivo + periodicidad (editable, la define administración). Sin preventivos: desde la instalación solo si esa fecha aún no pasó; si no, «Sin preventivo registrado».
- PDF: carta, encabezado FMT-004 en todas las páginas, foto del equipo al inicio, firmas Elaboró (técnico) y Revisó (Config → Coordinador).
