/**
 * Bracket builder — agrupación de atletas y generación de single elimination.
 *
 * Puerto 1:1 de legacy/admin/js/bracket-builder.js (299 líneas). Lógica pura
 * — sin DOM, sin dependencias externas. No cambiar el algoritmo: los
 * brackets confirmados en la Sheet se generaron con esta misma lógica.
 *
 * API pública:
 *   agruparAtletas(inscripciones) → Grupo[]
 *   generarSingleElimination(atletas) → PeleaBracket[]
 *     Para 2 atletas: 1 pelea final.
 *     Para >2: bracket completo con byes distribuidos para evitar
 *     emparejamientos bye-vs-bye.
 *   generarBracketsParaGrupos(grupos) → BracketGenerado[]
 *   nombreRonda(atletasEnRonda) → string
 *   resumenPeleas(peleas) → { total, reales, byes }
 *
 * Pruebas: lib/__tests__/bracket-builder.test.ts (puerto de
 * legacy/admin/js/bracket-builder.test.html).
 */

export interface AtletaBracket {
  id: string;
  nombre_completo?: string;
  /** Referencia a la inscripción, para que la UI navegue al pesaje/quitar. */
  _inscripcion_id?: string;
  [key: string]: unknown;
}

export interface InscripcionParaBracket {
  id: string;
  atleta_id?: string;
  atleta?: AtletaBracket | null;
  categoria_calculada?: string | null;
}

export type TipoBracket = "dos_atletas" | "single_elimination";

export interface Grupo {
  categoria: string;
  atletas: AtletaBracket[];
  num_atletas: number;
  viable: boolean;
  tipo_sugerido: TipoBracket | null;
}

export interface PeleaBracket {
  ronda: string;
  /** 0 = primera ronda (inicial), max = final. */
  ronda_idx: number;
  /** Secuencial across todas las rondas (1-based). */
  numero: number;
  /** 1-based, posición dentro de la ronda. */
  numero_en_ronda: number;
  atleta1: AtletaBracket | null;
  atleta2: AtletaBracket | null;
  /** true si una de las posiciones es null. */
  bye: boolean;
  /** id del atleta que avanza automáticamente (si bye). */
  auto_ganador_id: string | null;
  /** número de la pelea cuyo ganador alimenta atleta1 (null para R1). */
  pelea_anterior_1: number | null;
  pelea_anterior_2: number | null;
  /** null por default; se llena cuando se decide el match. */
  ganador_id: string | null;
}

export interface BracketGenerado {
  categoria: string;
  tipo: TipoBracket | null;
  atletas: AtletaBracket[];
  peleas: PeleaBracket[];
}

/* ============================================================
 * Agrupación
 * ============================================================ */

/** Agrupa inscripciones por su `categoria_calculada`. */
export function agruparAtletas(
  inscripciones: InscripcionParaBracket[] | null | undefined,
): Grupo[] {
  if (!Array.isArray(inscripciones)) return [];

  const grupos: Record<string, AtletaBracket[]> = {};
  inscripciones.forEach((ins) => {
    if (!ins) return;
    const cat = ins.categoria_calculada || "(sin categoría)";
    if (!grupos[cat]) grupos[cat] = [];
    // Preferimos el objeto atleta enriquecido, pero si solo tenemos
    // atleta_id, creamos un placeholder mínimo.
    const atleta = ins.atleta || ({ id: ins.atleta_id } as AtletaBracket);
    // Agregamos referencia a la inscripción para que la UI pueda
    // navegar al pesaje/quitar fácil.
    atleta._inscripcion_id = ins.id;
    grupos[cat].push(atleta);
  });

  return Object.keys(grupos)
    .sort()
    .map((cat) => {
      const atletas = grupos[cat] ?? [];
      const n = atletas.length;
      const viable = n >= 2;
      const tipo_sugerido: TipoBracket | null = !viable
        ? null
        : n === 2
          ? "dos_atletas"
          : "single_elimination";
      return {
        categoria: cat,
        atletas,
        num_atletas: n,
        viable,
        tipo_sugerido,
      };
    });
}

/* ============================================================
 * Generación de bracket
 * ============================================================ */

/**
 * Genera todas las peleas de un bracket single-elimination.
 * Si hay menos de 2 atletas, devuelve [].
 * Para 2 atletas devuelve una sola pelea "final".
 * Para >2 atletas usa slots = potencia de 2 >= N, con byes distribuidos
 * mediante pairing (i, slots-1-i) para evitar bye-vs-bye.
 */
export function generarSingleElimination(
  atletas: AtletaBracket[] | null | undefined,
): PeleaBracket[] {
  if (!Array.isArray(atletas)) return [];
  const N = atletas.length;
  if (N < 2) return [];

  if (N === 2) {
    return [
      {
        ronda: "final",
        ronda_idx: 0,
        numero: 1,
        numero_en_ronda: 1,
        atleta1: atletas[0] ?? null,
        atleta2: atletas[1] ?? null,
        bye: false,
        auto_ganador_id: null,
        pelea_anterior_1: null,
        pelea_anterior_2: null,
        ganador_id: null,
      },
    ];
  }

  // Cálculo de slots y byes
  let slots = 1;
  while (slots < N) slots *= 2;

  // Posiciones de R1: atletas primero, byes (nulls) al final
  const posiciones: (AtletaBracket | null)[] = atletas.slice();
  while (posiciones.length < slots) posiciones.push(null);

  const peleas: PeleaBracket[] = [];
  let numero = 0;

  // Round 1: pairing (pos[i], pos[slots-1-i])
  // Esto coloca byes en posiciones opuestas a los primeros atletas,
  // garantizando que no haya bye vs bye mientras byes < slots/2.
  const matchesR1 = slots / 2;
  const rondaName1 = nombreRonda(slots);
  const peleasR1: PeleaBracket[] = [];

  for (let i = 0; i < matchesR1; i += 1) {
    const a1 = posiciones[i] ?? null;
    const a2 = posiciones[slots - 1 - i] ?? null;
    numero += 1;
    const bye = a1 === null || a2 === null;
    let auto_ganador_id: string | null = null;
    if (bye) {
      auto_ganador_id = a1 === null ? (a2 ? a2.id : null) : a1 ? a1.id : null;
    }
    const pelea: PeleaBracket = {
      ronda: rondaName1,
      ronda_idx: 0,
      numero,
      numero_en_ronda: i + 1,
      atleta1: a1,
      atleta2: a2,
      bye,
      auto_ganador_id,
      pelea_anterior_1: null,
      pelea_anterior_2: null,
      ganador_id: null,
    };
    peleas.push(pelea);
    peleasR1.push(pelea);
  }

  // Rondas siguientes (placeholders con referencias a peleas previas)
  let peleasPrevias = peleasR1;
  let atletasEnRonda = slots / 2;
  let rondaIdx = 1;

  while (atletasEnRonda > 1) {
    const matchesEnRonda = atletasEnRonda / 2;
    const rondaName = nombreRonda(atletasEnRonda);
    const nuevasPeleas: PeleaBracket[] = [];

    for (let j = 0; j < matchesEnRonda; j += 1) {
      numero += 1;
      const peleaAnt1 = peleasPrevias[j * 2];
      const peleaAnt2 = peleasPrevias[j * 2 + 1];
      if (!peleaAnt1 || !peleaAnt2) continue; // imposible: slots es pow2

      // Pre-poblar atleta1/atleta2 si la pelea anterior fue un bye
      // (sabemos el ganador automáticamente).
      const atletaPre1 = bestKnownAtleta(peleaAnt1, atletas);
      const atletaPre2 = bestKnownAtleta(peleaAnt2, atletas);

      const pelea: PeleaBracket = {
        ronda: rondaName,
        ronda_idx: rondaIdx,
        numero,
        numero_en_ronda: j + 1,
        atleta1: atletaPre1,
        atleta2: atletaPre2,
        bye: false, // las rondas siguientes nunca son byes
        auto_ganador_id: null,
        pelea_anterior_1: peleaAnt1.numero,
        pelea_anterior_2: peleaAnt2.numero,
        ganador_id: null,
      };
      peleas.push(pelea);
      nuevasPeleas.push(pelea);
    }

    peleasPrevias = nuevasPeleas;
    atletasEnRonda /= 2;
    rondaIdx += 1;
  }

  return peleas;
}

/**
 * Si la pelea anterior fue un bye, devolvemos el atleta que avanzó
 * automáticamente. Si no, devolvemos null porque hay que esperar el
 * resultado.
 */
function bestKnownAtleta(
  peleaAnterior: PeleaBracket | undefined,
  atletas: AtletaBracket[],
): AtletaBracket | null {
  if (!peleaAnterior) return null;
  if (peleaAnterior.bye && peleaAnterior.auto_ganador_id) {
    return (
      atletas.find((a) => a && a.id === peleaAnterior.auto_ganador_id) || null
    );
  }
  return null;
}

/* ============================================================
 * Helpers
 * ============================================================ */

/**
 * Nombre de la ronda según cuántos atletas inician en ella.
 * 2 → final, 4 → semifinal, 8 → cuartos, 16 → octavos, 32 →
 * dieciseisavos, 64 → treintaidosavos.
 */
export function nombreRonda(atletasEnRonda: number): string {
  switch (atletasEnRonda) {
    case 2:
      return "final";
    case 4:
      return "semifinal";
    case 8:
      return "cuartos";
    case 16:
      return "octavos";
    case 32:
      return "dieciseisavos";
    case 64:
      return "treintaidosavos";
    default:
      return "ronda_" + atletasEnRonda;
  }
}

/** Conveniencia: a partir de grupos viables, genera el bracket para cada uno. */
export function generarBracketsParaGrupos(
  grupos: Grupo[] | null | undefined,
): BracketGenerado[] {
  if (!Array.isArray(grupos)) return [];
  return grupos
    .filter((g) => g.viable)
    .map((g) => ({
      categoria: g.categoria,
      tipo: g.tipo_sugerido,
      atletas: g.atletas,
      peleas: generarSingleElimination(g.atletas),
    }));
}

/**
 * Helper que cuenta:
 *   - total: número total de peleas (incluyendo byes)
 *   - reales: peleas no-bye (las que se pelean realmente)
 *   - byes: peleas con bye
 */
export function resumenPeleas(peleas: PeleaBracket[] | null | undefined): {
  total: number;
  reales: number;
  byes: number;
} {
  if (!Array.isArray(peleas)) return { total: 0, reales: 0, byes: 0 };
  const total = peleas.length;
  const byes = peleas.filter((p) => p.bye).length;
  return { total, reales: total - byes, byes };
}
