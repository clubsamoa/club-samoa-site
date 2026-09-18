import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// Pruebas de la cola de notificaciones de
// `registration-backend/apps-script/Code.gs`.
//
// Ese archivo corre en Google Apps Script: no se puede importar ni desplegar
// desde aquí para comprobarlo, así que se evalúa en un `vm` con los
// servicios de Google sustituidos por dobles. Vive en lib/__tests__ porque
// es donde vitest busca (`vitest.config.ts`) y así queda cubierto por lint y
// prettier, que ignoran registration-backend/ a propósito.
//
// Lo que se protege: el correo de aviso NO puede ir en el camino de la
// respuesta. MailApp llega a tardar más que el timeout del cliente, y como
// la fila ya está escrita el alumno ve "no se pudo enviar", reenvía y la
// duplica (hallazgo del ensayo de N21).

const CODE_GS = fileURLToPath(
  new URL("../../registration-backend/apps-script/Code.gs", import.meta.url),
);

type Correo = { subject: string; htmlBody: string; to: string };
type Trigger = { handler: string };
type Sandbox = Record<string, unknown> & {
  doPost: (e: unknown) => { getContent: () => string };
  enviarNotificacionesPendientes: () => void;
  instalarTriggerDeNotificaciones: () => void;
  desinstalarTriggerDeNotificaciones: () => void;
  estadoDeLaColaDeNotificaciones: () => {
    trigger: boolean;
    pendientes: number;
  };
};

type Opciones = {
  triggerInstalado?: boolean;
  mailFalla?: boolean;
  lockLibre?: boolean;
};

function montar({
  triggerInstalado = true,
  mailFalla = false,
  lockLibre = true,
}: Opciones = {}) {
  const props = new Map<string, string>();
  const cache = new Map<string, string>();
  const correos: Correo[] = [];
  const filas: unknown[][] = [];
  const logs: [string, string][] = [];
  let triggers: Trigger[] = triggerInstalado
    ? [{ handler: "enviarNotificacionesPendientes" }]
    : [];
  let lockTomado = !lockLibre;

  const hoja = {
    getMaxRows: () => 100,
    appendRow: (v: unknown[]) => filas.push(v),
    getLastRow: () => filas.length + 4,
    getRange: () => ({
      setNumberFormat: () => {},
      setVerticalAlignment: () => {},
      createTextFinder: (id: string) => ({
        matchEntireCell: () => ({
          findNext: () => {
            const i = filas.findIndex((f) => f[0] === id);
            return i === -1 ? null : { getRow: () => i + 5 };
          },
        }),
      }),
    }),
  };

  const anotar =
    (nivel: string) =>
    (...partes: unknown[]) =>
      logs.push([nivel, partes.join(" ")]);

  const sandbox: Record<string, unknown> = {
    console: {
      log: anotar("log"),
      warn: anotar("warn"),
      error: anotar("error"),
    },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => hoja,
        getUrl: () => "https://sheet/doble",
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => props.set(k, v),
        deleteProperty: (k: string) => props.delete(k),
        getKeys: () => [...props.keys()],
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => cache.set(k, v),
        remove: (k: string) => cache.delete(k),
      }),
    },
    ScriptApp: {
      getProjectTriggers: () =>
        triggers.map((t) => ({ getHandlerFunction: () => t.handler, _t: t })),
      newTrigger: (handler: string) => ({
        timeBased: () => ({
          everyMinutes: () => ({ create: () => triggers.push({ handler }) }),
        }),
      }),
      deleteTrigger: (t: { _t: Trigger }) => {
        triggers = triggers.filter((x) => x !== t._t);
      },
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          if (lockTomado) return false;
          lockTomado = true;
          return true;
        },
        releaseLock: () => {
          lockTomado = false;
        },
      }),
    },
    MailApp: {
      sendEmail: (m: Correo) => {
        if (mailFalla) throw new Error("MailApp se colgó");
        correos.push(m);
      },
    },
    Utilities: {
      getUuid: () => `uuid-${props.size}-${correos.length}-${filas.length}`,
      formatDate: (d: string | Date) =>
        new Date(d).toISOString().slice(0, 16).replace("T", " "),
    },
    Session: { getScriptTimeZone: () => "America/Mexico_City" },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (txt: string) => ({
        setMimeType: () => ({ getContent: () => txt }),
      }),
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(readFileSync(CODE_GS, "utf8"), sandbox, {
    filename: "Code.gs",
  });
  props.set("CLUB_SAMOA_NOTIFICATION_EMAIL", "club@ejemplo.mx");

  const pendientes = () =>
    [...props.keys()].filter((k) => k.startsWith("CLUB_SAMOA_PENDIENTE_"));

  return {
    api: sandbox as Sandbox,
    correos,
    filas,
    logs,
    pendientes,
    triggers: () => triggers,
  };
}

function registro(submissionId: string) {
  return {
    parameter: {
      nombre: "Alumna de prueba",
      whatsapp: "833 000 0000",
      disciplina: "MMA",
      grado: "Blanca",
      fecha: "Ninguna",
      form_type: "examen",
      submission_id: submissionId,
    },
  };
}

const respuesta = (api: Sandbox, e: unknown) =>
  JSON.parse(api.doPost(e).getContent()) as {
    ok: boolean;
    duplicate: boolean;
  };

describe("Code.gs · cola de notificaciones", () => {
  it("responde sin esperar al correo y lo deja encolado", () => {
    const { api, correos, filas, pendientes } = montar();

    const res = respuesta(api, registro("a1"));

    expect(res.ok).toBe(true);
    expect(filas).toHaveLength(1);
    expect(correos).toHaveLength(0);
    expect(pendientes()).toHaveLength(1);
  });

  it("el trigger vacía la cola y manda el correo con la fecha legible", () => {
    const { api, correos, pendientes } = montar();
    respuesta(api, registro("a2"));

    api.enviarNotificacionesPendientes();

    expect(correos).toHaveLength(1);
    expect(pendientes()).toHaveLength(0);
    expect(correos[0]!.subject).toMatch(/Nuevo registro de examen/);
    // Al pasar por JSON un Date vuelve como texto ISO; si no se formatea al
    // encolar, el correo mostraría "2026-09-18T16:30:00.000Z".
    expect(correos[0]!.htmlBody).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
  });

  it("sin el trigger instalado manda en línea en vez de perder el aviso", () => {
    const { api, correos, logs, pendientes } = montar({
      triggerInstalado: false,
    });

    respuesta(api, registro("b1"));

    expect(correos).toHaveLength(1);
    expect(pendientes()).toHaveLength(0);
    expect(
      logs.some(
        ([nivel, msg]) =>
          nivel === "warn" && msg.includes("instalarTriggerDeNotificaciones"),
      ),
    ).toBe(true);
  });

  it("si MailApp truena la fila se guarda igual y se reintenta 3 veces", () => {
    const { api, filas, logs, pendientes } = montar({ mailFalla: true });

    const res = respuesta(api, registro("c1"));

    expect(res.ok).toBe(true);
    expect(filas).toHaveLength(1);

    api.enviarNotificacionesPendientes();
    api.enviarNotificacionesPendientes();
    expect(pendientes()).toHaveLength(1);

    api.enviarNotificacionesPendientes();
    expect(pendientes()).toHaveLength(0);
    expect(
      logs.some(
        ([nivel, msg]) =>
          nivel === "error" && msg.includes("se descarta tras 3"),
      ),
    ).toBe(true);
  });

  it("un reenvío duplicado no encola ni manda un segundo correo", () => {
    const { api, correos, pendientes } = montar();
    respuesta(api, registro("d1"));
    api.enviarNotificacionesPendientes();

    const res = respuesta(api, registro("d1"));

    expect(res.duplicate).toBe(true);
    expect(correos).toHaveLength(1);
    expect(pendientes()).toHaveLength(0);
  });

  it("con el lock tomado no manda nada y conserva la cola", () => {
    const { api, correos, pendientes } = montar({ lockLibre: false });
    respuesta(api, registro("e1"));

    api.enviarNotificacionesPendientes();

    expect(correos).toHaveLength(0);
    expect(pendientes()).toHaveLength(1);
  });

  it("instalar el trigger dos veces no lo duplica", () => {
    const { api, triggers } = montar({ triggerInstalado: false });

    api.instalarTriggerDeNotificaciones();
    api.instalarTriggerDeNotificaciones();

    expect(triggers()).toHaveLength(1);
    expect(api.estadoDeLaColaDeNotificaciones().trigger).toBe(true);

    api.desinstalarTriggerDeNotificaciones();
    expect(triggers()).toHaveLength(0);
  });
});
