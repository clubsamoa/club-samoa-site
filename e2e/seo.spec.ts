import { test, expect } from "@playwright/test";

// Invariantes de SEO y de compartido en redes (N08), convertidas en test
// durante el ensayo general de N21: el ensayo encontró que /alumnos y
// /comunidad se compartían SIN imagen porque Next no fusiona el openGraph de
// la página con el del layout — lo reemplaza entero.

const PUBLICAS = ["/", "/alumnos", "/comunidad"];

// Devuelve null si la etiqueta no existe, en vez de esperar a que aparezca:
// una etiqueta que falta es el fallo que se busca, no una carrera de carga.
async function meta(page: import("@playwright/test").Page, prop: string) {
  const tag = page.locator(`meta[property="${prop}"], meta[name="${prop}"]`);
  return (await tag.count()) === 0 ? null : tag.first().getAttribute("content");
}

for (const ruta of PUBLICAS) {
  test(`${ruta}: canonical, título y open graph completos`, async ({
    page,
  }) => {
    await page.goto(ruta);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical, `canonical de ${ruta}`).toBeTruthy();
    expect(new URL(canonical!).pathname.replace(/\/$/, "")).toBe(
      ruta.replace(/\/$/, ""),
    );

    expect(await page.title()).toMatch(/Club Samoa/i);
    expect(await meta(page, "og:title"), `og:title de ${ruta}`).toBeTruthy();
    expect(
      await meta(page, "og:description"),
      `og:description de ${ruta}`,
    ).toBeTruthy();

    // La que se perdía: sin ella, WhatsApp y Facebook comparten el link pelón.
    const imagen = await meta(page, "og:image");
    expect(imagen, `og:image de ${ruta}`).toBeTruthy();
    const respuesta = await page.request.get(imagen!);
    expect(respuesta.status(), `og:image de ${ruta} responde`).toBe(200);
  });
}

test("robots.txt permite el sitio y bloquea admin y api", async ({
  request,
}) => {
  const txt = await (await request.get("/robots.txt")).text();
  expect(txt).toContain("Disallow: /admin");
  expect(txt).toContain("Disallow: /api");
  expect(txt).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
});

test("sitemap.xml lista las 3 públicas", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const ruta of PUBLICAS) {
    expect(xml, `sitemap incluye ${ruta}`).toContain(
      `<loc>${new URL(ruta, "http://localhost:3100").href}</loc>`,
    );
  }
});

// Los 7 redirects de /admin/*.html NO se prueban aquí: en local los resuelve
// next.config antes del proxy (308 al destino), pero en Netlify gana el
// proxy de auth y devuelven 307 a /login?from=…  Se llega al mismo sitio tras
// el login; afirmar un código aquí daría verde en local y mentiría sobre prod.
test("los redirects .html del sitio público son permanentes", async ({
  request,
}) => {
  const esperados: [string, string][] = [
    ["/index.html", "/"],
    ["/students.html", "/alumnos"],
    ["/community.html", "/comunidad"],
  ];
  for (const [origen, destino] of esperados) {
    const r = await request.get(origen, { maxRedirects: 0 });
    expect(r.status(), origen).toBe(308);
    expect(r.headers()["location"], origen).toBe(destino);
  }
});
