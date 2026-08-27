import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BracketSvg, {
  computeLayout,
  type PeleaSvg,
} from "@/components/admin/BracketSvg";
import {
  generarSingleElimination,
  type AtletaBracket,
} from "@/lib/bracket-builder";

// Puerto de legacy/admin/js/bracket-svg.test.html. La geometría (posiciones,
// viewBox, conectores) debe ser idéntica a la del renderer legacy: mismas
// constantes, mismas fórmulas. El snapshot congela el markup para detectar
// cambios accidentales de estructura.

const pool: AtletaBracket[] = [
  { id: "a1", nombre_completo: "Jorge Antonio Luna", academia: "Club Samoa" },
  {
    id: "a2",
    nombre_completo: "Kevin Daniel Santiago",
    academia: "Team Leones",
  },
  { id: "a3", nombre_completo: "Valeria Hernández", academia: "Club Samoa" },
  { id: "a4", nombre_completo: "Sebastián Ramírez", academia: "Club Samoa" },
  { id: "a5", nombre_completo: "Anna Castillo", academia: "Jiu Jitsu Academy" },
  { id: "a6", nombre_completo: "Diego Hernández", academia: "Club Samoa" },
  { id: "a7", nombre_completo: "María Torres", academia: "Team Alpha" },
  { id: "a8", nombre_completo: "Carlos Vega", academia: "Club Samoa" },
];

function makeBracket(n: number, ganadores?: Record<number, string>) {
  const atletas = pool.slice(0, n);
  const peleas = generarSingleElimination(atletas) as (ReturnType<
    typeof generarSingleElimination
  >[number] & { numero_pelea?: number })[];

  if (ganadores) {
    peleas.forEach((p) => {
      if (ganadores[p.numero] !== undefined)
        p.ganador_id = ganadores[p.numero]!;
      if (p.bye && p.auto_ganador_id && !p.ganador_id)
        p.ganador_id = p.auto_ganador_id;
    });
    // Propagar ganadores a la siguiente ronda (simulación local)
    peleas.forEach((p) => {
      if (p.pelea_anterior_1 != null) {
        const src = peleas.find((x) => x.numero === p.pelea_anterior_1);
        if (src?.ganador_id) {
          const g = atletas.find((a) => a.id === src.ganador_id);
          if (g) p.atleta1 = g;
        }
      }
      if (p.pelea_anterior_2 != null) {
        const src = peleas.find((x) => x.numero === p.pelea_anterior_2);
        if (src?.ganador_id) {
          const g = atletas.find((a) => a.id === src.ganador_id);
          if (g) p.atleta2 = g;
        }
      }
    });
  }

  // El backend usa numero_pelea, bracket-builder usa numero. Aliasamos.
  peleas.forEach((p) => {
    p.numero_pelea = p.numero;
  });

  return { peleas: peleas as PeleaSvg[] };
}

describe("computeLayout — geometría idéntica a legacy", () => {
  it("bracket vacío → solo padding", () => {
    const l = computeLayout({ peleas: [] });
    expect(l.width).toBe(32);
    expect(l.height).toBe(32);
    expect(Object.keys(l.matches)).toHaveLength(0);
  });

  it("N=2: una columna, una pelea en (16, 44)", () => {
    const l = computeLayout(makeBracket(2));
    expect(l.matches["1"]).toEqual({ x: 16, y: 44 });
    expect(l.width).toBe(2 * 16 + 220); // padding*2 + 1 columna
    expect(l.height).toBe(44 + 60 + 16);
  });

  it("N=4: R1 apilada a 96px y final en el midpoint de sus feeders", () => {
    const l = computeLayout(makeBracket(4));
    expect(l.matches["1"]).toEqual({ x: 16, y: 44 });
    expect(l.matches["2"]).toEqual({ x: 16, y: 140 });
    // Final: columna 2 (x = 16 + 220 + 56), y = (44+140)/2
    expect(l.matches["3"]).toEqual({ x: 292, y: 92 });
    expect(l.width).toBe(2 * 16 + 2 * 220 + 56);
    expect(l.height).toBe(140 + 60 + 16);
    expect(l.maxIdx).toBe(1);
  });

  it("N=8: 3 columnas y la final centrada entre semifinales", () => {
    const l = computeLayout(makeBracket(8));
    expect(l.maxIdx).toBe(2);
    expect(l.width).toBe(2 * 16 + 3 * 220 + 2 * 56);
    // R1: 4 peleas a 96px
    expect(l.matches["4"]).toEqual({ x: 16, y: 44 + 3 * 96 });
    // Semis en el midpoint de sus cuartos
    expect(l.matches["5"]!.y).toBe((44 + 140) / 2);
    expect(l.matches["6"]!.y).toBe((236 + 332) / 2);
    // Final en el midpoint de las semis
    expect(l.matches["7"]!.y).toBe((92 + 284) / 2);
  });

  it("modo compacto cambia columnas y espaciado", () => {
    const l = computeLayout(makeBracket(4), { compact: true });
    expect(l.cfg.COL_WIDTH).toBe(180);
    expect(l.matches["2"]).toEqual({ x: 16, y: 44 + 80 });
    expect(l.width).toBe(2 * 16 + 2 * 180 + 56);
  });
});

describe("BracketSvg — render declarativo", () => {
  it("N=2: una sola pelea final, sin conectores", () => {
    const html = renderToStaticMarkup(<BracketSvg bracket={makeBracket(2)} />);
    expect(html).toContain('viewBox="0 0 252 120"');
    expect(html).toContain("FINAL");
    expect(html).not.toContain("bracket-svg-connector");
    expect(html).toContain("Jorge Antonio Luna");
    expect(html).toContain("Club Samoa");
  });

  it("N=5: 3 slots BYE en R1 y atletas pre-poblados en semis", () => {
    const html = renderToStaticMarkup(<BracketSvg bracket={makeBracket(5)} />);
    expect(html.match(/bracket-svg-bye-label/g)).toHaveLength(3);
    expect(html).toContain("CUARTOS");
    expect(html).toContain("SEMIFINAL");
    expect(html).toContain("FINAL");
    // Slot TBD (esperando la única pelea real de R1)
    expect(html).toContain("bracket-svg-tbd");
  });

  it("ganador: slot resaltado con check, perdedor atenuado", () => {
    const html = renderToStaticMarkup(
      <BracketSvg bracket={makeBracket(4, { 1: "a1", 3: "a1" })} />,
    );
    expect(html.match(/is-winner/g)!.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("is-loser");
    expect(html).toContain("bracket-svg-slot-winner-bg");
    expect(html).toContain("✓");
  });

  it("nombres largos se truncan con elipsis", () => {
    const html = renderToStaticMarkup(
      <BracketSvg
        bracket={{
          peleas: [
            {
              numero_pelea: 1,
              ronda: "final",
              ronda_idx: 0,
              numero_en_ronda: 1,
              atleta1: {
                id: "x",
                nombre_completo: "Nombre Larguísimo Que No Cabe En El Slot",
              },
              atleta2: { id: "y", nombre_completo: "Corto" },
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Nombre Larguísimo Que…");
    expect(html).toContain("Corto");
  });

  it("snapshot: N=4 con ganadores parciales", () => {
    const html = renderToStaticMarkup(
      <BracketSvg bracket={makeBracket(4, { 1: "a1" })} />,
    );
    expect(html).toMatchSnapshot();
  });
});
