/**
 * Tab "Pesaje" del detalle de evento (T12).
 *
 * API pública:
 *   EventoPesaje.init({ eventoId, evento, panel })
 *
 * Flujo:
 *   - Carga inscripciones (con datos del atleta) via api.inscripciones.list.
 *   - Calcula en cliente la "categoría declarada" usando peso_referencia del
 *     atleta (con reglamento.js) — esto es lo que sería el atleta SI no se
 *     pesa.
 *   - Muestra cada inscripción con: input editable de peso pesaje + categoria
 *     calculada (servidor) + warning si la categoría cambió respecto a la
 *     declarada + botones Aprobar / Rechazar (cambia estatus).
 *   - Input de peso: debounce 500ms para no spamear el backend. Mientras
 *     guarda, muestra "Guardando…" al lado.
 *
 * Requiere: api.js, reglamento.js cargados antes.
 */
(function (root) {
  "use strict";

  var ESTATUS_LABEL = {
    pendiente_pesaje: "Pendiente",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
  };

  var DEBOUNCE_MS = 500;

  var state = {
    eventoId: null,
    evento: null,
    panel: null,
    inscripciones: [],
    loading: false,
    error: null,
    filter: "", // "" / "pendiente_pesaje" / "aprobado" / "rechazado"
    saving: {}, // ins_id -> bool
    timers: {}, // ins_id -> setTimeout handle
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
      '<div class="pesaje-toolbar">' +
      '<div class="btn-group" role="group" aria-label="Filtro de estatus">' +
      '<button class="btn btn-sm is-active" data-filter="" type="button">Todos</button>' +
      '<button class="btn btn-sm" data-filter="pendiente_pesaje" type="button">Pendientes</button>' +
      '<button class="btn btn-sm" data-filter="aprobado" type="button">Aprobados</button>' +
      '<button class="btn btn-sm" data-filter="rechazado" type="button">Rechazados</button>' +
      "</div>" +
      '<div class="toolbar-count" id="pesaje-count" aria-live="polite"></div>' +
      "</div>" +
      '<div id="pesaje-list" class="pesaje-list">' +
      '<div class="loading-message">Cargando atletas...</div>' +
      "</div>"
    );
  }

  function bindActions_() {
    // Filtros
    state.panel.querySelectorAll("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.dataset.filter || "";
        state.panel.querySelectorAll("[data-filter]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        render_();
      });
    });

    // Delegación: peso input, botones Aprobar/Rechazar
    state.panel.addEventListener("input", function (e) {
      var input = e.target.closest('input[data-action="peso"]');
      if (!input) return;
      var id = input.dataset.id;
      var raw = input.value;
      schedulePesoSave_(id, raw, input);
    });

    state.panel.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (action === "aprobar") setEstatus_(id, "aprobado");
      else if (action === "rechazar") setEstatus_(id, "rechazado");
      else if (action === "reset") setEstatus_(id, "pendiente_pesaje");
      else if (action === "categoria-reset") resetCategoria_(id);
    });

    state.panel.addEventListener("change", function (e) {
      var sel = e.target.closest('select[data-action="categoria"]');
      if (!sel) return;
      var id = sel.dataset.id;
      var categoria = sel.value;
      setCategoriaManual_(id, categoria);
    });

    state.panel.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var input = e.target.closest('input[data-action="peso"]');
      if (!input) return;
      e.preventDefault();
      var id = input.dataset.id;
      var raw = input.value;
      cancelDebounce_(id);
      savePesoNow_(id, raw, input);
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

  function schedulePesoSave_(id, raw, input) {
    cancelDebounce_(id);
    state.timers[id] = setTimeout(function () {
      savePesoNow_(id, raw, input);
    }, DEBOUNCE_MS);
  }

  function cancelDebounce_(id) {
    if (state.timers[id]) {
      clearTimeout(state.timers[id]);
      delete state.timers[id];
    }
  }

  async function savePesoNow_(id, raw, input) {
    var trimmed = String(raw == null ? "" : raw).trim();
    var peso = Number(trimmed);
    if (!trimmed || !isFinite(peso) || peso <= 0) {
      // Si se vacía o es inválido, no enviamos.
      showInlineStatus_(id, "");
      return;
    }
    if (state.saving[id]) return;
    state.saving[id] = true;
    showInlineStatus_(id, "Guardando…");
    try {
      var res = await root.api.post("inscripciones.setpesopesaje", {
        id: id,
        peso_kg: peso,
      });
      // Actualizar el state con la inscripción actualizada del backend
      var idx = state.inscripciones.findIndex(function (i) { return i.id === id; });
      if (idx >= 0) {
        // Preservar atleta enriquecido que el backend SÍ devuelve también,
        // pero por seguridad lo conservamos del original.
        var prev = state.inscripciones[idx];
        var updated = res.inscripcion;
        state.inscripciones[idx] = Object.assign({}, prev, updated, {
          atleta: prev.atleta,
        });
      }
      showInlineStatus_(id, "✓ guardado");
      setTimeout(function () { showInlineStatus_(id, ""); }, 1200);
      // Re-renderizamos para actualizar categoría real y warning
      renderRowsOnly_();
    } catch (err) {
      showInlineStatus_(id, "Error: " + (err && err.message ? err.message : err), true);
    } finally {
      state.saving[id] = false;
    }
  }

  async function setEstatus_(id, nuevo) {
    if (state.saving[id]) return;
    state.saving[id] = true;
    showInlineStatus_(id, "Actualizando…");
    try {
      await root.api.post("inscripciones.setestatus", {
        id: id,
        estatus: nuevo,
      });
      var idx = state.inscripciones.findIndex(function (i) { return i.id === id; });
      if (idx >= 0) state.inscripciones[idx].estatus = nuevo;
      showInlineStatus_(id, "");
      render_();
    } catch (err) {
      showInlineStatus_(id, "Error: " + (err && err.message ? err.message : err), true);
    } finally {
      state.saving[id] = false;
    }
  }

  async function setCategoriaManual_(id, categoria) {
    if (state.saving[id]) return;
    state.saving[id] = true;
    showInlineStatus_(id, "Guardando categoría…");
    try {
      var res = await root.api.post("inscripciones.setcategoria", {
        id: id,
        categoria: categoria,
      });
      var idx = state.inscripciones.findIndex(function (i) { return i.id === id; });
      if (idx >= 0) {
        var prev = state.inscripciones[idx];
        state.inscripciones[idx] = Object.assign({}, prev, res.inscripcion, {
          atleta: prev.atleta,
        });
      }
      showInlineStatus_(id, "✓ guardado");
      setTimeout(function () { showInlineStatus_(id, ""); }, 1200);
      renderRowsOnly_();
    } catch (err) {
      showInlineStatus_(id, "Error: " + (err && err.message ? err.message : err), true);
    } finally {
      state.saving[id] = false;
    }
  }

  async function resetCategoria_(id) {
    if (state.saving[id]) return;
    state.saving[id] = true;
    showInlineStatus_(id, "Recalculando…");
    try {
      var res = await root.api.post("inscripciones.clearcategoria", { id: id });
      var idx = state.inscripciones.findIndex(function (i) { return i.id === id; });
      if (idx >= 0) {
        var prev = state.inscripciones[idx];
        state.inscripciones[idx] = Object.assign({}, prev, res.inscripcion, {
          atleta: prev.atleta,
        });
      }
      showInlineStatus_(id, "");
      renderRowsOnly_();
    } catch (err) {
      showInlineStatus_(id, "Error: " + (err && err.message ? err.message : err), true);
    } finally {
      state.saving[id] = false;
    }
  }

  function showInlineStatus_(id, text, isError) {
    var el = state.panel.querySelector('[data-status-for="' + id + '"]');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
  }

  function applyFilter_(list) {
    if (!state.filter) return list;
    return list.filter(function (i) { return i.estatus === state.filter; });
  }

  function render_() {
    var listEl = state.panel.querySelector("#pesaje-list");
    var countEl = state.panel.querySelector("#pesaje-count");
    if (!listEl) return;

    if (state.loading) {
      listEl.innerHTML = '<div class="loading-message">Cargando atletas...</div>';
      if (countEl) countEl.textContent = "";
      return;
    }
    if (state.error) {
      listEl.innerHTML =
        '<div class="error-state">' +
        "<h3>No pudimos cargar las inscripciones</h3>" +
        "<p>" + escapeHtml_(state.error) + "</p>" +
        "</div>";
      if (countEl) countEl.textContent = "";
      return;
    }
    if (state.inscripciones.length === 0) {
      listEl.innerHTML =
        '<div class="placeholder">' +
        '<span class="placeholder-tag">Sin inscritos</span>' +
        "<h2>No hay atletas para pesar</h2>" +
        "<p>Primero inscribe atletas en la tab <strong>Inscripciones</strong>.</p>" +
        "</div>";
      if (countEl) countEl.textContent = "";
      return;
    }

    updateCount_();

    var visible = applyFilter_(state.inscripciones);
    if (visible.length === 0) {
      listEl.innerHTML =
        '<div class="placeholder">' +
        '<span class="placeholder-tag">Sin coincidencias</span>' +
        "<h2>No hay inscripciones con este estatus</h2>" +
        "<p>Cambia el filtro a <strong>Todos</strong>.</p>" +
        "</div>";
      return;
    }

    listEl.innerHTML = renderTable_(visible);
  }

  function renderRowsOnly_() {
    // Re-renderiza la tabla sin recargar todo (preserva foco en inputs)
    var visible = applyFilter_(state.inscripciones);
    var listEl = state.panel.querySelector("#pesaje-list");
    if (!listEl) return;
    updateCount_();
    listEl.innerHTML = renderTable_(visible);
  }

  function updateCount_() {
    var countEl = state.panel.querySelector("#pesaje-count");
    if (!countEl) return;
    var total = state.inscripciones.length;
    var pend = state.inscripciones.filter(function (i) { return i.estatus === "pendiente_pesaje"; }).length;
    var aprob = state.inscripciones.filter(function (i) { return i.estatus === "aprobado"; }).length;
    var rech = state.inscripciones.filter(function (i) { return i.estatus === "rechazado"; }).length;
    countEl.textContent =
      total + " inscritos · " + pend + " pendientes · " + aprob + " aprobados · " + rech + " rechazados";
  }

  function renderTable_(list) {
    var html =
      '<div class="table-wrap pesaje-table-wrap"><table class="data-table pesaje-table">' +
      "<thead><tr>" +
      "<th>Atleta</th>" +
      '<th class="num">Peso ref.</th>' +
      "<th>Categoría declarada</th>" +
      "<th>Peso pesaje</th>" +
      "<th>Categoría real</th>" +
      "<th>Estatus</th>" +
      "<th>Acciones</th>" +
      "</tr></thead><tbody>";
    list.forEach(function (ins) {
      html += renderRow_(ins);
    });
    html += "</tbody></table></div>";
    return html;
  }

  function renderRow_(ins) {
    var a = ins.atleta || {};
    var fechaEvento = state.evento ? state.evento.fecha : todayISO_();
    var declared = computeCategoria_(a, fechaEvento, Number(a.peso_referencia_kg));
    var realStr = ins.categoria_calculada || "";
    var pesoPesaje = ins.peso_pesaje_kg && Number(ins.peso_pesaje_kg) > 0 ? Number(ins.peso_pesaje_kg) : "";
    var isOverride = !!ins.categoria_override;

    var initials = initialsOf_(a.nombre_completo || "?");
    var photo = a.foto_url && /^https?:/.test(a.foto_url)
      ? '<img class="avatar" src="' + escapeAttr_(a.foto_url) + '" alt="" />'
      : '<span class="avatar avatar-placeholder">' + escapeHtml_(initials) + "</span>";
    var genero = a.genero === "Masculino" ? '<span class="badge badge-genero badge-m">M</span>'
      : a.genero === "Femenino" ? '<span class="badge badge-genero badge-f">F</span>'
      : "—";
    var nivelClass = (a.nivel || "").toLowerCase();
    var nivel = a.nivel
      ? '<span class="badge badge-nivel badge-nivel-' + nivelClass + '">' + escapeHtml_(a.nivel) + "</span>"
      : "—";

    var estatus = ins.estatus || "pendiente_pesaje";
    var estatusPill =
      '<span class="estatus-pill estatus-' + escapeAttr_(estatus) + '">' +
      escapeHtml_(ESTATUS_LABEL[estatus] || estatus) +
      "</span>";

    var actions = "";
    if (estatus === "pendiente_pesaje") {
      actions =
        '<button class="btn btn-sm btn-aprobar" data-action="aprobar" data-id="' + escapeAttr_(ins.id) + '">✓ Aprobar</button>' +
        '<button class="btn btn-sm btn-ghost btn-rechazar" data-action="rechazar" data-id="' + escapeAttr_(ins.id) + '">✗ Rechazar</button>';
    } else {
      actions =
        '<button class="btn btn-sm btn-ghost" data-action="reset" data-id="' + escapeAttr_(ins.id) + '" title="Volver a pendiente">↩︎ Reabrir</button>';
    }

    var realCell = buildCategoriaCell_(a, fechaEvento, ins.id, realStr, isOverride, declared);

    return (
      '<tr data-id="' + escapeAttr_(ins.id) + '" class="pesaje-row pesaje-row-' + escapeAttr_(estatus) + '">' +
      '<td><div class="atleta-cell">' + photo +
      '<div class="atleta-info"><strong>' + escapeHtml_(a.nombre_completo || "(sin nombre)") + "</strong>" +
      '<span class="atleta-pais">' + (a.academia ? escapeHtml_(a.academia) + " · " : "") + genero + " " + nivel + "</span>" +
      "</div></div></td>" +
      '<td class="num">' + (a.peso_referencia_kg ? a.peso_referencia_kg + " kg" : "—") + "</td>" +
      '<td><code class="categoria-cell categoria-declarada">' + escapeHtml_(declared || "—") + "</code></td>" +
      "<td>" +
      '<div class="peso-input-wrap">' +
      '<input class="peso-input" type="number" step="0.1" min="0" inputmode="decimal" ' +
        'data-action="peso" data-id="' + escapeAttr_(ins.id) + '" ' +
        'value="' + (pesoPesaje ? escapeAttr_(String(pesoPesaje)) : "") + '" ' +
        'placeholder="kg" />' +
      '<span class="peso-unit">kg</span>' +
      "</div>" +
      '<span class="peso-status" data-status-for="' + escapeAttr_(ins.id) + '"></span>' +
      "</td>" +
      "<td>" + realCell + "</td>" +
      "<td>" + estatusPill + "</td>" +
      '<td><div class="pesaje-actions">' + actions + "</div></td>" +
      "</tr>"
    );
  }

  /**
   * Construye la celda de "Categoría real" con un <select> editable.
   * El select lista todas las categorías de peso válidas para la
   * división + género del atleta. Si hay override, muestra badge ★
   * y un botón ↩︎ Auto para volver al cálculo automático.
   */
  function buildCategoriaCell_(atleta, fechaEvento, insId, currentCategoria, isOverride, declared) {
    if (!atleta || !atleta.fecha_nacimiento || !root.Reglamento) {
      return "—";
    }
    var division = root.Reglamento.calcularDivisionEdad(atleta.fecha_nacimiento, fechaEvento);
    if (!division) return "—";
    var pesoCats = root.Reglamento.categoriasPesoPara(division, atleta.genero);
    if (!pesoCats || pesoCats.length === 0) return "—";

    // Extrae el peso category del string completo
    var currentPesoName = pesoFromCategoriaString_(currentCategoria);

    var options = pesoCats.map(function (cat) {
      var fullCategoria = [division, atleta.genero, atleta.nivel || "", cat.nombre].join(" / ");
      var selected = currentPesoName === cat.nombre ? " selected" : "";
      var label = cat.nombre;
      if (isFinite(cat.pesoMax)) {
        label += " (<" + cat.pesoMax + " kg)";
      } else {
        label += " (sin tope)";
      }
      return '<option value="' + escapeAttr_(fullCategoria) + '"' + selected + ">" + escapeHtml_(label) + "</option>";
    }).join("");

    var select =
      '<select class="categoria-select" data-action="categoria" data-id="' + escapeAttr_(insId) + '">' +
      options +
      "</select>";

    // Badge: ★ Manual, ✓ misma, ⚠ cambió
    var badge = "";
    if (isOverride) {
      badge = '<span class="badge badge-manual" title="Categoría establecida manualmente">★ Manual</span>';
    } else if (currentCategoria && declared) {
      if (currentCategoria === declared) {
        badge = '<span class="badge badge-ok">✓ Misma</span>';
      } else {
        badge = '<span class="badge badge-cambio" title="La categoría cambió respecto a la declarada">⚠ Cambió</span>';
      }
    }

    var resetBtn = isOverride
      ? '<button class="btn btn-sm btn-ghost btn-cat-reset" data-action="categoria-reset" data-id="' + escapeAttr_(insId) + '" title="Volver al auto-cálculo">↩︎ Auto</button>'
      : "";

    return (
      '<div class="cat-cell">' +
      '<div class="cat-cell-row">' + select + resetBtn + "</div>" +
      (badge ? '<div class="cat-cell-row">' + badge + "</div>" : "") +
      "</div>"
    );
  }

  function pesoFromCategoriaString_(categoria) {
    if (!categoria) return "";
    var parts = String(categoria).split(" / ");
    return (parts[parts.length - 1] || "").trim();
  }

  // ---------- helpers ----------

  function computeCategoria_(atleta, fechaEvento, peso) {
    if (!atleta || !atleta.fecha_nacimiento || !fechaEvento) return "";
    if (!isFinite(peso) || peso <= 0) return "";
    if (!root.Reglamento) return "";
    var division = root.Reglamento.calcularDivisionEdad(atleta.fecha_nacimiento, fechaEvento);
    if (!division) return "";
    var cat = root.Reglamento.calcularCategoriaPeso(division, atleta.genero, peso);
    if (!cat) return "";
    return [division, atleta.genero, atleta.nivel || "", cat.nombre].join(" / ");
  }

  function todayISO_() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
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
  function escapeAttr_(v) { return escapeHtml_(v); }

  root.EventoPesaje = { init: init };
})(typeof window !== "undefined" ? window : globalThis);
