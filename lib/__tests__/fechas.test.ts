import { describe, expect, it } from "vitest";
import { hoyEnZonaClub } from "@/lib/fechas";

describe("hoyEnZonaClub", () => {
  it("devuelve YYYY-MM-DD", () => {
    expect(hoyEnZonaClub(new Date("2026-10-24T18:00:00Z"))).toBe("2026-10-24");
  });

  it("usa la zona del club, no UTC", () => {
    // 25 de octubre, 03:00 UTC = 24 de octubre, 21:00 en Ciudad Madero: el
    // anuncio del torneo sigue vigente la noche del evento.
    expect(hoyEnZonaClub(new Date("2026-10-25T03:00:00Z"))).toBe("2026-10-24");
  });

  it("al día siguiente ya pasó la fecha del anuncio", () => {
    const hoy = hoyEnZonaClub(new Date("2026-10-25T18:00:00Z"));
    expect(hoy).toBe("2026-10-25");
    expect(hoy > "2026-10-24").toBe(true);
  });
});
