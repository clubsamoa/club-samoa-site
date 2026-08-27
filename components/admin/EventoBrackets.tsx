"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import BracketSvg, { type PeleaSvg } from "@/components/admin/BracketSvg";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import {
  agruparAtletas,
  generarSingleElimination,
  resumenPeleas,
  type AtletaBracket,
  type Grupo,
} from "@/lib/bracket-builder";
import {
  DIVISIONES,
  NIVELES,
  calcularDivisionEdad,
  categoriasPesoPara,
} from "@/lib/reglamento";
import { AtletaSchema, InscripcionSchema, parseOrWarn } from "@/lib/schemas";

// Puerto de legacy/admin/js/evento-brackets.js (717 líneas).
//
// Dos modos:
//  - PREVIEW (sin brackets confirmados): agrupa inscripciones aprobadas con
//    bracket-builder y muestra cards. "Confirmar" llama brackets.confirm.
//  - LIVE (con brackets confirmados): cada bracket se renderiza con
//    <BracketSvg>. Click en una pelea abre el scoreboard; "Ver completo"
//    abre /bracket/[id]. "Editar brackets" borra los confirmados y vuelve
//    a preview.

const InscripcionConAtletaSchema = InscripcionSchema.extend({
  atleta: AtletaSchema.partial().optional(),
});
type InscripcionConAtleta = z.infer<typeof InscripcionConAtletaSchema>;

const InscripcionesResponseSchema = z.object({
  inscripciones: z.array(InscripcionConAtletaSchema),
});

// brackets.listfull / brackets.get devuelven el bracket con sus peleas ya
// enriquecidas (objetos atleta embebidos). Validamos lo que leemos y dejamos
// pasar el resto tal cual hacia <BracketSvg>.
const PeleaFullSchema = z.looseObject({
  id: z.string().optional(),
  ganador_id: z.string().nullish(),
});
const BracketFullSchema = z.looseObject({
  id: z.string(),
  categoria: z.string().catch(""),
  estatus: z.string().catch(""),
  num_atletas: z.union([z.number(), z.string(), z.null()]).optional(),
  peleas: z.array(PeleaFullSchema).catch([]),
});
type BracketFull = z.infer<typeof BracketFullSchema>;

const ListFullResponseSchema = z.object({
  brackets: z.array(BracketFullSchema).catch([]),
});
const ListResponseSchema = z.object({
  brackets: z.array(z.looseObject({ id: z.string() })).catch([]),
});
const GetResponseSchema = z.object({ bracket: BracketFullSchema });

async function fetchBrackets(eventoId: string): Promise<BracketFull[]> {
  // Fast path: un SOLO request trae todos los brackets con sus peleas.
  // Si el backend no tiene brackets.listfull desplegado, método clásico.
  try {
    const raw = await api.get("brackets.listfull", { evento_id: eventoId });
    return parseOrWarn(ListFullResponseSchema, raw, "brackets.listfull")
      .brackets;
  } catch {
    const rawList = await api.get("brackets.list", { evento_id: eventoId });
    const lista = parseOrWarn(
      ListResponseSchema,
      rawList,
      "brackets.list",
    ).brackets;
    if (lista.length === 0) return [];
    const details = await Promise.all(
      lista.map((b) => api.get("brackets.get", { id: b.id })),
    );
    return details.map(
      (d) => parseOrWarn(GetResponseSchema, d, "brackets.get").bracket,
    );
  }
}

function initialsOf(name: string): string {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export default function EventoBrackets({
  eventoId,
  fechaEvento,
}: {
  eventoId: string;
  fechaEvento: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();
  const [soloAprobados, setSoloAprobados] = useState(true);
  const [moverIns, setMoverIns] = useState<InscripcionConAtleta | null>(null);

  const bracketsQ = useQuery({
    queryKey: ["brackets.listfull", eventoId],
    queryFn: () => fetchBrackets(eventoId),
  });

  const brackets = bracketsQ.data ?? [];
  const modoLive = brackets.length > 0;

  const inscripcionesQ = useQuery({
    queryKey: ["inscripciones.list", eventoId],
    queryFn: async () => {
      const raw = await api.get("inscripciones.list", { evento_id: eventoId });
      return parseOrWarn(
        InscripcionesResponseSchema,
        raw,
        "inscripciones.list",
      );
    },
    enabled: bracketsQ.isSuccess && !modoLive,
  });

  const inscripcionesData = inscripcionesQ.data?.inscripciones;
  const inscripciones = useMemo(
    () => inscripcionesData ?? [],
    [inscripcionesData],
  );

  const recargar = () => {
    void queryClient.invalidateQueries({
      queryKey: ["brackets.listfull", eventoId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["inscripciones.list", eventoId],
    });
  };

  // ------------------------------------------------------------
  // Datos del preview
  // ------------------------------------------------------------
  const input: InscripcionConAtleta[] = useMemo(
    () =>
      soloAprobados
        ? inscripciones.filter((i) => i.estatus === "aprobado")
        : inscripciones.slice(),
    [inscripciones, soloAprobados],
  );

  const { grupos, viables, noViables, totalPeleasReales } = useMemo(() => {
    const grupos: Grupo[] = agruparAtletas(
      input.map((i) => ({
        id: i.id,
        atleta_id: i.atleta_id,
        atleta: i.atleta ? ({ ...i.atleta } as AtletaBracket) : undefined,
        categoria_calculada: i.categoria_calculada,
      })),
    );
    const viables = grupos.filter((g) => g.viable);
    const noViables = grupos.filter((g) => !g.viable);
    const totalPeleasReales = viables.reduce((acc, g) => {
      const r = resumenPeleas(generarSingleElimination(g.atletas));
      return acc + r.reales;
    }, 0);
    return { grupos, viables, noViables, totalPeleasReales };
  }, [input]);

  // ------------------------------------------------------------
  // Mutaciones
  // ------------------------------------------------------------
  const confirmar = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("brackets.confirm", payload),
    onSuccess: () => {
      toastSuccess("Brackets confirmados.");
      recargar();
    },
    onError: (e: unknown) =>
      toastError(
        e instanceof ApiError
          ? `Error al confirmar brackets: ${e.message}`
          : "Error al confirmar brackets.",
      ),
  });

  const editar = useMutation({
    mutationFn: () => api.post("brackets.delete", { evento_id: eventoId }),
    onSuccess: () => {
      toastSuccess("Brackets borrados. De vuelta al preview.");
      recargar();
    },
    onError: (e: unknown) =>
      toastError(
        e instanceof ApiError
          ? `Error al borrar brackets: ${e.message}`
          : "Error al borrar brackets.",
      ),
  });

  const onConfirmar = () => {
    if (confirmar.isPending || viables.length === 0) return;
    const ok = window.confirm(
      `¿Confirmar ${viables.length} bracket${viables.length === 1 ? "" : "s"}?\n\n` +
        "Esto crea las peleas en la Sheet. Después podrás capturar resultados en el scoreboard. " +
        "Si necesitas cambios, podrás re-confirmar con el botón 'Editar brackets'.",
    );
    if (!ok) return;

    const bracketsParaConfirmar = viables.map((g) => ({
      categoria: g.categoria,
      tipo_bracket: g.tipo_sugerido,
      atletas: g.atletas,
      // Adaptar shape para backend: agregar numero_pelea
      peleas: generarSingleElimination(g.atletas).map((p) => ({
        ...p,
        numero_pelea: p.numero,
      })),
    }));

    confirmar.mutate({ evento_id: eventoId, brackets: bracketsParaConfirmar });
  };

  const onEditar = () => {
    const ok = window.confirm(
      `¿Editar brackets?\n\nEsto borra los ${brackets.length} bracket(s) confirmados y vuelve al modo preview. ` +
        "TODAS las peleas y resultados se perderán. ¿Continuar?",
    );
    if (ok) editar.mutate();
  };

  // ------------------------------------------------------------
  // Estados base
  // ------------------------------------------------------------
  if (bracketsQ.isPending || (!modoLive && inscripcionesQ.isPending)) {
    return <div className="loading-message">Cargando brackets...</div>;
  }

  if (bracketsQ.isError || inscripcionesQ.isError) {
    const err = bracketsQ.error ?? inscripcionesQ.error;
    return (
      <div className="error-state">
        <h3>No pudimos cargar los brackets</h3>
        <p>{err instanceof Error ? err.message : String(err)}</p>
        <button className="btn" type="button" onClick={recargar}>
          Reintentar
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------
  // LIVE
  // ------------------------------------------------------------
  if (modoLive) {
    const totalAtletas = brackets.reduce(
      (acc, b) => acc + (Number(b.num_atletas) || 0),
      0,
    );
    const totalPeleas = brackets.reduce(
      (acc, b) => acc + (b.peleas?.length ?? 0),
      0,
    );
    const totalDecididas = brackets.reduce(
      (acc, b) => acc + (b.peleas?.filter((p) => p.ganador_id).length ?? 0),
      0,
    );

    return (
      <>
        <div className="brackets-toolbar">
          <div className="brackets-live-summary">
            <strong>{brackets.length}</strong> bracket
            {brackets.length === 1 ? "" : "s"}{" "}
            <span style={{ color: "var(--muted-2)" }}>·</span> {totalAtletas}{" "}
            atletas <span style={{ color: "var(--muted-2)" }}>·</span>{" "}
            {totalDecididas} / {totalPeleas} peleas decididas
          </div>
          <div className="toolbar-actions">
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={recargar}
            >
              ⟳ Refrescar
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={editar.isPending}
              style={{ color: "#ff9090", borderColor: "rgba(244,7,6,0.4)" }}
              onClick={onEditar}
            >
              ⚠ Editar brackets
            </button>
          </div>
        </div>
        <div className="brackets-live-list">
          {brackets.map((b) => {
            const peleas = b.peleas ?? [];
            const decididas = peleas.filter((p) => p.ganador_id).length;
            const pct =
              peleas.length > 0
                ? Math.round((decididas / peleas.length) * 100)
                : 0;
            return (
              <section className="bracket-live-card" key={b.id}>
                <header className="bracket-live-header">
                  <div>
                    <h3 className="bracket-live-title">{b.categoria}</h3>
                    <div className="bracket-live-meta">
                      <span>{Number(b.num_atletas) || 0} atletas</span>{" "}
                      <span style={{ color: "var(--muted-2)" }}>·</span>{" "}
                      <span>
                        {decididas} / {peleas.length} peleas decididas ({pct}%)
                      </span>{" "}
                      <span style={{ color: "var(--muted-2)" }}>·</span>{" "}
                      <span className={`estatus-pill estatus-${b.estatus}`}>
                        {b.estatus}
                      </span>
                    </div>
                  </div>
                  <div className="bracket-live-actions">
                    <Link
                      className="btn btn-ghost btn-sm"
                      href={`/bracket/${encodeURIComponent(b.id)}`}
                      target="_blank"
                    >
                      Ver completo ↗
                    </Link>
                  </div>
                </header>
                <div className="bracket-svg-host">
                  <BracketSvg
                    bracket={{ peleas: peleas as PeleaSvg[] }}
                    onMatchClick={(peleaId) => {
                      if (peleaId)
                        router.push(
                          `/admin/scoreboard/${encodeURIComponent(peleaId)}`,
                        );
                    }}
                  />
                </div>
              </section>
            );
          })}
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // PREVIEW
  // ------------------------------------------------------------
  const sinInscritos = inscripciones.length === 0;
  const sinAprobados = !sinInscritos && input.length === 0 && soloAprobados;
  const ordenados = [...viables, ...noViables];

  return (
    <>
      <div className="brackets-toolbar">
        <div className="toolbar-filters">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={soloAprobados}
              onChange={(e) => setSoloAprobados(e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb"></span>
            </span>
            <span className="toggle-label">Solo atletas aprobados</span>
          </label>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={recargar}
          >
            ⟳ Recalcular
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={
              viables.length === 0 || confirmar.isPending || sinInscritos
            }
            title={
              viables.length === 0
                ? "No hay categorías viables para confirmar."
                : `Confirma ${viables.length} bracket${viables.length === 1 ? "" : "s"} (${totalPeleasReales} pelea${totalPeleasReales === 1 ? "" : "s"} reales).`
            }
            onClick={onConfirmar}
          >
            {confirmar.isPending
              ? "Confirmando..."
              : "Confirmar todos los viables"}
          </button>
        </div>
      </div>

      <div className="brackets-summary" aria-live="polite">
        {!sinInscritos && !sinAprobados && (
          <div className="summary-card">
            <div className="summary-stat">
              <span className="stat-num">{input.length}</span>
              <span className="stat-label">Atletas</span>
            </div>
            <div className="summary-stat">
              <span className="stat-num">{grupos.length}</span>
              <span className="stat-label">Categorías</span>
            </div>
            <div className="summary-stat">
              <span className="stat-num stat-num-ok">{viables.length}</span>
              <span className="stat-label">Viables</span>
            </div>
            <div className="summary-stat">
              <span className="stat-num stat-num-warn">{noViables.length}</span>
              <span className="stat-label">No viables</span>
            </div>
            <div className="summary-stat">
              <span className="stat-num">{totalPeleasReales}</span>
              <span className="stat-label">Peleas reales</span>
            </div>
          </div>
        )}
      </div>

      <div className="brackets-grid">
        {sinInscritos && (
          <div className="placeholder">
            <span className="placeholder-tag">Sin inscritos</span>
            <h2>No hay atletas para agrupar</h2>
            <p>
              Primero inscribe atletas en la tab <strong>Inscripciones</strong>{" "}
              y captura su pesaje.
            </p>
          </div>
        )}
        {sinAprobados && (
          <div className="placeholder">
            <span className="placeholder-tag">Sin aprobados</span>
            <h2>Ningún atleta aprobado todavía</h2>
            <p>
              Ve a la tab <strong>Pesaje</strong> y aprueba al menos algunos
              atletas. O desactiva el toggle para ver todos los inscritos.
            </p>
          </div>
        )}
        {!sinInscritos &&
          !sinAprobados &&
          ordenados.map((grupo) => (
            <GrupoCard
              key={grupo.categoria}
              grupo={grupo}
              onMover={(insId) => {
                const ins = inscripciones.find((i) => i.id === insId);
                if (ins?.atleta) setMoverIns(ins);
              }}
            />
          ))}
      </div>

      {moverIns && (
        <MoverAtletaModal
          ins={moverIns}
          fechaEvento={fechaEvento}
          onClose={() => setMoverIns(null)}
          onMoved={() => {
            setMoverIns(null);
            recargar();
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------
// Card de grupo (preview)
// ------------------------------------------------------------
function GrupoCard({
  grupo,
  onMover,
}: {
  grupo: Grupo;
  onMover: (insId: string) => void;
}) {
  const viable = grupo.viable;
  const resumen = resumenPeleas(
    viable ? generarSingleElimination(grupo.atletas) : [],
  );
  const faltan = 2 - grupo.num_atletas;

  return (
    <article
      className={`bracket-card ${viable ? "bracket-card-viable" : "bracket-card-no-viable"}`}
    >
      <header className="bracket-card-header">
        <div className="bracket-card-titlewrap">
          <h3 className="bracket-card-title">{grupo.categoria}</h3>
        </div>
        <div>
          {viable ? (
            <span className="estatus-pill estatus-aprobado">Viable</span>
          ) : (
            <span className="estatus-pill estatus-rechazado">No viable</span>
          )}
        </div>
      </header>
      <div className="bracket-card-meta">
        <span className="bracket-card-count">
          {grupo.num_atletas} atleta{grupo.num_atletas === 1 ? "" : "s"}
        </span>
        {viable ? (
          <div className="bracket-tipo">
            <span className="bracket-tipo-label">Tipo:</span>
            <span className="bracket-tipo-value">
              {grupo.tipo_sugerido === "dos_atletas"
                ? "Pelea única"
                : "Eliminación simple"}
            </span>
            <span className="bracket-tipo-detail">
              ({resumen.total} pelea{resumen.total === 1 ? "" : "s"}
              {resumen.byes > 0 ? `, ${resumen.byes} con bye` : ""})
            </span>
          </div>
        ) : (
          <div className="bracket-tipo bracket-tipo-warn">
            Necesita al menos {faltan} atleta{faltan === 1 ? "" : "s"} más para
            generar bracket.
          </div>
        )}
      </div>
      <div className="bracket-chips">
        {grupo.atletas.map((atleta) => {
          const nombre = atleta.nombre_completo || atleta.id;
          const insId = atleta._inscripcion_id || "";
          return (
            <div className="bracket-chip" key={insId || atleta.id}>
              <span className="bracket-chip-avatar">
                {initialsOf(atleta.nombre_completo || "?")}
              </span>
              <span className="bracket-chip-name">{nombre}</span>
              <button
                className="bracket-chip-mover"
                type="button"
                title="Mover de categoría"
                aria-label={`Mover a ${nombre} de categoría`}
                onClick={() => onMover(insId)}
              >
                ⋯
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}

// ------------------------------------------------------------
// Modal "Mover atleta" (cambiar categoría manualmente)
// ------------------------------------------------------------
function MoverAtletaModal({
  ins,
  fechaEvento,
  onClose,
  onMoved,
}: {
  ins: InscripcionConAtleta;
  fechaEvento: string;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { toastSuccess } = useToast();
  const a = ins.atleta ?? {};
  const genero = a.genero ?? "Masculino";
  const autoDivision = calcularDivisionEdad(a.fecha_nacimiento, fechaEvento);

  // Parsear la categoría actual: "División / Género / Nivel / Peso"
  const currentParts = (ins.categoria_calculada || "")
    .split(" / ")
    .map((s) => s.trim());

  const [division, setDivision] = useState<string>(
    currentParts[0] || autoDivision || DIVISIONES[0],
  );
  const [nivel, setNivel] = useState<string>(
    currentParts[2] || a.nivel || NIVELES[0],
  );
  const [pesoNombre, setPesoNombre] = useState<string>(currentParts[3] || "");

  const pesoCats = categoriasPesoPara(division, genero);
  // Preservar peso por nombre si existe en la nueva lista
  const pesoActivo = pesoCats.some((c) => c.nombre === pesoNombre)
    ? pesoNombre
    : (pesoCats[0]?.nombre ?? "");

  const mover = useMutation({
    mutationFn: (categoria: string) =>
      api.post("inscripciones.setcategoria", { id: ins.id, categoria }),
    onSuccess: () => {
      toastSuccess("Atleta movido de categoría.");
      onMoved();
    },
  });

  const onSave = () => {
    if (!pesoActivo) return;
    const categoria = [division, genero, nivel, pesoActivo].join(" / ");
    mover.mutate(categoria);
  };

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
        aria-labelledby="brackets-mover-title"
      >
        <div className="modal-header">
          <h2 id="brackets-mover-title">
            Mover · {a.nombre_completo ?? ins.atleta_id}
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

        {mover.isError && (
          <div className="modal-error" role="alert">
            {mover.error instanceof Error
              ? mover.error.message
              : String(mover.error)}
          </div>
        )}

        <div className="modal-form">
          <p
            style={{ color: "var(--muted)", margin: "0 0 14px", fontSize: 13 }}
          >
            Género: {genero} · Fecha nacimiento: {a.fecha_nacimiento || "—"} ·
            División automática para este evento: {autoDivision || "—"}
          </p>
          <div className="form-grid">
            <label className="form-field">
              <span className="form-label">División de edad</span>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                {DIVISIONES.map((d) => (
                  <option value={d} key={d}>
                    {d}
                    {d === autoDivision ? " (auto)" : ""}
                  </option>
                ))}
              </select>
              <small
                className="form-hint"
                style={{
                  color:
                    division === autoDivision ? "var(--muted-2)" : "#f0c89a",
                }}
              >
                {division === autoDivision
                  ? "Coincide con el cálculo automático."
                  : `⚠ Distinta de la división automática (${autoDivision || "—"}).`}
              </small>
            </label>
            <label className="form-field">
              <span className="form-label">Nivel</span>
              <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
                {NIVELES.map((n) => (
                  <option value={n} key={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field form-field-full">
              <span className="form-label">Categoría de peso</span>
              <select
                value={pesoActivo}
                disabled={pesoCats.length === 0}
                onChange={(e) => setPesoNombre(e.target.value)}
              >
                {pesoCats.length === 0 && (
                  <option value="">(sin categorías disponibles)</option>
                )}
                {pesoCats.map((c) => (
                  <option value={c.nombre} key={c.nombre}>
                    {c.nombre}
                    {isFinite(c.pesoMax)
                      ? ` (<${c.pesoMax} kg)`
                      : " (sin tope)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p
            style={{
              color: "var(--muted-2)",
              margin: "12px 0 0",
              fontSize: 12,
            }}
          >
            El cambio marca la categoría como manual (★). Usa &quot;Auto&quot;
            en la tab Pesaje para volver al cálculo automático.
          </p>

          <div className="modal-actions">
            <button className="btn btn-cancel" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={mover.isPending || !pesoActivo}
              onClick={onSave}
            >
              {mover.isPending ? "Moviendo..." : "Mover"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
