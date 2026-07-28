/**
 * Tab "Resumen" del detalle de evento (T22).
 *
 * Muestra:
 *   - Counter global de brackets / peleas decididas.
 *   - Botón "✓ Finalizar evento" (habilitado solo si todas las peleas
 *     tienen ganador).
 *   - Por cada bracket, un card con el podio:
 *       🥇 1°  ganador de la final
 *       🥈 2°  perdedor de la final
 *       🥉 3°  perdedores de las semifinales (joint third)
 *     Si el bracket no está completo, muestra "En curso · X pelea(s) pendientes".
 *
 * API pública:
 *   EventoResumen.init({ eventoId, evento, panel })
 *
 * Requiere: api.js cargado antes.
 */
(function (root) {
  "use strict";

  var state = {
    eventoId: null,
    evento: null,
    panel: null,
    brackets: [], // detalle con peleas anidadas
    loading: true,
    error: null,
    finalizing: false,
  };

  function init(opts) {
    state.eventoId = opts.eventoId;
    state.evento = opts.evento || null;
    state.panel = opts.panel;
    if (!state.panel) return;

    state.panel.innerHTML = '<div class="loading-message">Cargando resumen...</div>';
    state.panel.addEventListener("click", onPanelClick_);
    load();
  }

  function onPanelClick_(e) {
    var btn;
    if ((btn = e.target.closest("#btn-finalizar-evento"))) {
      finalizarEvento_();
    } else if ((btn = e.target.closest("#btn-refresh-resumen"))) {
      load();
    }
  }

  async function load() {
    state.loading = true;
    state.error = null;
    render_();
    try {
      var resB = await root.api.get("brackets.list", { evento_id: state.eventoId });
      var lista = (resB && resB.brackets) || [];
      var details = [];
      for (var i = 0; i < lista.length; i += 1) {
        var d = await root.api.get("brackets.get", { id: lista[i].id });
        details.push(d.bracket);
      }
      state.brackets = details;
      state.loading = false;
      render_();
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : String(err);
      render_();
    }
  }

  /* ============================================================
   * Cálculo del podio
   * ============================================================ */

  function computePodium_(bracket) {
    var peleas = (bracket && bracket.peleas) || [];
    if (peleas.length === 0) {
      return { complete: false, first: null, second: null, thirds: [] };
    }

    var maxIdx = 0;
    peleas.forEach(function (p) {
      var idx = Number(p.ronda_idx) || 0;
      if (idx > maxIdx) maxIdx = idx;
    });

    // La final es la única pelea con ronda_idx === maxIdx
    var final = peleas.find(function (p) {
      return Number(p.ronda_idx) === maxIdx;
    });
    if (!final || !final.ganador_id) {
      return { complete: false, first: null, second: null, thirds: [] };
    }

    var first = final.ganador || atletaPlaceholder_(final.ganador_id);
    var secondId = final.atleta1_id === final.ganador_id ? final.atleta2_id : final.atleta1_id;
    var second = final.atleta1_id === final.ganador_id ? final.atleta2 : final.atleta1;
    if (!second && secondId) second = atletaPlaceholder_(secondId);

    // Terceros lugares: perdedores de semis (ronda_idx = maxIdx - 1).
    // Para brackets de 2 (dos_atletas), maxIdx = 0 y no hay semis.
    var thirds = [];
    if (maxIdx >= 1) {
      var semis = peleas.filter(function (p) {
        return Number(p.ronda_idx) === maxIdx - 1;
      });
      semis.forEach(function (s) {
        if (!s.ganador_id || s.bye) return;
        var loserSide = s.atleta1_id === s.ganador_id ? "atleta2" : "atleta1";
        var loserIdField = loserSide + "_id";
        var loserAtleta = s[loserSide] || atletaPlaceholder_(s[loserIdField]);
        if (s[loserIdField] && loserAtleta) thirds.push(loserAtleta);
      });
    }

    return { complete: true, first: first, second: second, thirds: thirds };
  }

  function atletaPlaceholder_(id) {
    if (!id) return null;
    return { id: id, nombre_completo: id, academia: "" };
  }

  /* ============================================================
   * Render
   * ============================================================ */

  function render_() {
    if (state.loading) {
      state.panel.innerHTML = '<div class="loading-message">Cargando resumen...</div>';
      return;
    }
    if (state.error) {
      state.panel.innerHTML =
        '<div class="error-state">' +
        "<h3>No pudimos cargar el resumen</h3>" +
        "<p>" + escapeHtml_(state.error) + "</p>" +
        '<button class="btn" id="btn-refresh-resumen">Reintentar</button>' +
        "</div>";
      return;
    }
    if (state.brackets.length === 0) {
      state.panel.innerHTML =
        '<div class="placeholder">' +
        '<span class="placeholder-tag">Sin brackets</span>' +
        "<h2>No hay brackets confirmados</h2>" +
        "<p>Ve a la tab <strong>Brackets</strong>, agrupa los atletas y confirma los brackets antes de ver el resumen.</p>" +
        "</div>";
      return;
    }

    var podiums = state.brackets.map(function (b) {
      return { bracket: b, podium: computePodium_(b) };
    });

    var totalPeleas = state.brackets.reduce(function (a, b) {
      return a + ((b.peleas && b.peleas.length) || 0);
    }, 0);
    var decididas = state.brackets.reduce(function (a, b) {
      return a + ((b.peleas && b.peleas.filter(function (p) { return !!p.ganador_id; }).length) || 0);
    }, 0);
    var bracketsCompletos = podiums.filter(function (p) { return p.podium.complete; }).length;
    var allComplete = bracketsCompletos === state.brackets.length;
    var isEventoFinalizado = state.evento && state.evento.estatus === "finalizado";
    var pendientes = totalPeleas - decididas;

    var pct = totalPeleas > 0 ? Math.round((decididas / totalPeleas) * 100) : 0;

    var actions = "";
    if (isEventoFinalizado) {
      actions =
        '<span class="estatus-pill estatus-finalizado" style="padding:8px 14px; font-size:12px;">' +
        "✓ Evento finalizado" +
        "</span>";
    } else if (state.finalizing) {
      actions = '<button class="btn btn-primary" disabled>Finalizando…</button>';
    } else {
      actions = '<button class="btn btn-primary" id="btn-finalizar-evento"' +
        (allComplete ? "" : ' disabled title="Aún hay peleas pendientes"') +
        ">✓ Finalizar evento</button>";
    }

    var summaryHtml =
      '<div class="resumen-toolbar">' +
      '<div class="resumen-stats">' +
      '<span class="resumen-stat"><strong>' + state.brackets.length + "</strong> brackets</span>" +
      '<span class="resumen-stat"><strong>' + bracketsCompletos + "</strong> completos</span>" +
      '<span class="resumen-stat"><strong>' + decididas + " / " + totalPeleas + "</strong> peleas (" + pct + "%)</span>" +
      (pendientes > 0
        ? '<span class="resumen-stat resumen-stat-warn">⏳ ' + pendientes + " pendiente" + (pendientes === 1 ? "" : "s") + "</span>"
        : '<span class="resumen-stat resumen-stat-ok">✓ Todas decididas</span>'
      ) +
      "</div>" +
      '<div class="resumen-actions">' +
      '<button class="btn btn-ghost btn-sm" id="btn-refresh-resumen">⟳</button>' +
      actions +
      "</div>" +
      "</div>";

    // Reorder: brackets completos primero, pendientes al final
    podiums.sort(function (a, b) {
      return (b.podium.complete ? 1 : 0) - (a.podium.complete ? 1 : 0);
    });

    var podiumsHtml = '<div class="podiums-list">' +
      podiums.map(renderPodiumCard_).join("") +
      "</div>";

    state.panel.innerHTML = summaryHtml + podiumsHtml;
  }

  function renderPodiumCard_(item) {
    var bracket = item.bracket;
    var podium = item.podium;
    var totalPeleas = bracket.peleas ? bracket.peleas.length : 0;
    var decididas = bracket.peleas ? bracket.peleas.filter(function (p) { return p.ganador_id; }).length : 0;
    var pendientes = totalPeleas - decididas;

    var content;
    if (podium.complete) {
      var positions = [
        { place: 1, atleta: podium.first },
        { place: 2, atleta: podium.second },
      ];
      podium.thirds.forEach(function (t) {
        positions.push({ place: 3, atleta: t });
      });
      content = '<div class="podium">' +
        positions.map(function (p) { return renderPodiumPosition_(p.place, p.atleta); }).join("") +
        "</div>";
    } else {
      content = '<div class="podium-pending">' +
        '<span class="podium-pending-label">En curso</span>' +
        '<span class="podium-pending-detail">' +
        pendientes + " pelea" + (pendientes === 1 ? "" : "s") + " pendiente" + (pendientes === 1 ? "" : "s") +
        "</span>" +
        '<a class="btn btn-sm btn-ghost" href="./bracket.html?id=' + encodeURIComponent(bracket.id) + '" target="_blank">Ver bracket →</a>' +
        "</div>";
    }

    return (
      '<section class="podium-card' + (podium.complete ? " is-complete" : "") + '">' +
      '<header class="podium-card-header">' +
      '<h3 class="podium-card-title">' + escapeHtml_(bracket.categoria) + "</h3>" +
      '<span class="podium-card-meta">' +
      (bracket.num_atletas || 0) + " atletas · " + decididas + "/" + totalPeleas + " peleas" +
      "</span>" +
      "</header>" +
      content +
      "</section>"
    );
  }

  function renderPodiumPosition_(place, atleta) {
    if (!atleta) return "";
    var medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
    var nombre = atleta.nombre_completo || atleta.id || "—";
    var academia = atleta.academia || "";
    return (
      '<div class="podium-pos podium-pos-' + place + '">' +
      '<span class="podium-medal">' + medal + "</span>" +
      '<div class="podium-info">' +
      '<strong>' + escapeHtml_(nombre) + "</strong>" +
      (academia ? '<span class="podium-academia">' + escapeHtml_(academia) + "</span>" : "") +
      "</div>" +
      "</div>"
    );
  }

  /* ============================================================
   * Acciones
   * ============================================================ */

  async function finalizarEvento_() {
    if (state.finalizing) return;
    var ok = window.confirm(
      "¿Finalizar el evento?\n\n" +
      "Esto marca el evento como 'finalizado'. El podio queda guardado y el evento queda " +
      "como referencia histórica. (Por ahora no bloquea edición, solo cambia el estatus.)",
    );
    if (!ok) return;

    state.finalizing = true;
    render_();
    try {
      await root.api.post("eventos.setestatus", {
        id: state.eventoId,
        estatus: "finalizado",
      });
      if (state.evento) state.evento.estatus = "finalizado";
      state.finalizing = false;
      render_();
    } catch (err) {
      state.finalizing = false;
      alert("Error al finalizar evento: " + (err && err.message ? err.message : err));
      render_();
    }
  }

  /* ============================================================
   * Helpers
   * ============================================================ */

  function escapeHtml_(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  root.EventoResumen = { init: init };
})(typeof window !== "undefined" ? window : globalThis);
