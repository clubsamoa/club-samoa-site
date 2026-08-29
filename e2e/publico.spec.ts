import { test, expect, type Page } from "@playwright/test";

// Flujo 1 (N19): sitio público — la home carga, la navegación funciona y los
// anchors de los dropdowns saltan a su sección.

async function anchorVisible(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  await expect(section).toBeVisible();
  // El anchor "saltó": la sección quedó dentro del viewport.
  await expect(section).toBeInViewport();
}

test("la home carga con hero y secciones", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Club Samoa/i);
  await expect(page.locator("#horarios")).toBeVisible();
  await expect(page.locator("#contacto")).toBeVisible();
});

test("la navegación principal lleva a alumnos y comunidad", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" });

  await nav.getByRole("button", { name: "Alumnos" }).click();
  await nav.getByRole("link", { name: "Portal de alumnos" }).click();
  await expect(page).toHaveURL(/\/alumnos$/);
  await expect(page.locator("#uniformes")).toBeVisible();

  await nav.getByRole("button", { name: "Comunidad" }).click();
  await nav.getByRole("link", { name: "Precios y torneos" }).click();
  await expect(page).toHaveURL(/\/comunidad$/);
  await expect(page.locator("#precios")).toBeVisible();
});

test("los anchors del dropdown de Alumnos saltan a la sección", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" });

  await nav.getByRole("button", { name: "Alumnos" }).click();
  await nav.getByRole("link", { name: "Uniformes" }).click();
  await expect(page).toHaveURL(/\/alumnos#uniformes$/);
  await anchorVisible(page, "uniformes");

  await nav.getByRole("button", { name: "Alumnos" }).click();
  await nav.getByRole("link", { name: "Exámenes" }).click();
  await expect(page).toHaveURL(/#examenes$/);
  await anchorVisible(page, "examenes");
});

test("los anchors de la home (#horarios, #contacto) saltan", async ({
  page,
}) => {
  await page.goto("/alumnos");
  const nav = page.getByRole("navigation", { name: "Principal" });

  await nav.getByRole("link", { name: "Horarios" }).click();
  await expect(page).toHaveURL(/\/#horarios$/);
  await anchorVisible(page, "horarios");

  await nav.getByRole("link", { name: "Contacto" }).click();
  await anchorVisible(page, "contacto");
});

test("los anchors de comunidad (#precios, #torneos) saltan", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" });

  await nav.getByRole("button", { name: "Comunidad" }).click();
  await nav.getByRole("link", { name: "Torneos", exact: true }).click();
  await expect(page).toHaveURL(/\/comunidad#torneos$/);
  await anchorVisible(page, "torneos");
});
