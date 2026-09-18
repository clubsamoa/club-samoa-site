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

// Apps Script tarda entre 2 y 10 s por llamada, y a veces la conexión a
// script.google.com se cuelga y hay que reintentar. Los `toBeVisible` por
// defecto esperan 5 s: en la primera corrida real de este spec (ensayo de
// N21) eso bastó para que el evento SÍ se creara en la Sheet y el test lo
// diera por fallido. Todo lo que dependa del backend usa este timeout.
const ESPERA_BACKEND = 60_000;

// Los dos pesos tienen que caer en la MISMA categoría o el bracket no es
// viable y «Confirmar todos los viables» queda deshabilitado. 70 y 71 kg
// caían en Peso Ligero (<70.3) y Superligero — una categoría de un atleta
// cada una. 68 y 69 kg son ambos Peso Ligero varonil.
const GANADOR = { nombre_completo: `E2E Uno ${RUN}`, peso_referencia_kg: 68 };
const ATLETAS = [
  GANADOR,
  { nombre_completo: `E2E Dos ${RUN}`, peso_referencia_kg: 69 },
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

// La limpieza corre en el finally: si una llamada truena no puede tirar el
// resto, o quedan filas de prueba en la Sheet real.
async function borrarSinRomper(page: Page, action: string, id: string) {
  try {
    const res = await page.request.post(`/api/eventos/${action}`, {
      data: { id },
    });
    if (!res.ok())
      console.log(`[limpieza] ${action} ${id}: HTTP ${res.status()}`);
  } catch (error) {
    console.log(`[limpieza] ${action} ${id} falló: ${String(error)}`);
  }
}

// Si el test truena ANTES de leer el id de la URL, el evento ya existe en la
// Sheet y se quedaría ahí para siempre. Se busca por nombre para borrarlo.
async function buscarEventoPorNombre(page: Page, nombre: string) {
  try {
    const res = await page.request.get("/api/eventos/eventos.list");
    if (!res.ok()) return "";
    const data = (await res.json()) as {
      eventos?: { id: string; nombre: string }[];
    };
    return data.eventos?.find((e) => e.nombre === nombre)?.id ?? "";
  } catch {
    return "";
  }
}

test("evento completo: crear → inscribir → pesar → bracket → pelea → finalizar", async ({
  page,
}) => {
  // Apps Script es lento (2-10 s por llamada) y el flujo hace ~20. Si el test
  // se pasa del timeout, Playwright lo aborta y el `finally` de limpieza NO
  // corre: quedan evento y atletas de prueba en la Sheet real. Margen amplio.
  test.setTimeout(600_000);

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

      // El listado abre filtrado por «Activo» y un evento recién creado nace
      // en «borrador»: sin cambiar el filtro no aparece nunca. (Así falló la
      // primera corrida real de este spec, en el ensayo de N21.)
      await page
        .getByRole("group", { name: "Filtro de estatus" })
        .getByRole("button", { name: "Todos" })
        .click();
      await expect(page.getByText(EVENTO_NOMBRE)).toBeVisible({
        timeout: ESPERA_BACKEND,
      });

      const card = page.locator(".evento-card, article, li", {
        hasText: EVENTO_NOMBRE,
      });
      await card.getByRole("link", { name: "Ver evento →" }).first().click();
      await expect(page).toHaveURL(/\/admin\/eventos\/evt_/, {
        timeout: ESPERA_BACKEND,
      });
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
      await expect(modal).toBeHidden({ timeout: ESPERA_BACKEND });
      await expect(page.getByText("2 inscritos")).toBeVisible({
        timeout: ESPERA_BACKEND,
      });
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
      // El contador sale dos veces (resumen de brackets y cabecera del
      // bracket), así que hay que desempatar o Playwright tira strict mode.
      await expect(
        page.getByText("0 / 1 peleas decididas").first(),
      ).toBeVisible({ timeout: ESPERA_BACKEND });
    });

    await test.step("operar la pelea en el scoreboard y finalizarla", async () => {
      // Click en la pelea del SVG abre el scoreboard del operador.
      await page.locator(".bracket-svg-host [data-pelea-id]").first().click();
      await expect(page).toHaveURL(/\/admin\/scoreboard\//, {
        timeout: 30_000,
      });

      await page.getByRole("button", { name: "✓ Finalizar pelea" }).click();
      const modal = page.getByRole("dialog");
      // El radio real está oculto bajo la píldora: el <span> intercepta el
      // puntero y check() se queda reintentando hasta agotar el test. Se
      // clica la etiqueta, que es lo que hace el operador, y se comprueba
      // que el input quedó seleccionado.
      const pildora = modal.locator("label.radio-pill", {
        hasText: GANADOR.nombre_completo,
      });
      await pildora.click();
      await expect(pildora.locator('input[type="radio"]')).toBeChecked();
      await modal.locator('select[name="metodo"]').selectOption("Decisión");
      await modal
        .getByRole("button", { name: "Guardar y volver al bracket" })
        .click();

      // De vuelta en el evento. Ojo: el botón dice "volver al bracket" pero
      // la app aterriza en la pestaña Resumen, y ahí el contador NO dice
      // "1 / 1 peleas decididas" (esa redacción es la de Brackets) sino
      // "1 / 1 peleas (100%)" con el sello de todas decididas.
      await expect(page).toHaveURL(/\/admin\/eventos\//, {
        timeout: ESPERA_BACKEND,
      });
      const resumen = page.getByRole("tabpanel", { name: "Resumen" });
      await expect(resumen.getByText("Todas decididas")).toBeVisible({
        timeout: ESPERA_BACKEND,
      });
    });

    await test.step("resumen: el ganador sube al podio", async () => {
      const resumen = page.getByRole("tabpanel", { name: "Resumen" });
      // 🥇 y 🥈 en el orden correcto: el ganador de la final es el oro.
      await expect(resumen.getByText("🥇")).toBeVisible({
        timeout: ESPERA_BACKEND,
      });
      const podio = await resumen.innerText();
      const oro = podio.indexOf(GANADOR.nombre_completo);
      const plata = podio.indexOf(ATLETAS[1]!.nombre_completo);
      expect(oro, "el ganador no aparece en el resumen").toBeGreaterThan(-1);
      expect(
        oro,
        "el ganador debería ir antes que el perdedor en el podio",
      ).toBeLessThan(plata);
    });
  } finally {
    // Limpieza: eventos.delete borra en cascada inscripciones, brackets y
    // peleas; los atletas se borran aparte.
    const idParaBorrar =
      eventoId || (await buscarEventoPorNombre(page, EVENTO_NOMBRE));
    if (idParaBorrar)
      await borrarSinRomper(page, "eventos.delete", idParaBorrar);
    for (const id of atletaIds) {
      await borrarSinRomper(page, "atletas.delete", id);
    }
  }
});
