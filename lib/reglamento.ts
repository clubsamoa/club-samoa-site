/**
 * Reglamento Unificado de Artes Marciales Mixtas 2025 (FAMM / IMMAF).
 *
 * Puerto 1:1 de legacy/admin/js/reglamento.js. Módulo de cálculos puros — sin
 * DOM, sin red. Codifica las tablas oficiales (págs. 2–6, 11, 14) para que el
 * resto de la app no las reinvente.
 *
 * No se cambió ninguna regla, umbral ni tiempo. Además de tipos y export ES,
 * la única diferencia estructural es que las 6 divisiones cuyos 4 niveles
 * comparten tiempos usan el helper `tiemposUniformes` en vez de repetir el
 * literal. La equivalencia se prueba en lib/__tests__/reglamento.test.ts, que
 * transcribe las 9 × 4 combinaciones del original una por una.
 *
 * Convención de strings: los nombres son exactamente los del reglamento (con
 * acentos) para que el operador los reconozca al instante.
 */

export const GENEROS = ["Masculino", "Femenino"] as const;
export type Genero = (typeof GENEROS)[number];

export const DIVISIONES = [
  "Mini 1",
  "Mini 2",
  "Infantil",
  "Juvenil D",
  "Juvenil C",
  "Juvenil B",
  "Juvenil A",
  "Junior",
  "Adultos",
] as const;
export type Division = (typeof DIVISIONES)[number];

export const NIVELES = [
  "Novato",
  "Principiante",
  "Intermedio",
  "Avanzado",
] as const;
export type Nivel = (typeof NIVELES)[number];

/**
 * Lista simplificada estilo Smoothcomp (traducida). Cubre los métodos
 * operacionales más comunes en un evento de un día. Detalles: pág. 14 del PDF.
 */
export const METODOS_FINALIZACION = [
  "Decisión",
  "Sumisión",
  "TKO",
  "KO",
  "Descalificación",
  "Abandono",
  "Empate",
  "No Contest",
  "No Pasó Pesaje",
  "No Pasó Examen Médico",
  "No Se Presentó",
] as const;
export type MetodoFinalizacion = (typeof METODOS_FINALIZACION)[number];

export type CategoriaPeso = { nombre: string; pesoMax: number };
export type TiempoPelea = {
  rounds: number;
  segundosPorRound: number;
  segundosDescanso: number;
};

// Pág. 2: divisiones por edad.
const EDAD_RANGOS: Array<{ division: Division; min: number; max: number }> = [
  { division: "Mini 1", min: 4, max: 5 },
  { division: "Mini 2", min: 6, max: 7 },
  { division: "Infantil", min: 8, max: 9 },
  { division: "Juvenil D", min: 10, max: 11 },
  { division: "Juvenil C", min: 12, max: 13 },
  { division: "Juvenil B", min: 14, max: 15 },
  { division: "Juvenil A", min: 16, max: 17 },
  { division: "Junior", min: 18, max: 20 },
  { division: "Adultos", min: 21, max: 150 },
];

/**
 * Pág. 6: divisiones por nivel. El reglamento usa rangos en "años y meses";
 * se convierten a años decimales para comparar contra anios_practica.
 *   Novato ≤ 1 · Principiante (1, 2] · Intermedio (2, 3] · Avanzado > 3
 */
const NIVEL_RANGOS: Array<{
  nivel: Nivel;
  min: number;
  max: number;
  maxInclusivo: boolean;
}> = [
  { nivel: "Novato", min: 0, max: 1, maxInclusivo: true },
  { nivel: "Principiante", min: 1, max: 2, maxInclusivo: true },
  { nivel: "Intermedio", min: 2, max: 3, maxInclusivo: true },
  { nivel: "Avanzado", min: 3, max: Infinity, maxInclusivo: true },
];

// Págs. 3-5: divisiones por peso. Para cada (división, género) se lista la
// categoría con su peso MAX en kg. `pesoMax` significa "menos de X kg". La
// última de cada lista lleva Infinity (categoría abierta).
//
// NOTA: para Mini 1 / Mini 2 el reglamento dice "se conformarán las categorías
// basándose en la complexión física", dando rangos sin nombre formal; se
// codifican como "Mini Cat. N" y el operador puede ajustar a mano.

const PESOS_MINI: CategoriaPeso[] = [
  { nombre: "Mini Cat. 1", pesoMax: 23 },
  { nombre: "Mini Cat. 2", pesoMax: 26 },
  { nombre: "Mini Cat. 3", pesoMax: 29 },
  { nombre: "Mini Cat. 4", pesoMax: 32 },
  { nombre: "Mini Cat. 5", pesoMax: 35 },
  { nombre: "Mini Cat. 6", pesoMax: 38 },
  { nombre: "Mini Cat. 7", pesoMax: 41 },
  { nombre: "Mini Cat. 8", pesoMax: 47 },
  { nombre: "Mini Cat. 9", pesoMax: 50 },
  { nombre: "Mini Cat. 10", pesoMax: 53 },
  { nombre: "Mini Cat. 11", pesoMax: 56 },
  { nombre: "Mini Cat. 12", pesoMax: 59 },
  { nombre: "Mini Cat. Abierta", pesoMax: Infinity },
];

const PESOS_INFANTIL: CategoriaPeso[] = [
  { nombre: "Menos 24 kg", pesoMax: 24 },
  { nombre: "Menos 27 kg", pesoMax: 27 },
  { nombre: "Menos 31 kg", pesoMax: 31 },
  { nombre: "Menos 34 kg", pesoMax: 34 },
  { nombre: "Menos 37 kg", pesoMax: 37 },
  { nombre: "Menos 40 kg", pesoMax: 40 },
  { nombre: "Menos 44 kg", pesoMax: 44 },
  { nombre: "Menos 48 kg", pesoMax: 48 },
  { nombre: "Menos 52 kg", pesoMax: 52 },
  { nombre: "Menos 57 kg", pesoMax: 57 },
  { nombre: "Menos 62 kg", pesoMax: 62 },
  { nombre: "Menos 65 kg", pesoMax: 65 },
  { nombre: "Más de 65 kg", pesoMax: Infinity },
];

const PESOS_JUVENIL_D: CategoriaPeso[] = [
  { nombre: "Menos 30 kg", pesoMax: 30 },
  { nombre: "Menos 34 kg", pesoMax: 34 },
  { nombre: "Menos 37 kg", pesoMax: 37 },
  { nombre: "Menos 40 kg", pesoMax: 40 },
  { nombre: "Menos 44 kg", pesoMax: 44 },
  { nombre: "Menos 48 kg", pesoMax: 48 },
  { nombre: "Menos 52 kg", pesoMax: 52 },
  { nombre: "Menos 57 kg", pesoMax: 57 },
  { nombre: "Menos 62 kg", pesoMax: 62 },
  { nombre: "Menos 65 kg", pesoMax: 65 },
  { nombre: "Menos 70 kg", pesoMax: 70 },
  { nombre: "Más de 70 kg", pesoMax: Infinity },
];

const PESOS_JUVENIL_C: CategoriaPeso[] = [
  { nombre: "Menos 40 kg", pesoMax: 40 },
  { nombre: "Menos 44 kg", pesoMax: 44 },
  { nombre: "Menos 48 kg", pesoMax: 48 },
  { nombre: "Menos 52 kg", pesoMax: 52 },
  { nombre: "Menos 57 kg", pesoMax: 57 },
  { nombre: "Menos 62 kg", pesoMax: 62 },
  { nombre: "Menos 67 kg", pesoMax: 67 },
  { nombre: "Menos 72 kg", pesoMax: 72 },
  { nombre: "Menos 77 kg", pesoMax: 77 },
  { nombre: "Menos 82 kg", pesoMax: 82 },
  { nombre: "Más de 82 kg", pesoMax: Infinity },
];

// Juvenil B comparte rango con Juvenil C (pág. 3, misma columna).
const PESOS_JUVENIL_B = PESOS_JUVENIL_C;

const PESOS_JUVENIL_A_VARONIL: CategoriaPeso[] = [
  { nombre: "Paja", pesoMax: 52.2 },
  { nombre: "Mosca", pesoMax: 56.7 },
  { nombre: "Gallo", pesoMax: 61.2 },
  { nombre: "Pluma", pesoMax: 65.8 },
  { nombre: "Ligero", pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio", pesoMax: 83.9 },
  { nombre: "Supermedio", pesoMax: 88.4 },
  { nombre: "Semipesado", pesoMax: 93 },
  { nombre: "Más de 93 kg", pesoMax: Infinity },
];

const PESOS_JUVENIL_A_FEMENIL: CategoriaPeso[] = [
  { nombre: "Átomo", pesoMax: 47.6 },
  { nombre: "Paja", pesoMax: 52.2 },
  { nombre: "Mosca", pesoMax: 56.7 },
  { nombre: "Gallo", pesoMax: 61.2 },
  { nombre: "Pluma", pesoMax: 65.8 },
  { nombre: "Ligero", pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio", pesoMax: 83 },
  { nombre: "Más de 83 kg", pesoMax: Infinity },
];

const PESOS_JUNIOR_ADULTOS_VARONIL: CategoriaPeso[] = [
  { nombre: "Peso Paja", pesoMax: 52.2 },
  { nombre: "Peso Mosca", pesoMax: 56.7 },
  { nombre: "Peso Gallo", pesoMax: 61.2 },
  { nombre: "Peso Pluma", pesoMax: 65.8 },
  { nombre: "Peso Ligero", pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio", pesoMax: 83.9 },
  { nombre: "Supermedio", pesoMax: 88.4 },
  { nombre: "Semipesado", pesoMax: 93 },
  { nombre: "Pesado", pesoMax: 97 },
  { nombre: "Superpesado", pesoMax: Infinity },
];

const PESOS_JUNIOR_ADULTOS_FEMENIL: CategoriaPeso[] = [
  { nombre: "Átomo", pesoMax: 47.7 },
  { nombre: "Paja", pesoMax: 52.2 },
  { nombre: "Mosca", pesoMax: 56.7 },
  { nombre: "Gallo", pesoMax: 61.2 },
  { nombre: "Pluma", pesoMax: 65.8 },
  { nombre: "Ligero", pesoMax: 70.3 },
  { nombre: "Superligero", pesoMax: 74.8 },
  { nombre: "Superwelter", pesoMax: 79.4 },
  { nombre: "Medio", pesoMax: 83.9 },
  { nombre: "Supermedio", pesoMax: 88.4 },
  { nombre: "Más de 88.4 kg", pesoMax: Infinity },
];

// ---------------------------------------------------------------
// Tiempos de pelea por categoría (pág. 6)
// ---------------------------------------------------------------

function tiempoEliminatoria(min: number): TiempoPelea {
  return { rounds: 1, segundosPorRound: min * 60, segundosDescanso: 0 };
}

function tiempoFinalMultiRound(
  rounds: number,
  min: number,
  descansoMin: number,
): TiempoPelea {
  return {
    rounds,
    segundosPorRound: min * 60,
    segundosDescanso: descansoMin * 60,
  };
}

/** Igual para las 4 divisiones infantiles/juveniles bajas: 1 round de N min. */
function tiemposUniformes(min: number) {
  const t = {
    eliminatoria: tiempoEliminatoria(min),
    final: tiempoEliminatoria(min),
  };
  return {
    Avanzado: t,
    Intermedio: t,
    Principiante: t,
    Novato: t,
  };
}

const TIEMPOS: Record<
  Division,
  Record<Nivel, { eliminatoria: TiempoPelea; final: TiempoPelea }>
> = {
  Adultos: {
    Avanzado: {
      eliminatoria: tiempoEliminatoria(5),
      final: tiempoFinalMultiRound(3, 3, 1),
    },
    Intermedio: {
      eliminatoria: tiempoEliminatoria(4),
      final: tiempoEliminatoria(4),
    },
    Principiante: {
      eliminatoria: tiempoEliminatoria(4),
      final: tiempoEliminatoria(4),
    },
    Novato: {
      eliminatoria: tiempoEliminatoria(4),
      final: tiempoEliminatoria(4),
    },
  },
  Junior: {
    Avanzado: {
      eliminatoria: tiempoEliminatoria(5),
      final: tiempoFinalMultiRound(3, 3, 1),
    },
    Intermedio: {
      eliminatoria: tiempoEliminatoria(4),
      final: tiempoEliminatoria(4),
    },
    Principiante: {
      eliminatoria: tiempoEliminatoria(4),
      final: tiempoEliminatoria(4),
    },
    Novato: {
      eliminatoria: tiempoEliminatoria(4),
      final: tiempoEliminatoria(4),
    },
  },
  "Juvenil A": {
    Avanzado: {
      eliminatoria: tiempoEliminatoria(4),
      final: tiempoFinalMultiRound(3, 2, 1),
    },
    Intermedio: {
      eliminatoria: tiempoEliminatoria(3),
      final: tiempoEliminatoria(3),
    },
    Principiante: {
      eliminatoria: tiempoEliminatoria(3),
      final: tiempoEliminatoria(3),
    },
    Novato: {
      eliminatoria: tiempoEliminatoria(3),
      final: tiempoEliminatoria(3),
    },
  },
  "Juvenil B": tiemposUniformes(3),
  "Juvenil C": tiemposUniformes(3),
  "Juvenil D": tiemposUniformes(2),
  Infantil: tiemposUniformes(2),
  "Mini 2": tiemposUniformes(2),
  "Mini 1": tiemposUniformes(2),
};

// ---------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------

function toDate(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value) {
    // Construcción manual para evitar el desfase de zona horaria con
    // "YYYY-MM-DD", que JS interpreta como UTC.
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      const d = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
      return isNaN(d.getTime()) ? null : d;
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function edadAFecha(
  fechaNacimiento: Date,
  fechaReferencia: Date,
): number {
  let edad = fechaReferencia.getFullYear() - fechaNacimiento.getFullYear();
  const m = fechaReferencia.getMonth() - fechaNacimiento.getMonth();
  if (
    m < 0 ||
    (m === 0 && fechaReferencia.getDate() < fechaNacimiento.getDate())
  ) {
    edad -= 1;
  }
  return edad;
}

// ---------------------------------------------------------------
// Funciones públicas
// ---------------------------------------------------------------

/** División por edad del atleta a la fecha del evento. "" si está fuera de rango. */
export function calcularDivisionEdad(
  fechaNacimiento: string | Date | null | undefined,
  fechaEvento: string | Date | null | undefined,
): Division | "" {
  const fn = toDate(fechaNacimiento);
  const fe = toDate(fechaEvento);
  if (!fn || !fe) return "";
  const edad = edadAFecha(fn, fe);
  for (const rango of EDAD_RANGOS) {
    if (edad >= rango.min && edad <= rango.max) return rango.division;
  }
  return "";
}

/** Nivel sugerido a partir de los años de práctica (decimal). */
export function sugerirNivel(aniosPractica: number | string): Nivel | "" {
  const a = Number(aniosPractica);
  if (!isFinite(a) || a < 0) return "";
  for (let i = 0; i < NIVEL_RANGOS.length; i += 1) {
    const r = NIVEL_RANGOS[i]!;
    const ok = a > r.min || (i === 0 && a >= r.min); // el primer rango incluye 0
    if (ok && (a < r.max || (r.maxInclusivo && a <= r.max))) {
      return r.nivel;
    }
  }
  return "Avanzado";
}

/** Tabla de categorías de peso para una división y género. */
export function categoriasPesoPara(
  division: string,
  genero: string,
): CategoriaPeso[] {
  switch (division) {
    case "Mini 1":
    case "Mini 2":
      return PESOS_MINI.slice();
    case "Infantil":
      return PESOS_INFANTIL.slice();
    case "Juvenil D":
      return PESOS_JUVENIL_D.slice();
    case "Juvenil C":
      return PESOS_JUVENIL_C.slice();
    case "Juvenil B":
      return PESOS_JUVENIL_B.slice();
    case "Juvenil A":
      return genero === "Femenino"
        ? PESOS_JUVENIL_A_FEMENIL.slice()
        : PESOS_JUVENIL_A_VARONIL.slice();
    case "Junior":
    case "Adultos":
      return genero === "Femenino"
        ? PESOS_JUNIOR_ADULTOS_FEMENIL.slice()
        : PESOS_JUNIOR_ADULTOS_VARONIL.slice();
    default:
      return [];
  }
}

/** Categoría de peso: la más baja cuyo pesoMax > pesoKg. */
export function calcularCategoriaPeso(
  division: string,
  genero: string,
  pesoKg: number | string,
): CategoriaPeso | null {
  const peso = Number(pesoKg);
  if (!isFinite(peso) || peso <= 0) return null;
  const lista = categoriasPesoPara(division, genero);
  for (const categoria of lista) {
    if (peso < categoria.pesoMax) return categoria;
  }
  // Si el peso supera todas las cotas finitas, devolvemos la abierta.
  return lista.length ? lista[lista.length - 1]! : null;
}

/** Tiempo de pelea para una categoría, según el reglamento (pág. 6). */
export function tiempoPelea(
  division: string,
  nivel: string,
  esFinal: boolean,
): TiempoPelea {
  const porDivision = TIEMPOS[division as Division];
  if (!porDivision) throw new Error("División no reconocida: " + division);
  const porNivel = porDivision[nivel as Nivel];
  if (!porNivel) throw new Error("Nivel no reconocido: " + nivel);
  return { ...(esFinal ? porNivel.final : porNivel.eliminatoria) };
}

/** Internos, expuestos para tests (equivalente a Reglamento._internal). */
export const _internal = { EDAD_RANGOS, NIVEL_RANGOS, TIEMPOS, edadAFecha };
