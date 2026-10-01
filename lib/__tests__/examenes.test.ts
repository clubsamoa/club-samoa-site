import { describe, expect, it } from "vitest";
import {
  disciplinasDelMes,
  etiquetaMes,
  hayExamen,
  listaEnEspanol,
  mesActual,
  mesesDesde,
  proximoMesConExamen,
  sumarMeses,
} from "@/lib/examenes";

// Cadencias que dio el club: Lima Lama cada 3 meses desde diciembre,
// Kickboxing cada 4 desde abril, Jiu Jitsu junio y diciembre. MMA no entra.

describe("disciplinasDelMes", () => {
  it("diciembre junta las tres disciplinas", () => {
    expect(disciplinasDelMes(12)).toEqual([
      "Lima Lama",
      "Kickboxing",
      "Jiu Jitsu",
    ]);
  });
  it("junio es Lima Lama y Jiu Jitsu", () => {
    expect(disciplinasDelMes(6)).toEqual(["Lima Lama", "Jiu Jitsu"]);
  });
  it("marzo y septiembre solo Lima Lama", () => {
    expect(disciplinasDelMes(3)).toEqual(["Lima Lama"]);
    expect(disciplinasDelMes(9)).toEqual(["Lima Lama"]);
  });
  it("abril y agosto solo Kickboxing", () => {
    expect(disciplinasDelMes(4)).toEqual(["Kickboxing"]);
    expect(disciplinasDelMes(8)).toEqual(["Kickboxing"]);
  });
  it("los meses sin examen quedan vacíos", () => {
    for (const mes of [1, 2, 5, 7, 10, 11]) {
      expect(disciplinasDelMes(mes)).toEqual([]);
      expect(hayExamen(mes)).toBe(false);
    }
  });
  it("MMA no aparece en ningún mes", () => {
    const todas = Array.from({ length: 12 }, (_, i) =>
      disciplinasDelMes(i + 1),
    ).flat();
    expect(todas).not.toContain("MMA");
  });
});

describe("sumarMeses", () => {
  it("cruza el fin de año", () => {
    expect(sumarMeses({ anio: 2026, mes: 11 }, 2)).toEqual({
      anio: 2027,
      mes: 1,
    });
  });
  it("resta hacia el año anterior", () => {
    expect(sumarMeses({ anio: 2026, mes: 1 }, -1)).toEqual({
      anio: 2025,
      mes: 12,
    });
  });
  it("diciembre más uno es enero del siguiente año", () => {
    expect(sumarMeses({ anio: 2026, mes: 12 }, 1)).toEqual({
      anio: 2027,
      mes: 1,
    });
  });
});

describe("mesesDesde", () => {
  it("devuelve meses consecutivos incluyendo el inicial", () => {
    const tira = mesesDesde({ anio: 2026, mes: 11 }, 3);
    expect(tira).toEqual([
      { anio: 2026, mes: 11 },
      { anio: 2026, mes: 12 },
      { anio: 2027, mes: 1 },
    ]);
  });
});

describe("proximoMesConExamen", () => {
  it("desde octubre 2026 el siguiente es diciembre 2026", () => {
    expect(proximoMesConExamen({ anio: 2026, mes: 10 }, false)).toEqual({
      anio: 2026,
      mes: 12,
    });
  });
  it("desde diciembre, sin incluir el actual, salta a marzo del año siguiente", () => {
    expect(proximoMesConExamen({ anio: 2026, mes: 12 }, false)).toEqual({
      anio: 2027,
      mes: 3,
    });
  });
  it("incluyendo el actual, un mes con examen se devuelve a sí mismo", () => {
    expect(proximoMesConExamen({ anio: 2026, mes: 12 })).toEqual({
      anio: 2026,
      mes: 12,
    });
  });
});

describe("mesActual", () => {
  it("usa la zona del club, no UTC", () => {
    // 1 de octubre 2026, 03:00 UTC = 30 de septiembre, 21:00 en Ciudad Madero.
    expect(mesActual(new Date("2026-10-01T03:00:00Z"))).toEqual({
      anio: 2026,
      mes: 9,
    });
  });
});

describe("textos", () => {
  it("etiquetaMes usa mes y año en español", () => {
    expect(etiquetaMes({ anio: 2026, mes: 12 })).toBe("diciembre 2026");
  });
  it("listaEnEspanol une con comas y una 'y'", () => {
    expect(listaEnEspanol(["Lima Lama", "Kickboxing", "Jiu Jitsu"])).toBe(
      "Lima Lama, Kickboxing y Jiu Jitsu",
    );
    expect(listaEnEspanol(["MMA"])).toBe("MMA");
    expect(listaEnEspanol([])).toBe("");
  });
});
