/**
 * Scoreboard de pelea (T18 — timer).
 *
 * Carga la pelea por ?pelea_id=X via api.peleas.get, parsea la categoría
 * del bracket, obtiene los rounds y duración del reglamento, y muestra:
 *
 *   - Header con datos de la pelea (categoría, ronda, # pelea).
 *   - Dos atleta cards (izq + der) con foto/iniciales, nombre, academia.
 *   - Timer grande tipo Smoothcomp con MM:SS.
 *   - Indicador de "Round N / M".
 *   - Controles: Start, Pause, Reset round, Next round.
 *   - Bell sound (Web Audio API) al finalizar cada round.
 *
 * T19, T20, T21 agregan puntos, finalización y autosave/proyección.
 */
(function (root) {
  "use strict";

  var state = {
    peleaId: null,
    pelea: null,
    bracketCat: null,    // string completo "Adultos / Masculino / ..."
    tiempoConfig: null,  // { rounds, segundosPorRound, segundosDescanso }
    currentRound: 1,
    secondsRemaining: 0,
    isRunning: false,
    isResting: false,    // entre rounds, en periodo de descanso
    intervalId: null,
    audioCtx: null,
    error: null,
    loading: true,
    // T19 — scoring
    scoring: null,       // { rounds: [{a1, a2, a1_adv, a2_adv, a1_faltas, a2_faltas}, ...] }
    // T21 — autosave
    lastSavedAt: null,
  };

  /* ============================================================
   * T21 — Autosave a localStorage
   * ============================================================ */

  var STORAGE_KEY_PREFIX = "cs_scoreboard_";

  function storageKey_() {
    return state.peleaId ? STORAGE_KEY_PREFIX + state.peleaId : null;
  }

  var broadcastChannel_ = null;
  function getBroadcastChannel_() {
    if (!state.peleaId) return null;
    if (broadcastChannel_) return broadcastChannel_;
    if (typeof BroadcastChannel === "undefined") return null;
    try {
      broadcastChannel_ = new BroadcastChannel("cs_scoreboard_" + state.peleaId);
    } catch (e) {
      broadcastChannel_ = null;
    }
    return broadcastChannel_;
  }

  /**
   * Publica la pelea actualmente activa para que una vista pública abierta
   * con ?evento_id=X pueda re-engancharse sin tener que abrirla de nuevo.
   * Escribe en localStorage (con storage event listener en el público) y en
   * un BroadcastChannel evento-scoped (sync instantáneo).
   */
  var EVENT_CURRENT_PREFIX = "cs_admin_current_pelea_";
  function publishCurrentPelea_() {
    if (!state.pelea || !state.peleaId) return;
    var eventoId =
      (state.pelea.bracket && state.pelea.bracket.evento_id) ||
      state.pelea.evento_id;
    if (!eventoId) return;

    var payload = {
      pelea_id: state.peleaId,
      evento_id: eventoId,
      bracket_id:
        (state.pelea.bracket && state.pelea.bracket.id) ||
        state.pelea.bracket_id ||
        "",
      at: Date.now(),
    };
    try {
      localStorage.setItem(EVENT_CURRENT_PREFIX + eventoId, JSON.stringify(payload));
    } catch (e) { /* ignore */ }
    try {
      if (typeof BroadcastChannel !== "undefined") {
        var ch = new BroadcastChannel(EVENT_CURRENT_PREFIX + eventoId);
        ch.postMessage(payload);
        ch.close();
      }
    } catch (e) { /* ignore */ }
  }

  function saveState_() {
    var key = storageKey_();
    if (!key || !state.scoring || !state.tiempoConfig) return;
    try {
      var snapshot = {
        peleaId: state.peleaId,
        currentRound: state.currentRound,
        secondsRemaining: state.secondsRemaining,
        isResting: state.isResting,
        isRunning: state.isRunning, // útil para la vista pública
        scoring: state.scoring,
        savedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(snapshot));
      state.lastSavedAt = snapshot.savedAt;
      updateSaveIndicator_();

      // Broadcast en tiempo real para la vista pública en otra ventana
      var ch = getBroadcastChannel_();
      if (ch) {
        try { ch.postMessage(snapshot); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn("[scoreboard] saveState_ failed:", e);
    }
  }

  function loadSavedState_() {
    var key = storageKey_();
    if (!key) return null;
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearSavedState_() {
    var key = storageKey_();
    if (!key) return;
    try {
      localStorage.removeItem(key);
      state.lastSavedAt = null;
    } catch (e) {}
  }

  function applySavedState_(snapshot) {
    if (!snapshot) return;
    state.currentRound = snapshot.currentRound || 1;
    state.secondsRemaining = typeof snapshot.secondsRemaining === "number"
      ? snapshot.secondsRemaining
      : state.tiempoConfig.segundosPorRound;
    state.isResting = !!snapshot.isResting;
    if (snapshot.scoring && Array.isArray(snapshot.scoring.rounds)) {
      // Merge defensivo: si el shape cambió, mantener defaults
      state.scoring = snapshot.scoring;
    }
    state.lastSavedAt = snapshot.savedAt;
    // Nunca restauramos como "running" — el operador inicia manualmente
    state.isRunning = false;
  }

  function updateSaveIndicator_() {
    var el = document.getElementById("save-indicator");
    if (!el) return;
    if (!state.lastSavedAt) {
      el.textContent = "";
      return;
    }
    el.textContent = "💾 Guardado";
    el.classList.add("is-visible");
    clearTimeout(updateSaveIndicator_._t);
    updateSaveIndicator_._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 1500);
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------

  var params = new URLSearchParams(location.search);
  state.peleaId = params.get("pelea_id");

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("btn-refresh").addEventListener("click", load);
    document.getElementById("btn-fullscreen").addEventListener("click", toggleFullscreen);
    var btnPublic = document.getElementById("btn-public");
    if (btnPublic) {
      btnPublic.addEventListener("click", function () {
        if (!state.peleaId) return;
        // Si ya cargamos la pelea y tenemos evento_id, abrir en modo
        // "follow event" — la vista pública seguirá automáticamente al
        // admin cuando cambies de pelea. Si todavía no cargó, caemos al
        // modo per-pelea (legacy) y la nueva carga ya re-publicará.
        var eventoId =
          (state.pelea && state.pelea.bracket && state.pelea.bracket.evento_id) ||
          (state.pelea && state.pelea.evento_id);
        var url = eventoId
          ? "./scoreboard-public.html?evento_id=" + encodeURIComponent(eventoId)
          : "./scoreboard-public.html?pelea_id=" + encodeURIComponent(state.peleaId);
        var w = window.open(url, "cs_public_view", "noopener=no,width=1280,height=720");
        if (w) w.focus();
      });
    }

    document.addEventListener("fullscreenchange", function () {
      var on = !!document.fullscreenElement;
      document.body.classList.toggle("is-fullscreen", on);
      var btn = document.getElementById("btn-fullscreen");
      if (btn) btn.textContent = on ? "⛶ Salir pantalla completa" : "⛶ Pantalla completa";
    });

    document.addEventListener("keydown", function (e) {
      if (isInputFocused_()) return;
      // Space = play/pause
      if (e.code === "Space") {
        e.preventDefault();
        if (state.isRunning) pause(); else start();
        return;
      }
      // F = fullscreen
      if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      // ArrowRight = +10s, ArrowLeft = -10s
      if (e.code === "ArrowRight") {
        e.preventDefault();
        addTime(10);
        return;
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        addTime(-10);
        return;
      }
    });

    if (!state.peleaId) {
      renderError("Falta el parámetro <code>?pelea_id=pel_XXX</code> en la URL.");
      return;
    }
    load();
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
    } else {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      if (req) req.call(el).catch(function () {});
    }
  }

  function addTime(seconds) {
    if (!state.tiempoConfig) return;
    var maxAllowed = state.isResting
      ? state.tiempoConfig.segundosDescanso
      : state.tiempoConfig.segundosPorRound;
    state.secondsRemaining = Math.max(
      0,
      Math.min(state.secondsRemaining + seconds, maxAllowed * 2), // permitir hasta 2x el round para casos raros
    );
    renderTimer();
    renderControls();
    saveState_();
  }

  function isInputFocused_() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  }

  // ------------------------------------------------------------
  // Load
  // ------------------------------------------------------------

  async function load() {
    state.loading = true;
    state.error = null;
    renderLoading();

    try {
      var res = await root.api.get("peleas.get", { id: state.peleaId });
      state.pelea = res.pelea;
      state.bracketCat = (state.pelea.bracket && state.pelea.bracket.categoria) || "";
      // Publicar pelea activa para vistas públicas en modo evento
      publishCurrentPelea_();
      configureTimer();

      // T21 — buscar estado guardado en localStorage
      var saved = loadSavedState_();
      var peleaFinalized = !!state.pelea.ganador_id;
      if (saved && !peleaFinalized) {
        // Ofrecer restaurar via banner inline
        state.loading = false;
        render();
        showRestoreBanner_(saved);
      } else {
        if (saved && peleaFinalized) clearSavedState_();
        state.loading = false;
        render();
      }
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : String(err);
      renderError(state.error);
    }
  }

  function showRestoreBanner_(snapshot) {
    var main = document.getElementById("scoreboard-main");
    if (!main) return;
    var minutes = Math.round((Date.now() - snapshot.savedAt) / 60000);
    var ago = minutes < 1 ? "hace menos de un minuto" :
              minutes === 1 ? "hace 1 minuto" :
              "hace " + minutes + " minutos";

    var banner = document.createElement("div");
    banner.className = "restore-banner";
    banner.innerHTML =
      '<div class="restore-banner-text">' +
      '<strong>Estado guardado encontrado</strong> · auto-guardado ' + ago + ".<br>" +
      '<small>Round ' + (snapshot.currentRound || 1) +
      (snapshot.isResting ? " (en descanso)" : "") +
      " · " + formatTime_(snapshot.secondsRemaining || 0) + " restante" +
      "</small>" +
      "</div>" +
      '<div class="restore-banner-actions">' +
      '<button class="btn btn-sm" id="btn-restore-discard">Empezar desde cero</button>' +
      '<button class="btn btn-sm btn-primary" id="btn-restore-apply">Restaurar</button>' +
      "</div>";
    main.insertBefore(banner, main.firstChild);

    document.getElementById("btn-restore-apply").addEventListener("click", function () {
      applySavedState_(snapshot);
      banner.remove();
      render();
    });
    document.getElementById("btn-restore-discard").addEventListener("click", function () {
      clearSavedState_();
      banner.remove();
    });
  }

  function configureTimer() {
    // Parsear "División / Género / Nivel / Peso"
    var parts = String(state.bracketCat || "").split(" / ");
    var division = parts[0] || "Adultos";
    var nivel = parts[2] || "Avanzado";
    var esFinal = state.pelea.ronda === "final";

    try {
      state.tiempoConfig = root.Reglamento.tiempoPelea(division, nivel, esFinal);
    } catch (e) {
      // Fallback razonable
      console.warn("[scoreboard] tiempoPelea falló:", e);
      state.tiempoConfig = {
        rounds: 1,
        segundosPorRound: 180,
        segundosDescanso: 0,
      };
    }
    state.currentRound = 1;
    state.secondsRemaining = state.tiempoConfig.segundosPorRound;
    state.isResting = false;
    state.isRunning = false;

    // Init scoring por round
    var nRounds = state.tiempoConfig.rounds;
    state.scoring = { rounds: [] };
    for (var i = 0; i < nRounds; i += 1) {
      state.scoring.rounds.push({
        a1: null,
        a2: null,
        a1_adv: 0,
        a2_adv: 0,
        a1_faltas: 0,
        a2_faltas: 0,
      });
    }
  }

  /* ------------------------------------------------------------
   * T19 — Scoring (10-point must system)
   * ------------------------------------------------------------ */

  function setRoundScore(side, points) {
    if (!state.scoring) return;
    var roundIdx = state.currentRound - 1;
    var round = state.scoring.rounds[roundIdx];
    if (!round) return;
    var other = side === "a1" ? "a2" : "a1";
    round[side] = points;
    if (points < 10) {
      round[other] = 10;
    }
    renderScoring_();
    saveState_();
  }

  function clearRoundScore() {
    if (!state.scoring) return;
    var roundIdx = state.currentRound - 1;
    var round = state.scoring.rounds[roundIdx];
    if (!round) return;
    round.a1 = null;
    round.a2 = null;
    renderScoring_();
    saveState_();
  }

  function addAdv(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_adv"] += 1;
    renderScoring_();
    saveState_();
  }
  function removeAdv(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_adv"] = Math.max(0, round[side + "_adv"] - 1);
    renderScoring_();
    saveState_();
  }
  function addFalta(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_faltas"] += 1;
    renderScoring_();
    saveState_();
  }
  function removeFalta(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_faltas"] = Math.max(0, round[side + "_faltas"] - 1);
    renderScoring_();
    saveState_();
  }

  function totalScore(side) {
    if (!state.scoring) return 0;
    return state.scoring.rounds.reduce(function (acc, r) {
      return acc + (typeof r[side] === "number" ? r[side] : 0);
    }, 0);
  }

  function totalAdv(side) {
    if (!state.scoring) return 0;
    return state.scoring.rounds.reduce(function (acc, r) { return acc + r[side + "_adv"]; }, 0);
  }

  function totalFaltas(side) {
    if (!state.scoring) return 0;
    return state.scoring.rounds.reduce(function (acc, r) { return acc + r[side + "_faltas"]; }, 0);
  }

  // ------------------------------------------------------------
  // Timer logic
  // ------------------------------------------------------------

  function start() {
    if (state.isRunning) return;
    if (state.secondsRemaining <= 0) return;
    state.isRunning = true;
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(tick, 1000);
    renderControls();
  }

  function pause() {
    if (!state.isRunning) return;
    state.isRunning = false;
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    renderControls();
    saveState_();
  }

  function tick() {
    state.secondsRemaining -= 1;
    if (state.secondsRemaining > 0) {
      renderTimer();
      // Auto-save cada segundo para mantener la vista pública sincronizada
      saveState_();
      return;
    }

    // Tiempo agotado para el segmento actual
    state.secondsRemaining = 0;
    playBell();

    if (state.isResting) {
      // El descanso terminó → arrancar próximo round automáticamente.
      state.isResting = false;
      state.currentRound += 1;
      if (state.currentRound > state.tiempoConfig.rounds) {
        // Caso defensivo, no debería pasar
        state.currentRound = state.tiempoConfig.rounds;
        pause();
        renderScoring_();
      } else {
        state.secondsRemaining = state.tiempoConfig.segundosPorRound;
        // Seguimos corriendo
      }
    } else {
      // Acabó un round
      if (state.currentRound < state.tiempoConfig.rounds) {
        // Hay más rounds. Si hay descanso configurado, arrancarlo
        // automáticamente. Si no, brincar al próximo round directo.
        if (state.tiempoConfig.segundosDescanso > 0) {
          state.isResting = true;
          state.secondsRemaining = state.tiempoConfig.segundosDescanso;
          // Seguimos corriendo
        } else {
          state.currentRound += 1;
          state.secondsRemaining = state.tiempoConfig.segundosPorRound;
        }
      } else {
        // Fin del último round → pelea terminada, parar timer
        pause();
        renderScoring_();
      }
    }
    renderTimer();
    renderControls();
    saveState_();
  }

  function resetRound() {
    pause();
    if (state.isResting) {
      state.secondsRemaining = state.tiempoConfig.segundosDescanso;
    } else {
      state.secondsRemaining = state.tiempoConfig.segundosPorRound;
    }
    renderTimer();
    renderControls();
    saveState_();
  }

  function nextRound() {
    pause();
    if (state.isResting) {
      // Saltar el descanso y entrar al próximo round
      state.isResting = false;
      state.currentRound = Math.min(state.currentRound + 1, state.tiempoConfig.rounds);
      state.secondsRemaining = state.tiempoConfig.segundosPorRound;
    } else if (state.currentRound < state.tiempoConfig.rounds) {
      // Avanzar manualmente (con o sin descanso)
      if (state.tiempoConfig.segundosDescanso > 0) {
        state.isResting = true;
        state.secondsRemaining = state.tiempoConfig.segundosDescanso;
      } else {
        state.currentRound += 1;
        state.secondsRemaining = state.tiempoConfig.segundosPorRound;
      }
    } else {
      // Ya estábamos en el último round → no hay siguiente
      state.secondsRemaining = 0;
    }
    renderTimer();
    renderControls();
    saveState_();
  }

  function resetAll() {
    pause();
    state.currentRound = 1;
    state.secondsRemaining = state.tiempoConfig.segundosPorRound;
    state.isResting = false;
    renderTimer();
    renderControls();
  }

  // ------------------------------------------------------------
  // Bell (Web Audio API)
  // ------------------------------------------------------------

  function playBell() {
    try {
      if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      var ctx = state.audioCtx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.4;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      // Segunda tono más bajo
      setTimeout(function () {
        osc.frequency.value = 660;
      }, 200);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.warn("[scoreboard] bell sound failed:", e);
    }
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  function renderLoading() {
    var main = document.getElementById("scoreboard-main");
    if (main) main.innerHTML = '<div class="loading-message" style="text-align:center; padding:80px 20px;">Cargando pelea…</div>';
    document.getElementById("scoreboard-title").textContent = "Scoreboard";
    document.getElementById("scoreboard-meta").textContent = "Cargando…";
  }

  function renderError(msg) {
    var main = document.getElementById("scoreboard-main");
    if (main) {
      main.innerHTML =
        '<div class="error-state" style="margin:60px auto; max-width:540px;">' +
        "<h3>No pudimos cargar la pelea</h3>" +
        "<p>" + msg + "</p>" +
        "</div>";
    }
    document.getElementById("scoreboard-title").textContent = "Error";
    document.getElementById("scoreboard-meta").textContent = "Sin datos";
  }

  function render() {
    var p = state.pelea;
    if (!p) return;

    // Header
    document.title = "Pelea #" + p.numero_pelea + " · Scoreboard";
    document.getElementById("scoreboard-title").textContent =
      "Pelea #" + p.numero_pelea + " · " + (p.ronda || "");
    document.getElementById("scoreboard-meta").textContent = state.bracketCat || "";

    var main = document.getElementById("scoreboard-main");
    var alreadyDecided = !!p.ganador_id;

    // Si la pelea no tiene atletas asignados todavía (esperando ronda anterior)
    if (!p.atleta1_id && !p.atleta2_id) {
      main.innerHTML =
        '<div class="placeholder" style="margin:60px auto; max-width:560px;">' +
        '<span class="placeholder-tag">Esperando</span>' +
        "<h2>Esta pelea aún no tiene atletas</h2>" +
        "<p>Los ganadores de las peleas anteriores se avanzarán automáticamente cuando se decidan.</p>" +
        "</div>";
      return;
    }

    var t = state.tiempoConfig || { rounds: 1, segundosPorRound: 180, segundosDescanso: 0 };

    var winnerBanner = "";
    if (alreadyDecided && p.ganador) {
      var ganadorNombre = p.ganador.nombre_completo || p.ganador.id || "";
      var academia = p.ganador.academia || "";
      var metodo = p.metodo_finalizacion || "DECISIÓN";
      winnerBanner =
        '<div class="winner-banner">' +
        '<div class="winner-banner-label">GANADOR POR ' + escapeHtml_(metodo.toUpperCase()) + "</div>" +
        '<div class="winner-banner-name">' + escapeHtml_(ganadorNombre) + "</div>" +
        (academia ? '<div class="winner-banner-academia">' + escapeHtml_(academia) + "</div>" : "") +
        "</div>";
    } else if (alreadyDecided) {
      // Empate o no contest (sin ganador específico)
      winnerBanner =
        '<div class="winner-banner winner-banner-tie">' +
        '<div class="winner-banner-label">' + escapeHtml_((p.metodo_finalizacion || "FINALIZADO").toUpperCase()) + "</div>" +
        "</div>";
    }

    if (alreadyDecided) {
      // Vista "finalizada" en admin: solo banner + tiempo final + acciones,
      // sin atletas/timer/scoring duplicados.
      var tiempoFmt = formatTiempoFinalizacion_(p.tiempo_finalizacion);
      var tiempo = tiempoFmt.clean ? "Tiempo: " + tiempoFmt.clean : "";
      var round = p.round_finalizacion ? "Round " + p.round_finalizacion : "";
      var detalle = [round, tiempo].filter(Boolean).join("  ·  ");
      var notas = p.notas ? '<div class="finalizado-notas">' + escapeHtml_(p.notas) + "</div>" : "";
      var rawTiempo = tiempoFmt.raw
        ? '<div class="finalizado-raw">Valor crudo: ' + escapeHtml_(tiempoFmt.raw) + "</div>"
        : "";

      main.innerHTML =
        winnerBanner +
        (detalle ? '<div class="finalizado-detalle">' + escapeHtml_(detalle) + "</div>" : "") +
        notas +
        '<div class="finalizado-actions">' +
        '<button class="btn btn-ghost" id="btn-editar-resultado">✏ Editar resultado</button>' +
        '<button class="btn btn-ghost" id="btn-volver-bracket">← Volver al bracket</button>' +
        '<button class="btn btn-primary" id="btn-proxima-pelea">Próxima pelea pendiente →</button>' +
        "</div>" +
        rawTiempo;

      var bb = document.getElementById("btn-volver-bracket");
      if (bb) {
        bb.addEventListener("click", function () {
          var bid = (state.pelea.bracket && state.pelea.bracket.id) || state.pelea.bracket_id;
          if (bid) window.location.href = "./bracket.html?id=" + encodeURIComponent(bid);
          else history.back();
        });
      }
      var be = document.getElementById("btn-editar-resultado");
      if (be) {
        be.addEventListener("click", openFinalizeModal_);
      }
      var bnx = document.getElementById("btn-proxima-pelea");
      if (bnx) {
        bnx.addEventListener("click", function () {
          bnx.disabled = true;
          bnx.textContent = "Buscando…";
          findAndGoToNextPending_({ alertIfNone: true }).finally(function () {
            // Si no navegamos, dejar el botón usable de nuevo
            bnx.disabled = false;
            bnx.textContent = "Próxima pelea pendiente →";
          });
        });
      }
      return;
    }

    main.innerHTML =
      '<div class="scoreboard-atletas">' +
      renderAtletaCard_(p.atleta1, p.atleta1_id, "left", "a1", p.ganador_id === p.atleta1_id) +
      '<div class="scoreboard-vs">VS</div>' +
      renderAtletaCard_(p.atleta2, p.atleta2_id, "right", "a2", p.ganador_id === p.atleta2_id) +
      "</div>" +
      '<div class="scoreboard-round-info" id="round-info">' +
      renderRoundInfo_() +
      "</div>" +
      '<div class="scoreboard-timer" id="timer-display">' + formatTime_(state.secondsRemaining) + "</div>" +
      '<div class="scoreboard-controls" id="scoreboard-controls">' +
      renderControlsHTML_() +
      "</div>" +
      '<div class="scoreboard-scoring" id="scoring-panel">' +
      renderScoringPanelHTML_() +
      "</div>" +
      '<div class="scoreboard-coming-soon">' +
      "Atajos: Space = play/pause · F = pantalla completa · ← −10s · → +10s" +
      "</div>";

    bindControls_();
    bindScoring_();
    renderTimer();
    renderScoring_();
  }

  function renderAtletaCard_(atleta, atletaId, side, sideKey, isWinner) {
    var nombre, academia, initials;
    if (!atleta && !atletaId) {
      nombre = "Por definir";
      academia = "Esperando…";
      initials = "?";
    } else if (!atleta) {
      nombre = atletaId;
      academia = "";
      initials = "?";
    } else {
      nombre = atleta.nombre_completo || atleta.id || "";
      academia = atleta.academia || atleta.pais || "";
      initials = initialsOf_(nombre);
    }
    return (
      '<div class="scoreboard-atleta scoreboard-atleta-' + side + (isWinner ? " is-winner" : "") + '" data-side="' + sideKey + '">' +
      '<div class="scoreboard-atleta-top">' +
      '<div class="scoreboard-atleta-avatar">' + escapeHtml_(initials) + "</div>" +
      '<div class="scoreboard-atleta-textwrap">' +
      '<div class="scoreboard-atleta-name">' + escapeHtml_(nombre) + "</div>" +
      '<div class="scoreboard-atleta-academia">' + escapeHtml_(academia) + "</div>" +
      "</div>" +
      '<div class="scoreboard-atleta-total" data-total-for="' + sideKey + '">0</div>' +
      "</div>" +
      '<div class="scoreboard-atleta-counters">' +
      '<span class="counter-adv" data-counter="adv" data-side-for="' + sideKey + '">Adv: 0</span>' +
      '<span class="counter-falta" data-counter="falta" data-side-for="' + sideKey + '">Faltas: 0</span>' +
      "</div>" +
      (isWinner ? '<div class="scoreboard-atleta-winner-tag">✓ Ganador</div>' : "") +
      "</div>"
    );
  }

  /* ------------------------------------------------------------
   * T19 — Panel de scoring (UI)
   * ------------------------------------------------------------ */

  function renderScoringPanelHTML_() {
    var p = state.pelea || {};
    var a1Name = (p.atleta1 && p.atleta1.nombre_completo) || "Atleta 1";
    var a2Name = (p.atleta2 && p.atleta2.nombre_completo) || "Atleta 2";
    return (
      '<div class="scoring-row">' +
      '<div class="scoring-atleta-name scoring-atleta-name-a1">' + escapeHtml_(a1Name) + "</div>" +
      '<div class="scoring-buttons" data-side="a1">' +
      scoringButtonsHTML_("a1") +
      "</div>" +
      "</div>" +
      '<div class="scoring-row">' +
      '<div class="scoring-atleta-name scoring-atleta-name-a2">' + escapeHtml_(a2Name) + "</div>" +
      '<div class="scoring-buttons" data-side="a2">' +
      scoringButtonsHTML_("a2") +
      "</div>" +
      "</div>" +
      '<div class="scoring-extras-row">' +
      '<div class="scoring-extras" data-side="a1">' + extrasButtonsHTML_("a1") + "</div>" +
      '<button class="btn btn-sm btn-clear-round" data-action="clear-round" title="Limpiar puntajes del round actual">Limpiar round</button>' +
      '<div class="scoring-extras" data-side="a2">' + extrasButtonsHTML_("a2") + "</div>" +
      "</div>" +
      '<div class="scoring-summary" id="scoring-summary"></div>'
    );
  }

  function scoringButtonsHTML_(side) {
    // 10-point must — en práctica casi nunca llegamos a 10-7, dejamos 10/9/8.
    return [10, 9, 8].map(function (pts) {
      return '<button class="btn btn-score" data-action="score" data-side="' + side + '" data-points="' + pts + '">' + pts + "</button>";
    }).join("");
  }

  function extrasButtonsHTML_(side) {
    return (
      '<button class="btn btn-sm btn-extra" data-action="adv-add" data-side="' + side + '">+ Adv</button>' +
      '<button class="btn btn-sm btn-extra btn-extra-minus" data-action="adv-rem" data-side="' + side + '" title="Quitar advertencia">−</button>' +
      '<button class="btn btn-sm btn-extra" data-action="falta-add" data-side="' + side + '">+ Falta</button>' +
      '<button class="btn btn-sm btn-extra btn-extra-minus" data-action="falta-rem" data-side="' + side + '" title="Quitar falta">−</button>'
    );
  }

  function bindScoring_() {
    var panel = document.getElementById("scoring-panel");
    if (!panel) return;
    panel.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.dataset.action;
      var side = btn.dataset.side;
      if (action === "score") {
        setRoundScore(side, Number(btn.dataset.points));
      } else if (action === "adv-add") {
        addAdv(side);
      } else if (action === "adv-rem") {
        removeAdv(side);
      } else if (action === "falta-add") {
        addFalta(side);
      } else if (action === "falta-rem") {
        removeFalta(side);
      } else if (action === "clear-round") {
        clearRoundScore();
      }
    });
  }

  function renderScoring_() {
    if (!state.scoring || !state.tiempoConfig) return;

    // Highlight de botones de score para el round actual
    var roundIdx = state.currentRound - 1;
    var round = state.scoring.rounds[roundIdx];

    ["a1", "a2"].forEach(function (side) {
      // Botones score: marcar el seleccionado
      var btns = document.querySelectorAll('[data-action="score"][data-side="' + side + '"]');
      btns.forEach(function (b) {
        var sel = round && Number(b.dataset.points) === round[side];
        b.classList.toggle("is-active", !!sel);
      });

      // Total
      var totalEl = document.querySelector('[data-total-for="' + side + '"]');
      if (totalEl) totalEl.textContent = String(totalScore(side));

      // Contadores adv / falta
      var advEl = document.querySelector('[data-counter="adv"][data-side-for="' + side + '"]');
      var falEl = document.querySelector('[data-counter="falta"][data-side-for="' + side + '"]');
      var advCount = totalAdv(side);
      var falCount = totalFaltas(side);
      if (advEl) advEl.textContent = "Adv: " + advCount;
      if (falEl) {
        falEl.textContent = "Faltas: " + falCount;
        falEl.classList.toggle("is-warning", falCount === 2);
        falEl.classList.toggle("is-critical", falCount >= 3);
      }
    });

    // Resumen por round
    var summary = document.getElementById("scoring-summary");
    if (summary) {
      var rows = state.scoring.rounds.map(function (r, idx) {
        var isCurrent = idx + 1 === state.currentRound;
        var a1Str = (r.a1 === null || r.a1 === undefined) ? "—" : r.a1;
        var a2Str = (r.a2 === null || r.a2 === undefined) ? "—" : r.a2;
        return (
          '<div class="scoring-summary-row' + (isCurrent ? " is-current" : "") + '">' +
          '<span class="ssr-label">R' + (idx + 1) + "</span>" +
          '<span class="ssr-a1">' + a1Str + "</span>" +
          '<span class="ssr-divider">—</span>' +
          '<span class="ssr-a2">' + a2Str + "</span>" +
          "</div>"
        );
      }).join("");
      summary.innerHTML =
        '<div class="scoring-summary-rounds">' + rows + "</div>" +
        '<div class="scoring-summary-totals">' +
        'Total: <strong>' + totalScore("a1") + " — " + totalScore("a2") + "</strong>" +
        "</div>";
    }
  }

  function renderRoundInfo_() {
    var t = state.tiempoConfig;
    if (!t) return "";
    var isFinDePelea = isFightOver_();
    if (isFinDePelea) {
      return '<span class="round-label is-finished">Pelea terminada</span>';
    }
    if (state.isResting) {
      return '<span class="round-label is-rest">Descanso</span> ' +
        '<span class="round-counter">antes de Round ' + (state.currentRound + 1) + " / " + t.rounds + "</span>";
    }
    return '<span class="round-label">Round</span> ' +
      '<span class="round-counter">' + state.currentRound + " / " + t.rounds + "</span>";
  }

  function isFightOver_() {
    var t = state.tiempoConfig;
    if (!t) return false;
    return !state.isResting &&
      state.currentRound >= t.rounds &&
      state.secondsRemaining <= 0;
  }

  function renderControlsHTML_() {
    return (
      '<div class="scoreboard-controls-row scoreboard-controls-main">' +
      '<button class="btn btn-control btn-start" id="btn-start">▶ Start</button>' +
      '<button class="btn btn-control btn-pause" id="btn-pause">⏸ Pause</button>' +
      '<button class="btn btn-control btn-reset" id="btn-reset">↺ Reset round</button>' +
      '<button class="btn btn-control btn-next" id="btn-next">▶▶ Next round</button>' +
      "</div>" +
      '<div class="scoreboard-controls-row scoreboard-controls-adjust">' +
      '<button class="btn btn-control btn-adjust" id="btn-minus-10" title="Restar 10 segundos (Flecha ←)">−10 seg</button>' +
      '<button class="btn btn-control btn-adjust" id="btn-plus-10" title="Sumar 10 segundos (Flecha →)">+10 seg</button>' +
      '<button class="btn btn-control btn-finalize" id="btn-finalize">✓ Finalizar pelea</button>' +
      "</div>"
    );
  }

  function bindControls_() {
    var bs = document.getElementById("btn-start");
    var bp = document.getElementById("btn-pause");
    var br = document.getElementById("btn-reset");
    var bn = document.getElementById("btn-next");
    var bm10 = document.getElementById("btn-minus-10");
    var bp10 = document.getElementById("btn-plus-10");
    var bf = document.getElementById("btn-finalize");
    if (bs) bs.addEventListener("click", start);
    if (bp) bp.addEventListener("click", pause);
    if (br) br.addEventListener("click", resetRound);
    if (bn) bn.addEventListener("click", nextRound);
    if (bm10) bm10.addEventListener("click", function () { addTime(-10); });
    if (bp10) bp10.addEventListener("click", function () { addTime(10); });
    if (bf) bf.addEventListener("click", openFinalizeModal_);
    renderControls();
  }

  /* ------------------------------------------------------------
   * T20 — Modal de finalización de pelea
   * ------------------------------------------------------------ */

  var finalizeRefs = {};
  var finalizeSaving = false;
  var finalizeMode = "create"; // "create" | "edit"

  function openFinalizeModal_() {
    // Pausar el timer inmediatamente: el operador no está peleando
    // mientras llena el modal, y queremos que la vista pública también
    // pare al instante.
    if (state.isRunning) pause();
    // Detectar modo según si la pelea ya tiene ganador
    finalizeMode = state.pelea && state.pelea.ganador_id ? "edit" : "create";
    ensureFinalizeUI_();
    populateFinalizeForm_();
    showFinalizeOverlay_();
  }

  function closeFinalizeModal_() {
    if (finalizeRefs.overlay) {
      finalizeRefs.overlay.classList.remove("is-open");
    }
    document.removeEventListener("keydown", onFinalizeKey_);
  }

  function onFinalizeKey_(e) {
    if (e.key === "Escape") closeFinalizeModal_();
  }

  function ensureFinalizeUI_() {
    if (finalizeRefs.overlay) return;

    var overlay = document.createElement("div");
    overlay.id = "finalize-overlay";
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeFinalizeModal_();
    });

    var dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    var metodosOpts = (root.Reglamento.METODOS_FINALIZACION || [])
      .map(function (m) {
        return '<option value="' + escapeAttr_(m) + '">' + escapeHtml_(m) + "</option>";
      })
      .join("");

    dialog.innerHTML =
      '<header class="modal-header">' +
      '<h2>Finalizar pelea</h2>' +
      '<button type="button" class="modal-close" aria-label="Cerrar">×</button>' +
      "</header>" +
      '<div class="modal-error" hidden></div>' +
      '<form class="modal-form" novalidate>' +
      '<div class="form-grid">' +
      '<div class="form-field form-field-full">' +
      '<span class="form-label">Resultado *</span>' +
      '<div class="radio-group ganador-radio">' +
      '<label class="radio-pill"><input type="radio" name="ganador" value="a1" required /><span id="ganador-a1-label">Atleta 1</span></label>' +
      '<label class="radio-pill"><input type="radio" name="ganador" value="a2" /><span id="ganador-a2-label">Atleta 2</span></label>' +
      '<label class="radio-pill"><input type="radio" name="ganador" value="empate" /><span>Empate / No contest</span></label>' +
      "</div>" +
      '<small class="form-hint" id="resumen-puntaje" style="margin-top:8px;"></small>' +
      '<small class="form-error" hidden></small>' +
      "</div>" +
      '<label class="form-field form-field-full">' +
      '<span class="form-label">Método de finalización *</span>' +
      '<select name="metodo" required>' +
      '<option value="">Selecciona...</option>' +
      metodosOpts +
      "</select>" +
      '<small class="form-error" hidden></small>' +
      "</label>" +
      '<label class="form-field">' +
      '<span class="form-label">Round</span>' +
      '<input type="number" name="round" min="1" />' +
      '<small class="form-error" hidden></small>' +
      "</label>" +
      '<label class="form-field">' +
      '<span class="form-label">Tiempo (MM:SS)</span>' +
      '<input type="text" name="tiempo" pattern="[0-9]{1,2}:[0-5][0-9]" placeholder="03:00" />' +
      '<small class="form-hint">Tiempo transcurrido del round cuando terminó.</small>' +
      '<small class="form-error" hidden></small>' +
      "</label>" +
      '<label class="form-field form-field-full">' +
      '<span class="form-label">Notas (opcional)</span>' +
      '<textarea name="notas" rows="2" placeholder="Detalles del cierre, lesión, sub específico..."></textarea>' +
      "</label>" +
      "</div>" +
      "</form>" +
      '<footer class="modal-footer">' +
      '<div class="modal-footer-right">' +
      '<button type="button" class="btn btn-cancel">Cancelar</button>' +
      '<button type="button" class="btn btn-primary btn-save">Guardar y volver al bracket</button>' +
      "</div>" +
      "</footer>";

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var form = dialog.querySelector(".modal-form");
    var saveBtn = dialog.querySelector(".btn-save");
    saveBtn.addEventListener("click", function (e) {
      e.preventDefault();
      submitFinalize_();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitFinalize_();
    });
    dialog.querySelector(".modal-close").addEventListener("click", closeFinalizeModal_);
    dialog.querySelector(".btn-cancel").addEventListener("click", closeFinalizeModal_);

    // Cuando el método es "Empate" o "No Contest", auto-marcar el radio
    // "Empate / No contest" (no hay ganador individual).
    // Para "Descalificación", "Abandono", "No Pasó Pesaje", "No Pasó Examen Médico"
    // y "No Se Presentó" hay un ganador implícito (el otro atleta), así que
    // dejamos que el operador lo seleccione manualmente.
    var metodoSel = form.querySelector('[name="metodo"]');
    metodoSel.addEventListener("change", function () {
      var v = metodoSel.value || "";
      if (/^(Empate|No Contest)$/i.test(v)) {
        var empateRadio = form.querySelector('[name="ganador"][value="empate"]');
        if (empateRadio) empateRadio.checked = true;
      }
    });

    finalizeRefs.overlay = overlay;
    finalizeRefs.dialog = dialog;
    finalizeRefs.form = form;
    finalizeRefs.saveBtn = saveBtn;
    finalizeRefs.cancelBtn = dialog.querySelector(".btn-cancel");
    finalizeRefs.errorBanner = dialog.querySelector(".modal-error");
  }

  function populateFinalizeForm_() {
    var f = finalizeRefs.form;
    f.reset();
    clearFinalizeErrors_();
    hideFinalizeError_();

    var p = state.pelea;
    var a1Name = (p.atleta1 && p.atleta1.nombre_completo) || "Atleta 1";
    var a2Name = (p.atleta2 && p.atleta2.nombre_completo) || "Atleta 2";

    document.getElementById("ganador-a1-label").textContent = a1Name;
    document.getElementById("ganador-a2-label").textContent = a2Name;

    // Título del modal y texto del botón según modo
    var titleEl = finalizeRefs.dialog.querySelector(".modal-header h2");
    if (titleEl) {
      titleEl.textContent = finalizeMode === "edit"
        ? "Editar resultado de la pelea"
        : "Finalizar pelea";
    }
    finalizeRefs.saveBtn.textContent = finalizeMode === "edit"
      ? "Guardar cambios"
      : "Guardar y volver al bracket";

    if (finalizeMode === "edit") {
      // ====== Modo edición: usar valores almacenados en el backend ======
      // Ganador
      if (p.ganador_id && p.ganador_id === p.atleta1_id) {
        f.querySelector('[name="ganador"][value="a1"]').checked = true;
      } else if (p.ganador_id && p.ganador_id === p.atleta2_id) {
        f.querySelector('[name="ganador"][value="a2"]').checked = true;
      } else {
        f.querySelector('[name="ganador"][value="empate"]').checked = true;
      }
      // Método
      f.querySelector('[name="metodo"]').value = p.metodo_finalizacion || "";
      // Round
      f.querySelector('[name="round"]').value = p.round_finalizacion || state.currentRound || 1;
      // Tiempo (extraer MM:SS si el storage tiene un Date)
      var tFmt = formatTiempoFinalizacion_(p.tiempo_finalizacion);
      f.querySelector('[name="tiempo"]').value = tFmt.clean || "";
      // Notas
      f.querySelector('[name="notas"]').value = p.notas || "";

      document.getElementById("resumen-puntaje").innerHTML =
        '<strong style="color:var(--accent-amber);">⚠ Editando resultado existente.</strong> ' +
        "Si cambias al ganador, las peleas siguientes del bracket pueden quedar inconsistentes y necesitar actualización manual.";
    } else {
      // ====== Modo creación: smart defaults basados en el state actual ======
      var s1 = totalScore("a1");
      var s2 = totalScore("a2");
      var resumen = "Puntaje: " + a1Name + " " + s1 + " — " + s2 + " " + a2Name;
      var advs = "Adv " + totalAdv("a1") + "/" + totalAdv("a2") +
        "  ·  Faltas " + totalFaltas("a1") + "/" + totalFaltas("a2");
      document.getElementById("resumen-puntaje").textContent = resumen + "  ·  " + advs;

      if (s1 > s2 && p.atleta1_id) {
        f.querySelector('[name="ganador"][value="a1"]').checked = true;
      } else if (s2 > s1 && p.atleta2_id) {
        f.querySelector('[name="ganador"][value="a2"]').checked = true;
      }

      f.querySelector('[name="round"]').value = state.currentRound || 1;

      var t = state.tiempoConfig;
      if (t) {
        var elapsed = state.isResting
          ? t.segundosPorRound
          : Math.max(0, t.segundosPorRound - state.secondsRemaining);
        f.querySelector('[name="tiempo"]').value = formatTime_(elapsed);
      }
    }

    f.querySelector('[name="round"]').max = state.tiempoConfig
      ? state.tiempoConfig.rounds
      : 1;
  }

  function showFinalizeOverlay_() {
    // En fullscreen, mover el overlay al fullscreen element para
    // garantizar que sea visible.
    var fsEl = document.fullscreenElement;
    if (fsEl && finalizeRefs.overlay.parentNode !== fsEl) {
      fsEl.appendChild(finalizeRefs.overlay);
    } else if (!fsEl && finalizeRefs.overlay.parentNode !== document.body) {
      document.body.appendChild(finalizeRefs.overlay);
    }
    finalizeRefs.overlay.classList.add("is-open");
    document.addEventListener("keydown", onFinalizeKey_);
    setTimeout(function () {
      var first = finalizeRefs.form.querySelector('[name="metodo"]');
      if (first) first.focus();
    }, 50);
  }

  /**
   * T25 — Busca la siguiente pelea pendiente en TODO el evento (cruzando
   * brackets), con ambos atletas asignados y sin ganador.
   *
   * Estrategia de orden (Smoothcomp-style):
   *   1. ronda_idx ASC (todas las R1 primero, luego R2, luego finales).
   *      Esto da rest natural a los atletas entre rondas.
   *   2. orden del bracket en la lista del evento (para que rota mats).
   *   3. numero_pelea ASC dentro de la misma ronda + bracket.
   *
   * Fallback: si por alguna razón no podemos obtener el evento_id, cae al
   * modo "solo este bracket".
   *
   * @param {Object} opts
   * @param {boolean} [opts.alertIfNone] — si true, muestra alert cuando no hay más.
   * @param {boolean} [opts.fallbackToBracket] — si true y no hay próxima, navega
   *   al resumen del evento (o al bracket actual como segundo fallback).
   * @returns {Promise<boolean>} — true si se navegó a la siguiente, false en otro caso.
   */
  async function findAndGoToNextPending_(opts) {
    opts = opts || {};
    var bracketId =
      (state.pelea && state.pelea.bracket && state.pelea.bracket.id) ||
      (state.pelea && state.pelea.bracket_id);
    var eventoId =
      (state.pelea && state.pelea.bracket && state.pelea.bracket.evento_id) ||
      (state.pelea && state.pelea.evento_id);

    if (!bracketId && !eventoId) {
      if (opts.alertIfNone) {
        alert("No se encontró el evento de esta pelea.");
      }
      return false;
    }

    try {
      // Fast path: endpoint dedicado que resuelve la próxima pelea en el
      // servidor con un solo round-trip (en vez de brackets.list + N×
      // brackets.get). Si el backend todavía no tiene esta acción
      // desplegada, caemos al método clásico de abajo sin romper nada.
      try {
        var nextRes = await root.api.get("peleas.next", {
          evento_id: eventoId || undefined,
          bracket_id: bracketId || undefined,
          exclude_id: state.peleaId,
        });
        if (nextRes && nextRes.ok) {
          if (nextRes.found && nextRes.pelea_id) {
            window.location.href =
              "./scoreboard.html?pelea_id=" + encodeURIComponent(nextRes.pelea_id);
            return true;
          }
          // Respondió bien y no hay pendientes en todo el evento.
          return handleNoMorePending_(opts, eventoId, bracketId);
        }
      } catch (fastErr) {
        console.warn(
          "[scoreboard] peleas.next no disponible, uso método clásico:",
          fastErr,
        );
      }

      var allPeleas = [];

      if (eventoId) {
        // Modo evento completo: traer todos los brackets en paralelo
        var resList = await root.api.get("brackets.list", { evento_id: eventoId });
        var bracketsList = (resList && resList.brackets) || [];
        if (bracketsList.length === 0) {
          // No hay brackets — caso raro
          return handleNoMorePending_(opts, eventoId, bracketId);
        }

        var detailPromises = bracketsList.map(function (b) {
          return root.api.get("brackets.get", { id: b.id });
        });
        var details = await Promise.all(detailPromises);

        details.forEach(function (d, idx) {
          var bracket = d && d.bracket;
          if (!bracket || !bracket.peleas) return;
          bracket.peleas.forEach(function (p) {
            allPeleas.push({
              pelea: p,
              bracketOrder: idx,
              bracketId: bracket.id,
            });
          });
        });
      } else {
        // Fallback: solo el bracket actual
        var resBracket = await root.api.get("brackets.get", { id: bracketId });
        var bracketOne = resBracket && resBracket.bracket;
        var peleasOne = (bracketOne && bracketOne.peleas) || [];
        peleasOne.forEach(function (p) {
          allPeleas.push({ pelea: p, bracketOrder: 0, bracketId: bracketId });
        });
      }

      var pending = allPeleas.filter(function (item) {
        var p = item.pelea;
        return (
          p.id !== state.peleaId &&
          p.atleta1_id &&
          p.atleta2_id &&
          !p.ganador_id &&
          !p.bye
        );
      });

      // Orden: ronda_idx ASC, bracketOrder ASC, numero_pelea ASC
      pending.sort(function (a, b) {
        var ra = Number(a.pelea.ronda_idx) || 0;
        var rb = Number(b.pelea.ronda_idx) || 0;
        if (ra !== rb) return ra - rb;
        if (a.bracketOrder !== b.bracketOrder) {
          return a.bracketOrder - b.bracketOrder;
        }
        return (Number(a.pelea.numero_pelea) || 0) - (Number(b.pelea.numero_pelea) || 0);
      });

      if (pending.length > 0) {
        window.location.href =
          "./scoreboard.html?pelea_id=" + encodeURIComponent(pending[0].pelea.id);
        return true;
      }

      // No hay pendientes en todo el evento
      return handleNoMorePending_(opts, eventoId, bracketId);
    } catch (err) {
      console.warn("[scoreboard] no se pudo buscar próxima pelea:", err);
      if (opts.fallbackToBracket && bracketId) {
        window.location.href =
          "./bracket.html?id=" + encodeURIComponent(bracketId);
        return true;
      }
      if (opts.alertIfNone) {
        alert(
          "Error al buscar próxima pelea: " +
          (err && err.message ? err.message : String(err)),
        );
      }
      return false;
    }
  }

  function handleNoMorePending_(opts, eventoId, bracketId) {
    if (opts.fallbackToBracket) {
      // Preferimos llevarte al resumen del evento, donde están todos los
      // podios. Si no tenemos evento_id (raro), caemos al bracket actual.
      if (eventoId) {
        window.location.href =
          "./evento.html?id=" + encodeURIComponent(eventoId) + "#resumen";
        return true;
      }
      if (bracketId) {
        window.location.href =
          "./bracket.html?id=" + encodeURIComponent(bracketId);
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
  }

  async function submitFinalize_() {
    if (finalizeSaving) return;
    clearFinalizeErrors_();
    hideFinalizeError_();

    var f = finalizeRefs.form;
    var ganadorRadio = f.querySelector('[name="ganador"]:checked');
    var metodo = f.querySelector('[name="metodo"]').value;
    var roundVal = f.querySelector('[name="round"]').value;
    var tiempoVal = f.querySelector('[name="tiempo"]').value.trim();
    var notas = f.querySelector('[name="notas"]').value.trim();

    var errors = {};
    if (!ganadorRadio) errors.ganador = "Selecciona un resultado";
    if (!metodo) errors.metodo = "Selecciona el método";

    if (tiempoVal && !/^[0-9]{1,2}:[0-5][0-9]$/.test(tiempoVal)) {
      errors.tiempo = "Formato: MM:SS (ej. 02:35)";
    }
    var roundNum = roundVal === "" ? "" : Number(roundVal);
    if (roundVal !== "" && (!isFinite(roundNum) || roundNum < 1)) {
      errors.round = "Debe ser ≥ 1";
    }

    if (Object.keys(errors).length) {
      showFinalizeFieldErrors_(errors);
      return;
    }

    // Construir payload
    var ganadorSide = ganadorRadio.value; // "a1" | "a2" | "empate"
    var p = state.pelea;
    var ganadorId = "";
    if (ganadorSide === "a1") ganadorId = p.atleta1_id || "";
    else if (ganadorSide === "a2") ganadorId = p.atleta2_id || "";

    var payload = {
      id: state.peleaId,
      ganador_id: ganadorId,
      metodo_finalizacion: metodo,
      round_finalizacion: roundVal === "" ? "" : roundNum,
      tiempo_finalizacion: tiempoVal,
      notas: notas,
    };

    finalizeSaving = true;
    finalizeRefs.saveBtn.disabled = true;
    finalizeRefs.cancelBtn.disabled = true;
    finalizeRefs.saveBtn.textContent = "Guardando…";

    var wasEdit = finalizeMode === "edit";

    try {
      await root.api.post("peleas.update", payload);
      // T21 — pelea finalizada, ya no necesitamos el snapshot
      clearSavedState_();

      // Broadcast inmediato a la vista pública para que refresque
      // su estado sin esperar al polling.
      try {
        var ch = getBroadcastChannel_();
        if (ch) {
          ch.postMessage({
            type: "finalized",
            peleaId: state.peleaId,
            savedAt: Date.now(),
          });
        }
      } catch (e) { /* ignore */ }

      if (wasEdit) {
        // Modo edición: NO redirigir. El operador ya estaba mirando el
        // resultado final, queremos quedarnos en la misma pelea con el
        // banner actualizado. Cerramos el modal y recargamos in-place.
        closeFinalizeModal_();
        load();
      } else {
        // Modo creación: saltar directo a la próxima pelea pendiente del
        // mismo bracket. Si no hay más, caer al bracket.html (donde el
        // operador puede ver el árbol completo o elegir manualmente).
        finalizeRefs.saveBtn.textContent = "Buscando próxima pelea…";
        var navigated = await findAndGoToNextPending_({ fallbackToBracket: true });
        if (!navigated) {
          // No hubo navegación posible — recargar scoreboard como fallback
          closeFinalizeModal_();
          load();
        }
      }
    } catch (err) {
      showFinalizeBannerError_(err && err.message ? err.message : String(err));
    } finally {
      finalizeSaving = false;
      finalizeRefs.saveBtn.disabled = false;
      finalizeRefs.cancelBtn.disabled = false;
      finalizeRefs.saveBtn.textContent = wasEdit
        ? "Guardar cambios"
        : "Guardar y volver al bracket";
    }
  }

  function showFinalizeFieldErrors_(errors) {
    Object.keys(errors).forEach(function (name) {
      var field = finalizeRefs.form.querySelector('[name="' + name + '"]');
      if (!field) return;
      var wrap = field.closest(".form-field");
      var errEl = wrap && wrap.querySelector(".form-error");
      if (errEl) {
        errEl.textContent = errors[name];
        errEl.hidden = false;
      }
      if (wrap) wrap.classList.add("has-error");
    });
  }

  function clearFinalizeErrors_() {
    if (!finalizeRefs.form) return;
    finalizeRefs.form.querySelectorAll(".form-error").forEach(function (el) {
      el.textContent = "";
      el.hidden = true;
    });
    finalizeRefs.form.querySelectorAll(".form-field").forEach(function (el) {
      el.classList.remove("has-error");
    });
  }

  function showFinalizeBannerError_(msg) {
    if (!finalizeRefs.errorBanner) return;
    finalizeRefs.errorBanner.textContent = msg;
    finalizeRefs.errorBanner.hidden = false;
  }
  function hideFinalizeError_() {
    if (!finalizeRefs.errorBanner) return;
    finalizeRefs.errorBanner.textContent = "";
    finalizeRefs.errorBanner.hidden = true;
  }

  function renderControls() {
    var bs = document.getElementById("btn-start");
    var bp = document.getElementById("btn-pause");
    var bn = document.getElementById("btn-next");
    var bf = document.getElementById("btn-finalize");
    if (!bs || !bp || !bn) return;

    var fightOver = isFightOver_();

    // Start: no permitido si la pelea ya terminó o si está corriendo
    bs.disabled = state.isRunning || fightOver;
    bp.disabled = !state.isRunning;

    var isLastRound = state.tiempoConfig &&
      state.currentRound >= state.tiempoConfig.rounds &&
      !state.isResting;
    bn.disabled = isLastRound;

    if (bf) {
      // Resaltar el botón cuando la pelea termine, pero estar siempre
      // disponible para KO/sometimiento temprano.
      bf.classList.toggle("is-prominent", fightOver);
    }
  }

  function renderTimer() {
    var el = document.getElementById("timer-display");
    if (!el) return;
    el.textContent = formatTime_(state.secondsRemaining);
    el.classList.toggle("is-resting", state.isResting);
    el.classList.toggle("is-low", !state.isResting && state.secondsRemaining > 0 && state.secondsRemaining <= 10);
    el.classList.toggle("is-zero", state.secondsRemaining <= 0);

    var info = document.getElementById("round-info");
    if (info) info.innerHTML = renderRoundInfo_();
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function formatTime_(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return (m < 10 ? "0" + m : m) + ":" + (ss < 10 ? "0" + ss : ss);
  }

  /**
   * tiempo_finalizacion puede venir como "02:35" (string limpio) o como
   * "Sat Dec 30 1899 02:35:00 GMT-..." si Google Sheets lo coerció a Date.
   * Extraemos la parte HH:MM o MM:SS y la devolvemos limpia.
   * Si el original difería del extraído, también devolvemos el raw para
   * mostrarlo en letra mini como referencia.
   */
  function formatTiempoFinalizacion_(raw) {
    if (!raw) return { clean: "", raw: "" };
    var s = String(raw).trim();
    var m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      var clean = m[1].length === 1 ? "0" + m[1] + ":" + m[2] : m[1] + ":" + m[2];
      // Si solo el patrón MM:SS está en el string original, raw == clean
      return { clean: clean, raw: clean === s ? "" : s };
    }
    return { clean: s, raw: "" };
  }

  function initialsOf_(name) {
    var parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "?";
  }

  function escapeHtml_(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function escapeAttr_(v) {
    return escapeHtml_(v);
  }

  // Expuesto para debugging / extensiones futuras
  root.Scoreboard = {
    start: start,
    pause: pause,
    reset: resetAll,
    state: state,
  };
})(typeof window !== "undefined" ? window : globalThis);
