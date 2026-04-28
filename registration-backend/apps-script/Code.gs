const CLUB_SAMOA = {
  uniformesProperty: "CLUB_SAMOA_UNIFORMES_SPREADSHEET_ID",
  examenesProperty: "CLUB_SAMOA_EXAMENES_SPREADSHEET_ID",
  notificationEmailProperty: "CLUB_SAMOA_NOTIFICATION_EMAIL",
  fromName: "Club Samoa Registros",
};

const UNIFORMES_HEADERS = [
  "ID",
  "Fecha de registro",
  "Estado",
  "Nombre del alumno",
  "WhatsApp",
  "Disciplina",
  "Producto",
  "Talla",
  "Cantidad",
  "Notas",
  "Pagina",
  "User agent",
];

const EXAMENES_HEADERS = [
  "ID",
  "Fecha de registro",
  "Estado",
  "Nombre del alumno",
  "WhatsApp",
  "Disciplina",
  "Grado actual",
  "Proximo examen",
  "Observaciones",
  "Pagina",
  "User agent",
];

const UNIFORMES_STATUS = ["Nuevo", "Contactado", "Pedido confirmado", "Entregado", "Cancelado"];
const EXAMENES_STATUS = ["Nuevo", "Validado", "Pago pendiente", "Pago recibido", "Aprobado para examen", "Cancelado"];
const DISCIPLINAS_UNIFORMES = ["Lima Lama Kids", "Kickboxing", "Muay Thai", "MMA", "Jiu Jitsu", "Otra"];
const PRODUCTOS = ["Uniforme completo", "Playera", "Short", "Cinturon", "Guantes", "Otro"];
const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "Infantil 4", "Infantil 6", "Infantil 8", "Infantil 10", "Otra"];
const DISCIPLINAS_EXAMENES = ["Lima Lama", "Kickboxing"];
const GRADOS = [
  "Cinta Naranja",
  "Cinta Morada",
  "Cinta Azul",
  "Cinta Verde",
  "Cinta Cafe I",
  "Cinta Cafe II",
  "Cinta Cafe III",
  "Cinta Negra",
  "Kickboxing - Principiante",
  "Kickboxing - Intermedio",
  "Kickboxing - Avanzado",
];
const FECHAS_EXAMEN = [
  "Marzo",
  "Abril (Kickboxing)",
  "Junio",
  "Agosto (Kickboxing)",
  "Septiembre",
  "Diciembre",
  "Diciembre (Kickboxing)",
  "Ninguna",
];

function setupClubSamoaRegistros() {
  const properties = PropertiesService.getScriptProperties();
  const notificationEmail =
    properties.getProperty(CLUB_SAMOA.notificationEmailProperty) ||
    Session.getEffectiveUser().getEmail() ||
    "";

  const uniformes = getOrCreateSpreadsheet_(
    CLUB_SAMOA.uniformesProperty,
    "Club Samoa - Registro de Uniformes",
    setupUniformesWorkbook_,
  );
  const examenes = getOrCreateSpreadsheet_(
    CLUB_SAMOA.examenesProperty,
    "Club Samoa - Registro de Examenes",
    setupExamenesWorkbook_,
  );

  if (notificationEmail) {
    properties.setProperty(CLUB_SAMOA.notificationEmailProperty, notificationEmail);
  }

  Logger.log(
    JSON.stringify(
      {
        uniformesUrl: uniformes.getUrl(),
        examenesUrl: examenes.getUrl(),
        notificationEmail,
      },
      null,
      2,
    ),
  );
}

function configureNotificationEmail(email) {
  PropertiesService.getScriptProperties().setProperty(
    CLUB_SAMOA.notificationEmailProperty,
    String(email || "").trim(),
  );
}

function doGet() {
  return json_({
    ok: true,
    service: "Club Samoa registration backend",
    forms: ["uniformes", "examenes"],
  });
}

function doPost(e) {
  try {
    const payload = readPayload_(e);
    const formType = normalizeFormType_(payload.form_type || payload.formType || payload.tipo || payload.type);
    const saved = formType === "uniformes" ? saveUniformes_(payload) : saveExamenes_(payload);

    if (!saved.duplicate) {
      sendNotification_(formType, saved.rowValues, saved.spreadsheetUrl);
    }

    return json_({
      ok: true,
      duplicate: saved.duplicate,
      row: saved.row,
      spreadsheetUrl: saved.spreadsheetUrl,
    });
  } catch (error) {
    return json_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function saveUniformes_(payload) {
  requireFields_(payload, ["nombre", "whatsapp", "disciplina", "producto", "talla", "cantidad"]);
  const spreadsheet = getSpreadsheetFromProperty_(CLUB_SAMOA.uniformesProperty);
  const sheet = spreadsheet.getSheetByName("Registro");
  const id = value_(payload, "submission_id") || Utilities.getUuid();
  const duplicate = findSubmission_(sheet, id);
  const quantity = Math.max(1, Number(value_(payload, "cantidad")) || 1);

  const rowValues = [
    id,
    new Date(),
    "Nuevo",
    value_(payload, "nombre"),
    value_(payload, "whatsapp"),
    value_(payload, "disciplina"),
    value_(payload, "producto"),
    value_(payload, "talla"),
    quantity,
    value_(payload, "notas"),
    value_(payload, "page_url"),
    value_(payload, "user_agent"),
  ];

  if (duplicate) {
    return {
      duplicate: true,
      row: duplicate.getRow(),
      rowValues,
      spreadsheetUrl: spreadsheet.getUrl(),
    };
  }

  sheet.appendRow(rowValues);
  const row = sheet.getLastRow();
  sheet.getRange(row, 2).setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange(row, 1, 1, rowValues.length).setVerticalAlignment("middle");
  return { duplicate: false, row, rowValues, spreadsheetUrl: spreadsheet.getUrl() };
}

function saveExamenes_(payload) {
  requireFields_(payload, ["nombre", "whatsapp", "disciplina", "grado", "fecha"]);
  const spreadsheet = getSpreadsheetFromProperty_(CLUB_SAMOA.examenesProperty);
  const sheet = spreadsheet.getSheetByName("Registro");
  const id = value_(payload, "submission_id") || Utilities.getUuid();
  const duplicate = findSubmission_(sheet, id);

  const rowValues = [
    id,
    new Date(),
    "Nuevo",
    value_(payload, "nombre"),
    value_(payload, "whatsapp"),
    value_(payload, "disciplina"),
    value_(payload, "grado"),
    value_(payload, "fecha"),
    value_(payload, "notas"),
    value_(payload, "page_url"),
    value_(payload, "user_agent"),
  ];

  if (duplicate) {
    return {
      duplicate: true,
      row: duplicate.getRow(),
      rowValues,
      spreadsheetUrl: spreadsheet.getUrl(),
    };
  }

  sheet.appendRow(rowValues);
  const row = sheet.getLastRow();
  sheet.getRange(row, 2).setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange(row, 1, 1, rowValues.length).setVerticalAlignment("middle");
  return { duplicate: false, row, rowValues, spreadsheetUrl: spreadsheet.getUrl() };
}

function setupUniformesWorkbook_(spreadsheet) {
  const registro = resetSheet_(spreadsheet, "Registro");
  setupRegistroSheet_(registro, {
    title: "Club Samoa - Registro de Uniformes",
    subtitle: "Base de datos operativa para pedidos, seguimiento, pagos y entrega de uniformes.",
    headers: UNIFORMES_HEADERS,
    widths: [130, 150, 150, 220, 130, 150, 160, 105, 90, 280, 220, 260],
    statusValues: UNIFORMES_STATUS,
    validations: [
      { col: 3, values: UNIFORMES_STATUS },
      { col: 6, values: DISCIPLINAS_UNIFORMES },
      { col: 7, values: PRODUCTOS },
      { col: 8, values: TALLAS },
    ],
  });

  const resumen = resetSheet_(spreadsheet, "Resumen");
  setupResumenUniformes_(resumen);

  const catalogos = resetSheet_(spreadsheet, "Catalogos");
  setupCatalogos_(catalogos, "Catalogos - Uniformes", [
    ["Estados", UNIFORMES_STATUS],
    ["Disciplinas", DISCIPLINAS_UNIFORMES],
    ["Productos", PRODUCTOS],
    ["Tallas", TALLAS],
  ]);
  deleteExtraSheets_(spreadsheet, ["Registro", "Resumen", "Catalogos"]);
}

function setupExamenesWorkbook_(spreadsheet) {
  const registro = resetSheet_(spreadsheet, "Registro");
  setupRegistroSheet_(registro, {
    title: "Club Samoa - Registro de Examenes",
    subtitle: "Base de datos operativa para examenes de cambio de grado, validacion y seguimiento.",
    headers: EXAMENES_HEADERS,
    widths: [130, 150, 155, 230, 130, 145, 160, 180, 300, 220, 260],
    statusValues: EXAMENES_STATUS,
    validations: [
      { col: 3, values: EXAMENES_STATUS },
      { col: 6, values: DISCIPLINAS_EXAMENES },
      { col: 7, values: GRADOS },
      { col: 8, values: FECHAS_EXAMEN },
    ],
  });

  const resumen = resetSheet_(spreadsheet, "Resumen");
  setupResumenExamenes_(resumen);

  const catalogos = resetSheet_(spreadsheet, "Catalogos");
  setupCatalogos_(catalogos, "Catalogos - Examenes", [
    ["Estados", EXAMENES_STATUS],
    ["Disciplinas", DISCIPLINAS_EXAMENES],
    ["Grados", GRADOS],
    ["Fechas", FECHAS_EXAMEN],
  ]);
  deleteExtraSheets_(spreadsheet, ["Registro", "Resumen", "Catalogos"]);
}

function setupRegistroSheet_(sheet, config) {
  const totalCols = config.headers.length;
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(4);
  sheet.setFrozenColumns(4);
  sheet.getRange(1, 1, 1, totalCols).merge();
  sheet.getRange(1, 1).setValue(config.title);
  sheet.getRange(2, 1, 1, totalCols).merge();
  sheet.getRange(2, 1).setValue(config.subtitle);
  sheet.getRange(1, 1, 1, totalCols)
    .setBackground("#111111")
    .setFontColor("#f7f2f1")
    .setFontWeight("bold")
    .setFontSize(22)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.getRange(2, 1, 1, totalCols)
    .setBackground("#24211f")
    .setFontColor("#f7f2f1")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeights(1, 1, 46);
  sheet.setRowHeights(2, 1, 30);
  sheet.getRange(4, 1, 1, totalCols).setValues([config.headers]);
  sheet.getRange(4, 1, 1, totalCols)
    .setBackground("#7f0000")
    .setFontColor("#f7f2f1")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sheet.setRowHeights(4, 1, 36);
  sheet.getRange(5, 1, 996, totalCols)
    .setBackground("#ffffff")
    .setFontColor("#111111")
    .setVerticalAlignment("middle")
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, "#d8d0cc", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(5, 2, 996, 1).setNumberFormat("yyyy-mm-dd hh:mm");

  config.widths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });

  config.validations.forEach((validation) => {
    sheet.getRange(5, validation.col, 996, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(validation.values, true)
        .setAllowInvalid(false)
        .build(),
    );
  });

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(4, 1, 997, totalCols).createFilter();
  applyStatusFormatting_(sheet.getRange(5, 3, 996, 1));
}

function setupResumenUniformes_(sheet) {
  setupSummaryTitle_(sheet, "Resumen - Uniformes", "Vista rapida para controlar pedidos abiertos, piezas solicitadas y entregas.");
  setSummaryWidths_(sheet);
  setKpis_(sheet, [
    ["A4", "B4", "Total registros", '=COUNTA(Registro!A5:A)', "#f3eeec"],
    ["D4", "E4", "Nuevos", '=COUNTIF(Registro!C5:C,"Nuevo")', "#fff2cc"],
    ["G4", "H4", "Piezas", '=SUM(Registro!I5:I)', "#d9eaf7"],
    ["A7", "B7", "Entregados", '=COUNTIF(Registro!C5:C,"Entregado")', "#d9ead3"],
    ["D7", "E7", "Cancelados", '=COUNTIF(Registro!C5:C,"Cancelado")', "#f4cccc"],
    ["G7", "H7", "Pendientes", '=B4-B7-E7', "#f3eeec"],
  ]);
  setMiniTable_(sheet, "A10:B15", [["Estado", "Registros"], ["Nuevo", '=COUNTIF(Registro!C5:C,A11)'], ["Contactado", '=COUNTIF(Registro!C5:C,A12)'], ["Pedido confirmado", '=COUNTIF(Registro!C5:C,A13)'], ["Entregado", '=COUNTIF(Registro!C5:C,A14)'], ["Cancelado", '=COUNTIF(Registro!C5:C,A15)']]);
  setMiniTable_(sheet, "D10:E16", [["Producto", "Piezas"], ["Uniforme completo", '=SUMIF(Registro!G5:G,D11,Registro!I5:I)'], ["Playera", '=SUMIF(Registro!G5:G,D12,Registro!I5:I)'], ["Short", '=SUMIF(Registro!G5:G,D13,Registro!I5:I)'], ["Cinturon", '=SUMIF(Registro!G5:G,D14,Registro!I5:I)'], ["Guantes", '=SUMIF(Registro!G5:G,D15,Registro!I5:I)'], ["Otro", '=SUMIF(Registro!G5:G,D16,Registro!I5:I)']]);
}

function setupResumenExamenes_(sheet) {
  setupSummaryTitle_(sheet, "Resumen - Examenes", "Vista rapida para validar registros, pagos y alumnos listos para examen.");
  setSummaryWidths_(sheet);
  setKpis_(sheet, [
    ["A4", "B4", "Total registros", '=COUNTA(Registro!A5:A)', "#f3eeec"],
    ["D4", "E4", "Nuevos", '=COUNTIF(Registro!C5:C,"Nuevo")', "#fff2cc"],
    ["G4", "H4", "Aprobados", '=COUNTIF(Registro!C5:C,"Aprobado para examen")', "#d9ead3"],
    ["A7", "B7", "Pago pendiente", '=COUNTIF(Registro!C5:C,"Pago pendiente")', "#f4cccc"],
    ["D7", "E7", "Pago recibido", '=COUNTIF(Registro!C5:C,"Pago recibido")', "#d9eaf7"],
    ["G7", "H7", "Cancelados", '=COUNTIF(Registro!C5:C,"Cancelado")', "#f3eeec"],
  ]);
  setMiniTable_(sheet, "A10:B16", [["Estado", "Registros"], ["Nuevo", '=COUNTIF(Registro!C5:C,A11)'], ["Validado", '=COUNTIF(Registro!C5:C,A12)'], ["Pago pendiente", '=COUNTIF(Registro!C5:C,A13)'], ["Pago recibido", '=COUNTIF(Registro!C5:C,A14)'], ["Aprobado para examen", '=COUNTIF(Registro!C5:C,A15)'], ["Cancelado", '=COUNTIF(Registro!C5:C,A16)']]);
  setMiniTable_(sheet, "D10:E18", [["Proximo examen", "Registros"], ["Marzo", '=COUNTIF(Registro!H5:H,D11)'], ["Abril (Kickboxing)", '=COUNTIF(Registro!H5:H,D12)'], ["Junio", '=COUNTIF(Registro!H5:H,D13)'], ["Agosto (Kickboxing)", '=COUNTIF(Registro!H5:H,D14)'], ["Septiembre", '=COUNTIF(Registro!H5:H,D15)'], ["Diciembre", '=COUNTIF(Registro!H5:H,D16)'], ["Diciembre (Kickboxing)", '=COUNTIF(Registro!H5:H,D17)'], ["Ninguna", '=COUNTIF(Registro!H5:H,D18)']]);
}

function setupSummaryTitle_(sheet, title, subtitle) {
  sheet.setHiddenGridlines(true);
  sheet.getRange("A1:H1").merge().setValue(title);
  sheet.getRange("A2:H2").merge().setValue(subtitle);
  sheet.getRange("A1:H1")
    .setBackground("#111111")
    .setFontColor("#f7f2f1")
    .setFontWeight("bold")
    .setFontSize(22)
    .setHorizontalAlignment("center");
  sheet.getRange("A2:H2")
    .setBackground("#24211f")
    .setFontColor("#f7f2f1")
    .setFontSize(11)
    .setHorizontalAlignment("center");
  sheet.setRowHeight(1, 46);
  sheet.setRowHeight(2, 30);
}

function setSummaryWidths_(sheet) {
  [180, 150, 40, 190, 150, 40, 190, 150].forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });
}

function setKpis_(sheet, cards) {
  cards.forEach((card) => {
    const label = sheet.getRange(card[0]);
    const value = sheet.getRange(card[1]);
    label.setValue(card[2]);
    value.setFormula(card[3]);
    label.setBackground(card[4]).setFontColor("#6e6661").setFontWeight("bold").setHorizontalAlignment("center");
    value.setBackground(card[4]).setFontColor("#111111").setFontWeight("bold").setFontSize(20).setHorizontalAlignment("center");
    label.setBorder(true, true, true, true, false, false, "#d8d0cc", SpreadsheetApp.BorderStyle.SOLID);
    value.setBorder(true, true, true, true, false, false, "#d8d0cc", SpreadsheetApp.BorderStyle.SOLID);
  });
}

function setMiniTable_(sheet, rangeA1, rows) {
  const range = sheet.getRange(rangeA1);
  range.setValues(rows);
  range.setBorder(true, true, true, true, true, true, "#d8d0cc", SpreadsheetApp.BorderStyle.SOLID);
  range.setFontColor("#111111").setFontSize(10);
  sheet.getRange(range.getRow(), range.getColumn(), 1, range.getNumColumns())
    .setBackground("#7f0000")
    .setFontColor("#f7f2f1")
    .setFontWeight("bold");
}

function setupCatalogos_(sheet, title, lists) {
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1, 1, Math.max(4, lists.length)).merge().setValue(title);
  sheet.getRange(1, 1)
    .setBackground("#111111")
    .setFontColor("#f7f2f1")
    .setFontWeight("bold")
    .setFontSize(18)
    .setHorizontalAlignment("center");
  sheet.setRowHeight(1, 40);

  lists.forEach((entry, index) => {
    const col = index + 1;
    sheet.setColumnWidth(col, 210);
    sheet.getRange(3, col).setValue(entry[0])
      .setBackground("#7f0000")
      .setFontColor("#f7f2f1")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    const values = entry[1].map((item) => [item]);
    sheet.getRange(4, col, values.length, 1)
      .setValues(values)
      .setBackground("#ffffff")
      .setFontColor("#111111")
      .setBorder(true, true, true, true, true, true, "#d8d0cc", SpreadsheetApp.BorderStyle.SOLID);
  });
}

function applyStatusFormatting_(range) {
  const rules = [
    { text: "Nuevo", background: "#fff2cc", color: "#7a4a00" },
    { text: "Pedido confirmado", background: "#d9eaf7", color: "#134f5c" },
    { text: "Pago recibido", background: "#d9eaf7", color: "#134f5c" },
    { text: "Entregado", background: "#d9ead3", color: "#274e13" },
    { text: "Aprobado para examen", background: "#d9ead3", color: "#274e13" },
    { text: "Cancelado", background: "#f4cccc", color: "#990000" },
  ].map((rule) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains(rule.text)
      .setBackground(rule.background)
      .setFontColor(rule.color)
      .setBold(true)
      .setRanges([range])
      .build(),
  );
  range.getSheet().setConditionalFormatRules(rules);
}

function resetSheet_(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.clear({ contentsOnly: false });
  sheet.setConditionalFormatRules([]);
  return sheet;
}

function deleteExtraSheets_(spreadsheet, keepNames) {
  const keep = {};
  keepNames.forEach((name) => {
    keep[name] = true;
  });
  spreadsheet.getSheets().forEach((sheet) => {
    if (!keep[sheet.getName()] && spreadsheet.getSheets().length > 1) {
      spreadsheet.deleteSheet(sheet);
    }
  });
}

function getOrCreateSpreadsheet_(propertyName, spreadsheetName, setupFn) {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty(propertyName);
  let spreadsheet;
  if (id) {
    spreadsheet = SpreadsheetApp.openById(id);
  } else {
    spreadsheet = SpreadsheetApp.create(spreadsheetName);
    properties.setProperty(propertyName, spreadsheet.getId());
  }
  setupFn(spreadsheet);
  return spreadsheet;
}

function getSpreadsheetFromProperty_(propertyName) {
  const id = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!id) {
    throw new Error("Run setupClubSamoaRegistros() before connecting the website.");
  }
  return SpreadsheetApp.openById(id);
}

function readPayload_(e) {
  const payload = {};
  Object.keys((e && e.parameter) || {}).forEach((key) => {
    payload[key] = e.parameter[key];
  });

  const body = e && e.postData && e.postData.contents ? e.postData.contents : "";
  if (body && body.trim().charAt(0) === "{") {
    const parsed = JSON.parse(body);
    Object.keys(parsed).forEach((key) => {
      payload[key] = parsed[key];
    });
  }

  return payload;
}

function normalizeFormType_(type) {
  const normalized = String(type || "").toLowerCase().trim();
  if (normalized === "uniforme" || normalized === "uniformes") {
    return "uniformes";
  }
  if (normalized === "examen" || normalized === "examenes" || normalized === "exámenes") {
    return "examenes";
  }
  throw new Error("Tipo de formulario no reconocido.");
}

function requireFields_(payload, fields) {
  const missing = fields.filter((field) => !value_(payload, field));
  if (missing.length) {
    throw new Error("Faltan campos requeridos: " + missing.join(", "));
  }
}

function value_(payload, key) {
  return String(payload[key] || "").trim();
}

function findSubmission_(sheet, id) {
  return sheet
    .getRange(5, 1, Math.max(sheet.getMaxRows() - 4, 1), 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findNext();
}

function sendNotification_(formType, rowValues, spreadsheetUrl) {
  const email = PropertiesService.getScriptProperties().getProperty(CLUB_SAMOA.notificationEmailProperty);
  if (!email) {
    return;
  }

  const labels = formType === "uniformes" ? UNIFORMES_HEADERS : EXAMENES_HEADERS;
  const title = formType === "uniformes" ? "Nuevo pedido de uniforme" : "Nuevo registro de examen";
  const rows = labels
    .map((label, index) => {
      const rawValue = rowValues[index];
      const value = rawValue instanceof Date ? Utilities.formatDate(rawValue, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : rawValue;
      return `<tr><th style="text-align:left;padding:8px 10px;background:#f3eeec;border:1px solid #d8d0cc;">${escapeHtml_(label)}</th><td style="padding:8px 10px;border:1px solid #d8d0cc;">${escapeHtml_(value)}</td></tr>`;
    })
    .join("");

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#111111;">
      <h2 style="margin:0 0 12px;">${escapeHtml_(title)}</h2>
      <table style="border-collapse:collapse;margin:0 0 16px;">${rows}</table>
      <p><a href="${spreadsheetUrl}">Abrir base de datos</a></p>
    </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: `${title} - Club Samoa`,
    body: `${title}\n\nAbrir base de datos: ${spreadsheetUrl}`,
    htmlBody,
    name: CLUB_SAMOA.fromName,
  });
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
