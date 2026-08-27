// Tipos del scoreboard. La pelea llega de peleas.get / peleas.finalize ya
// enriquecida por el backend (enrichPelea_ en Eventos.gs): atleta1/atleta2/
// ganador como objetos cortos y bracket con { id, categoria, evento_id }.

export interface AtletaCorto {
  id?: string;
  nombre_completo?: string;
  academia?: string;
  pais?: string;
}

export interface PeleaScoreboard {
  id: string;
  bracket_id?: string;
  ronda?: string;
  numero_pelea?: number | string | null;
  atleta1_id?: string;
  atleta2_id?: string;
  atleta1?: AtletaCorto | null;
  atleta2?: AtletaCorto | null;
  ganador_id?: string;
  ganador?: AtletaCorto | null;
  metodo_finalizacion?: string;
  round_finalizacion?: number | string | null;
  tiempo_finalizacion?: string;
  notas?: string;
  bracket?: {
    id?: string;
    categoria?: string;
    tipo_bracket?: string;
    evento_id?: string;
  } | null;
}

export interface TiempoConfig {
  rounds: number;
  segundosPorRound: number;
  segundosDescanso: number;
}

export interface RoundScore {
  a1: number | null;
  a2: number | null;
  a1_adv: number;
  a2_adv: number;
  a1_faltas: number;
  a2_faltas: number;
}

export interface ScoringState {
  rounds: RoundScore[];
}

export type Side = "a1" | "a2";

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m < 10 ? "0" + m : m}:${ss < 10 ? "0" + ss : ss}`;
}

/**
 * tiempo_finalizacion puede venir como "02:35" o como
 * "Sat Dec 30 1899 02:35:00 GMT-..." si Google Sheets lo coerció a Date.
 * Extraemos MM:SS limpio; si el original difería, devolvemos también el
 * raw para mostrarlo en letra mini como referencia.
 */
export function formatTiempoFinalizacion(raw: string | undefined | null): {
  clean: string;
  raw: string;
} {
  if (!raw) return { clean: "", raw: "" };
  const s = String(raw).trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const clean = m[1]!.length === 1 ? `0${m[1]}:${m[2]}` : `${m[1]}:${m[2]}`;
    return { clean, raw: clean === s ? "" : s };
  }
  return { clean: s, raw: "" };
}

export function initialsOf(name: string): string {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}
