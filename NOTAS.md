# Notas para quien edite la app

- Estándar visual PixelUI (skill nueva-pwa, paso 5). Ícono: `home_repair_service` en vino sobre rosa.
- Datos del teléfono con prefijo `hojas-vida:` (localStorage) y base IndexedDB `hojas-vida`; caché del service worker `hojas-vida-vN`.
- El Apps Script escribe por nombre de encabezado (COLS_EQ / COLS_MT). Para renombrar un encabezado: cambiarlo en COLS_* y agregar el par viejo → nuevo en RENOMBRES.
- Fotos y firmas pequeñas (para la lista y el PDF) en la pestaña oculta Miniaturas: EQ:<id>, MT:<id>:n, FI:<id>, FR:<id>.
- Próximo preventivo: último preventivo + periodicidad. Sin preventivos, cuenta desde la instalación solo si esa fecha aún no pasó; si no, "Sin preventivo registrado" (ámbar).
- PDF: carta, FMT-004 v1 25/03/2012, encabezado en todas las páginas; firmas Elaboró (técnico que lo genera) y Revisó (Config → Coordinador).
