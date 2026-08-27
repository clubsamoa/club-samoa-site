"use client";

import type { Dispatch } from "react";
import type { ScoreboardAction, ScoreboardState } from "./useScoreboard";
import { totalScore } from "./useScoreboard";
import type { PeleaScoreboard, Side } from "./types";

// Panel de puntos (T19 — 10-point must) + advertencias/faltas + resumen por
// round. En práctica casi nunca se llega a 10-7: botones 10/9/8.

const PUNTOS = [10, 9, 8];

function ExtrasButtons({
  side,
  dispatch,
}: {
  side: Side;
  dispatch: Dispatch<ScoreboardAction>;
}) {
  return (
    <div className="scoring-extras" data-side={side}>
      <button
        className="btn btn-sm btn-extra"
        type="button"
        onClick={() => dispatch({ type: "adv", side, delta: 1 })}
      >
        + Adv
      </button>
      <button
        className="btn btn-sm btn-extra btn-extra-minus"
        type="button"
        title="Quitar advertencia"
        onClick={() => dispatch({ type: "adv", side, delta: -1 })}
      >
        −
      </button>
      <button
        className="btn btn-sm btn-extra"
        type="button"
        onClick={() => dispatch({ type: "falta", side, delta: 1 })}
      >
        + Falta
      </button>
      <button
        className="btn btn-sm btn-extra btn-extra-minus"
        type="button"
        title="Quitar falta"
        onClick={() => dispatch({ type: "falta", side, delta: -1 })}
      >
        −
      </button>
    </div>
  );
}

export default function ScoringPanel({
  state,
  pelea,
  dispatch,
}: {
  state: ScoreboardState;
  pelea: PeleaScoreboard;
  dispatch: Dispatch<ScoreboardAction>;
}) {
  const a1Name = pelea.atleta1?.nombre_completo || "Atleta 1";
  const a2Name = pelea.atleta2?.nombre_completo || "Atleta 2";
  const round = state.scoring.rounds[state.currentRound - 1];

  const scoringRow = (side: Side, name: string) => (
    <div className="scoring-row">
      <div className={`scoring-atleta-name scoring-atleta-name-${side}`}>
        {name}
      </div>
      <div className="scoring-buttons" data-side={side}>
        {PUNTOS.map((pts) => (
          <button
            className={`btn btn-score${round && round[side] === pts ? " is-active" : ""}`}
            type="button"
            key={pts}
            onClick={() => dispatch({ type: "setScore", side, points: pts })}
          >
            {pts}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="scoreboard-scoring">
      {scoringRow("a1", a1Name)}
      {scoringRow("a2", a2Name)}
      <div className="scoring-extras-row">
        <ExtrasButtons side="a1" dispatch={dispatch} />
        <button
          className="btn btn-sm btn-clear-round"
          type="button"
          title="Limpiar puntajes del round actual"
          onClick={() => dispatch({ type: "clearRound" })}
        >
          Limpiar round
        </button>
        <ExtrasButtons side="a2" dispatch={dispatch} />
      </div>
      <div className="scoring-summary">
        <div className="scoring-summary-rounds">
          {state.scoring.rounds.map((r, idx) => (
            <div
              className={`scoring-summary-row${idx + 1 === state.currentRound ? " is-current" : ""}`}
              key={idx}
            >
              <span className="ssr-label">R{idx + 1}</span>
              <span className="ssr-a1">{r.a1 ?? "—"}</span>
              <span className="ssr-divider">—</span>
              <span className="ssr-a2">{r.a2 ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="scoring-summary-totals">
          Total:{" "}
          <strong>
            {totalScore(state.scoring, "a1")} —{" "}
            {totalScore(state.scoring, "a2")}
          </strong>
        </div>
      </div>
    </div>
  );
}
