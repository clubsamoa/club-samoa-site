"use client";

import { useRef, useState } from "react";
import useModalFocus from "@/components/admin/useModalFocus";
import { METODOS_FINALIZACION } from "@/lib/reglamento";
import type { PeleaScoreboard } from "./types";

// Modal de finalización (T20 de legacy) en sus dos modos:
//  - "create": finalizar la pelea, con smart defaults del marcador actual.
//  - "edit":   editar un resultado ya guardado (viene de feat/23).
// La validación y el submit real los hace el padre vía onSubmit; aquí vive
// el formulario, los errores por campo y el banner de error.

export type GanadorValue = "a1" | "a2" | "empate";

export interface FinalizeValues {
  ganador: GanadorValue;
  metodo: string;
  round: string;
  tiempo: string;
  notas: string;
}

export interface FinalizeInitial {
  ganador: GanadorValue | null;
  metodo: string;
  round: string;
  tiempo: string;
  notas: string;
  resumen: string; // texto del hint bajo el resultado (solo create)
}

export default function FinalizarModal({
  mode,
  pelea,
  initial,
  maxRound,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  pelea: PeleaScoreboard;
  initial: FinalizeInitial;
  maxRound: number;
  onClose: () => void;
  onSubmit: (values: FinalizeValues) => Promise<void>;
}) {
  const [ganador, setGanador] = useState<GanadorValue | null>(initial.ganador);
  const [metodo, setMetodo] = useState(initial.metodo);
  const [round, setRound] = useState(initial.round);
  const [tiempo, setTiempo] = useState(initial.tiempo);
  const [notas, setNotas] = useState(initial.notas);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const metodoRef = useRef<HTMLSelectElement>(null);

  const a1Name = pelea.atleta1?.nombre_completo || "Atleta 1";
  const a2Name = pelea.atleta2?.nombre_completo || "Atleta 2";

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose, metodoRef);

  const onMetodoChange = (v: string) => {
    setMetodo(v);
    // "Empate" / "No Contest" no tienen ganador individual → auto-marcar.
    // Para Descalificación/Abandono/No Pasó Pesaje/etc. hay un ganador
    // implícito (el otro atleta): lo selecciona el operador.
    if (/^(Empate|No Contest)$/i.test(v)) setGanador("empate");
  };

  const submit = async () => {
    if (saving) return;
    setBannerError(null);

    const errs: Record<string, string> = {};
    if (!ganador) errs.ganador = "Selecciona un resultado";
    if (!metodo) errs.metodo = "Selecciona el método";
    const tiempoVal = tiempo.trim();
    if (tiempoVal && !/^[0-9]{1,2}:[0-5][0-9]$/.test(tiempoVal)) {
      errs.tiempo = "Formato: MM:SS (ej. 02:35)";
    }
    const roundNum = round === "" ? "" : Number(round);
    if (round !== "" && (!isFinite(Number(roundNum)) || Number(roundNum) < 1)) {
      errs.round = "Debe ser ≥ 1";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    setSavingLabel("Guardando…");
    try {
      await onSubmit({
        ganador: ganador!,
        metodo,
        round,
        tiempo: tiempoVal,
        notas: notas.trim(),
      });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      setSavingLabel(null);
    }
  };

  const saveLabel =
    savingLabel ??
    (mode === "edit" ? "Guardar cambios" : "Guardar y volver al bracket");

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalizar-title"
        ref={dialogRef}
      >
        <div className="modal-header">
          <h2 id="finalizar-title">
            {mode === "edit"
              ? "Editar resultado de la pelea"
              : "Finalizar pelea"}
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {bannerError && (
          <div className="modal-error" role="alert">
            {bannerError}
          </div>
        )}

        <form
          className="modal-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="form-grid">
            <div
              className={`form-field form-field-full${errors.ganador ? " has-error" : ""}`}
            >
              <span className="form-label">Resultado *</span>
              <div className="radio-group ganador-radio">
                {(
                  [
                    { value: "a1", label: a1Name },
                    { value: "a2", label: a2Name },
                    { value: "empate", label: "Empate / No contest" },
                  ] as const
                ).map((opt) => (
                  <label className="radio-pill" key={opt.value}>
                    <input
                      type="radio"
                      name="ganador"
                      value={opt.value}
                      checked={ganador === opt.value}
                      onChange={() => setGanador(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {mode === "edit" ? (
                <small className="form-hint" style={{ marginTop: 8 }}>
                  <strong style={{ color: "var(--accent-amber)" }}>
                    ⚠ Editando resultado existente.
                  </strong>{" "}
                  Si cambias al ganador, las peleas siguientes del bracket
                  pueden quedar inconsistentes y necesitar actualización manual.
                </small>
              ) : (
                <small className="form-hint" style={{ marginTop: 8 }}>
                  {initial.resumen}
                </small>
              )}
              {errors.ganador && (
                <small className="form-error">{errors.ganador}</small>
              )}
            </div>

            <label
              className={`form-field form-field-full${errors.metodo ? " has-error" : ""}`}
            >
              <span className="form-label">Método de finalización *</span>
              <select
                name="metodo"
                required
                ref={metodoRef}
                value={metodo}
                onChange={(e) => onMetodoChange(e.target.value)}
              >
                <option value="">Selecciona...</option>
                {METODOS_FINALIZACION.map((m) => (
                  <option value={m} key={m}>
                    {m}
                  </option>
                ))}
              </select>
              {errors.metodo && (
                <small className="form-error">{errors.metodo}</small>
              )}
            </label>

            <label className={`form-field${errors.round ? " has-error" : ""}`}>
              <span className="form-label">Round</span>
              <input
                type="number"
                name="round"
                min={1}
                max={maxRound}
                value={round}
                onChange={(e) => setRound(e.target.value)}
              />
              {errors.round && (
                <small className="form-error">{errors.round}</small>
              )}
            </label>

            <label className={`form-field${errors.tiempo ? " has-error" : ""}`}>
              <span className="form-label">Tiempo (MM:SS)</span>
              <input
                type="text"
                name="tiempo"
                placeholder="03:00"
                value={tiempo}
                onChange={(e) => setTiempo(e.target.value)}
              />
              <small className="form-hint">
                Tiempo transcurrido del round cuando terminó.
              </small>
              {errors.tiempo && (
                <small className="form-error">{errors.tiempo}</small>
              )}
            </label>

            <label className="form-field form-field-full">
              <span className="form-label">Notas (opcional)</span>
              <textarea
                name="notas"
                rows={2}
                placeholder="Detalles del cierre, lesión, sub específico..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-cancel"
              type="button"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
