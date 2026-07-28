/**
 * Listado de eventos (admin/eventos.html).
 *
 * - Carga eventos desde el backend via api.eventos.list.
 * - Render en grid de cards.
 * - Filtro por estatus (toggle: Todos / Borrador / Activo / Finalizado).
 * - Cada card permite:
 *     - Cambiar estatus (dropdown inline)
 *     - Editar (modal)
 *     - Abrir (navega a evento.html?id=X)
 *
 * Requiere: api.js, eventos-form.js cargados antes.
 */
(function () {
  "use strict";

  var ESTATUS = ["borrador", "activo", "finalizado"];

  var ESTATUS_LABEL = {
    borrador: "Borrador",
    activo: "Activo",
    finalizado: "Finalizado",
  };

  var state = {
    eventos: [],
    loading: false,
    error: null,
    filterEstatus: "activo",
  };

  var els = {
    list: null,
    count: null,
    btnNuevo: null,
    estatusButtons: null,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 0);
  }

  function init() {
    cacheEls();
    if (!els.list) return;
    bindFilters();
    bindActions();
    render();
    loadEventos();
  }

  function cacheEls() {
    els.list = document.getElementById("eventos-list");
    els.count = document.getElementById("eventos-count");
    els.btnNuevo = document.getElementById("btn-nuevo-evento");
    els.estatusButtons = document.querySelectorAll('[data-filter="estatus"]');
  }

  function bindFilters() {
    if (!els.estatusButtons) return;
    els.estatusButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filterEstatus = btn.dataset.value || "";
        els.estatusButtons.forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        render();
      });
    });
  }

  function bindActions() {
    if (els.btnNuevo && window.EventoForm) {
      els.btnNuevo.addEventListener("click", function () {
        window.EventoForm.open({ onSaved: loadEventos });
      });
    }
    if (!els.list) return;
    els.list.addEventListener("click", function (e) {
      // Editar
      var btnEdit = e.target.closest('[data-action="editar"]');
      if (btnEdit) {
        e.preventDefault();
        e.stopPropagation();
        var card = btnEdit.closest(".event-card");
        var ev = state.eventos.find(function (x) { return x.id === card.dataset.id; });
        if (ev && window.EventoForm) {
          window.EventoForm.open({ evento: ev, onSaved: loadEventos });
        }
        return;
      }
      // Abrir
      var btnOpen = e.target.closest('[data-action="abrir"]');
      if (btnOpen) {
        var cardOpen = btnOpen.closest(".event-card");
        var id = cardOpen && cardOpen.dataset.id;
        if (id) window.location.href = "./evento.html?id=" + encodeURIComponent(id);
        return;
      }
      // Card click → abrir (excepto si el clic fue en un control)
      var card = e.target.closest(".event-card");
      if (card && !e.target.closest(".event-card-controls")) {
        var id2 = card.dataset.id;
        if (id2) window.location.href = "./evento.html?id=" + encodeURIComponent(id2);
      }
    });

    // Cambio de estatus (delegación en change)
    els.list.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-action='estatus']");
      if (!sel) return;
      var card = sel.closest(".event-card");
      var id = card && card.dataset.id;
      var nuevo = sel.value;
      if (!id) return;
      changeEstatus(id, nuevo, sel);
    });
  }

  async function changeEstatus(id, nuevo, selEl) {
    var prev = state.eventos.find(function (e) { return e.id === id; });
    if (!prev) return;
    var prevValue = prev.estatus;
    selEl.disabled = true;
    try {
      await window.api.post("eventos.setestatus", { id: id, estatus: nuevo });
      prev.estatus = nuevo;
      render();
    } catch (err) {
      alert("No se pudo cambiar el estatus: " + (err && err.message ? err.message : err));
      selEl.value = prevValue;
    } finally {
      selEl.disabled = false;
    }
  }

  async function loadEventos() {
    state.loading = true;
    state.error = null;
    render();
    try {
      var res = await window.api.get("eventos.list");
      state.eventos = (res && res.eventos) || [];
      state.loading = false;
      render();
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : String(err);
      render();
    }
  }

  function applyFilters(eventos) {
    if (!state.filterEstatus) return eventos.slice();
    return eventos.filter(function (e) {
      return e.estatus === state.filterEstatus;
    });
  }

  function render() {
    if (!els.list) return;
    if (state.loading) {
      els.list.innerHTML = "";
      els.list.appendChild(makeMessage("Cargando eventos..."));
      if (els.count) els.count.textContent = "";
      return;
    }
    if (state.error) {
      els.list.innerHTML = "";
      els.list.appendChild(makeError(state.error));
      if (els.count) els.count.textContent = "";
      return;
    }

    var visible = applyFilters(state.eventos);
    if (els.count) {
      var n = visible.length, total = state.eventos.length;
      els.count.textContent =
        n === total
          ? n + " evento" + (n === 1 ? "" : "s")
          : n + " de " + total;
    }
    if (state.eventos.length === 0) {
      els.list.innerHTML = "";
      els.list.appendChild(makeEmpty());
      return;
    }
    if (visible.length === 0) {
      els.list.innerHTML = "";
      els.list.appendChild(makeNoResults());
      return;
    }

    var grid = document.createElement("div");
    grid.className = "event-grid";
    visible.forEach(function (ev) {
      grid.appendChild(renderCard(ev));
    });
    els.list.innerHTML = "";
    els.list.appendChild(grid);
  }

  function renderCard(ev) {
    var card = document.createElement("article");
    card.className = "event-card";
    card.dataset.id = ev.id;
    card.dataset.estatus = ev.estatus || "borrador";
    card.tabIndex = 0;

    var estatusPill =
      '<span class="estatus-pill estatus-' + escapeAttr(ev.estatus || "borrador") + '">' +
      escapeHtml(ESTATUS_LABEL[ev.estatus] || ev.estatus || "borrador") +
      "</span>";

    var fecha = formatFecha(ev.fecha);
    var sede = escapeHtml(ev.sede || "");

    var optionsHtml = ESTATUS.map(function (s) {
      return '<option value="' + s + '"' + (ev.estatus === s ? " selected" : "") + ">" +
        escapeHtml(ESTATUS_LABEL[s]) + "</option>";
    }).join("");

    card.innerHTML =
      '<header class="event-card-header">' +
      estatusPill +
      '<button class="event-card-edit" data-action="editar" title="Editar evento" aria-label="Editar">✏️</button>' +
      "</header>" +
      '<h3 class="event-card-title">' + escapeHtml(ev.nombre || "(sin nombre)") + "</h3>" +
      '<dl class="event-card-meta">' +
      '<div><dt>📅</dt><dd>' + fecha + "</dd></div>" +
      '<div><dt>📍</dt><dd>' + sede + "</dd></div>" +
      '<div class="event-card-id"><dt>#</dt><dd>' + escapeHtml(ev.id) + "</dd></div>" +
      "</dl>" +
      '<footer class="event-card-controls">' +
      '<label class="event-card-estatus">' +
      '<span>Estatus</span>' +
      '<select data-action="estatus">' + optionsHtml + "</select>" +
      "</label>" +
      '<button class="btn btn-primary btn-sm" data-action="abrir">Ver evento →</button>' +
      "</footer>";

    return card;
  }

  function formatFecha(iso) {
    if (!iso) return "—";
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return escapeHtml(String(iso));
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    try {
      return d.toLocaleDateString("es-MX", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      return escapeHtml(String(iso));
    }
  }

  function makeMessage(text) {
    var d = document.createElement("div");
    d.className = "loading-message";
    d.textContent = text;
    return d;
  }

  function makeError(text) {
    var wrap = document.createElement("div");
    wrap.className = "error-state";
    var h = document.createElement("h3");
    h.textContent = "No pudimos cargar los eventos";
    var p = document.createElement("p");
    p.textContent = text;
    var btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Reintentar";
    btn.addEventListener("click", loadEventos);
    wrap.appendChild(h);
    wrap.appendChild(p);
    wrap.appendChild(btn);
    return wrap;
  }

  function makeEmpty() {
    var wrap = document.createElement("div");
    wrap.className = "placeholder";
    wrap.innerHTML =
      '<span class="placeholder-tag">Sin eventos</span>' +
      "<h2>Todavía no hay eventos</h2>" +
      "<p>Crea tu primer evento con el botón <strong>+ Nuevo evento</strong> arriba a la derecha. Luego vas a poder inscribir atletas y generar brackets.</p>";
    return wrap;
  }

  function makeNoResults() {
    var wrap = document.createElement("div");
    wrap.className = "placeholder";
    wrap.innerHTML =
      '<span class="placeholder-tag">Sin coincidencias</span>' +
      "<h2>No hay eventos con este estatus</h2>" +
      "<p>Cambia el filtro a <strong>Todos</strong> o a otro estatus.</p>";
    return wrap;
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function escapeAttr(v) { return escapeHtml(v); }
})();
