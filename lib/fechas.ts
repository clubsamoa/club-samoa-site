/** El club está en Ciudad Madero: las fechas se calculan en esa zona. */
export const ZONA_CLUB = "America/Monterrey";

/** Fecha de hoy como "YYYY-MM-DD" en la zona del club, no en la del visitante. */
export function hoyEnZonaClub(
  ahora: Date = new Date(),
  zona: string = ZONA_CLUB,
): string {
  // en-CA formatea justo como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
