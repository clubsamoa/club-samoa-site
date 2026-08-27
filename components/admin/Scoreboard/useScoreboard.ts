"use client";

import { useEffect, useReducer, useRef } from "react";
import type { RoundScore, ScoringState, Side, TiempoConfig } from "./types";
import type { Snapshot } from "./storage";

// Estado y transiciones del scoreboard (T18/T19 de legacy) centralizados en
// un reducer puro — todas las acciones dependientes del reloj reciben `now`,
// así que las transiciones son testeables sin timers reales.
//
// ⚠ Timer sin deriva: legacy usaba setInterval(1000) acumulando restas, que
// deriva bajo re-renders. Aquí el segmento corriendo guarda `endsAt`
// (timestamp absoluto) y cada tick recalcula el restante desde Date.now();
// el intervalo solo refresca la vista, no lleva la cuenta.

export interface ScoreboardState {
  tiempo: TiempoConfig;
  currentRound: number;
  isResting: boolean;
  isRunning: boolean;
  /** Restante del segmento. Cuando corre, se recalcula desde endsAt en cada tick. */
  secondsRemaining: number;
  /** Timestamp (ms) en que acaba el segmento actual; null si está pausado. */
  endsAt: number | null;
  scoring: ScoringState;
  /** Se incrementa en cada fin de segmento — el componente toca la campana. */
  bellCount: number;
}

export type ScoreboardAction =
  | { type: "restore"; snapshot: Snapshot }
  | { type: "start"; now: number }
  | { type: "pause"; now: number }
  | { type: "tick"; now: number }
  | { type: "addTime"; delta: number; now: number }
  | { type: "resetRound"; now: number }
  | { type: "nextRound"; now: number }
  | { type: "setScore"; side: Side; points: number }
  | { type: "clearRound" }
  | { type: "adv"; side: Side; delta: 1 | -1 }
  | { type: "falta"; side: Side; delta: 1 | -1 };

function emptyRound(): RoundScore {
  return {
    a1: null,
    a2: null,
    a1_adv: 0,
    a2_adv: 0,
    a1_faltas: 0,
    a2_faltas: 0,
  };
}

export function initialScoreboardState(tiempo: TiempoConfig): ScoreboardState {
  return {
    tiempo,
    currentRound: 1,
    isResting: false,
    isRunning: false,
    secondsRemaining: tiempo.segundosPorRound,
    endsAt: null,
    scoring: {
      rounds: Array.from({ length: tiempo.rounds }, emptyRound),
    },
    bellCount: 0,
  };
}

export function isFightOver(s: ScoreboardState): boolean {
  return (
    !s.isResting && s.currentRound >= s.tiempo.rounds && s.secondsRemaining <= 0
  );
}

function remainingAt(s: ScoreboardState, now: number): number {
  if (!s.isRunning || s.endsAt === null) return s.secondsRemaining;
  return Math.max(0, Math.ceil((s.endsAt - now) / 1000));
}

function pausedAt(s: ScoreboardState, now: number): ScoreboardState {
  if (!s.isRunning) return s;
  return {
    ...s,
    isRunning: false,
    secondsRemaining: remainingAt(s, now),
    endsAt: null,
  };
}

function updateRound(
  s: ScoreboardState,
  mutate: (r: RoundScore) => RoundScore,
): ScoreboardState {
  const idx = s.currentRound - 1;
  const round = s.scoring.rounds[idx];
  if (!round) return s;
  const rounds = s.scoring.rounds.slice();
  rounds[idx] = mutate(round);
  return { ...s, scoring: { rounds } };
}

export function scoreboardReducer(
  s: ScoreboardState,
  action: ScoreboardAction,
): ScoreboardState {
  switch (action.type) {
    case "restore": {
      const snap = action.snapshot;
      const scoring =
        snap.scoring && Array.isArray(snap.scoring.rounds)
          ? snap.scoring
          : s.scoring; // merge defensivo: si el shape cambió, defaults
      return {
        ...s,
        currentRound: snap.currentRound || 1,
        secondsRemaining:
          typeof snap.secondsRemaining === "number"
            ? snap.secondsRemaining
            : s.tiempo.segundosPorRound,
        isResting: !!snap.isResting,
        // Nunca restauramos como "running" — el operador inicia manualmente
        isRunning: false,
        endsAt: null,
        scoring,
      };
    }

    case "start": {
      if (s.isRunning || s.secondsRemaining <= 0) return s;
      return {
        ...s,
        isRunning: true,
        endsAt: action.now + s.secondsRemaining * 1000,
      };
    }

    case "pause":
      return pausedAt(s, action.now);

    case "tick": {
      if (!s.isRunning || s.endsAt === null) return s;
      const remaining = remainingAt(s, action.now);
      if (remaining > 0) {
        if (remaining === s.secondsRemaining) return s; // sin cambio visible
        return { ...s, secondsRemaining: remaining };
      }

      // Tiempo agotado para el segmento actual → campana + transición
      const bell = s.bellCount + 1;
      if (s.isResting) {
        // El descanso terminó → arrancar próximo round automáticamente
        const nextRound = s.currentRound + 1;
        if (nextRound > s.tiempo.rounds) {
          // Caso defensivo, no debería pasar
          return {
            ...s,
            bellCount: bell,
            isResting: false,
            currentRound: s.tiempo.rounds,
            secondsRemaining: 0,
            isRunning: false,
            endsAt: null,
          };
        }
        return {
          ...s,
          bellCount: bell,
          isResting: false,
          currentRound: nextRound,
          secondsRemaining: s.tiempo.segundosPorRound,
          endsAt: action.now + s.tiempo.segundosPorRound * 1000,
        };
      }
      // Acabó un round
      if (s.currentRound < s.tiempo.rounds) {
        if (s.tiempo.segundosDescanso > 0) {
          return {
            ...s,
            bellCount: bell,
            isResting: true,
            secondsRemaining: s.tiempo.segundosDescanso,
            endsAt: action.now + s.tiempo.segundosDescanso * 1000,
          };
        }
        return {
          ...s,
          bellCount: bell,
          currentRound: s.currentRound + 1,
          secondsRemaining: s.tiempo.segundosPorRound,
          endsAt: action.now + s.tiempo.segundosPorRound * 1000,
        };
      }
      // Fin del último round → pelea terminada, parar timer
      return {
        ...s,
        bellCount: bell,
        secondsRemaining: 0,
        isRunning: false,
        endsAt: null,
      };
    }

    case "addTime": {
      const maxAllowed =
        (s.isResting ? s.tiempo.segundosDescanso : s.tiempo.segundosPorRound) *
        2; // permitir hasta 2x el round para casos raros
      const current = remainingAt(s, action.now);
      const next = Math.max(0, Math.min(current + action.delta, maxAllowed));
      if (s.isRunning) {
        return {
          ...s,
          secondsRemaining: next,
          endsAt: action.now + next * 1000,
        };
      }
      return { ...s, secondsRemaining: next };
    }

    case "resetRound": {
      const paused = pausedAt(s, action.now);
      return {
        ...paused,
        secondsRemaining: paused.isResting
          ? s.tiempo.segundosDescanso
          : s.tiempo.segundosPorRound,
      };
    }

    case "nextRound": {
      const paused = pausedAt(s, action.now);
      if (paused.isResting) {
        // Saltar el descanso y entrar al próximo round
        return {
          ...paused,
          isResting: false,
          currentRound: Math.min(paused.currentRound + 1, s.tiempo.rounds),
          secondsRemaining: s.tiempo.segundosPorRound,
        };
      }
      if (paused.currentRound < s.tiempo.rounds) {
        // Avanzar manualmente (con o sin descanso)
        if (s.tiempo.segundosDescanso > 0) {
          return {
            ...paused,
            isResting: true,
            secondsRemaining: s.tiempo.segundosDescanso,
          };
        }
        return {
          ...paused,
          currentRound: paused.currentRound + 1,
          secondsRemaining: s.tiempo.segundosPorRound,
        };
      }
      // Ya estábamos en el último round → no hay siguiente
      return { ...paused, secondsRemaining: 0 };
    }

    case "setScore":
      // 10-point must: al asignar <10 a un lado, el otro recibe 10.
      return updateRound(s, (r) => {
        const next = { ...r, [action.side]: action.points };
        if (action.points < 10) {
          const other: Side = action.side === "a1" ? "a2" : "a1";
          next[other] = 10;
        }
        return next;
      });

    case "clearRound":
      return updateRound(s, (r) => ({ ...r, a1: null, a2: null }));

    case "adv":
      return updateRound(s, (r) => ({
        ...r,
        [`${action.side}_adv`]: Math.max(
          0,
          r[`${action.side}_adv`] + action.delta,
        ),
      }));

    case "falta":
      return updateRound(s, (r) => ({
        ...r,
        [`${action.side}_faltas`]: Math.max(
          0,
          r[`${action.side}_faltas`] + action.delta,
        ),
      }));
  }
}

export function totalScore(scoring: ScoringState, side: Side): number {
  return scoring.rounds.reduce(
    (acc, r) => acc + (typeof r[side] === "number" ? (r[side] as number) : 0),
    0,
  );
}

export function totalAdv(scoring: ScoringState, side: Side): number {
  return scoring.rounds.reduce((acc, r) => acc + r[`${side}_adv`], 0);
}

export function totalFaltas(scoring: ScoringState, side: Side): number {
  return scoring.rounds.reduce((acc, r) => acc + r[`${side}_faltas`], 0);
}

/** Reducer + intervalo de refresco (200ms) mientras el timer corre. */
export function useScoreboard(tiempo: TiempoConfig) {
  const [state, dispatch] = useReducer(
    scoreboardReducer,
    tiempo,
    initialScoreboardState,
  );

  const isRunning = state.isRunning;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      dispatch({ type: "tick", now: Date.now() });
    }, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isRunning]);

  return [state, dispatch] as const;
}
