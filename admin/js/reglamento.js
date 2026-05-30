/**
 * Reglamento Unificado de Artes Marciales Mixtas 2025 (FAMM / IMMAF).
 *
 * Módulo de cálculos puros — sin dependencias externas, sin DOM.
 * Codifica las tablas oficiales del reglamento (págs. 2–6, 11, 14) para
 * que el resto de la app las consulte sin reinventarlas.
 *
 * Diseñado para correr tanto en navegador (`window.Reglamento`) como en
 * scripts de test (`globalThis.Reglamento`).
 *
 * Convención de strings: usamos exactamente los nombres del reglamento
 * (con acentos) para que el operador los reconozca al instante.
 *
 * Pruebas: admin/js/reglamento.test.html
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------
  // Constantes y tablas estáticas
  // ---------------------------------------------------------------

  var GENEROS = ["Masculino", "Femenino"];

  var DIVISIONES = [
    "Mini 1",
    "Mini 2",
    "Infantil",
    "Juvenil D",
    "Juvenil C",
    "Juvenil B",
    "Juvenil A",
    "Junior",
    "Adultos",
  ];

  var NIVELES = ["Novato", "Principiante", "Intermedio", "Avanzado"];

  // Lista simplificada estilo Smoothcomp (traducida). Cubre los métodos
  // operacionales más comunes en un evento de un día. Para detalles del
  // reglamento ver pág. 14 del PDF FAMM 2025.
  var METODOS_FINALIZACION = [
    "Decisión",
    "Sumisión",
    "TKO",
    "KO",
    "Descalificación",
    "Abandono",
    "No Contest",
    "No Pasó Pesaje",
    "No Pasó Examen Médico",
    "No Se Presentó",
  ];

  // Pág. 2: divisiones por edad.
  var EDAD_RANGOS = [
    { division: "Mini 1", min: 4, max: 5 },
    { division: "Mini 2", min: 6, max: 7 },
    { division: "Infantil", min: 8, max: 9 },
    { division: "Juvenil D", min: 10, max: 11 },
    { division: "Juvenil C", min: 12, max: 13 },
    { division: "Juvenil B", min: 14, max: 15 },
    { division: "Juvenil A", min: 16, max: 17 },
    { division: "Junior", min: 18, max: 20 },
    { division: "Adultos", min: 21, max: 150 },
  ];

  // Pág. 6: divisiones por nivel.
  // El reglamento usa rangos en "años y meses"; los convertimos a años
  // decimales para comparar contra `anios_practica` (un número decimal).
  // Novato: hasta 1 año (≤ 1).
  // Principiante: de 1 año 1 mes hasta 2 años (≈ (1, 2]).
  // Intermedio: de 2 años 1 mes hasta 3 años (≈ (2, 3]).
  // Avanzado: más de 3 años (> 3).
  var NIVEL_RANGOS = [
    { nivel: "Novato", min: 0, max: 1, maxInclusivo: true },
    { nivel: "Principiante", min: 1, max: 2, maxInclusivo: true },
    { nivel: "Intermedio", min: 2, max: 3, maxInclusivo: true },
    { nivel: "Avanzado", min: 3, max: Infinity, maxInclusivo: true },
  ];

  // Páginas 3-5: divisiones por peso. Para cada (división, género)
  // se lista la categoría con su peso MAX en kg.
  // - `pesoMax` significa "menos de X kg" (estricto en niños/jóvenes,
  //   pero el reglamento usa el mismo formato "Menos X kg" en adultos).
  // - La última categoría de cada lista lleva `pesoMax: Infinity`
  //   (categorías abiertas tipo "X kg en adelante" / "Más de X kg").
  // - Las que el reglamento marca "no ranqueable para eventos
  //   internacionales" se incluyen igual (son válidas para eventos
  //   locales). Más adelante podemos exponer un flag si hace falta.
  //
  // NOTA: Para Mini 1 / Mini 2 el reglamento dice "Se conformarán las
  // categorías basándose en la complexión física de los atletas",
  // dando rangos sin nombre formal. Codificamos los rangos como
  // "Cat. 1", "Cat. 2", ... y el operador puede ajustar manualmente.

  var PESOS_MINI = [
    { nombre: "Mini Cat. 1", pesoMax: 23 },
    { nombre: "Mini Cat. 2", pesoMax: 26 },
    { nombre: "Mini Cat. 3", pesoMax: 29 },
    { nombre: "Mini Cat. 4", pesoMax: 32 },
    { nombre: "Mini Cat. 5", pesoMax: 35 },
    { nombre: "Mini Cat. 6", pesoMax: 38 },
    { nombre: "Mini Cat. 7", pesoMax: 41 },
    { nombre: "Mini Cat. 8", pesoMax: 47 },
    { nombre: "Mini Cat. 9", pesoMax: 50 },
    { nombre: "Mini Cat. 10", pesoMax: 53 },
    { nombre: "Mini Cat. 11", pesoMax: 56 },
    { nombre: "Mini Cat. 12", pesoMax: 59 },
    { nombre: "Mini Cat. Abierta", pesoMax: Infinity },
  ];

  var PESOS_INFANTIL = [
    { nombre: "Menos 24 kg", pesoMax: 24 },
    { nombre: "Menos 27 kg", pesoMax: 27 },
    { nombre: "Menos 31 kg", pesoMax: 31 },
    { nombre: "Menos 34 kg", pesoMax: 34 },
    { nombre: "Menos 37 kg", pesoMax: 37 },
    { nombre: "Menos 40 kg", pesoMax: 40 },
    { nombre: "Menos 44 kg", pesoMax: 44 },
    { nombre: "Menos 48 kg", pesoMax: 48 },
    { nombre: "Menos 52 kg", pesoMax: 52 },
    { nombre: "Menos 57 kg", pesoMax: 57 },
    { nombre: "Menos 62 kg", pesoMax: 62 },
    { nombre: "Menos 65 kg", pesoMax: 65 },
    { nombre: "Más de 65 kg", pesoMax: Infinity },
  ];

  var PESOS_JUVENIL_D = [
    { nombre: "Menos 30 kg", pesoMax: 30 },
    { nombre: "Menos 34 kg", pesoMax: 34 },
    { nombre: "Menos 37 kg", pesoMax: 37 },
    { nombre: "Menos 40 kg", pesoMax: 40 },
    { nombre: "Menos 44 kg", pesoMax: 44 },
    { nombre: "Menos 48 kg", pesoMax: 48 },
    { nombre: "Menos 52 kg", pesoMax: 52 },
    { nombre: "Menos 57 kg", pesoMax: 57 },
    { nombre: "Menos 62 kg", pesoMax: 62 },
    { nombre: "Menos 65 kg", pesoMax: 65 },
    { nombre: "Menos 70 kg", pesoMax: 70 },
    { nombre: "Más de 70 kg", pesoMax: Infinity },
  ];

  var PESOS_JUVENIL_C = [
    { nombre: "Menos 40 kg", pesoMax: 40 },
    { nombre: "Menos 44 kg", pesoMax: 44 },
    { nombre: "Menos 48 kg", pesoMax: 48 },
    { nombre: "Menos 52 kg", pesoMax: 52 },
    { nombre: "Menos 57 kg", pesoMax: 57 },
    { nombre: "Menos 62 kg", pesoMax: 62 },
    { nombre: "Menos 67 kg", pesoMax: 67 },
    { nombre: "Menos 72 kg", pesoMax: 72 },
    { nombre: "Menos 77 kg", pesoMax: 77 },
    { nombre: "Menos 82 kg", pesoMax: 82 },
    { nombre: "Más de 82 kg", pesoMax: Infinity },
  ];

  // Juvenil B mismo rango que Juvenil C (pág. 3 del reglamento los lista
  // bajo la misma columna).
  var PESOS_JUVENIL_B = PESOS_JUVENIL_C;

  // Juvenil A varonil.
  var PESOS_JUVENIL_A_VARONIL = [
    { nombre: "Paja", pesoMax: 52.2 },
    { nombre: "Mosca", pesoMax: 56.7 },
    { nombre: "Gallo", pesoMax: 61.2 },
    { nombre: "Pluma", pesoMax: 65.8 },
    { nombre: "Ligero", pesoMax: 70.3 },
    { nombre: "Superligero", pesoMax: 74.8 },
    { nombre: "Superwelter", pesoMax: 79.4 },
    { nombre: "Medio", pesoMax: 83.9 },
    { nombre: "Supermedio", pesoMax: 88.4 },
    { nombre: "Semipesado", pesoMax: 93 },
    { nombre: "Más de 93 kg", pesoMax: Infinity },
  ];

  // Juvenil A femenil.
  var PESOS_JUVENIL_A_FEMENIL = [
    { nombre: "Átomo", pesoMax: 47.6 },
    { nombre: "Paja", pesoMax: 52.2 },
    { nombre: "Mosca", pesoMax: 56.7 },
    { nombre: "Gallo", pesoMax: 61.2 },
    { nombre: "Pluma", pesoMax: 65.8 },
    { nombre: "Ligero", pesoMax: 70.3 },
    { nombre: "Superligero", pesoMax: 74.8 },
    { nombre: "Superwelter", pesoMax: 79.4 },
    { nombre: "Medio", pesoMax: 83 },
    { nombre: "Más de 83 kg", pesoMax: Infinity },
  ];

  // Junior / Adultos varonil (págs. 4–5).
  var PESOS_JUNIOR_ADULTOS_VARONIL = [
    { nombre: "Peso Paja", pesoMax: 52.2 },
    { nombre: "Peso Mosca", pesoMax: 56.7 },
    { nombre: "Peso Gallo", pesoMax: 61.2 },
    { nombre: "Peso Pluma", pesoMax: 65.8 },
    { nombre: "Peso Ligero", pesoMax: 70.3 },
    { nombre: "Superligero", pesoMax: 74.8 },
    { nombre: "Superwelter", pesoMax: 79.4 },
    { nombre: "Medio", pesoMax: 83.9 },
    { nombre: "Supermedio", pesoMax: 88.4 },
    { nombre: "Semipesado", pesoMax: 93 },
    { nombre: "Pesado", pesoMax: 97 },
    { nombre: "Superpesado", pesoMax: Infinity },
  ];

  // Junior / Adultos femenil (págs. 4–5).
  var PESOS_JUNIOR_ADULTOS_FEMENIL = [
    { nombre: "Átomo", pesoMax: 47.7 },
    { nombre: "Paja", pesoMax: 52.2 },
    { nombre: "Mosca", pesoMax: 56.7 },
    { nombre: "Gallo", pesoMax: 61.2 },
    { nombre: "Pluma", pesoMax: 65.8 },
    { nombre: "Ligero", pesoMax: 70.3 },
    { nombre: "Superligero", pesoMax: 74.8 },
    { nombre: "Superwelter", pesoMax: 79.4 },
    { nombre: "Medio", pesoMax: 83.9 },
    { nombre: "Supermedio", pesoMax: 88.4 },
    { nombre: "Más de 88.4 kg", pesoMax: Infinity },
  ];

  // ---------------------------------------------------------------
  // Tiempos de pelea por categoría (pág. 6 del reglamento)
  // ---------------------------------------------------------------
  // tiempoPelea(division, nivel, esFinal) consulta esta tabla.

  function tiempoEliminatoria(min) {
    return { rounds: 1, segundosPorRound: min * 60, segundosDescanso: 0 };
  }
  function tiempoFinalMultiRound(rounds, min, descansoMin) {
    return {
      rounds: rounds,
      segundosPorRound: min * 60,
      segundosDescanso: descansoMin * 60,
    };
  }

  var TIEMPOS = {
    // [division][nivel] = { eliminatoria, final }
    Adultos: {
      Avanzado: {
        eliminatoria: tiempoEliminatoria(5),
        final: tiempoFinalMultiRound(3, 3, 1),
      },
      Intermedio: { eliminatoria: tiempoEliminatoria(4), final: tiempoEliminatoria(4) },
      Principiante: { eliminatoria: tiempoEliminatoria(4), final: tiempoEliminatoria(4) },
      Novato: { eliminatoria: tiempoEliminatoria(4), final: tiempoEliminatoria(4) },
    },
    Junior: {
      Avanzado: {
        eliminatoria: tiempoEliminatoria(5),
        final: tiempoFinalMultiRound(3, 3, 1),
      },
      Intermedio: { eliminatoria: tiempoEliminatoria(4), final: tiempoEliminatoria(4) },
      Principiante: { eliminatoria: tiempoEliminatoria(4), final: tiempoEliminatoria(4) },
      Novato: { eliminatoria: tiempoEliminatoria(4), final: tiempoEliminatoria(4) },
    },
    "Juvenil A": {
      Avanzado: {
        eliminatoria: tiempoEliminatoria(4),
        final: tiempoFinalMultiRound(3, 2, 1),
      },
      Intermedio: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Principiante: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Novato: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
    },
    "Juvenil B": {
      Avanzado: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Intermedio: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Principiante: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Novato: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
    },
    "Juvenil C": {
      Avanzado: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Intermedio: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Principiante: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
      Novato: { eliminatoria: tiempoEliminatoria(3), final: tiempoEliminatoria(3) },
    },
    "Juvenil D": {
      Avanzado: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Intermedio: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Principiante: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Novato: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
    },
    Infantil: {
      Avanzado: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Intermedio: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Principiante: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Novato: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
    },
    "Mini 2": {
      Avanzado: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Intermedio: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Principiante: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Novato: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
    },
    "Mini 1": {
      Avanzado: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Intermedio: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Principiante: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
      Novato: { eliminatoria: tiempoEliminatoria(2), final: tiempoEliminatoria(2) },
    },
  };

  // ---------------------------------------------------------------
  // Funciones públicas
  // ---------------------------------------------------------------

  /**
   * Calcula la división por edad del atleta a la fecha del evento.
   * @param {string|Date} fechaNacimiento  ISO ("YYYY-MM-DD") o Date.
   * @param {string|Date} fechaEvento      ISO o Date.
   * @returns {string} Nombre de la división o "" si está fuera de rango.
   */
  function calcularDivisionEdad(fechaNacimiento, fechaEvento) {
    var fn = toDate_(fechaNacimiento);
    var fe = toDate_(fechaEvento);
    if (!fn || !fe) return "";
    var edad = edadAFecha_(fn, fe);
    for (var i = 0; i < EDAD_RANGOS.length; i += 1) {
      var r = EDAD_RANGOS[i];
      if (edad >= r.min && edad <= r.max) return r.division;
    }
    return "";
  }

  /**
   * Sugiere un nivel basado en años de práctica.
   * @param {number} aniosPractica  Decimal (ej. 1.5 = 1 año 6 meses).
   * @returns {string} "Novato" | "Principiante" | "Intermedio" | "Avanzado".
   */
  function sugerirNivel(aniosPractica) {
    var a = Number(aniosPractica);
    if (!isFinite(a) || a < 0) return "";
    for (var i = 0; i < NIVEL_RANGOS.length; i += 1) {
      var r = NIVEL_RANGOS[i];
      var ok =
        a > r.min || (i === 0 && a >= r.min); // primer rango incluye 0
      if (ok && (a < r.max || (r.maxInclusivo && a <= r.max))) {
        return r.nivel;
      }
    }
    return "Avanzado";
  }

  /**
   * Devuelve la tabla de categorías de peso para una división y género.
   * @returns {Array<{nombre: string, pesoMax: number}>}
   */
  function categoriasPesoPara(division, genero) {
    switch (division) {
      case "Mini 1":
      case "Mini 2":
        return PESOS_MINI.slice();
      case "Infantil":
        return PESOS_INFANTIL.slice();
      case "Juvenil D":
        return PESOS_JUVENIL_D.slice();
      case "Juvenil C":
        return PESOS_JUVENIL_C.slice();
      case "Juvenil B":
        return PESOS_JUVENIL_B.slice();
      case "Juvenil A":
        return genero === "Femenino"
          ? PESOS_JUVENIL_A_FEMENIL.slice()
          : PESOS_JUVENIL_A_VARONIL.slice();
      case "Junior":
      case "Adultos":
        return genero === "Femenino"
          ? PESOS_JUNIOR_ADULTOS_FEMENIL.slice()
          : PESOS_JUNIOR_ADULTOS_VARONIL.slice();
      default:
        return [];
    }
  }

  /**
   * Calcula la categoría de peso de un atleta.
   * Devuelve la categoría más baja cuyo `pesoMax > pesoKg`.
   * @returns {{nombre: string, pesoMax: number} | null}
   */
  function calcularCategoriaPeso(division, genero, pesoKg) {
    var peso = Number(pesoKg);
    if (!isFinite(peso) || peso <= 0) return null;
    var lista = categoriasPesoPara(division, genero);
    for (var i = 0; i < lista.length; i += 1) {
      if (peso < lista[i].pesoMax) return lista[i];
    }
    // Si nada cumple (peso > todas las cotas finitas), devolvemos
    // la última categoría (la abierta, con pesoMax: Infinity).
    return lista.length ? lista[lista.length - 1] : null;
  }

  /**
   * Tiempo de pelea para una categoría, según el reglamento (pág. 6).
   * @param {string}  division  Una de DIVISIONES.
   * @param {string}  nivel     Uno de NIVELES.
   * @param {boolean} esFinal   true si es la pelea final del bracket.
   * @returns {{rounds: number, segundosPorRound: number, segundosDescanso: number}}
   */
  function tiempoPelea(division, nivel, esFinal) {
    var porDivision = TIEMPOS[division];
    if (!porDivision) {
      throw new Error("División no reconocida: " + division);
    }
    var porNivel = porDivision[nivel];
    if (!porNivel) {
      throw new Error("Nivel no reconocido: " + nivel);
    }
    return Object.assign({}, esFinal ? porNivel.final : porNivel.eliminatoria);
  }

  // ---------------------------------------------------------------
  // Helpers internos
  // ---------------------------------------------------------------

  function toDate_(value) {
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === "string" && value) {
      // Construimos manualmente para evitar problemas de zona horaria
      // con strings tipo "YYYY-MM-DD" (que JS interpreta como UTC).
      var match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        var d = new Date(
          parseInt(match[1], 10),
          parseInt(match[2], 10) - 1,
          parseInt(match[3], 10),
        );
        return isNaN(d.getTime()) ? null : d;
      }
      var parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  function edadAFecha_(fechaNacimiento, fechaReferencia) {
    var edad = fechaReferencia.getFullYear() - fechaNacimiento.getFullYear();
    var m = fechaReferencia.getMonth() - fechaNacimiento.getMonth();
    if (m < 0 || (m === 0 && fechaReferencia.getDate() < fechaNacimiento.getDate())) {
      edad -= 1;
    }
    return edad;
  }

  // ---------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------

  var Reglamento = {
    // Constantes
    GENEROS: GENEROS,
    DIVISIONES: DIVISIONES,
    NIVELES: NIVELES,
    METODOS_FINALIZACION: METODOS_FINALIZACION,

    // Funciones puras
    calcularDivisionEdad: calcularDivisionEdad,
    sugerirNivel: sugerirNivel,
    categoriasPesoPara: categoriasPesoPara,
    calcularCategoriaPeso: calcularCategoriaPeso,
    tiempoPelea: tiempoPelea,

    // Internos exportados para tests
    _internal: {
      EDAD_RANGOS: EDAD_RANGOS,
      NIVEL_RANGOS: NIVEL_RANGOS,
      TIEMPOS: TIEMPOS,
      edadAFecha: edadAFecha_,
    },
  };

  root.Reglamento = Reglamento;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Reglamento;
  }
})(typeof window !== "undefined" ? window : globalThis);
