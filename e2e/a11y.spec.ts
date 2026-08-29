import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { E2E_PASSWORD } from "../playwright.config";

// Auditoría de accesibilidad (N20) con axe-core sobre las 3 páginas
// públicas, el login, las pantallas del admin (con el dataset del mock) y
// las vistas públicas de proyección. Fallan las violaciones critical y
// serious; moderate/minor se reportan en consola sin romper el build.

async function auditar(page: Page, nombre: string) {
  const resultados = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  if (process.env.AXE_DEBUG) {
    for (const v of resultados.violations) {
      for (const n of v.nodes) {
        const data = (n.any[0] as { data?: unknown } | undefined)?.data;
        console.log(
          `[axe-debug] ${nombre} ${v.id} ${n.target.join(" ")} ${JSON.stringify(data)}`,
        );
      }
    }
  }
  const graves = resultados.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  const leves = resultados.violations.filter(
    (v) => v.impact !== "critical" && v.impact !== "serious",
  );
  if (leves.length > 0) {
    console.log(
      `[axe] ${nombre}: ${leves.length} violación(es) leve(s):`,
      leves.map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}`).join(", "),
    );
  }
  expect(
    graves.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
    })),
    `Violaciones graves de axe en ${nombre}`,
  ).toEqual([]);
}

async function login(page: Page) {
  await page.goto("/login");
  const input = page.locator('input[name="password"]');
  const boton = page.getByRole("button", { name: "Entrar" });
  await expect(async () => {
    await input.fill(E2E_PASSWORD);
    await expect(boton).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await boton.click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
}

test.describe("axe: sitio público", () => {
  for (const ruta of ["/", "/alumnos", "/comunidad", "/login"]) {
    test(`sin violaciones graves en ${ruta}`, async ({ page }) => {
      await page.goto(ruta);
      await auditar(page, ruta);
    });
  }
});

test.describe("axe: admin", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("listados de eventos y atletas", async ({ page }) => {
    await page.goto("/admin/eventos");
    await expect(
      page.getByRole("heading", { name: "Evento Mock E2E" }),
    ).toBeVisible();
    await auditar(page, "/admin/eventos");

    await page.goto("/admin/atletas");
    await expect(page.getByText("Atleta Mock Uno")).toBeVisible();
    await auditar(page, "/admin/atletas");
  });

  test("detalle del evento: las 5 pestañas", async ({ page }) => {
    for (const tab of [
      "",
      "?tab=inscripciones",
      "?tab=pesaje",
      "?tab=brackets",
      "?tab=resumen",
    ]) {
      await page.goto(`/admin/eventos/evt_e2e_001${tab}`);
      // El contenido del panel debe estar cargado antes de auditar.
      await expect(page.locator(".loading-message")).toHaveCount(0, {
        timeout: 15_000,
      });
      await auditar(page, `/admin/eventos/evt_e2e_001${tab || " (detalle)"}`);
    }
  });

  test("modal de nuevo evento (foco atrapado)", async ({ page }) => {
    await page.goto("/admin/eventos");
    const disparador = page.getByRole("button", { name: "+ Nuevo evento" });
    await disparador.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await auditar(page, "modal nuevo evento");

    // El foco inicial queda dentro y Tab no se escapa del modal.
    await expect(modal.locator('input[name="nombre"]')).toBeFocused();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const dentro = await modal.evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect(dentro, `Tab #${i + 1} se salió del modal`).toBe(true);
    }

    // Escape cierra y el foco vuelve al disparador.
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(disparador).toBeFocused();
  });

  test("scoreboard del operador", async ({ page }) => {
    await page.goto("/admin/scoreboard/pel_e2e_001");
    await expect(page.getByText("Atleta Mock Uno").first()).toBeVisible({
      timeout: 15_000,
    });
    await auditar(page, "/admin/scoreboard/[peleaId]");
  });
});

test.describe("axe: vistas públicas de proyección", () => {
  test("scoreboard público", async ({ page }) => {
    await page.goto("/scoreboard/evt_e2e_001");
    await page.waitForLoadState("networkidle");
    await auditar(page, "/scoreboard/[eventoId]");
  });

  test("bracket público", async ({ page }) => {
    await page.goto("/bracket/brk_e2e_001");
    await expect(page.getByText("Atleta Mock Uno").first()).toBeVisible({
      timeout: 15_000,
    });
    await auditar(page, "/bracket/[bracketId]");
  });
});
