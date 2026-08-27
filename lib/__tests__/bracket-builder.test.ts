import { describe, expect, it } from "vitest";
import {
  agruparAtletas,
  generarBracketsParaGrupos,
  generarSingleElimination,
  nombreRonda,
  resumenPeleas,
  type AtletaBracket,
  type InscripcionParaBracket,
} from "@/lib/bracket-builder";

// Puerto de legacy/admin/js/bracket-builder.test.html — mismos casos,
// mismos valores esperados. Referencia: PRD-brackets-mma.md §8.5.

function mkAtleta(id: string, nombre?: string): AtletaBracket {
  return { id, nombre_completo: nombre || id };
}

function mkInscripcion(
  insId: string,
  atletaId: string,
  categoria: string,
  nombre?: string,
): InscripcionParaBracket {
  return {
    id: insId,
    atleta_id: atletaId,
    atleta: mkAtleta(atletaId, nombre),
    categoria_calculada: categoria,
  };
}

function mkAtletas(n: number): AtletaBracket[] {
  return Array.from({ length: n }, (_, i) => mkAtleta("a" + (i + 1)));
}

const insMixto = () => [
  mkInscripcion("ins_1", "atl_1", "Adultos / M / Avanzado / Peso Ligero"),
  mkInscripcion("ins_2", "atl_2", "Adultos / M / Avanzado / Peso Ligero"),
  mkInscripcion("ins_3", "atl_3", "Adultos / M / Avanzado / Peso Ligero"),
  mkInscripcion("ins_4", "atl_4", "Adultos / F / Intermedio / Mosca"),
  mkInscripcion("ins_5", "atl_5", "Adultos / F / Intermedio / Mosca"),
  mkInscripcion("ins_6", "atl_6", "Juvenil A / M / Novato / Pluma"),
];

describe("agruparAtletas", () => {
  it("array vacío → []", () => {
    expect(agruparAtletas([])).toEqual([]);
  });

  it("input no-array → []", () => {
    expect(agruparAtletas(null)).toEqual([]);
  });

  it("3 atletas misma categoría → 1 grupo viable single_elimination", () => {
    const grp = agruparAtletas([
      mkInscripcion("ins_1", "atl_1", "Adultos / M / Avanzado / Peso Ligero"),
      mkInscripcion("ins_2", "atl_2", "Adultos / M / Avanzado / Peso Ligero"),
      mkInscripcion("ins_3", "atl_3", "Adultos / M / Avanzado / Peso Ligero"),
    ]);
    expect(grp).toHaveLength(1);
    expect(grp[0]?.viable).toBe(true);
    expect(grp[0]?.num_atletas).toBe(3);
    expect(grp[0]?.tipo_sugerido).toBe("single_elimination");
  });

  it("1 atleta solo → grupo no viable, tipo_sugerido null", () => {
    const grp = agruparAtletas([
      mkInscripcion("ins_1", "atl_1", "Adultos / M / Avanzado / Peso Ligero"),
    ]);
    expect(grp).toHaveLength(1);
    expect(grp[0]?.viable).toBe(false);
    expect(grp[0]?.tipo_sugerido).toBeNull();
  });

  it("2 atletas misma categoría → tipo dos_atletas", () => {
    const grp = agruparAtletas([
      mkInscripcion("ins_1", "atl_1", "Junior / F / Novato / Átomo"),
      mkInscripcion("ins_2", "atl_2", "Junior / F / Novato / Átomo"),
    ]);
    expect(grp[0]?.viable).toBe(true);
    expect(grp[0]?.tipo_sugerido).toBe("dos_atletas");
  });

  it("múltiples categorías mezcladas → un grupo por categoría", () => {
    const grpMixto = agruparAtletas(insMixto());
    expect(grpMixto).toHaveLength(3);
    const ligero = grpMixto.find((g) => g.categoria.includes("Peso Ligero"));
    expect(ligero?.num_atletas).toBe(3);
    const mosca = grpMixto.find((g) => g.categoria.includes("Mosca"));
    expect(mosca?.viable).toBe(true);
    expect(mosca?.num_atletas).toBe(2);
    const pluma = grpMixto.find((g) => g.categoria.includes("Pluma"));
    expect(pluma?.viable).toBe(false);
  });
});

describe("generarSingleElimination — casos N pequeños", () => {
  it("0 atletas → []", () => {
    expect(generarSingleElimination([])).toEqual([]);
  });

  it("1 atleta → []", () => {
    expect(generarSingleElimination([mkAtleta("a")])).toEqual([]);
  });

  it("2 atletas → 1 pelea final", () => {
    const p2 = generarSingleElimination([mkAtleta("a"), mkAtleta("b")]);
    expect(p2).toHaveLength(1);
    expect(p2[0]?.ronda).toBe("final");
    expect(p2[0]?.numero).toBe(1);
    expect(p2[0]?.atleta1?.id).toBe("a");
    expect(p2[0]?.atleta2?.id).toBe("b");
    expect(p2[0]?.bye).toBe(false);
  });
});

describe("generarSingleElimination — conteos N = 3..16", () => {
  it("N=3: slots=4 → 3 totales, 1 bye, 2 reales; R1 semifinales", () => {
    const p3 = generarSingleElimination(mkAtletas(3));
    const r3 = resumenPeleas(p3);
    expect(r3).toEqual({ total: 3, reales: 2, byes: 1 });
    const r1 = p3.filter((p) => p.ronda_idx === 0);
    expect(r1).toHaveLength(2);
    expect(r1[0]?.ronda).toBe("semifinal");
    expect(r1.filter((p) => p.bye)).toHaveLength(1);
    expect(p3.filter((p) => p.ronda === "final")).toHaveLength(1);
  });

  it("N=4: slots=4 → 3 totales, 0 byes; R1 semifinales", () => {
    const p4 = generarSingleElimination(mkAtletas(4));
    expect(resumenPeleas(p4)).toEqual({ total: 3, reales: 3, byes: 0 });
    expect(
      p4.filter((p) => p.ronda_idx === 0).every((p) => p.ronda === "semifinal"),
    ).toBe(true);
  });

  it("N=5: slots=8 → 7 totales, 3 byes en R1, 4 reales; R1 cuartos", () => {
    const p5 = generarSingleElimination(mkAtletas(5));
    expect(resumenPeleas(p5)).toEqual({ total: 7, reales: 4, byes: 3 });
    expect(p5.filter((p) => p.ronda_idx === 0 && p.bye)).toHaveLength(3);
    expect(p5.filter((p) => p.ronda_idx === 0)[0]?.ronda).toBe("cuartos");
  });

  it("N=6: slots=8 → 7 totales, 2 byes, 5 reales", () => {
    const p6 = generarSingleElimination(mkAtletas(6));
    expect(resumenPeleas(p6)).toEqual({ total: 7, reales: 5, byes: 2 });
    expect(p6.filter((p) => p.ronda_idx === 0 && p.bye)).toHaveLength(2);
  });

  it("N=7: slots=8 → 7 totales, 1 bye, 6 reales", () => {
    const p7 = generarSingleElimination(mkAtletas(7));
    expect(resumenPeleas(p7)).toEqual({ total: 7, reales: 6, byes: 1 });
    expect(p7.filter((p) => p.ronda_idx === 0 && p.bye)).toHaveLength(1);
  });

  it("N=8: slots=8 → 7 totales, 0 byes", () => {
    const p8 = generarSingleElimination(mkAtletas(8));
    expect(resumenPeleas(p8)).toEqual({ total: 7, reales: 7, byes: 0 });
  });

  it("N=9: slots=16 → 15 totales, 7 byes en R1, 8 reales", () => {
    const p9 = generarSingleElimination(mkAtletas(9));
    expect(resumenPeleas(p9)).toEqual({ total: 15, reales: 8, byes: 7 });
    expect(p9.filter((p) => p.ronda_idx === 0 && p.bye)).toHaveLength(7);
  });

  it("N=16: slots=16 → 15 totales, 0 byes; R1 octavos", () => {
    const p16 = generarSingleElimination(mkAtletas(16));
    expect(resumenPeleas(p16)).toEqual({ total: 15, reales: 15, byes: 0 });
    expect(p16.filter((p) => p.ronda_idx === 0)[0]?.ronda).toBe("octavos");
  });
});

describe("estructura del bracket — números secuenciales y referencias", () => {
  it("N=4 → números secuenciales 1,2,3", () => {
    const p4 = generarSingleElimination(mkAtletas(4));
    expect(p4.map((p) => p.numero)).toEqual([1, 2, 3]);
  });

  it("N=4 → la final referencia dos peleas anteriores distintas", () => {
    const p4 = generarSingleElimination(mkAtletas(4));
    const final4 = p4.find((p) => p.ronda === "final");
    expect(final4?.pelea_anterior_1).not.toBeNull();
    expect(final4?.pelea_anterior_2).not.toBeNull();
    expect(final4?.pelea_anterior_1).not.toBe(final4?.pelea_anterior_2);
  });

  it("N=5 → los 3 atletas con bye quedan pre-poblados en R2", () => {
    const p5 = generarSingleElimination(mkAtletas(5));
    const autoIds = p5
      .filter((p) => p.ronda_idx === 0 && p.bye)
      .map((p) => p.auto_ganador_id);
    const preFilledIds: string[] = [];
    p5.filter((p) => p.ronda_idx === 1).forEach((p) => {
      if (p.atleta1) preFilledIds.push(p.atleta1.id);
      if (p.atleta2) preFilledIds.push(p.atleta2.id);
    });
    expect(preFilledIds).toHaveLength(3);
    expect(
      autoIds.every((id) => id !== null && preFilledIds.includes(id)),
    ).toBe(true);
  });
});

describe("no double-byes", () => {
  it.each([3, 5, 6, 7, 9, 16])(
    "N=%i → 0 peleas de R1 con ambos atletas null",
    (n) => {
      const peleas = generarSingleElimination(mkAtletas(n));
      const doubleByes = peleas.filter(
        (p) => p.ronda_idx === 0 && p.atleta1 === null && p.atleta2 === null,
      );
      expect(doubleByes).toHaveLength(0);
    },
  );
});

describe("nombreRonda", () => {
  it("mapea atletas en ronda → nombre", () => {
    expect(nombreRonda(2)).toBe("final");
    expect(nombreRonda(4)).toBe("semifinal");
    expect(nombreRonda(8)).toBe("cuartos");
    expect(nombreRonda(16)).toBe("octavos");
    expect(nombreRonda(32)).toBe("dieciseisavos");
    expect(nombreRonda(64)).toBe("treintaidosavos");
    expect(nombreRonda(128)).toBe("ronda_128");
  });
});

describe("generarBracketsParaGrupos", () => {
  it("genera solo para grupos viables, con tipo y peleas correctos", () => {
    const brackets = generarBracketsParaGrupos(agruparAtletas(insMixto()));
    expect(brackets).toHaveLength(2);
    const bLigero = brackets.find((b) => b.categoria.includes("Peso Ligero"));
    expect(bLigero?.tipo).toBe("single_elimination");
    expect(bLigero?.peleas).toHaveLength(3);
    const bMosca = brackets.find((b) => b.categoria.includes("Mosca"));
    expect(bMosca?.tipo).toBe("dos_atletas");
    expect(bMosca?.peleas).toHaveLength(1);
  });

  it("input no-array → []", () => {
    expect(generarBracketsParaGrupos(null)).toEqual([]);
  });
});
