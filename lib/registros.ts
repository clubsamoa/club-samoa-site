import { z } from "zod";

// Esquemas de los 3 formularios de legacy/students.html. Las opciones de los
// selects se copian tal cual del markup original — el backend (Code.gs) guarda
// los valores como texto en la Sheet.

export const PRODUCTOS = [
  "Rashguard",
  "Jersey",
  "Short MMA",
  "Short Kickboxing",
  "Licra (damas)",
  "Karategi",
] as const;

export const TALLAS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "Infantil 4",
  "Infantil 6",
  "Infantil 8",
  "Infantil 10",
  "Otra",
] as const;

export const DISCIPLINAS_UNIFORME = [
  "Lima Lama Kids",
  "Kickboxing",
  "Muay Thai",
  "MMA",
  "Jiu Jitsu",
  "Otra",
] as const;

export const DISCIPLINAS_EXAMEN_LIMA_KICK = [
  "Lima Lama",
  "Kickboxing",
] as const;
export const GRADOS_LIMA_KICK = [
  "Cinta Naranja",
  "Cinta Morada",
  "Cinta Azul",
  "Cinta Verde",
  "Cinta Cafe I",
  "Cinta Cafe II",
  "Cinta Cafe III",
  "Cinta Negra",
] as const;
export const FECHAS_LIMA_KICK = [
  "Marzo",
  "Abril (Kickboxing)",
  "Junio",
  "Agosto (Kickboxing)",
  "Septiembre",
  "Diciembre",
  "Diciembre (Kickboxing)",
  "Ninguna",
] as const;

export const DISCIPLINAS_EXAMEN_MMA_JJ = ["MMA", "Jiujitsu"] as const;
export const GRADOS_MMA_JJ = ["Blanca", "Azul", "Morada", "Cafe"] as const;
export const FECHAS_MMA_JJ = [
  "Mayo - Jiu Jitsu",
  "Noviembre - Jiu Jitsu",
  "MMA - TBD",
] as const;

const base = {
  nombre: z.string().trim().min(1, "Escribe el nombre del alumno."),
  whatsapp: z.string().trim().min(1, "Escribe el WhatsApp de contacto."),
  notas: z.string().trim().optional(),
};

export const UniformeSchema = z.object({
  ...base,
  disciplina: z.enum(DISCIPLINAS_UNIFORME, "Selecciona una disciplina."),
  producto: z
    .array(z.enum(PRODUCTOS))
    .min(1, "Selecciona al menos una opción."),
  talla: z.enum(TALLAS, "Selecciona una talla."),
  cantidad: z.coerce.number().int().min(1, "La cantidad mínima es 1."),
});

export const ExamenLimaKickSchema = z.object({
  ...base,
  disciplina: z.enum(
    DISCIPLINAS_EXAMEN_LIMA_KICK,
    "Selecciona una disciplina.",
  ),
  grado: z.enum(GRADOS_LIMA_KICK, "Selecciona tu grado actual."),
  fecha: z.enum(FECHAS_LIMA_KICK, "Selecciona la fecha del examen."),
});

export const ExamenMmaJjSchema = z.object({
  ...base,
  disciplina: z.enum(DISCIPLINAS_EXAMEN_MMA_JJ, "Selecciona una disciplina."),
  grado: z.enum(GRADOS_MMA_JJ, "Selecciona tu grado actual."),
  fecha: z.enum(FECHAS_MMA_JJ, "Selecciona la fecha del examen."),
});

// Variantes de formulario. El backend solo distingue "uniforme" | "examen"
// (form_type); la variante decide qué esquema valida.
export const FORM_VARIANTS = {
  uniforme: { schema: UniformeSchema, formType: "uniforme" },
  "examen-lima-kick": { schema: ExamenLimaKickSchema, formType: "examen" },
  "examen-mma-jj": { schema: ExamenMmaJjSchema, formType: "examen" },
} as const;

export type FormVariant = keyof typeof FORM_VARIANTS;

export type RegistroState =
  | { status: "idle" }
  | { status: "success"; submissionId: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };
