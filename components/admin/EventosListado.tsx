"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import EventoForm from "@/components/admin/EventoForm";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import { ESTATUS_EVENTO, EventoSchema, parseOrWarn } from "@/lib/schemas";
import type { Evento } from "@/lib/schemas";

// Puerto de legacy/admin/js/eventos-listado.js (314 líneas): grid de cards con
// filtro por estatus, cambio de estatus inline, editar y abrir.

const ResponseSchema = z.object({ eventos: z.array(EventoSchema).optional() });

const ESTATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  activo: "Activo",
  finalizado: "Finalizado",
};

/** "2026-08-15" → "sáb, 15 de agosto de 2026" (eventos-listado.js:247). */
function formatFecha(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  try {
    return d.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

export default function EventosListado() {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();

  // Por defecto "activo", igual que legacy (eventos.html marca ese botón
  // como is-active y el state arranca en "activo").
  const [filtro, setFiltro] = useState<string>("activo");
  const [editando, setEditando] = useState<Evento | null>(null);
  const [creando, setCreando] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["eventos.list"],
    queryFn: async () => {
      const raw = await api.get("eventos.list");
      return parseOrWarn(ResponseSchema, raw, "eventos.list");
    },
  });

  const cambiarEstatus = useMutation({
    mutationFn: ({ id, estatus }: { id: string; estatus: string }) =>
      api.post("eventos.setestatus", { id, estatus }),
    onSuccess: () => {
      toastSuccess("Estatus actualizado.");
      void queryClient.invalidateQueries({ queryKey: ["eventos.list"] });
    },
    onError: (e: unknown) =>
      toastError(
        e instanceof ApiError ? e.message : "No se pudo cambiar el estatus.",
      ),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.post("eventos.delete", { id }),
    onSuccess: () => {
      toastSuccess("Evento eliminado.");
      void queryClient.invalidateQueries({ queryKey: ["eventos.list"] });
    },
    onError: (e: unknown) =>
      toastError(
        e instanceof ApiError ? e.message : "No se pudo eliminar el evento.",
      ),
  });

  const eventos = useMemo(() => data?.eventos ?? [], [data]);
  const visibles = useMemo(
    () => (filtro ? eventos.filter((e) => e.estatus === filtro) : eventos),
    [eventos, filtro],
  );

  return (
    <>
      <div data-slot="main-actions" className="admin-main-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setCreando(true)}
        >
          + Nuevo evento
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <div
            className="btn-group"
            role="group"
            aria-label="Filtro de estatus"
          >
            {[
              { value: "", label: "Todos" },
              ...ESTATUS_EVENTO.map((s) => ({
                value: s,
                label: ESTATUS_LABEL[s]!,
              })),
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
        </div>
        <div className="toolbar-count" aria-live="polite">
          {isPending || isError
            ? ""
            : visibles.length === eventos.length
              ? `${visibles.length} evento${visibles.length === 1 ? "" : "s"}`
              : `${visibles.length} de ${eventos.length}`}
        </div>
      </div>

      <div className="eventos-list">
        {isPending && (
          <div className="loading-message">Cargando eventos...</div>
        )}

        {isError && (
          <div className="error-state">
            <h3>No pudimos cargar los eventos</h3>
            <p>
              {error instanceof Error ? error.message : "Error desconocido"}
            </p>
            <button
              className="btn"
              type="button"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </div>
        )}

        {!isPending && !isError && eventos.length === 0 && (
          <div className="placeholder">
            <span className="placeholder-tag">Sin eventos</span>
            <h2>Todavía no hay eventos</h2>
            <p>
              Crea el primero con el botón <strong>+ Nuevo evento</strong>.
            </p>
          </div>
        )}

        {!isPending &&
          !isError &&
          eventos.length > 0 &&
          visibles.length === 0 && (
            <div className="placeholder">
              <span className="placeholder-tag">Sin coincidencias</span>
              <h2>No hay eventos con este estatus</h2>
              <p>Prueba con otro filtro o con «Todos».</p>
            </div>
          )}

        {!isPending && !isError && visibles.length > 0 && (
          <div className="event-grid">
            {visibles.map((ev) => (
              <article
                className="event-card"
                key={ev.id}
                data-id={ev.id}
                data-estatus={ev.estatus}
              >
                <header className="event-card-header">
                  <span className={`estatus-pill estatus-${ev.estatus}`}>
                    {ESTATUS_LABEL[ev.estatus] ?? ev.estatus}
                  </span>
                  <button
                    className="event-card-edit"
                    type="button"
                    title="Editar evento"
                    aria-label={`Editar ${ev.nombre}`}
                    onClick={() => setEditando(ev)}
                  >
                    ✏️
                  </button>
                </header>

                <h3 className="event-card-title">
                  {ev.nombre || "(sin nombre)"}
                </h3>

                <dl className="event-card-meta">
                  <div>
                    <dt aria-hidden="true">📅</dt>
                    <dd>{formatFecha(ev.fecha)}</dd>
                  </div>
                  <div>
                    <dt aria-hidden="true">📍</dt>
                    <dd>{ev.sede}</dd>
                  </div>
                  <div className="event-card-id">
                    <dt aria-hidden="true">#</dt>
                    <dd>{ev.id}</dd>
                  </div>
                </dl>

                <footer className="event-card-controls">
                  <label className="event-card-estatus">
                    <span>Estatus</span>
                    <select
                      value={ev.estatus}
                      disabled={cambiarEstatus.isPending}
                      onChange={(e) =>
                        cambiarEstatus.mutate({
                          id: ev.id,
                          estatus: e.target.value,
                        })
                      }
                    >
                      {ESTATUS_EVENTO.map((s) => (
                        <option value={s} key={s}>
                          {ESTATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Link
                    className="btn btn-primary btn-sm"
                    href={`/admin/eventos/${encodeURIComponent(ev.id)}`}
                  >
                    Ver evento →
                  </Link>

                  {/* El admin viejo no exponía borrado de eventos; se añade
                      aquí por pedido del plan (N14). La confirmación deletrea
                      la consecuencia porque arrastra inscripciones y brackets. */}
                  <button
                    className="btn btn-danger btn-sm btn-icon-only"
                    type="button"
                    title="Eliminar evento"
                    aria-label={`Eliminar ${ev.nombre}`}
                    disabled={eliminar.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `¿ELIMINAR el evento "${ev.nombre}"?\n\nSe borra la fila de la Sheet junto con sus inscripciones, brackets y peleas. No se puede deshacer.\n\nSi solo quieres ocultarlo, cámbialo a "Finalizado".`,
                        )
                      ) {
                        eliminar.mutate(ev.id);
                      }
                    }}
                  >
                    🗑
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>

      {(creando || editando) && (
        <EventoForm
          evento={editando}
          onClose={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </>
  );
}
