// Calendario de exámenes de grado. La cadencia la define el club y se repite
// año con año, así que aquí solo van los meses: la página calcula sola el año
// que toca. Cambiar/agregar una disciplina = editar este archivo.

export type DisciplinaExamen = {
  nombre: string;
  /** Meses con examen, 1 = enero ... 12 = diciembre. */
  meses: number[];
};

export const DISCIPLINAS_CON_EXAMEN: DisciplinaExamen[] = [
  // Cada 3 meses, arrancando en diciembre.
  { nombre: "Lima Lama", meses: [3, 6, 9, 12] },
  // Cada 4 meses, arrancando en abril.
  { nombre: "Kickboxing", meses: [4, 8, 12] },
  // Cada 6 meses: junio y diciembre.
  { nombre: "Jiu Jitsu", meses: [6, 12] },
];

// MMA no entra en el calendario: no tiene mes fijo publicado y la fecha se
// confirma por WhatsApp.
export const DISCIPLINAS_SIN_MES_FIJO = ["MMA"];

/** Cuántos meses hacia adelante muestra la tira del calendario. */
export const MESES_VISIBLES = 12;
