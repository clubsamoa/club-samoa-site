/**
 * Tab "Brackets" del detalle de evento (T14 + T17).
 *
 * Tiene dos modos:
 *
 *  - PREVIEW (sin brackets confirmados): agrupa inscripciones aprobadas
 *    con BracketBuilder, muestra preview en cards. Botón "Confirmar"
 *    llama a brackets.confirm y switchea a LIVE.
 *
 *  - LIVE (con brackets confirmados): cada bracket se renderiza con
 *    BracketSVG. Click en una pelea abre scoreboard. Link "Ver completo"
 *    abre bracket.html (modo focused + proyección). Botón "Editar
 *    brackets" borra los confirmados y vuelve a preview.
 *
 * API pública:
 *   EventoBrackets.init({ eventoId, evento, panel })
 *
 * Requiere: api.js, reglamento.js, bracket-builder.js, bracket-svg.js.
 */
(function (root) {
  "use strict";

  var state = {
    eventoId: null,
    evento: null,
    panel: null,
    mode: "loading", // "loading" | "preview" | "live" | "error"
    error: null,
    inscripciones: [],
    soloAprobados: true,
    brackets: [], // list metadata
    bracketsDetail: [], // brackets con peleas y atletas
    confirming: false,
  };

  function init(opts) {
    state.eventoId = opts.eventoId;
    state.evento = opts.evento || null;
    state.panel = opts.panel;
    if (!state.panel) return;

    state.panel.innerHTML = '<div class="loading-message">Cargando brackets...</div>';
    state.panel.addEventListener("click", onPanelClick_);
    state.panel.addEventListener("change", onPanelChange_);

    load();
  }

  async function load() {
    state.mode = "loading";
    state.error = null;
    render_();

    // Paso 1: ¿hay brackets confirmados ya?
    try {
      var resB = await root.api.get("brackets.list", { evento_id: state.eventoId });
      var lista = (resB && resB.brackets) || [];
      if (lista.length > 0) {
        // LIVE — cargar el detalle de todos los brackets en paralelo.
        // (Antes era un waterfall secuencial: con N brackets eran N
        // round-trips en serie contra Apps Script, ~N×latencia.)
        state.brackets = lista;
        var detailResults = await Promise.all(
          lista.map(function (b) {
            return root.api.get("brackets.get", { id: b.id });
          }),
        );
        state.bracketsDetail = detailResults.map(function (d) {
          return d.bracket;
        });
        state.mode = "live";
        render_();
        return;
      }
    } catch (err) {
      // No es fatal — continuamos a preview
      console.warn("[brackets] brackets.list falló, voy a preview", err);
    }

    // Paso 2: PREVIEW — cargar inscripciones
    try {
      var resI = await root.api.get("inscripciones.list", { evento_id: state.eventoId });
      state.inscripciones = (resI && resI.inscripciones) || [];
      state.mode = "preview";
      render_();
    } catch (err) {
      state.mode = "error";
      state.error = err && err.message ? err.message : String(err);
      render_();
    }
  }

  function onPanelClick_(e) {
    var btn;

    if ((btn = e.target.closest("#btn-refresh-brackets"))) {
      load();
      return;
    }
    if ((btn = e.target.closest("#btn-confirmar-brackets"))) {
      confirmarBrackets_();
      return;
    }
    if ((btn = e.target.closest("#btn-editar-brackets"))) {
      editarBrackets_();
      return;
    }

    // Click en menu/chip del preview
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
      return;
    }

    // Click en pelea del SVG live → scoreboard
    var matchEl = e.target.closest(".bracket-svg-match[data-pelea-id]");
    if (matchEl) {
      var pid = matchEl.dataset.peleaId;
      if (pid) window.location.href = "./scoreboard.html?pelea_id=" + encodeURIComponent(pid);
      return;
    }
  }

  function onPanelChange_(e) {
    var toggle = e.target.closest("#solo-aprobados");
    if (toggle) {
      state.soloAprobados = toggle.checked;
      render_();
    }
  }

  /* ============================================================
   * Render
   * ============================================================ */

  function render_() {
    if (state.mode === "loading") {
      state.panel.innerHTML = '<div class="loading-message">Cargando brackets...</div>';
      return;
    }
    if (state.mode === "error") {
      state.panel.innerHTML =
        '<div class="error-state">' +
        "<h3>No pudimos cargar los brackets</h3>" +
        "<p>" + escapeHtml_(state.error) + "</p>" +
        '<button class="btn" id="btn-refresh-brackets">Reintentar</button>' +
        "</div>";
      return;
    }
    if (state.mode === "live") {
      renderLive_();
      return;
    }
    renderPreview_();
  }

  /* ============================================================
   * Render: PREVIEW
   * ============================================================ */

  function renderPreview_() {
    var html =
      '<div class="brackets-toolbar">' +
      '<div class="toolbar-filters">' +
      '<label class="toggle-switch">' +
      '<input type="checkbox" id="solo-aprobados"' + (state.soloAprobados ? " checked" : "") + ' />' +
      '<span class="toggle-track"><span class="toggle-thumb"></span></span>' +
      '<span class="toggle-label">Solo atletas aprobados</span>' +
      "</label>" +
      "</div>" +
      '<div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" id="btn-refresh-brackets">⟳ Recalcular</button>' +
      '<button class="btn btn-primary" id="btn-confirmar-brackets">Confirmar todos los viables</button>' +
      "</div>" +
      "</div>" +
      '<div id="brackets-summary" class="brackets-summary" aria-live="polite"></div>' +
      '<div id="brackets-grid" class="brackets-grid"></div>';
    state.panel.innerHTML = html;

    var grid = state.panel.querySelector("#brackets-grid");
    var summary = state.panel.querySelector("#brackets-summary");
    var btnConfirmar = state.panel.querySelector("#btn-confirmar-brackets");

    if (state.inscripciones.length === 0) {
      grid.innerHTML =
        '<div class="placeholder">' +
        '<span class="placeholder-tag">Sin inscritos</span>' +
        "<h2>No hay atletas para agrupar</h2>" +
        "<p>Primero inscribe atletas en la tab <strong>Inscripciones</strong> y captura su pesaje.</p>" +
        "</div>";
      btnConfirmar.disabled = true;
      return;
    }

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
      btnConfirmar.disabled = true;
      return;
    }

    var grupos = root.BracketBuilder.agruparAtletas(input);
    var viables = grupos.filter(function (g) { return g.viable; });
    var noViables = grupos.filter(function (g) { return !g.viable; });
    var totalAtletas = input.length;
    var totalPeleasReales = viables.reduce(function (acc, g) {
      var br = root.BracketBuilder.generarSingleElimination(g.atletas);
      var r = root.BracketBuilder.resumenPeleas(br);
      return acc + r.reales;
    }, 0);

    btnConfirmar.disabled = viables.length === 0;
    if (viables.length === 0) {
      btnConfirmar.title = "No hay categorías viables para confirmar.";
    } else {
      btnConfirmar.title = "Confirma " + viables.length + " bracket" + (viables.length === 1 ? "" : "s") +
        " (" + totalPeleasReales + " pelea" + (totalPeleasReales === 1 ? "" : "s") + " reales).";
    }

    summary.innerHTML =
      '<div class="summary-card">' +
      '<div class="summary-stat"><span class="stat-num">' + totalAtletas + "</span><span class=\"stat-label\">Atletas</span></div>" +
      '<div class="summary-stat"><span class="stat-num">' + grupos.length + "</span><span class=\"stat-label\">Categorías</span></div>" +
      '<div class="summary-stat"><span class="stat-num stat-num-ok">' + viables.length + "</span><span class=\"stat-label\">Viables</span></div>" +
      '<div class="summary-stat"><span class="stat-num stat-num-warn">' + noViables.length + "</span><span class=\"stat-label\">No viables</span></div>" +
      '<div class="summary-stat"><span class="stat-num">' + totalPeleasReales + "</span><span class=\"stat-label\">Peleas reales</span></div>" +
      "</div>";

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

  /* ============================================================
   * Render: LIVE (brackets confirmados)
   * ============================================================ */

  function renderLive_() {
    var totalAtletas = state.bracketsDetail.reduce(function (acc, b) { return acc + (Number(b.num_atletas) || 0); }, 0);
    var totalPeleas = state.bracketsDetail.reduce(function (acc, b) { return acc + (b.peleas ? b.peleas.length : 0); }, 0);
    var totalDecided = state.bracketsDetail.reduce(function (acc, b) {
      return acc + (b.peleas ? b.peleas.filter(function (p) { return p.ganador_id; }).length : 0);
    }, 0);

    var html =
      '<div class="brackets-toolbar">' +
      '<div class="brackets-live-summary">' +
      "<strong>" + state.bracketsDetail.length + "</strong> bracket" + (state.bracketsDetail.length === 1 ? "" : "s") +
      ' <span style="color:var(--muted-2)">·</span> ' +
      totalAtletas + " atletas" +
      ' <span style="color:var(--muted-2)">·</span> ' +
      totalDecided + " / " + totalPeleas + " peleas decididas" +
      "</div>" +
      '<div class="toolbar-actions">' +
      '<button class="btn btn-ghost btn-sm" id="btn-refresh-brackets">⟳ Refrescar</button>' +
      '<button class="btn btn-ghost btn-sm" id="btn-editar-brackets" style="color:#ff9090; border-color:rgba(244,7,6,0.4);">⚠ Editar brackets</button>' +
      "</div>" +
      "</div>" +
      '<div class="brackets-live-list">' +
      state.bracketsDetail.map(renderBracketLive_).join("") +
      "</div>";
    state.panel.innerHTML = html;

    // Renderizar cada SVG
    state.bracketsDetail.forEach(function (b) {
      var svgEl = state.panel.querySelector('svg[data-bracket-id="' + b.id + '"]');
      if (svgEl && root.BracketSVG) {
        root.BracketSVG.render(svgEl, b);
      }
    });
  }

  function renderBracketLive_(bracket) {
    var totalPeleas = bracket.peleas ? bracket.peleas.length : 0;
    var decididas = bracket.peleas ? bracket.peleas.filter(function (p) { return p.ganador_id; }).length : 0;
    var pct = totalPeleas > 0 ? Math.round((decididas / totalPeleas) * 100) : 0;

    return (
      '<section class="bracket-live-card">' +
      '<header class="bracket-live-header">' +
      '<div>' +
      '<h3 class="bracket-live-title">' + escapeHtml_(bracket.categoria) + "</h3>" +
      '<div class="bracket-live-meta">' +
      "<span>" + (bracket.num_atletas || 0) + " atletas</span>" +
      ' <span style="color:var(--muted-2)">·</span> ' +
      "<span>" + decididas + " / " + totalPeleas + " peleas decididas (" + pct + "%)</span>" +
      ' <span style="color:var(--muted-2)">·</span> ' +
      '<span class="estatus-pill estatus-' + escapeAttr_(bracket.estatus) + '">' + escapeHtml_(bracket.estatus) + "</span>" +
      "</div>" +
      "</div>" +
      '<div class="bracket-live-actions">' +
      '<a class="btn btn-ghost btn-sm" href="./bracket.html?id=' + encodeURIComponent(bracket.id) + '" target="_blank">Ver completo ↗</a>' +
      "</div>" +
      "</header>" +
      '<div class="bracket-svg-host">' +
      '<svg data-bracket-id="' + escapeAttr_(bracket.id) + '"></svg>' +
      "</div>" +
      "</section>"
    );
  }

  /* ============================================================
   * Acciones
   * ============================================================ */

  async function confirmarBrackets_() {
    if (state.confirming) return;

    var input = state.soloAprobados
      ? state.inscripciones.filter(function (i) { return i.estatus === "aprobado"; })
      : state.inscripciones.slice();
    var grupos = root.BracketBuilder.agruparAtletas(input);
    var viables = grupos.filter(function (g) { return g.viable; });
    if (viables.length === 0) return;

    var ok = window.confirm(
      "¿Confirmar " + viables.length + " bracket" + (viables.length === 1 ? "" : "s") + "?\n\n" +
      "Esto crea las peleas en la Sheet. Después podrás capturar resultados en el scoreboard. " +
      "Si necesitas cambios, podrás re-confirmar con un botón 'Editar brackets'.",
    );
    if (!ok) return;

    var bracketsParaConfirmar = viables.map(function (g) {
      return {
        categoria: g.categoria,
        tipo_bracket: g.tipo_sugerido,
        atletas: g.atletas,
        peleas: root.BracketBuilder.generarSingleElimination(g.atletas).map(function (p) {
          // Adaptar shape para backend: agregar numero_pelea, atleta1_id/atleta2_id
          return Object.assign({}, p, {
            numero_pelea: p.numero,
          });
        }),
      };
    });

    state.confirming = true;
    var btn = state.panel.querySelector("#btn-confirmar-brackets");
    if (btn) { btn.disabled = true; btn.textContent = "Confirmando..."; }

    try {
      await root.api.post("brackets.confirm", {
        evento_id: state.eventoId,
        brackets: bracketsParaConfirmar,
      });
      state.confirming = false;
      // Recargar — pasará automáticamente a LIVE
      await load();
    } catch (err) {
      state.confirming = false;
      alert("Error al confirmar brackets: " + (err && err.message ? err.message : err));
      if (btn) { btn.disabled = false; btn.textContent = "Confirmar todos los viables"; }
    }
  }

  async function editarBrackets_() {
    var ok = window.confirm(
      "¿Editar brackets?\n\n" +
      "Esto borra los " + state.bracketsDetail.length + " bracket(s) confirmados y vuelve al modo preview. " +
      "TODAS las peleas y resultados se perderán. ¿Continuar?",
    );
    if (!ok) return;

    try {
      await root.api.post("brackets.delete", { evento_id: state.eventoId });
      await load();
    } catch (err) {
      alert("Error al borrar brackets: " + (err && err.message ? err.message : err));
    }
  }

  /* ============================================================
   * Chip menu / mover modal (compartido con preview)
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
    var autoDivision = root.Reglamento.calcularDivisionEdad(a.fecha_nacimiento, fechaEvento);

    // Parsear la categoría actual: "División / Género / Nivel / Peso"
    var currentParts = (ins.categoria_calculada || "").split(" / ").map(function (s) { return s.trim(); });
    var currentDiv = currentParts[0] || autoDivision;
    var currentNivel = currentParts[2] || (a.nivel || "");
    var currentPesoName = currentParts[3] || "";

    var DIVISIONES = root.Reglamento.DIVISIONES || [
      "Mini 1", "Mini 2", "Infantil", "Juvenil D", "Juvenil C",
      "Juvenil B", "Juvenil A", "Junior", "Adultos",
    ];
    var NIVELES = root.Reglamento.NIVELES || ["Novato", "Principiante", "Intermedio", "Avanzado"];

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
        '<div class="form-grid">' +
        '<label class="form-field">' +
        '<span class="form-label">División de edad</span>' +
        '<select id="brackets-mover-division"></select>' +
        '<small class="form-hint" id="brackets-mover-division-hint" style="color:var(--muted-2);"></small>' +
        "</label>" +
        '<label class="form-field">' +
        '<span class="form-label">Nivel</span>' +
        '<select id="brackets-mover-nivel"></select>' +
        "</label>" +
        '<label class="form-field form-field-full">' +
        '<span class="form-label">Categoría de peso</span>' +
        '<select id="brackets-mover-peso"></select>' +
        "</label>" +
        "</div>" +
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

    overlay.querySelector("#brackets-mover-title").textContent =
      "Mover · " + a.nombre_completo;
    overlay.querySelector("#brackets-mover-desc").textContent =
      "Género: " + a.genero +
      " · Fecha nacimiento: " + (a.fecha_nacimiento || "—") +
      " · División automática para este evento: " + (autoDivision || "—");

    var divSel = overlay.querySelector("#brackets-mover-division");
    var nivelSel = overlay.querySelector("#brackets-mover-nivel");
    var pesoSel = overlay.querySelector("#brackets-mover-peso");
    var divHint = overlay.querySelector("#brackets-mover-division-hint");

    // Poblar División
    divSel.innerHTML = DIVISIONES.map(function (d) {
      var selected = d === currentDiv ? " selected" : "";
      var marker = d === autoDivision ? " (auto)" : "";
      return '<option value="' + escapeAttr_(d) + '"' + selected + ">" +
        escapeHtml_(d + marker) + "</option>";
    }).join("");

    // Poblar Nivel
    nivelSel.innerHTML = NIVELES.map(function (n) {
      var selected = n === currentNivel ? " selected" : "";
      return '<option value="' + escapeAttr_(n) + '"' + selected + ">" + escapeHtml_(n) + "</option>";
    }).join("");

    function updateDivHint() {
      var sel = divSel.value;
      if (sel === autoDivision) {
        divHint.textContent = "Coincide con el cálculo automático.";
        divHint.style.color = "var(--muted-2)";
      } else {
        divHint.textContent = "⚠ Distinta de la división automática (" + autoDivision + ").";
        divHint.style.color = "#f0c89a";
      }
    }

    function updatePesoOptions() {
      var div = divSel.value;
      var pesoCats = root.Reglamento.categoriasPesoPara(div, a.genero);
      if (!pesoCats || pesoCats.length === 0) {
        pesoSel.innerHTML = '<option value="">(sin categorías disponibles)</option>';
        pesoSel.disabled = true;
        return;
      }
      pesoSel.disabled = false;
      // Preservar peso por nombre si existe en la nueva lista
      var prevPeso = pesoSel.value
        ? pesoFromCategoria_(pesoSel.value)
        : currentPesoName;

      pesoSel.innerHTML = pesoCats.map(function (c) {
        var label = c.nombre + (isFinite(c.pesoMax) ? " (<" + c.pesoMax + " kg)" : " (sin tope)");
        var fullCat = [div, a.genero, nivelSel.value, c.nombre].join(" / ");
        var selected = c.nombre === prevPeso ? " selected" : "";
        return '<option value="' + escapeAttr_(fullCat) + '"' + selected + ">" + escapeHtml_(label) + "</option>";
      }).join("");
    }

    function rebuildPesoValuesForNivel() {
      // Cuando cambia el nivel, el peso category sigue siendo el mismo
      // pero el value (categoría completa) cambia. Refrescamos las options
      // preservando la selección.
      var prevPeso = pesoFromCategoria_(pesoSel.value);
      updatePesoOptions();
      // Forzar match por peso name
      var opts = pesoSel.querySelectorAll("option");
      opts.forEach(function (o) {
        if (pesoFromCategoria_(o.value) === prevPeso) o.selected = true;
      });
    }

    divSel.onchange = function () {
      updateDivHint();
      updatePesoOptions();
    };
    nivelSel.onchange = rebuildPesoValuesForNivel;

    updateDivHint();
    updatePesoOptions();

    var saveBtn = overlay.querySelector("#brackets-mover-save");
    saveBtn.onclick = async function () {
      var newCat = pesoSel.value;
      if (!newCat) return;
      saveBtn.disabled = true;
      saveBtn.textContent = "Moviendo...";
      try {
        await root.api.post("inscripciones.setcategoria", { id: insId, categoria: newCat });
        closeMoverModal_();
        load();
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
