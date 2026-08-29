// Mock local de los dos Web Apps de Apps Script, para correr los flujos de
// Playwright sin tocar ninguna Sheet. Lo levanta el webServer de
// playwright.config.ts; el servidor de Next apunta aquí vía
// APPS_SCRIPT_REGISTROS_URL / APPS_SCRIPT_EVENTOS_URL.
//
// Rutas:
//   POST /registros            → Code.gs (uniformes/exámenes): siempre { ok:true }.
//   GET  /eventos?action=...   → Eventos.gs (lecturas): listas vacías con la
//                                forma exacta que validan los esquemas Zod.
//   POST /eventos              → Eventos.gs (escrituras): { ok:true }.
//
// No implementa estado: el flujo "evento completo" corre contra una Sheet de
// pruebas real (ver e2e/evento-completo.spec.ts), no contra este mock.

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8788);

/** Última solicitud de registro recibida; /registros/__last la expone para
 *  que el spec del formulario pueda asegurar qué llegó "a la Sheet". */
let lastRegistro = null;

const LISTAS = {
  "atletas.list": { ok: true, atletas: [] },
  "eventos.list": { ok: true, eventos: [] },
  "inscripciones.list": { ok: true, inscripciones: [] },
  "brackets.list": { ok: true, brackets: [] },
  "brackets.listfull": { ok: true, brackets: [] },
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/registros" && req.method === "POST") {
    const body = await readBody(req);
    lastRegistro = Object.fromEntries(new URLSearchParams(body));
    return json(res, 200, { ok: true });
  }

  if (url.pathname === "/registros/__last") {
    return json(res, 200, lastRegistro ?? {});
  }

  if (url.pathname === "/eventos") {
    let action = url.searchParams.get("action");
    if (req.method === "POST") {
      try {
        action = JSON.parse(await readBody(req)).action ?? action;
      } catch {
        return json(res, 200, { ok: false, error: "Body inválido" });
      }
    }
    if (action === "ping") {
      return json(res, 200, { ok: true, version: "9.9.9" });
    }
    return json(res, 200, LISTAS[action] ?? { ok: true });
  }

  json(res, 404, { ok: false, error: `Ruta desconocida: ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`[apps-script-mock] escuchando en http://127.0.0.1:${PORT}`);
});
