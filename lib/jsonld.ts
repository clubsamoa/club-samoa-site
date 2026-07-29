import { HORARIOS } from "@/content/horarios";
import { FACEBOOK_URL, INSTAGRAM_URL, MAPS_URL } from "@/lib/constants";

// JSON-LD LocalBusiness (SportsActivityLocation) para SEO local.
// Los horarios de apertura se derivan de content/horarios.ts — una sola
// fuente de verdad: cambiar un horario actualiza página y datos
// estructurados a la vez.

const DAY_MAP: Record<string, string[]> = {
  "Lunes, Miércoles y Viernes": ["Monday", "Wednesday", "Friday"],
  "Martes y Jueves": ["Tuesday", "Thursday"],
};

function to24h(time: string): number {
  // "5:00 pm" -> 1700, "09:00 am" -> 900
  const match = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(time);
  if (!match) return 0;
  let hours = Number(match[1]) % 12;
  if (match[3]!.toLowerCase() === "pm") hours += 12;
  return hours * 100 + Number(match[2]);
}

function fmt(hhmm: number): string {
  return `${String(Math.floor(hhmm / 100)).padStart(2, "0")}:${String(
    hhmm % 100,
  ).padStart(2, "0")}`;
}

/** Fusiona los bloques de cada grupo de días en rangos contiguos (evita
 *  declarar abierto el hueco de media jornada). */
function openingHours() {
  const specs: Array<{
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string[];
    opens: string;
    closes: string;
  }> = [];
  for (const bloque of HORARIOS) {
    const days = DAY_MAP[bloque.dias];
    if (!days) continue;
    const intervals = bloque.grupos
      .flatMap((g) => g.bloques)
      .map((b) => [to24h(b.inicio), to24h(b.fin)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [start, end] of intervals) {
      const last = merged[merged.length - 1];
      if (last && start <= last[1]) {
        last[1] = Math.max(last[1], end);
      } else {
        merged.push([start, end]);
      }
    }
    for (const [start, end] of merged) {
      specs.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days,
        opens: fmt(start),
        closes: fmt(end),
      });
    }
  }
  return specs;
}

export function clubSamoaJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": `${siteUrl}/#club`,
    name: "Club Samoa Escuela de Artes Marciales",
    url: siteUrl,
    foundingDate: "1983",
    telephone: "+52 833 311 0858",
    image: `${siteUrl}/images/valeria.jpg`,
    logo: `${siteUrl}/images/logo-black.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Allende #300 Sur, esquina con Francisco Sarabia",
      addressLocality: "Ciudad Madero",
      addressRegion: "Tamaulipas",
      postalCode: "89400",
      addressCountry: "MX",
    },
    hasMap: MAPS_URL,
    sameAs: [INSTAGRAM_URL, FACEBOOK_URL],
    openingHoursSpecification: openingHours(),
    sport: [
      "Lima Lama",
      "Kickboxing",
      "Muay Thai",
      "Mixed Martial Arts",
      "Jiu Jitsu",
    ],
  };
}
