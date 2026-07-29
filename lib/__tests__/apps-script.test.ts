import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appsScript, AppsScriptError, buildGetUrl } from "@/lib/apps-script";

const ENDPOINT = "https://script.google.com/macros/s/TEST/exec";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("APPS_SCRIPT_EVENTOS_URL", ENDPOINT);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("buildGetUrl", () => {
  it("arma la URL con action y params", () => {
    const url = buildGetUrl("atletas.get", { id: "atl_01" });
    expect(url).toBe(`${ENDPOINT}?action=atletas.get&id=atl_01`);
  });

  it("codifica acentos y espacios (nombres de atletas)", () => {
    const url = buildGetUrl("atletas.list", { q: "José Ángel Pérez" });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("q")).toBe("José Ángel Pérez");
  });

  it("omite params null/undefined", () => {
    const url = buildGetUrl("eventos.list", { estatus: undefined, id: null });
    expect(url).toBe(`${ENDPOINT}?action=eventos.list`);
  });

  it("lanza si falta la variable de entorno", () => {
    vi.stubEnv("APPS_SCRIPT_EVENTOS_URL", "");
    expect(() => buildGetUrl("ping")).toThrow(AppsScriptError);
  });
});

describe("get", () => {
  it("camino feliz: devuelve el JSON parseado", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true, atletas: [{ id: "a1" }] }));

    const data = await appsScript.get("atletas.list");
    expect(data).toEqual({ ok: true, atletas: [{ id: "a1" }] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("action=atletas.list");
    expect(init?.method).toBe("GET");
  });

  it("{ ok:false, error } del backend → AppsScriptError con ese mensaje", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ ok: false, error: "Atleta no encontrado" }),
    );
    await expect(appsScript.get("atletas.get", { id: "nope" })).rejects.toThrow(
      "Atleta no encontrado",
    );
  });

  it("respuesta HTML (página de error de Apps Script) → error con extracto", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><body>Google Apps Script error</body></html>"),
    );
    await expect(appsScript.get("ping")).rejects.toThrow(/Respuesta no JSON/);
  });

  it("HTTP 500 → AppsScriptError con status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ boom: true }, 500),
    );
    const error = (await appsScript
      .get("ping")
      .catch((e: unknown) => e)) as AppsScriptError;
    expect(error).toBeInstanceOf(AppsScriptError);
    expect(error.status).toBe(500);
  });

  it("fallo de red: reintenta una vez y luego resuelve", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(appsScript.get("ping")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("fallo de red persistente: lanza tras 2 intentos", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));
    await expect(appsScript.get("ping")).rejects.toThrow(/Error de red/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);
});

describe("post", () => {
  it("envía text/plain con el action dentro del body JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true, atleta: { id: "a1" } }));

    await appsScript.post("atletas.create", { nombre_completo: "Test" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toContain(
      "text/plain",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      action: "atletas.create",
      nombre_completo: "Test",
    });
  });

  it("NO reintenta en fallo de red (evita escrituras duplicadas)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));
    await expect(appsScript.post("atletas.create", {})).rejects.toThrow(
      /Error de red/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
