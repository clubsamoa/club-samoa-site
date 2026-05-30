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
  };

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------

  var params = new URLSearchParams(location.search);
  state.peleaId = params.get("pelea_id");

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("btn-refresh").addEventListener("click", load);
    document.getElementById("btn-fullscreen").addEventListener("click", toggleFullscreen);

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
      configureTimer();
      state.loading = false;
      render();
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : String(err);
      renderError(state.error);
    }
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
    // Regla 10-point must: el ganador del round tiene 10. Si pones
    // < 10 a uno, el otro debe ser 10. Si pones 10, el otro queda
    // como el operador lo dejó (puede ser null si no decidió).
    if (points < 10) {
      round[other] = 10;
    }
    renderScoring_();
  }

  function clearRoundScore() {
    if (!state.scoring) return;
    var roundIdx = state.currentRound - 1;
    var round = state.scoring.rounds[roundIdx];
    if (!round) return;
    round.a1 = null;
    round.a2 = null;
    renderScoring_();
  }

  function addAdv(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_adv"] += 1;
    renderScoring_();
  }
  function removeAdv(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_adv"] = Math.max(0, round[side + "_adv"] - 1);
    renderScoring_();
  }
  function addFalta(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_faltas"] += 1;
    renderScoring_();
  }
  function removeFalta(side) {
    if (!state.scoring) return;
    var round = state.scoring.rounds[state.currentRound - 1];
    if (!round) return;
    round[side + "_faltas"] = Math.max(0, round[side + "_faltas"] - 1);
    renderScoring_();
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
  }

  function tick() {
    state.secondsRemaining -= 1;
    if (state.secondsRemaining > 0) {
      renderTimer();
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

    main.innerHTML =
      (alreadyDecided
        ? '<div class="scoreboard-finalized-banner">' +
          'Esta pelea ya tiene ganador. Cualquier cambio aquí no afecta el resultado guardado (puedes editarlo más adelante).' +
          "</div>"
        : "") +
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
      "<br>T20: finalizar pelea · T21: autosave + persistencia" +
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
      '<button class="btn btn-control btn-finalize" id="btn-finalize" hidden>✓ Finalizar pelea</button>' +
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
    if (bf) bf.addEventListener("click", finalizePlaceholder_);
    renderControls();
  }

  function finalizePlaceholder_() {
    alert(
      "Finalización de pelea — disponible en Tarea 20.\n\n" +
      "Por ahora, anota el resultado:\n\n" +
      "Total: " + totalScore("a1") + " — " + totalScore("a2") + "\n" +
      "Advertencias: " + totalAdv("a1") + " / " + totalAdv("a2") + "\n" +
      "Faltas: " + totalFaltas("a1") + " / " + totalFaltas("a2"),
    );
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
      bf.hidden = !fightOver;
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

  function initialsOf_(name) {
    var parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "?";
  }

  function escapeHtml_(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // Expuesto para debugging / extensiones futuras
  root.Scoreboard = {
    start: start,
    pause: pause,
    reset: resetAll,
    state: state,
  };
})(typeof window !== "undefined" ? window : globalThis);
