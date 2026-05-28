/**
 * Cliente HTTP del Apps Script de Eventos MMA.
 *
 * Lee la URL del Web App desde window.CLUB_SAMOA_EVENTOS_ENDPOINT
 * (definida en /registration-config.js, que debe cargarse antes que
 * este archivo).
 *
 * API pública:
 *   await api.get(action, params)
 *   await api.post(action, payload)
 *   api.isLoading()                     // bool, true si hay requests en vuelo
 *   api.onLoadingChange(fn)             // callback (bool) cuando cambia
 *   throw new api.ApiError(message, ...)
 *
 * Detalles:
 *   - Para POST usamos Content-Type "text/plain" para evitar el
 *     preflight CORS de Apps Script (Apps Script no responde bien a
 *     OPTIONS).
 *   - El payload de POST se envía como JSON dentro del body. El backend
 *     lo parsea en readPayload_() (ver Eventos.gs).
 *   - Loading indicator: contamos requests en vuelo. Cuando el contador
 *     pasa de 0 a >0, mostramos el spinner; cuando vuelve a 0, lo
 *     ocultamos. Se inyecta automáticamente al body al primer request.
 *
 * Pruebas: admin/js/api.test.html
 */
(function (root) {
  "use strict";

  // -----------------------------------------------------------------
  // Configuración del endpoint
  // -----------------------------------------------------------------

  function getEndpoint() {
    var url = root.CLUB_SAMOA_EVENTOS_ENDPOINT;
    if (!url || typeof url !== "string") {
      throw new ApiError(
        "CLUB_SAMOA_EVENTOS_ENDPOINT no está definido. Revisa que registration-config.js se cargue antes que api.js.",
        0,
      );
    }
    return url;
  }

  // -----------------------------------------------------------------
  // Errores
  // -----------------------------------------------------------------

  function ApiError(message, status, payload) {
    // Soporte para clases viejas: armar el objeto manualmente.
    var err = new Error(message);
    err.name = "ApiError";
    err.status = typeof status === "number" ? status : 0;
    err.payload = payload || null;
    Object.setPrototypeOf(err, ApiError.prototype);
    return err;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  // -----------------------------------------------------------------
  // Loading indicator
  // -----------------------------------------------------------------

  var inFlight = 0;
  var loadingListeners = [];
  var spinnerEl = null;

  function ensureSpinner_() {
    if (spinnerEl || typeof document === "undefined") return;
    if (!document.body) {
      // Si la página todavía no tiene <body>, lo intentamos después.
      document.addEventListener("DOMContentLoaded", ensureSpinner_);
      return;
    }
    var style = document.createElement("style");
    style.textContent =
      ".cs-api-spinner{" +
      "position:fixed;top:14px;right:14px;width:22px;height:22px;" +
      "border:3px solid rgba(255,255,255,0.18);border-top-color:#f7f2f1;" +
      "border-radius:50%;z-index:99999;animation:cs-api-spin 0.8s linear infinite;" +
      "display:none;pointer-events:none;" +
      "box-shadow:0 2px 10px rgba(0,0,0,0.35);" +
      "}" +
      ".cs-api-spinner.is-visible{display:block;}" +
      "@keyframes cs-api-spin{to{transform:rotate(360deg);}}";
    document.head.appendChild(style);

    spinnerEl = document.createElement("div");
    spinnerEl.className = "cs-api-spinner";
    spinnerEl.setAttribute("role", "status");
    spinnerEl.setAttribute("aria-label", "Cargando");
    spinnerEl.setAttribute("data-testid", "cs-api-spinner");
    document.body.appendChild(spinnerEl);
  }

  function setLoading_(loading) {
    ensureSpinner_();
    if (spinnerEl) {
      spinnerEl.classList.toggle("is-visible", loading);
    }
    loadingListeners.forEach(function (fn) {
      try {
        fn(loading);
      } catch (e) {
        /* ignore listener errors */
      }
    });
  }

  function beginRequest_() {
    inFlight += 1;
    if (inFlight === 1) setLoading_(true);
  }
  function endRequest_() {
    inFlight = Math.max(0, inFlight - 1);
    if (inFlight === 0) setLoading_(false);
  }

  // -----------------------------------------------------------------
  // Core
  // -----------------------------------------------------------------

  function buildGetUrl_(action, params) {
    var url = getEndpoint();
    var qs = ["action=" + encodeURIComponent(action)];
    if (params) {
      Object.keys(params).forEach(function (key) {
        var v = params[key];
        if (v === undefined || v === null) return;
        qs.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(v)));
      });
    }
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + qs.join("&");
  }

  async function get(action, params) {
    if (!action) throw new ApiError("api.get: action es requerido", 0);
    beginRequest_();
    try {
      var url = buildGetUrl_(action, params);
      var response;
      try {
        response = await fetch(url, { method: "GET", redirect: "follow" });
      } catch (networkErr) {
        throw new ApiError("Error de red: " + networkErr.message, 0);
      }
      return await handleResponse_(response, action);
    } finally {
      endRequest_();
    }
  }

  async function post(action, payload) {
    if (!action) throw new ApiError("api.post: action es requerido", 0);
    beginRequest_();
    try {
      var body = JSON.stringify(
        Object.assign({ action: action }, payload || {}),
      );
      var response;
      try {
        response = await fetch(getEndpoint(), {
          method: "POST",
          // Apps Script: usar text/plain para evitar preflight CORS.
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: body,
          redirect: "follow",
        });
      } catch (networkErr) {
        throw new ApiError("Error de red: " + networkErr.message, 0);
      }
      return await handleResponse_(response, action);
    } finally {
      endRequest_();
    }
  }

  async function handleResponse_(response, action) {
    var text = "";
    try {
      text = await response.text();
    } catch (e) {
      throw new ApiError("No se pudo leer la respuesta del servidor", response.status);
    }
    var data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new ApiError(
        "Respuesta no JSON desde el backend (action='" + action + "'): " + text.slice(0, 200),
        response.status,
        { rawBody: text },
      );
    }
    if (!response.ok) {
      throw new ApiError(
        "HTTP " + response.status + " en action='" + action + "'",
        response.status,
        data,
      );
    }
    // El backend devuelve { ok: false, error: "..." } para errores
    // controlados (sin status 500). Los convertimos en ApiError.
    if (data && data.ok === false) {
      throw new ApiError(
        data.error || "Error desconocido del backend",
        response.status,
        data,
      );
    }
    return data;
  }

  // -----------------------------------------------------------------
  // Loading API pública
  // -----------------------------------------------------------------

  function isLoading() {
    return inFlight > 0;
  }
  function onLoadingChange(fn) {
    if (typeof fn === "function") loadingListeners.push(fn);
    return function unsubscribe() {
      var i = loadingListeners.indexOf(fn);
      if (i >= 0) loadingListeners.splice(i, 1);
    };
  }

  // -----------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------

  var api = {
    get: get,
    post: post,
    isLoading: isLoading,
    onLoadingChange: onLoadingChange,
    ApiError: ApiError,
    _internal: {
      buildGetUrl: buildGetUrl_,
      getEndpoint: getEndpoint,
    },
  };

  root.api = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
