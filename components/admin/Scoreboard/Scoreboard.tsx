"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { tiempoPelea } from "@/lib/reglamento";
import FinalizarModal, {
  type FinalizeInitial,
  type FinalizeValues,
} from "./FinalizarModal";
import ScoringPanel from "./ScoringPanel";
import {
  broadcast,
  clearSnapshot,
  loadSnapshot,
  openPeleaChannel,
  publishCurrentPelea,
  readPrefetchedPelea,
  saveSnapshot,
  stashPrefetchedPelea,
  type Snapshot,
} from "./storage";
import {
  formatTiempoFinalizacion,
  formatTime,
  initialsOf,
  type PeleaScoreboard,
  type Side,
  type TiempoConfig,
} from "./types";
import {
  isFightOver,
  totalAdv,
  totalFaltas,
  totalScore,
  useScoreboard,
  type ScoreboardState,
} from "./useScoreboard";

// Scoreboard de pelea — puerto de legacy/admin/js/scoreboard.js (1,697
// líneas), troceado: useScoreboard (estado + timer), ScoringPanel (puntos),
// FinalizarModal (T20 + edición post-finalización de feat/23) y este
// componente (carga, header, vista finalizada, atajos, navegación).

function configurarTiempo(pelea: PeleaScoreboard): TiempoConfig {
  // Parsear "División / Género / Nivel / Peso"
  const parts = String(pelea.bracket?.categoria || "").split(" / ");
  const division = parts[0] || "Adultos";
  const nivel = parts[2] || "Avanzado";
  const esFinal = pelea.ronda === "final";
  try {
    return tiempoPelea(division, nivel, esFinal);
  } catch (e) {
    console.warn("[scoreboard] tiempoPelea falló:", e);
    return { rounds: 1, segundosPorRound: 180, segundosDescanso: 0 };
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function playBell(ctxRef: { current: AudioContext | null }) {
  try {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.4;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.frequency.value = 660; // segundo tono más bajo
    }, 200);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.stop(ctx.currentTime + 1.5);
  } catch (e) {
    console.warn("[scoreboard] bell sound failed:", e);
  }
}

interface PeleasNextResponse {
  ok?: boolean;
  found?: boolean;
  pelea_id?: string;
}

interface FinalizeResponse {
  ok?: boolean;
  next_found?: boolean;
  next_pelea_id?: string;
  next_pelea?: PeleaScoreboard | null;
}

export default function Scoreboard({ peleaId }: { peleaId: string }) {
  const router = useRouter();
  const [pelea, setPelea] = useState<PeleaScoreboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [editando, setEditando] = useState(false);
  const [buscandoNext, setBuscandoNext] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------
  // Carga (con prefetch de sessionStorage si venimos de finalizar)
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;
    const prefetched = intento === 0 ? readPrefetchedPelea(peleaId) : null;
    if (prefetched) {
      // Microtask: mismo efecto sin setState síncrono dentro del effect.
      void Promise.resolve().then(() => {
        if (cancelado) return;
        setPelea(prefetched);
        setError(null);
        setCargando(false);
        publishCurrentPelea(prefetched);
      });
      return () => {
        cancelado = true;
      };
    }
    api
      .get("peleas.get", { id: peleaId })
      .then((raw) => {
        if (cancelado) return;
        const p = (raw as { pelea?: PeleaScoreboard }).pelea ?? null;
        setPelea(p);
        setError(null);
        if (p) {
          publishCurrentPelea(p);
          // Si la pelea ya está decidida, el snapshot local sobra.
          if (p.ganador_id) clearSnapshot(peleaId);
        }
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [peleaId, intento]);

  const recargar = useCallback(() => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  }, []);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (pelea) {
      document.title = `Pelea #${pelea.numero_pelea ?? ""} · Scoreboard`;
    }
  }, [pelea]);

  const onSaved = useCallback(() => {
    setSaveVisible(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveVisible(false), 1500);
  }, []);

  const bracketId = pelea?.bracket?.id || pelea?.bracket_id;
  const eventoId = pelea?.bracket?.evento_id;

  // ------------------------------------------------------------
  // Próxima pelea pendiente (T25) — peleas.next con fallback clásico
  // ------------------------------------------------------------
  const goToNextPending = useCallback(
    async (opts: { alertIfNone?: boolean; fallbackToBracket?: boolean }) => {
      if (!bracketId && !eventoId) {
        if (opts.alertIfNone) alert("No se encontró el evento de esta pelea.");
        return false;
      }
      const noMore = () => {
        if (opts.fallbackToBracket) {
          if (eventoId) {
            router.push(
              `/admin/eventos/${encodeURIComponent(eventoId)}?tab=resumen`,
            );
            return true;
          }
          if (bracketId) {
            router.push(`/bracket/${encodeURIComponent(bracketId)}`);
            return true;
          }
        }
        if (opts.alertIfNone) {
          alert(
            "🎉 ¡Todas las peleas del evento ya tienen ganador!\n\n" +
              "Ve al resumen del evento para ver los podios.",
          );
        }
        return false;
      };

      try {
        // Fast path: el backend resuelve la próxima en un solo round-trip.
        try {
          const nextRes = (await api.get("peleas.next", {
            evento_id: eventoId || undefined,
            bracket_id: bracketId || undefined,
            exclude_id: peleaId,
          })) as PeleasNextResponse;
          if (nextRes?.ok) {
            if (nextRes.found && nextRes.pelea_id) {
              router.push(
                `/admin/scoreboard/${encodeURIComponent(nextRes.pelea_id)}`,
              );
              return true;
            }
            return noMore();
          }
        } catch (fastErr) {
          console.warn(
            "[scoreboard] peleas.next no disponible, uso método clásico:",
            fastErr,
          );
        }

        // Método clásico: juntar todas las peleas del evento y ordenar.
        interface PeleaConOrden {
          pelea: PeleaScoreboard & { bye?: boolean; ronda_idx?: number };
          bracketOrder: number;
        }
        const allPeleas: PeleaConOrden[] = [];
        if (eventoId) {
          const resList = (await api.get("brackets.list", {
            evento_id: eventoId,
          })) as { brackets?: { id: string }[] };
          const lista = resList.brackets ?? [];
          if (lista.length === 0) return noMore();
          const details = await Promise.all(
            lista.map((b) => api.get("brackets.get", { id: b.id })),
          );
          details.forEach((d, idx) => {
            const bracket = (d as { bracket?: { peleas?: unknown[] } }).bracket;
            (bracket?.peleas ?? []).forEach((p) => {
              allPeleas.push({
                pelea: p as PeleaConOrden["pelea"],
                bracketOrder: idx,
              });
            });
          });
        } else if (bracketId) {
          const resBracket = (await api.get("brackets.get", {
            id: bracketId,
          })) as { bracket?: { peleas?: unknown[] } };
          (resBracket.bracket?.peleas ?? []).forEach((p) => {
            allPeleas.push({
              pelea: p as PeleaConOrden["pelea"],
              bracketOrder: 0,
            });
          });
        }

        const pending = allPeleas.filter(({ pelea: p }) => {
          return (
            p.id !== peleaId &&
            p.atleta1_id &&
            p.atleta2_id &&
            !p.ganador_id &&
            !p.bye
          );
        });
        // Orden: ronda_idx ASC, orden del bracket ASC, numero_pelea ASC
        pending.sort((a, b) => {
          const ra = Number(a.pelea.ronda_idx) || 0;
          const rb = Number(b.pelea.ronda_idx) || 0;
          if (ra !== rb) return ra - rb;
          if (a.bracketOrder !== b.bracketOrder)
            return a.bracketOrder - b.bracketOrder;
          return (
            (Number(a.pelea.numero_pelea) || 0) -
            (Number(b.pelea.numero_pelea) || 0)
          );
        });

        if (pending.length > 0) {
          router.push(
            `/admin/scoreboard/${encodeURIComponent(pending[0]!.pelea.id)}`,
          );
          return true;
        }
        return noMore();
      } catch (err) {
        console.warn("[scoreboard] no se pudo buscar próxima pelea:", err);
        if (opts.fallbackToBracket && bracketId) {
          router.push(`/bracket/${encodeURIComponent(bracketId)}`);
          return true;
        }
        if (opts.alertIfNone) {
          alert(
            "Error al buscar próxima pelea: " +
              (err instanceof Error ? err.message : String(err)),
          );
        }
        return false;
      }
    },
    [bracketId, eventoId, peleaId, router],
  );

  const broadcastFinalized = useCallback(() => {
    const ch = openPeleaChannel(peleaId);
    broadcast(ch, { type: "finalized", peleaId, savedAt: Date.now() });
    // Cerrar de inmediato tira el mensaje (postMessage se despacha en una
    // task posterior); legacy usaba un canal de vida larga. Cierre diferido.
    if (ch) setTimeout(() => ch.close(), 2000);
  }, [peleaId]);

  // Submit del modal en modo EDICIÓN (la pelea ya estaba decidida).
  const submitEdit = useCallback(
    async (values: FinalizeValues) => {
      if (!pelea) return;
      let ganadorId = "";
      if (values.ganador === "a1") ganadorId = pelea.atleta1_id || "";
      else if (values.ganador === "a2") ganadorId = pelea.atleta2_id || "";
      await api.post("peleas.update", {
        id: peleaId,
        ganador_id: ganadorId,
        metodo_finalizacion: values.metodo,
        round_finalizacion: values.round === "" ? "" : Number(values.round),
        tiempo_finalizacion: values.tiempo,
        notas: values.notas,
      });
      clearSnapshot(peleaId);
      broadcastFinalized();
      // Modo edición: sin redirect — mismo lugar, banner actualizado.
      setEditando(false);
      recargar();
    },
    [pelea, peleaId, broadcastFinalized, recargar],
  );

  const abrirPublica = useCallback(() => {
    if (!eventoId) return;
    const w = window.open(
      `/scoreboard/${encodeURIComponent(eventoId)}`,
      "cs_public_view",
      "noopener=no,width=1280,height=720",
    );
    w?.focus();
  }, [eventoId]);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  const decidida = !!pelea?.ganador_id;
  const tiempoConfig = pelea ? configurarTiempo(pelea) : null;

  let headerTitle = "Scoreboard";
  let headerMeta = "Cargando…";
  if (error) {
    headerTitle = "Error";
    headerMeta = "Sin datos";
  } else if (pelea) {
    headerTitle = `Pelea #${pelea.numero_pelea ?? ""} · ${pelea.ronda || ""}`;
    headerMeta = pelea.bracket?.categoria || "";
  }

  return (
    <div className={`scoreboard-page${isFs ? " is-fullscreen" : ""}`}>
      <header className="scoreboard-header">
        <div className="scoreboard-brand">
          <Image
            src="/images/logo-white.png"
            alt="Club Samoa"
            width={480}
            height={600}
          />
          <div className="scoreboard-brand-text">
            <strong>{headerTitle}</strong>
            <span>{headerMeta}</span>
          </div>
        </div>
        <div className="scoreboard-header-actions">
          <span
            className={`save-indicator${saveVisible ? " is-visible" : ""}`}
            title="Auto-guardado local"
          >
            {saveVisible ? "💾 Guardado" : ""}
          </span>
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
            title="Refrescar datos"
            onClick={recargar}
          >
            ⟳
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            title="Abrir vista pública en otra ventana (para el proyector)"
            onClick={abrirPublica}
          >
            📺 Vista pública
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            title="Pantalla completa de operador (Esc para salir)"
            onClick={toggleFullscreen}
          >
            {isFs ? "⛶ Salir pantalla completa" : "⛶ Pantalla completa"}
          </button>
        </div>
      </header>

      <main className="scoreboard-main">
        {cargando && (
          <div
            className="loading-message"
            style={{ textAlign: "center", padding: "80px 20px" }}
          >
            Cargando pelea…
          </div>
        )}

        {!cargando && error && (
          <div
            className="error-state"
            style={{ margin: "60px auto", maxWidth: 540 }}
          >
            <h3>No pudimos cargar la pelea</h3>
            <p>{error}</p>
          </div>
        )}

        {!cargando &&
          !error &&
          pelea &&
          !pelea.atleta1_id &&
          !pelea.atleta2_id && (
            <div
              className="placeholder"
              style={{ margin: "60px auto", maxWidth: 560 }}
            >
              <span className="placeholder-tag">Esperando</span>
              <h2>Esta pelea aún no tiene atletas</h2>
              <p>
                Los ganadores de las peleas anteriores se avanzarán
                automáticamente cuando se decidan.
              </p>
            </div>
          )}

        {!cargando && !error && pelea && decidida && (
          <VistaFinalizada
            pelea={pelea}
            buscandoNext={buscandoNext}
            onEditar={() => setEditando(true)}
            onVolverBracket={() => {
              if (bracketId)
                router.push(`/bracket/${encodeURIComponent(bracketId)}`);
              else window.history.back();
            }}
            onProxima={() => {
              setBuscandoNext(true);
              void goToNextPending({ alertIfNone: true }).finally(() =>
                setBuscandoNext(false),
              );
            }}
          />
        )}

        {!cargando &&
          !error &&
          pelea &&
          !decidida &&
          (pelea.atleta1_id || pelea.atleta2_id) &&
          tiempoConfig && (
            <ScoreboardActivo
              key={`${peleaId}:${intento}`}
              peleaId={peleaId}
              pelea={pelea}
              tiempo={tiempoConfig}
              onSaved={onSaved}
              onFinalized={{
                clearAndBroadcast: () => {
                  clearSnapshot(peleaId);
                  broadcastFinalized();
                },
                goToNextPending,
                stash: stashPrefetchedPelea,
                push: (url: string) => router.push(url),
                reload: recargar,
              }}
            />
          )}
      </main>

      {editando && pelea && tiempoConfig && (
        <FinalizarModal
          mode="edit"
          pelea={pelea}
          maxRound={tiempoConfig.rounds}
          initial={{
            ganador:
              pelea.ganador_id && pelea.ganador_id === pelea.atleta1_id
                ? "a1"
                : pelea.ganador_id && pelea.ganador_id === pelea.atleta2_id
                  ? "a2"
                  : "empate",
            metodo: pelea.metodo_finalizacion || "",
            round: String(pelea.round_finalizacion || 1),
            tiempo: formatTiempoFinalizacion(pelea.tiempo_finalizacion).clean,
            notas: pelea.notas || "",
            resumen: "",
          }}
          onClose={() => setEditando(false)}
          onSubmit={submitEdit}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Vista de pelea ya decidida (banner de ganador + acciones)
// ------------------------------------------------------------
function VistaFinalizada({
  pelea,
  buscandoNext,
  onEditar,
  onVolverBracket,
  onProxima,
}: {
  pelea: PeleaScoreboard;
  buscandoNext: boolean;
  onEditar: () => void;
  onVolverBracket: () => void;
  onProxima: () => void;
}) {
  const tiempoFmt = formatTiempoFinalizacion(pelea.tiempo_finalizacion);
  const detalle = [
    pelea.round_finalizacion ? `Round ${pelea.round_finalizacion}` : "",
    tiempoFmt.clean ? `Tiempo: ${tiempoFmt.clean}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  const metodo = (pelea.metodo_finalizacion || "").toUpperCase();

  return (
    <>
      {pelea.ganador ? (
        <div className="winner-banner">
          <div className="winner-banner-label">
            GANADOR POR {metodo || "DECISIÓN"}
          </div>
          <div className="winner-banner-name">
            {pelea.ganador.nombre_completo || pelea.ganador.id || ""}
          </div>
          {pelea.ganador.academia && (
            <div className="winner-banner-academia">
              {pelea.ganador.academia}
            </div>
          )}
        </div>
      ) : (
        <div className="winner-banner winner-banner-tie">
          <div className="winner-banner-label">{metodo || "FINALIZADO"}</div>
        </div>
      )}
      {detalle && <div className="finalizado-detalle">{detalle}</div>}
      {pelea.notas && <div className="finalizado-notas">{pelea.notas}</div>}
      <div className="finalizado-actions">
        <button className="btn btn-ghost" type="button" onClick={onEditar}>
          ✏ Editar resultado
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={onVolverBracket}
        >
          ← Volver al bracket
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={buscandoNext}
          onClick={onProxima}
        >
          {buscandoNext ? "Buscando…" : "Próxima pelea pendiente →"}
        </button>
      </div>
      {tiempoFmt.raw && (
        <div className="finalizado-raw">Valor crudo: {tiempoFmt.raw}</div>
      )}
    </>
  );
}

// ------------------------------------------------------------
// Vista activa: timer + controles + scoring (montada solo con pelea viva)
// ------------------------------------------------------------
function ScoreboardActivo({
  peleaId,
  pelea,
  tiempo,
  onSaved,
  onFinalized,
}: {
  peleaId: string;
  pelea: PeleaScoreboard;
  tiempo: TiempoConfig;
  onSaved: () => void;
  onFinalized: {
    clearAndBroadcast: () => void;
    goToNextPending: (opts: {
      alertIfNone?: boolean;
      fallbackToBracket?: boolean;
    }) => Promise<boolean>;
    stash: (peleaId: string, pelea: PeleaScoreboard) => void;
    push: (url: string) => void;
    reload: () => void;
  };
}) {
  const [state, dispatch] = useScoreboard(tiempo);
  // Snapshot guardado → banner de restauración (T21). Este componente solo
  // se monta en cliente (tras cargar la pelea), así que leer localStorage
  // en el inicializador es seguro — no hay HTML de servidor que hidratar.
  const [pendingSnapshot, setPendingSnapshot] = useState<Snapshot | null>(() =>
    loadSnapshot(peleaId),
  );
  const [finalizeInitial, setFinalizeInitial] =
    useState<FinalizeInitial | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const readyToSave = useRef(pendingSnapshot === null);
  const lastBell = useRef(0);

  // Canal de la pelea, para la vista pública
  useEffect(() => {
    channelRef.current = openPeleaChannel(peleaId);
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [peleaId]);

  // Autosave + broadcast en cada cambio relevante (legacy guardaba cada
  // segundo con el timer corriendo — aquí cada tick visible dispara esto).
  useEffect(() => {
    if (!readyToSave.current) return;
    const snapshot: Snapshot = {
      peleaId,
      currentRound: state.currentRound,
      secondsRemaining: state.secondsRemaining,
      isResting: state.isResting,
      isRunning: state.isRunning,
      scoring: state.scoring,
      savedAt: Date.now(),
    };
    saveSnapshot(snapshot);
    broadcast(channelRef.current, snapshot);
    onSaved();
  }, [
    peleaId,
    state.currentRound,
    state.secondsRemaining,
    state.isResting,
    state.isRunning,
    state.scoring,
    onSaved,
  ]);

  // Campana al final de cada segmento
  useEffect(() => {
    if (state.bellCount > lastBell.current) {
      lastBell.current = state.bellCount;
      playBell(audioRef);
    }
  }, [state.bellCount]);

  // Atajos de teclado (Space / F / ← / →) — no aplican con el modal abierto
  const modalAbierto = finalizeInitial !== null;
  useEffect(() => {
    if (modalAbierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.code === "Space") {
        e.preventDefault();
        dispatch({
          type: state.isRunning ? "pause" : "start",
          now: Date.now(),
        });
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "addTime", delta: 10, now: Date.now() });
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        dispatch({ type: "addTime", delta: -10, now: Date.now() });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dispatch, state.isRunning, modalAbierto]);

  const fightOver = isFightOver(state);
  const isLastRound = state.currentRound >= tiempo.rounds && !state.isResting;

  const abrirFinalizar = () => {
    // Pausar de inmediato: el operador no está peleando mientras llena el
    // modal, y la vista pública también debe parar al instante.
    if (state.isRunning) dispatch({ type: "pause", now: Date.now() });

    const a1Name = pelea.atleta1?.nombre_completo || "Atleta 1";
    const a2Name = pelea.atleta2?.nombre_completo || "Atleta 2";
    const s1 = totalScore(state.scoring, "a1");
    const s2 = totalScore(state.scoring, "a2");
    const resumen =
      `Puntaje: ${a1Name} ${s1} — ${s2} ${a2Name}` +
      `  ·  Adv ${totalAdv(state.scoring, "a1")}/${totalAdv(state.scoring, "a2")}` +
      `  ·  Faltas ${totalFaltas(state.scoring, "a1")}/${totalFaltas(state.scoring, "a2")}`;

    const elapsed = state.isResting
      ? tiempo.segundosPorRound
      : Math.max(0, tiempo.segundosPorRound - state.secondsRemaining);

    setFinalizeInitial({
      ganador:
        s1 > s2 && pelea.atleta1_id
          ? "a1"
          : s2 > s1 && pelea.atleta2_id
            ? "a2"
            : null,
      metodo: "",
      round: String(state.currentRound || 1),
      tiempo: formatTime(elapsed),
      notas: "",
      resumen,
    });
  };

  const submitCreate = async (values: FinalizeValues) => {
    let ganadorId = "";
    if (values.ganador === "a1") ganadorId = pelea.atleta1_id || "";
    else if (values.ganador === "a2") ganadorId = pelea.atleta2_id || "";
    const payload = {
      id: peleaId,
      ganador_id: ganadorId,
      metodo_finalizacion: values.metodo,
      round_finalizacion: values.round === "" ? "" : Number(values.round),
      tiempo_finalizacion: values.tiempo,
      notas: values.notas,
    };

    // Fast path: UNA llamada guarda el resultado Y devuelve la próxima
    // pelea enriquecida (se pinta al instante vía sessionStorage).
    try {
      const fin = (await api.post(
        "peleas.finalize",
        payload,
      )) as FinalizeResponse;
      if (fin?.ok) {
        onFinalized.clearAndBroadcast();
        if (fin.next_found && fin.next_pelea_id) {
          if (fin.next_pelea)
            onFinalized.stash(fin.next_pelea_id, fin.next_pelea);
          onFinalized.push(
            `/admin/scoreboard/${encodeURIComponent(fin.next_pelea_id)}`,
          );
        } else {
          const done = await onFinalized.goToNextPending({
            fallbackToBracket: true,
          });
          if (!done) {
            setFinalizeInitial(null);
            onFinalized.reload();
          }
        }
        return;
      }
    } catch (finErr) {
      console.warn(
        "[scoreboard] peleas.finalize no disponible, uso método clásico:",
        finErr,
      );
    }

    // Camino clásico
    await api.post("peleas.update", payload);
    onFinalized.clearAndBroadcast();
    const navigated = await onFinalized.goToNextPending({
      fallbackToBracket: true,
    });
    if (!navigated) {
      setFinalizeInitial(null);
      onFinalized.reload();
    }
  };

  return (
    <>
      {pendingSnapshot && (
        <RestoreBanner
          snapshot={pendingSnapshot}
          onApply={() => {
            dispatch({ type: "restore", snapshot: pendingSnapshot });
            readyToSave.current = true;
            setPendingSnapshot(null);
          }}
          onDiscard={() => {
            clearSnapshot(peleaId);
            readyToSave.current = true;
            setPendingSnapshot(null);
          }}
        />
      )}

      <div className="scoreboard-atletas">
        <AtletaCard pelea={pelea} state={state} side="a1" />
        <div className="scoreboard-vs">VS</div>
        <AtletaCard pelea={pelea} state={state} side="a2" />
      </div>

      <div className="scoreboard-round-info">
        {fightOver ? (
          <span className="round-label is-finished">Pelea terminada</span>
        ) : state.isResting ? (
          <>
            <span className="round-label is-rest">Descanso</span>{" "}
            <span className="round-counter">
              antes de Round {state.currentRound + 1} / {tiempo.rounds}
            </span>
          </>
        ) : (
          <>
            <span className="round-label">Round</span>{" "}
            <span className="round-counter">
              {state.currentRound} / {tiempo.rounds}
            </span>
          </>
        )}
      </div>

      <div
        className={`scoreboard-timer${state.isResting ? " is-resting" : ""}${!state.isResting && state.secondsRemaining > 0 && state.secondsRemaining <= 10 ? " is-low" : ""}${state.secondsRemaining <= 0 ? " is-zero" : ""}`}
      >
        {formatTime(state.secondsRemaining)}
      </div>

      <div className="scoreboard-controls">
        <div className="scoreboard-controls-row scoreboard-controls-main">
          <button
            className="btn btn-control btn-start"
            type="button"
            disabled={state.isRunning || fightOver}
            onClick={() => dispatch({ type: "start", now: Date.now() })}
          >
            ▶ Start
          </button>
          <button
            className="btn btn-control btn-pause"
            type="button"
            disabled={!state.isRunning}
            onClick={() => dispatch({ type: "pause", now: Date.now() })}
          >
            ⏸ Pause
          </button>
          <button
            className="btn btn-control btn-reset"
            type="button"
            onClick={() => dispatch({ type: "resetRound", now: Date.now() })}
          >
            ↺ Reset round
          </button>
          <button
            className="btn btn-control btn-next"
            type="button"
            disabled={isLastRound}
            onClick={() => dispatch({ type: "nextRound", now: Date.now() })}
          >
            ▶▶ Next round
          </button>
        </div>
        <div className="scoreboard-controls-row scoreboard-controls-adjust">
          <button
            className="btn btn-control btn-adjust"
            type="button"
            title="Restar 10 segundos (Flecha ←)"
            onClick={() =>
              dispatch({ type: "addTime", delta: -10, now: Date.now() })
            }
          >
            −10 seg
          </button>
          <button
            className="btn btn-control btn-adjust"
            type="button"
            title="Sumar 10 segundos (Flecha →)"
            onClick={() =>
              dispatch({ type: "addTime", delta: 10, now: Date.now() })
            }
          >
            +10 seg
          </button>
          <button
            className={`btn btn-control btn-finalize${fightOver ? " is-prominent" : ""}`}
            type="button"
            onClick={abrirFinalizar}
          >
            ✓ Finalizar pelea
          </button>
        </div>
      </div>

      <ScoringPanel state={state} pelea={pelea} dispatch={dispatch} />

      <div className="scoreboard-coming-soon">
        Atajos: Space = play/pause · F = pantalla completa · ← −10s · → +10s
      </div>

      {finalizeInitial && (
        <FinalizarModal
          mode="create"
          pelea={pelea}
          maxRound={tiempo.rounds}
          initial={finalizeInitial}
          onClose={() => setFinalizeInitial(null)}
          onSubmit={submitCreate}
        />
      )}
    </>
  );
}

function RestoreBanner({
  snapshot,
  onApply,
  onDiscard,
}: {
  snapshot: Snapshot;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [ahora] = useState(() => Date.now());
  const minutes = Math.round((ahora - snapshot.savedAt) / 60000);
  const ago =
    minutes < 1
      ? "hace menos de un minuto"
      : minutes === 1
        ? "hace 1 minuto"
        : `hace ${minutes} minutos`;
  return (
    <div className="restore-banner">
      <div className="restore-banner-text">
        <strong>Estado guardado encontrado</strong> · auto-guardado {ago}.
        <br />
        <small>
          Round {snapshot.currentRound || 1}
          {snapshot.isResting ? " (en descanso)" : ""} ·{" "}
          {formatTime(snapshot.secondsRemaining || 0)} restante
        </small>
      </div>
      <div className="restore-banner-actions">
        <button className="btn btn-sm" type="button" onClick={onDiscard}>
          Empezar desde cero
        </button>
        <button
          className="btn btn-sm btn-primary"
          type="button"
          onClick={onApply}
        >
          Restaurar
        </button>
      </div>
    </div>
  );
}

function AtletaCard({
  pelea,
  state,
  side,
}: {
  pelea: PeleaScoreboard;
  state: ScoreboardState;
  side: Side;
}) {
  const atleta = side === "a1" ? pelea.atleta1 : pelea.atleta2;
  const atletaId = side === "a1" ? pelea.atleta1_id : pelea.atleta2_id;
  let nombre: string, academia: string, initials: string;
  if (!atleta && !atletaId) {
    nombre = "Por definir";
    academia = "Esperando…";
    initials = "?";
  } else if (!atleta) {
    nombre = atletaId!;
    academia = "";
    initials = "?";
  } else {
    nombre = atleta.nombre_completo || atleta.id || "";
    academia = atleta.academia || atleta.pais || "";
    initials = initialsOf(nombre);
  }
  const faltas = totalFaltas(state.scoring, side);
  return (
    <div
      className={`scoreboard-atleta scoreboard-atleta-${side === "a1" ? "left" : "right"}`}
      data-side={side}
    >
      <div className="scoreboard-atleta-top">
        <div className="scoreboard-atleta-avatar">{initials}</div>
        <div className="scoreboard-atleta-textwrap">
          <div className="scoreboard-atleta-name">{nombre}</div>
          <div className="scoreboard-atleta-academia">{academia}</div>
        </div>
        <div className="scoreboard-atleta-total">
          {totalScore(state.scoring, side)}
        </div>
      </div>
      <div className="scoreboard-atleta-counters">
        <span className="counter-adv">
          Adv: {totalAdv(state.scoring, side)}
        </span>
        <span
          className={`counter-falta${faltas === 2 ? " is-warning" : ""}${faltas >= 3 ? " is-critical" : ""}`}
        >
          Faltas: {faltas}
        </span>
      </div>
    </div>
  );
}
