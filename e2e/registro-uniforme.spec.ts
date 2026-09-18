import { test, expect } from "@playwright/test";

// Flujo 2 (N19): formulario de pedido de uniforme. El server action postea al
// mock (e2e/apps-script-mock.mjs), que responde { ok:true } y guarda el último
// payload en /registros/__last — así se verifica qué habría llegado a la Sheet
// sin tocarla.

const MOCK = "http://127.0.0.1:8788/registros";
// Los specs corren en paralelo contra el mismo mock, así que cada uno
// inspecciona solo los envíos de SU alumno.
const NOMBRE_VALIDO = "Alumno E2E Playwright";
const NOMBRE_REINTENTO = "Alumno Reintento";

test("envío válido → panel de confirmación con folio", async ({ page }) => {
  await page.goto("/alumnos");
  const form = page.locator("#uniformes form.data-form");

  await form.locator('input[name="nombre"]').fill(NOMBRE_VALIDO);
  await form.locator('input[name="whatsapp"]').fill("833 123 4567");
  await form.locator('select[name="disciplina"]').selectOption("MMA");
  await form.locator('input[name="producto"][value="Rashguard"]').check();
  await form.locator('select[name="talla"]').selectOption("M");
  await form.locator('input[name="cantidad"]').fill("2");
  await form.getByRole("button", { name: "Enviar pedido" }).click();

  // Éxito: el form se oculta y aparece la confirmación con el submission_id.
  const confirmacion = page
    .locator("#uniformes")
    .getByText("Se ha guardado correctamente tu pedido");
  await expect(confirmacion).toBeVisible();
  const folio = await page
    .locator("#uniformes .request-confirmation-id")
    .innerText();
  expect(folio).toMatch(/[0-9a-f-]{36}/);

  // El payload que recibió el "backend" es el del pedido.
  const last = await (
    await page.request.get(
      `${MOCK}/__last?nombre=${encodeURIComponent(NOMBRE_VALIDO)}`,
    )
  ).json();
  expect(last).toMatchObject({
    form_type: "uniforme",
    nombre: NOMBRE_VALIDO,
    producto: "Rashguard",
    talla: "M",
    cantidad: "2",
    submission_id: folio,
  });
});

test("envío inválido → la validación nativa lo detiene", async ({ page }) => {
  await page.goto("/alumnos");
  const form = page.locator("#uniformes form.data-form");

  // Sin llenar nada: reportValidity() bloquea el submit.
  await form.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(form).toBeVisible(); // no pasó a confirmación
  const invalido = await form
    .locator('input[name="nombre"]')
    .evaluate((el: HTMLInputElement) => el.validity.valueMissing);
  expect(invalido).toBe(true);

  // Con todo menos el producto: el grupo de checkboxes exige al menos uno.
  await form.locator('input[name="nombre"]').fill("Alumno E2E");
  await form.locator('input[name="whatsapp"]').fill("833 123 4567");
  await form.locator('select[name="disciplina"]').selectOption("MMA");
  await form.locator('select[name="talla"]').selectOption("M");
  await form.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(form).toBeVisible();
  const mensajeProducto = await form
    .locator('input[name="producto"]')
    .first()
    .evaluate((el: HTMLInputElement) => el.validationMessage);
  expect(mensajeProducto).toBe("Selecciona al menos una opción.");
});

// Idempotencia (hallazgo de N21): Apps Script escribe la fila ANTES de
// responder, así que un timeout deja al alumno viendo un error con su pedido
// ya guardado. Si cada reintento generase un submission_id nuevo, el backend
// no lo reconocería como duplicado y la fila se repetiría. El folio se genera
// una vez por pedido y se reusa.
test("un reintento tras un fallo reusa el mismo folio", async ({ page }) => {
  // El primer envío de ESTE alumno se registra "en la Sheet" y aun así
  // devuelve error.
  await page.request.post(
    `${MOCK}/__fallar?n=1&nombre=${encodeURIComponent(NOMBRE_REINTENTO)}`,
  );

  await page.goto("/alumnos");
  const form = page.locator("#uniformes form.data-form");
  await expect(async () => {
    await form.locator('input[name="nombre"]').fill(NOMBRE_REINTENTO);
    await expect(form.locator('input[name="nombre"]')).toHaveValue(
      NOMBRE_REINTENTO,
    );
  }).toPass();
  await form.locator('input[name="whatsapp"]').fill("833 000 0000");
  await form.locator('select[name="disciplina"]').selectOption("MMA");
  await form.locator('input[name="producto"][value="Rashguard"]').check();
  await form.locator('select[name="talla"]').selectOption("M");
  await form.locator('input[name="cantidad"]').fill("1");

  const enviar = form.getByRole("button", { name: "Enviar pedido" });
  await enviar.click();
  await expect(form.locator(".form-status.is-error")).not.toBeEmpty();

  // Los campos siguen puestos (React 19 resetea solo en éxito), así que el
  // alumno reintenta con el mismo pedido.
  await enviar.click();
  await expect(
    page.locator("#uniformes").getByText("Se ha guardado correctamente"),
  ).toBeVisible({ timeout: 15_000 });

  const { registros } = await (
    await page.request.get(
      `${MOCK}/__todos?nombre=${encodeURIComponent(NOMBRE_REINTENTO)}`,
    )
  ).json();
  expect(registros, "el backend recibió los dos intentos").toHaveLength(2);
  expect(
    registros[0].submission_id,
    "el reintento debe reusar el folio del primer intento",
  ).toBe(registros[1].submission_id);
  expect(registros[0].submission_id).toMatch(/[0-9a-f-]{36}/);

  // Y el folio que ve el alumno es ese mismo.
  const folio = await page
    .locator("#uniformes .request-confirmation-id")
    .innerText();
  expect(folio).toBe(registros[0].submission_id);
});
