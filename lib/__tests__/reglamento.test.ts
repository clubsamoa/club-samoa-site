import { describe, expect, it } from "vitest";
import {
  DIVISIONES,
  METODOS_FINALIZACION,
  NIVELES,
  calcularCategoriaPeso,
  calcularDivisionEdad,
  categoriasPesoPara,
  sugerirNivel,
  tiempoPelea,
} from "@/lib/reglamento";

// Puerto de los casos de legacy/admin/js/reglamento.test.html.

describe("calcularDivisionEdad", () => {
  it("adulto de 25 años", () => {
    expect(calcularDivisionEdad("2001-03-15", "2026-08-07")).toBe("Adultos");
  });
  it("niño que cumple 10 antes del evento", () => {
    expect(calcularDivisionEdad("2016-01-01", "2026-08-07")).toBe("Juvenil D");
  });
  it("adolescente de 17", () => {
    expect(calcularDivisionEdad("2009-05-20", "2026-08-07")).toBe("Juvenil A");
  });
  it("junior de 18", () => {
    expect(calcularDivisionEdad("2008-06-01", "2026-08-07")).toBe("Junior");
  });
  it("Mini 1 (4 años)", () => {
    expect(calcularDivisionEdad("2022-01-01", "2026-08-07")).toBe("Mini 1");
  });
  it("fuera de rango (3 años) → cadena vacía", () => {
    expect(calcularDivisionEdad("2023-01-01", "2026-08-07")).toBe("");
  });
  it("cumple 21 el día del evento → Adultos", () => {
    expect(calcularDivisionEdad("2005-08-07", "2026-08-07")).toBe("Adultos");
  });
  it("cumple 21 al día siguiente → todavía Junior", () => {
    expect(calcularDivisionEdad("2005-08-08", "2026-08-07")).toBe("Junior");
  });
  it("fechas inválidas → cadena vacía", () => {
    expect(calcularDivisionEdad("", "2026-08-07")).toBe("");
    expect(calcularDivisionEdad("2001-03-15", null)).toBe("");
  });
});

describe("sugerirNivel", () => {
  const casos: Array<[number, string]> = [
    [0, "Novato"],
    [0.5, "Novato"],
    [1, "Novato"],
    [1.5, "Principiante"],
    [2, "Principiante"],
    [2.5, "Intermedio"],
    [3, "Intermedio"],
    [3.1, "Avanzado"],
    [10, "Avanzado"],
  ];
  for (const [anios, esperado] of casos) {
    it(`${anios} años → ${esperado}`, () => {
      expect(sugerirNivel(anios)).toBe(esperado);
    });
  }
  it("valores inválidos → cadena vacía", () => {
    expect(sugerirNivel(-1)).toBe("");
    expect(sugerirNivel(NaN)).toBe("");
  });
});

describe("calcularCategoriaPeso", () => {
  it("Adultos Masculino 69.5 kg → Peso Ligero", () => {
    expect(calcularCategoriaPeso("Adultos", "Masculino", 69.5)).toEqual({
      nombre: "Peso Ligero",
      pesoMax: 70.3,
    });
  });
  it("Adultos Femenino 47 kg → Átomo", () => {
    expect(calcularCategoriaPeso("Adultos", "Femenino", 47)).toEqual({
      nombre: "Átomo",
      pesoMax: 47.7,
    });
  });
  it("Adultos Masculino 100 kg → Superpesado (categoría abierta)", () => {
    expect(calcularCategoriaPeso("Adultos", "Masculino", 100)).toEqual({
      nombre: "Superpesado",
      pesoMax: Infinity,
    });
  });
  it("el límite es estricto: 70.3 kg exactos suben a Superligero", () => {
    expect(calcularCategoriaPeso("Adultos", "Masculino", 70.3)).toEqual({
      nombre: "Superligero",
      pesoMax: 74.8,
    });
  });
  it("Juvenil A Masculino 70 kg → Ligero", () => {
    expect(calcularCategoriaPeso("Juvenil A", "Masculino", 70)).toEqual({
      nombre: "Ligero",
      pesoMax: 70.3,
    });
  });
  it("Juvenil A Femenino 46 kg → Átomo (47.6, distinto de Adultos)", () => {
    expect(calcularCategoriaPeso("Juvenil A", "Femenino", 46)).toEqual({
      nombre: "Átomo",
      pesoMax: 47.6,
    });
  });
  it("Infantil 26 kg → Menos 27 kg", () => {
    expect(calcularCategoriaPeso("Infantil", "Masculino", 26)).toEqual({
      nombre: "Menos 27 kg",
      pesoMax: 27,
    });
  });
  it("Juvenil D 38 kg → Menos 40 kg", () => {
    expect(calcularCategoriaPeso("Juvenil D", "Femenino", 38)).toEqual({
      nombre: "Menos 40 kg",
      pesoMax: 40,
    });
  });
  it("peso 0 o negativo → null", () => {
    expect(calcularCategoriaPeso("Adultos", "Masculino", 0)).toBeNull();
    expect(calcularCategoriaPeso("Adultos", "Masculino", -5)).toBeNull();
  });
  it("división inválida → lista vacía", () => {
    expect(categoriasPesoPara("NoExiste", "Masculino")).toEqual([]);
  });
});

describe("tiempoPelea", () => {
  it("Adultos Avanzado final → 3 rounds × 3 min con descanso", () => {
    expect(tiempoPelea("Adultos", "Avanzado", true)).toEqual({
      rounds: 3,
      segundosPorRound: 180,
      segundosDescanso: 60,
    });
  });
  it("Adultos Avanzado eliminatoria → 1 round × 5 min", () => {
    expect(tiempoPelea("Adultos", "Avanzado", false)).toEqual({
      rounds: 1,
      segundosPorRound: 300,
      segundosDescanso: 0,
    });
  });
  it("Adultos Novato final → 1 round × 4 min", () => {
    expect(tiempoPelea("Adultos", "Novato", true)).toEqual({
      rounds: 1,
      segundosPorRound: 240,
      segundosDescanso: 0,
    });
  });
  it("Juvenil A Avanzado final → 3 rounds × 2 min", () => {
    expect(tiempoPelea("Juvenil A", "Avanzado", true)).toEqual({
      rounds: 3,
      segundosPorRound: 120,
      segundosDescanso: 60,
    });
  });
  it("Juvenil B Avanzado eliminatoria → 1 round × 3 min", () => {
    expect(tiempoPelea("Juvenil B", "Avanzado", false)).toEqual({
      rounds: 1,
      segundosPorRound: 180,
      segundosDescanso: 0,
    });
  });
  it("Juvenil D Avanzado final → 1 round × 2 min", () => {
    expect(tiempoPelea("Juvenil D", "Avanzado", true)).toEqual({
      rounds: 1,
      segundosPorRound: 120,
      segundosDescanso: 0,
    });
  });
  it("Junior Avanzado final → 3 rounds × 3 min", () => {
    expect(tiempoPelea("Junior", "Avanzado", true)).toEqual({
      rounds: 3,
      segundosPorRound: 180,
      segundosDescanso: 60,
    });
  });
  it("división o nivel inválidos lanzan", () => {
    expect(() => tiempoPelea("NoExiste", "Avanzado", false)).toThrow(
      /División no reconocida/,
    );
    expect(() => tiempoPelea("Adultos", "Maestro", false)).toThrow(
      /Nivel no reconocido/,
    );
  });
  it("devuelve una copia: mutar el resultado no altera la tabla", () => {
    const t = tiempoPelea("Adultos", "Avanzado", true);
    t.rounds = 99;
    expect(tiempoPelea("Adultos", "Avanzado", true).rounds).toBe(3);
  });
});

// El puerto compacta las 6 divisiones cuyos 4 niveles comparten tiempos en un
// helper (tiemposUniformes). Esta tabla transcribe los valores del original
// (reglamento.js:239-304) uno por uno, para probar que la compactación no
// cambió ningún tiempo.
describe("tabla de tiempos completa (9 divisiones × 4 niveles)", () => {
  const elim = (min: number) => ({
    rounds: 1,
    segundosPorRound: min * 60,
    segundosDescanso: 0,
  });
  const multi = (rounds: number, min: number, descanso: number) => ({
    rounds,
    segundosPorRound: min * 60,
    segundosDescanso: descanso * 60,
  });

  const ESPERADO: Record<
    string,
    Record<string, { eliminatoria: object; final: object }>
  > = {
    Adultos: {
      Avanzado: { eliminatoria: elim(5), final: multi(3, 3, 1) },
      Intermedio: { eliminatoria: elim(4), final: elim(4) },
      Principiante: { eliminatoria: elim(4), final: elim(4) },
      Novato: { eliminatoria: elim(4), final: elim(4) },
    },
    Junior: {
      Avanzado: { eliminatoria: elim(5), final: multi(3, 3, 1) },
      Intermedio: { eliminatoria: elim(4), final: elim(4) },
      Principiante: { eliminatoria: elim(4), final: elim(4) },
      Novato: { eliminatoria: elim(4), final: elim(4) },
    },
    "Juvenil A": {
      Avanzado: { eliminatoria: elim(4), final: multi(3, 2, 1) },
      Intermedio: { eliminatoria: elim(3), final: elim(3) },
      Principiante: { eliminatoria: elim(3), final: elim(3) },
      Novato: { eliminatoria: elim(3), final: elim(3) },
    },
    "Juvenil B": {
      Avanzado: { eliminatoria: elim(3), final: elim(3) },
      Intermedio: { eliminatoria: elim(3), final: elim(3) },
      Principiante: { eliminatoria: elim(3), final: elim(3) },
      Novato: { eliminatoria: elim(3), final: elim(3) },
    },
    "Juvenil C": {
      Avanzado: { eliminatoria: elim(3), final: elim(3) },
      Intermedio: { eliminatoria: elim(3), final: elim(3) },
      Principiante: { eliminatoria: elim(3), final: elim(3) },
      Novato: { eliminatoria: elim(3), final: elim(3) },
    },
    "Juvenil D": {
      Avanzado: { eliminatoria: elim(2), final: elim(2) },
      Intermedio: { eliminatoria: elim(2), final: elim(2) },
      Principiante: { eliminatoria: elim(2), final: elim(2) },
      Novato: { eliminatoria: elim(2), final: elim(2) },
    },
    Infantil: {
      Avanzado: { eliminatoria: elim(2), final: elim(2) },
      Intermedio: { eliminatoria: elim(2), final: elim(2) },
      Principiante: { eliminatoria: elim(2), final: elim(2) },
      Novato: { eliminatoria: elim(2), final: elim(2) },
    },
    "Mini 2": {
      Avanzado: { eliminatoria: elim(2), final: elim(2) },
      Intermedio: { eliminatoria: elim(2), final: elim(2) },
      Principiante: { eliminatoria: elim(2), final: elim(2) },
      Novato: { eliminatoria: elim(2), final: elim(2) },
    },
    "Mini 1": {
      Avanzado: { eliminatoria: elim(2), final: elim(2) },
      Intermedio: { eliminatoria: elim(2), final: elim(2) },
      Principiante: { eliminatoria: elim(2), final: elim(2) },
      Novato: { eliminatoria: elim(2), final: elim(2) },
    },
  };

  for (const division of DIVISIONES) {
    for (const nivel of NIVELES) {
      it(`${division} / ${nivel}`, () => {
        expect(tiempoPelea(division, nivel, false)).toEqual(
          ESPERADO[division]![nivel]!.eliminatoria,
        );
        expect(tiempoPelea(division, nivel, true)).toEqual(
          ESPERADO[division]![nivel]!.final,
        );
      });
    }
  }
});

describe("constantes", () => {
  it("DIVISIONES tiene 9 entradas", () => expect(DIVISIONES).toHaveLength(9));
  it("NIVELES tiene 4 entradas", () => expect(NIVELES).toHaveLength(4));
  it("METODOS_FINALIZACION tiene 11 entradas", () =>
    expect(METODOS_FINALIZACION).toHaveLength(11));
  it("METODOS_FINALIZACION incluye los métodos clave", () => {
    for (const metodo of [
      "KO",
      "Decisión",
      "Sumisión",
      "No Contest",
      "Empate",
    ]) {
      expect(METODOS_FINALIZACION).toContain(metodo);
    }
  });
});
