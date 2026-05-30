/**
 * Renderer de brackets como SVG (estilo Smoothcomp).
 *
 * API pública:
 *   BracketSVG.render(svgEl, bracketData, opts)
 *     svgEl: elemento <svg> donde renderizar
 *     bracketData: objeto con shape { peleas, categoria, tipo_bracket, ... }
 *                  igual al que devuelve api.brackets.get
 *     opts: { onMatchClick: (peleaId) => void, compact: boolean }
 *
 *   BracketSVG.computeLayout(bracketData) → { width, height, matches }
 *     Útil para tests y para conocer dimensiones sin renderizar.
 *
 * Layout:
 *   - Columnas left→right, una por ronda.
 *   - R1: matches apilados verticalmente con espaciado constante.
 *   - Rondas siguientes: cada match en el midpoint vertical de sus dos
 *     feeders (peleas anteriores).
 *   - Conectores tipo "shelf" (horizontal-vertical-horizontal) entre el
 *     borde derecho del feeder y el borde izquierdo del destino.
 *
 * Cada match tiene 2 slots (atleta1 arriba, atleta2 abajo) con:
 *   - Nombre (truncado si muy largo)
 *   - Academia (línea pequeña debajo)
 *   - Slot ganador: resaltado verde con check ✓
 *   - Slot perdedor: opacidad reducida
 *   - Slot bye: cursiva "BYE"
 *   - Slot TBD (esperando ronda previa): "—"
 *
 * Estilos: ver styles-admin.css (selectores .bracket-svg-*).
 */
(function (root) {
  "use strict";

  /* ============================================================
   * Constantes de layout
   * ============================================================ */

  var DEFAULTS = {
    COL_WIDTH: 220,
    COL_GAP: 56,
    BOX_HEIGHT: 60,
    R1_VERTICAL_SPACING: 96, // distancia top-to-top entre R1 matches
    HEADER_HEIGHT: 28,
    PADDING: 16,
    NAME_MAX: 22,
    ACADEMIA_MAX: 26,
  };

  function configFor_(opts) {
    var cfg = Object.assign({}, DEFAULTS);
    if (opts && opts.compact) {
      cfg.COL_WIDTH = 180;
      cfg.BOX_HEIGHT = 50;
      cfg.R1_VERTICAL_SPACING = 80;
      cfg.NAME_MAX = 18;
      cfg.ACADEMIA_MAX = 22;
    }
    return cfg;
  }

  /* ============================================================
   * computeLayout — calcula posiciones sin renderizar
   * ============================================================ */

  function computeLayout(bracketData, opts) {
    var cfg = configFor_(opts);
    var peleas = (bracketData && bracketData.peleas) || [];
    if (peleas.length === 0) {
      return { width: cfg.PADDING * 2, height: cfg.PADDING * 2, matches: {}, rounds: {}, cfg: cfg };
    }

    // Agrupar por ronda_idx y ordenar dentro de cada ronda
    var rounds = {};
    var maxIdx = 0;
    peleas.forEach(function (p) {
      var idx = Number(p.ronda_idx) || 0;
      if (!rounds[idx]) rounds[idx] = [];
      rounds[idx].push(p);
      if (idx > maxIdx) maxIdx = idx;
    });
    Object.keys(rounds).forEach(function (k) {
      rounds[k].sort(function (a, b) {
        return (Number(a.numero_en_ronda) || 0) - (Number(b.numero_en_ronda) || 0);
      });
    });

    var matches = {};

    // Round 0 (R1): apilados con espaciado constante
    var r1 = rounds[0] || [];
    r1.forEach(function (p, i) {
      matches[p.numero_pelea] = {
        x: cfg.PADDING,
        y: cfg.HEADER_HEIGHT + cfg.PADDING + i * cfg.R1_VERTICAL_SPACING,
      };
    });

    // Rondas siguientes: cada match en el midpoint de sus feeders
    for (var ri = 1; ri <= maxIdx; ri += 1) {
      var ronda = rounds[ri] || [];
      ronda.forEach(function (p) {
        var f1 = matches[p.pelea_anterior_1];
        var f2 = matches[p.pelea_anterior_2];
        var midY;
        if (f1 && f2) {
          midY = (f1.y + f2.y) / 2;
        } else if (f1) {
          midY = f1.y;
        } else if (f2) {
          midY = f2.y;
        } else {
          midY = cfg.HEADER_HEIGHT + cfg.PADDING;
        }
        matches[p.numero_pelea] = {
          x: cfg.PADDING + ri * (cfg.COL_WIDTH + cfg.COL_GAP),
          y: midY,
        };
      });
    }

    // Dimensiones totales
    var width = cfg.PADDING * 2 + (maxIdx + 1) * cfg.COL_WIDTH + maxIdx * cfg.COL_GAP;
    var maxY = 0;
    Object.keys(matches).forEach(function (k) {
      if (matches[k].y > maxY) maxY = matches[k].y;
    });
    var height = maxY + cfg.BOX_HEIGHT + cfg.PADDING;

    return {
      width: width,
      height: height,
      matches: matches,
      rounds: rounds,
      maxIdx: maxIdx,
      cfg: cfg,
    };
  }

  /* ============================================================
   * render — pinta el SVG
   * ============================================================ */

  function render(svgEl, bracketData, opts) {
    if (!svgEl) throw new Error("svgEl requerido");
    opts = opts || {};

    var layout = computeLayout(bracketData, opts);
    var cfg = layout.cfg;
    var matches = layout.matches;

    svgEl.setAttribute("viewBox", "0 0 " + layout.width + " " + layout.height);
    svgEl.setAttribute("width", layout.width);
    svgEl.setAttribute("height", layout.height);
    svgEl.classList.add("bracket-svg");

    var parts = [];

    // Headers de ronda
    Object.keys(layout.rounds).forEach(function (riKey) {
      var ri = Number(riKey);
      var primera = layout.rounds[ri][0];
      var label = (primera && primera.ronda ? primera.ronda : "ronda_" + ri).toUpperCase();
      var cx = cfg.PADDING + ri * (cfg.COL_WIDTH + cfg.COL_GAP) + cfg.COL_WIDTH / 2;
      parts.push(
        '<text class="bracket-svg-round-label" x="' + cx + '" y="' + (cfg.HEADER_HEIGHT - 4) + '" text-anchor="middle">' +
        escape_(label) + "</text>",
      );
    });

    // Conectores (bajo las cajas)
    for (var ri = 1; ri <= layout.maxIdx; ri += 1) {
      var ronda = layout.rounds[ri] || [];
      ronda.forEach(function (p) {
        var dest = matches[p.numero_pelea];
        if (!dest) return;
        var x2 = dest.x;
        var y2 = dest.y + cfg.BOX_HEIGHT / 2;
        [p.pelea_anterior_1, p.pelea_anterior_2].forEach(function (anterior) {
          if (anterior === "" || anterior === null || anterior === undefined) return;
          var src = matches[anterior];
          if (!src) return;
          var x1 = src.x + cfg.COL_WIDTH;
          var y1 = src.y + cfg.BOX_HEIGHT / 2;
          var midX = (x1 + x2) / 2;
          parts.push(
            '<path class="bracket-svg-connector" d="M' + x1 + "," + y1 +
            " L" + midX + "," + y1 +
            " L" + midX + "," + y2 +
            " L" + x2 + "," + y2 + '" fill="none"/>',
          );
        });
      });
    }

    // Cajas de matches
    bracketData.peleas.forEach(function (p) {
      var pos = matches[p.numero_pelea];
      if (!pos) return;
      parts.push(renderMatch_(p, pos.x, pos.y, cfg));
    });

    svgEl.innerHTML = parts.join("");

    // Click handlers
    if (typeof opts.onMatchClick === "function") {
      svgEl.querySelectorAll("[data-pelea-id]").forEach(function (g) {
        g.style.cursor = "pointer";
        g.addEventListener("click", function () {
          opts.onMatchClick(g.dataset.peleaId, g.dataset.numero);
        });
      });
    }
  }

  /* ============================================================
   * renderMatch — caja de una pelea
   * ============================================================ */

  function renderMatch_(p, x, y, cfg) {
    var a1 = p.atleta1;
    var a2 = p.atleta2;
    // Si no vienen objetos atleta pero hay atleta1_id/atleta2_id, mostrar placeholder
    if (!a1 && p.atleta1_id) a1 = { id: p.atleta1_id, nombre_completo: p.atleta1_id };
    if (!a2 && p.atleta2_id) a2 = { id: p.atleta2_id, nombre_completo: p.atleta2_id };

    var ganador = p.ganador_id || (p.ganador && p.ganador.id) || "";
    var halfH = cfg.BOX_HEIGHT / 2;
    var bye = !!p.bye;

    var a1IsWinner = !!ganador && !!a1 && a1.id === ganador;
    var a2IsWinner = !!ganador && !!a2 && a2.id === ganador;
    var a1IsLoser = !!ganador && !a1IsWinner && !!a1;
    var a2IsLoser = !!ganador && !a2IsWinner && !!a2;

    var w = cfg.COL_WIDTH;
    var parts = [];

    parts.push(
      '<g class="bracket-svg-match" data-pelea-id="' + escape_(p.id || "") + '" data-numero="' + escape_(String(p.numero_pelea || "")) + '">',
    );

    // Sombra del match
    parts.push(
      '<rect class="bracket-svg-match-bg" x="' + x + '" y="' + y +
      '" width="' + w + '" height="' + cfg.BOX_HEIGHT + '" rx="4"/>',
    );

    // # de pelea (badge top-left, fuera del rect)
    if (p.numero_pelea !== undefined && p.numero_pelea !== null) {
      parts.push(
        '<text class="bracket-svg-match-num" x="' + (x + 6) + '" y="' + (y - 4) + '">#' + escape_(String(p.numero_pelea)) + "</text>",
      );
    }

    // Slot atleta1
    parts.push(renderSlot_(a1, x, y, w, halfH, a1IsWinner, a1IsLoser, bye && !a1, cfg));

    // Divider horizontal
    parts.push(
      '<line class="bracket-svg-match-divider" x1="' + x + '" y1="' + (y + halfH) +
      '" x2="' + (x + w) + '" y2="' + (y + halfH) + '"/>',
    );

    // Slot atleta2
    parts.push(renderSlot_(a2, x, y + halfH, w, halfH, a2IsWinner, a2IsLoser, bye && !a2, cfg));

    parts.push("</g>");
    return parts.join("");
  }

  function renderSlot_(atleta, x, y, w, h, isWinner, isLoser, isByeSlot, cfg) {
    var cls = ["bracket-svg-match-slot"];
    if (isWinner) cls.push("is-winner");
    if (isLoser) cls.push("is-loser");
    if (isByeSlot) cls.push("is-bye");

    var parts = ['<g class="' + cls.join(" ") + '">'];

    // Background overlay para resaltar ganador
    if (isWinner) {
      parts.push(
        '<rect class="bracket-svg-slot-winner-bg" x="' + x + '" y="' + y +
        '" width="' + w + '" height="' + h + '"/>',
      );
    }

    // El slot necesita al menos 26px de alto para acomodar
    // cómodamente nombre + academia (dos líneas). Si es más chico,
    // solo mostramos el nombre centrado.
    var canFitTwoLines = h >= 26;

    if (isByeSlot) {
      parts.push(
        '<text class="bracket-svg-bye-label" x="' + (x + w / 2) + '" y="' + (y + h * 0.65) +
        '" text-anchor="middle">BYE</text>',
      );
    } else if (!atleta) {
      parts.push(
        '<text class="bracket-svg-tbd" x="' + (x + w / 2) + '" y="' + (y + h * 0.7) +
        '" text-anchor="middle">—</text>',
      );
    } else {
      var name = atleta.nombre_completo || atleta.id || "";
      var academia = atleta.academia || "";
      var showAca = !!academia && canFitTwoLines;

      if (showAca) {
        // Dos líneas: nombre arriba (42% del slot), academia abajo (82%)
        parts.push(
          '<text class="bracket-svg-name" x="' + (x + 10) + '" y="' + (y + h * 0.42) + '">' +
          escape_(truncate_(name, cfg.NAME_MAX)) + "</text>",
        );
        parts.push(
          '<text class="bracket-svg-academia" x="' + (x + 10) + '" y="' + (y + h * 0.82) + '">' +
          escape_(truncate_(academia, cfg.ACADEMIA_MAX)) + "</text>",
        );
      } else {
        // Una línea: nombre centrado verticalmente
        parts.push(
          '<text class="bracket-svg-name" x="' + (x + 10) + '" y="' + (y + h * 0.65) + '">' +
          escape_(truncate_(name, cfg.NAME_MAX)) + "</text>",
        );
      }
    }

    if (isWinner) {
      parts.push(
        '<text class="bracket-svg-check" x="' + (x + w - 10) + '" y="' + (y + h * 0.65) +
        '" text-anchor="end">✓</text>',
      );
    }

    parts.push("</g>");
    return parts.join("");
  }

  /* ============================================================
   * Helpers
   * ============================================================ */

  function truncate_(s, max) {
    if (!s) return "";
    s = String(s);
    if (s.length <= max) return s;
    return s.substring(0, max - 1) + "…";
  }

  function escape_(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ============================================================
   * Export
   * ============================================================ */

  root.BracketSVG = {
    render: render,
    computeLayout: computeLayout,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.BracketSVG;
  }
})(typeof window !== "undefined" ? window : globalThis);
