"use client";

/* eslint-disable @next/next/no-img-element -- foto_url es externa y arbitraria */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import InscribirAtletasModal from "@/components/admin/InscribirAtletasModal";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import { AtletaSchema, InscripcionSchema, parseOrWarn } from "@/lib/schemas";

// Puerto de legacy/admin/js/evento-inscripciones.js (221 líneas): tabla de
// inscritos con categoría calculada y acción de quitar.

// El backend devuelve cada inscripción con el atleta embebido.
const InscripcionConAtleta = InscripcionSchema.extend({
  atleta: AtletaSchema.partial().optional(),
});
const ResponseSchema = z.object({
  inscripciones: z.array(InscripcionConAtleta).optional(),
});

export const ESTATUS_INSCRIPCION_LABEL: Record<string, string> = {
  pendiente_pesaje: "Pendiente pesaje",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export function iniciales(nombre: string): string {
  const partes = String(nombre).trim().split(/\s+/).slice(0, 2);
  return partes.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export function AtletaCell({
  nombre,
  fotoUrl,
  secundario,
}: {
  nombre: string;
  fotoUrl?: string;
  secundario?: string;
}) {
  return (
    <div className="atleta-cell">
      {fotoUrl && /^https?:/.test(fotoUrl) ? (
        <img className="avatar" src={fotoUrl} alt="" />
      ) : (
        <span className="avatar avatar-placeholder">{iniciales(nombre)}</span>
      )}
      <div className="atleta-info">
        <strong>{nombre || "(sin nombre)"}</strong>
        {secundario && <span className="atleta-pais">{secundario}</span>}
      </div>
    </div>
  );
}

export function GeneroBadge({ genero }: { genero?: string }) {
  if (genero === "Masculino")
    return <span className="badge badge-genero badge-m">M</span>;
  if (genero === "Femenino")
    return <span className="badge badge-genero badge-f">F</span>;
  return <>—</>;
}

export function NivelBadge({ nivel }: { nivel?: string }) {
  if (!nivel) return <>—</>;
  return (
    <span className={`badge badge-nivel badge-nivel-${nivel.toLowerCase()}`}>
      {nivel}
    </span>
  );
}

export default function EventoInscripciones({
  eventoId,
}: {
  eventoId: string;
}) {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();
  const [agregando, setAgregando] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["inscripciones.list", eventoId],
    queryFn: async () => {
      const raw = await api.get("inscripciones.list", { evento_id: eventoId });
      return parseOrWarn(ResponseSchema, raw, "inscripciones.list");
    },
  });

  const quitar = useMutation({
    mutationFn: (id: string) => api.post("inscripciones.delete", { id }),
    onSuccess: () => {
      toastSuccess("Atleta quitado del evento.");
      void queryClient.invalidateQueries({
        queryKey: ["inscripciones.list", eventoId],
      });
    },
    onError: (e: unknown) =>
      toastError(e instanceof ApiError ? e.message : "No se pudo quitar."),
  });

  const inscripciones = data?.inscripciones ?? [];

  return (
    <>
      <div className="toolbar">
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setAgregando(true)}
        >
          + Agregar atletas
        </button>
        <div className="toolbar-count" aria-live="polite">
          {isPending || isError
            ? ""
            : `${inscripciones.length} inscrito${inscripciones.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {isPending && (
        <div className="loading-message">Cargando inscripciones...</div>
      )}

      {isError && (
        <div className="error-state">
          <h3>No pudimos cargar las inscripciones</h3>
          <p>{error instanceof Error ? error.message : "Error desconocido"}</p>
        </div>
      )}

      {!isPending && !isError && inscripciones.length === 0 && (
        <div className="placeholder">
          <span className="placeholder-tag">Sin atletas</span>
          <h2>Aún no hay atletas inscritos</h2>
          <p>
            Click en <strong>+ Agregar atletas</strong> para inscribir
            competidores desde tu catálogo. Al inscribirlos, el sistema calcula
            su categoría (división + género + nivel + peso).
          </p>
        </div>
      )}

      {!isPending && !isError && inscripciones.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Género</th>
                <th>Nivel</th>
                <th>Categoría calculada</th>
                <th className="num">Peso pesaje</th>
                <th>Estatus</th>
                <th className="actions"></th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((ins) => {
                const a = ins.atleta ?? {};
                const peso =
                  ins.peso_pesaje_kg != null && Number(ins.peso_pesaje_kg) > 0
                    ? `${ins.peso_pesaje_kg} kg`
                    : null;
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
                    <td>
                      <NivelBadge nivel={a.nivel} />
                    </td>
                    <td>
                      <code className="categoria-cell">
                        {ins.categoria_calculada || "—"}
                      </code>
                    </td>
                    <td className="num">
                      {peso ?? (
                        <span className="peso-pendiente-inline">pendiente</span>
                      )}
                    </td>
                    <td>
                      <span className={`estatus-pill estatus-${ins.estatus}`}>
                        {ESTATUS_INSCRIPCION_LABEL[ins.estatus] ?? ins.estatus}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        title="Quitar del evento"
                        disabled={quitar.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `¿Quitar a ${a.nombre_completo ?? "este atleta"} del evento?\n\nSe borra su inscripción y el peso de pesaje capturado. El atleta sigue en el catálogo.`,
                            )
                          ) {
                            quitar.mutate(ins.id);
                          }
                        }}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {agregando && (
        <InscribirAtletasModal
          eventoId={eventoId}
          yaInscritos={inscripciones.map((i) => i.atleta_id)}
          onClose={() => setAgregando(false)}
        />
      )}
    </>
  );
}
