"use client";

/* eslint-disable @next/next/no-img-element -- foto_url es externa y arbitraria */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import AtletaForm from "@/components/admin/AtletaForm";
import { useToast } from "@/components/admin/Toaster";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import { calcularDivisionEdad, edadAFecha, NIVELES } from "@/lib/reglamento";
import { AtletaSchema, parseOrWarn, type Atleta } from "@/lib/schemas";

// Puerto de legacy/admin/js/atletas-listado.js (402 líneas): tabla con
// búsqueda, filtros de género y nivel, contador, y acciones por fila.

const ResponseSchema = z.object({ atletas: z.array(AtletaSchema).optional() });

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0]![0]! + (partes[1]?.[0] ?? "")).toUpperCase();
}

function GeneroBadge({ genero }: { genero: string }) {
  if (genero === "Masculino")
    return <span className="badge badge-genero badge-m">M</span>;
  if (genero === "Femenino")
    return <span className="badge badge-genero badge-f">F</span>;
  return <>—</>;
}

function NivelBadge({ nivel }: { nivel: string }) {
  if (!nivel) return <>—</>;
  return (
    <span className={`badge badge-nivel badge-nivel-${nivel.toLowerCase()}`}>
      {nivel}
    </span>
  );
}

export default function AtletasListado() {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();

  const [search, setSearch] = useState("");
  const [genero, setGenero] = useState("");
  const [nivel, setNivel] = useState("");
  const [editando, setEditando] = useState<Atleta | null>(null);
  const [creando, setCreando] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["atletas.list"],
    queryFn: async () => {
      const raw = await api.get("atletas.list");
      return parseOrWarn(ResponseSchema, raw, "atletas.list");
    },
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.post("atletas.delete", { id }),
    onSuccess: () => {
      toastSuccess("Atleta eliminado.");
      void queryClient.invalidateQueries({ queryKey: ["atletas.list"] });
    },
    onError: (e: unknown) =>
      toastError(e instanceof ApiError ? e.message : "No se pudo eliminar."),
  });

  const archivar = useMutation({
    mutationFn: (id: string) => api.post("atletas.archive", { id }),
    onSuccess: () => {
      toastSuccess("Atleta archivado.");
      void queryClient.invalidateQueries({ queryKey: ["atletas.list"] });
    },
    onError: (e: unknown) =>
      toastError(e instanceof ApiError ? e.message : "No se pudo archivar."),
  });

  const atletas = useMemo(() => data?.atletas ?? [], [data]);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return atletas.filter((a) => {
      if (genero && a.genero !== genero) return false;
      if (nivel && a.nivel !== nivel) return false;
      if (q) {
        const hay = `${a.nombre_completo.toLowerCase()} ${a.academia.toLowerCase()}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [atletas, search, genero, nivel]);

  const hoy = todayISO();

  return (
    <>
      <div data-slot="main-actions" className="admin-main-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setCreando(true)}
        >
          + Nuevo atleta
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <input
            type="search"
            placeholder="Buscar por nombre o academia..."
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar atletas"
          />
        </div>

        <div className="toolbar-filters">
          <div className="btn-group" role="group" aria-label="Filtro de género">
            {[
              { value: "", label: "Todos" },
              { value: "Masculino", label: "Masculino" },
              { value: "Femenino", label: "Femenino" },
            ].map((opt) => (
              <button
                key={opt.value || "todos"}
                className={`btn btn-sm${genero === opt.value ? " is-active" : ""}`}
                type="button"
                aria-pressed={genero === opt.value}
                onClick={() => setGenero(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="select-wrap">
            <span className="select-label">Nivel</span>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
              <option value="">Todos</option>
              {NIVELES.map((n) => (
                <option value={n} key={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toolbar-count" aria-live="polite">
          {isPending || isError
            ? ""
            : visibles.length === atletas.length
              ? `${visibles.length} atleta${visibles.length === 1 ? "" : "s"}`
              : `${visibles.length} de ${atletas.length}`}
        </div>
      </div>

      <div className="atletas-list">
        {isPending && (
          <div className="loading-message">Cargando atletas...</div>
        )}

        {isError && (
          <div className="error-state">
            <h3>No pudimos cargar los atletas</h3>
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

        {!isPending && !isError && atletas.length === 0 && (
          <div className="placeholder">
            <span className="placeholder-tag">Sin atletas</span>
            <h2>El catálogo está vacío</h2>
            <p>
              Agrega tu primer atleta con el botón{" "}
              <strong>+ Nuevo atleta</strong>.
            </p>
          </div>
        )}

        {!isPending &&
          !isError &&
          atletas.length > 0 &&
          visibles.length === 0 && (
            <div className="placeholder">
              <span className="placeholder-tag">Sin coincidencias</span>
              <h2>No encontré atletas con estos filtros</h2>
              <p>
                Prueba quitar la búsqueda o cambiar el filtro de género / nivel.
              </p>
            </div>
          )}

        {!isPending && !isError && visibles.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Atleta</th>
                  <th>Género</th>
                  <th>Edad</th>
                  <th>División</th>
                  <th>Nivel</th>
                  <th className="num">Peso ref.</th>
                  <th>Academia</th>
                  <th className="actions"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => {
                  const nacimiento = a.fecha_nacimiento
                    ? new Date(
                        Number(a.fecha_nacimiento.slice(0, 4)),
                        Number(a.fecha_nacimiento.slice(5, 7)) - 1,
                        Number(a.fecha_nacimiento.slice(8, 10)),
                      )
                    : null;
                  const edad = nacimiento
                    ? edadAFecha(nacimiento, new Date())
                    : "";
                  const division = a.fecha_nacimiento
                    ? calcularDivisionEdad(a.fecha_nacimiento, hoy) || "—"
                    : "";

                  return (
                    <tr key={a.id} data-id={a.id}>
                      <td>
                        <div className="atleta-cell">
                          {a.foto_url && /^https?:/.test(a.foto_url) ? (
                            <img className="avatar" src={a.foto_url} alt="" />
                          ) : (
                            <span className="avatar avatar-placeholder">
                              {iniciales(a.nombre_completo || "?")}
                            </span>
                          )}
                          <div className="atleta-info">
                            <strong>
                              {a.nombre_completo || "(sin nombre)"}
                            </strong>
                            {a.pais && (
                              <span className="atleta-pais">{a.pais}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <GeneroBadge genero={a.genero} />
                      </td>
                      <td className="num">{edad === "" ? "—" : edad}</td>
                      <td>
                        {division ? (
                          <span className="badge badge-division">
                            {division}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <NivelBadge nivel={a.nivel} />
                      </td>
                      <td className="num">
                        {a.peso_referencia_kg != null
                          ? `${a.peso_referencia_kg} kg`
                          : "—"}
                      </td>
                      <td>{a.academia}</td>
                      <td className="actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          title="Editar atleta"
                          onClick={() => setEditando(a)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          title="Archivar atleta (deja de aparecer en el catálogo)"
                          disabled={archivar.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `¿Archivar a ${a.nombre_completo}?\n\nDeja de aparecer en el catálogo, pero se conserva en la Sheet y en el historial de eventos.`,
                              )
                            ) {
                              archivar.mutate(a.id);
                            }
                          }}
                        >
                          Archivar
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon-only"
                          type="button"
                          title="Eliminar atleta"
                          disabled={eliminar.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `¿ELIMINAR a ${a.nombre_completo}?\n\nEsta acción borra la fila de la Sheet y no se puede deshacer. Si solo quieres que deje de aparecer, usa Archivar.`,
                              )
                            ) {
                              eliminar.mutate(a.id);
                            }
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creando || editando) && (
        <AtletaForm
          atleta={editando}
          onClose={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </>
  );
}
