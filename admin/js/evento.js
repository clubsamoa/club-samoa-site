/**
 * Controller de admin/evento.html?id=evt_XXX.
 *
 * - Lee ?id=X de la URL.
 * - Carga el evento via api.eventos.get.
 * - Renderiza el header (nombre, fecha, sede).
 * - Gestiona switching de tabs (Detalle / Inscripciones / Pesaje / Brackets).
 * - Renderiza la tab "Detalle" inline.
 * - Dispatcha a módulos externos cuando se activan otras tabs:
 *     - inscripciones → window.EventoInscripciones.init(...)
 *     - pesaje → (T12)
 *     - brackets → (T13+)
 *
 * Requiere: api.js, eventos-form.js (para editar), inscripciones-form.js,
 *           evento-inscripciones.js cargados antes.
 */
(function () {
  "use strict";

  var state = {
    eventoId: null,
    evento: null,
    activeTab: "detalle",
    initedTabs: {},
  };

  var els = {
    headerH1: null,
    headerSub: null,
    tabs: null,
    panels: null,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 0);
  }

  async function init() {
    var params = new URLSearchParams(location.search);
    state.eventoId = params.get("id");

    cacheEls();
    if (!state.eventoId) {
      renderError("Falta el parámetro <code>?id=evt_XXX</code> en la URL.");
      return;
    }
    bindTabs();
    bindActions();

    try {
      var res = await window.api.get("eventos.get", { id: state.eventoId });
      state.evento = res.evento;
      updateHeader();
      renderDetalle();
      activateInitialTab();
    } catch (err) {
      renderError(err && err.message ? err.message : String(err));
    }
  }

  function cacheEls() {
    els.headerH1 = document.querySelector(".admin-main-header h1");
    els.headerSub = document.querySelector(".admin-main-header .admin-subtitle");
    els.tabs = document.querySelectorAll(".evento-tab[data-tab]");
    els.panels = document.querySelectorAll(".evento-tab-panel[data-panel]");
  }

  function bindTabs() {
    els.tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        switchTab(btn.dataset.tab);
      });
    });
    window.addEventListener("hashchange", function () {
      var t = location.hash.replace("#", "");
      if (t) switchTab(t);
    });
  }

  function bindActions() {
    var btnEdit = document.getElementById("btn-editar-evento");
    if (btnEdit) {
      btnEdit.addEventListener("click", function () {
        if (!window.EventoForm || !state.evento) return;
        window.EventoForm.open({
          evento: state.evento,
          onSaved: function (updated) {
            state.evento = updated;
            updateHeader();
            renderDetalle();
          },
        });
      });
    }

    var selEstatus = document.getElementById("sel-estatus");
    if (selEstatus) {
      selEstatus.addEventListener("change", async function () {
        var prev = state.evento.estatus;
        var nuevo = selEstatus.value;
        selEstatus.disabled = true;
        try {
          await window.api.post("eventos.setestatus", {
            id: state.eventoId,
            estatus: nuevo,
          });
          state.evento.estatus = nuevo;
          renderDetalle();
        } catch (err) {
          alert("No se pudo cambiar el estatus: " + (err.message || err));
          selEstatus.value = prev;
        } finally {
          selEstatus.disabled = false;
        }
      });
    }

    var btnDelete = document.getElementById("btn-eliminar-evento");
    if (btnDelete) {
      btnDelete.addEventListener("click", confirmDeleteEvento);
    }
  }

  /**
   * Eliminar evento (hard delete con cascade).
   * Requiere que el operador escriba el nombre exacto del evento para confirmar.
   */
  async function confirmDeleteEvento() {
    if (!state.evento) return;
    var ev = state.evento;

    var msg =
      "⚠️ ELIMINAR EVENTO PERMANENTEMENTE\n\n" +
      "Vas a borrar:\n" +
      "  • El evento \"" + ev.nombre + "\"\n" +
      "  • Todas sus inscripciones de atletas\n" +
      "  • Todos los brackets generados\n" +
      "  • Todas las peleas con sus resultados\n\n" +
      "Esta acción NO se puede deshacer desde la app.\n" +
      "(Sí queda en el historial de revisiones de Google Sheets.)\n\n" +
      "Para confirmar, escribe el nombre del evento exacto:";

    var typed = window.prompt(msg, "");
    if (typed === null) return; // canceló
    if (String(typed).trim() !== String(ev.nombre).trim()) {
      alert("El nombre no coincide. No se eliminó nada.");
      return;
    }

    var btn = document.getElementById("btn-eliminar-evento");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Eliminando…";
    }

    try {
      var res = await window.api.post("eventos.delete", { id: state.eventoId });
      var d = (res && res.deleted) || {};
      alert(
        "Evento eliminado.\n\n" +
        "  • " + (d.evento || 0) + " evento\n" +
        "  • " + (d.inscripciones || 0) + " inscripciones\n" +
        "  • " + (d.brackets || 0) + " brackets\n" +
        "  • " + (d.peleas || 0) + " peleas",
      );
      window.location.href = "./eventos.html";
    } catch (err) {
      alert("Error al eliminar: " + (err.message || err));
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🗑 Eliminar";
      }
    }
  }

  function switchTab(name) {
    if (!name) return;
    var btn = document.querySelector('.evento-tab[data-tab="' + name + '"]');
    if (!btn || btn.disabled) return;
    if (name === state.activeTab) return;

    state.activeTab = name;
    els.tabs.forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.tab === name);
    });
    els.panels.forEach(function (p) {
      var match = p.dataset.panel === name;
      p.classList.toggle("is-active", match);
      // El atributo hidden tiene mayor especificidad que .is-active,
      // así que también hay que togglearlo manualmente.
      if (match) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
    });

    if (!state.initedTabs[name]) {
      initTab(name);
      state.initedTabs[name] = true;
    }
    // Update URL hash for deep linking
    try { history.replaceState(null, "", "#" + name); } catch (e) {}
  }

  function initTab(name) {
    var panel = document.querySelector('.evento-tab-panel[data-panel="' + name + '"]');
    if (!panel) return;
    if (name === "inscripciones" && window.EventoInscripciones) {
      window.EventoInscripciones.init({
        eventoId: state.eventoId,
        evento: state.evento,
        panel: panel,
      });
    } else if (name === "pesaje" && window.EventoPesaje) {
      window.EventoPesaje.init({
        eventoId: state.eventoId,
        evento: state.evento,
        panel: panel,
      });
    } else if (name === "brackets" && window.EventoBrackets) {
      window.EventoBrackets.init({
        eventoId: state.eventoId,
        evento: state.evento,
        panel: panel,
      });
    } else if (name === "resumen" && window.EventoResumen) {
      window.EventoResumen.init({
        eventoId: state.eventoId,
        evento: state.evento,
        panel: panel,
      });
    }
  }

  function activateInitialTab() {
    state.initedTabs.detalle = true; // detalle ya está renderizado
    var hash = location.hash.replace("#", "");
    if (hash && document.querySelector('.evento-tab[data-tab="' + hash + '"]:not([disabled])')) {
      switchTab(hash);
    }
  }

  function updateHeader() {
    if (!state.evento) return;
    // Re-query: shell.js inyecta .admin-main-header DESPUÉS de que
    // evento.js corre su init, así que el cache de cacheEls puede
    // estar vacío. Buscamos en vivo.
    var h1 = els.headerH1 || document.querySelector(".admin-main-header h1");
    var sub = els.headerSub || document.querySelector(".admin-main-header .admin-subtitle");
    if (h1) h1.textContent = state.evento.nombre || state.evento.id;
    if (sub) {
      sub.textContent =
        formatFecha(state.evento.fecha) + " · " + (state.evento.sede || "—");
    }
    document.title = (state.evento.nombre || "Evento") + " · Admin · Club Samoa";
  }

  function renderDetalle() {
    var panel = document.querySelector('.evento-tab-panel[data-panel="detalle"]');
    if (!panel || !state.evento) return;
    var ev = state.evento;

    var estatusOptions = ["borrador", "activo", "finalizado"]
      .map(function (s) {
        return '<option value="' + s + '"' + (ev.estatus === s ? " selected" : "") + ">" +
          s.charAt(0).toUpperCase() + s.slice(1) + "</option>";
      })
      .join("");

    panel.innerHTML =
      '<div class="card">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:16px; flex-wrap:wrap;">' +
      '<h3 style="margin:0; font-family:Anton,Oswald,sans-serif; letter-spacing:0.04em; text-transform:uppercase; font-size:18px;">Detalle del evento</h3>' +
      '<div style="display:flex; gap:8px;">' +
      '<button id="btn-editar-evento" class="btn btn-ghost btn-sm">✏️ Editar</button>' +
      '<button id="btn-eliminar-evento" class="btn btn-danger btn-sm">🗑 Eliminar</button>' +
      "</div>" +
      "</div>" +
      '<dl class="evento-detalle-dl">' +
      row("ID", ev.id) +
      row("Nombre", ev.nombre) +
      row("Fecha", formatFecha(ev.fecha)) +
      row("Sede", ev.sede) +
      row("Estatus", '<select id="sel-estatus" class="estatus-select">' + estatusOptions + "</select>") +
      row("Creado", ev.creado_en ? new Date(ev.creado_en).toLocaleString("es-MX") : "—") +
      "</dl>" +
      "</div>";

    // Re-bind acciones (los elementos se acaban de crear)
    bindActions();
  }

  function row(label, value) {
    if (value === null || value === undefined || value === "") value = "—";
    var raw = typeof value === "string" && value.indexOf("<") === 0;
    return (
      '<div class="evento-detalle-row">' +
      "<dt>" + escapeHtml(label) + "</dt>" +
      "<dd>" + (raw ? value : escapeHtml(String(value))) + "</dd>" +
      "</div>"
    );
  }

  function renderError(msg) {
    var panel = document.querySelector('.evento-tab-panel[data-panel="detalle"]');
    if (!panel) return;
    panel.innerHTML =
      '<div class="error-state">' +
      "<h3>No pudimos cargar el evento</h3>" +
      "<p>" + msg + "</p>" +
      "</div>";
  }

  function formatFecha(iso) {
    if (!iso) return "—";
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(iso);
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    try {
      return d.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      return String(iso);
    }
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
})();
