/* Smoke background — vanilla port of the React WebGL shader.
 *
 * Self-mounts a fixed, full-viewport <canvas id="smoke-bg-canvas"> behind page
 * content and animates a tinted noise/smoke effect using WebGL2.
 *
 * Tint color defaults to the Club Samoa brand red (#f40706). Override on a
 * per-page basis by setting `window.__SMOKE_COLOR__ = "#hexcode"` BEFORE this
 * script loads, or by calling `window.SmokeBackground.setColor("#hex")` at
 * any time after.
 */
(function () {
  "use strict";

  var DEFAULT_COLOR = "#f40706";

  var FRAGMENT_SRC = [
    "#version 300 es",
    "precision highp float;",
    "out vec4 O;",
    "uniform float time;",
    "uniform vec2 resolution;",
    "uniform vec3 u_color;",
    "#define FC gl_FragCoord.xy",
    "#define R resolution",
    "#define T (time+660.)",
    "float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}",
    "float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}",
    "void main(){",
    "  vec2 uv=(FC-.5*R)/R.y;",
    "  vec3 col=vec3(1);",
    "  uv.x+=.25;",
    "  uv*=vec2(2,1);",
    "  float n=fbm(uv*.28-vec2(T*.01,0));",
    "  n=noise(uv*3.+n*2.);",
    "  col.r-=fbm(uv+vec2(0,T*.015)+n);",
    "  col.g-=fbm(uv*1.003+vec2(0,T*.015)+n+.003);",
    "  col.b-=fbm(uv*1.006+vec2(0,T*.015)+n+.006);",
    "  col=mix(col, u_color, dot(col,vec3(.21,.71,.07)));",
    "  col=mix(vec3(.08),col,min(time*.1,1.));",
    "  col=clamp(col,.08,1.);",
    "  O=vec4(col,1);",
    "}",
  ].join("\n");

  var VERTEX_SRC = [
    "#version 300 es",
    "precision highp float;",
    "in vec4 position;",
    "void main(){gl_Position=position;}",
  ].join("\n");

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return [
      parseInt(m[1], 16) / 255,
      parseInt(m[2], 16) / 255,
      parseInt(m[3], 16) / 255,
    ];
  }

  function ensureCanvas() {
    var existing = document.getElementById("smoke-bg-canvas");
    if (existing) return existing;
    var canvas = document.createElement("canvas");
    canvas.id = "smoke-bg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    // Inline fallback styles in case styles.css hasn't loaded yet.
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "-2";
    canvas.style.pointerEvents = "none";
    canvas.style.display = "block";
    if (document.body) {
      document.body.insertBefore(canvas, document.body.firstChild);
    } else {
      document.documentElement.appendChild(canvas);
    }
    return canvas;
  }

  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Smoke shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function start() {
    var canvas = ensureCanvas();
    var gl = canvas.getContext("webgl2");
    if (!gl) {
      // WebGL2 not available — leave the canvas in place but skip animation.
      // The CSS overlay/fallback color keeps the page legible.
      console.warn("WebGL2 not supported; smoke background disabled.");
      return;
    }

    var color = hexToRgb(window.__SMOKE_COLOR__ || DEFAULT_COLOR) ||
                hexToRgb(DEFAULT_COLOR);

    var vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) return;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Smoke program link error:", gl.getProgramInfoLog(program));
      return;
    }

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
      gl.STATIC_DRAW
    );
    var positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    var uResolution = gl.getUniformLocation(program, "resolution");
    var uTime = gl.getUniformLocation(program, "time");
    var uColor = gl.getUniformLocation(program, "u_color");

    function resize() {
      var dpr = Math.max(1, window.devicePixelRatio || 1);
      var width = window.innerWidth;
      var height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    resize();
    window.addEventListener("resize", resize);

    var rafId = 0;
    function frame(now) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 1e-3);
      gl.uniform3fv(uColor, color);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = window.requestAnimationFrame(frame);
    }
    rafId = window.requestAnimationFrame(frame);

    // Pause when the tab is hidden to save battery.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        window.cancelAnimationFrame(rafId);
      } else {
        rafId = window.requestAnimationFrame(frame);
      }
    });

    // Public API.
    window.SmokeBackground = {
      setColor: function (hex) {
        var rgb = hexToRgb(hex);
        if (rgb) color = rgb;
      },
      destroy: function () {
        window.cancelAnimationFrame(rafId);
        window.removeEventListener("resize", resize);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
