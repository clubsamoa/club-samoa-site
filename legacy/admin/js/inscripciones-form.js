/**
 * Modal multi-select para inscribir atletas a un evento.
 *
 * API pública:
 *   InscripcionesForm.open({ eventoId, eventoNombre, alreadyIds, onSaved })
 *     - eventoId: ID del evento (requerido)
 *     - eventoNombre: nombre para mostrar en el título
 *     - alreadyIds: array de atleta_ids ya inscritos (se ocultan del listado)
 *     - onSaved(res): callback al inscribir exitosamente (res tiene created/skipped)
 *
 * Comportamiento:
 *   - Carga todos los atletas activos via api.atletas.list
 *   - Filtra los que ya están inscritos
 *   - Búsqueda case-insensitive por nombre + academia
 *   - Checkboxes para multi-select
 *   - Contador "N seleccionados" en el footer
 *   - Botón "Inscribir N atletas" llama a inscripciones.create
 *
 * Requiere: api.js, reglamento.js cargados antes.
 */
(function (root) {
  "use strict";

  var refs = {};
  var state = {
    eventoId: null,
    eventoNombre: "",
    alreadyIds: [],
    atletas: [],
    selected: {},
    search: "",
    loading: false,
    saving: false,
    error: null,
    onSaved: null,
  };

  function open(opts) {
    opts = opts || {};
    state.eventoId = opts.eventoId;
    state.eventoNombre = opts.eventoNombre || "";
    state.alreadyIds = (opts.alreadyIds || []).slice();
    state.selected = {};
    state.search = "";
    state.loading = false;
    state.saving = false;
    state.error = null;
    state.onSaved = typeof opts.onSaved === "function" ? opts.onSaved : null;

    ensureUI_();
    if (refs.search) refs.search.value = "";
    if (refs.error) refs.error.hidden = true;
    refs.title.textContent = state.eventoNombre
      ? "Agregar atletas a " + state.eventoNombre
      : "Agregar atletas al evento";

    showOverlay_();
    loadAtletas();
  }

  function close() {
    if (refs.overlay) refs.overlay.classList.remove("is-open");
    document.removeEventListener("keydown", onKeyDown_);
  }

  function ensureUI_() {
    if (refs.overlay) return;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    var dialog = document.createElement("div");
    dialog.className = "modal-dialog modal-dialog-wide";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "inscripciones-form-title");

    dialog.innerHTML =
      '<header class="modal-header">' +
      '<h2 id="inscripciones-form-title">Agregar atletas</h2>' +
      '<button type="button" class="modal-close" aria-label="Cerrar">×</button>' +
      "</header>" +
      '<div class="modal-error" hidden></div>' +
      '<div class="modal-body multiselect-body">' +
      '<div class="multiselect-toolbar">' +
      '<input class="multiselect-search" type="search" placeholder="Buscar por nombre, academia..." autocomplete="off" />' +
      '<div class="multiselect-bulk">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-bulk="all">Todos</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-bulk="none">Ninguno</button>' +
      "</div>" +
      "</div>" +
      '<div class="multiselect-list" tabindex="0"></div>' +
      "</div>" +
      '<footer class="modal-footer">' +
      '<div class="multiselect-count"></div>' +
      '<div class="modal-footer-right">' +
      '<button type="button" class="btn btn-cancel">Cancelar</button>' +
      '<button type="button" class="btn btn-primary btn-save" disabled>Inscribir seleccionados</button>' +
      "</div>" +
      "</footer>";

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    refs.overlay = overlay;
    refs.dialog = dialog;
    refs.title = dialog.querySelector("#inscripciones-form-title");
    refs.search = dialog.querySelector(".multiselect-search");
    refs.list = dialog.querySelector(".multiselect-list");
    refs.count = dialog.querySelector(".multiselect-count");
    refs.btnSave = dialog.querySelector(".btn-save");
    refs.btnCancel = dialog.querySelector(".btn-cancel");
    refs.error = dialog.querySelector(".modal-error");

    dialog.querySelector(".modal-close").addEventListener("click", close);
    refs.btnCancel.addEventListener("click", close);
    refs.btnSave.addEventListener("click", submit_);

    refs.search.addEventListener("input", function (e) {
      state.search = e.target.value.trim().toLowerCase();
      renderList_();
    });

    dialog.querySelectorAll("[data-bulk]").forEach(function (b) {
      b.addEventListener("click", function () {
        bulkSelect_(b.dataset.bulk);
      });
    });

    refs.list.addEventListener("click", function (e) {
      var row = e.target.closest("[data-atleta-id]");
      if (!row) return;
      // Solo toggleamos si el clic no fue directamente sobre el checkbox
      // (que tiene su propio handler default).
      if (e.target.tagName !== "INPUT") {
        var id = row.dataset.atletaId;
        state.selected[id] = !state.selected[id];
        updateRow_(row, id);
        updateCount_();
      }
    });
    refs.list.addEventListener("change", function (e) {
      if (e.target.tagName !== "INPUT") return;
      var row = e.target.closest("[data-atleta-id]");
      if (!row) return;
      var id = row.dataset.atletaId;
      state.selected[id] = e.target.checked;
      updateRow_(row, id);
      updateCount_();
    });
  }

  function showOverlay_() {
    refs.overlay.classList.add("is-open");
    document.addEventListener("keydown", onKeyDown_);
    setTimeout(function () { refs.search.focus(); }, 50);
  }

  function onKeyDown_(e) {
    if (e.key === "Escape") close();
  }

  async function loadAtletas() {
    state.loading = true;
    state.error = null;
    renderList_();
    try {
      var res = await root.api.get("atletas.list");
      var ids = state.alreadyIds.reduce(function (acc, id) { acc[id] = true; return acc; }, {});
      state.atletas = (res.atletas || []).filter(function (a) {
        return a.activo === true && !ids[a.id];
      });
      state.loading = false;
      renderList_();
    } catch (err) {
      state.loading = false;
      state.atletas = [];
      showBannerError_(err && err.message ? err.message : String(err));
    }
  }

  function matchesSearch_(a) {
    if (!state.search) return true;
    var hay =
      (a.nombre_completo || "").toLowerCase() + " " +
      (a.academia || "").toLowerCase();
    return hay.indexOf(state.search) >= 0;
  }

  function visibleAtletas_() {
    return state.atletas.filter(matchesSearch_);
  }

  function bulkSelect_(mode) {
    var visible = visibleAtletas_();
    if (mode === "all") {
      visible.forEach(function (a) { state.selected[a.id] = true; });
    } else {
      visible.forEach(function (a) { state.selected[a.id] = false; });
    }
    renderList_();
  }

  function renderList_() {
    if (state.loading) {
      refs.list.innerHTML = '<div class="loading-message">Cargando atletas...</div>';
      updateCount_();
      return;
    }
    if (state.atletas.length === 0) {
      refs.list.innerHTML =
        '<div class="multiselect-empty">' +
        '<p>No hay atletas disponibles para inscribir.</p>' +
        '<small>Todos los atletas activos ya están inscritos en este evento, o no tienes atletas en el catálogo.</small>' +
        '</div>';
      updateCount_();
      return;
    }
    var visible = visibleAtletas_();
    if (visible.length === 0) {
      refs.list.innerHTML = '<div class="multiselect-empty"><p>Sin coincidencias.</p></div>';
      updateCount_();
      return;
    }
    refs.list.innerHTML = visible.map(renderRow_).join("");
    updateCount_();
  }

  function renderRow_(a) {
    var checked = state.selected[a.id] ? "checked" : "";
    var initials = initialsOf_(a.nombre_completo || "?");
    var photo = a.foto_url && /^https?:/.test(a.foto_url)
      ? '<img class="avatar avatar-sm" src="' + escapeAttr_(a.foto_url) + '" alt="" />'
      : '<span class="avatar avatar-sm avatar-placeholder">' + escapeHtml_(initials) + "</span>";
    var genero = a.genero === "Masculino"
      ? '<span class="badge badge-genero badge-m">M</span>'
      : a.genero === "Femenino"
      ? '<span class="badge badge-genero badge-f">F</span>'
      : "—";
    var nivelClass = (a.nivel || "").toLowerCase();
    var nivel = a.nivel
      ? '<span class="badge badge-nivel badge-nivel-' + nivelClass + '">' + escapeHtml_(a.nivel) + "</span>"
      : "—";

    // División calculada por reglamento.js si está disponible
    var division = "";
    try {
      if (a.fecha_nacimiento && root.Reglamento && root.Reglamento.calcularDivisionEdad) {
        division = root.Reglamento.calcularDivisionEdad(a.fecha_nacimiento, todayISO_()) || "";
      }
    } catch (e) { /* noop */ }

    return (
      '<label class="multiselect-row' + (checked ? " is-selected" : "") + '" data-atleta-id="' + escapeAttr_(a.id) + '">' +
      '<input type="checkbox" ' + checked + " />" +
      photo +
      '<div class="multiselect-row-info">' +
      '<strong>' + escapeHtml_(a.nombre_completo || "(sin nombre)") + "</strong>" +
      '<span class="multiselect-row-sub">' +
      (a.academia ? escapeHtml_(a.academia) + " · " : "") +
      escapeHtml_(a.peso_referencia_kg ? a.peso_referencia_kg + " kg" : "") +
      "</span>" +
      "</div>" +
      '<div class="multiselect-row-badges">' +
      (division ? '<span class="badge badge-division">' + escapeHtml_(division) + "</span>" : "") +
      genero + nivel +
      "</div>" +
      "</label>"
    );
  }

  function updateRow_(row, id) {
    var checked = !!state.selected[id];
    row.classList.toggle("is-selected", checked);
    var cb = row.querySelector('input[type="checkbox"]');
    if (cb && cb.checked !== checked) cb.checked = checked;
  }

  function updateCount_() {
    var n = Object.keys(state.selected).filter(function (id) { return state.selected[id]; }).length;
    refs.count.textContent = n === 0 ? "Selecciona atletas a inscribir" : n + " seleccionado" + (n === 1 ? "" : "s");
    refs.btnSave.disabled = n === 0;
    refs.btnSave.textContent = n === 0
      ? "Inscribir seleccionados"
      : "Inscribir " + n + " atleta" + (n === 1 ? "" : "s");
  }

  async function submit_() {
    var ids = Object.keys(state.selected).filter(function (id) { return state.selected[id]; });
    if (ids.length === 0) return;
    if (state.saving) return;

    state.saving = true;
    refs.btnSave.disabled = true;
    refs.btnCancel.disabled = true;
    refs.btnSave.textContent = "Inscribiendo...";
    hideError_();

    try {
      var res = await root.api.post("inscripciones.create", {
        evento_id: state.eventoId,
        atleta_ids: ids,
      });
      close();
      if (state.onSaved) state.onSaved(res);
    } catch (err) {
      showBannerError_(err && err.message ? err.message : String(err));
    } finally {
      state.saving = false;
      refs.btnSave.disabled = false;
      refs.btnCancel.disabled = false;
      updateCount_();
    }
  }

  function showBannerError_(msg) {
    if (!refs.error) return;
    refs.error.textContent = msg;
    refs.error.hidden = false;
  }
  function hideError_() {
    if (refs.error) {
      refs.error.textContent = "";
      refs.error.hidden = true;
    }
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

  root.InscripcionesForm = { open: open, close: close };
})(typeof window !== "undefined" ? window : globalThis);
