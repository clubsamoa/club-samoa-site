"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import BracketSvg, { type PeleaSvg } from "@/components/admin/BracketSvg";
import { ApiError, api } from "@/lib/api-client";

// Puerto de legacy/admin/bracket.html (163 líneas): vista del bracket para
// compartir/proyectar, SIN auth (decisión D3). Modo proyección = fullscreen
// sin chrome. Sin TanStack Query: esta ruta vive fuera del provider del
// admin y con un fetch simple basta.

interface BracketData {
  id?: string;
  categoria?: string;
  estatus?: string;
  num_atletas?: number | string | null;
  peleas?: PeleaSvg[];
}

export default function BracketPublicoView({
  bracketId,
}: {
  bracketId: string;
}) {
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [proyeccion, setProyeccion] = useState(false);

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    api
      .get("brackets.get", { id: bracketId })
      .then((raw) => {
        if (cancelado) return;
        setBracket((raw as { bracket?: BracketData }).bracket ?? null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : String(err),
        );
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [bracketId, intento]);

  const refrescar = () => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  };

  useEffect(() => {
    if (bracket?.categoria) {
      document.title = `${bracket.categoria} · Club Samoa`;
    }
  }, [bracket?.categoria]);

  // ESC sale de modo proyección; salir de fullscreen también lo apaga.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProyeccion(false);
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setProyeccion(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const toggleProjection = () => {
    if (proyeccion) {
      setProyeccion(false);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    } else {
      setProyeccion(true);
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  const totalPeleas = bracket?.peleas?.length ?? 0;
  const decididas = bracket?.peleas?.filter((p) => p.ganador_id).length ?? 0;
  const pct = totalPeleas > 0 ? Math.round((decididas / totalPeleas) * 100) : 0;

  return (
    <div className={`bracket-page${proyeccion ? " projection-mode" : ""}`}>
      <header className="bracket-page-header">
        <div className="bracket-page-brand">
          <Image
            src="/images/logo-white.png"
            alt="Club Samoa"
            width={480}
            height={600}
          />
          <div>
            <strong>
              {error ? "Error" : (bracket?.categoria ?? "Cargando bracket…")}
            </strong>
            <span>
              {bracket
                ? `${Number(bracket.num_atletas) || 0} atletas · ${decididas} / ${totalPeleas} peleas (${pct}%) · ${bracket.estatus || ""}`
                : ""}
            </span>
          </div>
        </div>
        <div className="bracket-page-actions">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => window.history.back()}
          >
            ← Volver
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={refrescar}
          >
            ⟳ Refrescar
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={toggleProjection}
          >
            📽 Modo proyección
          </button>
        </div>
      </header>

      <main className="bracket-page-main">
        <div className="bracket-svg-host">
          {cargando && (
            <div className="loading-message">Cargando bracket...</div>
          )}
          {!cargando && error && (
            <div className="error-state">
              <h3>No pudimos cargar el bracket</h3>
              <p>{error}</p>
            </div>
          )}
          {!cargando && !error && bracket && (
            <BracketSvg
              bracket={bracket}
              onMatchClick={(peleaId) => {
                if (peleaId)
                  window.location.href = `/admin/scoreboard/${encodeURIComponent(peleaId)}`;
              }}
            />
          )}
        </div>
        <div className="bracket-page-tip">
          Click en una pelea para abrir el scoreboard.
        </div>
      </main>
    </div>
  );
}
