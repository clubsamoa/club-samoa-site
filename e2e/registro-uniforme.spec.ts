import { test, expect } from "@playwright/test";

// Flujo 2 (N19): formulario de pedido de uniforme. El server action postea al
// mock (e2e/apps-script-mock.mjs), que responde { ok:true } y guarda el último
// payload en /registros/__last — así se verifica qué habría llegado a la Sheet
// sin tocarla.

const MOCK_LAST = "http://127.0.0.1:8788/registros/__last";

test("envío válido → panel de confirmación con folio", async ({ page }) => {
  await page.goto("/alumnos");
  const form = page.locator("#uniformes form.data-form");

  await form.locator('input[name="nombre"]').fill("Alumno E2E Playwright");
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
  const last = await (await page.request.get(MOCK_LAST)).json();
  expect(last).toMatchObject({
    form_type: "uniforme",
    nombre: "Alumno E2E Playwright",
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
