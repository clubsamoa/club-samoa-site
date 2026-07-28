/**
 * Modal de crear/editar evento.
 *
 * API pública:
 *   EventoForm.open({ evento, onSaved })
 *     - evento: si se pasa, modo editar; si no, modo crear.
 *     - onSaved(evento): callback al guardar exitoso.
 *
 * Campos:
 *   - nombre (requerido)
 *   - fecha (date, requerido, puede ser pasada o futura)
 *   - sede (requerido)
 *
 * Para cambiar estatus se usa el dropdown en cada card del listado, no
 * desde aquí (mantiene este formulario simple).
 *
 * Reusa los estilos modal-* / form-* del modal de atletas.
 */
(function (root) {
  "use strict";

  var refs = {
    overlay: null,
    dialog: null,
    form: null,
    title: null,
    btnCancel: null,
    btnSave: null,
    errorBanner: null,
  };

  var state = {
    mode: "create",
    evento: null,
    saving: false,
    onSaved: null,
  };

  function open(opts) {
    opts = opts || {};
    state.mode = opts.evento ? "edit" : "create";
    state.evento = opts.evento || null;
    state.saving = false;
    state.onSaved = typeof opts.onSaved === "function" ? opts.onSaved : null;

    ensureUI_();
    populateForm_();
    showOverlay_();
  }

  function close() {
    if (refs.overlay) refs.overlay.classList.remove("is-open");
    document.removeEventListener("keydown", onKeyDown_);
  }

  // ----------------------------------------------------------

  function ensureUI_() {
    if (refs.overlay) return;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    var dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "evento-form-title");

    dialog.innerHTML =
      '<header class="modal-header">' +
      '<h2 id="evento-form-title">Evento</h2>' +
      '<button type="button" class="modal-close" aria-label="Cerrar">×</button>' +
      "</header>" +
      '<div class="modal-error" hidden></div>' +
      '<form class="modal-form" novalidate>' +
      '<div class="form-grid">' +
      '<label class="form-field form-field-full">' +
      '<span class="form-label">Nombre del evento *</span>' +
      '<input name="nombre" type="text" required autocomplete="off" placeholder="Campeonato Estatal Agosto 2026" />' +
      '<small class="form-error" hidden></small>' +
      "</label>" +
      '<label class="form-field">' +
      '<span class="form-label">Fecha *</span>' +
      '<input name="fecha" type="date" required />' +
      '<small class="form-hint">Puede ser pasada o futura.</small>' +
      '<small class="form-error" hidden></small>' +
      "</label>" +
      '<label class="form-field">' +
      '<span class="form-label">Sede *</span>' +
      '<input name="sede" type="text" required placeholder="Jaula Principal — Ciudad Juárez" />' +
      '<small class="form-error" hidden></small>' +
      "</label>" +
      "</div>" +
      "</form>" +
      '<footer class="modal-footer">' +
      '<div class="modal-footer-right">' +
      '<button type="button" class="btn btn-cancel">Cancelar</button>' +
      '<button type="button" class="btn btn-primary btn-save">Guardar</button>' +
      "</div>" +
      "</footer>";

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var form = dialog.querySelector(".modal-form");
    var saveBtn = dialog.querySelector(".btn-save");
    saveBtn.addEventListener("click", function (e) {
      e.preventDefault();
      submit_();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit_();
    });
    dialog.querySelector(".modal-close").addEventListener("click", close);
    dialog.querySelector(".btn-cancel").addEventListener("click", close);

    refs.overlay = overlay;
    refs.dialog = dialog;
    refs.form = form;
    refs.title = dialog.querySelector("#evento-form-title");
    refs.btnCancel = dialog.querySelector(".btn-cancel");
    refs.btnSave = saveBtn;
    refs.errorBanner = dialog.querySelector(".modal-error");
  }

  function populateForm_() {
    var f = refs.form;
    f.reset();
    clearErrors_();
    hideError_();

    if (state.mode === "edit" && state.evento) {
      var e = state.evento;
      refs.title.textContent = "Editar evento · " + (e.id || "");
      setVal_(f, "nombre", e.nombre);
      setVal_(f, "fecha", e.fecha);
      setVal_(f, "sede", e.sede);
      refs.btnSave.textContent = "Guardar cambios";
    } else {
      refs.title.textContent = "Nuevo evento";
      refs.btnSave.textContent = "Crear evento";
    }
  }

  function showOverlay_() {
    refs.overlay.classList.add("is-open");
    document.addEventListener("keydown", onKeyDown_);
    setTimeout(function () {
      var first = refs.form.querySelector('input[name="nombre"]');
      if (first) first.focus();
    }, 50);
  }

  function onKeyDown_(e) {
    if (e.key === "Escape") close();
  }

  // ----------------------------------------------------------

  async function submit_() {
    if (state.saving) return;
    clearErrors_();
    hideError_();

    var p = {
      nombre: getVal_(refs.form, "nombre").trim(),
      fecha: getVal_(refs.form, "fecha"),
      sede: getVal_(refs.form, "sede").trim(),
    };

    var errors = {};
    if (!p.nombre) errors.nombre = "Requerido";
    if (!p.fecha) errors.fecha = "Requerido";
    else {
      var d = new Date(p.fecha);
      if (isNaN(d.getTime())) errors.fecha = "Fecha inválida";
      else if (d.getFullYear() < 1900 || d.getFullYear() > 2100)
        errors.fecha = "Año fuera de rango (1900–2100)";
    }
    if (!p.sede) errors.sede = "Requerido";

    if (Object.keys(errors).length) {
      showFieldErrors_(errors);
      return;
    }

    state.saving = true;
    refs.btnSave.disabled = true;
    refs.btnCancel.disabled = true;
    refs.btnSave.textContent =
      state.mode === "edit" ? "Guardando..." : "Creando...";

    try {
      var res;
      if (state.mode === "edit") {
        p.id = state.evento.id;
        res = await root.api.post("eventos.update", p);
      } else {
        res = await root.api.post("eventos.create", p);
      }
      close();
      if (state.onSaved) state.onSaved(res && res.evento);
    } catch (err) {
      showBannerError_(err && err.message ? err.message : String(err));
    } finally {
      state.saving = false;
      refs.btnSave.disabled = false;
      refs.btnCancel.disabled = false;
      refs.btnSave.textContent =
        state.mode === "edit" ? "Guardar cambios" : "Crear evento";
    }
  }

  // ----------------------------------------------------------

  function showFieldErrors_(errors) {
    Object.keys(errors).forEach(function (name) {
      var field = refs.form.querySelector('[name="' + name + '"]');
      if (!field) return;
      var wrap = field.closest(".form-field");
      var errEl = wrap && wrap.querySelector(".form-error");
      if (errEl) {
        errEl.textContent = errors[name];
        errEl.hidden = false;
      }
      if (wrap) wrap.classList.add("has-error");
    });
    var firstKey = Object.keys(errors)[0];
    var first = refs.form.querySelector('[name="' + firstKey + '"]');
    if (first && first.focus) first.focus();
  }

  function clearErrors_() {
    refs.form.querySelectorAll(".form-error").forEach(function (el) {
      el.textContent = "";
      el.hidden = true;
    });
    refs.form.querySelectorAll(".form-field").forEach(function (el) {
      el.classList.remove("has-error");
    });
  }

  function showBannerError_(msg) {
    refs.errorBanner.textContent = msg;
    refs.errorBanner.hidden = false;
  }
  function hideError_() {
    refs.errorBanner.textContent = "";
    refs.errorBanner.hidden = true;
  }

  function setVal_(form, name, val) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    el.value = val == null ? "" : String(val);
  }
  function getVal_(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? String(el.value || "") : "";
  }

  root.EventoForm = { open: open, close: close };
})(typeof window !== "undefined" ? window : globalThis);
