// Mock local de los dos Web Apps de Apps Script, para correr los flujos de
// Playwright sin tocar ninguna Sheet. Lo levanta el webServer de
// playwright.config.ts; el servidor de Next apunta aquí vía
// APPS_SCRIPT_REGISTROS_URL / APPS_SCRIPT_EVENTOS_URL.
//
// Rutas:
//   POST /registros            → Code.gs (uniformes/exámenes): siempre { ok:true }.
//   GET  /eventos?action=...   → Eventos.gs (lecturas): un dataset fijo con
//                                la forma exacta que validan los esquemas Zod.
//   POST /eventos              → Eventos.gs (escrituras): { ok:true }.
//
// El dataset es de SOLO lectura (las escrituras responden ok sin mutar nada):
// el flujo "evento completo" corre contra una Sheet de pruebas real (ver
// e2e/evento-completo.spec.ts), no contra este mock.

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8788);

/** Última solicitud de registro recibida; /registros/__last la expone para
 *  que el spec del formulario pueda asegurar qué llegó "a la Sheet". */
let lastRegistro = null;

// ── Dataset fijo (N20) ─────────────────────────────────────────
// Un evento con 2 atletas aprobados, 1 bracket y 1 pelea, con las formas
// EXACTAS de lib/schemas.ts (en dev, parseOrWarn lanza ante un mismatch).
// Con esto las pantallas del admin y las vistas públicas renderizan con
// datos y la auditoría de axe (e2e/a11y.spec.ts) recorre markup real.

const atleta = (n, nombre, peso) => ({
  id: `ath_e2e_${n}`,
  nombre_completo: nombre,
  fecha_nacimiento: "2000-01-15",
  genero: "Masculino",
  anios_practica: 4,
  nivel: "Avanzado",
  peso_referencia_kg: peso,
  academia: "Mock Gym",
  pais: "México",
  foto_url: "",
  activo: true,
  creado_en: "2026-08-01T10:00:00",
});

const ATLETAS = [
  atleta(1, "Atleta Mock Uno", 70),
  atleta(2, "Atleta Mock Dos", 71),
];

const EVENTO = {
  id: "evt_e2e_001",
  nombre: "Evento Mock E2E",
  fecha: "2027-06-12",
  sede: "Sede Mock",
  estatus: "activo",
  creado_en: "2026-08-01T10:00:00",
};

const INSCRIPCIONES = ATLETAS.map((a, i) => ({
  id: `ins_e2e_00${i + 1}`,
  evento_id: EVENTO.id,
  atleta_id: a.id,
  peso_pesaje_kg: a.peso_referencia_kg,
  categoria_calculada: "Adultos / Masculino / Avanzado / Peso Ligero",
  estatus: "aprobado",
  creado_en: "2026-08-02T10:00:00",
  categoria_override: false,
  atleta: a,
}));

const PELEA = {
  id: "pel_e2e_001",
  bracket_id: "brk_e2e_001",
  ronda: "Final",
  numero_pelea: 1,
  atleta1_id: ATLETAS[0].id,
  atleta2_id: ATLETAS[1].id,
  ganador_id: "",
  metodo_finalizacion: "",
  round_finalizacion: null,
  tiempo_finalizacion: "",
  notas: "",
  actualizado_en: "",
  ronda_idx: 0,
  numero_en_ronda: 1,
  bye: false,
  auto_ganador_id: "",
  pelea_anterior_1: null,
  pelea_anterior_2: null,
  atleta1: ATLETAS[0],
  atleta2: ATLETAS[1],
  ganador: null,
  bracket: {
    id: "brk_e2e_001",
    categoria: "Adultos / Masculino / Avanzado / Peso Ligero",
    tipo_bracket: "single_elimination",
    evento_id: EVENTO.id,
  },
};

const BRACKET = {
  id: "brk_e2e_001",
  evento_id: EVENTO.id,
  categoria: "Adultos / Masculino / Avanzado / Peso Ligero",
  tipo_bracket: "single_elimination",
  num_atletas: 2,
  estatus: "confirmado",
  json_estructura: "{}",
  creado_en: "2026-08-03T10:00:00",
  peleas: [PELEA],
};

const LISTAS = {
  "atletas.list": { ok: true, atletas: ATLETAS },
  "eventos.list": { ok: true, eventos: [EVENTO] },
  "inscripciones.list": { ok: true, inscripciones: INSCRIPCIONES },
  "brackets.list": { ok: true, brackets: [BRACKET] },
  "brackets.listfull": { ok: true, brackets: [BRACKET] },
  "eventos.get": { ok: true, evento: EVENTO },
  "atletas.get": { ok: true, atleta: ATLETAS[0] },
  "brackets.get": { ok: true, bracket: BRACKET },
  "peleas.get": { ok: true, pelea: PELEA },
  "peleas.next": { ok: true, pelea_id: "" },
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
