import { z } from "zod";
import { api } from "@/lib/api-client";
import { parseOrWarn } from "@/lib/schemas";

// Carga de brackets con peleas enriquecidas, compartida por las pestañas
// Brackets (N16) y Resumen (N18).
//
// brackets.listfull / brackets.get devuelven el bracket con sus peleas ya
// enriquecidas (objetos atleta embebidos). Validamos lo que leemos y dejamos
// pasar el resto tal cual hacia <BracketSvg> / computePodium.

export const PeleaFullSchema = z.looseObject({
  id: z.string().optional(),
  ganador_id: z.string().nullish(),
});

export const BracketFullSchema = z.looseObject({
  id: z.string(),
  categoria: z.string().catch(""),
  estatus: z.string().catch(""),
  num_atletas: z.union([z.number(), z.string(), z.null()]).optional(),
  peleas: z.array(PeleaFullSchema).catch([]),
});
export type BracketFull = z.infer<typeof BracketFullSchema>;

const ListFullResponseSchema = z.object({
  brackets: z.array(BracketFullSchema).catch([]),
});
const ListResponseSchema = z.object({
  brackets: z.array(z.looseObject({ id: z.string() })).catch([]),
});
const GetResponseSchema = z.object({ bracket: BracketFullSchema });

export async function fetchBrackets(eventoId: string): Promise<BracketFull[]> {
  // Fast path: un SOLO request trae todos los brackets con sus peleas.
  // Si el backend no tiene brackets.listfull desplegado, método clásico.
  try {
    const raw = await api.get("brackets.listfull", { evento_id: eventoId });
    return parseOrWarn(ListFullResponseSchema, raw, "brackets.listfull")
      .brackets;
  } catch {
    const rawList = await api.get("brackets.list", { evento_id: eventoId });
    const lista = parseOrWarn(
      ListResponseSchema,
      rawList,
      "brackets.list",
    ).brackets;
    if (lista.length === 0) return [];
    const details = await Promise.all(
      lista.map((b) => api.get("brackets.get", { id: b.id })),
    );
    return details.map(
      (d) => parseOrWarn(GetResponseSchema, d, "brackets.get").bracket,
    );
  }
}
