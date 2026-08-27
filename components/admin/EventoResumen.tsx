"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBrackets,
  type BracketFull,
} from "@/components/admin/brackets-data";
import { useToast } from "@/components/admin/Toaster";
import { ApiError, api } from "@/lib/api-client";
import { computePodium, type AtletaPodio, type Podio } from "@/lib/podio";

// Tab "Resumen" del evento — puerto de legacy/admin/js/evento-resumen.js
// (314 líneas): contador global, podios por bracket (🥇🥈🥉, joint third
// para perdedores de semis) y botón "Finalizar evento" habilitado solo
// cuando todas las peleas tienen ganador.

export default function EventoResumen({
  eventoId,
  estatusEvento,
}: {
  eventoId: string;
  estatusEvento: string;
}) {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useToast();

  const bracketsQ = useQuery({
    queryKey: ["brackets.listfull", eventoId],
    queryFn: () => fetchBrackets(eventoId),
  });

  const finalizar = useMutation({
    mutationFn: () =>
      api.post("eventos.setestatus", { id: eventoId, estatus: "finalizado" }),
    onSuccess: () => {
      toastSuccess("Evento finalizado.");
      void queryClient.invalidateQueries({
        queryKey: ["eventos.get", eventoId],
      });
      void queryClient.invalidateQueries({ queryKey: ["eventos.list"] });
    },
    onError: (e: unknown) =>
      toastError(
        e instanceof ApiError
          ? `Error al finalizar evento: ${e.message}`
          : "Error al finalizar evento.",
      ),
  });

  const recargar = () =>
    void queryClient.invalidateQueries({
      queryKey: ["brackets.listfull", eventoId],
    });

  if (bracketsQ.isPending) {
    return <div className="loading-message">Cargando resumen...</div>;
  }

  if (bracketsQ.isError) {
    return (
      <div className="error-state">
        <h3>No pudimos cargar el resumen</h3>
        <p>
          {bracketsQ.error instanceof Error
            ? bracketsQ.error.message
            : String(bracketsQ.error)}
        </p>
        <button className="btn" type="button" onClick={recargar}>
          Reintentar
        </button>
      </div>
    );
  }

  const brackets = bracketsQ.data ?? [];
  if (brackets.length === 0) {
    return (
      <div className="placeholder">
        <span className="placeholder-tag">Sin brackets</span>
        <h2>No hay brackets confirmados</h2>
        <p>
          Ve a la tab <strong>Brackets</strong>, agrupa los atletas y confirma
          los brackets antes de ver el resumen.
        </p>
      </div>
    );
  }

  const podiums = brackets.map((b) => ({
    bracket: b,
    podium: computePodium(b.peleas),
  }));
  // Brackets completos primero, pendientes al final
  podiums.sort(
    (a, b) => (b.podium.complete ? 1 : 0) - (a.podium.complete ? 1 : 0),
  );

  const totalPeleas = brackets.reduce(
    (acc, b) => acc + (b.peleas?.length ?? 0),
    0,
  );
  const decididas = brackets.reduce(
    (acc, b) => acc + (b.peleas?.filter((p) => p.ganador_id).length ?? 0),
    0,
  );
  const completos = podiums.filter((p) => p.podium.complete).length;
  const allComplete = completos === brackets.length;
  const pendientes = totalPeleas - decididas;
  const pct = totalPeleas > 0 ? Math.round((decididas / totalPeleas) * 100) : 0;
  const eventoFinalizado = estatusEvento === "finalizado";

  const onFinalizar = () => {
    if (finalizar.isPending) return;
    const ok = window.confirm(
      "¿Finalizar el evento?\n\n" +
        "Esto marca el evento como 'finalizado'. El podio queda guardado y el evento queda " +
        "como referencia histórica. (Por ahora no bloquea edición, solo cambia el estatus.)",
    );
    if (ok) finalizar.mutate();
  };

  return (
    <>
      <div className="resumen-toolbar">
        <div className="resumen-stats">
          <span className="resumen-stat">
            <strong>{brackets.length}</strong> brackets
          </span>
          <span className="resumen-stat">
            <strong>{completos}</strong> completos
          </span>
          <span className="resumen-stat">
            <strong>
              {decididas} / {totalPeleas}
            </strong>{" "}
            peleas ({pct}%)
          </span>
          {pendientes > 0 ? (
            <span className="resumen-stat resumen-stat-warn">
              ⏳ {pendientes} pendiente{pendientes === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="resumen-stat resumen-stat-ok">
              ✓ Todas decididas
            </span>
          )}
        </div>
        <div className="resumen-actions">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={recargar}
          >
            ⟳
          </button>
          {eventoFinalizado ? (
            <span
              className="estatus-pill estatus-finalizado"
              style={{ padding: "8px 14px", fontSize: 12 }}
            >
              ✓ Evento finalizado
            </span>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              disabled={!allComplete || finalizar.isPending}
              title={allComplete ? undefined : "Aún hay peleas pendientes"}
              onClick={onFinalizar}
            >
              {finalizar.isPending ? "Finalizando…" : "✓ Finalizar evento"}
            </button>
          )}
        </div>
      </div>

      <div className="podiums-list">
        {podiums.map(({ bracket, podium }) => (
          <PodiumCard bracket={bracket} podium={podium} key={bracket.id} />
        ))}
      </div>
    </>
  );
}

function PodiumCard({
  bracket,
  podium,
}: {
  bracket: BracketFull;
  podium: Podio;
}) {
  const totalPeleas = bracket.peleas?.length ?? 0;
  const decididas = bracket.peleas?.filter((p) => p.ganador_id).length ?? 0;
  const pendientes = totalPeleas - decididas;

  const positions: { place: 1 | 2 | 3; atleta: AtletaPodio | null }[] =
    podium.complete
      ? [
          { place: 1, atleta: podium.first },
          { place: 2, atleta: podium.second },
          ...podium.thirds.map((t) => ({ place: 3, atleta: t }) as const),
        ]
      : [];

  return (
    <section className={`podium-card${podium.complete ? " is-complete" : ""}`}>
      <header className="podium-card-header">
        <h3 className="podium-card-title">{bracket.categoria}</h3>
        <span className="podium-card-meta">
          {Number(bracket.num_atletas) || 0} atletas · {decididas}/{totalPeleas}{" "}
          peleas
        </span>
      </header>
      {podium.complete ? (
        <div className="podium">
          {positions.map(
            ({ place, atleta }, i) =>
              atleta && (
                <div className={`podium-pos podium-pos-${place}`} key={i}>
                  <span className="podium-medal">
                    {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}
                  </span>
                  <div className="podium-info">
                    <strong>
                      {atleta.nombre_completo || atleta.id || "—"}
                    </strong>
                    {atleta.academia && (
                      <span className="podium-academia">{atleta.academia}</span>
                    )}
                  </div>
                </div>
              ),
          )}
        </div>
      ) : (
        <div className="podium-pending">
          <span className="podium-pending-label">En curso</span>
          <span className="podium-pending-detail">
            {pendientes} pelea{pendientes === 1 ? "" : "s"} pendiente
            {pendientes === 1 ? "" : "s"}
          </span>
          <Link
            className="btn btn-sm btn-ghost"
            href={`/bracket/${encodeURIComponent(bracket.id)}`}
            target="_blank"
          >
            Ver bracket →
          </Link>
        </div>
      )}
    </section>
  );
}
