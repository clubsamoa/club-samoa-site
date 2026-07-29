import { z } from "zod";

// Esquemas del dominio de Eventos MMA, derivados de los *_FIELDS de
// registration-backend/apps-script/Eventos.gs (fuente de verdad del backend).
//
// Convenciones de serialización del backend (normalizeOutput_,
// Eventos.gs:541-599):
//   - string vacío "" cuando la celda está vacía (nunca null para strings)
//   - number | null (null si la celda está vacía o no es numérica)
//   - boolean (false si vacío)
//   - date  -> "yyyy-MM-dd" · datetime -> string ISO-like
//
// Las Sheets siguen siendo la fuente de verdad; Zod es la red que avisa si
// la forma de los datos cambia.

export const GENEROS = ["Masculino", "Femenino"] as const;
export const NIVELES = [
  "Novato",
  "Principiante",
  "Intermedio",
  "Avanzado",
] as const;
export const ESTATUS_EVENTO = ["borrador", "activo", "finalizado"] as const;
export const ESTATUS_INSCRIPCION = [
  "pendiente_pesaje",
  "aprobado",
  "rechazado",
] as const;
export const ESTATUS_BRACKET = [
  "borrador",
  "confirmado",
  "en_curso",
  "finalizado",
] as const;

// Celdas numéricas vacías llegan como null; algunas rutas viejas devuelven "".
const numeroNullable = z
  .union([z.number(), z.null(), z.literal("")])
  .transform((v) => (v === "" ? null : v));

export const AtletaSchema = z.object({
  id: z.string(),
  nombre_completo: z.string(),
  fecha_nacimiento: z.string(), // "yyyy-MM-dd"
  genero: z.enum(GENEROS),
  anios_practica: numeroNullable,
  nivel: z.enum(NIVELES),
  peso_referencia_kg: numeroNullable,
  academia: z.string(),
  pais: z.string(),
  foto_url: z.string(),
  activo: z.boolean(),
  creado_en: z.string(),
});
export type Atleta = z.infer<typeof AtletaSchema>;

export const EventoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  fecha: z.string(), // "yyyy-MM-dd"
  sede: z.string(),
  estatus: z.enum(ESTATUS_EVENTO),
  creado_en: z.string(),
});
export type Evento = z.infer<typeof EventoSchema>;

export const InscripcionSchema = z.object({
  id: z.string(),
  evento_id: z.string(),
  atleta_id: z.string(),
  peso_pesaje_kg: numeroNullable,
  categoria_calculada: z.string(),
  estatus: z.enum(ESTATUS_INSCRIPCION),
  creado_en: z.string(),
  categoria_override: z.boolean(),
});
export type Inscripcion = z.infer<typeof InscripcionSchema>;

export const BracketSchema = z.object({
  id: z.string(),
  evento_id: z.string(),
  categoria: z.string(),
  tipo_bracket: z.string(),
  num_atletas: numeroNullable,
  estatus: z.enum(ESTATUS_BRACKET),
  json_estructura: z.string(), // JSON serializado; lo parsea bracket-builder
  creado_en: z.string(),
});
export type Bracket = z.infer<typeof BracketSchema>;

export const PeleaSchema = z.object({
  id: z.string(),
  bracket_id: z.string(),
  ronda: z.string(),
  numero_pelea: numeroNullable,
  atleta1_id: z.string(),
  atleta2_id: z.string(),
  ganador_id: z.string(),
  metodo_finalizacion: z.string(),
  round_finalizacion: numeroNullable,
  tiempo_finalizacion: z.string(),
  notas: z.string(),
  actualizado_en: z.string(),
  ronda_idx: numeroNullable,
  numero_en_ronda: numeroNullable,
  bye: z.boolean(),
  auto_ganador_id: z.string(),
  pelea_anterior_1: numeroNullable,
  pelea_anterior_2: numeroNullable,
});
export type Pelea = z.infer<typeof PeleaSchema>;

/**
 * Valida la respuesta del backend contra un esquema. En desarrollo un
 * mismatch lanza (ruidoso, se arregla en el momento); en producción loggea
 * y devuelve los datos sin validar para no tumbar la pantalla por una
 * columna nueva en la Sheet.
 */
export function parseOrWarn<T extends z.ZodType>(
  schema: T,
  data: unknown,
  context: string,
): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const detail = result.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  const message = `[schemas] Respuesta inesperada en ${context}: ${detail}`;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(message);
  }
  console.error(message);
  return data as z.infer<T>;
}
