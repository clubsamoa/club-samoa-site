// Cliente del navegador contra /api/eventos/*.
//
// Misma firma que el `api` global de legacy/admin/js/api.js — api.get(action,
// params) / api.post(action, payload) — para que el puerto de los módulos del
// admin (N13-N18) sea mecánico. Diferencias:
//   - Habla con nuestra API, no con Apps Script (sin CORS, sin endpoint
//     expuesto).
//   - Sin spinner ni contador de requests: eso lo maneja TanStack Query en
//     N12.
//   - Tipado por action vía la allowlist compartida.

import type { ReadAction, WriteAction } from "@/lib/actions-allowlist";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ApiParams = Record<
  string,
  string | number | boolean | null | undefined
>;

async function parse(response: Response, action: string): Promise<unknown> {
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(
      `Respuesta no JSON en '${action}': ${text.slice(0, 200)}`,
      response.status,
    );
  }

  const errorMessage =
    typeof data === "object" && data !== null && "error" in data
      ? String((data as { error: unknown }).error)
      : null;

  if (!response.ok) {
    throw new ApiError(
      errorMessage ?? `HTTP ${response.status} en '${action}'`,
      response.status,
    );
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    (data as { ok: unknown }).ok === false
  ) {
    throw new ApiError(
      errorMessage ?? "Error desconocido del backend",
      response.status,
    );
  }

  return data;
}

export async function get(
  action: ReadAction,
  params?: ApiParams,
): Promise<unknown> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    qs.set(key, String(value));
  }
  const query = qs.toString();
  const url = `/api/eventos/${action}${query ? `?${query}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new ApiError(
      `Error de red: ${error instanceof Error ? error.message : "desconocido"}`,
      0,
    );
  }
  return parse(response, action);
}

export async function post(
  action: WriteAction,
  payload?: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/eventos/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
  } catch (error) {
    throw new ApiError(
      `Error de red: ${error instanceof Error ? error.message : "desconocido"}`,
      0,
    );
  }
  return parse(response, action);
}

export const api = { get, post };
