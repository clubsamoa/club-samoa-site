"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  AtletaCell,
  ESTATUS_INSCRIPCION_LABEL,
  GeneroBadge,
} from "@/components/admin/EventoInscripciones";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import { calcularCategoriaPeso, calcularDivisionEdad } from "@/lib/reglamento";
import {
  AtletaSchema,
  ESTATUS_INSCRIPCION,
  InscripcionSchema,
  parseOrWarn,
} from "@/lib/schemas";

// Puerto de legacy/admin/js/evento-pesaje.js (519 líneas). Es la pantalla de
// mayor presión operativa: se usa el día del evento con la fila de atletas
// esperando. Por eso:
//   - El peso se guarda con debounce de 500 ms, como el original.
//   - Cada fila lleva su propio indicador (Guardando… / ✓ guardado / Error),
//     porque Apps Script tarda 1-3 s y sin señal el operador no sabe si quedó.
//   - Nada bloquea la UI: se puede capturar el siguiente atleta mientras el
//     anterior sigue guardando.

const DEBOUNCE_MS = 500;

const InscripcionConAtleta = InscripcionSchema.extend({
  atleta: AtletaSchema.partial().optional(),
});
const ResponseSchema = z.object({
  inscripciones: z.array(InscripcionConAtleta).optional(),
});

type EstadoFila = { tono: "info" | "ok" | "error"; texto: string };

export default function EventoPesaje({
  eventoId,
  fechaEvento,
}: {
  eventoId: string;
  fechaEvento: string;
}) {
  const queryClient = useQueryClient();
  const { toastError } = useToast();
  const queryKey = useMemo(
    () => ["inscripciones.list", eventoId] as const,
    [eventoId],
  );

  const [filtro, setFiltro] = useState("");
  // Peso mientras se escribe, por inscripción (no controlado por el servidor).
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [estados, setEstados] = useState<Record<string, EstadoFila>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const pendientes = timers.current;
    return () => {
      for (const t of Object.values(pendientes)) clearTimeout(t);
    };
  }, []);

  const { data, isPending, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const raw = await api.get("inscripciones.list", { evento_id: eventoId });
      return parseOrWarn(ResponseSchema, raw, "inscripciones.list");
    },
  });

  const setEstado = (id: string, estado: EstadoFila | null) =>
    setEstados((prev) => {
      const next = { ...prev };
      if (estado) next[id] = estado;
      else delete next[id];
      return next;
    });

  const guardarPeso = useMutation({
    mutationFn: ({ id, peso }: { id: string; peso: number }) =>
      api.post("inscripciones.setpesopesaje", { id, peso_kg: peso }),
    onSuccess: (_res, { id }) => {
      setEstado(id, { tono: "ok", texto: "✓ guardado" });
      setTimeout(() => setEstado(id, null), 1200);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: unknown, { id }) => {
      const msg = e instanceof ApiError ? e.message : "Error al guardar";
      setEstado(id, { tono: "error", texto: msg });
      // Se descarta el borrador para que la fila vuelva al valor del servidor.
      setBorradores((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toastError(`Peso no guardado: ${msg}`);
    },
  });

  const cambiarEstatus = useMutation({
    mutationFn: ({ id, estatus }: { id: string; estatus: string }) =>
      api.post("inscripciones.setestatus", { id, estatus }),
    onMutate: ({ id }) =>
      setEstado(id, { tono: "info", texto: "Actualizando…" }),
    onSuccess: (_res, { id }) => {
      setEstado(id, null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: unknown, { id }) => {
      setEstado(id, null);
      toastError(
        e instanceof ApiError ? e.message : "No se pudo cambiar el estatus.",
      );
    },
  });

  const onPesoChange = (id: string, valor: string) => {
    setBorradores((prev) => ({ ...prev, [id]: valor }));
    if (timers.current[id]) clearTimeout(timers.current[id]);

    const trimmed = valor.trim();
    const peso = Number(trimmed);
    // Vacío o inválido: no se envía nada (igual que savePesoNow_ en legacy).
    if (!trimmed || !isFinite(peso) || peso <= 0) {
      setEstado(id, null);
      return;
    }
    setEstado(id, { tono: "info", texto: "Guardando…" });
    timers.current[id] = setTimeout(() => {
      guardarPeso.mutate({ id, peso });
    }, DEBOUNCE_MS);
  };

  const inscripciones = data?.inscripciones ?? [];
  const visibles = filtro
    ? inscripciones.filter((i) => i.estatus === filtro)
    : inscripciones;

  return (
    <>
      <div className="pesaje-toolbar">
        <div className="btn-group" role="group" aria-label="Filtro de estatus">
          {[
            { value: "", label: "Todos" },
            { value: "pendiente_pesaje", label: "Pendientes" },
            { value: "aprobado", label: "Aprobados" },
            { value: "rechazado", label: "Rechazados" },
          ].map((opt) => (
            <button
              key={opt.value || "todos"}
              className={`btn btn-sm${filtro === opt.value ? " is-active" : ""}`}
              type="button"
              aria-pressed={filtro === opt.value}
              onClick={() => setFiltro(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="toolbar-count" aria-live="polite">
          {isPending || isError
            ? ""
            : visibles.length === inscripciones.length
              ? `${visibles.length} atleta${visibles.length === 1 ? "" : "s"}`
              : `${visibles.length} de ${inscripciones.length}`}
        </div>
      </div>

      <div className="pesaje-list-wrap">
        {isPending && (
          <div className="loading-message">Cargando atletas...</div>
        )}

        {isError && (
          <div className="error-state">
            <h3>No pudimos cargar las inscripciones</h3>
            <p>
              {error instanceof Error ? error.message : "Error desconocido"}
            </p>
          </div>
        )}

        {!isPending && !isError && inscripciones.length === 0 && (
          <div className="placeholder">
            <span className="placeholder-tag">Sin atletas</span>
            <h2>No hay nadie inscrito todavía</h2>
            <p>Inscribe competidores en la pestaña Inscripciones.</p>
          </div>
        )}

        {!isPending && !isError && visibles.length > 0 && (
          <div className="table-wrap">
            <table className="data-table pesaje-table">
              <thead>
                <tr>
                  <th>Atleta</th>
                  <th>Género</th>
                  <th className="num">Peso ref.</th>
                  <th className="num">Peso pesaje</th>
                  <th>Categoría</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((ins) => {
                  const a = ins.atleta ?? {};
                  const estado = estados[ins.id];
                  // El backend devuelve 0 cuando aún no hay pesaje; el campo
                  // debe verse vacío, no con un "0" (igual que legacy,
                  // evento-pesaje.js:408).
                  const pesoGuardado = Number(ins.peso_pesaje_kg ?? 0);
                  const valorPeso =
                    borradores[ins.id] ??
                    (pesoGuardado > 0 ? String(pesoGuardado) : "");

                  // Categoría recalculada en vivo con el peso que se está
                  // escribiendo, antes de que el backend confirme.
                  const pesoNum = Number(valorPeso);
                  const division =
                    a.fecha_nacimiento && fechaEvento
                      ? calcularDivisionEdad(a.fecha_nacimiento, fechaEvento)
                      : "";
                  const categoriaViva =
                    division && a.genero && isFinite(pesoNum) && pesoNum > 0
                      ? calcularCategoriaPeso(division, a.genero, pesoNum)
                      : null;
                  const categoriaMostrada =
                    categoriaViva && division
                      ? `${division} · ${categoriaViva.nombre}`
                      : ins.categoria_calculada || "—";

                  return (
                    <tr key={ins.id} data-id={ins.id}>
                      <td>
                        <AtletaCell
                          nombre={a.nombre_completo ?? ""}
                          fotoUrl={a.foto_url}
                          secundario={a.academia}
                        />
                      </td>
                      <td>
                        <GeneroBadge genero={a.genero} />
                      </td>
                      <td className="num">
                        {a.peso_referencia_kg != null
                          ? `${a.peso_referencia_kg} kg`
                          : "—"}
                      </td>
                      <td className="num">
                        <span className="peso-input-wrap">
                          <input
                            className="peso-input"
                            type="number"
                            step="0.1"
                            min="0.1"
                            inputMode="decimal"
                            placeholder="—"
                            value={valorPeso}
                            aria-label={`Peso de pesaje de ${a.nombre_completo ?? "atleta"}`}
                            onChange={(e) =>
                              onPesoChange(ins.id, e.target.value)
                            }
                          />
                          <span className="peso-unit" aria-hidden="true">
                            kg
                          </span>
                        </span>
                        <span
                          className={`peso-status${estado?.tono === "error" ? " is-error" : ""}`}
                          role="status"
                          aria-live="polite"
                        >
                          {estado?.texto ?? ""}
                        </span>
                      </td>
                      <td>
                        <code className="categoria-cell">
                          {categoriaMostrada}
                        </code>
                        {ins.categoria_override && (
                          <span
                            className="badge badge-division"
                            title="Categoría asignada a mano"
                          >
                            manual
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          className="estatus-select"
                          value={ins.estatus}
                          aria-label={`Estatus de ${a.nombre_completo ?? "atleta"}`}
                          onChange={(e) =>
                            cambiarEstatus.mutate({
                              id: ins.id,
                              estatus: e.target.value,
                            })
                          }
                        >
                          {ESTATUS_INSCRIPCION.map((s) => (
                            <option value={s} key={s}>
                              {ESTATUS_INSCRIPCION_LABEL[s] ?? s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
