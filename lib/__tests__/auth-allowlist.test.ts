import { afterEach, describe, expect, it, vi } from "vitest";

// isAllowedEmail lee process.env en cada llamada, así que se puede probar sin
// levantar Auth.js. Se importa de forma diferida para que el stub de env
// aplique.
async function loadIsAllowedEmail() {
  const mod = await import("@/lib/auth-allowlist");
  return mod.isAllowedEmail;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isAllowedEmail", () => {
  it("acepta un correo de la lista", async () => {
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", "staff@clubsamoa.com,otro@gmail.com");
    const isAllowedEmail = await loadIsAllowedEmail();
    expect(isAllowedEmail("staff@clubsamoa.com")).toBe(true);
    expect(isAllowedEmail("otro@gmail.com")).toBe(true);
  });

  it("rechaza un correo fuera de la lista", async () => {
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", "staff@clubsamoa.com");
    const isAllowedEmail = await loadIsAllowedEmail();
    expect(isAllowedEmail("intruso@gmail.com")).toBe(false);
  });

  it("ignora mayúsculas y espacios", async () => {
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", "  Staff@ClubSamoa.com , x@y.com ");
    const isAllowedEmail = await loadIsAllowedEmail();
    expect(isAllowedEmail("STAFF@clubsamoa.com")).toBe(true);
    expect(isAllowedEmail(" staff@clubsamoa.com ")).toBe(true);
  });

  it("falla cerrado: sin allowlist configurada nadie entra", async () => {
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", "");
    const isAllowedEmail = await loadIsAllowedEmail();
    expect(isAllowedEmail("staff@clubsamoa.com")).toBe(false);
  });

  it("rechaza null, undefined y cadena vacía", async () => {
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", "staff@clubsamoa.com");
    const isAllowedEmail = await loadIsAllowedEmail();
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
  });

  it("no hace coincidencia por substring (evita bypass)", async () => {
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", "staff@clubsamoa.com");
    const isAllowedEmail = await loadIsAllowedEmail();
    expect(isAllowedEmail("staff@clubsamoa.com.attacker.net")).toBe(false);
    expect(isAllowedEmail("xstaff@clubsamoa.com")).toBe(false);
  });
});
