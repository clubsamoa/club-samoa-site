"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EventoBrackets from "@/components/admin/EventoBrackets";
import EventoForm from "@/components/admin/EventoForm";
import EventoInscripciones from "@/components/admin/EventoInscripciones";
import EventoPesaje from "@/components/admin/EventoPesaje";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import { ESTATUS_EVENTO, EventoSchema, parseOrWarn } from "@/lib/schemas";
import { useState } from "react";

// Puerto de legacy/admin/js/evento.js (337 líneas): cabecera del evento,
// pestañas y panel de detalle. Resumen queda como placeholder (tarea N18).

const ResponseSchema = z.object({ evento: EventoSchema });

const TABS = [
  { key: "detalle", label: "Detalle" },
  { key: "inscripciones", label: "Inscripciones" },
  { key: "pesaje", label: "Pesaje" },
  { key: "brackets", label: "Brackets" },
  { key: "resumen", label: "Resumen" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function esTab(valor: string | undefined): valor is TabKey {
  return TABS.some((t) => t.key === valor);
}

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

export default function EventoDetalle({
  eventoId,
  tabInicial,
}: {
  eventoId: string;
  tabInicial?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();
  const [editando, setEditando] = useState(false);
  const tablistRef = useRef<HTMLDivElement>(null);

  const tabActiva: TabKey = esTab(tabInicial) ? tabInicial : "detalle";

  const irATab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "detalle") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["eventos.get", eventoId],
    queryFn: async () => {
      const raw = await api.get("eventos.get", { id: eventoId });
      return parseOrWarn(ResponseSchema, raw, "eventos.get");
    },
  });

  const cambiarEstatus = useMutation({
    mutationFn: (estatus: string) =>
      api.post("eventos.setestatus", { id: eventoId, estatus }),
    onSuccess: () => {
      toastSuccess("Estatus actualizado.");
      void queryClient.invalidateQueries({
        queryKey: ["eventos.get", eventoId],
      });
      void queryClient.invalidateQueries({ queryKey: ["eventos.list"] });
    },
    onError: (e: unknown) =>
      toastError(
        e instanceof ApiError ? e.message : "No se pudo cambiar el estatus.",
      ),
  });

  const eliminar = useMutation({
    mutationFn: () => api.post("eventos.delete", { id: eventoId }),
    onSuccess: () => {
      toastSuccess("Evento eliminado.");
      void queryClient.invalidateQueries({ queryKey: ["eventos.list"] });
      router.push("/admin/eventos");
    },
    onError: (e: unknown) =>
      toastError(e instanceof ApiError ? e.message : "No se pudo eliminar."),
  });

  const evento = data?.evento;

  // Navegación con flechas dentro del tablist (patrón ARIA). Legacy tenía los
  // role="tab" pero sin manejo de teclado.
  const onTablistKeyDown = (event: React.KeyboardEvent) => {
    const teclas = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!teclas.includes(event.key)) return;
    event.preventDefault();
    const indice = TABS.findIndex((t) => t.key === tabActiva);
    let siguiente = indice;
    if (event.key === "ArrowRight") siguiente = (indice + 1) % TABS.length;
    if (event.key === "ArrowLeft")
      siguiente = (indice - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") siguiente = 0;
    if (event.key === "End") siguiente = TABS.length - 1;
    const destino = TABS[siguiente]!.key;
    irATab(destino);
    tablistRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab="${destino}"]`)
      ?.focus();
  };

  return (
    <>
      <AdminPageHeader
        title={evento?.nombre || (isPending ? "Cargando…" : eventoId)}
        subtitle={
          evento ? `${formatFecha(evento.fecha)} · ${evento.sede || "—"}` : ""
        }
        actions={
          <Link className="btn btn-ghost" href="/admin/eventos">
            ← Todos los eventos
          </Link>
        }
      />

      {isError && (
        <div className="error-state">
          <h3>No pudimos cargar el evento</h3>
          <p>{error instanceof Error ? error.message : "Error desconocido"}</p>
          <Link className="btn" href="/admin/eventos">
            ← Volver
          </Link>
        </div>
      )}

      {!isError && (
        <>
          <div
            className="evento-tabs"
            role="tablist"
            ref={tablistRef}
            onKeyDown={onTablistKeyDown}
          >
            {TABS.map((tab) => {
              const activa = tab.key === tabActiva;
              return (
                <button
                  key={tab.key}
                  className={`evento-tab${activa ? " is-active" : ""}`}
                  type="button"
                  role="tab"
                  data-tab={tab.key}
                  id={`tab-${tab.key}`}
                  aria-selected={activa}
                  aria-controls={`panel-${tab.key}`}
                  tabIndex={activa ? 0 : -1}
                  onClick={() => irATab(tab.key)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="evento-tab-panels">
            <section
              className="evento-tab-panel is-active"
              role="tabpanel"
              id={`panel-${tabActiva}`}
              aria-labelledby={`tab-${tabActiva}`}
              tabIndex={0}
            >
              {isPending && (
                <div className="loading-message">Cargando evento...</div>
              )}

              {!isPending && evento && tabActiva === "detalle" && (
                <div className="card">
                  <div className="evento-detalle-head">
                    <h3>Detalle del evento</h3>
                    <div className="evento-detalle-acciones">
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => setEditando(true)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        disabled={eliminar.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `¿ELIMINAR el evento "${evento.nombre}"?\n\nSe borra la fila de la Sheet junto con sus inscripciones, brackets y peleas. No se puede deshacer.\n\nSi solo quieres cerrarlo, cámbialo a "Finalizado".`,
                            )
                          ) {
                            eliminar.mutate();
                          }
                        }}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  </div>

                  <dl className="evento-detalle-dl">
                    <div className="evento-detalle-row">
                      <dt>ID</dt>
                      <dd>{evento.id}</dd>
                    </div>
                    <div className="evento-detalle-row">
                      <dt>Nombre</dt>
                      <dd>{evento.nombre || "—"}</dd>
                    </div>
                    <div className="evento-detalle-row">
                      <dt>Fecha</dt>
                      <dd>{formatFecha(evento.fecha)}</dd>
                    </div>
                    <div className="evento-detalle-row">
                      <dt>Sede</dt>
                      <dd>{evento.sede || "—"}</dd>
                    </div>
                    <div className="evento-detalle-row">
                      <dt>Estatus</dt>
                      <dd>
                        <select
                          className="estatus-select"
                          aria-label="Estatus del evento"
                          value={evento.estatus}
                          disabled={cambiarEstatus.isPending}
                          onChange={(e) =>
                            cambiarEstatus.mutate(e.target.value)
                          }
                        >
                          {ESTATUS_EVENTO.map((s) => (
                            <option value={s} key={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      </dd>
                    </div>
                    <div className="evento-detalle-row">
                      <dt>Creado</dt>
                      <dd>
                        {evento.creado_en
                          ? new Date(evento.creado_en).toLocaleString("es-MX")
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {!isPending && evento && tabActiva === "inscripciones" && (
                <EventoInscripciones eventoId={eventoId} />
              )}

              {!isPending && evento && tabActiva === "pesaje" && (
                <EventoPesaje eventoId={eventoId} fechaEvento={evento.fecha} />
              )}

              {!isPending && evento && tabActiva === "brackets" && (
                <EventoBrackets
                  eventoId={eventoId}
                  fechaEvento={evento.fecha}
                />
              )}

              {!isPending && evento && tabActiva === "resumen" && (
                <div className="placeholder">
                  <span className="placeholder-tag">Próximamente</span>
                  <h2>Resumen</h2>
                  <p>El resumen del evento llega en la tarea N18.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {editando && evento && (
        <EventoForm evento={evento} onClose={() => setEditando(false)} />
      )}
    </>
  );
}
