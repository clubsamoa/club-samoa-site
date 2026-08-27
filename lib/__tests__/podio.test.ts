import { describe, expect, it } from "vitest";
import { computePodium, type PeleaPodio } from "@/lib/podio";

// Puerto de la lógica de computePodium_ de legacy/admin/js/evento-resumen.js.

const A = (id: string) => ({ id, nombre_completo: `Atleta ${id}` });

describe("computePodium", () => {
  it("sin peleas → incompleto", () => {
    expect(computePodium([])).toEqual({
      complete: false,
      first: null,
      second: null,
      thirds: [],
    });
  });

  it("final sin ganador → incompleto", () => {
    const peleas: PeleaPodio[] = [
      { ronda_idx: 0, atleta1_id: "a", atleta2_id: "b", ganador_id: "" },
    ];
    expect(computePodium(peleas).complete).toBe(false);
  });

  it("dos_atletas (solo final): 1° y 2°, sin terceros", () => {
    const peleas: PeleaPodio[] = [
      {
        ronda_idx: 0,
        atleta1_id: "a",
        atleta2_id: "b",
        atleta1: A("a"),
        atleta2: A("b"),
        ganador_id: "b",
        ganador: A("b"),
      },
    ];
    const p = computePodium(peleas);
    expect(p.complete).toBe(true);
    expect(p.first?.id).toBe("b");
    expect(p.second?.id).toBe("a");
    expect(p.thirds).toEqual([]);
  });

  it("bracket de 4: terceros = perdedores de semis", () => {
    const peleas: PeleaPodio[] = [
      {
        ronda_idx: 0,
        atleta1_id: "a",
        atleta2_id: "d",
        atleta1: A("a"),
        atleta2: A("d"),
        ganador_id: "a",
      },
      {
        ronda_idx: 0,
        atleta1_id: "b",
        atleta2_id: "c",
        atleta1: A("b"),
        atleta2: A("c"),
        ganador_id: "c",
      },
      {
        ronda_idx: 1,
        atleta1_id: "a",
        atleta2_id: "c",
        atleta1: A("a"),
        atleta2: A("c"),
        ganador_id: "c",
        ganador: A("c"),
      },
    ];
    const p = computePodium(peleas);
    expect(p.complete).toBe(true);
    expect(p.first?.id).toBe("c");
    expect(p.second?.id).toBe("a");
    expect(p.thirds.map((t) => t.id)).toEqual(["d", "b"]);
  });

  it("bracket de 3 (semi con bye): el bye NO cuenta como tercero", () => {
    const peleas: PeleaPodio[] = [
      // Semi 1: bye — v avanza sola
      {
        ronda_idx: 0,
        atleta1_id: "v",
        atleta2_id: "",
        atleta1: A("v"),
        bye: true,
        ganador_id: "v",
      },
      // Semi 2: real
      {
        ronda_idx: 0,
        atleta1_id: "x",
        atleta2_id: "y",
        atleta1: A("x"),
        atleta2: A("y"),
        ganador_id: "x",
      },
      // Final
      {
        ronda_idx: 1,
        atleta1_id: "v",
        atleta2_id: "x",
        atleta1: A("v"),
        atleta2: A("x"),
        ganador_id: "v",
        ganador: A("v"),
      },
    ];
    const p = computePodium(peleas);
    expect(p.complete).toBe(true);
    expect(p.first?.id).toBe("v");
    expect(p.second?.id).toBe("x");
    expect(p.thirds.map((t) => t.id)).toEqual(["y"]);
  });

  it("sin objetos atleta enriquecidos usa placeholders con el id", () => {
    const peleas: PeleaPodio[] = [
      { ronda_idx: 0, atleta1_id: "a", atleta2_id: "b", ganador_id: "a" },
    ];
    const p = computePodium(peleas);
    expect(p.first?.nombre_completo).toBe("a");
    expect(p.second?.nombre_completo).toBe("b");
  });
});
