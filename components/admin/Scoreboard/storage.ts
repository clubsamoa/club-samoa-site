// Persistencia y sincronía del scoreboard (T21 de legacy, decisión D4).
//
// Se conservan TAL CUAL los mecanismos y las claves de legacy/admin/js/
// scoreboard.js para que la vista pública (N18) y cualquier ventana vieja
// sigan entendiéndose entre sí:
//   - Autosave del snapshot a localStorage (`cs_scoreboard_<peleaId>`).
//   - BroadcastChannel por pelea (mismo nombre que la clave).
//   - Pelea activa por evento (`cs_admin_current_pelea_<eventoId>`).
//   - Prefetch de la siguiente pelea en sessionStorage (un solo uso).
//
// Todo con guardas de `typeof window`: estos módulos también se importan
// desde tests en Node.

import type { PeleaScoreboard, ScoringState } from "./types";

const STORAGE_KEY_PREFIX = "cs_scoreboard_";
const PREFETCH_KEY_PREFIX = "cs_prefetch_pelea_";
const EVENT_CURRENT_PREFIX = "cs_admin_current_pelea_";

export interface Snapshot {
  peleaId: string;
  currentRound: number;
  secondsRemaining: number;
  isResting: boolean;
  isRunning: boolean; // útil para la vista pública
  scoring: ScoringState;
  savedAt: number;
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function storageKey(peleaId: string): string {
  return STORAGE_KEY_PREFIX + peleaId;
}

export function saveSnapshot(snapshot: Snapshot): void {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(
      storageKey(snapshot.peleaId),
      JSON.stringify(snapshot),
    );
  } catch {
    /* ignore */
  }
}

export function loadSnapshot(peleaId: string): Snapshot | null {
  if (!hasWindow()) return null;
  try {
    const raw = localStorage.getItem(storageKey(peleaId));
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function clearSnapshot(peleaId: string): void {
  if (!hasWindow()) return;
  try {
    localStorage.removeItem(storageKey(peleaId));
  } catch {
    /* ignore */
  }
}

/** Canal por pelea para sincronizar con la vista pública en otra ventana. */
export function openPeleaChannel(peleaId: string): BroadcastChannel | null {
  if (!hasWindow() || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(storageKey(peleaId));
  } catch {
    return null;
  }
}

export function broadcast(
  channel: BroadcastChannel | null,
  message: unknown,
): void {
  if (!channel) return;
  try {
    channel.postMessage(message);
  } catch {
    /* ignore */
  }
}

/** Clave del "pelea activa del evento" — la escucha la vista pública. */
export function eventoKey(eventoId: string): string {
  return EVENT_CURRENT_PREFIX + eventoId;
}

export interface CurrentPeleaPayload {
  pelea_id?: string;
  evento_id?: string;
  bracket_id?: string;
  at?: number;
}

/** Lee la pelea activa publicada por el admin para un evento. */
export function readCurrentPelea(eventoId: string): CurrentPeleaPayload | null {
  if (!hasWindow()) return null;
  try {
    const raw = localStorage.getItem(eventoKey(eventoId));
    return raw ? (JSON.parse(raw) as CurrentPeleaPayload) : null;
  } catch {
    return null;
  }
}

/** Canal evento-scoped por el que el admin anuncia cambios de pelea. */
export function openEventoChannel(eventoId: string): BroadcastChannel | null {
  if (!hasWindow() || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(eventoKey(eventoId));
  } catch {
    return null;
  }
}

/**
 * Publica la pelea activa para que una vista pública abierta con el evento
 * pueda re-engancharse sola cuando el admin cambia de pelea. Escribe en
 * localStorage (storage event) y en un BroadcastChannel evento-scoped.
 */
export function publishCurrentPelea(pelea: PeleaScoreboard): void {
  if (!hasWindow()) return;
  const eventoId = pelea.bracket?.evento_id;
  if (!eventoId || !pelea.id) return;

  const payload = {
    pelea_id: pelea.id,
    evento_id: eventoId,
    bracket_id: pelea.bracket?.id || pelea.bracket_id || "",
    at: Date.now(),
  };
  try {
    localStorage.setItem(
      EVENT_CURRENT_PREFIX + eventoId,
      JSON.stringify(payload),
    );
  } catch {
    /* ignore */
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(EVENT_CURRENT_PREFIX + eventoId);
      ch.postMessage(payload);
      // Cerrar de inmediato puede tirar el mensaje (se despacha en una task
      // posterior). El storage event de arriba es el respaldo, pero damos
      // margen al canal también.
      setTimeout(() => ch.close(), 2000);
    }
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------
 * Handoff de la próxima pelea entre páginas.
 *
 * peleas.finalize devuelve la siguiente pelea enriquecida; la guardamos
 * en sessionStorage y la página siguiente la pinta al instante sin un
 * peleas.get extra (~2s menos por pelea en vivo). Un solo uso, caduca
 * a los 30s para no pintar datos viejos.
 * ------------------------------------------------------------------ */

export function stashPrefetchedPelea(
  peleaId: string,
  pelea: PeleaScoreboard,
): void {
  if (!hasWindow() || !peleaId || !pelea) return;
  try {
    sessionStorage.setItem(
      PREFETCH_KEY_PREFIX + peleaId,
      JSON.stringify({ savedAt: Date.now(), pelea }),
    );
  } catch {
    /* ignore */
  }
}

export function readPrefetchedPelea(peleaId: string): PeleaScoreboard | null {
  if (!hasWindow() || !peleaId) return null;
  try {
    const raw = sessionStorage.getItem(PREFETCH_KEY_PREFIX + peleaId);
    if (!raw) return null;
    sessionStorage.removeItem(PREFETCH_KEY_PREFIX + peleaId); // un solo uso
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      pelea?: PeleaScoreboard;
    };
    if (!parsed?.pelea) return null;
    if (Date.now() - (parsed.savedAt || 0) > 30000) return null;
    return parsed.pelea;
  } catch {
    return null;
  }
}
