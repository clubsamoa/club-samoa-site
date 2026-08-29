import { test, expect, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "../playwright.config";

// Flujo 4 (N19): evento de punta a punta — crear → inscribir → pesar →
// generar bracket → operar una pelea → finalizar.
//
// ⚠️ ESCRIBE EN LA SHEET del APPS_SCRIPT_EVENTOS_URL del entorno. Por eso el
// proyecto "sheet-real" de playwright.config.ts solo corre cuando se pide
// explícito, y NUNCA en CI:
//
//   E2E_EVENTOS=1 APPS_SCRIPT_EVENTOS_URL="<url de la Sheet de PRUEBAS>" \
//     npx playwright test --project=sheet-real
//
// Al final borra el evento (cascada: inscripciones, brackets y peleas) y los
// atletas de prueba, pero si el test truena a la mitad pueden quedar filas
// "E2E ..." — otra razón para usar una Sheet de pruebas.

const habilitado = process.env.E2E_EVENTOS === "1";
test.skip(
  !habilitado,
  "Solo corre con E2E_EVENTOS=1 contra una Sheet de pruebas",
);

// Datos únicos por corrida para no chocar con corridas previas.
const RUN = new Date().toISOString().slice(5, 19).replace(/[-:T]/g, "");
const EVENTO_NOMBRE = `E2E Evento ${RUN}`;

const GANADOR = { nombre_completo: `E2E Uno ${RUN}`, peso_referencia_kg: 70 };
const ATLETAS = [
  GANADOR,
  { nombre_completo: `E2E Dos ${RUN}`, peso_referencia_kg: 71 },
];

async function login(page: Page) {
  await page.goto("/login");
  const input = page.locator('input[name="password"]');
  const boton = page.getByRole("button", { name: "Entrar" });
  // Reintento: si el fill gana la carrera a la hidratación, el estado de
  // React queda vacío y el botón no se habilita.
  await expect(async () => {
    await input.fill(E2E_PASSWORD);
    await expect(boton).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await boton.click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
}

async function apiPost(
  page: Page,
  action: string,
  payload: Record<string, unknown>,
) {
  const res = await page.request.post(`/api/eventos/${action}`, {
    data: payload,
  });
  expect(res.ok(), `${action}: HTTP ${res.status()}`).toBe(true);
  return (await res.json()) as Record<string, unknown>;
}

test("evento completo: crear → inscribir → pesar → bracket → pelea → finalizar", async ({
  page,
}) => {
  test.setTimeout(300_000); // Apps Script es lento; el flujo hace ~20 llamadas.

  const atletaIds: string[] = [];
  let eventoId = "";

  await login(page);

  await test.step("seed: 2 atletas de prueba vía API", async () => {
    for (const a of ATLETAS) {
      const res = await apiPost(page, "atletas.create", {
        ...a,
        fecha_nacimiento: "2000-01-15",
        genero: "Masculino",
        anios_practica: 4,
        nivel: "Avanzado",
        academia: "E2E Playwright",
        pais: "México",
      });
      atletaIds.push((res.atleta as { id: string }).id);
    }
  });

  try {
    await test.step("crear evento desde la UI", async () => {
      await page.goto("/admin/eventos");
      await page.getByRole("button", { name: "+ Nuevo evento" }).click();
      const modal = page.getByRole("dialog");
      await modal.locator('input[name="nombre"]').fill(EVENTO_NOMBRE);
      await modal.locator('input[name="fecha"]').fill("2027-06-12");
      await modal.locator('input[name="sede"]').fill("Sede de pruebas E2E");
      await modal.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText(EVENTO_NOMBRE)).toBeVisible();

      const card = page.locator(".evento-card, article, li", {
        hasText: EVENTO_NOMBRE,
      });
      await card.getByRole("link", { name: "Ver evento →" }).first().click();
      await expect(page).toHaveURL(/\/admin\/eventos\/evt_/);
      eventoId = page.url().match(/eventos\/(evt_[^/?#]+)/)?.[1] ?? "";
      expect(eventoId).not.toBe("");
    });

    await test.step("inscribir a los 2 atletas", async () => {
      await page.getByRole("tab", { name: "Inscripciones" }).click();
      await page.getByRole("button", { name: "+ Agregar atletas" }).click();
      const modal = page.getByRole("dialog");
      for (const a of ATLETAS) {
        await modal
          .getByRole("checkbox", {
            name: `Seleccionar ${a.nombre_completo}`,
          })
          .check();
      }
      await modal.getByRole("button", { name: /^Inscribir/ }).click();
      await expect(modal).toBeHidden();
      await expect(page.getByText("2 inscritos")).toBeVisible();
    });

    await test.step("pesar y aprobar a los 2", async () => {
      await page.getByRole("tab", { name: "Pesaje" }).click();
      for (const a of ATLETAS) {
        const peso = page.getByRole("spinbutton", {
          name: `Peso de pesaje de ${a.nombre_completo}`,
        });
        await peso.fill(String(a.peso_referencia_kg));
        // El guardado es con debounce: esperar a que el status de la fila
        // quede vacío (ni "Guardando…" ni error).
        const fila = page.locator("tr", { hasText: a.nombre_completo });
        await expect(fila.locator(".peso-status")).toHaveText("", {
          timeout: 30_000,
        });
        await page
          .getByRole("combobox", {
            name: `Estatus de ${a.nombre_completo}`,
          })
          .selectOption("aprobado");
        await expect(fila.locator(".peso-status")).toHaveText("", {
          timeout: 30_000,
        });
      }
    });

    await test.step("generar y confirmar el bracket", async () => {
      await page.getByRole("tab", { name: "Brackets" }).click();
      page.once("dialog", (d) => void d.accept());
      await page
        .getByRole("button", { name: /Confirmar todos los viables/ })
        .click();
      // La vista pasa a "en vivo" con el bracket confirmado y su SVG.
      await expect(page.locator(".bracket-live-card")).toHaveCount(1, {
        timeout: 60_000,
      });
      await expect(page.getByText("0 / 1 peleas decididas")).toBeVisible();
    });

    await test.step("operar la pelea en el scoreboard y finalizarla", async () => {
      // Click en la pelea del SVG abre el scoreboard del operador.
      await page.locator(".bracket-svg-host [data-pelea-id]").first().click();
      await expect(page).toHaveURL(/\/admin\/scoreboard\//, {
        timeout: 30_000,
      });

      await page.getByRole("button", { name: "✓ Finalizar pelea" }).click();
      const modal = page.getByRole("dialog");
      await modal.getByRole("radio", { name: GANADOR.nombre_completo }).check();
      await modal.locator('select[name="metodo"]').selectOption("Decisión");
      await modal
        .getByRole("button", { name: "Guardar y volver al bracket" })
        .click();

      // De vuelta en el evento: la pelea quedó decidida.
      await expect(page).toHaveURL(/\/admin\/eventos\//, { timeout: 60_000 });
      await expect(page.getByText("1 / 1 peleas decididas")).toBeVisible({
        timeout: 60_000,
      });
    });

    await test.step("resumen: el ganador aparece", async () => {
      await page.getByRole("tab", { name: "Resumen" }).click();
      await expect(
        page.getByText(GANADOR.nombre_completo).first(),
      ).toBeVisible();
    });
  } finally {
    // Limpieza: eventos.delete borra en cascada inscripciones, brackets y
    // peleas; los atletas se borran aparte.
    if (eventoId) await apiPost(page, "eventos.delete", { id: eventoId });
    for (const id of atletaIds) {
      await apiPost(page, "atletas.delete", { id });
    }
  }
});
