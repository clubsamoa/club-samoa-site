import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  _resetIntentos,
  estaBloqueado,
  hayPasswordConfigurada,
  limpiarIntentos,
  registrarFallo,
  verificarPassword,
} from "@/lib/auth-password";

// Contraseña de prueba, solo para esta suite. No es la del club.
const PASSWORD = "prueba-solo-para-tests";
const HASH = bcrypt.hashSync(PASSWORD, 10);

beforeEach(() => _resetIntentos());
afterEach(() => vi.unstubAllEnvs());

describe("verificarPassword", () => {
  it("acepta la contraseña correcta", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    await expect(verificarPassword(PASSWORD)).resolves.toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    await expect(verificarPassword("otra-cosa")).resolves.toBe(false);
  });

  it("distingue mayúsculas y espacios", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    await expect(verificarPassword(PASSWORD.toUpperCase())).resolves.toBe(
      false,
    );
    await expect(verificarPassword(` ${PASSWORD} `)).resolves.toBe(false);
  });

  it("falla cerrado: sin hash configurado nadie entra", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    await expect(verificarPassword(PASSWORD)).resolves.toBe(false);
    expect(hayPasswordConfigurada()).toBe(false);
  });

  it("un hash mal formado no deja entrar", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "esto-no-es-un-hash");
    await expect(verificarPassword(PASSWORD)).resolves.toBe(false);
    await expect(verificarPassword("")).resolves.toBe(false);
  });

  it("una contraseña vacía nunca pasa", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    await expect(verificarPassword("")).resolves.toBe(false);
  });

  it("el hash guardado no contiene la contraseña", () => {
    expect(HASH).not.toContain(PASSWORD);
    expect(HASH.startsWith("$2")).toBe(true);
  });
});

describe("límite de intentos", () => {
  it("no bloquea a una IP nueva", () => {
    expect(estaBloqueado("1.2.3.4")).toBe(false);
  });

  it("bloquea tras 8 fallos", () => {
    for (let i = 0; i < 7; i += 1) registrarFallo("1.2.3.4");
    expect(estaBloqueado("1.2.3.4")).toBe(false);
    registrarFallo("1.2.3.4");
    expect(estaBloqueado("1.2.3.4")).toBe(true);
  });

  it("el bloqueo es por IP, no global", () => {
    for (let i = 0; i < 8; i += 1) registrarFallo("1.2.3.4");
    expect(estaBloqueado("1.2.3.4")).toBe(true);
    expect(estaBloqueado("5.6.7.8")).toBe(false);
  });

  it("un acceso correcto limpia el contador", () => {
    for (let i = 0; i < 8; i += 1) registrarFallo("1.2.3.4");
    limpiarIntentos("1.2.3.4");
    expect(estaBloqueado("1.2.3.4")).toBe(false);
  });

  it("el bloqueo expira pasada la ventana", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 8; i += 1) registrarFallo("1.2.3.4");
    expect(estaBloqueado("1.2.3.4")).toBe(true);
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(estaBloqueado("1.2.3.4")).toBe(false);
    vi.useRealTimers();
  });
});
