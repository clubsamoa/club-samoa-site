// Allowlist explícita de las acciones del Apps Script de Eventos MMA.
//
// El Route Handler NUNCA reenvía a Apps Script un action que no esté aquí:
// sin esta lista, /api/eventos/<cualquier-cosa> daría acceso arbitrario al
// backend. Las 27 acciones vienen del switch de Eventos.gs:264-340.
//
// Deliberadamente EXCLUIDAS:
//   - "setup": recrea encabezados de las pestañas de la Sheet. Es
//     mantenimiento destructivo; se ejecuta desde el editor de Apps Script,
//     no desde la web (ni con sesión).

export const READ_ACTIONS = [
  "ping",
  "atletas.list",
  "atletas.get",
  "eventos.list",
  "eventos.get",
  "inscripciones.list",
  "brackets.list",
  "brackets.get",
  "brackets.listfull",
  "peleas.get",
  "peleas.next",
] as const;

export const WRITE_ACTIONS = [
  "atletas.create",
  "atletas.update",
  "atletas.archive",
  "atletas.delete",
  "eventos.create",
  "eventos.update",
  "eventos.setestatus",
  "eventos.delete",
  "inscripciones.create",
  "inscripciones.setpesopesaje",
  "inscripciones.setestatus",
  "inscripciones.setcategoria",
  "inscripciones.clearcategoria",
  "inscripciones.delete",
  "brackets.confirm",
  "brackets.delete",
  "peleas.update",
  "peleas.finalize",
] as const;

/**
 * Lecturas que consumen las vistas públicas de proyección (bracket.html y
 * scoreboard-public.html en legacy). Son las únicas que se cachean en el
 * CDN: durante un evento decenas de pantallas pueden pedir la misma pelea.
 * Todo lo demás va sin caché — el admin necesita datos frescos.
 */
export const CACHEABLE_ACTIONS = ["brackets.get", "peleas.get"] as const;

export type ReadAction = (typeof READ_ACTIONS)[number];
export type WriteAction = (typeof WRITE_ACTIONS)[number];
export type Action = ReadAction | WriteAction;

const READ_SET: ReadonlySet<string> = new Set(READ_ACTIONS);
const WRITE_SET: ReadonlySet<string> = new Set(WRITE_ACTIONS);
const CACHEABLE_SET: ReadonlySet<string> = new Set(CACHEABLE_ACTIONS);

export function isReadAction(action: string): action is ReadAction {
  return READ_SET.has(action);
}

export function isWriteAction(action: string): action is WriteAction {
  return WRITE_SET.has(action);
}

export function isKnownAction(action: string): action is Action {
  return isReadAction(action) || isWriteAction(action);
}

export function isCacheableAction(action: string): boolean {
  return CACHEABLE_SET.has(action);
}
