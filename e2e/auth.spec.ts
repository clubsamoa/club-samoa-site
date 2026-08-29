import { test, expect } from "@playwright/test";
import { E2E_PASSWORD } from "../playwright.config";

// Flujo 3 (N19): auth del admin. El servidor de pruebas arranca con un
// ADMIN_PASSWORD_HASH propio (hash de E2E_PASSWORD), así que el login es el
// real de Auth.js, no un mock del navegador. No toca ninguna Sheet: el admin
// lee del mock, que devuelve listas vacías.

import type { Page } from "@playwright/test";

/** Llena la contraseña reintentando: si el fill llega antes de que React
 *  hidrate, el estado queda vacío y el botón nunca se habilita. */
async function llenarPassword(page: Page, valor: string) {
  const input = page.locator('input[name="password"]');
  const boton = page.getByRole("button", { name: "Entrar" });
  await expect(async () => {
    await input.fill(valor);
    await expect(boton).toBeEnabled({ timeout: 1000 });
  }).toPass();
}

test("/admin sin sesión redirige a /login con ?from=", async ({ page }) => {
  await page.goto("/admin/eventos");
  await expect(page).toHaveURL(/\/login\?from=%2Fadmin%2Feventos/);
  await expect(
    page.getByRole("heading", { name: "Panel de administración" }),
  ).toBeVisible();
});

test("contraseña incorrecta → error y sigue fuera", async ({ page }) => {
  await page.goto("/login");
  await llenarPassword(page, "no-es-la-contraseña");
  await page.getByRole("button", { name: "Entrar" }).click();
  // p[role=alert] y no getByRole: el route announcer de Next también tiene
  // role="alert" y rompería el strict mode.
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Contraseña incorrecta",
  );
  await page.goto("/admin/eventos");
  await expect(page).toHaveURL(/\/login/);
});

test("con sesión entra al admin y respeta ?from=", async ({ page }) => {
  await page.goto("/admin/eventos");
  await expect(page).toHaveURL(/\/login/);

  await llenarPassword(page, E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Vuelve a donde se quería entrar y la pantalla de eventos carga (el mock
  // devuelve cero eventos → estado vacío con el CTA de crear).
  // Timeout amplio: el dev server compila /admin/eventos en el primer hit.
  await expect(page).toHaveURL(/\/admin\/eventos$/, { timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "+ Nuevo evento" }),
  ).toBeVisible();

  // La sesión persiste en una navegación nueva.
  await page.goto("/admin/atletas");
  await expect(page).toHaveURL(/\/admin\/atletas$/);
});
