/**
 * Modal de crear/editar/archivar atleta.
 *
 * API pública:
 *   AtletaForm.open({ atleta, onSaved, onArchived })
 *     - atleta: si se pasa, modo editar; si no, modo crear.
 *     - onSaved(atleta): callback al guardar exitoso.
 *     - onArchived(id): callback al archivar exitoso.
 *
 * Comportamiento:
 *   - Auto-sugiere nivel basado en años de práctica (con Reglamento.sugerirNivel).
 *   - El usuario puede sobreescribir el nivel sugerido.
 *   - Validaciones en cliente antes de enviar.
 *   - Cierra con backdrop click, ESC, o botón Cancelar.
 *   - Mientras guarda/archiva, muestra estado de loading.
 *
 * Requiere: api.js, reglamento.js cargados antes.
 */
(function (root) {
  "use strict";

  var refs = {
    overlay: null,
    dialog: null,
    form: null,
    title: null,
    btnArchive: null,
    btnCancel: null,
    btnSave: null,
    errorBanner: null,
  };

  var state = {
    mode: "create",
    atleta: null,
    saving: false,
    onSaved: null,
    onArchived: null,
    userTouchedNivel: false,
  };

  function open(opts) {
    opts = opts || {};
    state.mode = opts.atleta ? "edit" : "create";
    state.atleta = opts.atleta || null;
    state.saving = false;
    state.onSaved = typeof opts.onSaved === "function" ? opts.onSaved : null;
    state.onArchived =
      typeof opts.onArchived === "function" ? opts.onArchived : null;
    state.userTouchedNivel = !!opts.atleta;

    ensureUI_();
    populateForm_();
    showOverlay_();
  }

  function close() {
    if (refs.overlay) {
      refs.overlay.classList.remove("is-open");
      if (document.activeElement && refs.dialog && refs.dialog.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }
    document.removeEventListener("keydown", onKeyDown_);
  }

  function ensureUI_() {
    if (refs.overlay) return;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    var dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "atleta-form-title");

    dialog.innerHTML =
      '<header class="modal-header">' +
      '<h2 id="atleta-form-title">Atleta</h2>' +
      '<button type="button" class="modal-close" aria-label="Cerrar">×</button>' +
      "</header>" +
      '<div class="modal-error" hidden></div>' +
      '<form class="modal-form" novalidate>' +
      formFieldsHTML_() +
      "</form>" +
      '<footer class="modal-footer">' +
      '<button type="button" class="btn btn-ghost btn-archive" hidden>Archivar atleta</button>' +
      '<div class="modal-footer-right">' +
      '<button type="button" class="btn btn-cancel">Cancelar</button>' +
      '<button type="submit" form="" class="btn btn-primary btn-save">Guardar</button>' +
      "</div>" +
      "</footer>";

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var form = dialog.querySelector(".modal-form");
    var saveBtn = dialog.querySelector(".btn-save");
    saveBtn.removeAttribute("form");
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
    var archiveBtn = dialog.querySelector(".btn-archive");
    archiveBtn.addEventListener("click", confirmArchive_);

    var aniosInput = form.querySelector('[name="anios_practica"]');
    var nivelSelect = form.querySelector('[name="nivel"]');
    aniosInput.addEventListener("input", function () {
      if (state.userTouchedNivel) return;
      var sug = root.Reglamento && root.Reglamento.sugerirNivel
        ? root.Reglamento.sugerirNivel(parseFloat(aniosInput.value))
        : "";
      if (sug) nivelSelect.value = sug;
    });
    nivelSelect.addEventListener("change", function () {
      state.userTouchedNivel = true;
    });

    refs.overlay = overlay;
    refs.dialog = dialog;
    refs.form = form;
    refs.title = dialog.querySelector("#atleta-form-title");
    refs.btnArchive = archiveBtn;
    refs.btnCancel = dialog.querySelector(".btn-cancel");
    refs.btnSave = saveBtn;
    refs.errorBanner = dialog.querySelector(".modal-error");
  }

  function formFieldsHTML_() {
    return (
      '<div class="form-grid">' +
      field_("Nombre completo *", "nombre_completo", "text", { required: true, autocomplete: "name" }) +
      field_("Fecha de nacimiento *", "fecha_nacimiento", "date", { required: true }) +
      radioGroup_("Género *", "genero", ["Masculino", "Femenino"]) +
      field_("Años de práctica *", "anios_practica", "number", {
        required: true,
        step: "0.1",
        min: "0",
        hint: "Decimal. Ej. 1.5 = 1 año 6 meses. El nivel se sugiere automáticamente.",
      }) +
      select_("Nivel *", "nivel", ["Novato", "Principiante", "Intermedio", "Avanzado"], {
        required: true,
      }) +
      field_("Peso de referencia (kg) *", "peso_referencia_kg", "number", {
        required: true,
        step: "0.1",
        min: "0.1",
      }) +
      field_("Academia", "academia", "text", {}) +
      field_("País", "pais", "text", { value: "México" }) +
      field_("Foto URL", "foto_url", "url", {
        full: true,
        placeholder: "https://...",
      }) +
      "</div>"
    );
  }

  function field_(label, name, type, opts) {
    opts = opts || {};
    var attrs = [
      'name="' + name + '"',
      'type="' + type + '"',
      opts.required ? "required" : "",
      opts.step ? 'step="' + opts.step + '"' : "",
      opts.min ? 'min="' + opts.min + '"' : "",
      opts.value ? 'value="' + escapeAttr_(opts.value) + '"' : "",
      opts.placeholder ? 'placeholder="' + escapeAttr_(opts.placeholder) + '"' : "",
      opts.autocomplete ? 'autocomplete="' + opts.autocomplete + '"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    var hint = opts.hint
      ? '<small class="form-hint">' + escapeHtml_(opts.hint) + "</small>"
      : "";
    return (
      '<label class="form-field' + (opts.full ? " form-field-full" : "") + '">' +
      '<span class="form-label">' + escapeHtml_(label) + "</span>" +
      "<input " + attrs + " />" +
      hint +
      '<small class="form-error" hidden></small>' +
      "</label>"
    );
  }

  function radioGroup_(label, name, values) {
    var inputs = values
      .map(function (v) {
        return (
          '<label class="radio-pill">' +
          '<input type="radio" name="' + name + '" value="' + v + '" required />' +
          "<span>" + escapeHtml_(v) + "</span>" +
          "</label>"
        );
      })
      .join("");
    return (
      '<div class="form-field">' +
      '<span class="form-label">' + escapeHtml_(label) + "</span>" +
      '<div class="radio-group">' + inputs + "</div>" +
      '<small class="form-error" hidden></small>' +
      "</div>"
    );
  }

  function select_(label, name, values, opts) {
    opts = opts || {};
    var options = values
      .map(function (v) {
        return '<option value="' + v + '">' + escapeHtml_(v) + "</option>";
      })
      .join("");
    return (
      '<label class="form-field">' +
      '<span class="form-label">' + escapeHtml_(label) + "</span>" +
      '<select name="' + name + '"' + (opts.required ? " required" : "") + ">" +
      '<option value="">Selecciona...</option>' +
      options +
      "</select>" +
      '<small class="form-error" hidden></small>' +
      "</label>"
    );
  }

  function populateForm_() {
    var f = refs.form;
    f.reset();
    clearErrors_();
    hideError_();

    if (state.mode === "edit" && state.atleta) {
      var a = state.atleta;
      refs.title.textContent = "Editar atleta · " + (a.id || "");
      setVal_(f, "nombre_completo", a.nombre_completo);
      setVal_(f, "fecha_nacimiento", a.fecha_nacimiento);
      setVal_(f, "anios_practica", a.anios_practica);
      setVal_(f, "nivel", a.nivel);
      setVal_(f, "peso_referencia_kg", a.peso_referencia_kg);
      setVal_(f, "academia", a.academia);
      setVal_(f, "pais", a.pais || "México");
      setVal_(f, "foto_url", a.foto_url);
      setRadio_(f, "genero", a.genero);
      refs.btnArchive.hidden = false;
      refs.btnSave.textContent = "Guardar cambios";
    } else {
      refs.title.textContent = "Nuevo atleta";
      setVal_(f, "pais", "México");
      refs.btnArchive.hidden = true;
      refs.btnSave.textContent = "Guardar";
    }
  }

  function showOverlay_() {
    refs.overlay.classList.add("is-open");
    document.addEventListener("keydown", onKeyDown_);
    setTimeout(function () {
      var first = refs.form.querySelector('input[name="nombre_completo"]');
      if (first) first.focus();
    }, 50);
  }

  function onKeyDown_(e) {
    if (e.key === "Escape") close();
  }

  async function submit_() {
    if (state.saving) return;
    clearErrors_();
    hideError_();

    var payload = collectPayload_();
    var errors = validate_(payload);

    if (Object.keys(errors).length) {
      showFieldErrors_(errors);
      return;
    }

    state.saving = true;
    refs.btnSave.disabled = true;
    refs.btnCancel.disabled = true;
    refs.btnArchive.disabled = true;
    refs.btnSave.textContent =
      state.mode === "edit" ? "Guardando..." : "Creando...";

    try {
      var res;
      if (state.mode === "edit") {
        payload.id = state.atleta.id;
        res = await root.api.post("atletas.update", payload);
      } else {
        res = await root.api.post("atletas.create", payload);
      }
      close();
      if (state.onSaved) state.onSaved(res && res.atleta);
    } catch (err) {
      showBannerError_(err && err.message ? err.message : String(err));
    } finally {
      state.saving = false;
      refs.btnSave.disabled = false;
      refs.btnCancel.disabled = false;
      refs.btnArchive.disabled = false;
      refs.btnSave.textContent =
        state.mode === "edit" ? "Guardar cambios" : "Guardar";
    }
  }

  function collectPayload_() {
    var f = refs.form;
    var p = {
      nombre_completo: getVal_(f, "nombre_completo").trim(),
      fecha_nacimiento: getVal_(f, "fecha_nacimiento"),
      genero: getRadio_(f, "genero"),
      anios_practica: getVal_(f, "anios_practica"),
      nivel: getVal_(f, "nivel"),
      peso_referencia_kg: getVal_(f, "peso_referencia_kg"),
      academia: getVal_(f, "academia").trim(),
      pais: getVal_(f, "pais").trim() || "México",
      foto_url: getVal_(f, "foto_url").trim(),
    };
    if (p.anios_practica !== "") p.anios_practica = Number(p.anios_practica);
    if (p.peso_referencia_kg !== "")
      p.peso_referencia_kg = Number(p.peso_referencia_kg);
    return p;
  }

  function validate_(p) {
    var errors = {};
    if (!p.nombre_completo) errors.nombre_completo = "Requerido";
    if (!p.fecha_nacimiento) errors.fecha_nacimiento = "Requerido";
    else {
      var d = new Date(p.fecha_nacimiento);
      if (isNaN(d.getTime())) errors.fecha_nacimiento = "Fecha inválida";
      else if (d > new Date()) errors.fecha_nacimiento = "No puede ser futura";
      else if (d.getFullYear() < 1900) errors.fecha_nacimiento = "Año demasiado antiguo";
    }
    if (!p.genero) errors.genero = "Requerido";
    if (p.anios_practica === "" || p.anios_practica === null)
      errors.anios_practica = "Requerido";
    else if (!isFinite(p.anios_practica) || p.anios_practica < 0)
      errors.anios_practica = "Debe ser ≥ 0";
    if (!p.nivel) errors.nivel = "Requerido";
    if (p.peso_referencia_kg === "" || p.peso_referencia_kg === null)
      errors.peso_referencia_kg = "Requerido";
    else if (!isFinite(p.peso_referencia_kg) || p.peso_referencia_kg <= 0)
      errors.peso_referencia_kg = "Debe ser > 0";
    if (p.foto_url && !/^https?:\/\//.test(p.foto_url))
      errors.foto_url = "URL inválida (usa http:// o https://)";
    return errors;
  }

  async function confirmArchive_() {
    if (!state.atleta) return;
    var name = state.atleta.nombre_completo || state.atleta.id;
    var ok = window.confirm(
      "¿Archivar a " + name + "?\n\nDejará de aparecer en el listado y no podrá inscribirse a eventos. La fila no se elimina (puedes desarchivarla manualmente en la Sheet).",
    );
    if (!ok) return;

    if (state.saving) return;
    state.saving = true;
    refs.btnSave.disabled = true;
    refs.btnArchive.disabled = true;
    refs.btnCancel.disabled = true;
    var oldText = refs.btnArchive.textContent;
    refs.btnArchive.textContent = "Archivando...";

    try {
      await root.api.post("atletas.archive", { id: state.atleta.id });
      close();
      if (state.onArchived) state.onArchived(state.atleta.id);
    } catch (err) {
      showBannerError_(err && err.message ? err.message : String(err));
    } finally {
      state.saving = false;
      refs.btnSave.disabled = false;
      refs.btnArchive.disabled = false;
      refs.btnCancel.disabled = false;
      refs.btnArchive.textContent = oldText;
    }
  }

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
    var firstField = refs.form.querySelector('[name="' + firstKey + '"]');
    if (firstField && firstField.focus) firstField.focus();
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
    if (val === null || val === undefined) val = "";
    el.value = String(val);
  }
  function getVal_(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? String(el.value || "") : "";
  }
  function setRadio_(form, name, val) {
    var radios = form.querySelectorAll('[name="' + name + '"]');
    radios.forEach(function (r) {
      r.checked = r.value === val;
    });
  }
  function getRadio_(form, name) {
    var checked = form.querySelector('[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function escapeHtml_(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function escapeAttr_(v) {
    return escapeHtml_(v);
  }

  root.AtletaForm = {
    open: open,
    close: close,
  };
})(typeof window !== "undefined" ? window : globalThis);
