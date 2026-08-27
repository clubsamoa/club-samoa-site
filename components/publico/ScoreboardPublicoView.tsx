"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  eventoKey,
  openEventoChannel,
  openPeleaChannel,
  readCurrentPelea,
  storageKey,
  type Snapshot,
} from "@/components/admin/Scoreboard/storage";
import {
  formatTiempoFinalizacion,
  formatTime,
  type PeleaScoreboard,
} from "@/components/admin/Scoreboard/types";
import { api } from "@/lib/api-client";

// Vista pública de proyección (puerto de legacy/admin/scoreboard-public.html,
// 417 líneas). SIN auth (decisión D3): se proyecta en pantalla durante los
// eventos. Optimizada para proyector: tipografía enorme, fondo oscuro, sin
// chrome.
//
// Sincronía (D4, misma máquina / mismo navegador que el admin):
//   1. BroadcastChannel por pelea → sync instantáneo del snapshot.
//   2. BroadcastChannel + localStorage por evento → seguir al admin cuando
//      cambia de pelea.
//   3. storage events + polling local de 500ms como salvavidas.
//   4. Re-fetch del backend cada 90s como red de seguridad (por si se
//      perdió el "finalized").

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

export default function ScoreboardPublicoView({
  eventoId,
  peleaIdInicial,
}: {
  eventoId: string;
  peleaIdInicial?: string;
}) {
  const [peleaId, setPeleaId] = useState<string | null>(peleaIdInicial || null);
  const [pelea, setPelea] = useState<PeleaScoreboard | null>(null);
  const [liveState, setLiveState] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const lastBackendFetch = useRef(0);

  // ------------------------------------------------------------
  // Modo evento: resolver la pelea activa inicial y escuchar cambios
  // ------------------------------------------------------------
  useEffect(() => {
    // Pelea activa publicada por el admin (si no venimos con pelea fija)
    if (!peleaIdInicial) {
      void Promise.resolve().then(() => {
        const stored = readCurrentPelea(eventoId);
        if (stored?.pelea_id) {
          setPeleaId((prev) => prev ?? stored.pelea_id ?? null);
        }
      });
    }

    const ch = openEventoChannel(eventoId);
    if (ch) {
      ch.onmessage = (e: MessageEvent) => {
        const data = e.data as { pelea_id?: string } | null;
        if (!data?.pelea_id) return;
        setPeleaId((prev) => {
          if (data.pelea_id === prev) return prev;
          setCambiando(true);
          setLiveState(null);
          setPelea(null);
          return data.pelea_id!;
        });
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== eventoKey(eventoId)) return;
      try {
        const data = e.newValue
          ? (JSON.parse(e.newValue) as { pelea_id?: string })
          : null;
        if (data?.pelea_id) {
          setPeleaId((prev) => {
            if (data.pelea_id === prev) return prev;
            setCambiando(true);
            setLiveState(null);
            setPelea(null);
            return data.pelea_id!;
          });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      ch?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [eventoId, peleaIdInicial]);

  // ------------------------------------------------------------
  // Por pelea: canal, storage listener, polling local y fetch inicial
  // ------------------------------------------------------------
  useEffect(() => {
    if (!peleaId) return;
    let cancelado = false;

    const fetchBackend = () => {
      lastBackendFetch.current = Date.now();
      api
        .get("peleas.get", { id: peleaId })
        .then((raw) => {
          if (cancelado) return;
          setPelea((raw as { pelea?: PeleaScoreboard }).pelea ?? null);
          setError(null);
          setCambiando(false);
        })
        .catch((err: unknown) => {
          if (cancelado) return;
          setError(err instanceof Error ? err.message : String(err));
          setCambiando(false);
        });
    };

    const ch = openPeleaChannel(peleaId);
    if (ch) {
      ch.onmessage = (e: MessageEvent) => {
        const data = e.data as (Snapshot & { type?: string }) | null;
        if (!data) return;
        if (data.type === "finalized") {
          setLiveState(null);
          fetchBackend();
          return;
        }
        setLiveState(data);
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey(peleaId)) return;
      try {
        setLiveState(e.newValue ? (JSON.parse(e.newValue) as Snapshot) : null);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);

    // Polling local como salvavidas (500ms basta: el marcador cambia como
    // mucho 1×/segundo). setLiveState con mismo savedAt no re-renderiza.
    let habiaSnapshot = false;
    const pollId = setInterval(() => {
      try {
        const raw = localStorage.getItem(storageKey(peleaId));
        if (!raw) {
          // Si el snapshot desapareció, lo normal es que el admin finalizó
          // la pelea y lo limpió: refrescar del backend por si el mensaje
          // "finalized" del BroadcastChannel no llegó.
          if (habiaSnapshot) fetchBackend();
          habiaSnapshot = false;
          setLiveState((prev) => (prev === null ? prev : null));
          return;
        }
        habiaSnapshot = true;
        const parsed = JSON.parse(raw) as Snapshot;
        setLiveState((prev) =>
          prev && prev.savedAt === parsed.savedAt ? prev : parsed,
        );
      } catch {
        /* ignore */
      }
    }, 500);

    // Red de seguridad: re-fetch si llevamos >90s sin hablar con el backend
    const safetyId = setInterval(() => {
      if (Date.now() - lastBackendFetch.current > 90000) fetchBackend();
    }, 15000);

    fetchBackend();

    return () => {
      cancelado = true;
      ch?.close();
      window.removeEventListener("storage", onStorage);
      clearInterval(pollId);
      clearInterval(safetyId);
    };
  }, [peleaId]);

  // F = pantalla completa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyF") toggleFullscreen();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  const decidida =
    !!pelea &&
    (!!pelea.ganador_id ||
      /^(Empate|No Contest)$/i.test(pelea.metodo_finalizacion || ""));

  return (
    <div className="scoreboard-public-page">
      <button
        className="public-fs-toggle"
        type="button"
        title="Pantalla completa (Esc para salir)"
        onClick={toggleFullscreen}
      >
        ⛶
      </button>

      <main className="public-main">
        {!peleaId && (
          <div className="public-waiting">
            <Image
              src="/images/logo-white.png"
              alt="Club Samoa"
              className="public-waiting-logo"
              width={480}
              height={600}
            />
            <div className="public-waiting-title">CLUB SAMOA</div>
            <div className="public-waiting-subtitle">
              Esperando primera pelea del evento…
            </div>
            <div className="public-waiting-hint">
              Esta pantalla se actualizará automáticamente.
            </div>
          </div>
        )}

        {peleaId && error && (
          <div
            className="error-state"
            style={{ margin: "80px auto", maxWidth: 540 }}
          >
            <h3>No pudimos cargar la pelea</h3>
            <p>{error}</p>
          </div>
        )}

        {peleaId && !error && (cambiando || !pelea) && (
          <div
            className="loading-message"
            style={{ textAlign: "center", padding: "80px 20px", color: "#888" }}
          >
            {cambiando
              ? "Cargando próxima pelea…"
              : "Esperando datos de la pelea..."}
          </div>
        )}

        {peleaId &&
          !error &&
          pelea &&
          !cambiando &&
          (decidida ? (
            <Finalizada pelea={pelea} />
          ) : (
            <Live pelea={pelea} liveState={liveState} />
          ))}
      </main>
    </div>
  );
}

function PublicHeader({ categoria }: { categoria: string }) {
  return (
    <header className="public-header">
      <Image
        src="/images/logo-white.png"
        alt="Club Samoa"
        width={480}
        height={600}
      />
      <span className="public-categoria">{categoria}</span>
    </header>
  );
}

function Live({
  pelea,
  liveState,
}: {
  pelea: PeleaScoreboard;
  liveState: Snapshot | null;
}) {
  const a1 = pelea.atleta1 ?? {};
  const a2 = pelea.atleta2 ?? {};
  const categoria = pelea.bracket?.categoria || "";

  const totalRounds =
    liveState?.scoring && Array.isArray(liveState.scoring.rounds)
      ? liveState.scoring.rounds.length
      : null;

  let roundInfo = "Esperando inicio";
  let timerStr = "00:00";
  if (liveState && liveState.secondsRemaining != null) {
    timerStr = formatTime(liveState.secondsRemaining);
    roundInfo = liveState.isResting
      ? `Descanso · próximo Round ${liveState.currentRound + 1}${totalRounds ? ` / ${totalRounds}` : ""}`
      : `Round ${liveState.currentRound || 1}${totalRounds ? ` / ${totalRounds}` : ""}`;
  }

  const timerClass = `public-timer${liveState?.isResting ? " is-rest" : ""}${
    liveState &&
    liveState.secondsRemaining > 0 &&
    liveState.secondsRemaining <= 10
      ? " is-low"
      : ""
  }`;

  return (
    <>
      <PublicHeader categoria={categoria} />
      <section className="public-atleta public-atleta-top">
        <div className="public-atleta-side">
          <span className="public-side-tag">A</span>
        </div>
        <div className="public-atleta-info">
          <div className="public-atleta-name">
            {a1.nombre_completo || pelea.atleta1_id || "Por definir"}
          </div>
          <div className="public-atleta-academia">
            {a1.academia || a1.pais || ""}
          </div>
        </div>
      </section>
      <section className="public-center">
        <div className="public-round">{roundInfo}</div>
        <div className={timerClass}>{timerStr}</div>
      </section>
      <section className="public-atleta public-atleta-bottom">
        <div className="public-atleta-side">
          <span className="public-side-tag public-side-tag-b">B</span>
        </div>
        <div className="public-atleta-info">
          <div className="public-atleta-name">
            {a2.nombre_completo || pelea.atleta2_id || "Por definir"}
          </div>
          <div className="public-atleta-academia">
            {a2.academia || a2.pais || ""}
          </div>
        </div>
      </section>
    </>
  );
}

function Finalizada({ pelea }: { pelea: PeleaScoreboard }) {
  const categoria = pelea.bracket?.categoria || "";
  const metodo = (pelea.metodo_finalizacion || "FINALIZADO").toUpperCase();
  const ganador = pelea.ganador;
  const isTie = !ganador;
  const tiempoFmt = formatTiempoFinalizacion(pelea.tiempo_finalizacion);
  const detalle = [
    pelea.round_finalizacion ? `Round ${pelea.round_finalizacion}` : "",
    tiempoFmt.clean ? `Tiempo: ${tiempoFmt.clean}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <>
      <PublicHeader categoria={categoria} />
      <section className={`public-winner-banner${isTie ? " is-tie" : ""}`}>
        <div className="public-winner-method">
          {isTie ? metodo : `GANADOR POR ${metodo}`}
        </div>
        {!isTie && (
          <>
            <div className="public-winner-name">
              {ganador.nombre_completo || ""}
            </div>
            {ganador.academia && (
              <div className="public-winner-academia">{ganador.academia}</div>
            )}
          </>
        )}
        {detalle && <div className="public-winner-detail">{detalle}</div>}
        {tiempoFmt.raw && (
          <div className="public-winner-raw">{tiempoFmt.raw}</div>
        )}
      </section>
    </>
  );
}
