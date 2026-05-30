/**
 * Tab "Brackets" del detalle de evento (T14).
 *
 * Esta tarea es SOLO preview: agrupa atletas aprobados por
 * categoria_calculada y muestra cómo quedarían los brackets si los
 * confirmaras. La confirmación que persiste a la Sheet vive en T15.
 *
 * API pública:
 *   EventoBrackets.init({ eventoId, evento, panel })
 *
 * Comportamiento:
 *   - Al activarse, fetcha inscripciones del evento.
 *   - Toggle: "Solo aprobados" (default true) / "Todos los inscritos".
 *   - Agrupa con BracketBuilder.agruparAtletas.
 *   - Render: grid de cards por categoría.
 *   - Cada card muestra atletas como chips, tipo de bracket sugerido,
 *     contador, badge viable/no viable.
 *   - Click en un chip → modal para mover ese atleta a otra categoría
 *     (usa inscripciones.setcategoria).
 *   - Botón "Confirmar todos los viables" deshabilitado hasta T15.
 *
 * Requiere: api.js, reglamento.js, bracket-builder.js cargados antes.
 */
(function (root) {
  "use strict";

  var state = {
    eventoId: null,
    evento: null,
    panel: null,
    inscripciones: [],
    loading: false,
    error: null,
    soloAprobados: true,
  };

  function init(opts) {
    state.eventoId = opts.eventoId;
    state.evento = opts.evento || null;
    state.panel = opts.panel;
    if (!state.panel) return;

    state.panel.innerHTML = buildSkeleton_();
    bindActions_();
    load();
  }

  function buildSkeleton_() {
    return (
      '<div class="brackets-toolbar">' +
      '<div class="toolbar-filters">' +
      '<label class="toggle-switch">' +
      '<input type="checkbox" id="solo-aprobados" checked />' +
      '<span class="toggle-track"><span class="toggle-thumb"></span></span>' +
      '<span class="toggle-label">Solo atletas aprobados</span>' +
      "</label>" +
      "</div>" +
      '<div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" id="btn-refresh-brackets">⟳ Recalcular</button>' +
      '<button class="btn btn-primary" id="btn-confirmar-brackets" disabled title="Disponible en Tarea 15">' +
      "Confirmar todos los viables" +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div id="brackets-summary" class="brackets-summary" aria-live="polite"></div>' +
      '<div id="brackets-grid" class="brackets-grid">' +
      '<div class="loading-message">Cargando inscripciones...</div>' +
      "</div>"
    );
  }

  function bindActions_() {
    var toggle = state.panel.querySelector("#solo-aprobados");
    if (toggle) {
      toggle.addEventListener("change", function () {
        state.soloAprobados = toggle.checked;
        render_();
      });
    }
    var btnRefresh = state.panel.querySelector("#btn-refresh-brackets");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", load);
    }

    state.panel.addEventListener("click", function (e) {
      // Chip de atleta → abre modal de mover
      var chip = e.target.closest(".bracket-chip");
      if (chip && !e.target.closest(".bracket-chip-menu")) {
        toggleChipMenu_(chip);
        return;
      }
      var mover = e.target.closest('[data-action="mover-atleta"]');
      if (mover) {
        e.preventDefault();
        e.stopPropagation();
        openMoverModal_(mover.dataset.id);
        closeAllMenus_();
      }
    });

    // Click fuera de los menus → cerrarlos
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".bracket-chip")) closeAllMenus_();
    });
  }

  async function load() {
    state.loading = true;
    state.error = null;
    render_();
    try {
      var res = await root.api.get("inscripciones.list", {
        evento_id: state.eventoId,
      });
      state.inscripciones = res.inscripciones || [];
      state.loading = false;
      render_();
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : String(err);
      render_();
    }
  }

  /* ============================================================
   * Render
   * ============================================================ */

  function render_() {
    var grid = state.panel.querySelector("#brackets-grid");
    var summary = state.panel.querySelector("#brackets-summary");
    if (!grid) return;

    if (state.loading) {
      grid.innerHTML = '<div class="loading-message">Cargando inscripciones...</div>';
      if (summary) summary.textContent = "";
      return;
    }
    if (state.error) {
      grid.innerHTML =
        '<div class="error-state">' +
        "<h3>No pudimos cargar las inscripciones</h3>" +
        "<p>" + escapeHtml_(state.error) + "</p>" +
        "</div>";
      if (summary) summary.textContent = "";
      return;
    }
    if (state.inscripciones.length === 0) {
      grid.innerHTML =
        '<div class="placeholder">' +
        '<span class="placeholder-tag">Sin inscritos</span>' +
        "<h2>No hay atletas para agrupar</h2>" +
        "<p>Primero inscribe atletas en la tab <strong>Inscripciones</strong> y captura su pesaje.</p>" +
        "</div>";
      if (summary) summary.textContent = "";
      return;
    }

    // Filtrar por aprobados si toggle está activo
    var input = state.soloAprobados
      ? state.inscripciones.filter(function (i) { return i.estatus === "aprobado"; })
      : state.inscripciones.slice();

    if (input.length === 0 && state.soloAprobados) {
      grid.innerHTML =
        '<div class="placeholder">' +
        '<span class="placeholder-tag">Sin aprobados</span>' +
        "<h2>Ningún atleta aprobado todavía</h2>" +
        "<p>Ve a la tab <strong>Pesaje</strong> y aprueba al menos algunos atletas. O desactiva el toggle para ver todos los inscritos.</p>" +
        "</div>";
      if (summary) summary.textContent = "";
      return;
    }

    var grupos = root.BracketBuilder.agruparAtletas(input);

    // Summary header
    var viables = grupos.filter(function (g) { return g.viable; });
    var noViables = grupos.filter(function (g) { return !g.viable; });
    var totalAtletas = input.length;
    var totalPeleasReales = viables.reduce(function (acc, g) {
      var bracket = root.BracketBuilder.generarSingleElimination(g.atletas);
      var r = root.BracketBuilder.resumenPeleas(bracket);
      return acc + r.reales;
    }, 0);

    if (summary) {
      summary.innerHTML =
        '<div class="summary-card">' +
        '<div class="summary-stat"><span class="stat-num">' + totalAtletas + "</span><span class=\"stat-label\">Atletas</span></div>" +
        '<div class="summary-stat"><span class="stat-num">' + grupos.length + "</span><span class=\"stat-label\">Categorías</span></div>" +
        '<div class="summary-stat"><span class="stat-num stat-num-ok">' + viables.length + "</span><span class=\"stat-label\">Viables</span></div>" +
        '<div class="summary-stat"><span class="stat-num stat-num-warn">' + noViables.length + "</span><span class=\"stat-label\">No viables</span></div>" +
        '<div class="summary-stat"><span class="stat-num">' + totalPeleasReales + "</span><span class=\"stat-label\">Peleas reales</span></div>" +
        "</div>";
    }

    // Reordenar: viables primero, no viables al final
    var ordenados = viables.concat(noViables);

    grid.innerHTML = ordenados.map(renderGrupoCard_).join("");
  }

  function renderGrupoCard_(grupo) {
    var viable = grupo.viable;
    var bracket = viable
      ? root.BracketBuilder.generarSingleElimination(grupo.atletas)
      : [];
    var resumen = root.BracketBuilder.resumenPeleas(bracket);

    var headerClass = viable ? "bracket-card-viable" : "bracket-card-no-viable";
    var badge = viable
      ? '<span class="estatus-pill estatus-aprobado">Viable</span>'
      : '<span class="estatus-pill estatus-rechazado">No viable</span>';

    var tipo = "";
    if (viable) {
      tipo =
        '<div class="bracket-tipo">' +
        '<span class="bracket-tipo-label">Tipo:</span>' +
        '<span class="bracket-tipo-value">' +
        (grupo.tipo_sugerido === "dos_atletas" ? "Pelea única" : "Eliminación simple") +
        "</span>" +
        '<span class="bracket-tipo-detail">' +
        "(" + resumen.total + " pelea" + (resumen.total === 1 ? "" : "s") +
        (resumen.byes > 0 ? ", " + resumen.byes + " con bye" : "") +
        ")</span>" +
        "</div>";
    } else {
      var faltan = 2 - grupo.num_atletas;
      tipo =
        '<div class="bracket-tipo bracket-tipo-warn">' +
        "Necesita al menos " + faltan + " atleta" + (faltan === 1 ? "" : "s") + " más para generar bracket." +
        "</div>";
    }

    var chips = grupo.atletas.map(renderChip_).join("");

    var preview = viable && bracket.length > 1
      ? renderMiniBracket_(bracket)
      : "";

    return (
      '<article class="bracket-card ' + headerClass + '">' +
      '<header class="bracket-card-header">' +
      '<div class="bracket-card-titlewrap">' +
      '<h3 class="bracket-card-title">' + escapeHtml_(grupo.categoria) + "</h3>" +
      "</div>" +
      "<div>" + badge + "</div>" +
      "</header>" +
      '<div class="bracket-card-meta">' +
      '<span class="bracket-card-count">' + grupo.num_atletas + " atleta" + (grupo.num_atletas === 1 ? "" : "s") + "</span>" +
      tipo +
      "</div>" +
      '<div class="bracket-chips">' + chips + "</div>" +
      preview +
      "</article>"
    );
  }

  function renderChip_(atleta) {
    if (!atleta) return "";
    var initials = initialsOf_(atleta.nombre_completo || "?");
    var nombre = atleta.nombre_completo || atleta.id;
    var insId = atleta._inscripcion_id || "";

    return (
      '<div class="bracket-chip" data-ins-id="' + escapeAttr_(insId) + '" tabindex="0">' +
      '<span class="bracket-chip-avatar">' + escapeHtml_(initials) + "</span>" +
      '<span class="bracket-chip-name">' + escapeHtml_(nombre) + "</span>" +
      '<button class="bracket-chip-mover" data-action="mover-atleta" data-id="' + escapeAttr_(insId) + '" title="Mover de categoría" aria-label="Mover">' +
      "⋯" +
      "</button>" +
      '<div class="bracket-chip-menu" hidden>' +
      '<button class="bracket-chip-menu-item" data-action="mover-atleta" data-id="' + escapeAttr_(insId) + '">' +
      "Cambiar categoría…" +
      "</button>" +
      "</div>" +
      "</div>"
    );
  }

  /**
   * Mini-bracket esquemático: muestra estructura visual sin nombres.
   * Solo para brackets con >2 atletas (los de 2 no necesitan preview).
   */
  function renderMiniBracket_(bracket) {
    var rondas = {};
    bracket.forEach(function (p) {
      if (!rondas[p.ronda_idx]) rondas[p.ronda_idx] = [];
      rondas[p.ronda_idx].push(p);
    });

    var maxIdx = Math.max.apply(null, Object.keys(rondas).map(Number));
    var html = '<div class="mini-bracket">';
    for (var i = 0; i <= maxIdx; i += 1) {
      var rs = rondas[i] || [];
      html += '<div class="mini-bracket-col">';
      html += '<div class="mini-bracket-col-label">' + escapeHtml_(rs[0] ? rs[0].ronda : "") + "</div>";
      rs.forEach(function (p) {
        var cls = p.bye ? "mini-bracket-match mini-bracket-match-bye" : "mini-bracket-match";
        html += '<div class="' + cls + '" title="Pelea #' + p.numero + '">';
        html += '<span>' + (p.atleta1 ? escapeHtml_(shortName_(p.atleta1.nombre_completo)) : (p.bye && p.atleta2 ? "(bye)" : "?")) + "</span>";
        html += '<span>' + (p.atleta2 ? escapeHtml_(shortName_(p.atleta2.nombre_completo)) : (p.bye && p.atleta1 ? "(bye)" : "?")) + "</span>";
        html += "</div>";
      });
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  /* ============================================================
   * Chip menu / mover modal
   * ============================================================ */

  function toggleChipMenu_(chip) {
    var menu = chip.querySelector(".bracket-chip-menu");
    if (!menu) return;
    var isOpen = !menu.hidden;
    closeAllMenus_();
    if (!isOpen) menu.hidden = false;
  }

  function closeAllMenus_() {
    state.panel.querySelectorAll(".bracket-chip-menu").forEach(function (m) {
      m.hidden = true;
    });
  }

  function openMoverModal_(insId) {
    if (!insId) return;
    var ins = state.inscripciones.find(function (i) { return i.id === insId; });
    if (!ins || !ins.atleta) return;

    var a = ins.atleta;
    var fechaEvento = state.evento ? state.evento.fecha : todayISO_();
    var division = root.Reglamento.calcularDivisionEdad(a.fecha_nacimiento, fechaEvento);
    var pesoCats = root.Reglamento.categoriasPesoPara(division, a.genero);
    if (!pesoCats || pesoCats.length === 0) {
      alert("No hay categorías disponibles para este atleta.");
      return;
    }

    var currentPesoName = pesoFromCategoria_(ins.categoria_calculada);

    // Construir modal inline si no existe
    var overlay = document.getElementById("brackets-mover-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "brackets-mover-overlay";
      overlay.className = "modal-overlay";
      overlay.innerHTML =
        '<div class="modal-dialog">' +
        '<header class="modal-header">' +
        '<h2 id="brackets-mover-title">Mover atleta</h2>' +
        '<button type="button" class="modal-close" aria-label="Cerrar">×</button>' +
        "</header>" +
        '<div class="modal-error" hidden></div>' +
        '<div class="modal-body" style="padding: 18px 22px;">' +
        '<p style="color: var(--muted); margin: 0 0 14px; font-size: 13px;" id="brackets-mover-desc"></p>' +
        '<label class="form-field">' +
        '<span class="form-label">Categoría de peso</span>' +
        '<select id="brackets-mover-select"></select>' +
        "</label>" +
        '<p style="color: var(--muted-2); margin: 12px 0 0; font-size: 12px;">El cambio marca la categoría como manual (★). Usa "Auto" en la tab Pesaje para volver al cálculo automático.</p>' +
        "</div>" +
        '<footer class="modal-footer">' +
        '<div class="modal-footer-right">' +
        '<button type="button" class="btn btn-cancel">Cancelar</button>' +
        '<button type="button" class="btn btn-primary" id="brackets-mover-save">Mover</button>' +
        "</div>" +
        "</footer>" +
        "</div>";
      document.body.appendChild(overlay);

      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeMoverModal_();
      });
      overlay.querySelector(".modal-close").addEventListener("click", closeMoverModal_);
      overlay.querySelector(".btn-cancel").addEventListener("click", closeMoverModal_);
    }

    // Populate
    overlay.querySelector("#brackets-mover-title").textContent =
      "Mover · " + a.nombre_completo;
    overlay.querySelector("#brackets-mover-desc").textContent =
      "División: " + division + " · Género: " + a.genero +
      " · Nivel: " + (a.nivel || "—") +
      " · Categoría actual: " + (currentPesoName || "—");

    var sel = overlay.querySelector("#brackets-mover-select");
    sel.innerHTML = pesoCats
      .map(function (c) {
        var label = c.nombre + (isFinite(c.pesoMax) ? " (<" + c.pesoMax + " kg)" : " (sin tope)");
        var selected = c.nombre === currentPesoName ? " selected" : "";
        var fullCat = [division, a.genero, a.nivel || "", c.nombre].join(" / ");
        return '<option value="' + escapeAttr_(fullCat) + '"' + selected + ">" + escapeHtml_(label) + "</option>";
      })
      .join("");

    var saveBtn = overlay.querySelector("#brackets-mover-save");
    // Reemplazar onclick para capturar el insId actual
    saveBtn.onclick = async function () {
      var newCat = sel.value;
      if (!newCat) return;
      saveBtn.disabled = true;
      saveBtn.textContent = "Moviendo...";
      try {
        await root.api.post("inscripciones.setcategoria", { id: insId, categoria: newCat });
        closeMoverModal_();
        load(); // refetch + re-render
      } catch (err) {
        var errEl = overlay.querySelector(".modal-error");
        errEl.textContent = err && err.message ? err.message : String(err);
        errEl.hidden = false;
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Mover";
      }
    };

    overlay.classList.add("is-open");
  }

  function closeMoverModal_() {
    var overlay = document.getElementById("brackets-mover-overlay");
    if (overlay) overlay.classList.remove("is-open");
  }

  /* ============================================================
   * Helpers
   * ============================================================ */

  function pesoFromCategoria_(cat) {
    if (!cat) return "";
    var parts = String(cat).split(" / ");
    return (parts[parts.length - 1] || "").trim();
  }

  function initialsOf_(name) {
    var parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "?";
  }

  function shortName_(name) {
    if (!name) return "";
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0] + " " + (parts[1] || "").charAt(0) + ".";
  }

  function todayISO_() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function escapeHtml_(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function escapeAttr_(v) { return escapeHtml_(v); }

  root.EventoBrackets = { init: init };
})(typeof window !== "undefined" ? window : globalThis);
