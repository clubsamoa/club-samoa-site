// Cliente server-side del Apps Script de Eventos MMA.
// Puerto de legacy/admin/js/api.js SIN el spinner ni el contador de requests
// en vuelo (eso pasa a TanStack Query en N12). Solo corre en el servidor:
// el navegador habla con /api/eventos/* (N10), nunca con Apps Script.
//
// Cambios respecto al original:
//   - Timeout de 20 s + 1 reintento con backoff ante error de red o timeout
//     (Apps Script tiene cold starts de varios segundos).
//   - AppsScriptError como clase (el original usaba constructor-función por
//     compatibilidad con navegadores viejos, api.js:49-59).
// Se conserva:
//   - GET con action + params en query string.
//   - POST con Content-Type text/plain y el action dentro del body JSON
//     (así lo parsea readPayload_ en Eventos.gs; ya no es por CORS).
//   - El mapeo de errores de api.js:179-213: respuesta no-JSON → error con
//     los primeros 200 chars; { ok:false, error } → error del backend.

export class AppsScriptError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status = 0, payload: unknown = null) {
    super(message);
    this.name = "AppsScriptError";
    this.status = status;
    this.payload = payload;
  }
}

const TIMEOUT_MS = 20_000;
const RETRY_BACKOFF_MS = 1_500;

function getEndpoint(): string {
  const url = process.env.APPS_SCRIPT_EVENTOS_URL;
  if (!url) {
    throw new AppsScriptError(
      "APPS_SCRIPT_EVENTOS_URL no está definido. Revisa las variables de entorno.",
      0,
    );
  }
  return url;
}

export type ActionParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export function buildGetUrl(action: string, params?: ActionParams): string {
  const endpoint = getEndpoint();
  const qs = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    qs.set(key, String(value));
  }
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${qs.toString()}`;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retry }: { retry: boolean },
): Promise<Response> {
  // Solo los GET se reintentan: un POST cuyo response se perdió pudo haber
  // llegado al backend — reintentarlo duplicaría la escritura (Eventos.gs
  // no deduplica sus actions, a diferencia del backend de registros).
  const attempts = retry ? 2 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(url, {
        ...init,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
      }
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : "desconocido";
  throw new AppsScriptError(`Error de red: ${message}`, 0);
}

async function handleResponse(
  response: Response,
  action: string,
): Promise<unknown> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    throw new AppsScriptError(
      "No se pudo leer la respuesta del servidor",
      response.status,
    );
  }

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new AppsScriptError(
      `Respuesta no JSON desde el backend (action='${action}'): ${text.slice(0, 200)}`,
      response.status,
      { rawBody: text },
    );
  }

  if (!response.ok) {
    throw new AppsScriptError(
      `HTTP ${response.status} en action='${action}'`,
      response.status,
      data,
    );
  }

  // Errores controlados del backend: { ok: false, error: "..." } con 200.
  if (
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    (data as { ok: unknown }).ok === false
  ) {
    const backendError = (data as { error?: unknown }).error;
    throw new AppsScriptError(
      typeof backendError === "string"
        ? backendError
        : "Error desconocido del backend",
      response.status,
      data,
    );
  }

  return data;
}

export async function get(
  action: string,
  params?: ActionParams,
): Promise<unknown> {
  if (!action) throw new AppsScriptError("get: action es requerido", 0);
  const response = await fetchWithRetry(
    buildGetUrl(action, params),
    { method: "GET" },
    { retry: true },
  );
  return handleResponse(response, action);
}

export async function post(
  action: string,
  payload?: Record<string, unknown>,
): Promise<unknown> {
  if (!action) throw new AppsScriptError("post: action es requerido", 0);
  const body = JSON.stringify({ action, ...(payload ?? {}) });
  const response = await fetchWithRetry(
    getEndpoint(),
    {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    },
    { retry: false },
  );
  return handleResponse(response, action);
}

export const appsScript = { get, post };
