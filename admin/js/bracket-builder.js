/**
 * Bracket builder — agrupación de atletas y generación de single elimination.
 *
 * Módulo de cálculos puros — sin DOM, sin dependencias externas. Diseñado
 * para correr tanto en navegador (`window.BracketBuilder`) como en Node
 * (`module.exports`).
 *
 * API pública:
 *   agruparAtletas(inscripciones) → Array<Grupo>
 *     Grupo: { categoria, atletas, num_atletas, viable, tipo_sugerido }
 *
 *   generarSingleElimination(atletas) → Array<Pelea>
 *     Para 2 atletas: 1 pelea final.
 *     Para >2: bracket completo con byes distribuidos para evitar
 *     emparejamientos bye-vs-bye.
 *
 *   generarBracketsParaGrupos(grupos) → Array<{categoria, atletas, tipo, peleas}>
 *     Helper de conveniencia que combina agruparAtletas + generación.
 *
 *   nombreRonda(atletasEnRonda) → string
 *
 * Convenciones de la estructura Pelea:
 *   {
 *     ronda:            "final" | "semifinal" | "cuartos" | "octavos" | …
 *     ronda_idx:        0 = primera ronda (inicial), max = final
 *     numero:           secuencial across todas las rondas (1-based)
 *     numero_en_ronda:  1-based, posición dentro de la ronda
 *     atleta1:          objeto atleta o null (null = posición de bye)
 *     atleta2:          objeto atleta o null
 *     bye:              true si una de las posiciones es null
 *     auto_ganador_id:  id del atleta que avanza automáticamente (si bye)
 *     pelea_anterior_1: número de la pelea cuyo ganador alimenta atleta1
 *                       (null para R1)
 *     pelea_anterior_2: ídem para atleta2
 *     ganador_id:       null por default; se llena cuando se decide el match
 *   }
 *
 * Pruebas: admin/js/bracket-builder.test.html
 */
(function (root) {
  "use strict";

  /* ============================================================
   * Agrupación
   * ============================================================ */

  /**
   * Agrupa inscripciones por su `categoria_calculada`.
   * @param {Array<{categoria_calculada, atleta, atleta_id}>} inscripciones
   * @returns {Array<{categoria, atletas, num_atletas, viable, tipo_sugerido}>}
   */
  function agruparAtletas(inscripciones) {
    if (!Array.isArray(inscripciones)) return [];

    var grupos = {};
    inscripciones.forEach(function (ins) {
      if (!ins) return;
      var cat = ins.categoria_calculada || "(sin categoría)";
      if (!grupos[cat]) grupos[cat] = [];
      // Preferimos el objeto atleta enriquecido, pero si solo tenemos
      // atleta_id, creamos un placeholder mínimo.
      var atleta = ins.atleta || { id: ins.atleta_id };
      // Agregamos referencia a la inscripción para que la UI pueda
      // navegar al pesaje/quitar fácil.
      atleta._inscripcion_id = ins.id;
      grupos[cat].push(atleta);
    });

    return Object.keys(grupos)
      .sort()
      .map(function (cat) {
        var atletas = grupos[cat];
        var n = atletas.length;
        var viable = n >= 2;
        var tipo_sugerido = !viable
          ? null
          : n === 2
          ? "dos_atletas"
          : "single_elimination";
        return {
          categoria: cat,
          atletas: atletas,
          num_atletas: n,
          viable: viable,
          tipo_sugerido: tipo_sugerido,
        };
      });
  }

  /* ============================================================
   * Generación de bracket
   * ============================================================ */

  /**
   * Genera todas las peleas de un bracket single-elimination.
   * Si hay menos de 2 atletas, devuelve [].
   * Para 2 atletas devuelve una sola pelea "final".
   * Para >2 atletas usa slots = potencia de 2 >= N, con byes distribuidos
   * mediante pairing (i, slots-1-i) para evitar bye-vs-bye.
   *
   * @param {Array<Atleta>} atletas
   * @returns {Array<Pelea>}
   */
  function generarSingleElimination(atletas) {
    if (!Array.isArray(atletas)) return [];
    var N = atletas.length;
    if (N < 2) return [];

    if (N === 2) {
      return [
        {
          ronda: "final",
          ronda_idx: 0,
          numero: 1,
          numero_en_ronda: 1,
          atleta1: atletas[0],
          atleta2: atletas[1],
          bye: false,
          auto_ganador_id: null,
          pelea_anterior_1: null,
          pelea_anterior_2: null,
          ganador_id: null,
        },
      ];
    }

    // Cálculo de slots y byes
    var slots = 1;
    while (slots < N) slots *= 2;
    var byes = slots - N;
    var totalRondas = Math.log2(slots); // entero porque slots es pow2

    // Posiciones de R1: atletas primero, byes (nulls) al final
    var posiciones = atletas.slice();
    while (posiciones.length < slots) posiciones.push(null);

    var peleas = [];
    var numero = 0;

    // Round 1: pairing (pos[i], pos[slots-1-i])
    // Esto coloca byes en posiciones opuestas a los primeros atletas,
    // garantizando que no haya bye vs bye mientras byes < slots/2.
    var atletasEnR1 = slots;
    var matchesR1 = slots / 2;
    var rondaName1 = nombreRonda(atletasEnR1);
    var peleasR1 = [];

    for (var i = 0; i < matchesR1; i += 1) {
      var a1 = posiciones[i];
      var a2 = posiciones[slots - 1 - i];
      numero += 1;
      var bye = a1 === null || a2 === null;
      var auto_ganador_id = null;
      if (bye) {
        auto_ganador_id = a1 === null ? (a2 ? a2.id : null) : a1 ? a1.id : null;
      }
      var pelea = {
        ronda: rondaName1,
        ronda_idx: 0,
        numero: numero,
        numero_en_ronda: i + 1,
        atleta1: a1,
        atleta2: a2,
        bye: bye,
        auto_ganador_id: auto_ganador_id,
        pelea_anterior_1: null,
        pelea_anterior_2: null,
        ganador_id: null,
      };
      peleas.push(pelea);
      peleasR1.push(pelea);
    }

    // Rondas siguientes (placeholders con referencias a peleas previas)
    var peleasPrevias = peleasR1;
    var atletasEnRonda = slots / 2;
    var rondaIdx = 1;

    while (atletasEnRonda > 1) {
      var matchesEnRonda = atletasEnRonda / 2;
      var rondaName = nombreRonda(atletasEnRonda);
      var nuevasPeleas = [];

      for (var j = 0; j < matchesEnRonda; j += 1) {
        numero += 1;
        var peleaAnt1 = peleasPrevias[j * 2];
        var peleaAnt2 = peleasPrevias[j * 2 + 1];

        // Pre-poblar atleta1/atleta2 si la pelea anterior fue un bye
        // (sabemos el ganador automáticamente).
        var atletaPre1 = bestKnownAtleta_(peleaAnt1, atletas);
        var atletaPre2 = bestKnownAtleta_(peleaAnt2, atletas);

        var pelea = {
          ronda: rondaName,
          ronda_idx: rondaIdx,
          numero: numero,
          numero_en_ronda: j + 1,
          atleta1: atletaPre1,
          atleta2: atletaPre2,
          bye: false, // las rondas siguientes nunca son byes
          auto_ganador_id: null,
          pelea_anterior_1: peleaAnt1.numero,
          pelea_anterior_2: peleaAnt2.numero,
          ganador_id: null,
        };
        peleas.push(pelea);
        nuevasPeleas.push(pelea);
      }

      peleasPrevias = nuevasPeleas;
      atletasEnRonda /= 2;
      rondaIdx += 1;
    }

    return peleas;
  }

  /**
   * Si la pelea anterior fue un bye, devolvemos el atleta que avanzó
   * automáticamente. Si no, devolvemos null porque hay que esperar el
   * resultado.
   */
  function bestKnownAtleta_(peleaAnterior, atletas) {
    if (!peleaAnterior) return null;
    if (peleaAnterior.bye && peleaAnterior.auto_ganador_id) {
      return atletas.find(function (a) { return a && a.id === peleaAnterior.auto_ganador_id; }) || null;
    }
    return null;
  }

  /* ============================================================
   * Helpers
   * ============================================================ */

  /**
   * Nombre de la ronda según cuántos atletas inician en ella.
   * 2 → final, 4 → semifinal, 8 → cuartos, 16 → octavos, 32 →
   * dieciseisavos, 64 → treintaidosavos.
   */
  function nombreRonda(atletasEnRonda) {
    switch (atletasEnRonda) {
      case 2: return "final";
      case 4: return "semifinal";
      case 8: return "cuartos";
      case 16: return "octavos";
      case 32: return "dieciseisavos";
      case 64: return "treintaidosavos";
      default: return "ronda_" + atletasEnRonda;
    }
  }

  /**
   * Conveniencia: a partir de grupos viables, genera el bracket para cada uno.
   */
  function generarBracketsParaGrupos(grupos) {
    if (!Array.isArray(grupos)) return [];
    return grupos
      .filter(function (g) { return g.viable; })
      .map(function (g) {
        return {
          categoria: g.categoria,
          tipo: g.tipo_sugerido,
          atletas: g.atletas,
          peleas: generarSingleElimination(g.atletas),
        };
      });
  }

  /**
   * Helper que cuenta:
   *   - total: número total de peleas (incluyendo byes)
   *   - reales: peleas no-bye (las que se pelean realmente)
   *   - byes: peleas con bye
   */
  function resumenPeleas(peleas) {
    if (!Array.isArray(peleas)) return { total: 0, reales: 0, byes: 0 };
    var total = peleas.length;
    var byes = peleas.filter(function (p) { return p.bye; }).length;
    return { total: total, reales: total - byes, byes: byes };
  }

  /* ============================================================
   * Export
   * ============================================================ */

  var BracketBuilder = {
    agruparAtletas: agruparAtletas,
    generarSingleElimination: generarSingleElimination,
    generarBracketsParaGrupos: generarBracketsParaGrupos,
    nombreRonda: nombreRonda,
    resumenPeleas: resumenPeleas,
  };

  root.BracketBuilder = BracketBuilder;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = BracketBuilder;
  }
})(typeof window !== "undefined" ? window : globalThis);
