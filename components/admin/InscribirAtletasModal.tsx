"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  AtletaCell,
  GeneroBadge,
  NivelBadge,
} from "@/components/admin/EventoInscripciones";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import { AtletaSchema, parseOrWarn } from "@/lib/schemas";

// Puerto de legacy/admin/js/inscripciones-form.js (349 líneas): selector
// múltiple de atletas del catálogo, con búsqueda y selección masiva. El
// backend recibe todos los ids en una sola llamada (atleta_ids).

const ResponseSchema = z.object({ atletas: z.array(AtletaSchema).optional() });

export default function InscribirAtletasModal({
  eventoId,
  yaInscritos,
  onClose,
}: {
  eventoId: string;
  yaInscritos: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const buscarRef = useRef<HTMLInputElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [errorBanner, setErrorBanner] = useState("");

  const inscritos = useMemo(() => new Set(yaInscritos), [yaInscritos]);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["atletas.list"],
    queryFn: async () => {
      const raw = await api.get("atletas.list");
      return parseOrWarn(ResponseSchema, raw, "atletas.list");
    },
  });

  useEffect(() => {
    disparadorRef.current = document.activeElement as HTMLElement | null;
    buscarRef.current?.focus();
    return () => disparadorRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const foco = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!foco || foco.length === 0) return;
      const primero = foco[0]!;
      const ultimo = foco[foco.length - 1]!;
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const inscribir = useMutation({
    mutationFn: (ids: string[]) =>
      api.post("inscripciones.create", {
        evento_id: eventoId,
        atleta_ids: ids,
      }),
    onSuccess: (_data, ids) => {
      toastSuccess(
        `${ids.length} atleta${ids.length === 1 ? "" : "s"} inscrito${ids.length === 1 ? "" : "s"}.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["inscripciones.list", eventoId],
      });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : "No se pudo inscribir.";
      setErrorBanner(msg);
      toastError(msg);
    },
  });

  // Solo atletas activos y no inscritos ya en este evento.
  const disponibles = useMemo(
    () => (data?.atletas ?? []).filter((a) => a.activo && !inscritos.has(a.id)),
    [data, inscritos],
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((a) =>
      `${a.nombre_completo.toLowerCase()} ${a.academia.toLowerCase()}`.includes(
        q,
      ),
    );
  }, [disponibles, busqueda]);

  const toggle = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inscribir-title"
        ref={dialogRef}
      >
        <div className="modal-header">
          <h2 id="inscribir-title">Agregar atletas al evento</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {errorBanner && (
          <div className="modal-error" role="alert">
            {errorBanner}
          </div>
        )}

        <div className="modal-form">
          <div className="toolbar">
            <div className="toolbar-search">
              <input
                ref={buscarRef}
                type="search"
                placeholder="Buscar por nombre o academia..."
                autoComplete="off"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar atletas"
              />
            </div>
            <div className="btn-group" role="group" aria-label="Selección">
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => setSeleccion(new Set(visibles.map((a) => a.id)))}
              >
                Seleccionar visibles
              </button>
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => setSeleccion(new Set())}
              >
                Ninguno
              </button>
            </div>
            <div className="toolbar-count" aria-live="polite">
              {seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}
            </div>
          </div>

          {isPending && (
            <div className="loading-message">Cargando atletas...</div>
          )}

          {isError && (
            <div className="error-state">
              <h3>No pudimos cargar el catálogo</h3>
              <p>
                {error instanceof Error ? error.message : "Error desconocido"}
              </p>
            </div>
          )}

          {!isPending && !isError && disponibles.length === 0 && (
            <div className="placeholder">
              <span className="placeholder-tag">Sin atletas disponibles</span>
              <h2>Ya inscribiste a todo el catálogo</h2>
              <p>
                Todos los atletas activos están inscritos en este evento. Crea
                nuevos atletas desde la sección Atletas.
              </p>
            </div>
          )}

          {!isPending && !isError && disponibles.length > 0 && (
            <div className="table-wrap inscribir-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="actions"></th>
                    <th>Atleta</th>
                    <th>Género</th>
                    <th>Nivel</th>
                    <th className="num">Peso ref.</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((a) => (
                    <tr key={a.id} data-id={a.id}>
                      <td className="actions">
                        <input
                          type="checkbox"
                          checked={seleccion.has(a.id)}
                          onChange={() => toggle(a.id)}
                          aria-label={`Seleccionar ${a.nombre_completo}`}
                        />
                      </td>
                      <td>
                        <AtletaCell
                          nombre={a.nombre_completo}
                          fotoUrl={a.foto_url}
                          secundario={a.academia}
                        />
                      </td>
                      <td>
                        <GeneroBadge genero={a.genero} />
                      </td>
                      <td>
                        <NivelBadge nivel={a.nivel} />
                      </td>
                      <td className="num">
                        {a.peso_referencia_kg != null
                          ? `${a.peso_referencia_kg} kg`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onClose}
              disabled={inscribir.isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-save"
              disabled={inscribir.isPending || seleccion.size === 0}
              onClick={() => inscribir.mutate([...seleccion])}
            >
              {inscribir.isPending
                ? "Inscribiendo..."
                : `Inscribir ${seleccion.size || ""}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
