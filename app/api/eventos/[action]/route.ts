import { NextResponse } from "next/server";
import {
  appsScript,
  AppsScriptError,
  type ActionParams,
} from "@/lib/apps-script";
import {
  isCacheableAction,
  isKnownAction,
  isReadAction,
  isWriteAction,
} from "@/lib/actions-allowlist";
import { auth } from "@/lib/auth";
import { isAllowedEmail } from "@/lib/auth-allowlist";

// Proxy hacia el Apps Script de Eventos MMA.
//
// El navegador habla SOLO con esta ruta; la URL de Apps Script vive en una
// variable de entorno del servidor y nunca llega al cliente. Además:
//   - permite exigir sesión antes de proxyear una escritura (N11)
//   - permite cachear las lecturas de las vistas públicas de proyección
//   - elimina el hack de Content-Type text/plain del lado del navegador
//
// Rutas:
//   GET  /api/eventos/atletas.list?activo=true
//   POST /api/eventos/peleas.update      (payload en el body JSON)

const CACHE_HEADER = "public, s-maxage=15, stale-while-revalidate=30";

function errorResponse(error: unknown, action: string) {
  if (error instanceof AppsScriptError) {
    // Mapeo del status del backend al de nuestra API:
    //   0        → fallo de red o timeout hablando con Apps Script: 504.
    //   200      → error controlado del backend ({ ok:false, error }), casi
    //              siempre validación ("Faltan campos requeridos: id"). Es
    //              culpa de quien llama, no del gateway: 400.
    //   >= 400   → se propaga tal cual.
    const status =
      error.status === 0 ? 504 : error.status >= 400 ? error.status : 400;
    return NextResponse.json(
      { ok: false, error: error.message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error(`[api/eventos] error inesperado en '${action}':`, error);
  return NextResponse.json(
    { ok: false, error: "Error inesperado del servidor." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;

  if (!isKnownAction(action)) {
    return NextResponse.json(
      { ok: false, error: `Acción desconocida: '${action}'` },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (isWriteAction(action)) {
    return NextResponse.json(
      { ok: false, error: `'${action}' requiere POST` },
      { status: 405, headers: { "Cache-Control": "no-store" } },
    );
  }

  const params: ActionParams = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    params[key] = value;
  }

  try {
    const data = await appsScript.get(action, params);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": isCacheableAction(action) ? CACHE_HEADER : "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, action);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;

  if (!isKnownAction(action)) {
    return NextResponse.json(
      { ok: false, error: `Acción desconocida: '${action}'` },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (isReadAction(action)) {
    return NextResponse.json(
      { ok: false, error: `'${action}' es de lectura; usa GET` },
      { status: 405, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Toda escritura exige sesión. Esta comprobación NO es redundante con el
  // middleware: el middleware protege páginas, y esta API es alcanzable
  // directamente con curl. Sin esto, el admin queda escribible sin login.
  const session = await auth();
  if (!isAllowedEmail(session?.user?.email)) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    const body = await request.text();
    if (body) payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // El action va en la URL; ignoramos cualquier "action" del body para que
  // no pueda contradecir la ruta ya validada.
  delete payload.action;

  try {
    const data = await appsScript.post(action, payload);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, action);
  }
}
