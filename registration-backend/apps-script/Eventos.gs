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
  version: "0.4.0",
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
 *   - inscripciones.list, inscripciones.create,
 *     inscripciones.setpesopesaje, inscripciones.setestatus,
 *     inscripciones.delete (tarea 10)
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

    case "inscripciones.list":
      return handleInscripcionesList_(payload);
    case "inscripciones.create":
      return handleInscripcionesCreate_(payload);
    case "inscripciones.setpesopesaje":
      return handleInscripcionesSetPesoPesaje_(payload);
    case "inscripciones.setestatus":
      return handleInscripcionesSetEstatus_(payload);
    case "inscripciones.delete":
      return handleInscripcionesDelete_(payload);

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

/* ============================================================
 * Reglamento FAMM 2025 — tablas y cálculos (port de
 * admin/js/reglamento.js).
 *
 * Necesario en el backend para:
 *  - calcular categoria_calculada al inscribir y al cambiar peso (T10)
 *  - agrupar atletas en brackets por categoría (T13+)
 *
 * Si el reglamento cambia, hay que actualizar AMBOS archivos.
 * ============================================================ */

const REGLAMENTO_EDAD_RANGOS = [
  { division: "Mini 1",    min: 4,  max: 5   },
  { division: "Mini 2",    min: 6,  max: 7   },
  { division: "Infantil",  min: 8,  max: 9   },
  { division: "Juvenil D", min: 10, max: 11  },
  { division: "Juvenil C", min: 12, max: 13  },
  { division: "Juvenil B", min: 14, max: 15  },
  { division: "Juvenil A", min: 16, max: 17  },
  { division: "Junior",    min: 18, max: 20  },
  { division: "Adultos",   min: 21, max: 150 },
];

const REGLAMENTO_PESOS_MINI = [
  { nombre: "Mini Cat. 1",  pesoMax: 23 },
  { nombre: "Mini Cat. 2",  pesoMax: 26 },
  { nombre: "Mini Cat. 3",  pesoMax: 29 },
  { nombre: "Mini Cat. 4",  pesoMax: 32 },
  { nombre: "Mini Cat. 5",  pesoMax: 35 },
  { nombre: "Mini Cat. 6",  pesoMax: 38 },
  { nombre: "Mini Cat. 7",  pesoMax: 41 },
  { nombre: "Mini Cat. 8",  pesoMax: 47 },
  { nombre: "Mini Cat. 9",  pesoMax: 50 },
  { nombre: "Mini Cat. 10", pesoMax: 53 },
  { nombre: "Mini Cat. 11", pesoMax: 56 },
  { nombre: "Mini Cat. 12", pesoMax: 59 },
  { nombre: "Mini Cat. Abierta", pesoMax: Infinity },
];

const REGLAMENTO_PESOS_INFANTIL = [
  { nombre: "Menos 24 kg", pesoMax: 24 },
  { nombre: "Menos 27 kg", pesoMax: 27 },
  { nombre: "Menos 31 kg", pesoMax: 31 },
  { nombre: "Menos 34 kg", pesoMax: 34 },
  { nombre: "Menos 37 kg", pesoMax: 37 },
  { nombre: "Menos 40 kg", pesoMax: 40 },
  { nombre: "Menos 44 kg", pesoMax: 44 },
  { nombre: "Menos 48 kg", pesoMax: 48 },
  { nombre: "Menos 52 kg", pesoMax: 52 },
  { nombre: "Menos 57 kg", pesoMax: 57 },
  { nombre: "Menos 62 kg", pesoMax: 62 },
  { nombre: "Menos 65 kg", pesoMax: 65 },
  { nombre: "Más de 65 kg", pesoMax: Infinity },
];

const REGLAMENTO_PESOS_JUVENIL_D = [
  { nombre: "Menos 30 kg", pesoMax: 30 },
  { nombre: "Menos 34 kg", pesoMax: 34 },
  { nombre: "Menos 37 kg", pesoMax: 37 },
  { nombre: "Menos 40 kg", pesoMax: 40 },
  { nombre: "Menos 44 kg", pesoMax: 44 },
  { nombre: "Menos 48 kg", pesoMax: 48 },
  { nombre: "Menos 52 kg", pesoMax: 52 },
  { nombre: "Menos 57 kg", pesoMax: 57 },
  { nombre: "Menos 62 kg", pesoMax: 62 },
  { nombre: "Menos 65 kg", pesoMax: 65 },
  { nombre: "Menos 70 kg", pesoMax: 70 },
  { nombre: "Más de 70 kg", pesoMax: Infinity },
];

const REGLAMENTO_PESOS_JUVENIL_C = [
  { nombre: "Menos 40 kg", pesoMax: 40 },
  { nombre: "Menos 44 kg", pesoMax: 44 },
  { nombre: "Menos 48 kg", pesoMax: 48 },
  { nombre: "Menos 52 kg", pesoMax: 52 },
  { nombre: "Menos 57 kg", pesoMax: 57 },
  { nombre: "Menos 62 kg", pesoMax: 62 },
  { nombre: "Menos 67 kg", pesoMax: 67 },
  { nombre: "Menos 72 kg", pesoMax: 72 },
  { nombre: "Menos 77 kg", pesoMax: 77 },
  { nombre: "Menos 82 kg", pesoMax: 82 },
  { nombre: "Más de 82 kg", pesoMax: Infinity },
];

const REGLAMENTO_PESOS_JUVENIL_B = REGLAMENTO_PESOS_JUVENIL_C;

const REGLAMENTO_PESOS_JUVENIL_A_VARONIL = [
  { nombre: "Paja",        pesoMax: 52.2 },
  { nombre: "Mosca",       pesoMax: 56.7 },
  { nombre: "Gallo",       pesoMax: 61.2 },
  { nombre: "Pluma",       pesoMax: 65.8 },
  { nombre: "Ligero",      pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio",       pesoMax: 83.9 },
  { nombre: "Supermedio",  pesoMax: 88.4 },
  { nombre: "Semipesado",  pesoMax: 93 },
  { nombre: "Más de 93 kg", pesoMax: Infinity },
];

const REGLAMENTO_PESOS_JUVENIL_A_FEMENIL = [
  { nombre: "Átomo",       pesoMax: 47.6 },
  { nombre: "Paja",        pesoMax: 52.2 },
  { nombre: "Mosca",       pesoMax: 56.7 },
  { nombre: "Gallo",       pesoMax: 61.2 },
  { nombre: "Pluma",       pesoMax: 65.8 },
  { nombre: "Ligero",      pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio",       pesoMax: 83 },
  { nombre: "Más de 83 kg", pesoMax: Infinity },
];

const REGLAMENTO_PESOS_ADULTOS_VARONIL = [
  { nombre: "Peso Paja",   pesoMax: 52.2 },
  { nombre: "Peso Mosca",  pesoMax: 56.7 },
  { nombre: "Peso Gallo",  pesoMax: 61.2 },
  { nombre: "Peso Pluma",  pesoMax: 65.8 },
  { nombre: "Peso Ligero", pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio",       pesoMax: 83.9 },
  { nombre: "Supermedio",  pesoMax: 88.4 },
  { nombre: "Semipesado",  pesoMax: 93 },
  { nombre: "Pesado",      pesoMax: 97 },
  { nombre: "Superpesado", pesoMax: Infinity },
];

const REGLAMENTO_PESOS_ADULTOS_FEMENIL = [
  { nombre: "Átomo",       pesoMax: 47.7 },
  { nombre: "Paja",        pesoMax: 52.2 },
  { nombre: "Mosca",       pesoMax: 56.7 },
  { nombre: "Gallo",       pesoMax: 61.2 },
  { nombre: "Pluma",       pesoMax: 65.8 },
  { nombre: "Ligero",      pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio",       pesoMax: 83.9 },
  { nombre: "Supermedio",  pesoMax: 88.4 },
  { nombre: "Más de 88.4 kg", pesoMax: Infinity },
];

function parseDateString_(s) {
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  if (!s) return null;
  const str = String(s);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function calcularDivisionEdadGs_(fechaNacimiento, fechaReferencia) {
  const fn = parseDateString_(fechaNacimiento);
  const fr = parseDateString_(fechaReferencia);
  if (!fn || !fr) return "";
  let edad = fr.getFullYear() - fn.getFullYear();
  const m = fr.getMonth() - fn.getMonth();
  if (m < 0 || (m === 0 && fr.getDate() < fn.getDate())) edad -= 1;
  for (let i = 0; i < REGLAMENTO_EDAD_RANGOS.length; i += 1) {
    const r = REGLAMENTO_EDAD_RANGOS[i];
    if (edad >= r.min && edad <= r.max) return r.division;
  }
  return "";
}

function categoriasPesoParaGs_(division, genero) {
  switch (division) {
    case "Mini 1":
    case "Mini 2":
      return REGLAMENTO_PESOS_MINI;
    case "Infantil":
      return REGLAMENTO_PESOS_INFANTIL;
    case "Juvenil D":
      return REGLAMENTO_PESOS_JUVENIL_D;
    case "Juvenil C":
      return REGLAMENTO_PESOS_JUVENIL_C;
    case "Juvenil B":
      return REGLAMENTO_PESOS_JUVENIL_B;
    case "Juvenil A":
      return genero === "Femenino"
        ? REGLAMENTO_PESOS_JUVENIL_A_FEMENIL
        : REGLAMENTO_PESOS_JUVENIL_A_VARONIL;
    case "Junior":
    case "Adultos":
      return genero === "Femenino"
        ? REGLAMENTO_PESOS_ADULTOS_FEMENIL
        : REGLAMENTO_PESOS_ADULTOS_VARONIL;
    default:
      return [];
  }
}

function calcularCategoriaPesoGs_(division, genero, pesoKg) {
  const peso = Number(pesoKg);
  if (!isFinite(peso) || peso <= 0) return null;
  const lista = categoriasPesoParaGs_(division, genero);
  for (let i = 0; i < lista.length; i += 1) {
    if (peso < lista[i].pesoMax) return lista[i];
  }
  return lista.length ? lista[lista.length - 1] : null;
}

/**
 * Devuelve el string completo de categoría:
 *   "<División> / <Género> / <Nivel> / <Peso>"
 * Por ejemplo: "Adultos / Masculino / Avanzado / Peso Ligero"
 *
 * Se usa peso_pesaje_kg si está presente; si no, peso_referencia_kg
 * del atleta.
 */
function calcularCategoriaCompleta_(spreadsheet, inscripcion) {
  const { row: atletaRow } = findRowById_(spreadsheet, EVENTOS_TABS.atletas, inscripcion.atleta_id);
  if (!atletaRow) return "";
  const { row: eventoRow } = findRowById_(spreadsheet, EVENTOS_TABS.eventos, inscripcion.evento_id);
  if (!eventoRow) return "";

  const atleta = rowToAtleta_(atletaRow);
  const evento = rowToEvento_(eventoRow);

  const division = calcularDivisionEdadGs_(atleta.fecha_nacimiento, evento.fecha);
  if (!division) return "";

  const pesoPesaje = Number(inscripcion.peso_pesaje_kg);
  const peso = pesoPesaje > 0 ? pesoPesaje : Number(atleta.peso_referencia_kg);
  const cat = calcularCategoriaPesoGs_(division, atleta.genero, peso);
  if (!cat) return "";

  return [division, atleta.genero, atleta.nivel, cat.nombre].join(" / ");
}

/* ============================================================
 * Inscripciones — definición de campos y mappers
 * ============================================================ */

const INSCRIPCIONES_FIELDS = [
  { key: "id",                  header: "ID",                   type: "string",   system: true },
  { key: "evento_id",           header: "Evento ID",            type: "string",   required: true,  editable: false },
  { key: "atleta_id",           header: "Atleta ID",            type: "string",   required: true,  editable: false },
  { key: "peso_pesaje_kg",      header: "Peso pesaje (kg)",     type: "number",   editable: true },
  { key: "categoria_calculada", header: "Categoria calculada",  type: "string",   system: true },
  { key: "estatus",             header: "Estatus",              type: "enum",     values: ESTATUS_INSCRIPCION, system: true },
  { key: "creado_en",           header: "Creado en",            type: "datetime", system: true },
];

function rowToInscripcion_(row) {
  const out = {};
  INSCRIPCIONES_FIELDS.forEach((field) => {
    out[field.key] = normalizeOutput_(row[field.header], field.type);
  });
  return out;
}

function inscripcionToRow_(ins) {
  const row = {};
  INSCRIPCIONES_FIELDS.forEach((field) => {
    if (!(field.key in ins)) return;
    row[field.header] = normalizeInput_(ins[field.key], field.type);
  });
  return row;
}

/* ============================================================
 * Inscripciones — action handlers
 * ============================================================ */

function handleInscripcionesList_(payload) {
  requireFields_(payload, ["evento_id"]);
  const eventoId = String(payload.evento_id);
  const spreadsheet = getOrCreateEventosSpreadsheet_();

  const rows = readRows_(spreadsheet, EVENTOS_TABS.inscripciones);
  const inscripciones = rows
    .map(rowToInscripcion_)
    .filter((i) => i.evento_id === eventoId);

  // Cache atletas para enriquecer la respuesta sin N+1 queries
  const atletasRows = readRows_(spreadsheet, EVENTOS_TABS.atletas);
  const atletaById = {};
  atletasRows.forEach((r) => {
    const a = rowToAtleta_(r);
    atletaById[a.id] = a;
  });

  const enriched = inscripciones.map((ins) => {
    const a = atletaById[ins.atleta_id];
    return Object.assign({}, ins, {
      atleta: a
        ? {
            id: a.id,
            nombre_completo: a.nombre_completo,
            fecha_nacimiento: a.fecha_nacimiento,
            genero: a.genero,
            nivel: a.nivel,
            peso_referencia_kg: a.peso_referencia_kg,
            academia: a.academia,
            pais: a.pais,
            foto_url: a.foto_url,
            activo: a.activo,
          }
        : null,
    });
  });

  return { ok: true, count: enriched.length, inscripciones: enriched };
}

function handleInscripcionesCreate_(payload) {
  requireFields_(payload, ["evento_id", "atleta_ids"]);
  const eventoId = String(payload.evento_id);
  let atletaIds = payload.atleta_ids;

  // Aceptar CSV o array
  if (typeof atletaIds === "string") {
    atletaIds = atletaIds.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(atletaIds) || atletaIds.length === 0) {
    throw new Error("atleta_ids debe ser un array no vacío");
  }

  const spreadsheet = getOrCreateEventosSpreadsheet_();

  const { row: eventoRow } = findRowById_(spreadsheet, EVENTOS_TABS.eventos, eventoId);
  if (!eventoRow) throw new Error("Evento no encontrado: " + eventoId);

  // Cache atletas activos
  const atletasRows = readRows_(spreadsheet, EVENTOS_TABS.atletas);
  const atletaById = {};
  atletasRows.forEach((r) => {
    const a = rowToAtleta_(r);
    if (a.activo) atletaById[a.id] = a;
  });

  // Cache inscripciones existentes en este evento → dedup
  const existentes = readRows_(spreadsheet, EVENTOS_TABS.inscripciones)
    .map(rowToInscripcion_);
  const inscritosKey = {};
  existentes.forEach((i) => {
    if (i.evento_id === eventoId) inscritosKey[i.atleta_id] = i.id;
  });

  const created = [];
  const skipped = [];

  atletaIds.forEach((rawId) => {
    const aid = String(rawId).trim();
    if (!aid) return;
    if (!atletaById[aid]) {
      skipped.push({ atleta_id: aid, reason: "atleta no encontrado o archivado" });
      return;
    }
    if (inscritosKey[aid]) {
      skipped.push({ atleta_id: aid, reason: "ya inscrito en este evento", inscripcion_id: inscritosKey[aid] });
      return;
    }
    const id = nextId_(spreadsheet, EVENTOS_TABS.inscripciones, "ins");
    const ins = {
      id: id,
      evento_id: eventoId,
      atleta_id: aid,
      peso_pesaje_kg: "",
      categoria_calculada: "",
      estatus: "pendiente_pesaje",
      creado_en: new Date(),
    };
    // Calcula categoría usando el peso de referencia del atleta
    ins.categoria_calculada = calcularCategoriaCompleta_(spreadsheet, ins);
    appendRow_(spreadsheet, EVENTOS_TABS.inscripciones, inscripcionToRow_(ins));
    inscritosKey[aid] = id;
    created.push(ins);
  });

  return {
    ok: true,
    count_created: created.length,
    count_skipped: skipped.length,
    created: created,
    skipped: skipped,
  };
}

function handleInscripcionesSetPesoPesaje_(payload) {
  requireFields_(payload, ["id", "peso_kg"]);
  const peso = Number(payload.peso_kg);
  if (!isFinite(peso) || peso <= 0) {
    throw new Error("peso_kg debe ser > 0, recibido: " + payload.peso_kg);
  }

  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { rowIndex, row } = findRowById_(spreadsheet, EVENTOS_TABS.inscripciones, payload.id);
  if (!row) throw new Error("Inscripción no encontrada: " + payload.id);

  // 1) Escribe el peso
  const sheet = spreadsheet.getSheetByName(EVENTOS_TABS.inscripciones);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const pesoCol = headers.indexOf("Peso pesaje (kg)") + 1;
  if (pesoCol <= 0) throw new Error("Columna 'Peso pesaje (kg)' no encontrada.");
  sheet.getRange(rowIndex, pesoCol).setValue(peso);

  // 2) Recalcula la categoría con el nuevo peso
  const ins = rowToInscripcion_(row);
  ins.peso_pesaje_kg = peso;
  const nuevaCat = calcularCategoriaCompleta_(spreadsheet, ins);
  const catCol = headers.indexOf("Categoria calculada") + 1;
  if (catCol > 0) sheet.getRange(rowIndex, catCol).setValue(nuevaCat);

  // Devolver el estado actualizado
  const { row: finalRow } = findRowById_(spreadsheet, EVENTOS_TABS.inscripciones, payload.id);
  return { ok: true, inscripcion: rowToInscripcion_(finalRow) };
}

function handleInscripcionesSetEstatus_(payload) {
  requireFields_(payload, ["id", "estatus"]);
  const estatus = String(payload.estatus).toLowerCase().trim();
  if (ESTATUS_INSCRIPCION.indexOf(estatus) < 0) {
    throw new Error(
      "estatus debe ser uno de [" + ESTATUS_INSCRIPCION.join(", ") + "], recibido: " + payload.estatus,
    );
  }

  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { rowIndex, row } = findRowById_(spreadsheet, EVENTOS_TABS.inscripciones, payload.id);
  if (!row) throw new Error("Inscripción no encontrada: " + payload.id);

  const sheet = spreadsheet.getSheetByName(EVENTOS_TABS.inscripciones);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = headers.indexOf("Estatus") + 1;
  if (col <= 0) throw new Error("Columna 'Estatus' no encontrada en Inscripciones.");
  sheet.getRange(rowIndex, col).setValue(estatus);

  return { ok: true, id: payload.id, estatus: estatus };
}

function handleInscripcionesDelete_(payload) {
  requireFields_(payload, ["id"]);
  const spreadsheet = getOrCreateEventosSpreadsheet_();
  const { rowIndex, row } = findRowById_(spreadsheet, EVENTOS_TABS.inscripciones, payload.id);
  if (!row) throw new Error("Inscripción no encontrada: " + payload.id);

  const sheet = spreadsheet.getSheetByName(EVENTOS_TABS.inscripciones);
  sheet.deleteRow(rowIndex);

  return { ok: true, id: payload.id, deleted: true };
}
