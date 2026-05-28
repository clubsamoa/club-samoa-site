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
  version: "0.1.0",
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
 * Router central. En esta tarea (01) solo expone ping/setup.
 * Las acciones de atletas/eventos/etc. se agregan en tareas posteriores.
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
