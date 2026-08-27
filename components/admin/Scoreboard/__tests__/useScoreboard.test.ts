import { describe, expect, it } from "vitest";
import type { Snapshot } from "../storage";
import {
  initialScoreboardState,
  isFightOver,
  scoreboardReducer,
  totalAdv,
  totalFaltas,
  totalScore,
  type ScoreboardAction,
  type ScoreboardState,
} from "../useScoreboard";

// El reducer recibe `now` en cada acción dependiente del reloj, así que las
// transiciones del timer se prueban con timestamps inyectados — sin timers
// reales y sin deriva posible.

const TIEMPO = { rounds: 2, segundosPorRound: 180, segundosDescanso: 60 };
const T0 = 1_000_000;

function run(
  state: ScoreboardState,
  ...actions: ScoreboardAction[]
): ScoreboardState {
  return actions.reduce(scoreboardReducer, state);
}

describe("timer anclado a Date.now (sin deriva)", () => {
  it("start fija endsAt y tick recalcula el restante desde el reloj", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "start", now: T0 });
    expect(s.isRunning).toBe(true);
    expect(s.endsAt).toBe(T0 + 180_000);

    // 65.4s después: el restante sale del reloj, no de restas acumuladas
    s = run(s, { type: "tick", now: T0 + 65_432 });
    expect(s.secondsRemaining).toBe(115); // ceil(114.568)
  });

  it("ticks perdidos no derivan: un solo tick tardío aterriza igual", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "start", now: T0 });
    // Supón que la pestaña se congeló 90s y solo llega un tick
    s = run(s, { type: "tick", now: T0 + 90_037 });
    expect(s.secondsRemaining).toBe(90);
  });

  it("pause congela el restante calculado y start reanuda desde ahí", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "start", now: T0 }, { type: "pause", now: T0 + 30_000 });
    expect(s.isRunning).toBe(false);
    expect(s.endsAt).toBeNull();
    expect(s.secondsRemaining).toBe(150);

    s = run(s, { type: "start", now: T0 + 99_000 });
    expect(s.endsAt).toBe(T0 + 99_000 + 150_000);
  });

  it("start no arranca con 0 segundos ni corriendo", () => {
    let s = initialScoreboardState(TIEMPO);
    s = { ...s, secondsRemaining: 0 };
    expect(run(s, { type: "start", now: T0 })).toBe(s);
  });
});

describe("transiciones de segmento (round → descanso → round → fin)", () => {
  it("fin de round 1 → descanso corriendo + campana", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "start", now: T0 }, { type: "tick", now: T0 + 180_000 });
    expect(s.isResting).toBe(true);
    expect(s.currentRound).toBe(1);
    expect(s.secondsRemaining).toBe(60);
    expect(s.isRunning).toBe(true);
    expect(s.bellCount).toBe(1);
  });

  it("fin del descanso → round 2 arranca automáticamente", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "start", now: T0 },
      { type: "tick", now: T0 + 180_000 }, // → descanso
      { type: "tick", now: T0 + 240_000 }, // → round 2
    );
    expect(s.isResting).toBe(false);
    expect(s.currentRound).toBe(2);
    expect(s.secondsRemaining).toBe(180);
    expect(s.isRunning).toBe(true);
    expect(s.bellCount).toBe(2);
  });

  it("fin del último round → pelea terminada, timer parado", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "start", now: T0 },
      { type: "tick", now: T0 + 180_000 },
      { type: "tick", now: T0 + 240_000 },
      { type: "tick", now: T0 + 420_000 },
    );
    expect(s.isRunning).toBe(false);
    expect(s.secondsRemaining).toBe(0);
    expect(s.bellCount).toBe(3);
    expect(isFightOver(s)).toBe(true);
  });

  it("sin descanso configurado, salta directo al siguiente round", () => {
    let s = initialScoreboardState({ ...TIEMPO, segundosDescanso: 0 });
    s = run(s, { type: "start", now: T0 }, { type: "tick", now: T0 + 180_000 });
    expect(s.isResting).toBe(false);
    expect(s.currentRound).toBe(2);
    expect(s.secondsRemaining).toBe(180);
  });
});

describe("controles manuales", () => {
  it("addTime suma/resta con tope de 2x el segmento y piso 0", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "addTime", delta: 300, now: T0 });
    expect(s.secondsRemaining).toBe(360); // 2 × 180
    s = run(s, { type: "addTime", delta: -1000, now: T0 });
    expect(s.secondsRemaining).toBe(0);
  });

  it("addTime corriendo re-ancla endsAt", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "start", now: T0 },
      { type: "addTime", delta: 10, now: T0 + 60_000 },
    );
    expect(s.secondsRemaining).toBe(130);
    expect(s.endsAt).toBe(T0 + 60_000 + 130_000);
  });

  it("resetRound pausa y restaura el segmento completo", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "start", now: T0 },
      { type: "resetRound", now: T0 + 42_000 },
    );
    expect(s.isRunning).toBe(false);
    expect(s.secondsRemaining).toBe(180);
  });

  it("nextRound desde descanso salta al siguiente round pausado", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "start", now: T0 },
      { type: "tick", now: T0 + 180_000 }, // descanso
      { type: "nextRound", now: T0 + 190_000 },
    );
    expect(s.isResting).toBe(false);
    expect(s.currentRound).toBe(2);
    expect(s.secondsRemaining).toBe(180);
    expect(s.isRunning).toBe(false);
  });

  it("nextRound con descanso configurado entra al descanso", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "nextRound", now: T0 });
    expect(s.isResting).toBe(true);
    expect(s.secondsRemaining).toBe(60);
  });

  it("nextRound en el último round deja el reloj en 0", () => {
    let s = initialScoreboardState({ ...TIEMPO, rounds: 1 });
    s = run(s, { type: "nextRound", now: T0 });
    expect(s.currentRound).toBe(1);
    expect(s.secondsRemaining).toBe(0);
    expect(isFightOver(s)).toBe(true);
  });
});

describe("scoring — 10-point must", () => {
  it("asignar <10 a un lado pone 10 al otro", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "setScore", side: "a1", points: 9 });
    expect(s.scoring.rounds[0]).toMatchObject({ a1: 9, a2: 10 });
  });

  it("asignar 10 no toca al otro lado", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "setScore", side: "a1", points: 10 });
    expect(s.scoring.rounds[0]).toMatchObject({ a1: 10, a2: null });
  });

  it("los puntos caen en el round ACTUAL", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "setScore", side: "a1", points: 10 },
      { type: "setScore", side: "a2", points: 9 },
      { type: "nextRound", now: T0 }, // → descanso
      { type: "nextRound", now: T0 }, // → round 2
      { type: "setScore", side: "a2", points: 10 },
      { type: "setScore", side: "a1", points: 8 },
    );
    expect(s.scoring.rounds[0]).toMatchObject({ a1: 10, a2: 9 });
    expect(s.scoring.rounds[1]).toMatchObject({ a1: 8, a2: 10 });
    expect(totalScore(s.scoring, "a1")).toBe(18);
    expect(totalScore(s.scoring, "a2")).toBe(19);
  });

  it("clearRound limpia solo puntos del round actual", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "setScore", side: "a1", points: 9 },
      { type: "adv", side: "a1", delta: 1 },
      { type: "clearRound" },
    );
    expect(s.scoring.rounds[0]).toMatchObject({
      a1: null,
      a2: null,
      a1_adv: 1,
    });
  });

  it("advertencias y faltas suman por round, con piso en 0", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(
      s,
      { type: "adv", side: "a1", delta: 1 },
      { type: "falta", side: "a2", delta: 1 },
      { type: "falta", side: "a2", delta: 1 },
      { type: "falta", side: "a2", delta: -1 },
      { type: "adv", side: "a2", delta: -1 }, // ya está en 0
    );
    expect(totalAdv(s.scoring, "a1")).toBe(1);
    expect(totalFaltas(s.scoring, "a2")).toBe(1);
    expect(totalAdv(s.scoring, "a2")).toBe(0);
  });
});

describe("restauración de snapshot (T21)", () => {
  const snapshot: Snapshot = {
    peleaId: "pel_test",
    currentRound: 2,
    secondsRemaining: 47,
    isResting: false,
    isRunning: true, // aunque diga running…
    scoring: {
      rounds: [
        { a1: 10, a2: 9, a1_adv: 1, a2_adv: 0, a1_faltas: 0, a2_faltas: 2 },
        {
          a1: null,
          a2: null,
          a1_adv: 0,
          a2_adv: 0,
          a1_faltas: 0,
          a2_faltas: 0,
        },
      ],
    },
    savedAt: T0,
  };

  it("restaura round, reloj y marcador, pero NUNCA arranca solo", () => {
    let s = initialScoreboardState(TIEMPO);
    s = run(s, { type: "restore", snapshot });
    expect(s.currentRound).toBe(2);
    expect(s.secondsRemaining).toBe(47);
    expect(s.isRunning).toBe(false);
    expect(s.endsAt).toBeNull();
    expect(totalScore(s.scoring, "a1")).toBe(10);
    expect(totalFaltas(s.scoring, "a2")).toBe(2);
  });

  it("snapshot con shape viejo conserva el scoring por defecto", () => {
    let s = initialScoreboardState(TIEMPO);
    const roto = { ...snapshot, scoring: undefined } as unknown as Snapshot;
    s = run(s, { type: "restore", snapshot: roto });
    expect(s.scoring.rounds).toHaveLength(2);
    expect(totalScore(s.scoring, "a1")).toBe(0);
  });
});
