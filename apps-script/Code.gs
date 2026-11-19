/*****************************************************************
 * HOJAS DE VIDA DE EQUIPOS — DEPARTAMENTO DE GASES MEDICINALES
 * CLÍNICA REINA CATALINA
 *
 * Servidor de la PWA. Apps Script vinculado a la hoja
 * "Hojas de vida - Gases medicinales", en la cuenta cilindrocrc@gmail.com.
 *
 * Pestañas (se crean con el menú Hojas de vida → Configurar hoja,
 * o al ejecutar la función "configurar"):
 *   Equipos        → TABLA, una fila por equipo (compresores, bombas, SAM…)
 *   Mantenimientos → TABLA, una fila por intervención (preventivo, correctivo…)
 *   Resumen        → próximos preventivos (fórmula, sin tabla)
 *   Historial      → quién registró o editó, y cuándo
 *   Config         → sedes, técnicos, tipos, ubicaciones, empresas, coordinador y código
 *   Archivos       → (oculta) enlaces de Drive de cada registro, para los chips
 *   Miniaturas     → (oculta) fotos y firmas pequeñas, para la app y el PDF
 *
 * Fotos, firmas, informes de proveedores y PDF quedan en carpetas de Drive
 * junto a la hoja, y en la hoja se ven como chips de Drive.
 *
 * Necesita el servicio avanzado "Google Sheets API" (ya va en appsscript.json).
 *
 * La PWA llama por POST con { accion, codigo, ... }.
 * Acciones: validar, datos, equipo, mantenimiento, miniaturas, pdf.
 *****************************************************************/

const ZONA = 'America/Bogota';

const H_EQ = 'Equipos';
const H_MT = 'Mantenimientos';
const H_RES = 'Resumen';
const H_HIS = 'Historial';
const H_CFG = 'Config';
const H_ARC = 'Archivos';
const H_MIN = 'Miniaturas';

const ESTADOS = ['Funcionando', 'Con observaciones', 'Fuera de servicio', 'Dado de baja'];
const PERIODOS = ['Mensual', 'Bimestral', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual', 'Por horas de uso'];
const TIPOS_MT = ['Preventivo', 'Correctivo', 'Cambio de repuesto', 'Inspección', 'Calibración'];

/**
 * Columnas de cada tabla: [clave interna, encabezado, tipo].
 * Tipos: TEXT, DATE, DATE_TIME, DOUBLE, DROPDOWN:<lista>, CHIP.
 * Las claves no cambian; si se renombra un encabezado, se agrega a RENOMBRES.
 */
const COLS_EQ = [
  ['id', 'ID', 'TEXT'],
  ['codigo', 'Código', 'TEXT'],
  ['nombre', 'Equipo', 'TEXT'],
  ['tipo', 'Tipo', 'TEXT'],
  ['sede', 'Sede', 'DROPDOWN:SEDES'],
  ['ubicacion', 'Ubicación', 'TEXT'],
  ['marca', 'Marca', 'TEXT'],
  ['modelo', 'Modelo', 'TEXT'],
  ['serie', 'Serie', 'TEXT'],
  ['estado', 'Estado', 'DROPDOWN:ESTADOS'],
  ['proveedor', 'Proveedor', 'TEXT'],
  ['instalacion', 'Fecha de instalación', 'DATE'],
  ['forma', 'Forma de adquisición', 'TEXT'],
  ['garantia', 'Garantía hasta', 'DATE'],
  ['invima', 'Registro INVIMA', 'TEXT'],
  ['riesgo', 'Clasificación de riesgo', 'TEXT'],
  ['potencia', 'Potencia', 'TEXT'],
  ['voltaje', 'Voltaje', 'TEXT'],
  ['fases', 'Fases', 'TEXT'],
  ['corriente', 'Corriente', 'TEXT'],
  ['caudal', 'Caudal', 'TEXT'],
  ['presion', 'Presión de trabajo', 'TEXT'],
  ['lubricacion', 'Lubricación', 'TEXT'],
  ['otros', 'Otros datos técnicos', 'TEXT'],
  ['periodicidad', 'Periodicidad del preventivo', 'DROPDOWN:PERIODOS'],
  ['cadaHoras', 'Cada (horas)', 'DOUBLE'],
  ['responsable', 'Responsable del mantenimiento', 'TEXT'],
  ['empresaMtto', 'Empresa de mantenimiento', 'TEXT'],
  ['manual', 'Manual del fabricante', 'TEXT'],
  ['recomendaciones', 'Recomendaciones del fabricante', 'TEXT'],
  ['ultimo', 'Último preventivo', 'DATE'],
  ['proximo', 'Próximo preventivo', 'DATE'],
  ['foto', 'Foto del equipo', 'CHIP'],
  ['pdf', 'Hoja de vida PDF', 'CHIP'],
  ['registroPor', 'Registrado por', 'TEXT'],
  ['registro', 'Fecha de registro', 'DATE_TIME'],
  ['mod', 'Última modificación', 'DATE_TIME'],
  ['modPor', 'Modificado por', 'TEXT']
];

const COLS_MT = [
  ['id', 'ID', 'TEXT'],
  ['codigo', 'Código del equipo', 'TEXT'],
  ['equipo', 'Equipo', 'TEXT'],
  ['sede', 'Sede', 'DROPDOWN:SEDES'],
  ['fecha', 'Fecha', 'DATE'],
  ['tipo', 'Tipo', 'DROPDOWN:TIPOS_MT'],
  ['descripcion', 'Descripción', 'TEXT'],
  ['repuestos', 'Repuestos', 'TEXT'],
  ['horometro', 'Horómetro (h)', 'DOUBLE'],
  ['estadoFinal', 'Estado al terminar', 'DROPDOWN:ESTADOS'],
  ['quien', 'Realizado por', 'DROPDOWN:QUIEN'],
  ['tecnico', 'Técnico de la clínica', 'TEXT'],
  ['empresa', 'Empresa proveedora', 'TEXT'],
  ['nombreProv', 'Nombre de quien lo hizo', 'TEXT'],
  ['orden', 'N.º de orden o informe', 'TEXT'],
  ['recibe', 'Recibe a satisfacción', 'TEXT'],
  ['fotos', 'Fotos', 'CHIP'],
  ['firma', 'Firma de quien lo hizo', 'CHIP'],
  ['firmaRecibe', 'Firma de quien recibe', 'CHIP'],
  ['informe', 'Informe del proveedor', 'CHIP'],
  ['registroPor', 'Registrado por', 'TEXT'],
  ['registro', 'Fecha de registro', 'DATE_TIME']
];

const LISTAS = {
  SEDES: function(cfg) { return cfg.sedes; },
  ESTADOS: function() { return ESTADOS; },
  PERIODOS: function() { return PERIODOS; },
  TIPOS_MT: function() { return TIPOS_MT; },
  QUIEN: function() { return ['Técnico de la clínica', 'Proveedor']; }
};

/** Encabezado viejo → nuevo (se renombra solo la primera vez). */
const RENOMBRES = {};

const PREFIJOS = {
  'Compresor': 'CP', 'Bomba de vacío': 'BV', 'SAM (planta de aire medicinal)': 'SAM',
  'Generador de oxígeno': 'GO', 'Secador de aire': 'SE', 'Tanque pulmón': 'TP'
};

/** Valores con que nace la pestaña Config. Después se cambian ahí mismo. */
const CONFIG_INICIAL = [
  ['Sedes', ['Barranquilla', 'Baranoa']],
  ['Técnicos Barranquilla', ['Jorge Ortiz', 'Kensy Díaz']],
  ['Técnicos Baranoa', ['Kevin Gamero']],
  ['Tipos de equipo', ['Compresor', 'Bomba de vacío', 'SAM (planta de aire medicinal)', 'Generador de oxígeno', 'Secador de aire', 'Tanque pulmón']],
  ['Ubicaciones', ['Cuarto de máquinas']],
  ['Empresas proveedoras', ['Messer Colombia']],
  ['Coordinador (firma Revisó)', ['Coordinador de gases medicinales']],
  ['Código de acceso', ['CAMBIAR-ESTE-CODIGO']]
];


/***********************
 * MENÚ Y CONFIGURACIÓN INICIAL
 ***********************/

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hojas de vida')
    .addItem('Configurar hoja', 'configurar')
    .addToUi();
}

/** Ejecútala una vez: crea pestañas, tablas, carpetas de Drive y pide los permisos. */
function configurar() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  libro.setSpreadsheetLocale('es_CO');
  libro.setSpreadsheetTimeZone(ZONA);
  asegurarHojas(libro);
  ['FOTOS', 'FIRMAS', 'INFORMES', 'PDF'].forEach(carpeta);
  const cfg = leerConfig(libro);
  const msg = 'Listo. Pestañas, tablas y carpetas de Drive creadas.\n\nCódigo de acceso: ' + cfg.codigo +
    '\n(cámbialo en la pestaña Config)\n\nAhora publica: Implementar → Nueva implementación → Aplicación web.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* ejecutado desde el editor */ }
}

function asegurarHojas(libro) {
  if (!libro.getSheetByName(H_CFG)) crearConfig(libro);
  const cfg = leerConfig(libro);
  if (!libro.getSheetByName(H_EQ)) crearTabla(libro, H_EQ, COLS_EQ, cfg, 0);
  if (!libro.getSheetByName(H_MT)) crearTabla(libro, H_MT, COLS_MT, cfg, 1);
  renombrarEncabezados(libro);
  crearSimple(libro, H_HIS, ['Fecha', 'Técnico', 'Acción', 'ID', 'Detalle'], false);
  if (crearSimple(libro, H_ARC, ['ID', 'Campo', 'Enlaces'], true)) { /* nueva */ }
  crearSimple(libro, H_MIN, ['Clave', 'Imagen'], true);
  if (!libro.getSheetByName(H_RES)) crearResumen(libro);
  // Si la hoja nació con "Hoja 1" vacía, se quita
  const h1 = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1');
  if (h1 && h1.getLastRow() === 0 && libro.getSheets().length > 1) libro.deleteSheet(h1);
}

function crearSimple(libro, nombre, cab, oculta) {
  if (libro.getSheetByName(nombre)) return false;
  const h = libro.insertSheet(nombre);
  h.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold')
    .setBackground('#84303F').setFontColor('#ffffff');
  h.setFrozenRows(1);
  h.getRange('A:Z').setNumberFormat('@');
  if (nombre === H_HIS) h.getRange('A:A').setNumberFormat('dd/MM/yyyy h:mm am/pm');
  if (oculta) h.hideSheet();
  return true;
}

function crearConfig(libro) {
  const h = libro.insertSheet(H_CFG);
  const filas = Math.max.apply(null, CONFIG_INICIAL.map(function(c) { return c[1].length; })) + 1;
  const valores = [];
  for (let f = 0; f < filas; f++) {
    valores.push(CONFIG_INICIAL.map(function(c) { return f === 0 ? c[0] : (c[1][f - 1] != null ? String(c[1][f - 1]) : ''); }));
  }
  h.getRange(1, 1, filas, CONFIG_INICIAL.length).setNumberFormat('@').setValues(valores);
  h.getRange(1, 1, 1, CONFIG_INICIAL.length).setFontWeight('bold').setBackground('#84303F')
    .setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
  h.setFrozenRows(1);
  h.setRowHeight(1, 40);
  CONFIG_INICIAL.forEach(function(c, i) { h.setColumnWidth(i + 1, 190); });
  h.getRange(1, 1).setNote('Una opción por celda, hacia abajo. La app las lee al sincronizar.');
}

/** Crea una pestaña de datos como TABLA de Sheets, con el tipo de cada columna. */
function crearTabla(libro, nombre, cols, cfg, posicion) {
  const h = libro.insertSheet(nombre, posicion);
  const cab = cols.map(function(c) { return c[1]; });
  h.getRange(1, 1, 1, cab.length).setValues([cab]);
  h.setFrozenRows(1);
  try {
    const props = cols.map(function(c, i) {
      const p = { columnIndex: i, columnName: c[1] };
      const t = c[2];
      if (t.indexOf('DROPDOWN:') === 0) {
        p.columnType = 'DROPDOWN';
        p.dataValidationRule = { condition: { type: 'ONE_OF_LIST',
          values: LISTAS[t.slice(9)](cfg).map(function(v) { return { userEnteredValue: v }; }) } };
      } else if (t === 'CHIP') {
        p.columnType = 'TEXT';
      } else {
        p.columnType = t;
      }
      return p;
    });
    const r = Sheets.Spreadsheets.batchUpdate({ requests: [{ addTable: { table: {
      name: nombre.replace(/\s/g, '_'),
      range: { sheetId: h.getSheetId(), startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: cols.length },
      columnProperties: props
    } } }] }, libro.getId());
    const tabla = r.replies[0].addTable.table;
    PropertiesService.getScriptProperties().setProperty('TABLA_' + nombre, tabla.tableId);
  } catch (e) {
    // Sin el servicio avanzado: encabezado con color y formatos a mano
    Logger.log('No se pudo crear la tabla ' + nombre + ': ' + e.message);
    h.getRange(1, 1, 1, cab.length).setFontWeight('bold').setBackground('#84303F').setFontColor('#ffffff');
    cols.forEach(function(c, i) {
      const rango = h.getRange(2, i + 1, h.getMaxRows() - 1, 1);
      if (c[2] === 'DATE') rango.setNumberFormat('dd/MM/yyyy');
      else if (c[2] === 'DATE_TIME') rango.setNumberFormat('dd/MM/yyyy h:mm am/pm');
      else if (c[2] === 'DOUBLE') rango.setNumberFormat('#,##0.##');
      else rango.setNumberFormat('@');
    });
  }
  h.getRange(1, 1, 1, cab.length).setWrap(true).setVerticalAlignment('middle');
  h.setRowHeight(1, 42);
  cols.forEach(function(c, i) {
    h.setColumnWidth(i + 1, c[2] === 'CHIP' ? 220 : (c[0] === 'descripcion' || c[0] === 'recomendaciones' ? 260 : 130));
  });
  if (nombre === H_EQ) {
    // Colores por estado del equipo (como en la app)
    const col = indiceDe(COLS_EQ, 'estado') + 1;
    const rango = h.getRange(2, col, h.getMaxRows() - 1, 1);
    const reglas = h.getConditionalFormatRules();
    reglas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Fuera de servicio')
      .setBackground('#FCE4E1').setFontColor('#B3261E').setRanges([rango]).build());
    reglas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Con observaciones')
      .setBackground('#FFF3DC').setFontColor('#7A4A00').setRanges([rango]).build());
    reglas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Funcionando')
      .setBackground('#E3F4E8').setFontColor('#1B5E33').setRanges([rango]).build());
    h.setConditionalFormatRules(reglas);
  }
  return h;
}

/** Pestaña Resumen: próximos preventivos con una fórmula (sin tabla). */
function crearResumen(libro) {
  const h = libro.insertSheet(H_RES, 2);
  const L = function(clave) { return letra(indiceDe(COLS_EQ, clave) + 1); };
  const eq = "'" + H_EQ + "'!";
  const col = function(k) { return eq + L(k) + '2:' + L(k); };
  h.getRange('A1').setValue('Próximos preventivos (se actualiza solo)').setFontWeight('bold').setFontSize(13);
  h.getRange('A2:F2').setValues([['Código', 'Equipo', 'Sede', 'Estado', 'Último preventivo', 'Próximo preventivo']])
    .setFontWeight('bold').setBackground('#84303F').setFontColor('#ffffff');
  // setFormula usa la sintaxis en inglés (comas); la hoja la muestra con ";" en español
  h.getRange('A3').setFormula('=IFERROR(SORT(FILTER({' + [col('codigo'), col('nombre'), col('sede'), col('estado'), col('ultimo'), col('proximo')].join(',') +
    '},' + col('codigo') + '<>"",' + col('estado') + '<>"Dado de baja"),6,TRUE),"Sin equipos todavía")');
  h.getRange('E3:F').setNumberFormat('dd/MM/yyyy');
  h.setFrozenRows(2);
  [110, 220, 120, 150, 140, 150].forEach(function(w, i) { h.setColumnWidth(i + 1, w); });
}

function renombrarEncabezados(libro) {
  [H_EQ, H_MT].forEach(function(n) {
    const h = libro.getSheetByName(n);
    const cab = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    cab.forEach(function(t, i) {
      const nuevo = RENOMBRES[String(t).trim()];
      if (nuevo && cab.indexOf(nuevo) < 0) h.getRange(1, i + 1).setValue(nuevo);
    });
  });
}

/** Carpeta de Drive junto a la hoja. */
function carpeta(tipo) {
  const props = PropertiesService.getScriptProperties();
  const clave = 'CARPETA_' + tipo;
  const id = props.getProperty(clave);
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* se vuelve a crear */ }
  }
  const nombre = { FOTOS: 'Hojas de vida - Fotos', FIRMAS: 'Hojas de vida - Firmas',
    INFORMES: 'Hojas de vida - Informes de proveedores', PDF: 'Hojas de vida - PDF' }[tipo];
  let padre;
  try {
    const padres = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getParents();
    padre = padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
  } catch (e) { padre = DriveApp.getRootFolder(); }
  const existentes = padre.getFoldersByName(nombre);
  const f = existentes.hasNext() ? existentes.next() : padre.createFolder(nombre);
  props.setProperty(clave, f.getId());
  return f;
}


/***********************
 * ENTRADA DE LA PWA
 ***********************/

function doGet() {
  return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Servidor de Hojas de vida activo. ' +
    'Usa la app instalada en el celular o en el PC.</p>');
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return responder({ ok: false, error: 'Solicitud no válida.' }); }
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    asegurarHojas(libro);
    const cfg = leerConfig(libro);
    if (!cfg.codigo || String(d.codigo || '').trim() !== cfg.codigo) {
      return responder({ ok: false, codigo: 'ACCESO', error: 'Código de acceso incorrecto.' });
    }
    switch (d.accion) {
      case 'validar': return responder({ ok: true });
      case 'datos': return responder({ ok: true, config: configPublica(cfg), equipos: leerEquipos(libro),
        mantenimientos: leerMantenimientos(libro), minis: leerMinisEquipos(libro), hora: new Date().toISOString() });
      case 'equipo': return responder(guardarEquipo(libro, d, cfg));
      case 'mantenimiento': return responder(guardarMantenimiento(libro, d, cfg));
      case 'miniaturas': return responder({ ok: true, minis: leerMiniaturas(libro, d.claves || []) });
      case 'pdf': return responder(guardarPdf(libro, d, cfg));
      default: return responder({ ok: false, error: 'Acción desconocida.' });
    }
  } catch (err) {
    return responder({ ok: false, error: 'Error en el servidor: ' + err.message });
  }
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/***********************
 * CONFIG
 ***********************/

function leerConfig(libro) {
  const v = libro.getSheetByName(H_CFG).getDataRange().getDisplayValues();
  const cab = v[0].map(function(t) { return String(t).trim(); });
  function lista(nombre) {
    const c = cab.indexOf(nombre);
    if (c < 0) return null;
    const out = [];
    for (let f = 1; f < v.length; f++) { const x = String(v[f][c]).trim(); if (x) out.push(x); }
    return out;
  }
  const sedes = lista('Sedes') || ['Barranquilla', 'Baranoa'];
  const tecnicos = {};
  sedes.forEach(function(s) { tecnicos[s] = lista('Técnicos ' + s) || []; });
  return {
    sedes: sedes,
    tecnicos: tecnicos,
    tipos: lista('Tipos de equipo') || CONFIG_INICIAL[3][1],
    ubicaciones: lista('Ubicaciones') || [],
    empresas: lista('Empresas proveedoras') || [],
    coordinador: (lista('Coordinador (firma Revisó)') || [''])[0],
    codigo: (lista('Código de acceso') || [''])[0]
  };
}

function configPublica(cfg) {
  return { sedes: cfg.sedes, tecnicos: cfg.tecnicos, tipos: cfg.tipos, ubicaciones: cfg.ubicaciones,
    empresas: cfg.empresas, coordinador: cfg.coordinador };
}

/** Agrega una opción nueva a una lista de Config si no estaba (ubicación, empresa, tipo). */
function agregarAConfig(libro, nombreLista, valor) {
  valor = String(valor || '').trim();
  if (!valor) return;
  const h = libro.getSheetByName(H_CFG);
  const v = h.getDataRange().getDisplayValues();
  const c = v[0].map(function(t) { return String(t).trim(); }).indexOf(nombreLista);
  if (c < 0) return;
  const ya = v.slice(1).some(function(r) { return normal(r[c]) === normal(valor); });
  if (ya) return;
  let f = 1;
  while (f < v.length && String(v[f][c]).trim()) f++;
  h.getRange(f + 1, c + 1).setNumberFormat('@').setValue(valor);
}


/***********************
 * LECTURA
 ***********************/

/** Lee una tabla por nombre de encabezado y devuelve objetos con las claves internas. */
function leerTabla(libro, nombre, cols) {
  const h = libro.getSheetByName(nombre);
  if (h.getLastRow() < 2) return [];
  const v = h.getRange(1, 1, h.getLastRow(), h.getLastColumn()).getValues();
  const cab = v[0].map(function(t) { return String(t).trim(); });
  const archivos = leerArchivos(libro);
  const out = [];
  for (let f = 1; f < v.length; f++) {
    const fila = v[f];
    const o = {};
    cols.forEach(function(c) {
      const i = cab.indexOf(c[1]);
      if (c[2] === 'CHIP') return;
      let x = i >= 0 ? fila[i] : '';
      if (x instanceof Date) x = c[2] === 'DATE' ? Utilities.formatDate(x, ZONA, 'yyyy-MM-dd') : x.toISOString();
      else if (c[2] === 'DOUBLE') x = x === '' ? '' : Number(x);
      else x = String(x == null ? '' : x).trim();
      o[c[0]] = x;
    });
    if (!o.id) continue;
    cols.forEach(function(c) { if (c[2] === 'CHIP') o[c[0]] = archivos[o.id + '|' + c[0]] || []; });
    out.push(o);
  }
  return out;
}

function leerEquipos(libro) { return leerTabla(libro, H_EQ, COLS_EQ); }
function leerMantenimientos(libro) { return leerTabla(libro, H_MT, COLS_MT); }


/***********************
 * ESCRITURA EN TABLAS (por nombre de encabezado, con chips de Drive)
 ***********************/

/** Fecha 'aaaa-mm-dd' o Date → número de serie de Sheets (en hora de Colombia). */
function serie(x, conHora) {
  let d;
  if (x instanceof Date) d = x;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(String(x))) {
    const p = String(x).split('-').map(Number);
    return (Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(1899, 11, 30)) / 86400000;
  } else d = new Date(x);
  if (!d || isNaN(d)) return null;
  const t = Utilities.formatDate(d, ZONA, 'yyyy-MM-dd-HH-mm-ss').split('-').map(Number);
  const ms = Date.UTC(t[0], t[1] - 1, t[2], conHora ? t[3] : 0, conHora ? t[4] : 0, conHora ? t[5] : 0);
  return (ms - Date.UTC(1899, 11, 30)) / 86400000;
}

/** Arma las celdas de una fila (CellData de la API) según los encabezados reales de la hoja. */
function celdasFila(cab, cols, datos, chips) {
  return cab.map(function(t) {
    const c = cols.filter(function(x) { return x[1] === String(t).trim(); })[0];
    if (!c) return {};
    const tipo = c[2];
    if (tipo === 'CHIP') {
      const urls = (chips[c[0]] || []).filter(Boolean);
      if (!urls.length) return { userEnteredValue: { stringValue: '' } };
      return {
        userEnteredValue: { stringValue: urls.map(function() { return '@'; }).join(' ') },
        chipRuns: urls.map(function(u, i) { return { startIndex: i * 2, chip: { richLinkProperties: { uri: u } } }; })
      };
    }
    const v = datos[c[0]];
    if (v === undefined || v === null || v === '') return { userEnteredValue: { stringValue: '' } };
    if (tipo === 'DATE' || tipo === 'DATE_TIME') {
      const n = serie(v, tipo === 'DATE_TIME');
      return n === null ? { userEnteredValue: { stringValue: '' } } : { userEnteredValue: { numberValue: n } };
    }
    if (tipo === 'DOUBLE') {
      const n = Number(String(v).replace(',', '.'));
      return isFinite(n) ? { userEnteredValue: { numberValue: n } } : { userEnteredValue: { stringValue: String(v) } };
    }
    return { userEnteredValue: { stringValue: String(v) } };
  });
}

/**
 * Escribe la fila de un registro: la reemplaza si ya existe o la agrega dentro de la tabla.
 * Si no está el servicio avanzado, escribe con setValues y los archivos como enlace corto.
 */
function escribirRegistro(libro, nombre, cols, datos, chips) {
  const h = libro.getSheetByName(nombre);
  const cab = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const filaExistente = buscarFila(h, datos.id);
  const tablaId = PropertiesService.getScriptProperties().getProperty('TABLA_' + nombre);
  try {
    const celdas = celdasFila(cab, cols, datos, chips);
    const fila = { values: celdas };
    let peticiones;
    if (filaExistente) {
      // Solo las columnas de la app: las que se agreguen a mano en la hoja no se tocan
      peticiones = [];
      let ini = -1;
      for (let i = 0; i <= celdas.length; i++) {
        const conocida = i < celdas.length && cols.some(function(x) { return x[1] === String(cab[i]).trim(); });
        if (conocida && ini < 0) ini = i;
        if (!conocida && ini >= 0) {
          peticiones.push({ updateCells: { rows: [{ values: celdas.slice(ini, i) }], fields: 'userEnteredValue,chipRuns',
            start: { sheetId: h.getSheetId(), rowIndex: filaExistente - 1, columnIndex: ini } } });
          ini = -1;
        }
      }
    }
    let peticion = null;
    if (peticiones) {
      /* ya armadas */
    } else if (h.getLastRow() < 2) {
      // La tabla nace con una fila vacía: el primer registro va ahí
      peticion = { updateCells: { rows: [fila], fields: 'userEnteredValue,chipRuns',
        start: { sheetId: h.getSheetId(), rowIndex: 1, columnIndex: 0 } } };
    } else if (tablaId) {
      peticion = { appendCells: { tableId: tablaId, rows: [fila], fields: 'userEnteredValue,chipRuns' } };
    } else {
      peticion = { appendCells: { sheetId: h.getSheetId(), rows: [fila], fields: 'userEnteredValue,chipRuns' } };
    }
    Sheets.Spreadsheets.batchUpdate({ requests: peticiones || [peticion] }, libro.getId());
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('Escritura sin la API de Sheets: ' + e.message);
    escribirSinApi(h, cab, cols, datos, chips, filaExistente);
  }
}

function escribirSinApi(h, cab, cols, datos, chips, filaExistente) {
  const r = filaExistente || h.getLastRow() + 1;
  cab.forEach(function(t, i) {
    const c = cols.filter(function(x) { return x[1] === String(t).trim(); })[0];
    if (!c) return;
    const celda = h.getRange(r, i + 1);
    if (c[2] === 'CHIP') {
      const urls = (chips[c[0]] || []).filter(Boolean);
      if (!urls.length) { celda.setValue(''); return; }
      const textos = urls.map(function(u, k) { return urls.length > 1 ? 'Archivo ' + (k + 1) : 'Ver archivo'; });
      const b = SpreadsheetApp.newRichTextValue().setText(textos.join(' '));
      let pos = 0;
      textos.forEach(function(tx, k) { b.setLinkUrl(pos, pos + tx.length, urls[k]); pos += tx.length + 1; });
      celda.setRichTextValue(b.build());
      return;
    }
    let v = datos[c[0]];
    if (v === undefined || v === null) v = '';
    if ((c[2] === 'DATE' || c[2] === 'DATE_TIME') && v) {
      v = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(String(v) + 'T12:00:00') : new Date(v);
    }
    celda.setValue(v);
  });
}


/***********************
 * EQUIPOS
 ***********************/

function guardarEquipo(libro, d, cfg) {
  const e = d.e || {};
  const id = String(e.id || '').trim();
  if (!id) return { ok: false, error: 'El equipo no tiene identificador.' };
  const faltan = [];
  if (!String(e.nombre || '').trim()) faltan.push('nombre del equipo');
  if (!e.tipo) faltan.push('tipo');
  if (!e.sede) faltan.push('sede');
  if (!e.periodicidad) faltan.push('periodicidad del preventivo');
  if (faltan.length) return { ok: false, error: 'Falta: ' + faltan.join(', ') + '.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const equipos = leerEquipos(libro);
    const previo = equipos.filter(function(x) { return x.id === id; })[0];
    const mod = fechaValida(e.mod) || new Date();
    if (previo && previo.mod && new Date(previo.mod).getTime() > mod.getTime()) {
      return { ok: true, ignorado: true, equipo: previo };
    }
    // Código único: si otro equipo ya lo tiene, se toma el siguiente libre
    let codigo = String(e.codigo || '').trim().toUpperCase();
    const usados = {};
    equipos.forEach(function(x) { if (x.id !== id) usados[x.codigo] = true; });
    if (!codigo || usados[codigo]) codigo = siguienteCodigo(e.tipo, usados);

    const archivos = leerArchivos(libro);
    let foto = archivos[id + '|foto'] || [];
    if (d.foto) {
      foto.forEach(borrarArchivo);
      foto = [guardarArchivo('FOTOS', 'Foto_' + codigo + '_' + limpiarNombre(e.nombre) + '.jpg', 'image/jpeg', d.foto)];
      if (d.mini) guardarMiniatura(libro, 'EQ:' + id, d.mini);
    }
    const pdf = archivos[id + '|pdf'] || [];

    const datos = {};
    COLS_EQ.forEach(function(c) { datos[c[0]] = e[c[0]] === undefined ? '' : e[c[0]]; });
    datos.id = id;
    datos.codigo = codigo;
    datos.nombre = String(e.nombre).trim();
    datos.registroPor = previo ? previo.registroPor : String(e.modPor || '');
    datos.registro = previo ? previo.registro : mod;
    datos.mod = mod;
    datos.modPor = String(e.modPor || '');
    // Último y próximo preventivo los calcula el servidor con los mantenimientos
    const calc = calcularPreventivo(datos, leerMantenimientos(libro));
    datos.ultimo = calc.ultimo;
    datos.proximo = calc.proximo;

    escribirRegistro(libro, H_EQ, COLS_EQ, datos, { foto: foto, pdf: pdf });
    guardarArchivos(libro, id, 'foto', foto);
    if (e.ubicacion) agregarAConfig(libro, 'Ubicaciones', e.ubicacion);
    if (e.empresaMtto) agregarAConfig(libro, 'Empresas proveedoras', e.empresaMtto);
    if (e.tipo && cfg.tipos.indexOf(e.tipo) < 0) agregarAConfig(libro, 'Tipos de equipo', e.tipo);
    historial(libro, e.modPor, previo ? 'Editó equipo' : 'Registró equipo', id,
      codigo + ' · ' + datos.nombre + ' · ' + e.sede);
    datos.foto = foto; datos.pdf = pdf;
    datos.mod = mod.toISOString();
    datos.registro = datos.registro instanceof Date ? datos.registro.toISOString() : datos.registro;
    return { ok: true, equipo: datos };
  } finally {
    lock.releaseLock();
  }
}

function siguienteCodigo(tipo, usados) {
  const pre = 'GM-' + (PREFIJOS[tipo] || 'EQ') + '-';
  for (let n = 1; n < 1000; n++) {
    const c = pre + (n < 10 ? '0' : '') + n;
    if (!usados[c]) return c;
  }
  return pre + Date.now();
}

const MESES = { 'Mensual': 1, 'Bimestral': 2, 'Trimestral': 3, 'Cuatrimestral': 4, 'Semestral': 6, 'Anual': 12 };

/** Último preventivo (fecha) y próximo según la periodicidad del equipo. */
function calcularPreventivo(eq, mantenimientos) {
  const prev = mantenimientos.filter(function(m) { return m.codigo === eq.codigo && m.tipo === 'Preventivo' && m.fecha; })
    .sort(function(a, b) { return a.fecha < b.fecha ? 1 : -1; });
  const ultimo = prev.length ? prev[0].fecha : '';
  let proximo = '';
  const meses = MESES[eq.periodicidad];
  const base = ultimo || eq.instalacion;
  if (meses && base) {
    const p = String(base).split('-').map(Number);
    const f = new Date(Date.UTC(p[0], p[1] - 1 + meses, 1));
    const dias = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
    f.setUTCDate(Math.min(p[2], dias));
    proximo = f.toISOString().slice(0, 10);
  }
  return { ultimo: ultimo, proximo: proximo };
}

/** Recalcula último y próximo preventivo de un equipo después de registrar un mantenimiento. */
function actualizarPreventivo(libro, codigo) {
  const eq = leerEquipos(libro).filter(function(x) { return x.codigo === codigo; })[0];
  if (!eq) return null;
  const calc = calcularPreventivo(eq, leerMantenimientos(libro));
  const h = libro.getSheetByName(H_EQ);
  const cab = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(function(t) { return String(t).trim(); });
  const r = buscarFila(h, eq.id);
  [['ultimo', calc.ultimo], ['proximo', calc.proximo]].forEach(function(par) {
    const i = cab.indexOf(COLS_EQ[indiceDe(COLS_EQ, par[0])][1]);
    if (i >= 0 && r) h.getRange(r, i + 1).setValue(par[1] ? new Date(par[1] + 'T12:00:00') : '');
  });
  return calc;
}


/***********************
 * MANTENIMIENTOS
 ***********************/

function guardarMantenimiento(libro, d, cfg) {
  const m = d.m || {};
  const id = String(m.id || '').trim();
  if (!id) return { ok: false, error: 'El mantenimiento no tiene identificador.' };
  const faltan = [];
  if (!m.codigo) faltan.push('equipo');
  if (!m.fecha) faltan.push('fecha');
  if (!m.tipo) faltan.push('tipo');
  if (!String(m.descripcion || '').trim()) faltan.push('lo que se hizo');
  if (!m.quien) faltan.push('quién lo hizo');
  if (faltan.length) return { ok: false, error: 'Falta: ' + faltan.join(', ') + '.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const h = libro.getSheetByName(H_MT);
    if (buscarFila(h, id)) return { ok: true, repetido: true };   // ya había llegado
    const base = 'MT_' + m.codigo + '_' + m.fecha;
    const fotos = (d.fotos || []).map(function(b64, i) {
      return guardarArchivo('FOTOS', base + '_' + (i + 1) + '.jpg', 'image/jpeg', b64);
    });
    (d.minis || []).forEach(function(mini, i) { if (mini) guardarMiniatura(libro, 'MT:' + id + ':' + (i + 1), mini); });
    const firma = d.firma ? [guardarArchivo('FIRMAS', base + '_firma_' + limpiarNombre(m.quien === 'Proveedor' ? m.nombreProv : m.tecnico) + '.png', 'image/png', d.firma)] : [];
    if (d.firmaMini) guardarMiniatura(libro, 'FI:' + id, d.firmaMini);
    const firmaRecibe = d.firmaRecibe ? [guardarArchivo('FIRMAS', base + '_recibe_' + limpiarNombre(m.recibe) + '.png', 'image/png', d.firmaRecibe)] : [];
    if (d.firmaRecibeMini) guardarMiniatura(libro, 'FR:' + id, d.firmaRecibeMini);
    const informe = d.informe ? [guardarArchivo('INFORMES', base + '_informe_' + limpiarNombre(m.empresa) + '.' + (d.informeExt || 'pdf'),
      d.informeTipo || 'application/pdf', d.informe)] : [];

    const datos = {};
    COLS_MT.forEach(function(c) { datos[c[0]] = m[c[0]] === undefined ? '' : m[c[0]]; });
    datos.registroPor = String(m.registroPor || '');
    datos.registro = fechaValida(m.registro) || new Date();
    escribirRegistro(libro, H_MT, COLS_MT, datos,
      { fotos: fotos, firma: firma, firmaRecibe: firmaRecibe, informe: informe });
    guardarArchivos(libro, id, 'fotos', fotos);
    guardarArchivos(libro, id, 'firma', firma);
    guardarArchivos(libro, id, 'firmaRecibe', firmaRecibe);
    guardarArchivos(libro, id, 'informe', informe);
    if (m.empresa) agregarAConfig(libro, 'Empresas proveedoras', m.empresa);

    // El estado del equipo queda como quedó al terminar el mantenimiento
    const eq = leerEquipos(libro).filter(function(x) { return x.codigo === m.codigo; })[0];
    if (eq && m.estadoFinal && eq.estado !== m.estadoFinal) {
      const he = libro.getSheetByName(H_EQ);
      const cab = he.getRange(1, 1, 1, he.getLastColumn()).getValues()[0].map(function(t) { return String(t).trim(); });
      const r = buscarFila(he, eq.id);
      const i = cab.indexOf('Estado');
      if (r && i >= 0) he.getRange(r, i + 1).setValue(m.estadoFinal);
    }
    const calc = actualizarPreventivo(libro, m.codigo);
    historial(libro, m.registroPor, 'Registró mantenimiento', id, m.codigo + ' · ' + m.tipo + ' · ' + m.fecha);
    return { ok: true, fotos: fotos, firma: firma, firmaRecibe: firmaRecibe, informe: informe, preventivo: calc };
  } finally {
    lock.releaseLock();
  }
}


/***********************
 * ARCHIVOS, MINIATURAS Y PDF
 ***********************/

function guardarArchivo(tipo, nombre, mime, base64) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, limpiarNombre(nombre));
  return carpeta(tipo).createFile(blob).getUrl();
}

function borrarArchivo(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  if (!m) return;
  try { DriveApp.getFileById(m[0]).setTrashed(true); } catch (e) { /* ya no existe */ }
}

/** Pestaña oculta Archivos: ID | Campo | Enlaces (separados por espacio). */
function leerArchivos(libro) {
  const h = libro.getSheetByName(H_ARC);
  const out = {};
  if (!h || h.getLastRow() < 2) return out;
  h.getRange(2, 1, h.getLastRow() - 1, 3).getValues().forEach(function(r) {
    const k = String(r[0]).trim() + '|' + String(r[1]).trim();
    out[k] = String(r[2]).split(/\s+/).filter(Boolean);
  });
  return out;
}

function guardarArchivos(libro, id, campo, urls) {
  const h = libro.getSheetByName(H_ARC);
  const n = h.getLastRow() - 1;
  const v = n > 0 ? h.getRange(2, 1, n, 2).getValues() : [];
  let fila = 0;
  v.forEach(function(r, i) { if (String(r[0]) === id && String(r[1]) === campo) fila = i + 2; });
  if (!urls || !urls.length) { if (fila) h.deleteRow(fila); return; }
  if (fila) h.getRange(fila, 3).setValue(urls.join(' '));
  else h.getRange(h.getLastRow() + 1, 1, 1, 3).setValues([[id, campo, urls.join(' ')]]);
}

function guardarMiniatura(libro, clave, dataUrl) {
  dataUrl = String(dataUrl || '');
  if (!/^data:image\//.test(dataUrl) || dataUrl.length > 49000) return;
  const h = libro.getSheetByName(H_MIN);
  const r = buscarFila(h, clave);
  if (r) h.getRange(r, 2).setValue(dataUrl);
  else h.getRange(h.getLastRow() + 1, 1, 1, 2).setValues([[clave, dataUrl]]);
}

function leerMiniaturas(libro, claves) {
  const quiero = {};
  claves.forEach(function(k) { quiero[String(k)] = true; });
  const h = libro.getSheetByName(H_MIN);
  const out = {};
  if (h.getLastRow() < 2) return out;
  h.getRange(2, 1, h.getLastRow() - 1, 2).getValues().forEach(function(r) {
    const k = String(r[0]).trim();
    if (quiero[k] && r[1]) out[k] = String(r[1]);
  });
  return out;
}

/** Fotos pequeñas de los equipos (van con los datos para que la lista se vea sin señal). */
function leerMinisEquipos(libro) {
  const h = libro.getSheetByName(H_MIN);
  const out = {};
  if (h.getLastRow() < 2) return out;
  h.getRange(2, 1, h.getLastRow() - 1, 2).getValues().forEach(function(r) {
    const k = String(r[0]).trim();
    if (k.indexOf('EQ:') === 0 && r[1]) out[k] = String(r[1]);
  });
  return out;
}

/** Guarda el PDF de la hoja de vida en Drive (reemplaza el anterior del mismo equipo) y lo pone como chip. */
function guardarPdf(libro, d) {
  if (!d.base64) return { ok: false, error: 'El PDF llegó vacío.' };
  const id = String(d.id || '').trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const eq = leerEquipos(libro).filter(function(x) { return x.id === id; })[0];
    if (!eq) return { ok: false, error: 'El equipo todavía no está en la hoja. Sube primero sus datos.' };
    (eq.pdf || []).forEach(borrarArchivo);
    const url = guardarArchivo('PDF', 'HV_' + eq.codigo + '_' + limpiarNombre(eq.nombre) + '.pdf', 'application/pdf', d.base64);
    const datos = {};
    COLS_EQ.forEach(function(c) { datos[c[0]] = eq[c[0]]; });
    escribirRegistro(libro, H_EQ, COLS_EQ, datos, { foto: eq.foto, pdf: [url] });
    guardarArchivos(libro, id, 'pdf', [url]);
    historial(libro, d.tecnico, 'Generó hoja de vida PDF', id, eq.codigo + ' · ' + eq.nombre);
    return { ok: true, url: url };
  } finally {
    lock.releaseLock();
  }
}


/***********************
 * UTILIDADES
 ***********************/

function buscarFila(h, id) {
  if (!id || h.getLastRow() < 2) return 0;
  const celda = h.getRange(2, 1, h.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return celda ? celda.getRow() : 0;
}

function historial(libro, tecnico, accion, id, detalle) {
  const h = libro.getSheetByName(H_HIS);
  h.getRange(h.getLastRow() + 1, 1, 1, 5).setValues([[new Date(), String(tecnico || ''), accion, id || '', detalle || '']]);
}

function indiceDe(cols, clave) {
  for (let i = 0; i < cols.length; i++) if (cols[i][0] === clave) return i;
  return -1;
}

function letra(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function fechaValida(x) {
  if (!x) return null;
  const d = x instanceof Date ? x : new Date(x);
  return isNaN(d) ? null : d;
}

function normal(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function limpiarNombre(t) {
  return String(t || '').replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
}
