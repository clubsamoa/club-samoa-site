import type { Page } from "@playwright/test";
import { ANUNCIO_TORNEO } from "../content/torneos";
import { ZONA_CLUB } from "../lib/fechas";

// El boleto del torneo sale 900 ms después de cargar y tapa la página: los
// specs que hacen clic en el sitio público lo marcan como "ya visto hoy"
// antes de navegar, igual que un visitante que ya lo cerró. El boleto en sí
// se prueba aparte, en a11y.spec.ts.

export async function anuncioYaVisto(page: Page) {
  const id = ANUNCIO_TORNEO?.id;
  if (!id) return;
  await page.addInitScript(
    ({ id, zona }: { id: string; zona: string }) => {
      const hoy = new Intl.DateTimeFormat("en-CA", {
        timeZone: zona,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      try {
        window.localStorage.setItem(`samoa:anuncio:${id}`, hoy);
      } catch {
        // Sin almacenamiento el anuncio saldrá igual; el spec ya fallaría.
      }
    },
    { id, zona: ZONA_CLUB },
  );
}
