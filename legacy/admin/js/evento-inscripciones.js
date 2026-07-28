/**
 * Tab "Inscripciones" del detalle de evento.
 *
 * API pública:
 *   EventoInscripciones.init({ eventoId, evento, panel })
 *     - eventoId: ID del evento
 *     - evento: objeto con datos del evento (para mostrar nombre en el modal)
 *     - panel: el <section> DOM donde renderizamos
 *
 * Carga inscripciones via api.inscripciones.list, las renderiza en una
 * tabla, y permite agregar (modal InscripcionesForm) y quitar (delete).
 *
 * Requiere: api.js, inscripciones-form.js cargados antes.
 */
(function (root) {
  "use strict";

  var ESTATUS_LABEL = {
    pendiente_pesaje: "Pendiente de pesaje",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
  };

  var state = {
    eventoId: null,
    evento: null,
    panel: null,
    inscripciones: [],
    loading: false,
    error: null,
  };

  function init(opts) {
    state.eventoId = opts.eventoId;
    state.evento = opts.evento || null;
    state.panel = opts.panel;
    if (!state.panel) return;

    state.panel.innerHTML = buildSkeleton_();
    bindActions_();
    loadInscripciones();
  }

  function buildSkeleton_() {
    return (
      '<div class="inscripciones-toolbar">' +
      '<button type="button" class="btn btn-primary" id="btn-agregar-atletas">+ Agregar atletas</button>' +
      '<div class="toolbar-count" id="inscripciones-count" aria-live="polite"></div>' +
      "</div>" +
      '<div id="inscripciones-list" class="inscripciones-list">' +
      '<div class="loading-message">Cargando inscripciones...</div>' +
      "</div>"
    );
  }

  function bindActions_() {
    var btnAdd = state.panel.querySelector("#btn-agregar-atletas");
    if (btnAdd) {
      btnAdd.addEventListener("click", function () {
        if (!root.InscripcionesForm) {
          alert("InscripcionesForm no está disponible (revisa que esté cargado).");
          return;
        }
        var alreadyIds = state.inscripciones.map(function (i) { return i.atleta_id; });
        root.InscripcionesForm.open({
          eventoId: state.eventoId,
          eventoNombre: state.evento ? state.evento.nombre : "",
          alreadyIds: alreadyIds,
          onSaved: function (res) {
            // Notificar si hubo skipped
            if (res && res.count_skipped > 0) {
              console.warn("Inscripciones omitidas:", res.skipped);
            }
            loadInscripciones();
          },
        });
      });
    }

    state.panel.addEventListener("click", function (e) {
      var btnQuitar = e.target.closest('[data-action="quitar"]');
      if (btnQuitar) {
        var tr = btnQuitar.closest("[data-id]");
        var id = tr && tr.dataset.id;
        if (id) quitar(id);
      }
    });
  }

  async function loadInscripciones() {
    state.loading = true;
    state.error = null;
    render_();
    try {
      var res = await root.api.get("inscripciones.list", { evento_id: state.eventoId });
      state.inscripciones = res.inscripciones || [];
      state.loading = false;
      render_();
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : String(err);
      render_();
    }
  }

  async function quitar(insId) {
    var ins = state.inscripciones.find(function (i) { return i.id === insId; });
    var name = ins && ins.atleta ? ins.atleta.nombre_completo : insId;
    if (!window.confirm("¿Quitar a " + name + " del evento?\n\nEsto elimina la inscripción. Puedes volver a inscribirlo después.")) {
      return;
    }
    try {
      await root.api.post("inscripciones.delete", { id: insId });
      loadInscripciones();
    } catch (err) {
      alert("Error al quitar: " + (err && err.message ? err.message : err));
    }
  }

  function render_() {
    var list = state.panel.querySelector("#inscripciones-list");
    var count = state.panel.querySelector("#inscripciones-count");
    if (!list) return;

    if (state.loading) {
      list.innerHTML = '<div class="loading-message">Cargando inscripciones...</div>';
      if (count) count.textContent = "";
      return;
    }
    if (state.error) {
      list.innerHTML =
        '<div class="error-state">' +
        "<h3>No pudimos cargar las inscripciones</h3>" +
        "<p>" + escapeHtml_(state.error) + "</p>" +
        "</div>";
      if (count) count.textContent = "";
      return;
    }

    var n = state.inscripciones.length;
    if (count) count.textContent = n + " inscrito" + (n === 1 ? "" : "s");

    if (n === 0) {
      list.innerHTML =
        '<div class="placeholder">' +
        '<span class="placeholder-tag">Sin atletas</span>' +
        "<h2>Aún no hay atletas inscritos</h2>" +
        "<p>Click en <strong>+ Agregar atletas</strong> arriba para inscribir competidores desde tu catálogo. Cuando los inscribas, el sistema calcula automáticamente su categoría (división + género + nivel + peso).</p>" +
        "</div>";
      return;
    }

    var html =
      '<div class="table-wrap">' +
      '<table class="data-table">' +
      "<thead><tr>" +
      "<th>Atleta</th>" +
      "<th>Género</th>" +
      "<th>Nivel</th>" +
      "<th>Categoría calculada</th>" +
      '<th class="num">Peso pesaje</th>' +
      "<th>Estatus</th>" +
      '<th class="actions"></th>' +
      "</tr></thead><tbody>";
    state.inscripciones.forEach(function (ins) {
      html += renderRow_(ins);
    });
    html += "</tbody></table></div>";
    list.innerHTML = html;
  }

  function renderRow_(ins) {
    var a = ins.atleta || {};
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
    var peso = ins.peso_pesaje_kg && Number(ins.peso_pesaje_kg) > 0
      ? Number(ins.peso_pesaje_kg) + " kg"
      : '<span style="color:var(--muted-2); font-style:italic;">pendiente</span>';
    var estatus = '<span class="estatus-pill estatus-' + escapeAttr_(ins.estatus || "pendiente_pesaje") + '">' +
      escapeHtml_(ESTATUS_LABEL[ins.estatus] || ins.estatus || "—") +
      "</span>";
    var categoria = ins.categoria_calculada || "—";

    return (
      '<tr data-id="' + escapeAttr_(ins.id) + '">' +
      '<td><div class="atleta-cell">' + photo +
      '<div class="atleta-info"><strong>' + escapeHtml_(a.nombre_completo || "(sin nombre)") + "</strong>" +
      (a.academia ? '<span class="atleta-pais">' + escapeHtml_(a.academia) + "</span>" : "") +
      "</div></div></td>" +
      "<td>" + genero + "</td>" +
      "<td>" + nivel + "</td>" +
      '<td><code class="categoria-cell">' + escapeHtml_(categoria) + "</code></td>" +
      '<td class="num">' + peso + "</td>" +
      "<td>" + estatus + "</td>" +
      '<td class="actions"><button class="btn btn-ghost btn-sm" data-action="quitar" title="Quitar del evento">Quitar</button></td>' +
      "</tr>"
    );
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

  root.EventoInscripciones = { init: init };
})(typeof window !== "undefined" ? window : globalThis);
