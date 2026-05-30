/**
 * Listado de atletas (admin/atletas.html).
 *
 * - Carga atletas desde el backend via api.atletas.list.
 * - Calcula edad y división por edad en cliente (usando reglamento.js)
 *   tomando como referencia la fecha de hoy.
 * - Filtros: género (botones toggle), nivel (dropdown), búsqueda por
 *   nombre o academia.
 * - Estados: loading, empty (sin atletas en backend), no-results (filtros
 *   no matchean nada), error.
 *
 * Requiere: api.js, reglamento.js, shell.js cargados antes de este script.
 */
(function () {
  "use strict";

  var state = {
    atletas: [],
    loading: false,
    error: null,
    filters: { genero: "", nivel: "", search: "" },
  };

  var els = {
    list: null,
    count: null,
    search: null,
    nivelSelect: null,
    generoButtons: null,
    btnNuevo: null,
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
    loadAtletas();
  }

  function cacheEls() {
    els.list = document.getElementById("atletas-list");
    els.count = document.getElementById("atletas-count");
    els.search = document.getElementById("filter-search");
    els.nivelSelect = document.getElementById("filter-nivel");
    els.generoButtons = document.querySelectorAll('[data-filter="genero"]');
    els.btnNuevo = document.getElementById("btn-nuevo-atleta");
  }

  function bindActions() {
    if (els.btnNuevo && window.AtletaForm) {
      els.btnNuevo.addEventListener("click", function () {
        window.AtletaForm.open({ onSaved: loadAtletas });
      });
    }
    // Delegación de eventos: el botón Editar en cada fila.
    if (els.list) {
      els.list.addEventListener("click", function (e) {
        var btn = e.target.closest('[data-action="editar"]');
        if (!btn) return;
        var tr = btn.closest("tr");
        var id = tr && tr.dataset.id;
        if (!id || !window.AtletaForm) return;
        var atleta = state.atletas.find(function (a) {
          return a.id === id;
        });
        if (!atleta) return;
        window.AtletaForm.open({
          atleta: atleta,
          onSaved: loadAtletas,
          onArchived: loadAtletas,
        });
      });
    }
  }

  function bindFilters() {
    if (els.search) {
      els.search.addEventListener("input", function (e) {
        state.filters.search = e.target.value.trim().toLowerCase();
        render();
      });
    }
    if (els.nivelSelect) {
      els.nivelSelect.addEventListener("change", function (e) {
        state.filters.nivel = e.target.value;
        render();
      });
    }
    if (els.generoButtons && els.generoButtons.length) {
      els.generoButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.filters.genero = btn.dataset.value || "";
          els.generoButtons.forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
          render();
        });
      });
    }
  }

  async function loadAtletas() {
    state.loading = true;
    state.error = null;
    render();
    try {
      var res = await window.api.get("atletas.list");
      state.atletas = (res && res.atletas) || [];
      state.loading = false;
      render();
    } catch (err) {
      state.loading = false;
      state.error = err && err.message ? err.message : String(err);
      render();
    }
  }

  function applyFilters(atletas) {
    var f = state.filters;
    return atletas.filter(function (a) {
      if (f.genero && a.genero !== f.genero) return false;
      if (f.nivel && a.nivel !== f.nivel) return false;
      if (f.search) {
        var hay =
          (a.nombre_completo || "").toLowerCase() +
          " " +
          (a.academia || "").toLowerCase();
        if (hay.indexOf(f.search) < 0) return false;
      }
      return true;
    });
  }

  function render() {
    if (!els.list) return;

    if (state.loading) {
      els.list.innerHTML = "";
      els.list.appendChild(makeMessage("Cargando atletas..."));
      if (els.count) els.count.textContent = "";
      return;
    }
    if (state.error) {
      els.list.innerHTML = "";
      els.list.appendChild(makeError(state.error));
      if (els.count) els.count.textContent = "";
      return;
    }

    var visible = applyFilters(state.atletas);

    if (els.count) {
      var n = visible.length;
      var total = state.atletas.length;
      els.count.textContent =
        n === total
          ? n + " atleta" + (n === 1 ? "" : "s")
          : n + " de " + total;
    }

    if (state.atletas.length === 0) {
      els.list.innerHTML = "";
      els.list.appendChild(makeEmptyState());
      return;
    }
    if (visible.length === 0) {
      els.list.innerHTML = "";
      els.list.appendChild(makeNoResults());
      return;
    }

    renderTable(visible);
  }

  function renderTable(atletas) {
    var hoy = todayISO();
    var fragment = document.createDocumentFragment();
    var wrap = document.createElement("div");
    wrap.className = "table-wrap";

    var table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML =
      "<thead><tr>" +
      "<th>Atleta</th>" +
      "<th>Género</th>" +
      "<th>Edad</th>" +
      "<th>División</th>" +
      "<th>Nivel</th>" +
      "<th class='num'>Peso ref.</th>" +
      "<th>Academia</th>" +
      "<th class='actions'></th>" +
      "</tr></thead>" +
      "<tbody></tbody>";

    var tbody = table.querySelector("tbody");
    atletas.forEach(function (a) {
      tbody.appendChild(renderRow(a, hoy));
    });

    wrap.appendChild(table);
    fragment.appendChild(wrap);

    els.list.innerHTML = "";
    els.list.appendChild(fragment);
  }

  function renderRow(a, hoy) {
    var tr = document.createElement("tr");
    tr.dataset.id = a.id;

    var division = "";
    var edad = "";
    try {
      if (a.fecha_nacimiento) {
        edad = calcularEdad(a.fecha_nacimiento, hoy);
        division = window.Reglamento.calcularDivisionEdad(a.fecha_nacimiento, hoy) || "—";
      }
    } catch (e) {
      /* noop */
    }

    tr.innerHTML =
      "<td>" + atletaCell(a) + "</td>" +
      "<td>" + generoBadge(a.genero) + "</td>" +
      "<td class='num'>" + (edad === "" ? "—" : edad) + "</td>" +
      "<td>" + (division ? '<span class="badge badge-division">' + escapeHtml(division) + "</span>" : "—") + "</td>" +
      "<td>" + nivelBadge(a.nivel) + "</td>" +
      "<td class='num'>" + (a.peso_referencia_kg != null ? a.peso_referencia_kg + " kg" : "—") + "</td>" +
      "<td>" + escapeHtml(a.academia || "") + "</td>" +
      "<td class='actions'><button class='btn btn-ghost btn-sm' data-action='editar' title='Editar atleta'>Editar</button></td>";

    return tr;
  }

  function atletaCell(a) {
    var name = escapeHtml(a.nombre_completo || "(sin nombre)");
    var initials = initialsOf(a.nombre_completo || "?");
    var photo =
      a.foto_url && /^https?:/.test(a.foto_url)
        ? '<img class="avatar" src="' + escapeAttr(a.foto_url) + '" alt="" />'
        : '<span class="avatar avatar-placeholder">' + escapeHtml(initials) + "</span>";
    var pais = a.pais ? '<span class="atleta-pais">' + escapeHtml(a.pais) + "</span>" : "";
    return (
      '<div class="atleta-cell">' +
      photo +
      '<div class="atleta-info"><strong>' + name + "</strong>" + pais + "</div>" +
      "</div>"
    );
  }

  function generoBadge(g) {
    if (g === "Masculino") return '<span class="badge badge-genero badge-m">M</span>';
    if (g === "Femenino") return '<span class="badge badge-genero badge-f">F</span>';
    return "—";
  }

  function nivelBadge(n) {
    if (!n) return "—";
    var cls = "badge badge-nivel badge-nivel-" + n.toLowerCase();
    return '<span class="' + cls + '">' + escapeHtml(n) + "</span>";
  }

  function makeMessage(text) {
    var el = document.createElement("div");
    el.className = "loading-message";
    el.textContent = text;
    return el;
  }

  function makeError(text) {
    var wrap = document.createElement("div");
    wrap.className = "error-state";
    var h = document.createElement("h3");
    h.textContent = "No pudimos cargar los atletas";
    var p = document.createElement("p");
    p.textContent = text;
    var btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Reintentar";
    btn.addEventListener("click", loadAtletas);
    wrap.appendChild(h);
    wrap.appendChild(p);
    wrap.appendChild(btn);
    return wrap;
  }

  function makeEmptyState() {
    var wrap = document.createElement("div");
    wrap.className = "placeholder";
    wrap.innerHTML =
      '<span class="placeholder-tag">Sin atletas</span>' +
      "<h2>El catálogo está vacío</h2>" +
      "<p>Agrega tu primer atleta para empezar. Cuando esté lista la Tarea 07, vas a poder hacerlo con el botón <strong>+ Nuevo atleta</strong>. Mientras tanto, puedes correr la suite de tests de atletas para crear uno de prueba.</p>";
    return wrap;
  }

  function makeNoResults() {
    var wrap = document.createElement("div");
    wrap.className = "placeholder";
    wrap.innerHTML =
      '<span class="placeholder-tag">Sin coincidencias</span>' +
      "<h2>No encontré atletas con estos filtros</h2>" +
      "<p>Prueba quitar la búsqueda o cambiar el filtro de género / nivel.</p>";
    return wrap;
  }

  // ---------- Helpers ----------

  function todayISO() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function calcularEdad(fechaNac, hoy) {
    var fn = new Date(fechaNac);
    var ref = new Date(hoy);
    if (isNaN(fn.getTime()) || isNaN(ref.getTime())) return "";
    var edad = ref.getFullYear() - fn.getFullYear();
    var m = ref.getMonth() - fn.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < fn.getDate())) edad -= 1;
    return edad >= 0 && edad < 200 ? edad : "";
  }

  function initialsOf(name) {
    var parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "?";
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function escapeAttr(v) {
    return escapeHtml(v);
  }
})();
