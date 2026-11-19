/*****************************************************************
 * HOJAS DE VIDA DE EQUIPOS — GASES MEDICINALES · CLÍNICA REINA CATALINA
 *
 * PWA para llenar la hoja de vida de compresores, bombas de vacío,
 * SAM, generadores de oxígeno y demás equipos, registrar sus
 * mantenimientos (de la clínica o de un proveedor) y sacar el PDF
 * con el formato FMT-004.
 *
 * Sin señal: todo se guarda primero en el celular (cola) y se sube
 * a la hoja de Google cuando vuelve la conexión.
 *****************************************************************/

'use strict';

const VERSION_APP = '1.2.0';
const PREF = 'hojas-vida:';   // prefijo propio en el almacenamiento (paso 8 de la skill)

const FORMATO = { codigo: 'FMT-004', version: '1', fecha: '25/03/2012' };

const ESTADOS = ['Funcionando', 'Con observaciones', 'Fuera de servicio', 'Dado de baja'];
const PERIODOS = ['Mensual', 'Bimestral', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual', 'Por horas de uso'];
const MESES = { 'Mensual': 1, 'Bimestral': 2, 'Trimestral': 3, 'Cuatrimestral': 4, 'Semestral': 6, 'Anual': 12 };
const TIPOS_MT = ['Preventivo', 'Correctivo', 'Cambio de repuesto', 'Inspección', 'Calibración'];
const FORMAS = ['Compra', 'Comodato', 'Donación', 'Arriendo'];
const RIESGOS = ['I', 'IIa', 'IIb', 'III', 'No aplica'];
const FASES = ['Monofásico', 'Bifásico', 'Trifásico', 'No aplica'];
const LUBRICACION = ['Lubricado', 'Libre de aceite', 'No aplica'];
const PREFIJOS = {
  'Compresor': 'CP', 'Bomba de vacío': 'BV', 'SAM (planta de aire medicinal)': 'SAM',
  'Generador de oxígeno': 'GO', 'Secador de aire': 'SE', 'Tanque pulmón': 'TP'
};
const ICONO_TIPO = {
  'Compresor': 'mode_fan', 'Bomba de vacío': 'vacuum', 'SAM (planta de aire medicinal)': 'air',
  'Generador de oxígeno': 'heat_pump', 'Secador de aire': 'dry', 'Tanque pulmón': 'propane_tank'
};
const CFG_INICIAL = {
  sedes: ['Barranquilla', 'Baranoa'],
  tecnicos: { 'Barranquilla': ['Jorge Ortiz', 'Kensy Díaz'], 'Baranoa': ['Kevin Gamero'] },
  tipos: ['Compresor', 'Bomba de vacío', 'SAM (planta de aire medicinal)', 'Generador de oxígeno', 'Secador de aire', 'Tanque pulmón'],
  ubicaciones: ['Cuarto de máquinas'],
  empresas: ['Messer Colombia'],
  coordinador: 'Coordinador de gases medicinales'
};


/***********************
 * AYUDANTES
 ***********************/

const $ = function(sel, base) { return (base || document).querySelector(sel); };
const $$ = function(sel, base) { return Array.prototype.slice.call((base || document).querySelectorAll(sel)); };

function ico(nombre, clase, lleno) {
  const d = (lleno && ICONOS[nombre + '-fill']) || ICONOS[nombre] || ICONOS['info'];
  return '<svg class="ic ' + (clase || '') + '" viewBox="0 -960 960 960" aria-hidden="true"><path d="' + d + '"/></svg>';
}
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function dos(n) { return (n < 10 ? '0' : '') + n; }
function azar(n) { return Math.random().toString(36).slice(2, 2 + n).toUpperCase(); }
function normal(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function hoyISO() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
}
function nuevoId(pre) {
  const d = new Date();
  return pre + '-' + hoyISO().replace(/-/g, '') + '-' + dos(d.getHours()) + dos(d.getMinutes()) + '-' + azar(4);
}
const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fFecha(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-').map(Number);
  if (p.length < 3 || !p[0]) return String(iso);
  return p[2] + ' ' + MES_C[p[1] - 1] + ' ' + p[0];
}
function fFechaPdf(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
}
function hora(d) {
  return (d || new Date()).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s+/g, ' ').replace(/a\.?\s?m\.?/i, 'a. m.').replace(/p\.?\s?m\.?/i, 'p. m.');
}
function diasEntre(a, b) {
  const x = String(a).split('-').map(Number), y = String(b).split('-').map(Number);
  return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000);
}
function sumarMeses(iso, meses) {
  const p = String(iso).split('-').map(Number);
  const f = new Date(Date.UTC(p[0], p[1] - 1 + meses, 1));
  const dias = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
  f.setUTCDate(Math.min(p[2], dias));
  return f.toISOString().slice(0, 10);
}
function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
function num(n) { return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(Number(n) || 0); }
function nombreBonito(t) { return String(t || '').toLowerCase().replace(/(^|\s)\S/g, function(m) { return m.toUpperCase(); }); }
/** Técnicos de un mantenimiento: se guardan como "Jorge Ortiz, Kensy Díaz" (el primero es quien firma). */
function listaTec(t) { return String(t || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean); }
function nombresTec(t) { return listaTec(t).map(nombreBonito).join(' y '); }
function imgSegura(src) { return /^data:image\/(png|jpe?g|webp);base64,/.test(String(src || '')); }

let relojToast = null;
function toast(html, accion) {
  const el = $('#toast');
  clearTimeout(relojToast);
  el.innerHTML = '<div class="' + (accion ? 'con' : '') + '"><span>' + html + '</span>' +
    (accion ? '<button type="button" id="toastAcc">' + esc(accion.texto) + '</button>' : '') + '</div>';
  if (accion) $('#toastAcc').onclick = function() { el.innerHTML = ''; accion.fn(); };
  relojToast = setTimeout(function() { el.innerHTML = ''; }, accion ? 7000 : 3200);
}

/** Aviso "Falta: …" con botón Ir que lleva al campo, lo centra y lo hace parpadear. */
function avisoFalta(texto, selector) {
  sonarFalta();
  toast(ico('info', 's') + 'Falta: ' + esc(texto), { texto: 'Ir', fn: function() { irACampo(selector); } });
}
function irACampo(selector) {
  const el = $(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('parpadea');
  void el.offsetWidth;
  el.classList.add('parpadea');
  const foco = el.matches('input,textarea') ? el : $('input,textarea', el);
  if (foco) setTimeout(function() { foco.focus(); }, 350);
}

/* Sonidos cortos generados aquí (no necesitan archivos) */
let actx = null;
function prepararSonido() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* sin sonido */ }
}
function tono(notas, vol) {
  try {
    if (!actx) return;
    const t0 = actx.currentTime + 0.02;
    notas.forEach(function(n) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = n[0];
      g.gain.setValueAtTime(0.0001, t0 + n[1]);
      g.gain.exponentialRampToValueAtTime(vol, t0 + n[1] + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
      o.connect(g); g.connect(actx.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.05);
    });
  } catch (e) { /* sin sonido */ }
}
function vibrar(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* nada */ } }
function sonarListo() { tono([[784, 0, 0.28], [1046.5, 0.13, 0.28], [1318.5, 0.26, 0.5]], 0.22); vibrar([50, 60, 90]); }
function sonarFalta() { prepararSonido(); tono([[659.3, 0, 0.18], [523.3, 0.16, 0.32]], 0.18); vibrar(80); }


/***********************
 * ALMACENAMIENTO EN EL TELÉFONO (con prefijo propio)
 ***********************/

let bd = null;
const MEMORIA = new Map();
function abrirBD() {
  return new Promise(function(resolve, reject) {
    const p = indexedDB.open('hojas-vida', 1);
    p.onupgradeneeded = function() { p.result.createObjectStore('datos'); };
    p.onsuccess = function() { bd = p.result; resolve(); };
    p.onerror = function() { reject(p.error); };
  });
}
function leerDato(k) {
  if (!bd) return Promise.resolve(MEMORIA.get(k));
  return new Promise(function(resolve) {
    try {
      const r = bd.transaction('datos').objectStore('datos').get(k);
      r.onsuccess = function() { resolve(r.result); };
      r.onerror = function() { resolve(undefined); };
    } catch (e) { resolve(undefined); }
  });
}
function guardarDato(k, v) {
  if (!bd) { MEMORIA.set(k, v); return Promise.resolve(); }
  return new Promise(function(resolve) {
    try {
      const t = bd.transaction('datos', 'readwrite');
      t.objectStore('datos').put(v, k);
      t.oncomplete = function() { resolve(); };
      t.onerror = function() { resolve(); };
    } catch (e) { resolve(); }
  });
}
function borrarDato(k) {
  if (!k) return Promise.resolve();
  if (!bd) { MEMORIA.delete(k); return Promise.resolve(); }
  return new Promise(function(resolve) {
    try {
      const t = bd.transaction('datos', 'readwrite');
      t.objectStore('datos').delete(k);
      t.oncomplete = function() { resolve(); };
      t.onerror = function() { resolve(); };
    } catch (e) { resolve(); }
  });
}
const ls = {
  get: function(k, d) { try { const v = localStorage.getItem(PREF + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function(k, v) { try { if (v === null) localStorage.removeItem(PREF + k); else localStorage.setItem(PREF + k, JSON.stringify(v)); } catch (e) { /* lleno */ } }
};
function blobADataUrl(blob) {
  return new Promise(function(resolve, reject) {
    const r = new FileReader();
    r.onload = function() { resolve(String(r.result)); };
    r.onerror = function() { reject(r.error); };
    r.readAsDataURL(blob);
  });
}
async function blobABase64(blob) { const u = await blobADataUrl(blob); return u.slice(u.indexOf(',') + 1); }


/***********************
 * SERVIDOR (Apps Script)
 ***********************/

function codigoAcceso() { return ls.get('codigo', ''); }
function urlConfigurada() { return typeof URL_APPS_SCRIPT === 'string' && /^https:\/\/script\.google\.com\/.+\/exec$/.test(URL_APPS_SCRIPT.trim()); }

async function llamar(accion, extra, esperaMs, codigo) {
  if (!urlConfigurada()) throw new Error('Falta configurar la app: pega la URL de Apps Script en config.js.');
  const control = new AbortController();
  const espera = setTimeout(function() { control.abort(); }, esperaMs || 60000);
  let r;
  try {
    r = await fetch(URL_APPS_SCRIPT.trim(), {
      method: 'POST',
      body: JSON.stringify(Object.assign({ accion: accion, codigo: codigo === undefined ? codigoAcceso() : codigo }, extra || {})),
      redirect: 'follow', signal: control.signal
    });
  } catch (e) {
    const err = new Error('Sin conexión con el servidor.');
    err.sinRed = true;
    throw err;
  } finally {
    clearTimeout(espera);
  }
  let json;
  try { json = await r.json(); } catch (e) {
    throw new Error('El servidor no respondió como se esperaba. Revisa que la implementación de Apps Script esté publicada con acceso para "Cualquier usuario".');
  }
  if (!json.ok) { const err = new Error(json.error || 'El servidor rechazó el registro.'); err.codigo = json.codigo || ''; throw err; }
  return json;
}


/***********************
 * ESTADO
 ***********************/

const S = {
  cfg: CFG_INICIAL,
  servEq: [], servMt: [],      // lo que hay en la hoja
  cola: [],                    // cambios guardados en el teléfono, por subir
  minis: {},                   // fotos y firmas pequeñas: clave → dataURL
  sede: '', tecnico: '',
  vista: 'equipos',            // equipos | mantenimientos | ajustes
  pila: [],                    // pantallas internas abiertas (equipo, formEquipo, formMant)
  filtroTipo: 'Todos', filtroSede: '', buscar: '', filtroMt: 'Todos',
  selPC: '',                   // equipo elegido en la tabla del PC
  form: null,                  // formulario abierto
  sync: { estado: '', msg: '' }, sincronizando: false, otraVez: false, avisos: [],
  avisoInstalar: null
};

/** Equipos: los de la hoja con los cambios que aún no se suben encima. */
function equipos() {
  const m = new Map();
  S.servEq.forEach(function(e) { m.set(e.id, e); });
  S.cola.forEach(function(op) { if (op.accion === 'equipo') m.set(op.e.id, Object.assign({}, m.get(op.e.id) || {}, op.e, { pendiente: true })); });
  return Array.from(m.values());
}
function equipo(id) { return equipos().filter(function(e) { return e.id === id; })[0]; }
function mantenimientos() {
  const lista = S.servMt.slice();
  const ids = {};
  lista.forEach(function(m) { ids[m.id] = true; });
  S.cola.forEach(function(op) {
    if (op.accion === 'mant' && !ids[op.m.id]) {
      const e = equipo(op.m.equipoId);
      lista.push(Object.assign({}, op.m, { codigo: e ? e.codigo : op.m.codigo, pendiente: true }));
    }
  });
  return lista;
}
function mantsDe(e) {
  return mantenimientos().filter(function(m) { return m.codigo === e.codigo || (m.equipoId && m.equipoId === e.id); })
    .sort(function(a, b) { return (a.fecha + (a.registro || '')) < (b.fecha + (b.registro || '')) ? 1 : -1; });
}

/** Cómo va el preventivo de un equipo: clase de color, texto y fecha. */
function preventivo(e) {
  const ms = mantsDe(e);
  const prev = ms.filter(function(m) { return m.tipo === 'Preventivo'; });
  const ultimo = prev.length ? prev[0] : null;
  const hoy = hoyISO();
  const out = { clase: '', texto: '', proximo: '', ultimo: ultimo ? ultimo.fecha : '', dias: null };
  if (e.estado === 'Dado de baja') { out.texto = 'Dado de baja'; out.clase = 'baja'; return out; }
  if (e.periodicidad === 'Por horas de uso') {
    const cada = Number(e.cadaHoras) || 0;
    const horas = ms.filter(function(m) { return m.horometro !== '' && m.horometro != null && !isNaN(Number(m.horometro)); });
    const actual = horas.length ? Number(horas[0].horometro) : null;
    const base = ultimo && ultimo.horometro !== '' && ultimo.horometro != null ? Number(ultimo.horometro) : null;
    if (!cada) { out.clase = 'ambar'; out.texto = 'Falta definir cada cuántas horas'; }
    else if (actual === null || base === null) { out.clase = 'ambar'; out.texto = 'Preventivo cada ' + num(cada) + ' h · sin horómetro de referencia'; }
    else {
      const falta = base + cada - actual;
      if (falta <= 0) { out.clase = 'rojo'; out.texto = 'Preventivo pasado por ' + num(-falta) + ' h'; }
      else if (falta <= cada * 0.1) { out.clase = 'ambar'; out.texto = 'Preventivo en ' + num(falta) + ' h'; }
      else out.texto = 'Preventivo en ' + num(falta) + ' h · cada ' + num(cada) + ' h';
    }
  } else {
    const meses = MESES[e.periodicidad];
    // Sin preventivos registrados: se cuenta desde la instalación solo si es un equipo nuevo
    let base = out.ultimo;
    if (!base && e.instalacion && meses && diasEntre(hoy, sumarMeses(e.instalacion, meses)) >= 0) base = e.instalacion;
    if (!meses) { out.clase = 'ambar'; out.texto = 'Falta la periodicidad del preventivo'; }
    else if (!base) { out.clase = 'ambar'; out.texto = 'Sin preventivo registrado'; }
    else {
      out.proximo = sumarMeses(base, meses);
      out.dias = diasEntre(hoy, out.proximo);
      if (out.dias < 0) { out.clase = 'rojo'; out.texto = 'Preventivo atrasado ' + plural(-out.dias, 'día', 'días'); }
      else if (out.dias <= 15) { out.clase = 'ambar'; out.texto = out.dias === 0 ? 'Preventivo hoy' : 'Preventivo en ' + plural(out.dias, 'día', 'días') + ' · ' + fFecha(out.proximo); }
      else out.texto = 'Próximo preventivo ' + fFecha(out.proximo);
    }
  }
  if (e.estado === 'Fuera de servicio') { out.clase = 'rojo'; out.texto = 'Fuera de servicio · ' + out.texto.charAt(0).toLowerCase() + out.texto.slice(1); }
  else if (e.estado === 'Con observaciones' && out.clase !== 'rojo') { out.clase = 'ambar'; out.texto = 'Con observaciones · ' + out.texto.charAt(0).toLowerCase() + out.texto.slice(1); }
  return out;
}

function proponerCodigo(tipo, idActual) {
  const pre = 'GM-' + (PREFIJOS[tipo] || 'EQ') + '-';
  const usados = {};
  equipos().forEach(function(e) { if (e.id !== idActual) usados[e.codigo] = true; });
  for (let n = 1; n < 1000; n++) { const c = pre + dos(n); if (!usados[c]) return c; }
  return pre + azar(3);
}
function tecnicosDe(sede) { return (S.cfg.tecnicos && S.cfg.tecnicos[sede]) || []; }


/***********************
 * NAVEGACIÓN (con el botón atrás del teléfono)
 ***********************/

function abrir(p) {
  S.pila.push(p);
  try { history.pushState({ n: S.pila.length }, ''); } catch (e) { /* nada */ }
  pintar(true);
}
function volver() {
  if (S.pila.length) { try { history.back(); } catch (e) { S.pila.pop(); pintar(true); } }
}
window.addEventListener('popstate', function() {
  const tope = S.pila[S.pila.length - 1];
  if (tope && tope.tipo.indexOf('form') === 0 && S.form && S.form.sucio &&
      !confirm('Hay datos sin guardar en este formulario. ¿Salir sin guardar?')) {
    try { history.pushState({ n: S.pila.length }, ''); } catch (e) { /* nada */ }
    return;
  }
  S.pila.pop();
  if (!S.pila.length || S.pila[S.pila.length - 1].tipo.indexOf('form') !== 0) S.form = null;
  pintar(true);
});
function irVista(v) {
  S.vista = v;
  if (S.pila.length) {
    const n = S.pila.length;
    S.pila = [];
    S.form = null;
    try { history.go(-n); } catch (e) { /* nada */ }
  }
  pintar(true);
}


/***********************
 * PINTAR
 ***********************/

const app = function() { return $('#app'); };

function pintar(arriba) {
  if (!codigoAcceso()) return pintarAcceso();
  if (!S.tecnico || !S.sede) return pintarTurno();
  const tope = S.pila[S.pila.length - 1];
  const interna = !!tope;
  let html;
  if (tope && tope.tipo === 'equipo') html = htmlEquipo(tope.id);
  else if (tope && tope.tipo === 'formEquipo') html = htmlFormEquipo();
  else if (tope && tope.tipo === 'formMant') html = htmlFormMant();
  else if (S.vista === 'mantenimientos') html = htmlMantenimientos();
  else if (S.vista === 'ajustes') html = htmlAjustes();
  else html = htmlEquipos();
  const sinNav = interna && tope.tipo.indexOf('form') === 0;
  app().innerHTML = '<div class="marco ' + (sinNav ? 'sin-nav' : '') + '">' + htmlNav() +
    '<div class="principal"><div class="cuerpo' + (arriba ? ' entra' : '') + '">' + html + '</div></div></div>';
  enlazar();
  pintarFranja();
  if (arriba) window.scrollTo(0, 0);
  if (tope && tope.tipo.indexOf('form') === 0) montarFirmas();
}

function htmlNav() {
  const n = S.cola.length;
  const b = function(v, ic, txt) {
    const act = S.vista === v && !S.pila.length;
    return '<button type="button" data-acc="vista" data-v="' + v + '" aria-current="' + (act ? 'page' : 'false') + '">' +
      '<span class="pil">' + ico(ic, '', act) + '</span>' + txt + (v === 'ajustes' && n ? '<span class="punto">' + n + '</span>' : '') + '</button>';
  };
  return '<nav class="nav" aria-label="Secciones"><div class="dentro"><img class="logo-r solo-pc" src="logo.jpg" alt="Clínica Reina Catalina">' +
    b('equipos', 'precision_manufacturing', 'Equipos') + b('mantenimientos', 'build', 'Mantenimientos') + b('ajustes', 'settings', 'Ajustes') + '</div></nav>';
}

function cabecera(titulo, ctx, opciones) {
  opciones = opciones || {};
  const izq = opciones.volver
    ? '<button type="button" class="btn-ic" data-acc="volver" aria-label="Volver">' + ico('arrow_back') + '</button>'
    : '<img class="logo solo-cel" src="logo.jpg" alt="Clínica Reina Catalina">';
  return '<header class="cab' + (opciones.volver ? ' interna' : '') + '"><div class="cab-fila">' + izq + '<span class="esp"></span>' +
    (opciones.derecha || '') +
    (opciones.volver ? '' : '<a class="btn-ic" href="https://geol21.github.io/" aria-label="Abrir el portal de apps">' + ico('apps') + '</a>') +
    '</div><h1>' + esc(titulo) + '</h1>' + (ctx ? '<p class="ctx" id="ctx">' + ctx + '</p>' : '') + '</header>' +
    '<div id="franja" class="franja oculto" role="status"></div>';
}
function ctxPrincipal() { return 'Gases medicinales · ' + esc(S.sede) + ' · <span data-reloj>' + hora() + '</span>'; }

/* ---------- Equipos ---------- */

function filtrados() {
  const q = normal(S.buscar);
  return equipos().filter(function(e) {
    if (S.filtroSede && e.sede !== S.filtroSede) return false;
    if (S.filtroTipo !== 'Todos' && e.tipo !== S.filtroTipo) return false;
    if (q && normal([e.nombre, e.codigo, e.serie, e.marca, e.modelo, e.ubicacion].join(' ')).indexOf(q) < 0) return false;
    return true;
  });
}

function miniEquipo(e) {
  const m = S.minis['EQ:' + e.id];
  return '<span class="mini">' + (imgSegura(m) ? '<img src="' + m + '" alt="">' : ico(ICONO_TIPO[e.tipo] || 'precision_manufacturing')) + '</span>';
}

function filaEquipo(e) {
  const p = preventivo(e);
  const sub = [e.marca, e.modelo].filter(Boolean).join(' ') || e.ubicacion || e.tipo;
  return '<button type="button" class="fila toca ' + (p.clase === 'baja' ? '' : p.clase) + '" data-acc="equipo" data-id="' + esc(e.id) + '">' + miniEquipo(e) +
    '<span class="txt"><span class="t">' + esc(e.nombre) + '</span><span class="st">' +
    (p.clase === 'rojo' || p.clase === 'ambar' ? esc(p.texto) : esc(sub) + ' · ' + esc(p.texto)) +
    (e.pendiente ? ' · <span class="pend">' + ico('cloud_off', 's') + 'por subir</span>' : '') + '</span></span>' +
    '<span class="dato">' + esc(e.codigo) + '</span></button>';
}

function htmlEquipos() {
  const todos = equipos();
  const lista = filtrados();
  const conteo = function(t) { return todos.filter(function(e) { return (!S.filtroSede || e.sede === S.filtroSede) && (t === 'Todos' || e.tipo === t); }).length; };
  const tipos = ['Todos'].concat(S.cfg.tipos.filter(function(t) { return todos.some(function(e) { return e.tipo === t; }); }));
  let h = cabecera('Hojas de vida', ctxPrincipal());
  h += '<label class="buscar">' + ico('search') + '<span class="sr">Buscar</span><input id="buscar" type="search" placeholder="Buscar equipo, serie o código…" value="' + esc(S.buscar) + '" autocomplete="off"></label>';
  h += '<div class="filtros" role="group" aria-label="Sede">' + ['', ].concat(S.cfg.sedes).map(function(s) {
    const act = S.filtroSede === s;
    return '<button type="button" class="ficha" data-acc="fsede" data-v="' + esc(s) + '" aria-pressed="' + act + '">' + (act ? ico('check', 's') : '') + (s || 'Las dos sedes') + '</button>';
  }).join('') + '</div>';
  h += '<div class="filtros" role="group" aria-label="Tipo de equipo">' + tipos.map(function(t) {
    const act = S.filtroTipo === t;
    return '<button type="button" class="ficha" data-acc="ftipo" data-v="' + esc(t) + '" aria-pressed="' + act + '">' + (act ? ico('check', 's') : '') +
      esc(t === 'SAM (planta de aire medicinal)' ? 'SAM' : t) + ' <span class="n">' + conteo(t) + '</span></button>';
  }).join('') + '</div>';

  if (!todos.length) {
    h += '<div class="vacio">' + ico('home_repair_service', 'l') + '<b>Registra el primer equipo</b>Compresores, bombas de vacío, SAM, generadores de oxígeno… Cada uno con su foto, datos técnicos y plan de mantenimiento.</div>';
  } else if (!lista.length) {
    h += '<div class="vacio"><b>Nada coincide</b>Prueba con otra palabra o quita los filtros.</div>';
  } else {
    // En el PC: tabla y el detalle del equipo elegido al lado
    h += '<div class="solo-pc"><div class="pc-dos"><div>' + tablaPC(lista) + '</div><div class="det">' + detallePC(lista) + '</div></div></div>';
    h += '<div class="solo-cel">' + seccionesCel(lista) + '</div>';
  }
  h += '<div class="accion-fija en-lista"><button type="button" class="btn" data-acc="nuevoEquipo">' + ico('add') + 'Nuevo equipo</button></div>';
  return h;
}

function ordenar(lista) {
  const peso = { rojo: 0, ambar: 1, '': 2, baja: 3 };
  return lista.map(function(e) { return { e: e, p: preventivo(e) }; }).sort(function(a, b) {
    const d = peso[a.p.clase] - peso[b.p.clase];
    if (d) return d;
    return (a.e.codigo || '').localeCompare(b.e.codigo || '', 'es', { numeric: true });
  });
}

function seccionesCel(lista) {
  const ord = ordenar(lista);
  const atender = ord.filter(function(x) { return x.p.clase === 'rojo' || x.p.clase === 'ambar'; });
  const resto = ord.filter(function(x) { return x.p.clase === ''; });
  const baja = ord.filter(function(x) { return x.p.clase === 'baja'; });
  let h = '';
  if (atender.length) h += '<h2 class="secc">Hay que atender <small>' + plural(atender.length, 'equipo', 'equipos') + '</small></h2><div class="grupo">' + atender.map(function(x) { return filaEquipo(x.e); }).join('') + '</div>';
  S.cfg.tipos.concat(['Otro']).forEach(function(t) {
    const de = resto.filter(function(x) { return t === 'Otro' ? S.cfg.tipos.indexOf(x.e.tipo) < 0 : x.e.tipo === t; });
    if (!de.length) return;
    const nombre = t === 'SAM (planta de aire medicinal)' ? 'SAM' : (t === 'Otro' ? 'Otros equipos' : t + (/r$|n$|l$/.test(t) ? 'es' : 's'));
    h += '<h2 class="secc">' + esc(t === 'Bomba de vacío' ? 'Bombas de vacío' : t === 'Generador de oxígeno' ? 'Generadores de oxígeno' : t === 'Secador de aire' ? 'Secadores de aire' : t === 'Tanque pulmón' ? 'Tanques pulmón' : nombre) +
      ' <small>' + plural(de.length, 'equipo', 'equipos') + '</small></h2><div class="grupo">' + de.map(function(x) { return filaEquipo(x.e); }).join('') + '</div>';
  });
  if (baja.length) h += '<h2 class="secc">Dados de baja <small>' + baja.length + '</small></h2><div class="grupo">' + baja.map(function(x) { return filaEquipo(x.e); }).join('') + '</div>';
  return h;
}

function tablaPC(lista) {
  const ord = ordenar(lista);
  if (!S.selPC || !ord.some(function(x) { return x.e.id === S.selPC; })) S.selPC = ord[0].e.id;
  return '<table class="tabla"><thead><tr><th></th><th>Equipo</th><th>Sede · ubicación</th><th>Preventivo</th><th>Código</th></tr></thead><tbody>' +
    ord.map(function(x) {
      const e = x.e, p = x.p;
      return '<tr class="' + (p.clase === 'baja' ? '' : p.clase) + (e.id === S.selPC ? ' sel' : '') + '" data-acc="selPC" data-id="' + esc(e.id) + '" tabindex="0">' +
        '<td style="width:56px">' + miniEquipo(e) + '</td><td><b>' + esc(e.nombre) + '</b><small>' + esc([e.marca, e.modelo].filter(Boolean).join(' ') || e.tipo) + '</small></td>' +
        '<td>' + esc(e.sede) + '<small>' + esc(e.ubicacion || '') + '</small></td>' +
        '<td' + (p.clase === 'rojo' ? ' style="color:var(--rojo-t)"' : p.clase === 'ambar' ? ' style="color:var(--ambar-t)"' : '') + '>' + esc(p.texto) + '</td>' +
        '<td><span class="dato">' + esc(e.codigo) + '</span>' + (e.pendiente ? '<small class="pend">por subir</small>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
}

function detallePC() {
  const e = equipo(S.selPC);
  if (!e) return '';
  return '<div class="foto-eq"><span class="grande">' + (imgSegura(S.minis['EQ:' + e.id]) ? '<img src="' + S.minis['EQ:' + e.id] + '" alt="">' : ico(ICONO_TIPO[e.tipo] || 'precision_manufacturing', 'l')) + '</span>' +
    '<div><p style="font-size:24px;font-weight:860;line-height:1.15">' + esc(e.nombre) + '</p><p class="ayuda">' + esc(e.codigo) + ' · ' + esc(e.sede) + '</p>' + chipEstado(e.estado) + '</div></div>' +
    tarjetaPreventivo(e) + bloquesEquipo(e, true) +
    '<div class="dos-col" style="margin-top:18px"><button type="button" class="btn" data-acc="nuevoMant" data-id="' + esc(e.id) + '">' + ico('build') + 'Registrar mantenimiento</button>' +
    '<button type="button" class="btn sec" data-acc="pdf" data-id="' + esc(e.id) + '">' + ico('picture_as_pdf') + 'Generar PDF</button></div>' +
    '<button type="button" class="btn sec" style="margin-top:10px" data-acc="editarEquipo" data-id="' + esc(e.id) + '">' + ico('edit') + 'Editar hoja de vida</button>';
}

function chipEstado(est) {
  const c = est === 'Funcionando' ? 'Funcionando' : est === 'Con observaciones' ? 'obs' : est === 'Fuera de servicio' ? 'fuera' : 'baja';
  return '<span class="chip-est ' + c + '">' + (est === 'Funcionando' ? ico('verified', 's', true) : '') + esc(est || 'Sin estado') + '</span>';
}

function tarjetaPreventivo(e) {
  const p = preventivo(e);
  if (p.clase === 'baja') return '';
  const prog = e.periodicidad === 'Por horas de uso' ? 'Cada ' + num(e.cadaHoras) + ' h de uso' : (e.periodicidad || 'Sin periodicidad');
  const grande = p.proximo ? fFecha(p.proximo) + (p.dias !== null ? ' · ' + (p.dias < 0 ? 'hace ' + plural(-p.dias, 'día', 'días') : p.dias === 0 ? 'hoy' : 'en ' + plural(p.dias, 'día', 'días')) : '') : p.texto;
  return '<div class="destacada ' + (p.clase === 'rojo' || p.clase === 'ambar' ? p.clase : '') + '"><div class="txt"><p class="k">' + (p.proximo ? 'Próximo preventivo' : 'Preventivo') + '</p>' +
    '<p class="g">' + esc(grande) + '</p><p class="k">' + esc(prog) + (p.ultimo ? ' · último ' + fFecha(p.ultimo) : '') + '</p></div>' +
    '<button type="button" class="redondo" data-acc="nuevoMant" data-id="' + esc(e.id) + '" aria-label="Registrar mantenimiento">' + ico('build') + '</button></div>';
}

function grupoPares(pares) {
  const v = pares.filter(function(p) { return p[1] !== '' && p[1] != null; });
  if (!v.length) return '<div class="grupo"><div class="fila" style="min-height:56px"><span class="ayuda">Sin datos todavía</span></div></div>';
  return '<div class="grupo">' + v.map(function(p) {
    return '<div class="fila par" style="min-height:56px"><span class="k">' + esc(p[0]) + '</span><span class="v">' + esc(p[1]) + '</span></div>';
  }).join('') + '</div>';
}

function bloquesEquipo(e, compacto) {
  let h = '<h2 class="secc">Identificación</h2>' + grupoPares([
    ['Tipo', e.tipo], ['Marca · modelo', [e.marca, e.modelo].filter(Boolean).join(' · ')], ['Serie', e.serie],
    ['Sede · ubicación', [e.sede, e.ubicacion].filter(Boolean).join(' · ')]]);
  h += '<h2 class="secc">Adquisición</h2>' + grupoPares([
    ['Proveedor', e.proveedor], ['Instalación', fFecha(e.instalacion) + (e.forma ? ' · ' + e.forma : '')],
    ['Garantía hasta', fFecha(e.garantia)], ['Registro INVIMA', e.invima], ['Clasificación de riesgo', e.riesgo]]);
  h += '<h2 class="secc">Datos técnicos</h2>' + grupoPares([
    ['Potencia', e.potencia], ['Voltaje · fases', [e.voltaje, e.fases].filter(Boolean).join(' · ')], ['Corriente', e.corriente],
    ['Caudal', e.caudal], ['Presión de trabajo', e.presion], ['Lubricación', e.lubricacion], ['Otros', e.otros]]);
  h += '<h2 class="secc">Plan de mantenimiento</h2>' + grupoPares([
    ['Periodicidad', e.periodicidad === 'Por horas de uso' ? 'Cada ' + num(e.cadaHoras) + ' h de uso' : e.periodicidad],
    ['Responsable', e.responsable === 'Proveedor' ? 'Proveedor · ' + (e.empresaMtto || '') : e.responsable],
    ['Manual del fabricante', e.manual], ['Recomendaciones', e.recomendaciones]]);
  const ms = mantsDe(e);
  h += '<h2 class="secc">Historial <small>' + plural(ms.length, 'intervención', 'intervenciones') + '</small></h2>';
  h += ms.length ? '<div class="grupo">' + ms.slice(0, compacto ? 6 : 999).map(filaMant).join('') + '</div>'
    : '<div class="grupo"><div class="fila"><span class="ayuda">Aún no hay mantenimientos registrados.</span></div></div>';
  return h;
}

function filaMant(m, conEquipo) {
  const quien = m.quien === 'Proveedor' ? (m.empresa || 'Proveedor') + (m.nombreProv ? ' · ' + nombreBonito(m.nombreProv) : '') : nombresTec(m.tecnico);
  const icono = m.tipo === 'Preventivo' ? 'event_available' : m.tipo === 'Correctivo' ? 'handyman' : m.tipo === 'Inspección' ? 'search' : 'build';
  return '<div class="fila"><span class="mini">' + ico(icono) + '</span><span class="txt"><span class="t">' +
    esc((conEquipo ? m.equipo || m.codigo : m.tipo) + (conEquipo ? ' · ' + m.tipo : '')) + '</span><span class="st">' +
    esc(fFecha(m.fecha) + ' · ' + quien + (m.horometro !== '' && m.horometro != null ? ' · ' + num(m.horometro) + ' h' : '') + ' · ' + m.descripcion) +
    (m.pendiente ? ' · <span class="pend">' + ico('cloud_off', 's') + 'por subir</span>' : '') + '</span></span>' +
    (m.estadoFinal && m.estadoFinal !== 'Funcionando' ? '<span class="dato">' + esc(m.estadoFinal) + '</span>' : '') + '</div>';
}

/* ---------- Pantalla de un equipo (celular) ---------- */

function htmlEquipo(id) {
  const e = equipo(id);
  if (!e) return cabecera('Equipo', '', { volver: true }) + '<div class="vacio"><b>No se encontró el equipo</b></div>';
  const der = '<button type="button" class="btn-ic" data-acc="pdf" data-id="' + esc(e.id) + '" aria-label="Generar PDF">' + ico('picture_as_pdf') + '</button>' +
    '<button type="button" class="btn-ic" data-acc="editarEquipo" data-id="' + esc(e.id) + '" aria-label="Editar">' + ico('edit') + '</button>';
  let h = cabecera(e.nombre, esc(e.codigo) + ' · ' + esc(e.sede) + (e.pendiente ? ' · <span class="pend">por subir</span>' : ''), { volver: true, derecha: der });
  h += '<div class="foto-eq"><button type="button" class="grande" data-acc="editarEquipo" data-id="' + esc(e.id) + '" aria-label="Foto del equipo">' +
    (imgSegura(S.minis['EQ:' + e.id]) ? '<img src="' + S.minis['EQ:' + e.id] + '" alt="Foto del equipo">' : ico('photo_camera', 'l')) + '</button>' +
    '<div><p class="ayuda">' + esc([e.marca, e.modelo].filter(Boolean).join(' ') || e.tipo) + '</p>' + chipEstado(e.estado) + '</div></div>';
  h += tarjetaPreventivo(e) + bloquesEquipo(e, false);
  h += '<div class="accion-fija"><button type="button" class="btn" data-acc="nuevoMant" data-id="' + esc(e.id) + '">' + ico('build') + 'Registrar mantenimiento</button></div>';
  return h;
}

/* ---------- Mantenimientos ---------- */

function htmlMantenimientos() {
  const todos = mantenimientos().filter(function(m) {
    const e = equipos().filter(function(x) { return x.codigo === m.codigo || x.id === m.equipoId; })[0];
    return !S.filtroSede || (e ? e.sede : m.sede) === S.filtroSede;
  }).sort(function(a, b) { return (a.fecha + (a.registro || '')) < (b.fecha + (b.registro || '')) ? 1 : -1; });
  const lista = todos.filter(function(m) { return S.filtroMt === 'Todos' || m.tipo === S.filtroMt; });
  let h = cabecera('Mantenimientos', ctxPrincipal());
  h += '<div class="filtros" role="group" aria-label="Tipo">' + ['Todos'].concat(TIPOS_MT).map(function(t) {
    const act = S.filtroMt === t;
    const n = todos.filter(function(m) { return t === 'Todos' || m.tipo === t; }).length;
    return '<button type="button" class="ficha" data-acc="fmt" data-v="' + esc(t) + '" aria-pressed="' + act + '">' + (act ? ico('check', 's') : '') + esc(t) + ' <span class="n">' + n + '</span></button>';
  }).join('') + '</div>';
  // Próximos preventivos de todos los equipos
  const prox = ordenar(equipos().filter(function(e) { return !S.filtroSede || e.sede === S.filtroSede; }))
    .filter(function(x) { return x.p.clase === 'rojo' || x.p.clase === 'ambar'; });
  if (prox.length && S.filtroMt === 'Todos') {
    h += '<h2 class="secc">Por hacer <small>' + plural(prox.length, 'equipo', 'equipos') + '</small></h2><div class="grupo">' + prox.map(function(x) { return filaEquipo(x.e); }).join('') + '</div>';
  }
  if (!lista.length) {
    h += '<div class="vacio">' + ico('build', 'l') + '<b>Sin mantenimientos registrados</b>Abre un equipo y toca «Registrar mantenimiento».</div>';
    return h;
  }
  const porMes = {};
  lista.forEach(function(m) { const k = String(m.fecha).slice(0, 7); (porMes[k] = porMes[k] || []).push(m); });
  Object.keys(porMes).sort().reverse().forEach(function(k) {
    const p = k.split('-');
    const nombre = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][Number(p[1]) - 1] + ' ' + p[0];
    h += '<h2 class="secc">' + nombre + ' <small>' + porMes[k].length + '</small></h2><div class="grupo">' + porMes[k].map(function(m) { return filaMant(m, true); }).join('') + '</div>';
  });
  return h;
}

/* ---------- Ajustes ---------- */

function htmlAjustes() {
  const n = S.cola.length;
  let h = cabecera('Ajustes', ctxPrincipal());
  h += '<h2 class="secc">Este teléfono</h2><div class="grupo">' +
    '<div class="fila"><span class="mini">' + ico('person') + '</span><span class="txt"><span class="t">' + esc(nombreBonito(S.tecnico)) + '</span><span class="st">' + esc(S.sede) + '</span></span><button type="button" class="pastilla" data-acc="cambiarTec">Cambiar</button></div>' +
    '<div class="fila ' + (n ? 'ambar' : '') + '"><span class="mini">' + ico(n ? 'cloud_off' : 'cloud_done') + '</span><span class="txt"><span class="t">' + (n ? plural(n, 'cambio sin subir', 'cambios sin subir') : 'Todo subido') + '</span><span class="st">' + esc(n ? S.cola.map(describirOp).join(' · ') : 'La hoja de Google tiene todo') + '</span></span>' + (n ? '<button type="button" class="pastilla" data-acc="sync">Subir ahora</button>' : '') + '</div>' +
    '<div class="fila"><span class="mini">' + ico('lock') + '</span><span class="txt"><span class="t">Código de acceso</span><span class="st">Guardado en este teléfono</span></span><button type="button" class="pastilla" data-acc="salir">Cerrar sesión</button></div>' +
    '</div>';
  h += '<h2 class="secc">La app</h2><div class="grupo">' +
    (S.avisoInstalar ? '<div class="fila"><span class="mini">' + ico('install_desktop') + '</span><span class="txt"><span class="t">Instalar la app</span><span class="st">Ábrela desde la pantalla de inicio, sin el navegador</span></span><button type="button" class="pastilla" data-acc="instalar">Instalar</button></div>' : '') +
    '<div class="fila"><span class="mini">' + ico('description') + '</span><span class="txt"><span class="t">Formato del PDF</span><span class="st">' + FORMATO.codigo + ' · Versión ' + FORMATO.version + ' · ' + FORMATO.fecha + ' · Revisó: ' + esc(S.cfg.coordinador) + '</span></span></div>' +
    '<div class="fila"><span class="mini">' + ico('info') + '</span><span class="txt"><span class="t">Versión ' + VERSION_APP + '</span><span class="st">Listas (técnicos, ubicaciones, empresas) y código: pestaña Config de la hoja</span></span></div>' +
    '</div>';
  return h;
}

function describirOp(op) {
  if (op.accion === 'equipo') return 'Equipo ' + (op.e.codigo || op.e.nombre);
  if (op.accion === 'mant') return op.m.tipo + ' ' + (op.m.codigo || '');
  if (op.accion === 'pdf') return 'PDF ' + (op.codigo || '');
  return op.accion;
}


/***********************
 * FORMULARIO: EQUIPO
 ***********************/

function abrirFormEquipo(id) {
  const e = id ? equipo(id) : null;
  const base = e ? JSON.parse(JSON.stringify(e)) : {
    id: nuevoId('EQ'), codigo: '', nombre: '', tipo: '', sede: S.sede, ubicacion: '', marca: '', modelo: '', serie: '',
    estado: 'Funcionando', proveedor: '', instalacion: '', forma: '', garantia: '', invima: '', riesgo: '',
    potencia: '', voltaje: '', fases: '', corriente: '', caudal: '', presion: '', lubricacion: '', otros: '',
    periodicidad: '', cadaHoras: '', responsable: '', empresaMtto: '', manual: '', recomendaciones: ''
  };
  delete base.pendiente;
  S.form = { tipo: 'equipo', nuevo: !e, d: base, foto: null, codigoTocado: !!e, sucio: false };
  abrir({ tipo: 'formEquipo' });
}

/** Fichas para elegir una opción (con ✓ en la elegida). */
/** Fichas donde se pueden marcar varias (técnicos de un mantenimiento). */
function fichasVarias(campo, opciones, valores) {
  return '<div class="fichas" role="group" data-campo="' + campo + '">' + opciones.map(function(o) {
    const act = valores.indexOf(o) >= 0;
    return '<button type="button" class="ficha" data-acc="eligeVarias" data-f="' + campo + '" data-v="' + esc(o) + '" aria-pressed="' + act + '">' + (act ? ico('check', 's') : '') + esc(o) + '</button>';
  }).join('') + '</div>';
}

function fichas(campo, opciones, valor, extra) {
  return '<div class="fichas" role="group" data-campo="' + campo + '">' + opciones.map(function(o) {
    const act = valor === o;
    return '<button type="button" class="ficha" data-acc="elige" data-f="' + campo + '" data-v="' + esc(o) + '" aria-pressed="' + act + '">' + (act ? ico('check', 's') : '') + esc(o) + '</button>';
  }).join('') + (extra || '') + '</div>';
}

/** Lista que se elige (con buscador si son muchas) y botón "Agregar …" para crear una opción nueva. */
function selector(campo, opciones, valor, agregar) {
  const f = S.form;
  f.extra = f.extra || {};
  const todas = opciones.concat((f.extra[campo] || []).filter(function(x) { return opciones.indexOf(x) < 0; }));
  if (valor && todas.indexOf(valor) < 0) todas.push(valor);
  const q = normal((f.busca || {})[campo] || '');
  const muchas = todas.length > 10;
  const vis = todas.filter(function(o) { return !q || normal(o).indexOf(q) >= 0 || o === valor; }).slice(0, muchas && !q ? 10 : 99);
  return (muchas ? '<label class="buscar" style="margin:0 0 8px;min-height:48px">' + ico('search', 's') + '<input data-busca="' + campo + '" placeholder="Buscar…" value="' + esc((f.busca || {})[campo] || '') + '"></label>' : '') +
    fichas(campo, vis, valor,
      '<button type="button" class="ficha" data-acc="agregar" data-f="' + campo + '">' + ico('add', 's') + esc(agregar) + '</button>') +
    '<input class="entrada oculto" data-nuevo="' + campo + '" placeholder="' + esc(agregar.replace('Agregar ', '')) + ' nueva" enterkeyhint="done" style="margin-top:8px">';
}

function campoTexto(campo, etiqueta, valor, opciones) {
  opciones = opciones || {};
  const tag = opciones.largo ? 'textarea' : 'input';
  return '<div class="campo" id="c-' + campo + '"><label class="etq" for="f-' + campo + '">' + esc(etiqueta) + (opciones.nota ? '<em>' + esc(opciones.nota) + '</em>' : '') + '</label>' +
    '<' + tag + ' class="entrada" id="f-' + campo + '" data-f="' + campo + '"' + (opciones.tipo ? ' type="' + opciones.tipo + '"' : '') +
    (opciones.modo ? ' inputmode="' + opciones.modo + '"' : '') + ' placeholder="' + esc(opciones.ph || '') + '" autocomplete="off"' +
    (opciones.mayus ? ' autocapitalize="characters"' : '') + (tag === 'input' ? ' value="' + esc(valor) + '">' : '>' + esc(valor) + '</textarea>') +
    (opciones.noAplica ? '<div class="fichas"><button type="button" class="ficha" data-acc="noaplica" data-f="' + campo + '" aria-pressed="' + (valor === 'No aplica') + '">' + (valor === 'No aplica' ? ico('check', 's') : '') + 'No aplica</button></div>' : '') +
    '</div>';
}

const SELLO = '<span class="listo">' + '{{ic}}' + 'Listo</span>';
function listo(ok) { return ok ? SELLO.replace('{{ic}}', ico('verified', '', true)) : ''; }

function faltaEquipo(d, foto) {
  const f = [];
  if (!d.tipo) f.push(['el tipo de equipo', '#c-tipo']);
  if (!String(d.nombre).trim()) f.push(['el nombre del equipo', '#c-nombre']);
  if (!d.sede) f.push(['la sede', '#c-sede']);
  if (!d.estado) f.push(['el estado', '#c-estado']);
  if (!d.periodicidad) f.push(['la periodicidad del preventivo', '#c-periodicidad']);
  if (d.periodicidad === 'Por horas de uso' && !(Number(String(d.cadaHoras).replace(',', '.')) > 0)) f.push(['cada cuántas horas va el preventivo', '#c-cadaHoras']);
  if (d.responsable === 'Proveedor' && !d.empresaMtto) f.push(['la empresa que hace el mantenimiento', '#c-empresaMtto']);
  return f;
}

function htmlFormEquipo() {
  const F = S.form, d = F.d;
  if (!F.codigoTocado && d.tipo) d.codigo = proponerCodigo(d.tipo, d.id);
  const fotoSrc = F.foto ? F.foto.url : (imgSegura(S.minis['EQ:' + d.id]) ? S.minis['EQ:' + d.id] : '');
  let h = cabecera(F.nuevo ? 'Nuevo equipo' : 'Editar hoja de vida', (d.codigo ? esc(d.codigo) + ' · ' : '') + esc(d.sede || S.sede), { volver: true });
  h += '<div class="form-pc">';
  // Foto (la hoja de vida empieza con ella)
  h += '<div class="ancho"><h2 class="secc">Foto del equipo ' + listo(!!fotoSrc) + '</h2>' +
    (fotoSrc ? '<div class="foto-prev" id="c-foto"><img src="' + fotoSrc + '" alt="Foto del equipo"><div class="acc"><button type="button" data-acc="foto">' + ico('photo_camera', 's') + 'Cambiar</button></div></div>'
      : '<button type="button" class="foto-btn" id="c-foto" data-acc="foto">' + ico('add_a_photo', 'l') + 'Tomar foto del equipo<span class="ayuda">La hoja de vida empieza con esta foto</span></button>') +
    '<input type="file" id="archFoto" accept="image/*" class="oculto"></div>';
  // Identificación
  const okId = d.tipo && String(d.nombre).trim() && d.sede && d.estado;
  h += '<div><h2 class="secc">Identificación ' + listo(!!okId) + '</h2><div class="tarjeta">' +
    '<div class="campo" id="c-tipo"><span class="etq">Tipo de equipo</span>' + selector('tipo', S.cfg.tipos, d.tipo, 'Agregar tipo') + '</div>' +
    campoTexto('nombre', 'Nombre del equipo', d.nombre, { ph: 'Compresor A · SAM' }) +
    '<div class="campo" id="c-codigo"><label class="etq" for="f-codigo">Código interno<em>' + (F.codigoTocado ? '' : 'propuesto') + '</em></label><input class="entrada" id="f-codigo" data-f="codigo" value="' + esc(d.codigo) + '" placeholder="GM-CP-01" autocapitalize="characters"></div>' +
    '<div class="campo" id="c-sede"><span class="etq">Sede</span>' + fichas('sede', S.cfg.sedes, d.sede) + '</div>' +
    '<div class="campo" id="c-ubicacion"><span class="etq">Ubicación</span>' + selector('ubicacion', S.cfg.ubicaciones, d.ubicacion, 'Agregar ubicación') + '</div>' +
    '<div class="dos-col">' + campoTexto('marca', 'Marca', d.marca, { ph: 'Atlas Copco' }) + campoTexto('modelo', 'Modelo', d.modelo, { ph: 'GA7 VSD' }) + '</div>' +
    campoTexto('serie', 'Serie', d.serie, { ph: 'API123456', mayus: true }) +
    '<div class="campo" id="c-estado"><span class="etq">Estado</span>' + fichas('estado', ESTADOS, d.estado) + '</div>' +
    '</div></div>';
  // Adquisición
  h += '<div><h2 class="secc">Adquisición</h2><div class="tarjeta">' +
    campoTexto('proveedor', 'Proveedor', d.proveedor, { ph: 'Empresa que lo vendió o instaló' }) +
    '<div class="dos-col">' + campoTexto('instalacion', 'Fecha de instalación', d.instalacion, { tipo: 'date' }) + campoTexto('garantia', 'Garantía hasta', d.garantia, { tipo: 'date' }) + '</div>' +
    '<div class="campo" id="c-forma"><span class="etq">Forma de adquisición</span>' + fichas('forma', FORMAS, d.forma) + '</div>' +
    campoTexto('invima', 'Registro INVIMA', d.invima, { ph: 'Número de registro', noAplica: true, nota: 'compresores y bombas suelen no tenerlo' }) +
    '<div class="campo" id="c-riesgo"><span class="etq">Clasificación de riesgo</span>' + fichas('riesgo', RIESGOS, d.riesgo) + '</div>' +
    '</div></div>';
  // Datos técnicos
  h += '<div><h2 class="secc">Datos técnicos</h2><div class="tarjeta">' +
    '<div class="dos-col">' + campoTexto('potencia', 'Potencia', d.potencia, { ph: '7,5 kW · 10 HP' }) + campoTexto('voltaje', 'Voltaje', d.voltaje, { ph: '440 V' }) + '</div>' +
    '<div class="campo" id="c-fases"><span class="etq">Fases</span>' + fichas('fases', FASES, d.fases) + '</div>' +
    '<div class="dos-col">' + campoTexto('corriente', 'Corriente', d.corriente, { ph: '12 A' }) + campoTexto('caudal', 'Caudal', d.caudal, { ph: '21 CFM · 40 L/min' }) + '</div>' +
    campoTexto('presion', 'Presión de trabajo', d.presion, { ph: '7,5 bar · 110 psi' }) +
    '<div class="campo" id="c-lubricacion"><span class="etq">Lubricación</span>' + fichas('lubricacion', LUBRICACION, d.lubricacion) + '</div>' +
    campoTexto('otros', 'Otros datos técnicos', d.otros, { largo: true, ph: 'Pureza de O₂, capacidad del tanque, tipo de motor…' }) +
    '</div></div>';
  // Plan de mantenimiento
  const okPlan = d.periodicidad && (d.periodicidad !== 'Por horas de uso' || Number(String(d.cadaHoras).replace(',', '.')) > 0) && (d.responsable !== 'Proveedor' || d.empresaMtto);
  h += '<div><h2 class="secc">Plan de mantenimiento ' + listo(!!okPlan) + '</h2><div class="tarjeta">' +
    '<div class="campo" id="c-periodicidad"><span class="etq">Periodicidad del preventivo<em>la define administración; se puede cambiar</em></span>' + fichas('periodicidad', PERIODOS, d.periodicidad) + '</div>' +
    (d.periodicidad === 'Por horas de uso' ? campoTexto('cadaHoras', 'Cada cuántas horas', d.cadaHoras, { modo: 'decimal', ph: '2000' }) : '') +
    '<div class="campo" id="c-responsable"><span class="etq">¿Quién hace el mantenimiento?</span>' + fichas('responsable', ['Técnicos de la clínica', 'Proveedor'], d.responsable) + '</div>' +
    (d.responsable === 'Proveedor' ? '<div class="campo" id="c-empresaMtto"><span class="etq">Empresa</span>' + selector('empresaMtto', S.cfg.empresas, d.empresaMtto, 'Agregar empresa') + '</div>' : '') +
    '<div class="campo" id="c-manual"><span class="etq">Manual del fabricante</span>' + fichas('manual', ['Sí', 'No'], d.manual) + '</div>' +
    campoTexto('recomendaciones', 'Recomendaciones del fabricante', d.recomendaciones, { largo: true, ph: 'Cambio de filtros cada 2000 h, aceite cada 4000 h…' }) +
    '</div></div>';
  h += '</div>';
  h += '<div class="accion-fija"><button type="button" class="btn" data-acc="guardarEquipo">' + ico('check') + (F.nuevo ? 'Guardar equipo' : 'Guardar cambios') + '</button></div>';
  return h;
}

async function guardarEquipo() {
  const F = S.form, d = F.d;
  const faltan = faltaEquipo(d, F.foto);
  if (faltan.length) { avisoFalta(faltan[0][0], faltan[0][1]); return; }
  d.codigo = String(d.codigo || '').trim().toUpperCase() || proponerCodigo(d.tipo, d.id);
  if (equipos().some(function(e) { return e.id !== d.id && e.codigo === d.codigo; })) {
    avisoFalta('un código que no use otro equipo (' + d.codigo + ' ya existe)', '#c-codigo');
    return;
  }
  d.nombre = String(d.nombre).trim();
  d.cadaHoras = d.periodicidad === 'Por horas de uso' ? Number(String(d.cadaHoras).replace(',', '.')) : '';
  if (d.responsable !== 'Proveedor') d.empresaMtto = '';
  d.mod = new Date().toISOString();
  d.modPor = S.tecnico;
  const op = { accion: 'equipo', e: JSON.parse(JSON.stringify(d)) };
  if (F.foto) {
    op.fotoClave = 'foto:' + d.id + ':' + Date.now();
    await guardarDato(op.fotoClave, F.foto.blob);
    S.minis['EQ:' + d.id] = F.foto.mini;
    await guardarDato('mini:EQ:' + d.id, F.foto.mini);
  }
  await encolar(op);
  F.sucio = false;
  sonarListo();
  toast(ico('check', 's') + (F.nuevo ? 'Equipo guardado' : 'Cambios guardados') + (navigator.onLine ? '' : ' en el teléfono'));
  const nuevo = F.nuevo;
  S.form = null;
  S.selPC = d.id;
  if (nuevo) {
    // Se cambia el formulario por la pantalla del equipo
    S.pila[S.pila.length - 1] = { tipo: 'equipo', id: d.id };
    pintar(true);
  } else volver();
  sincronizar();
}


/***********************
 * FORMULARIO: MANTENIMIENTO
 ***********************/

function abrirFormMant(idEquipo) {
  const e = equipo(idEquipo);
  if (!e) return;
  S.form = {
    tipo: 'mant', equipoId: e.id, fotos: [], informe: null, firmas: {}, sucio: false,
    d: { id: nuevoId('MT'), equipoId: e.id, codigo: e.codigo, equipo: e.nombre, sede: e.sede, fecha: hoyISO(), tipo: '', descripcion: '', repuestos: '',
      horometro: '', estadoFinal: '', quien: e.responsable === 'Proveedor' ? 'Proveedor' : '', tecnico: S.tecnico, empresa: e.responsable === 'Proveedor' ? (e.empresaMtto || '') : '',
      nombreProv: '', orden: '', recibe: S.tecnico }
  };
  abrir({ tipo: 'formMant' });
}

function faltaMant(F) {
  const d = F.d, f = [];
  if (!d.tipo) f.push(['el tipo de mantenimiento', '#c-tipo']);
  if (!d.fecha) f.push(['la fecha', '#c-fecha']);
  if (!String(d.descripcion).trim()) f.push(['lo que se hizo', '#c-descripcion']);
  if (!d.estadoFinal) f.push(['cómo quedó el equipo', '#c-estadoFinal']);
  if (!d.quien) f.push(['quién hizo el mantenimiento', '#c-quien']);
  if (d.quien === 'Técnico de la clínica') {
    if (!d.tecnico) f.push(['el técnico', '#c-tecnico']);
    if (!F.firmas.firma) f.push(['la firma del técnico', '#c-firma']);
  }
  if (d.quien === 'Proveedor') {
    if (!d.empresa) f.push(['la empresa proveedora', '#c-empresa']);
    if (!String(d.nombreProv).trim()) f.push(['el nombre de quien lo hizo', '#c-nombreProv']);
    if (!F.firmas.firma) f.push(['la firma del proveedor', '#c-firma']);
    if (!d.recibe) f.push(['quién recibe a satisfacción', '#c-recibe']);
    if (!F.firmas.firmaRecibe) f.push(['la firma de quien recibe', '#c-firmaRecibe']);
  }
  return f;
}

function htmlFormMant() {
  const F = S.form, d = F.d;
  const e = equipo(F.equipoId) || {};
  const tecs = tecnicosDe(d.sede).length ? tecnicosDe(d.sede) : [S.tecnico];
  let h = cabecera('Mantenimiento', esc(e.nombre || '') + ' · ' + esc(e.codigo || '') + ' · <span data-reloj>' + hora() + '</span>', { volver: true });
  h += '<div class="form-pc">';
  const okLo = d.tipo && d.fecha && String(d.descripcion).trim() && d.estadoFinal;
  h += '<div><h2 class="secc">Lo que se hizo ' + listo(!!okLo) + '</h2><div class="tarjeta">' +
    '<div class="campo" id="c-tipo"><span class="etq">Tipo</span>' + fichas('tipo', TIPOS_MT, d.tipo) + '</div>' +
    '<div class="dos-col">' + campoTexto('fecha', 'Fecha', d.fecha, { tipo: 'date' }) + campoTexto('horometro', 'Horómetro (h)', d.horometro, { modo: 'decimal', ph: '12430', nota: 'opcional' }) + '</div>' +
    campoTexto('descripcion', 'Descripción', d.descripcion, { largo: true, ph: 'Cambio de filtro de aire y aceite, revisión de correas, purga de condensado…' }) +
    campoTexto('repuestos', 'Repuestos', d.repuestos, { largo: true, ph: 'Filtro de aire 1622 0651 00 · 1 und', nota: 'opcional' }) +
    '<div class="campo" id="c-estadoFinal"><span class="etq">¿Cómo quedó el equipo?</span>' + fichas('estadoFinal', ESTADOS.slice(0, 3), d.estadoFinal) + '</div>' +
    '</div></div>';
  // Quién lo hizo
  let okQ = false;
  if (d.quien === 'Técnico de la clínica') okQ = !!(d.tecnico && F.firmas.firma);
  if (d.quien === 'Proveedor') okQ = !!(d.empresa && String(d.nombreProv).trim() && F.firmas.firma && d.recibe && F.firmas.firmaRecibe);
  h += '<div><h2 class="secc">Realizado por ' + listo(okQ) + '</h2><div class="tarjeta">' +
    '<div class="campo" id="c-quien">' + fichas('quien', ['Técnico de la clínica', 'Proveedor'], d.quien) + '</div>';
  if (d.quien === 'Técnico de la clínica') {
    h += '<div class="campo" id="c-tecnico"><span class="etq">Técnico <em>puedes elegir 1 o 2</em></span>' + fichasVarias('tecnico', tecs.map(nombreBonito), listaTec(d.tecnico).map(nombreBonito)) + '</div>' +
      '<div class="campo" id="c-firma"><span class="etq">Firma del técnico</span>' + htmlFirma('firma', 'Firma de ' + nombreBonito(listaTec(d.tecnico)[0] || '')) + '</div>';
  } else if (d.quien === 'Proveedor') {
    h += '<div class="campo" id="c-empresa"><span class="etq">Empresa</span>' + selector('empresa', S.cfg.empresas, d.empresa, 'Agregar empresa') + '</div>' +
      campoTexto('nombreProv', 'Nombre de quien lo hizo', d.nombreProv, { ph: 'Carlos Pérez' }) +
      campoTexto('orden', 'N.º de orden o informe del proveedor', d.orden, { nota: 'opcional', ph: 'OT-4521' }) +
      '<div class="campo" id="c-firma"><span class="etq">Firma del proveedor</span>' + htmlFirma('firma', 'Firma de ' + (d.nombreProv || 'quien hizo el trabajo')) + '</div>' +
      '<div class="campo" id="c-recibe"><span class="etq">Recibe a satisfacción (técnico de la clínica)</span>' + fichas('recibe', tecs.map(nombreBonito), nombreBonito(d.recibe)) + '</div>' +
      '<div class="campo" id="c-firmaRecibe"><span class="etq">Firma de quien recibe</span>' + htmlFirma('firmaRecibe', 'Firma de ' + nombreBonito(d.recibe)) + '</div>' +
      '<div class="campo" id="c-informe"><span class="etq">Informe del proveedor<em>opcional · PDF o foto</em></span>' +
      (F.informe ? '<div class="archivo">' + ico('description') + '<span class="txt">' + esc(F.informe.nombre) + '</span><button type="button" class="pastilla" data-acc="quitarInforme">Quitar</button></div>'
        : '<button type="button" class="btn sec" data-acc="informe">' + ico('upload_file') + 'Adjuntar informe</button>') +
      '<input type="file" id="archInforme" accept="application/pdf,image/*" class="oculto"></div>';
  }
  h += '</div></div>';
  // Fotos
  h += '<div class="ancho"><h2 class="secc">Fotos <small>opcional · hasta 4</small></h2><div class="fotos-mt">' +
    F.fotos.map(function(f, i) { return '<span class="f"><img src="' + f.url + '" alt="Foto ' + (i + 1) + '"><button type="button" class="x" data-acc="quitarFoto" data-i="' + i + '" aria-label="Quitar foto">' + ico('close', 's') + '</button></span>'; }).join('') +
    (F.fotos.length < 4 ? '<button type="button" class="f" data-acc="fotoMt" aria-label="Agregar foto">' + ico('add_a_photo') + '</button>' : '') +
    '</div><input type="file" id="archFotoMt" accept="image/*" multiple class="oculto"></div>';
  h += '</div>';
  h += '<div class="accion-fija"><button type="button" class="btn" data-acc="guardarMant">' + ico('check') + 'Guardar mantenimiento</button></div>';
  return h;
}

async function guardarMant() {
  const F = S.form, d = F.d;
  const faltan = faltaMant(F);
  if (faltan.length) { avisoFalta(faltan[0][0], faltan[0][1]); return; }
  const e = equipo(F.equipoId);
  d.codigo = e.codigo; d.equipo = e.nombre; d.sede = e.sede;
  d.descripcion = String(d.descripcion).trim();
  d.horometro = String(d.horometro).trim() === '' ? '' : Number(String(d.horometro).replace(',', '.'));
  if (d.quien === 'Proveedor') d.tecnico = ''; else { d.empresa = ''; d.nombreProv = ''; d.orden = ''; d.recibe = ''; }
  d.registroPor = S.tecnico;
  d.registro = new Date().toISOString();
  const op = { accion: 'mant', m: JSON.parse(JSON.stringify(d)), fotoClaves: [], firma: F.firmas.firma || null, firmaRecibe: d.quien === 'Proveedor' ? (F.firmas.firmaRecibe || null) : null };
  for (let i = 0; i < F.fotos.length; i++) {
    const k = 'fotomt:' + d.id + ':' + i;
    await guardarDato(k, F.fotos[i].blob);
    op.fotoClaves.push(k);
    S.minis['MT:' + d.id + ':' + (i + 1)] = F.fotos[i].mini;
    await guardarDato('mini:MT:' + d.id + ':' + (i + 1), F.fotos[i].mini);
  }
  if (op.firma) { S.minis['FI:' + d.id] = op.firma.mini; await guardarDato('mini:FI:' + d.id, op.firma.mini); }
  if (op.firmaRecibe) { S.minis['FR:' + d.id] = op.firmaRecibe.mini; await guardarDato('mini:FR:' + d.id, op.firmaRecibe.mini); }
  if (F.informe && d.quien === 'Proveedor') {
    op.informeClave = 'informe:' + d.id;
    op.informeTipo = F.informe.tipo;
    op.informeExt = F.informe.ext;
    await guardarDato(op.informeClave, F.informe.blob);
  }
  await encolar(op);
  F.sucio = false;
  sonarListo();
  toast(ico('check', 's') + 'Mantenimiento guardado' + (navigator.onLine ? '' : ' en el teléfono'));
  S.form = null;
  volver();
  sincronizar();
}


/***********************
 * FIRMA EN PANTALLA
 ***********************/

function htmlFirma(campo, guia) {
  const ya = S.form.firmas[campo];
  return '<div class="firma" data-firma="' + campo + '"><canvas></canvas><span class="marca"></span><span class="guia">' + esc(guia) + '</span>' +
    '<button type="button" class="borrar" data-acc="borrarFirma" data-f="' + campo + '"' + (ya ? '' : ' hidden') + '>Borrar</button></div>';
}

function montarFirmas() {
  $$('[data-firma]').forEach(function(caja) {
    const campo = caja.dataset.firma;
    const c = $('canvas', caja);
    const r = caja.getBoundingClientRect();
    const k = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#160D0E'; g.lineWidth = 2.4;
    const trazos = (S.form.firmas[campo] && S.form.firmas[campo].trazos) || [];
    const dibujar = function() {
      g.clearRect(0, 0, r.width, r.height);
      trazos.forEach(function(t) {
        g.beginPath();
        t.forEach(function(p, i) { const x = p[0] * r.width, y = p[1] * r.height; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        if (t.length === 1) g.lineTo(t[0][0] * r.width + 0.1, t[0][1] * r.height);
        g.stroke();
      });
    };
    dibujar();
    let actual = null;
    const punto = function(ev) { const b = c.getBoundingClientRect(); return [(ev.clientX - b.left) / b.width, (ev.clientY - b.top) / b.height]; };
    c.onpointerdown = function(ev) { ev.preventDefault(); c.setPointerCapture(ev.pointerId); actual = [punto(ev)]; trazos.push(actual); dibujar(); };
    c.onpointermove = function(ev) { if (!actual) return; actual.push(punto(ev)); dibujar(); };
    c.onpointerup = c.onpointercancel = function() {
      if (!actual) return;
      actual = null;
      S.form.firmas[campo] = exportarFirma(trazos);
      S.form.sucio = true;
      $('[data-acc="borrarFirma"]', caja).hidden = false;
      actualizarListos();
    };
  });
}

/** Firma a PNG: una grande para Drive y una pequeña para el PDF. */
function exportarFirma(trazos) {
  const hacer = function(w, h, grosor) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#160D0E'; g.lineWidth = grosor;
    trazos.forEach(function(t) {
      g.beginPath();
      t.forEach(function(p, i) { if (i) g.lineTo(p[0] * w, p[1] * h); else g.moveTo(p[0] * w, p[1] * h); });
      if (t.length === 1) g.lineTo(t[0][0] * w + 0.5, t[0][1] * h);
      g.stroke();
    });
    return c.toDataURL('image/png');
  };
  return { trazos: trazos.map(function(t) { return t.slice(); }), grande: hacer(900, 300, 5), mini: hacer(300, 100, 2.6) };
}

function actualizarListos() {
  // Repinta solo los títulos con "Listo" sin perder la firma ni el foco
  const F = S.form;
  if (!F) return;
  const ok = F.tipo === 'mant' ? faltaMant(F) : faltaEquipo(F.d, F.foto);
  $$('.secc').forEach(function(s) {
    const t = s.textContent;
    let listoSec = null;
    if (F.tipo === 'mant') {
      if (/^Lo que se hizo/.test(t)) listoSec = !ok.some(function(x) { return /tipo|fecha|lo que se hizo|cómo quedó/.test(x[0]); });
      if (/^Realizado por/.test(t)) listoSec = !!F.d.quien && !ok.some(function(x) { return /técnico|firma|empresa|nombre|recibe|quién hizo/.test(x[0]); });
    } else {
      if (/^Identificación/.test(t)) listoSec = !ok.some(function(x) { return /tipo de equipo|nombre del equipo|sede|estado/.test(x[0]); });
      if (/^Plan de mantenimiento/.test(t)) listoSec = !ok.some(function(x) { return /periodicidad|horas|empresa/.test(x[0]); });
    }
    if (listoSec === null) return;
    const ya = $('.listo', s);
    if (listoSec && !ya) s.insertAdjacentHTML('beforeend', ' ' + listo(true));
    if (!listoSec && ya) ya.remove();
  });
}


/***********************
 * FOTOS Y ARCHIVOS
 ***********************/

async function procesarFoto(archivo, maxMini, calidadMini) {
  let img;
  try { img = await createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch (e) {
    img = await new Promise(function(resolve, reject) {
      const im = new Image();
      im.onload = function() { resolve(im); };
      im.onerror = function() { reject(new Error('No se pudo leer la foto.')); };
      im.src = URL.createObjectURL(archivo);
    });
  }
  const lienzo = function(max) {
    const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  const blob = await new Promise(function(resolve) { lienzo(1600).toBlob(resolve, 'image/jpeg', 0.78); });
  if (!blob) throw new Error('No se pudo preparar la foto.');
  // La pequeña debe caber en una celda de la hoja (menos de 49 000 caracteres)
  let mini = '', q = calidadMini, max = maxMini;
  for (let i = 0; i < 5; i++) {
    mini = lienzo(max).toDataURL('image/jpeg', q);
    if (mini.length < 45000) break;
    q -= 0.08; max = Math.round(max * 0.85);
  }
  return { blob: blob, mini: mini, url: URL.createObjectURL(blob) };
}


/***********************
 * EVENTOS
 ***********************/

function enlazar() {
  const raiz = app();
  raiz.onclick = function(ev) {
    const b = ev.target.closest('[data-acc]');
    if (!b) return;
    prepararSonido();
    accion(b.dataset.acc, b, ev);
  };
  raiz.onkeydown = function(ev) {
    if (ev.key === 'Enter' && ev.target.matches('tr[data-acc]')) accion('selPC', ev.target);
    if (ev.key === 'Enter' && ev.target.matches('[data-nuevo]')) { ev.preventDefault(); ev.target.blur(); }   // al salir se confirma (change)
  };
  raiz.oninput = function(ev) {
    const t = ev.target;
    if (t.id === 'buscar') {
      S.buscar = t.value;
      clearTimeout(enlazar.t);
      enlazar.t = setTimeout(function() {
        const pos = t.selectionStart;
        pintar(false);
        const n = $('#buscar');
        if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* nada */ } }
      }, 180);
      return;
    }
    if (t.dataset.busca) {
      S.form.busca = S.form.busca || {};
      S.form.busca[t.dataset.busca] = t.value;
      const campo = t.dataset.busca;
      const pos = t.selectionStart;
      pintarForm();
      const n = $('[data-busca="' + campo + '"]');
      if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* nada */ } }
      return;
    }
    if (t.dataset.f && S.form) {
      S.form.d[t.dataset.f] = t.value;
      S.form.sucio = true;
      if (t.dataset.f === 'codigo') S.form.codigoTocado = true;
      if (t.dataset.f === 'invima') {
        const na = $('[data-acc="noaplica"][data-f="invima"]');
        if (na) { na.setAttribute('aria-pressed', 'false'); na.innerHTML = 'No aplica'; }
      }
      actualizarListos();
    }
  };
  raiz.onchange = async function(ev) {
    const t = ev.target;
    if (t.dataset.nuevo) { confirmarNuevo(t); return; }
    if (t.id === 'archFoto' && t.files[0]) {
      try {
        const f = await procesarFoto(t.files[0], 420, 0.62);
        S.form.foto = f; S.form.sucio = true;
        pintarForm();
      } catch (e) { toast(ico('warning', 's') + esc(e.message)); }
    }
    if (t.id === 'archFotoMt' && t.files.length) {
      // Cámara o galería; de la galería se pueden elegir varias (máximo 4 en total)
      const lista = Array.prototype.slice.call(t.files, 0, Math.max(0, 4 - S.form.fotos.length));
      try {
        for (const a of lista) S.form.fotos.push(await procesarFoto(a, 360, 0.6));
        S.form.sucio = true;
        if (t.files.length > lista.length) toast(ico('info', 's') + 'Solo caben 4 fotos; se agregaron ' + lista.length + '.');
        pintarForm();
      } catch (e) { toast(ico('warning', 's') + esc(e.message)); pintarForm(); }
    }
    if (t.id === 'archInforme' && t.files[0]) {
      const a = t.files[0];
      if (a.size > 15 * 1024 * 1024) { toast(ico('warning', 's') + 'El informe pesa más de 15 MB. Toma una foto o reduce el PDF.'); return; }
      const ext = (a.name.split('.').pop() || 'pdf').toLowerCase().slice(0, 5);
      S.form.informe = { blob: a, nombre: a.name, tipo: a.type || 'application/pdf', ext: ext };
      S.form.sucio = true;
      pintarForm();
    }
  };
}

/** Repinta el formulario sin perder las firmas ni la posición. */
function pintarForm() {
  const y = window.scrollY;
  pintar(false);
  window.scrollTo(0, y);
}

function confirmarNuevo(input) {
  const campo = input.dataset.nuevo;
  const v = input.value.trim();
  if (!v) { input.classList.add('oculto'); return; }
  const F = S.form;
  F.extra = F.extra || {};
  const lista = campo === 'tipo' ? S.cfg.tipos : campo === 'ubicacion' ? S.cfg.ubicaciones : S.cfg.empresas;
  const igual = lista.concat(F.extra[campo] || []).filter(function(x) { return normal(x) === normal(v); })[0];
  const valor = igual || v.charAt(0).toUpperCase() + v.slice(1);
  if (!igual) F.extra[campo] = (F.extra[campo] || []).concat([valor]);
  F.d[campo] = valor;
  F.sucio = true;
  pintarForm();
}

function accion(a, b) {
  const F = S.form;
  switch (a) {
    case 'vista': irVista(b.dataset.v); break;
    case 'volver': volver(); break;
    case 'fsede': S.filtroSede = b.dataset.v; pintar(false); break;
    case 'ftipo': S.filtroTipo = b.dataset.v; pintar(false); break;
    case 'fmt': S.filtroMt = b.dataset.v; pintar(false); break;
    case 'equipo': abrir({ tipo: 'equipo', id: b.dataset.id }); break;
    case 'selPC': S.selPC = b.dataset.id; pintar(false); break;
    case 'nuevoEquipo': abrirFormEquipo(); break;
    case 'editarEquipo': abrirFormEquipo(b.dataset.id); break;
    case 'nuevoMant': abrirFormMant(b.dataset.id); break;
    case 'pdf': generarPdf(b.dataset.id); break;
    case 'elige':
      if (!F) break;
      const campo = b.dataset.f;
      let v = b.dataset.v;
      if ((campo === 'tecnico' || campo === 'recibe')) {
        v = tecnicosDe(F.d.sede).filter(function(t) { return nombreBonito(t) === v; })[0] || v;
        if (F.firmas && F.d[campo] !== v) delete F.firmas[campo === 'tecnico' ? 'firma' : 'firmaRecibe'];
      }
      if (campo === 'quien' && F.d.quien !== v) F.firmas = {};
      F.d[campo] = F.d[campo] === v && ['forma', 'riesgo', 'fases', 'lubricacion', 'manual'].indexOf(campo) >= 0 ? '' : v;
      if (campo === 'tipo' && !F.codigoTocado) F.d.codigo = '';
      F.sucio = true;
      pintarForm();
      break;
    case 'eligeVarias': {
      if (!F) break;
      const real = tecnicosDe(F.d.sede).filter(function(t) { return nombreBonito(t) === b.dataset.v; })[0] || b.dataset.v;
      let l = listaTec(F.d.tecnico);
      const antes = l[0] || '';
      if (l.indexOf(real) >= 0) l = l.filter(function(x) { return x !== real; });
      else { l.push(real); if (l.length > 2) l = [l[0], real]; }
      F.d.tecnico = l.join(', ');
      if (F.firmas && (l[0] || '') !== antes) delete F.firmas.firma;
      F.sucio = true;
      pintarForm();
      break;
    }
    case 'noaplica': F.d[b.dataset.f] = F.d[b.dataset.f] === 'No aplica' ? '' : 'No aplica'; F.sucio = true; pintarForm(); break;
    case 'agregar': {
      const inp = $('[data-nuevo="' + b.dataset.f + '"]');
      inp.classList.remove('oculto'); inp.value = ''; inp.focus();
      break;
    }
    case 'foto': $('#archFoto').click(); break;
    case 'fotoMt': $('#archFotoMt').click(); break;
    case 'quitarFoto': F.fotos.splice(Number(b.dataset.i), 1); pintarForm(); break;
    case 'informe': $('#archInforme').click(); break;
    case 'quitarInforme': F.informe = null; pintarForm(); break;
    case 'borrarFirma': delete F.firmas[b.dataset.f]; pintarForm(); break;
    case 'guardarEquipo': guardarEquipo(); break;
    case 'guardarMant': guardarMant(); break;
    case 'sync': S.sync = { estado: '', msg: '' }; sincronizar(); break;
    case 'cambiarTec': S.tecnico = ''; pintar(true); break;
    case 'salir':
      if (S.cola.length && !confirm('Hay ' + plural(S.cola.length, 'cambio', 'cambios') + ' sin subir. Quedan guardados en el teléfono. ¿Cerrar sesión?')) break;
      ls.set('codigo', null); pintar(true); break;
    case 'instalar': instalar(); break;
    case 'entrar': entrar(); break;
    case 'turnoSede': S.turno = S.turno || {}; S.turno.sede = b.dataset.v; S.turno.tecnico = ''; pintarTurno(); break;
    case 'turnoTec': S.turno.tecnico = b.dataset.v; pintarTurno(); break;
    case 'empezar':
      if (!S.turno || !S.turno.sede) { $('#turnoAyuda').textContent = 'Elige la sede.'; break; }
      if (!S.turno.tecnico) { $('#turnoAyuda').textContent = 'Elige tu nombre.'; break; }
      S.sede = S.turno.sede; S.tecnico = S.turno.tecnico; S.filtroSede = S.sede;
      ls.set('turno', { sede: S.sede, tecnico: S.tecnico });
      pintar(true);
      break;
  }
}


/***********************
 * ACCESO Y TÉCNICO
 ***********************/

function pintarAcceso(msg) {
  app().innerHTML = '<section class="pantalla-c"><img class="logo-g" src="logo.jpg" alt="Clínica Reina Catalina"><h1>Hojas de vida</h1>' +
    '<p class="sub">Equipos de gases medicinales. Escribe el código de acceso del departamento.</p>' +
    '<div class="campo"><label class="etq" for="codigoAcceso">Código de acceso</label><input id="codigoAcceso" class="entrada" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" enterkeyhint="go">' +
    '<p id="avisoAcceso" class="ayuda" role="alert" style="color:var(--rojo-t)">' + esc(msg || (urlConfigurada() ? '' : 'Falta configurar la app: pega la URL de Apps Script en config.js.')) + '</p></div>' +
    '<button type="button" class="btn" data-acc="entrar">' + ico('lock') + 'Entrar</button></section>';
  enlazar();
  $('#codigoAcceso').onkeydown = function(e) { if (e.key === 'Enter') entrar(); };
  setTimeout(function() { const i = $('#codigoAcceso'); if (i) i.focus(); }, 50);
}

async function entrar() {
  const codigo = $('#codigoAcceso').value.trim();
  const aviso = $('#avisoAcceso');
  if (!codigo) { aviso.textContent = 'Escribe el código.'; return; }
  const btn = $('[data-acc="entrar"]');
  btn.disabled = true; btn.textContent = 'Revisando…';
  try {
    await llamar('validar', {}, 30000, codigo);
    ls.set('codigo', codigo);
    pintar(true);
    sincronizar();
  } catch (e) {
    aviso.textContent = e.sinRed ? 'Sin señal. Para entrar la primera vez se necesita conexión.' : e.message;
    btn.disabled = false; btn.innerHTML = ico('lock') + 'Entrar';
  }
}

function pintarTurno() {
  S.turno = S.turno || { sede: S.sede || '', tecnico: '' };
  const t = S.turno;
  const tecs = tecnicosDe(t.sede);
  app().innerHTML = '<section class="pantalla-c"><img class="logo-g" src="logo.jpg" alt="Clínica Reina Catalina"><h1>¿Quién registra?</h1>' +
    '<p class="sub">Se recuerda en este teléfono. Puedes cambiarlo en Ajustes.</p>' +
    '<div class="campo"><span class="etq">Sede</span><div class="fichas">' + S.cfg.sedes.map(function(s) {
      return '<button type="button" class="ficha" data-acc="turnoSede" data-v="' + esc(s) + '" aria-pressed="' + (t.sede === s) + '">' + (t.sede === s ? ico('check', 's') : '') + esc(s) + '</button>';
    }).join('') + '</div></div>' +
    '<div class="campo"><span class="etq">Técnico</span><div class="fichas">' + tecs.map(function(n) {
      return '<button type="button" class="ficha" data-acc="turnoTec" data-v="' + esc(n) + '" aria-pressed="' + (t.tecnico === n) + '">' + (t.tecnico === n ? ico('check', 's') : '') + esc(nombreBonito(n)) + '</button>';
    }).join('') + '</div><p class="ayuda" id="turnoAyuda">' + (t.sede ? '' : 'Elige primero la sede.') + '</p></div>' +
    '<button type="button" class="btn" data-acc="empezar">' + ico('check') + 'Empezar</button></section>';
  enlazar();
}


/***********************
 * COLA Y SINCRONIZACIÓN
 ***********************/

async function encolar(op) {
  op.uid = op.uid || nuevoId('OP');
  if (op.accion === 'equipo') {
    // Se une con un cambio pendiente del mismo equipo que aún no se está subiendo
    const i = S.cola.findIndex(function(x, j) { return x.accion === 'equipo' && x.e.id === op.e.id && !(S.sincronizando && j === 0); });
    if (i >= 0) {
      if (op.fotoClave) { if (S.cola[i].fotoClave) await borrarDato(S.cola[i].fotoClave); }
      else op.fotoClave = S.cola[i].fotoClave;
      S.cola[i] = op;
    } else S.cola.push(op);
  } else S.cola.push(op);
  await guardarDato('cola', S.cola);
}

async function enviar(op) {
  if (op.accion === 'equipo') {
    const extra = { e: op.e };
    if (op.fotoClave) {
      const blob = await leerDato(op.fotoClave);
      if (blob) { extra.foto = await blobABase64(blob); extra.mini = S.minis['EQ:' + op.e.id] || ''; }
    }
    return llamar('equipo', extra, 120000);
  }
  if (op.accion === 'mant') {
    const e = equipo(op.m.equipoId);
    const m = Object.assign({}, op.m);
    if (e) { m.codigo = e.codigo; m.equipo = e.nombre; m.sede = e.sede; }
    const extra = { m: m, fotos: [], minis: [] };
    for (let i = 0; i < op.fotoClaves.length; i++) {
      const blob = await leerDato(op.fotoClaves[i]);
      if (blob) { extra.fotos.push(await blobABase64(blob)); extra.minis.push(S.minis['MT:' + m.id + ':' + (i + 1)] || ''); }
    }
    if (op.firma) { extra.firma = op.firma.grande.split(',')[1]; extra.firmaMini = op.firma.mini; }
    if (op.firmaRecibe) { extra.firmaRecibe = op.firmaRecibe.grande.split(',')[1]; extra.firmaRecibeMini = op.firmaRecibe.mini; }
    if (op.informeClave) {
      const blob = await leerDato(op.informeClave);
      if (blob) { extra.informe = await blobABase64(blob); extra.informeTipo = op.informeTipo; extra.informeExt = op.informeExt; }
    }
    return llamar('mantenimiento', extra, 180000);
  }
  if (op.accion === 'pdf') {
    const blob = await leerDato('pdf:' + op.uid);
    if (!blob) return { ok: true };
    return llamar('pdf', { id: op.id, tecnico: S.tecnico, base64: await blobABase64(blob) }, 120000);
  }
  return { ok: true };
}

async function sincronizar() {
  if (S.sincronizando) { S.otraVez = true; return; }
  if (!codigoAcceso() || !urlConfigurada()) { pintarFranja(); return; }
  if (!navigator.onLine) { S.sync = { estado: '', msg: '' }; pintarFranja(); return; }
  S.sincronizando = true; S.otraVez = false;
  S.sync = { estado: 'sube', msg: '' };
  pintarFranja();
  let bien = false;
  try {
    while (S.cola.length) {
      const op = S.cola[0];
      const res = await enviar(op);
      S.cola.shift();
      if (op.accion === 'equipo') {
        await borrarDato(op.fotoClave);
        if (res.equipo) {
          const i = S.servEq.findIndex(function(e) { return e.id === res.equipo.id; });
          if (i >= 0) S.servEq[i] = res.equipo; else S.servEq.push(res.equipo);
          if (res.equipo.codigo !== op.e.codigo) toast(ico('info', 's') + 'El código ' + esc(op.e.codigo) + ' ya lo tenía otro equipo: quedó como ' + esc(res.equipo.codigo));
        }
      }
      if (op.accion === 'mant') {
        for (const k of op.fotoClaves) await borrarDato(k);
        await borrarDato(op.informeClave);
        const e = equipo(op.m.equipoId);
        S.servMt.push(Object.assign({}, op.m, { codigo: e ? e.codigo : op.m.codigo }));
      }
      if (op.accion === 'pdf') {
        await borrarDato('pdf:' + op.uid);
        toast(ico('cloud_done', 's') + 'Hoja de vida PDF guardada en Drive');
      }
      await guardarDato('cola', S.cola);
      await guardarDato('servEq', S.servEq);
      await guardarDato('servMt', S.servMt);
      pintarFranja();
    }
    const datos = await llamar('datos', {}, 60000);
    S.cfg = Object.assign({}, CFG_INICIAL, datos.config || {});
    S.servEq = datos.equipos || [];
    S.servMt = datos.mantenimientos || [];
    Object.keys(datos.minis || {}).forEach(function(k) { S.minis[k] = datos.minis[k]; guardarDato('mini:' + k, datos.minis[k]); });
    await guardarDato('cfg', S.cfg);
    await guardarDato('servEq', S.servEq);
    await guardarDato('servMt', S.servMt);
    S.sync = { estado: 'ok', msg: '' };
    bien = true;
    if (!S.form) pintar(false);
  } catch (e) {
    if (e.sinRed) S.sync = { estado: '', msg: '' };
    else if (e.codigo === 'ACCESO') { S.sync = { estado: '', msg: '' }; ls.set('codigo', null); pintarAcceso(e.message); }
    else S.sync = { estado: 'error', msg: e.message };
  } finally {
    S.sincronizando = false;
    pintarFranja();
    if (S.otraVez && bien) setTimeout(sincronizar, 300);
  }
}

function pintarFranja() {
  const f = $('#franja');
  if (!f) return;
  const n = S.cola.length;
  let clase = '', html = '';
  if (S.sync.estado === 'error') {
    clase = 'error';
    html = ico('warning', 's') + '<span>' + esc(S.sync.msg) + '</span><button type="button" id="fReintentar">Reintentar</button>';
  } else if (S.sync.estado === 'sube' && n) {
    clase = 'sube'; html = ico('sync', 's') + '<span>Subiendo ' + plural(n, 'cambio', 'cambios') + '…</span>';
  } else if (n) {
    clase = 'espera';
    html = ico('cloud_off', 's') + '<span>' + plural(n, 'cambio guardado', 'cambios guardados') + ' en el teléfono. ' + (navigator.onLine ? '' : 'Se suben al volver la señal.') + '</span><button type="button" id="fReintentar">Subir</button>';
  } else if (S.sync.estado === 'ok') {
    clase = 'ok'; html = ico('cloud_done', 's') + '<span>Todo subido a la hoja de Google</span>';
  }
  f.className = 'franja ' + clase + (clase ? '' : ' oculto');
  f.innerHTML = html;
  const r = $('#fReintentar');
  if (r) r.onclick = function() { S.sync = { estado: '', msg: '' }; sincronizar(); };
  if (S.sync.estado === 'ok') {
    clearTimeout(pintarFranja.t);
    pintarFranja.t = setTimeout(function() { if (S.sync.estado === 'ok') { S.sync = { estado: '', msg: '' }; pintarFranja(); } }, 3000);
  }
  const p = $('.nav .punto');
  if (p) p.textContent = n || '';
}


/***********************
 * PDF DE LA HOJA DE VIDA (formato FMT-004, tamaño carta)
 ***********************/

function cargarScript(src) {
  return new Promise(function(resolve, reject) {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve;
    s.onerror = function() { reject(new Error('No se pudo cargar el generador de PDF. Abre la app una vez con señal.')); };
    document.head.appendChild(s);
  });
}
async function cargarLibreriasPdf() {
  if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript('lib/jspdf.umd.min.js');
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) throw new Error('No se pudo cargar el generador de PDF.');
  if (!J.API.autoTable) {
    await cargarScript('lib/jspdf.plugin.autotable.min.js');
    if (!J.API.autoTable && typeof window.applyPlugin === 'function') window.applyPlugin(J);
  }
  if (!J.API.autoTable) throw new Error('No se pudo cargar el generador de tablas del PDF.');
}
let logoCache = null;
async function logoPdf() {
  if (logoCache) return logoCache;
  try { logoCache = await blobADataUrl(await (await fetch('logo-pdf.png')).blob()); } catch (e) { logoCache = null; }
  return logoCache;
}

/** Trae de la hoja las fotos y firmas pequeñas que falten para el PDF. */
async function minisPara(e, ms) {
  const claves = ['EQ:' + e.id];
  ms.forEach(function(m) { claves.push('FI:' + m.id, 'FR:' + m.id, 'MT:' + m.id + ':1', 'MT:' + m.id + ':2', 'MT:' + m.id + ':3', 'MT:' + m.id + ':4'); });
  const faltan = claves.filter(function(k) { return !S.minis[k]; });
  if (faltan.length && navigator.onLine && codigoAcceso()) {
    try {
      const r = await llamar('miniaturas', { claves: faltan }, 60000);
      Object.keys(r.minis || {}).forEach(function(k) { S.minis[k] = r.minis[k]; guardarDato('mini:' + k, r.minis[k]); });
    } catch (err) { /* se arma con lo que hay */ }
  }
}

function tamImagen(dataUrl) {
  return new Promise(function(resolve) {
    const im = new Image();
    im.onload = function() { resolve({ w: im.naturalWidth, h: im.naturalHeight }); };
    im.onerror = function() { resolve({ w: 4, h: 3 }); };
    im.src = dataUrl;
  });
}

async function construirPdf(e) {
  await cargarLibreriasPdf();
  const ms = mantsDe(e).slice().reverse();   // del más viejo al más nuevo
  await minisPara(e, ms);
  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait', compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
  // Estilo «Ficha técnica»: encabezado vino, recuadros grises suaves y datos en cuadrícula
  const VINO = [132, 48, 63], TINTA = [34, 34, 34], SUAVE = [110, 110, 110], ETQ = [74, 52, 58], NUM = [132, 48, 63];
  const PANEL = [247, 244, 245], RAYA = [233, 225, 227], CABT = [238, 229, 231];
  const logo = await logoPdf();
  const ARRIBA = 40, ABAJO = H - 14;
  const color = function(c, tipo) { if (tipo === 'f') doc.setFillColor(c[0], c[1], c[2]); else if (tipo === 'd') doc.setDrawColor(c[0], c[1], c[2]); else doc.setTextColor(c[0], c[1], c[2]); };
  const letra = function(tam, negrita) { doc.setFont('helvetica', negrita ? 'bold' : 'normal'); doc.setFontSize(tam); };
  const nueva = function() { doc.addPage(); return ARRIBA; };
  const val = function(t) { t = String(t == null ? '' : t).trim(); return t || '—'; };
  const ESTADOS = { 'Funcionando': [[227, 244, 232], [30, 107, 58]], 'Con observaciones': [[255, 243, 220], [122, 74, 0]],
    'Fuera de servicio': [[252, 228, 225], [179, 38, 30]], 'Dado de baja': [[236, 236, 236], [90, 90, 90]] };

  // Imagen recortada para llenar el recuadro, con esquinas redondeadas
  async function imagenCubre(src, x, y, w, h, r) {
    const t = await tamImagen(src);
    const s = Math.max(w / t.w, h / t.h), iw = t.w * s, ih = t.h * s;
    try {
      doc.saveGraphicsState();
      doc.roundedRect(x, y, w, h, r, r, null); doc.clip(); doc.discardPath();
      doc.addImage(src, 'JPEG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      doc.restoreGraphicsState();
    } catch (err) {
      const s2 = Math.min(w / t.w, h / t.h);
      doc.addImage(src, 'JPEG', x + (w - t.w * s2) / 2, y + (h - t.h * s2) / 2, t.w * s2, t.h * s2);
    }
  }
  function titulo(n, t, x, y, blanco) {
    letra(9.5, true);
    if (blanco) doc.setTextColor(255, 204, 212); else color(NUM);
    doc.text(String(n), x, y);
    if (blanco) doc.setTextColor(255, 255, 255); else color(VINO);
    doc.text(t.toUpperCase(), x + 4.5, y, { charSpace: 0.25 });
  }
  // Recuadro con borde, franja de título y cuadrícula de datos {e: etiqueta, v: valor, tipo}
  const BORDE = [196, 176, 182], LINEAS = [218, 206, 210], FRANJA = [242, 230, 233], TITULO_ALTO = 9;
  function medirCuadricula(items, cols, ancho) {
    const cw = ancho / cols, filas = [];
    for (let i = 0; i < items.length; i += cols) {
      let alto = 0;
      items.slice(i, i + cols).forEach(function(it) {
        letra(9, true);
        it.lineas = it.tipo ? [val(it.v)] : doc.splitTextToSize(val(it.v), cw - 7);
        alto = Math.max(alto, 4 + it.lineas.length * 3.9 + (it.tipo ? 1.2 : 0));
      });
      filas.push(alto + 3);
    }
    return { cw: cw, filas: filas, alto: filas.reduce(function(a, b) { return a + b; }, 0) };
  }
  function franjaTitulo(n, t, x, y, ancho) {
    color(FRANJA, 'f'); doc.roundedRect(x, y, ancho, TITULO_ALTO, 2.5, 2.5, 'F');
    doc.rect(x, y + TITULO_ALTO - 3, ancho, 3, 'F');
    color(BORDE, 'd'); doc.setLineWidth(0.25); doc.line(x, y + TITULO_ALTO, x + ancho, y + TITULO_ALTO);
    titulo(n, t, x + 4, y + 6.1);
  }
  function bloque(n, t, items, cols, x, y, ancho, minAlto, nota) {
    const med = medirCuadricula(items, cols, ancho);
    let lineasNota = [];
    letra(8.5, true); const anchoEtq = doc.getTextWidth('Recomendaciones:') + 2;
    if (nota) { letra(8.5, false); lineasNota = doc.splitTextToSize(nota, ancho - 8 - anchoEtq); }
    const altoNota = lineasNota.length ? lineasNota.length * 3.8 + 3.5 : 0;
    let alto = TITULO_ALTO + med.alto + altoNota;
    if (minAlto && alto < minAlto) {   // estira las filas para igualar el alto de la foto
      const extra = (minAlto - alto) / med.filas.length;
      med.filas = med.filas.map(function(f) { return f + extra; }); alto = minAlto;
    }
    color([255, 255, 255], 'f'); doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'F');
    franjaTitulo(n, t, x, y, ancho);
    // Líneas de la cuadrícula
    color(LINEAS, 'd'); doc.setLineWidth(0.2);
    let yy = y + TITULO_ALTO;
    med.filas.forEach(function(f, r) {
      const yf = yy + f;
      if (r < med.filas.length - 1 || altoNota) doc.line(x, yf, x + ancho, yf);
      for (let c = 1; c < cols; c++) doc.line(x + c * med.cw, yy, x + c * med.cw, yf);
      yy = yf;
    });
    yy = y + TITULO_ALTO;
    items.forEach(function(it, i) {
      const col = i % cols;
      if (col === 0 && i > 0) yy += med.filas[Math.floor(i / cols) - 1];
      const xx = x + col * med.cw + 4;
      letra(7.2, true); color(ETQ); doc.text(it.e.toUpperCase(), xx, yy + 3.9, { charSpace: 0.12 });
      const yv = yy + 8;
      if (it.tipo === 'estado') {
        const c = ESTADOS[it.v] || ESTADOS['Dado de baja'];
        letra(8, true); const tw = doc.getTextWidth(val(it.v));
        color(c[0], 'f'); doc.roundedRect(xx, yv - 3.3, tw + 6, 4.8, 2.4, 2.4, 'F');
        color(c[1]); doc.text(val(it.v), xx + 3, yv);
      } else if (it.tipo === 'prox') {
        letra(9, true); const tw = doc.getTextWidth(val(it.v));
        color([255, 255, 255], 'f'); color(VINO, 'd'); doc.setLineWidth(0.3);
        doc.roundedRect(xx, yv - 3.5, tw + 5, 5.2, 1.3, 1.3, 'FD');
        color(VINO); doc.text(val(it.v), xx + 2.5, yv);
      } else {
        letra(9, true); color(TINTA); doc.text(it.lineas, xx, yv);
      }
    });
    if (lineasNota.length) {
      const yn = y + TITULO_ALTO + med.alto + 5;
      letra(8.5, true); color(TINTA); doc.text('Recomendaciones:', x + 4, yn);
      letra(8.5, false); doc.text(lineasNota, x + 4 + anchoEtq, yn);
    }
    color(BORDE, 'd'); doc.setLineWidth(0.3); doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'S');
    return alto;
  }
  function bloqueEnPagina(n, t, items, cols, y, nota) {
    const ancho = W - 2 * M;
    const med = medirCuadricula(items, cols, ancho);
    if (y + TITULO_ALTO + med.alto + (nota ? 10 : 0) > ABAJO) y = nueva();
    return y + bloque(n, t, items, cols, M, y, ancho, 0, nota) + 4;
  }

  // 1. Foto del equipo + identificación (la hoja de vida empieza con la foto)
  let y = ARRIBA;
  const foto = S.minis['EQ:' + e.id];
  const fw = 66, xi = M + fw + 4, ai = W - M - xi;
  const ident = [{ e: 'Equipo', v: e.nombre }, { e: 'Código interno', v: e.codigo }, { e: 'Tipo', v: e.tipo },
    { e: 'Marca', v: e.marca }, { e: 'Modelo', v: e.modelo }, { e: 'Serie', v: e.serie },
    { e: 'Sede', v: e.sede }, { e: 'Ubicación', v: e.ubicacion }, { e: 'Estado', v: e.estado, tipo: 'estado' }];
  const altoId = bloque(1, 'Identificación', ident, 3, xi, y, ai, 46);
  if (imgSegura(foto)) await imagenCubre(foto, M, y, fw, altoId, 2.5);
  else {
    color(PANEL, 'f'); doc.roundedRect(M, y, fw, altoId, 2.5, 2.5, 'F');
    letra(9, false); color(SUAVE); doc.text('Sin foto del equipo', M + fw / 2, y + altoId / 2, { align: 'center' });
  }
  y += altoId + 4;

  const p = preventivo(e);
  y = bloqueEnPagina(2, 'Adquisición', [{ e: 'Proveedor', v: e.proveedor }, { e: 'Forma de adquisición', v: e.forma },
    { e: 'Fecha de instalación', v: fFechaPdf(e.instalacion) }, { e: 'Garantía hasta', v: fFechaPdf(e.garantia) },
    { e: 'Registro INVIMA', v: e.invima }, { e: 'Clasificación de riesgo', v: e.riesgo }], 3, y);
  y = bloqueEnPagina(3, 'Datos técnicos', [{ e: 'Potencia', v: e.potencia }, { e: 'Voltaje', v: e.voltaje },
    { e: 'Fases', v: e.fases }, { e: 'Corriente', v: e.corriente }, { e: 'Caudal', v: e.caudal },
    { e: 'Presión de trabajo', v: e.presion }, { e: 'Lubricación', v: e.lubricacion }, { e: 'Otros', v: e.otros }], 4, y);
  y = bloqueEnPagina(4, 'Plan de mantenimiento', [
    { e: 'Periodicidad del preventivo', v: e.periodicidad === 'Por horas de uso' ? 'Cada ' + num(e.cadaHoras) + ' h de uso' : e.periodicidad },
    { e: 'Responsable', v: e.responsable === 'Proveedor' ? 'Proveedor: ' + (e.empresaMtto || '') : e.responsable },
    { e: 'Último preventivo', v: fFechaPdf(p.ultimo) },
    { e: 'Próximo preventivo', v: p.proximo ? fFechaPdf(p.proximo) : p.texto, tipo: p.proximo ? 'prox' : '' },
    { e: 'Manual del fabricante', v: e.manual }], 3, y, String(e.recomendaciones || '').trim());

  // 5. Historial de intervenciones, con la firma de quien lo hizo
  const filasMt = ms.map(function(m) {
    const quien = m.quien === 'Proveedor'
      ? (m.empresa || 'Proveedor') + '\n' + nombreBonito(m.nombreProv) + (m.orden ? '\nOrden: ' + m.orden : '') + (m.recibe ? '\nRecibió: ' + nombreBonito(m.recibe) : '')
      : nombresTec(m.tecnico) + '\n(Clínica)';
    return [fFechaPdf(m.fecha), m.tipo + (m.horometro !== '' && m.horometro != null ? '\n' + num(m.horometro) + ' h' : ''),
      m.descripcion + (m.repuestos ? '\nRepuestos: ' + m.repuestos : '') + (m.estadoFinal ? '\nQuedó: ' + m.estadoFinal : ''), quien, ''];
  });
  const opcHist = function(startY) {
    return {
      startY: startY, margin: { left: M, right: M, top: ARRIBA, bottom: 16 }, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.8, textColor: TINTA, lineColor: LINEAS, lineWidth: 0.2, cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }, valign: 'top', fillColor: [255, 255, 255] },
      head: [['FECHA', 'TIPO', 'DESCRIPCIÓN', 'REALIZÓ', 'FIRMA']],
      headStyles: { fillColor: [250, 246, 247], textColor: [74, 52, 58], fontStyle: 'bold', fontSize: 7.4 },
      body: filasMt.length ? filasMt : [[{ content: 'Sin intervenciones registradas', colSpan: 5, styles: { halign: 'center', textColor: SUAVE } }]],
      columnStyles: { 0: { cellWidth: 21 }, 1: { cellWidth: 22 }, 3: { cellWidth: 38 }, 4: { cellWidth: 28, minCellHeight: 13 } }
    };
  };
  if (y + TITULO_ALTO + 30 > ABAJO) y = nueva();
  const yHist = y, paginaHist = doc.getNumberOfPages();
  franjaTitulo(5, 'Historial de intervenciones', M, y, W - 2 * M);
  const oh = opcHist(y + TITULO_ALTO);
  oh.didDrawCell = function(dt) {
    if (dt.section !== 'body' || dt.column.index !== 4 || !ms[dt.row.index]) return;
    const fi = S.minis['FI:' + ms[dt.row.index].id];
    if (imgSegura(fi)) doc.addImage(fi, 'PNG', dt.cell.x + 1, dt.cell.y + 1.5, dt.cell.width - 2, Math.min(dt.cell.height - 3, (dt.cell.width - 2) / 3));
  };
  doc.autoTable(oh);
  // Borde exterior del recuadro (si la tabla quedó en la misma página)
  if (doc.getNumberOfPages() === paginaHist) {
    color(BORDE, 'd'); doc.setLineWidth(0.3);
    doc.roundedRect(M, yHist, W - 2 * M, doc.lastAutoTable.finalY - yHist, 2.5, 2.5, 'S');
  } else {
    doc.setPage(paginaHist); color(BORDE, 'd'); doc.setLineWidth(0.3);
    doc.line(M, yHist + 2.5, M, yHist + TITULO_ALTO); doc.line(W - M, yHist + 2.5, W - M, yHist + TITULO_ALTO);
    doc.setPage(doc.getNumberOfPages());
  }
  y = doc.lastAutoTable.finalY + 8;

  // Firmas Elaboró / Revisó
  if (y + 26 > ABAJO) y = nueva();
  const anchoF = (W - 2 * M - 10) / 2;
  [['Elaboró', nombreBonito(S.tecnico), 'Técnico de gases medicinales'], ['Revisó', S.cfg.coordinador || '', 'Coordinador de gases medicinales']].forEach(function(f, i) {
    const x = M + i * (anchoF + 10);
    color([227, 215, 218], 'd'); doc.setLineWidth(0.3); doc.roundedRect(x, y, anchoF, 25, 2.5, 2.5, 'S');
    letra(7.5, true); color(ETQ); doc.text(f[0].toUpperCase(), x + 4, y + 5.5, { charSpace: 0.2 });
    color([85, 85, 85], 'd'); doc.setLineWidth(0.25); doc.line(x + 8, y + 15, x + anchoF - 8, y + 15);
    letra(9, true); color(TINTA); doc.text(f[1], x + anchoF / 2, y + 19, { align: 'center' });
    if (f[1] !== f[2]) { letra(8, false); color(SUAVE); doc.text(f[2], x + anchoF / 2, y + 22.6, { align: 'center' }); }
  });
  y += 25;

  // 6. Registro fotográfico: las fotos agrupadas por mantenimiento (la del equipo ya va al inicio)
  const grupos = ms.slice().reverse().map(function(m) {
    const fs = [];
    for (let i = 1; i <= 4; i++) { const f = S.minis['MT:' + m.id + ':' + i]; if (imgSegura(f)) fs.push(f); }
    const quien = m.quien === 'Proveedor' ? (m.empresa || 'Proveedor') + (m.nombreProv ? ' · ' + nombreBonito(m.nombreProv) : '') : nombresTec(m.tecnico);
    return { m: m, fotos: fs, quien: quien };
  }).filter(function(g) { return g.fotos.length; });
  if (grupos.length) {
    const anchoG = W - 2 * M, cw = (anchoG - 12) / 2, ch = 64, filaAlto = ch + 4;
    y += 10;
    if (y + 10 + TITULO_ALTO + filaAlto + 4 > ABAJO) y = nueva();
    titulo(6, 'Registro fotográfico', M + 1, y + 4);
    y += 9;
    const cabeceraGrupo = function(g, sigue) {
      color([255, 255, 255], 'f'); doc.roundedRect(M, y, anchoG, TITULO_ALTO, 2.5, 2.5, 'F');
      color(FRANJA, 'f'); doc.roundedRect(M, y, anchoG, TITULO_ALTO, 2.5, 2.5, 'F'); doc.rect(M, y + TITULO_ALTO - 3, anchoG, 3, 'F');
      color(BORDE, 'd'); doc.setLineWidth(0.25); doc.line(M, y + TITULO_ALTO, M + anchoG, y + TITULO_ALTO);
      letra(9, true); color(VINO);
      const tit = (g.m.tipo || 'Mantenimiento').toUpperCase() + ' · ' + fFechaPdf(g.m.fecha) + (sigue ? '  (continuación)' : '');
      doc.text(tit, M + 4, y + 6.1, { charSpace: 0.2 });
      letra(8.2, false); color(ETQ);
      doc.text('Realizó: ' + g.quien + ' · ' + g.fotos.length + (g.fotos.length === 1 ? ' foto' : ' fotos'), M + anchoG - 4, y + 6.1, { align: 'right' });
    };
    for (const g of grupos) {
      if (y + TITULO_ALTO + filaAlto + 4 > ABAJO) y = nueva();
      let yIni = y;
      cabeceraGrupo(g, false);
      y += TITULO_ALTO + 4;
      for (let i = 0; i < g.fotos.length; i += 2) {
        if (y + filaAlto > ABAJO) {
          color(BORDE, 'd'); doc.setLineWidth(0.3); doc.roundedRect(M, yIni, anchoG, y - yIni, 2.5, 2.5, 'S');
          y = nueva(); yIni = y; cabeceraGrupo(g, true); y += TITULO_ALTO + 4;
        }
        for (let c = 0; c < 2 && i + c < g.fotos.length; c++) {
          const x = M + 4 + c * (cw + 4);
          color(PANEL, 'f'); doc.roundedRect(x, y, cw, ch, 2, 2, 'F');
          const t = await tamImagen(g.fotos[i + c]);
          const s2 = Math.min(cw / t.w, ch / t.h), iw = t.w * s2, ih = t.h * s2;
          await imagenCubre(g.fotos[i + c], x + (cw - iw) / 2, y + (ch - ih) / 2, iw, ih, 2);
        }
        y += filaAlto;
      }
      color(BORDE, 'd'); doc.setLineWidth(0.3); doc.roundedRect(M, yIni, anchoG, y - yIni, 2.5, 2.5, 'S');
      y += 6;
    }
  }

  // Encabezado del formato en todas las páginas: franja vino con logo, título y código/versión/fecha/página
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    const y0 = 10, alto = 25, x0 = M, an = W - 2 * M;
    color(VINO, 'f'); doc.roundedRect(x0, y0, an, alto, 3, 3, 'F');
    if (logo) doc.addImage(logo, 'PNG', x0 + 5, y0 + 2.5, 20, 20);
    const xt = x0 + 30;
    letra(14, true); doc.setTextColor(255, 255, 255); doc.text('HOJA DE VIDA DE EQUIPO', xt, y0 + 10, { charSpace: 0.2 });
    letra(9.5, false); doc.setTextColor(250, 235, 238); doc.text('Departamento de Gases Medicinales', xt, y0 + 15.5);
    letra(8.2, false); doc.setTextColor(225, 190, 198);
    doc.text(e.codigo + ' · ' + e.nombre, xt, y0 + 20, { maxWidth: an - 30 - 48 });
    const xe = x0 + an - 44, xv = x0 + an - 27;
    [['Código', FORMATO.codigo], ['Versión', FORMATO.version], ['Fecha', FORMATO.fecha], ['Página', n + ' de ' + total]].forEach(function(f, i) {
      const yy = y0 + 6.6 + i * 4.6;
      letra(8.2, false); doc.setTextColor(225, 190, 198); doc.text(f[0], xe, yy);
      letra(8.2, true); doc.setTextColor(255, 255, 255); doc.text(String(f[1]), xv, yy);
    });
    letra(7.5, false); color(ETQ);
    doc.text('Generado el ' + fFechaPdf(hoyISO()) + ' a las ' + hora() + ' · Clínica Reina Catalina', W / 2, H - 6, { align: 'center' });
  }
  return doc.output('blob');
}

async function generarPdf(id) {
  const e = equipo(id);
  if (!e) return;
  toast(ico('sync', 's') + 'Armando la hoja de vida…');
  try {
    const blob = await construirPdf(e);
    const nombre = 'HV_' + e.codigo + '_' + e.nombre.replace(/[\\/:*?"<>|#%]+/g, ' ').trim() + '.pdf';
    $('#toast').innerHTML = '';
    mostrarHojaPdf(e, blob, nombre);
  } catch (err) {
    toast(ico('warning', 's') + esc(err.message || 'No se pudo generar el PDF.'));
  }
}

function mostrarHojaPdf(e, blob, nombre) {
  const url = URL.createObjectURL(blob);
  const div = document.createElement('div');
  div.className = 'hoja';
  div.innerHTML = '<div role="dialog" aria-modal="true" aria-label="PDF listo"><h2>Hoja de vida lista</h2>' +
    '<div class="archivo">' + ico('picture_as_pdf') + '<span class="txt">' + esc(nombre) + '<br><span class="ayuda">' + Math.max(1, Math.round(blob.size / 1024)) + ' KB · ' + FORMATO.codigo + '</span></span></div>' +
    '<div class="tres"><button type="button" class="btn ton" data-h="ver">' + ico('description') + 'Ver</button>' +
    '<button type="button" class="btn ton" data-h="compartir">' + ico('share') + 'Compartir</button>' +
    '<button type="button" class="btn ton" data-h="drive">' + ico('cloud_done') + 'A Drive</button></div>' +
    '<button type="button" class="btn sec" style="margin-top:12px" data-h="cerrar">Cerrar</button></div>';
  document.body.appendChild(div);
  const cerrar = function() { div.remove(); setTimeout(function() { URL.revokeObjectURL(url); }, 60000); };
  div.onclick = async function(ev) {
    if (ev.target === div) return cerrar();
    const b = ev.target.closest('[data-h]');
    if (!b) return;
    const h = b.dataset.h;
    if (h === 'cerrar') cerrar();
    if (h === 'ver') {
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    }
    if (h === 'compartir') {
      const f = new File([blob], nombre, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], title: nombre, text: 'Hoja de vida ' + e.codigo + ' · ' + e.nombre }); } catch (err) { /* cancelado */ }
      } else toast(ico('warning', 's') + 'Este navegador no deja compartir archivos. Toca Ver para descargarlo.');
    }
    if (h === 'drive') {
      const uid = nuevoId('PDF');
      await guardarDato('pdf:' + uid, blob);
      await encolar({ accion: 'pdf', uid: uid, id: e.id, codigo: e.codigo });
      b.disabled = true;
      b.innerHTML = ico('check') + (navigator.onLine ? 'Subiendo' : 'En cola');
      toast(ico('cloud_done', 's') + (navigator.onLine ? 'Subiendo la hoja de vida a Drive…' : 'Se sube a Drive al volver la señal'));
      sincronizar();
    }
  };
}


/***********************
 * INSTALAR Y ARRANCAR
 ***********************/

async function instalar() {
  if (!S.avisoInstalar) return;
  S.avisoInstalar.prompt();
  await S.avisoInstalar.userChoice;
  S.avisoInstalar = null;
  pintar(false);
}

function reloj() {
  $$('[data-reloj]').forEach(function(el) { el.textContent = hora(); });
}

async function iniciar() {
  try { await abrirBD(); } catch (e) { /* sin IndexedDB: solo en memoria */ }
  const cfg = await leerDato('cfg');
  if (cfg) S.cfg = Object.assign({}, CFG_INICIAL, cfg);
  S.servEq = (await leerDato('servEq')) || [];
  S.servMt = (await leerDato('servMt')) || [];
  S.cola = (await leerDato('cola')) || [];
  // Fotos y firmas pequeñas guardadas
  if (bd) {
    await new Promise(function(resolve) {
      try {
        const c = bd.transaction('datos').objectStore('datos').openCursor(IDBKeyRange.bound('mini:', 'mini:￿'));
        c.onsuccess = function() { const cur = c.result; if (cur) { S.minis[String(cur.key).slice(5)] = cur.value; cur.continue(); } else resolve(); };
        c.onerror = function() { resolve(); };
      } catch (e) { resolve(); }
    });
  }
  const t = ls.get('turno', null);
  if (t) { S.sede = t.sede; S.tecnico = t.tecnico; S.filtroSede = t.sede; }
  try { history.replaceState({ n: 0 }, ''); } catch (e) { /* nada */ }
  pintar(true);
  setInterval(reloj, 20000);
  if (codigoAcceso()) sincronizar();
  window.addEventListener('online', sincronizar);
  window.addEventListener('offline', pintarFranja);
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') { reloj(); sincronizar(); } });
  window.addEventListener('beforeinstallprompt', function(e) { e.preventDefault(); S.avisoInstalar = e; if (S.vista === 'ajustes' && !S.pila.length) pintar(false); });
  window.addEventListener('scroll', function() {
    // En Mornye el título grande se encoge a una barra arriba al hacer scroll
    let c = $('#compacta');
    const h1 = $('.cab h1');
    if (!h1) return;
    const pasado = h1.getBoundingClientRect().bottom < 0;
    if (!c) { c = document.createElement('div'); c.id = 'compacta'; c.className = 'compacta'; document.body.appendChild(c); }
    if (pasado) {
      const conVolver = !!$('.cab.interna');
      c.innerHTML = (conVolver ? '<button type="button" class="btn-ic" aria-label="Volver" onclick="volver()">' + ico('arrow_back') + '</button>' : '<span style="width:8px"></span>') + '<b>' + esc(h1.textContent) + '</b>';
    }
    c.classList.toggle('on', pasado);
  }, { passive: true });

  if ('serviceWorker' in navigator) {
    const yaHabia = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function(reg) {
      document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') reg.update().catch(function() {}); });
    }).catch(function() { /* nada */ });
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (!yaHabia) return;
      const av = $('#nuevaVer');
      if (av) av.classList.add('on');
    });
  }
}

iniciar();
