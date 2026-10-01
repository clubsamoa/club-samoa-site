import { DISCIPLINAS_CON_EXAMEN } from "@/content/examenes";
import { ZONA_CLUB } from "@/lib/fechas";

export { ZONA_CLUB };

/** Un mes del calendario. `mes` va de 1 (enero) a 12 (diciembre). */
export type MesCalendario = { anio: number; mes: number };

const NOMBRES_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const NOMBRES_MES_CORTO = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function nombreMes(mes: number): string {
  return NOMBRES_MES[mes - 1] ?? "";
}

export function nombreMesCorto(mes: number): string {
  return NOMBRES_MES_CORTO[mes - 1] ?? "";
}

export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "diciembre 2026" */
export function etiquetaMes({ anio, mes }: MesCalendario): string {
  return `${nombreMes(mes)} ${anio}`;
}

/** Mes en curso según la zona del club (no la del visitante). */
export function mesActual(
  ahora: Date = new Date(),
  zona: string = ZONA_CLUB,
): MesCalendario {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? "0");
  return { anio: valor("year"), mes: valor("month") };
}

export function sumarMeses(
  { anio, mes }: MesCalendario,
  cantidad: number,
): MesCalendario {
  const total = anio * 12 + (mes - 1) + cantidad;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function mismoMes(a: MesCalendario, b: MesCalendario): boolean {
  return a.anio === b.anio && a.mes === b.mes;
}

/** Tira de meses consecutivos a partir de `inicio`, incluyéndolo. */
export function mesesDesde(
  inicio: MesCalendario,
  cantidad: number,
): MesCalendario[] {
  return Array.from({ length: Math.max(cantidad, 0) }, (_, i) =>
    sumarMeses(inicio, i),
  );
}

/** Disciplinas que presentan examen en ese mes, en el orden del catálogo. */
export function disciplinasDelMes(mes: number): string[] {
  return DISCIPLINAS_CON_EXAMEN.filter((disciplina) =>
    disciplina.meses.includes(mes),
  ).map((disciplina) => disciplina.nombre);
}

export function hayExamen(mes: number): boolean {
  return disciplinasDelMes(mes).length > 0;
}

/**
 * Primer mes con examen a partir de `desde`. Devuelve `null` solo si ninguna
 * disciplina tiene meses configurados.
 */
export function proximoMesConExamen(
  desde: MesCalendario,
  incluirActual = true,
): MesCalendario | null {
  const inicio = incluirActual ? 0 : 1;
  for (let salto = inicio; salto <= inicio + 12; salto += 1) {
    const candidato = sumarMeses(desde, salto);
    if (hayExamen(candidato.mes)) return candidato;
  }
  return null;
}

/** ["a", "b", "c"] -> "a, b y c" */
export function listaEnEspanol(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}
