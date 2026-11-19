"""Prueba de humo de Hojas de vida con un servidor de Apps Script simulado.
Uso (desde la raíz del repositorio):  python3 .claude/scripts/prueba_humo.py
Necesita: pip install playwright pillow  y  playwright install chromium
Recorre: código de acceso, técnico, equipo con foto, mantenimiento de proveedor con firmas SIN señal,
subida al volver la señal, PDF a Drive, Mantenimientos, Ajustes y anchos 320/390/768/1024/1440.
Termina con código 1 si hay errores de JavaScript, desbordes o algo que no se subió."""
import os, subprocess, tempfile, atexit
from PIL import Image, ImageDraw
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SAL = tempfile.mkdtemp(prefix='humo_hv_')
srv = subprocess.Popen(['python3', '-m', 'http.server', '8790'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
atexit.register(srv.terminate)
im = Image.new('RGB', (1600, 1200), (200, 205, 210)); ImageDraw.Draw(im).rectangle((300, 250, 1300, 1000), fill=(60, 90, 140)); im.save(SAL + '/compresor.jpg')
Image.new('RGB', (1200, 900), (120, 60, 40)).save(SAL + '/filtro.jpg')
import time; time.sleep(1)
import json, sys, time
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8790/'
SRV = {'eq': [], 'mt': [], 'minis': {}, 'llamadas': []}
CFG = {'sedes': ['Barranquilla', 'Baranoa'], 'tecnicos': {'Barranquilla': ['JORGE ORTIZ', 'KENSY DÍAZ'], 'Baranoa': ['KEVIN GAMERO']},
       'tipos': ['Compresor', 'Bomba de vacío', 'SAM (planta de aire medicinal)', 'Generador de oxígeno', 'Secador de aire', 'Tanque pulmón'],
       'ubicaciones': ['Cuarto de máquinas'], 'empresas': ['Messer Colombia'], 'coordinador': 'Antony (coordinador)'}
def servidor(route):
    d = json.loads(route.request.post_data or '{}')
    a = d.get('accion'); SRV['llamadas'].append(a)
    r = {'ok': True}
    if d.get('codigo') != '1234': r = {'ok': False, 'codigo': 'ACCESO', 'error': 'Código de acceso incorrecto.'}
    elif a == 'datos': r.update(config=CFG, equipos=SRV['eq'], mantenimientos=SRV['mt'], minis={k: v for k, v in SRV['minis'].items() if k.startswith('EQ:')})
    elif a == 'equipo':
        e = d['e']; e['foto'] = ['https://drive.google.com/file/d/FOTO/view'] if d.get('foto') else []; e['pdf'] = []
        if d.get('mini'): SRV['minis']['EQ:' + e['id']] = d['mini']
        SRV['eq'] = [x for x in SRV['eq'] if x['id'] != e['id']] + [e]; r['equipo'] = e
    elif a == 'mantenimiento':
        m = d['m']; SRV['mt'].append(m)
        for i, mi in enumerate(d.get('minis', [])): SRV['minis']['MT:%s:%d' % (m['id'], i + 1)] = mi
        if d.get('firmaMini'): SRV['minis']['FI:' + m['id']] = d['firmaMini']
        SRV['ultimoMt'] = {k: (len(v) if isinstance(v, str) else v) for k, v in d.items() if k != 'codigo'}
    elif a == 'miniaturas': r['minis'] = {k: SRV['minis'][k] for k in d.get('claves', []) if k in SRV['minis']}
    elif a == 'pdf': SRV['pdf'] = len(d.get('base64', '')); r['url'] = 'https://drive.google.com/file/d/PDF/view'
    route.fulfill(status=200, content_type='application/json', body=json.dumps(r))

def captura(pg, n): pg.screenshot(path=SAL + '/%s.png' % n, full_page=False)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block', accept_downloads=True)
    ctx.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body="const URL_APPS_SCRIPT='https://script.google.com/macros/s/PRUEBA/exec';"))
    ctx.route('**/script.google.com/**', servidor)
    ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort()); ctx.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    pg = ctx.new_page()
    pg_desbordes = []
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('consola: ' + m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda dl: dl.accept())
    pg.goto(BASE); pg.wait_for_timeout(800)
    # Acceso
    pg.fill('#codigoAcceso', '0000'); pg.click('[data-acc=entrar]'); pg.wait_for_timeout(400)
    print('Código malo:', pg.inner_text('#avisoAcceso'))
    pg.fill('#codigoAcceso', '1234'); pg.click('[data-acc=entrar]'); pg.wait_for_timeout(600)
    pg.click('[data-acc=turnoSede][data-v=Barranquilla]'); pg.click('[data-acc=turnoTec][data-v="JORGE ORTIZ"]'); pg.click('[data-acc=empezar]'); pg.wait_for_timeout(500)
    captura(pg, '01_inicio_vacio')
    # Nuevo equipo: guardar vacío → aviso Falta
    pg.click('[data-acc=nuevoEquipo]'); pg.wait_for_timeout(400)
    pg.click('[data-acc=guardarEquipo]'); pg.wait_for_timeout(300)
    print('Aviso:', pg.inner_text('#toast'))
    captura(pg, '02_falta')
    pg.click('#toastAcc'); pg.wait_for_timeout(600)
    pg.set_input_files('#archFoto', SAL + '/compresor.jpg'); pg.wait_for_timeout(800)
    pg.click('[data-acc=elige][data-f=tipo][data-v=Compresor]'); pg.wait_for_timeout(200)
    pg.fill('[data-f=nombre]', 'Compresor A · SAM')
    pg.click('[data-acc=elige][data-f=ubicacion][data-v="Cuarto de máquinas"]')
    pg.fill('[data-f=marca]', 'Atlas Copco'); pg.fill('[data-f=modelo]', 'GA7 VSD'); pg.fill('[data-f=serie]', 'API123456')
    pg.fill('[data-f=proveedor]', 'Atlas Copco Colombia'); pg.fill('[data-f=instalacion]', '2019-03-14')
    pg.click('[data-acc=elige][data-f=forma][data-v=Compra]'); pg.click('[data-acc=noaplica][data-f=invima]'); pg.click('[data-acc=elige][data-f=riesgo][data-v="No aplica"]')
    pg.fill('[data-f=potencia]', '7,5 kW'); pg.fill('[data-f=voltaje]', '440 V'); pg.click('[data-acc=elige][data-f=fases][data-v=Trifásico]')
    pg.fill('[data-f=caudal]', '21 CFM'); pg.fill('[data-f=presion]', '7,5 bar'); pg.click('[data-acc=elige][data-f=lubricacion][data-v=Lubricado]')
    pg.click('[data-acc=elige][data-f=periodicidad][data-v=Trimestral]'); pg.click('[data-acc=elige][data-f=responsable][data-v=Proveedor]'); pg.wait_for_timeout(200)
    pg.click('[data-acc=agregar][data-f=empresaMtto]'); pg.fill('[data-nuevo=empresaMtto]', 'servicompresores sas'); pg.press('[data-nuevo=empresaMtto]', 'Enter'); pg.wait_for_timeout(200)
    pg.click('[data-acc=elige][data-f=manual][data-v=Sí]')
    print('Código propuesto:', pg.input_value('[data-f=codigo]'), '| empresa:', pg.inner_text('[data-campo=empresaMtto] [aria-pressed=true]'))
    pg.evaluate('window.scrollTo(0,0)'); captura(pg, '03_form_equipo')
    pg.click('[data-acc=guardarEquipo]'); pg.wait_for_timeout(1200)
    captura(pg, '04_detalle')
    print('Llamadas:', SRV['llamadas'], '| equipos en servidor:', len(SRV['eq']), SRV['eq'][0]['codigo'] if SRV['eq'] else '')
    # Mantenimiento SIN SEÑAL por proveedor
    ctx.set_offline(True); pg.evaluate("window.dispatchEvent(new Event('offline'))")
    pg.click('.accion-fija [data-acc=nuevoMant]'); pg.wait_for_timeout(400)
    pg.click('[data-acc=elige][data-f=tipo][data-v=Preventivo]'); pg.fill('[data-f=horometro]', '12430')
    pg.fill('[data-f=descripcion]', 'Cambio de filtro de aire y aceite, revisión de correas.')
    pg.click('[data-acc=elige][data-f=estadoFinal][data-v=Funcionando]')
    pg.click('[data-acc=guardarMant]'); pg.wait_for_timeout(300); print('Aviso mant:', pg.inner_text('#toast'))
    pg.wait_for_timeout(200)
    pg.fill('[data-f=nombreProv]', 'Carlos Pérez')
    pg.click('[data-acc=guardarMant]'); pg.wait_for_timeout(300); print('Aviso 2:', pg.inner_text('#toast'))
    def firmar(sel):
        pg.evaluate("document.querySelector('%s').scrollIntoView({block:'center'})" % sel); pg.wait_for_timeout(150)
        b = pg.locator(sel + ' canvas').bounding_box()
        pg.mouse.move(b['x'] + 30, b['y'] + 100); pg.mouse.down()
        for i in range(12): pg.mouse.move(b['x'] + 30 + i * 18, b['y'] + 100 - (i % 3) * 25)
        pg.mouse.up(); pg.wait_for_timeout(150)
    firmar('[data-firma=firma]'); firmar('[data-firma=firmaRecibe]')
    pg.set_input_files('#archFotoMt', SAL + '/filtro.jpg'); pg.wait_for_timeout(700)
    print('Firma sigue tras foto:', pg.evaluate("!!S.form.firmas.firma && !!S.form.firmas.firmaRecibe"))
    captura(pg, '05_form_mant')
    pg.click('[data-acc=guardarMant]'); pg.wait_for_timeout(800)
    print('Cola sin señal:', pg.evaluate('S.cola.length'), '| franja:', pg.inner_text('#franja'))
    captura(pg, '06_detalle_sin_senal')
    ctx.set_offline(False); pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(1500)
    print('Tras volver la señal: cola', pg.evaluate('S.cola.length'), '| mt en servidor', len(SRV['mt']), '| campos enviados', SRV.get('ultimoMt', {}).keys())
    # PDF
    with pg.expect_download() as dl:
        pg.click('.cab [data-acc=pdf]'); pg.wait_for_selector('.hoja', timeout=15000)
        captura(pg, '07_pdf_listo')
        pg.click('[data-h=ver]')
    dl.value.save_as(SAL + '/hoja.pdf')
    pg.click('[data-h=drive]'); pg.wait_for_timeout(1500)
    print('PDF en Drive (base64 chars):', SRV.get('pdf'))
    pg.click('[data-h=cerrar]'); pg.go_back(); pg.wait_for_timeout(500)
    captura(pg, '08_lista')
    # Mantenimientos y Ajustes
    pg.click('[data-acc=vista][data-v=mantenimientos]'); pg.wait_for_timeout(400); captura(pg, '09_mantenimientos')
    pg.click('[data-acc=vista][data-v=ajustes]'); pg.wait_for_timeout(400); captura(pg, '10_ajustes')
    pg.click('[data-acc=vista][data-v=equipos]'); pg.wait_for_timeout(400)
    # Anchos
    for w, h in [(320, 700), (768, 1024), (1024, 768), (1440, 900)]:
        pg.set_viewport_size({'width': w, 'height': h}); pg.wait_for_timeout(400)
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        print('Ancho %d: desborde horizontal = %s' % (w, ancho > w))
        if ancho > w: pg_desbordes.append(w)
        captura(pg, '11_lista_%d' % w)
    pg.set_viewport_size({'width': 1440, 'height': 900}); pg.click('[data-acc=nuevoMant]'); pg.wait_for_timeout(400); captura(pg, '12_form_pc')
    malos = [e for e in errs if 'ERR_FAILED' not in e and 'Service Worker' not in e]
    print('ERRORES:', malos or 'ninguno')
    print('Capturas y PDF en', SAL)
    br.close()
    fallas = malos or pg_desbordes or not SRV['eq'] or not SRV['mt'] or not SRV.get('pdf')
    sys.exit(1 if fallas else 0)
