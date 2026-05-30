/**
 * Club Samoa — Backend de Eventos MMA (brackets, atletas, scoreboard).
 *
 * Este Apps Script vive separado de Code.gs (uniformes y exámenes) y se
 * despliega como su propio Web App. Apunta a una Google Sheet dedicada
 * llamada "Club Samoa - Eventos MMA" con 6 pestañas:
 *   - Atletas
 *   - Eventos
 *   - Inscripciones
 *   - Brackets
 *   - Peleas
 *   - Configuracion
 *
 * SETUP RÁPIDO:
 *   1. Crear nuevo proyecto Apps Script (https://script.google.com).
 *   2. Pegar este archivo como Eventos.gs.
 *   3. (Opcional) En PropertiesService, setear CLUB_SAMOA_EVENTOS_SPREADSHEET_ID
 *      con el ID de una Sheet existente. Si no, se crea una nueva al primer setup.
 *   4. Ejecutar `setupEventosSheets()` manualmente desde el editor.
 *   5. Desplegar como Web App (Execute as: Me, Who has access: Anyone).
 *   6. Copiar la URL /exec y guardarla en registration-config.js como
 *      `window.CLUB_SAMOA_EVENTOS_ENDPOINT`.
 *
 * Endpoints actualmente disponibles:
 *   GET ?action=ping              → diagnóstico, devuelve { ok, version }
 *   GET ?action=setup             → corre setupEventosSheets() y devuelve URL
 *
 * Endpoints futuros (Tareas 05, 08, 10, 15 del TASKS.md): atletas.*,
 * eventos.*, inscripciones.*, brackets.*, peleas.*.
 */

const CLUB_SAMOA_EVENTOS = {
  version: "0.3.0",
  spreadsheetIdProperty: "CLUB_SAMOA_EVENTOS_SPREADSHEET_ID",
  spreadsheetName: "Club Samoa - Eventos MMA",
};

const EVENTOS_TABS = {
  atletas: "Atletas",
  eventos: "Eventos",
  inscripciones: "Inscripciones",
  brackets: "Brackets",
  peleas: "Peleas",
  configuracion: "Configuracion",
};

const ATLETAS_HEADERS = [
  "ID",
  "Nombre completo",
  "Fecha nacimiento",
  "Genero",
  "Anios practica",
  "Nivel",
  "Peso referencia (kg)",
  "Academia",
  "Pais",
  "Foto URL",
  "Activo",
  "Creado en",
];

const EVENTOS_HEADERS = [
  "ID",
  "Nombre",
  "Fecha",
  "Sede",
  "Estatus",
  "Creado en",
];

const INSCRIPCIONES_HEADERS = [
  "ID",
  "Evento ID",
  "Atleta ID",
  "Peso pesaje (kg)",
  "Categoria calculada",
  "Estatus",
  "Creado en",
];

const BRACKETS_HEADERS = [
  "ID",
  "Evento ID",
  "Categoria",
  "Tipo bracket",
  "Num atletas",
  "Estatus",
  "JSON estructura",
  "Creado en",
];

const PELEAS_HEADERS = [
  "ID",
  "Bracket ID",
  "Ronda",
  "Numero pelea",
  "Atleta1 ID",
  "Atleta2 ID",
  "Ganador ID",
  "Metodo finalizacion",
  "Round finalizacion",
  "Tiempo finalizacion",
  "Notas",
  "Actualizado en",
];

const CONFIGURACION_HEADERS = ["Clave", "Valor", "Notas"];

const TABS_DEFINITION = [
  { name: EVENTOS_TABS.atletas, headers: ATLETAS_HEADERS },
  { name: EVENTOS_TABS.eventos, headers: EVENTOS_HEADERS },
  { name: EVENTOS_TABS.inscripciones, headers: INSCRIPCIONES_HEADERS },
  { name: EVENTOS_TABS.brackets, headers: BRACKETS_HEADERS },
  { name: EVENTOS_TABS.peleas, headers: PELEAS_HEADERS },
  { name: EVENTOS_TABS.configuracion, headers: CONFIGURACION_HEADERS },
];

const ESTATUS_EVENTO = ["borrador", "activo", "finalizado"];
const ESTATUS_INSCRIPCION = ["pendiente_pesaje", "aprobado", "rechazado"];
const ESTATUS_BRACKET = ["borrador", "confirmado", "en_curso", "finalizado"];
const TIPO_BRACKET = ["single_elimination", "dos_atletas"];

/* ============================================================
 * Setup / inicialización
 * ============================================================ */

/**
 * Crea o repara las 6 pestañas de la Sheet de eventos.
 * Idempotente: corre múltiples veces sin perder datos existentes.
 */
function setupEventosSheets() {
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  TABS_DEFINITION.forEach((tab) => {
    ensureSheetWithHeaders_(spreadsheet, tab.name, tab.headers);
  });
  seedConfiguracion_(spreadsheet);
  Logger.log(
    JSON.stringify(
      {
        spreadsheetUrl: spreadsheet.getUrl(),
        spreadsheetId: spreadsheet.getId(),
        tabs: TABS_DEFINITION.map((t) => t.name),
      },
      null,
      2,
    ),
  );
  return spreadsheet;
}

function getOrCreateEventosSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty(CLUB_SAMOA_EVENTOS.spreadsheetIdProperty);
  let spreadsheet;
  if (id) {
    spreadsheet = SpreadsheetApp.openById(id);
  } else {
    spreadsheet = SpreadsheetApp.create(CLUB_SAMOA_EVENTOS.spreadsheetName);
    properties.setProperty(CLUB_SAMOA_EVENTOS.spreadsheetIdProperty, spreadsheet.getId());
  }
  return spreadsheet;
}

function ensureSheetWithHeaders_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);

  // Solo sobrescribimos encabezados si la primera fila está vacía o
  // si los encabezados no coinciden. Nunca tocamos las filas de datos.
  const lastCol = Math.max(headers.length, sheet.getLastColumn() || 1);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];
  const headersMatch =
    currentHeaders.length === headers.length &&
    headers.every((h, i) => String(currentHeaders[i]).trim() === h);

  if (!headersMatch) {
    headerRange.setValues([headers]);
  }

  headerRange
    .setBackground("#7f0000")
    .setFontColor("#f7f2f1")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sheet.setRowHeight(1, 36);

  // Anchos por defecto razonables; el operador puede ajustar manualmente
  // sin que setupEventosSheets() los pise.
  for (let col = 1; col <= headers.length; col += 1) {
    if (sheet.getColumnWidth(col) < 110) {
      sheet.setColumnWidth(col, 160);
    }
  }
  return sheet;
}

function seedConfiguracion_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(EVENTOS_TABS.configuracion);
  if (!sheet) return;
  if (sheet.getLastRow() > 1) return; // ya tiene contenido

  const seed = [
    ["version_reglamento", "FAMM 2025", "Versión del reglamento aplicado por defecto."],
    ["zona_horaria", Session.getScriptTimeZone(), "Zona horaria de los eventos."],
    ["pais_default", "México", "País por defecto para nuevos atletas."],
  ];
  sheet.getRange(2, 1, seed.length, 3).setValues(seed);
}

/* ============================================================
 * Web App entry points
 * ============================================================ */

function doGet(e) {
  try {
    const action = ((e && e.parameter && e.parameter.action) || "ping").toLowerCase();
    return json_(routeAction_(action, readPayload_(e)));
  } catch (error) {
    return json_(errorResponse_(error));
  }
}

function doPost(e) {
  try {
    const payload = readPayload_(e);
    const action = String(payload.action || "").toLowerCase();
    if (!action) {
      throw new Error("Falta el campo 'action'.");
    }
    return json_(routeAction_(action, payload));
  } catch (error) {
    return json_(errorResponse_(error));
  }
}

/**
 * Router central.
 * Acciones disponibles:
 *   - ping, setup (tarea 01)
 *   - atletas.list, atletas.get, atletas.create,
 *     atletas.update, atletas.archive (tarea 05)
 *   - eventos.list, eventos.get, eventos.create,
 *     eventos.update, eventos.setEstatus (tarea 08)
 */
function routeAction_(action, payload) {
  switch (action) {
    case "ping":
      return {
        ok: true,
        service: "Club Samoa — Eventos MMA",
        version: CLUB_SAMOA_EVENTOS.version,
        timestamp: new Date().toISOString(),
      };

    case "setup": {
      const spreadsheet = setupEventosSheets();
      return {
        ok: true,
        spreadsheetUrl: spreadsheet.getUrl(),
        spreadsheetId: spreadsheet.getId(),
        tabs: TABS_DEFINITION.map((t) => t.name),
      };
    }

    case "atletas.list":
      return handleAtletasList_(payload);
    case "atletas.get":
      return handleAtletasGet_(payload);
    case "atletas.create":
      return handleAtletasCreate_(payload);
    case "atletas.update":
      return handleAtletasUpdate_(payload);
    case "atletas.archive":
      return handleAtletasArchive_(payload);

    case "eventos.list":
      return handleEventosList_(payload);
    case "eventos.get":
      return handleEventosGet_(payload);
    case "eventos.create":
      return handleEventosCreate_(payload);
    case "eventos.update":
      return handleEventosUpdate_(payload);
    case "eventos.setestatus":
      return handleEventosSetEstatus_(payload);

    default:
      throw new Error("Acción no reconocida: " + action);
  }
}

/* ============================================================
 * Helpers de payload / respuesta
 * ============================================================ */

function readPayload_(e) {
  const payload = {};
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach((key) => {
      payload[key] = e.parameter[key];
    });
  }
  const body = e && e.postData && e.postData.contents ? e.postData.contents : "";
  if (body && body.trim().charAt(0) === "{") {
    const parsed = JSON.parse(body);
    Object.keys(parsed).forEach((key) => {
      payload[key] = parsed[key];
    });
  }
  // Si el cliente envía { action, payload: {...} }, hacemos flatten para
  // que las acciones reciban directamente sus campos.
  if (payload.payload && typeof payload.payload === "object") {
    Object.keys(payload.payload).forEach((key) => {
      if (!(key in payload)) {
        payload[key] = payload.payload[key];
      }
    });
  }
  return payload;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function errorResponse_(error) {
  const message = error && error.message ? error.message : String(error);
  return { ok: false, error: message };
}

/* ============================================================
 * Helpers de filas (para tareas siguientes)
 * ============================================================ */

/**
 * Lee todas las filas de una pestaña como array de objetos {header: value}.
 * Ignora la fila de encabezado.
 */
function readRows_(spreadsheet, tabName) {
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Pestaña no encontrada: " + tabName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows
    .filter((row) => row.some((cell) => cell !== "" && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx];
      });
      return obj;
    });
}

/**
 * Inserta una fila a partir de un objeto {header: value}. Los headers no
 * presentes en la pestaña se ignoran.
 */
function appendRow_(spreadsheet, tabName, obj) {
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Pestaña no encontrada: " + tabName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((header) => (header in obj ? obj[header] : ""));
  sheet.appendRow(row);
  return sheet.getLastRow();
}

/**
 * Encuentra una fila por su valor en la columna "ID".
 * @returns {{rowIndex: number, row: Object|null}} rowIndex es 1-based
 *          (incluye encabezado, así que la primera fila de datos es 2).
 */
function findRowById_(spreadsheet, tabName, id) {
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Pestaña no encontrada: " + tabName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { rowIndex: -1, row: null };
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i][0]) === String(id)) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = rows[i][idx];
      });
      return { rowIndex: i + 2, row: obj };
    }
  }
  return { rowIndex: -1, row: null };
}

/**
 * Sobrescribe una fila existente. Los headers no presentes en obj
 * conservan su valor actual (no se borran).
 */
function writeRow_(spreadsheet, tabName, rowIndex, obj) {
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Pestaña no encontrada: " + tabName);
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const current = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  const next = headers.map((header, idx) =>
    header in obj ? obj[header] : current[idx],
  );
  sheet.getRange(rowIndex, 1, 1, lastCol).setValues([next]);
}

/**
 * Genera el siguiente ID secuencial para una pestaña dada.
 * Formato: `${prefix}_${N}` donde N se busca en la columna ID.
 */
function nextId_(spreadsheet, tabName, prefix) {
  const rows = readRows_(spreadsheet, tabName);
  let max = 0;
  rows.forEach((row) => {
    const id = String(row.ID || row.id || "");
    const match = id.match(new RegExp("^" + prefix + "_(\\d+)$"));
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  });
  return prefix + "_" + String(max + 1).padStart(3, "0");
}

function requireFields_(payload, fields) {
  const missing = fields.filter((field) => {
    const v = payload[field];
    return v === undefined || v === null || String(v).trim() === "";
  });
  if (missing.length) {
    throw new Error("Faltan campos requeridos: " + missing.join(", "));
  }
}

function value_(payload, key) {
  return payload[key] === undefined || payload[key] === null
    ? ""
    : String(payload[key]).trim();
}

/* ============================================================
 * Atletas — definición de campos y mappers
 * ============================================================ */

const GENEROS = ["Masculino", "Femenino"];
const NIVELES = ["Novato", "Principiante", "Intermedio", "Avanzado"];

/**
 * Definición declarativa de los campos del atleta. Mantiene en un solo
 * lugar: orden, header en la Sheet, tipo, validaciones, defaults.
 */
const ATLETAS_FIELDS = [
  { key: "id",                 header: "ID",                  type: "string",   system: true },
  { key: "nombre_completo",    header: "Nombre completo",     type: "string",   required: true, editable: true },
  { key: "fecha_nacimiento",   header: "Fecha nacimiento",    type: "date",     required: true, editable: true },
  { key: "genero",             header: "Genero",              type: "enum",     values: GENEROS,  required: true, editable: true },
  { key: "anios_practica",     header: "Anios practica",      type: "number",   required: true, editable: true, min: 0 },
  { key: "nivel",              header: "Nivel",               type: "enum",     values: NIVELES,  required: true, editable: true },
  { key: "peso_referencia_kg", header: "Peso referencia (kg)", type: "number",  required: true, editable: true, min: 0.1 },
  { key: "academia",           header: "Academia",            type: "string",   editable: true },
  { key: "pais",               header: "Pais",                type: "string",   editable: true, default: "México" },
  { key: "foto_url",           header: "Foto URL",            type: "string",   editable: true },
  { key: "activo",             header: "Activo",              type: "boolean",  system: true },
  { key: "creado_en",          header: "Creado en",           type: "datetime", system: true },
];

/**
 * Convierte una fila leída de la Sheet (objeto {header: value}) a un
 * atleta JSON-friendly con keys snake_case.
 */
function rowToAtleta_(row) {
  const out = {};
  ATLETAS_FIELDS.forEach((field) => {
    out[field.key] = normalizeOutput_(row[field.header], field.type);
  });
  return out;
}

function normalizeOutput_(raw, type) {
  if (raw === "" || raw === null || raw === undefined) {
    if (type === "boolean") return false;
    if (type === "number") return null;
    return "";
  }
  switch (type) {
    case "boolean":
      if (typeof raw === "boolean") return raw;
      const s = String(raw).trim().toLowerCase();
      return s === "true" || s === "yes" || s === "sí" || s === "1";
    case "number":
      const n = Number(raw);
      return isFinite(n) ? n : null;
    case "date":
      if (raw instanceof Date && !isNaN(raw.getTime())) {
        return Utilities.formatDate(raw, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      return String(raw);
    case "datetime":
      if (raw instanceof Date && !isNaN(raw.getTime())) {
        return raw.toISOString();
      }
      return String(raw);
    default:
      return String(raw);
  }
}

/**
 * Convierte un atleta (snake_case) a un objeto {header: value} listo
 * para appendRow_ / writeRow_.
 */
function atletaToRow_(atleta) {
  const row = {};
  ATLETAS_FIELDS.forEach((field) => {
    if (!(field.key in atleta)) return;
    row[field.header] = normalizeInput_(atleta[field.key], field.type);
  });
  return row;
}

function normalizeInput_(raw, type) {
  if (raw === null || raw === undefined) return "";
  switch (type) {
    case "boolean":
      return Boolean(raw);
    case "number":
      const n = Number(raw);
      return isFinite(n) ? n : "";
    case "date":
      if (raw instanceof Date) return raw;
      const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      }
      const d = new Date(String(raw));
      return isNaN(d.getTime()) ? "" : d;
    case "datetime":
      if (raw instanceof Date) return raw;
      const dt = new Date(String(raw));
      return isNaN(dt.getTime()) ? "" : dt;
    default:
      return String(raw).trim();
  }
}

/**
 * Valida campos editables. Lanza Error si algo no cumple.
 * En modo create, los required deben estar presentes.
 * En modo update, solo valida los campos que vengan en el payload.
 */
function validateAtleta_(payload, opts) {
  const isUpdate = opts && opts.isUpdate;
  ATLETAS_FIELDS.forEach((field) => {
    if (field.system) return;
    const present = field.key in payload;

    if (!isUpdate && field.required && !present) {
      throw new Error("Falta campo requerido: " + field.key);
    }
    if (!present) return;

    const v = payload[field.key];
    const emptyish = v === null || v === undefined || String(v).trim() === "";
    if (field.required && emptyish) {
      throw new Error("Campo requerido vacío: " + field.key);
    }
    if (!field.required && emptyish) return;

    switch (field.type) {
      case "enum":
        if (field.values && field.values.indexOf(String(v)) < 0) {
          throw new Error(
            field.key + " debe ser uno de [" + field.values.join(", ") + "], recibido: " + v,
          );
        }
        break;
      case "number": {
        const n = Number(v);
        if (!isFinite(n)) {
          throw new Error(field.key + " debe ser número, recibido: " + v);
        }
        if (field.min !== undefined && n < field.min) {
          throw new Error(field.key + " debe ser >= " + field.min);
        }
        break;
      }
      case "date": {
        const parsed = normalizeInput_(v, "date");
        if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
          throw new Error(field.key + " no es una fecha válida (use YYYY-MM-DD)");
        }
        const year = parsed.getFullYear();
        const today = new Date();
        if (year < 1900 || parsed > today) {
          throw new Error(field.key + " fuera de rango razonable (1900–hoy)");
        }
        break;
      }
    }
  });
}

/* ============================================================
 * Atletas — action handlers
 * ============================================================ */

function handleAtletasList_(payload) {
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const rows = readRows_(spreadsheet, EVENTOS_TABS.atletas);
  const includeArchived =
    payload.include_archived === true ||
    String(payload.include_archived).toLowerCase() === "true";
  const atletas = rows
    .map(rowToAtleta_)
    .filter((a) => includeArchived || a.activo === true);
  return { ok: true, count: atletas.length, atletas: atletas };
}

function handleAtletasGet_(payload) {
  requireFields_(payload, ["id"]);
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { row } = findRowById_(spreadsheet, EVENTOS_TABS.atletas, payload.id);
  if (!row) throw new Error("Atleta no encontrado: " + payload.id);
  return { ok: true, atleta: rowToAtleta_(row) };
}

function handleAtletasCreate_(payload) {
  validateAtleta_(payload, { isUpdate: false });
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const id = nextId_(spreadsheet, EVENTOS_TABS.atletas, "atl");

  const atleta = { id: id, activo: true, creado_en: new Date() };
  ATLETAS_FIELDS.forEach((field) => {
    if (field.system) return;
    if (field.key in payload && payload[field.key] !== null && payload[field.key] !== "") {
      atleta[field.key] = payload[field.key];
    } else if (field.default !== undefined) {
      atleta[field.key] = field.default;
    } else {
      atleta[field.key] = "";
    }
  });

  appendRow_(spreadsheet, EVENTOS_TABS.atletas, atletaToRow_(atleta));

  // Re-leemos para devolver lo que efectivamente quedó en la Sheet
  // (fechas, ID, etc. ya con los formatos correctos).
  const { row } = findRowById_(spreadsheet, EVENTOS_TABS.atletas, id);
  return { ok: true, atleta: rowToAtleta_(row) };
}

function handleAtletasUpdate_(payload) {
  requireFields_(payload, ["id"]);
  validateAtleta_(payload, { isUpdate: true });
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { rowIndex, row } = findRowById_(spreadsheet, EVENTOS_TABS.atletas, payload.id);
  if (!row) throw new Error("Atleta no encontrado: " + payload.id);

  // Tomamos el estado actual y aplicamos cambios editables del payload.
  const next = {};
  ATLETAS_FIELDS.forEach((field) => {
    if (field.system) {
      next[field.header] = row[field.header]; // preservar ID, Activo, Creado en
      return;
    }
    if (field.editable && field.key in payload) {
      next[field.header] = normalizeInput_(payload[field.key], field.type);
    } else {
      next[field.header] = row[field.header];
    }
  });

  writeRow_(spreadsheet, EVENTOS_TABS.atletas, rowIndex, next);

  const { row: finalRow } = findRowById_(spreadsheet, EVENTOS_TABS.atletas, payload.id);
  return { ok: true, atleta: rowToAtleta_(finalRow) };
}

function handleAtletasArchive_(payload) {
  requireFields_(payload, ["id"]);
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { rowIndex, row } = findRowById_(spreadsheet, EVENTOS_TABS.atletas, payload.id);
  if (!row) throw new Error("Atleta no encontrado: " + payload.id);

  const sheet = spreadsheet.getSheetByName(EVENTOS_TABS.atletas);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = headers.indexOf("Activo") + 1;
  if (col <= 0) throw new Error("Columna 'Activo' no encontrada en Atletas.");
  sheet.getRange(rowIndex, col).setValue(false);

  return { ok: true, id: payload.id, activo: false };
}

/* ============================================================
 * Eventos — definición de campos y mappers
 * ============================================================ */

const EVENTOS_FIELDS = [
  { key: "id",        header: "ID",       type: "string",   system: true },
  { key: "nombre",    header: "Nombre",   type: "string",   required: true, editable: true },
  { key: "fecha",     header: "Fecha",    type: "date",     required: true, editable: true },
  { key: "sede",      header: "Sede",     type: "string",   required: true, editable: true },
  { key: "estatus",   header: "Estatus",  type: "enum",     values: ESTATUS_EVENTO, system: true },
  { key: "creado_en", header: "Creado en", type: "datetime", system: true },
];

function rowToEvento_(row) {
  const out = {};
  EVENTOS_FIELDS.forEach((field) => {
    out[field.key] = normalizeOutput_(row[field.header], field.type);
  });
  return out;
}

function eventoToRow_(evento) {
  const row = {};
  EVENTOS_FIELDS.forEach((field) => {
    if (!(field.key in evento)) return;
    row[field.header] = normalizeInput_(evento[field.key], field.type);
  });
  return row;
}

/**
 * Validación específica de eventos:
 *  - nombre, fecha, sede requeridos.
 *  - fecha puede ser pasada o futura (eventos pueden ya haber ocurrido).
 *  - fecha debe estar en rango razonable (1900–2100).
 */
function validateEvento_(payload, opts) {
  const isUpdate = opts && opts.isUpdate;
  EVENTOS_FIELDS.forEach((field) => {
    if (field.system) return;
    const present = field.key in payload;

    if (!isUpdate && field.required && !present) {
      throw new Error("Falta campo requerido: " + field.key);
    }
    if (!present) return;

    const v = payload[field.key];
    const emptyish = v === null || v === undefined || String(v).trim() === "";
    if (field.required && emptyish) {
      throw new Error("Campo requerido vacío: " + field.key);
    }
    if (!field.required && emptyish) return;

    if (field.type === "date") {
      const parsed = normalizeInput_(v, "date");
      if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
        throw new Error(field.key + " no es una fecha válida (use YYYY-MM-DD)");
      }
      const year = parsed.getFullYear();
      if (year < 1900 || year > 2100) {
        throw new Error(field.key + " fuera de rango razonable (1900–2100)");
      }
    }
  });
}

/* ============================================================
 * Eventos — action handlers
 * ============================================================ */

function handleEventosList_(payload) {
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const rows = readRows_(spreadsheet, EVENTOS_TABS.eventos);
  let eventos = rows.map(rowToEvento_);

  // Filtro opcional por estatus
  const estatus = value_(payload, "estatus");
  if (estatus) {
    eventos = eventos.filter((e) => e.estatus === estatus);
  }

  // Orden por fecha descendente (más reciente arriba) por defecto
  eventos.sort((a, b) => {
    return String(b.fecha || "").localeCompare(String(a.fecha || ""));
  });

  return { ok: true, count: eventos.length, eventos: eventos };
}

function handleEventosGet_(payload) {
  requireFields_(payload, ["id"]);
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { row } = findRowById_(spreadsheet, EVENTOS_TABS.eventos, payload.id);
  if (!row) throw new Error("Evento no encontrado: " + payload.id);
  return { ok: true, evento: rowToEvento_(row) };
}

function handleEventosCreate_(payload) {
  validateEvento_(payload, { isUpdate: false });
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const id = nextId_(spreadsheet, EVENTOS_TABS.eventos, "evt");

  const evento = {
    id: id,
    nombre: value_(payload, "nombre"),
    fecha: payload.fecha,
    sede: value_(payload, "sede"),
    estatus: "borrador",
    creado_en: new Date(),
  };

  appendRow_(spreadsheet, EVENTOS_TABS.eventos, eventoToRow_(evento));

  const { row } = findRowById_(spreadsheet, EVENTOS_TABS.eventos, id);
  return { ok: true, evento: rowToEvento_(row) };
}

function handleEventosUpdate_(payload) {
  requireFields_(payload, ["id"]);
  validateEvento_(payload, { isUpdate: true });
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { rowIndex, row } = findRowById_(spreadsheet, EVENTOS_TABS.eventos, payload.id);
  if (!row) throw new Error("Evento no encontrado: " + payload.id);

  const next = {};
  EVENTOS_FIELDS.forEach((field) => {
    if (field.system) {
      next[field.header] = row[field.header];
      return;
    }
    if (field.editable && field.key in payload) {
      next[field.header] = normalizeInput_(payload[field.key], field.type);
    } else {
      next[field.header] = row[field.header];
    }
  });

  writeRow_(spreadsheet, EVENTOS_TABS.eventos, rowIndex, next);

  const { row: finalRow } = findRowById_(spreadsheet, EVENTOS_TABS.eventos, payload.id);
  return { ok: true, evento: rowToEvento_(finalRow) };
}

function handleEventosSetEstatus_(payload) {
  requireFields_(payload, ["id", "estatus"]);
  const estatus = String(payload.estatus).toLowerCase().trim();
  if (ESTATUS_EVENTO.indexOf(estatus) < 0) {
    throw new Error(
      "estatus debe ser uno de [" + ESTATUS_EVENTO.join(", ") + "], recibido: " + payload.estatus,
    );
  }

  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { rowIndex, row } = findRowById_(spreadsheet, EVENTOS_TABS.eventos, payload.id);
  if (!row) throw new Error("Evento no encontrado: " + payload.id);

  const sheet = spreadsheet.getSheetByName(EVENTOS_TABS.eventos);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = headers.indexOf("Estatus") + 1;
  if (col <= 0) throw new Error("Columna 'Estatus' no encontrada en Eventos.");
  sheet.getRange(rowIndex, col).setValue(estatus);

  return { ok: true, id: payload.id, estatus: estatus };
}
