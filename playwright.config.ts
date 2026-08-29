import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E de la migración Next (tarea N19).
//
// Dos servidores: el mock de Apps Script (e2e/apps-script-mock.mjs) y Next
// apuntando a él — ningún spec del proyecto "ci" toca una Sheet real. El
// flujo de evento completo vive en el proyecto "sheet-real" y solo corre con
// E2E_EVENTOS=1 contra una Sheet de pruebas (ver e2e/evento-completo.spec.ts).
//
// Puerto 3100 para no chocar con `npm run dev` (3000). En CI se sirve el
// build de producción; en local, el dev server (más rápido de iterar).

const PORT = 3100;
const MOCK_PORT = 8788;
// localhost, no 127.0.0.1: el dev server de Next bloquea los assets
// cross-origin y la página nunca hidrataría.
export const BASE_URL = `http://localhost:${PORT}`;

// Credencial exclusiva de e2e (hash de "samoa-e2e"). No es un secreto: solo
// existe dentro del servidor efímero que levanta esta config.
//
// Trampa de @next/env: cuando existe algún archivo .env*, dotenv-expand
// corre sobre process.env COMPLETO y "$2b$10$..." se expande como variables
// (queda truncado) — ahí el hash necesita los $ escapados como \$ (misma
// trampa que documenta .env.example). Pero sin archivos .env* — como en CI —
// la expansión NO corre y los \$ se quedan literales. Se pasa la forma que
// cada entorno necesita.
export const E2E_PASSWORD = "samoa-e2e";
const HASH_CRUDO =
  "$2b$10$F42V0OU3MXb8RR8GNWIs1OKArEh76YpOyVMXAF4.tIhIQbii03RvK";
const hayArchivoEnv = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
].some((f) => existsSync(f));
const E2E_PASSWORD_HASH = hayArchivoEnv
  ? HASH_CRUDO.replaceAll("$", "\\$")
  : HASH_CRUDO;

const realBackend = process.env.E2E_EVENTOS === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    locale: "es-MX",
  },
  projects: [
    {
      name: "ci",
      testIgnore: /evento-completo/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Escribe en la Sheet apuntada por APPS_SCRIPT_EVENTOS_URL del entorno.
      // Correr SOLO con una Sheet de pruebas: E2E_EVENTOS=1 npm run e2e
      name: "sheet-real",
      testMatch: /evento-completo/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node e2e/apps-script-mock.mjs",
      url: `http://127.0.0.1:${MOCK_PORT}/eventos?action=ping`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: process.env.CI
        ? `npm run build && npm run start -- -p ${PORT}`
        : `npm run dev -- -p ${PORT}`,
      url: BASE_URL,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        APPS_SCRIPT_REGISTROS_URL: `http://127.0.0.1:${MOCK_PORT}/registros`,
        // Con E2E_EVENTOS=1 se respeta el APPS_SCRIPT_EVENTOS_URL del
        // entorno (la Sheet de pruebas); si no, el mock.
        APPS_SCRIPT_EVENTOS_URL:
          realBackend && process.env.APPS_SCRIPT_EVENTOS_URL
            ? process.env.APPS_SCRIPT_EVENTOS_URL
            : `http://127.0.0.1:${MOCK_PORT}/eventos`,
        AUTH_SECRET: "solo-para-e2e-no-es-produccion",
        ADMIN_PASSWORD_HASH: E2E_PASSWORD_HASH,
        NEXT_PUBLIC_SITE_URL: BASE_URL,
      },
    },
  ],
});
