# 🥋 Review · Club Samoa — Sitio Web

> Revisión técnica y de producto del sitio de **Club Samoa**, escuela de artes marciales en Ciudad Madero, Tamaulipas (fundada en 1983).
>
> _Fecha del review: 21 jun 2026_

---

## 📊 Calificación general

| Área | Nota | Estado |
|------|:----:|:------:|
| Diseño & UX | 9 / 10 | 🟢 |
| Identidad de marca | 9 / 10 | 🟢 |
| Accesibilidad | 8 / 10 | 🟢 |
| SEO | 7 / 10 | 🟡 |
| Rendimiento | 5 / 10 | 🔴 |
| Seguridad (admin) | 4 / 10 | 🔴 |
| **Global** | **7 / 10** | 🟡 |

```
Diseño & UX        ███████████████████░  9/10
Identidad marca    ███████████████████░  9/10
Accesibilidad      ████████████████░░░░  8/10
SEO                ██████████████░░░░░░  7/10
Rendimiento        ██████████░░░░░░░░░░  5/10
Seguridad admin    ████████░░░░░░░░░░░░  4/10
```

---

## 🧱 Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 · CSS3 · JavaScript ES6 (vanilla, sin framework) |
| Estilos | CSS puro con variables custom · CSS Grid · Flexbox |
| Tipografía | Anton · Oswald · Inter · Teko (Google Fonts) |
| Fondo animado | WebGL (shaders de humo) |
| Backend | Google Apps Script + Google Sheets |
| Formularios | Google Forms · WhatsApp API |
| Build | Ninguno — deploy estático directo |

**Pesos:** ~18 MB total · ~3,260 líneas de código · **5.3 MB solo en imágenes**.

---

## 🗺️ Mapa del sitio

| Página | Contenido |
|--------|-----------|
| `index.html` | Hero · legado · horarios · contacto |
| `students.html` | Portal de alumnos: uniformes y exámenes |
| `community.html` | Precios · torneos · campeonatos |
| `admin/` | Panel MMA: eventos · atletas · brackets · marcador |

**Disciplinas:** Lima Lama · Kickboxing · Muay Thai · MMA · Jiu Jitsu.

---

## ✅ Lo que está muy bien

| 💪 Fortaleza | Detalle |
|-------------|---------|
| 🎨 **Dirección de arte** | Tema oscuro elegante (`#0c0907` + rojo marca `#f40706`), tipografía de impacto. Se siente premium y muy "marcial". |
| ♿ **Accesibilidad** | `aria-label`, `aria-expanded`, HTML semántico, navegación por teclado, alt text. |
| 📱 **Responsive** | Tipografía fluida con `clamp()`, media queries en 980 / 640 / 600 px. |
| ⚡ **Sin bundle** | Vanilla JS, deploy directo a cualquier hosting estático. Cero complejidad de build. |
| 🔗 **Backend serverless** | Google Apps Script + Sheets: cero costo de servidor, fácil de mantener. |

---

## ⚠️ Áreas de mejora

| Prioridad | Problema | Recomendación |
|:---------:|----------|---------------|
| 🔴 Alta | `clases.png` (**1.5 MB**) y `uniformes 2026.png` (**1.4 MB**) | Comprimir y convertir a **WebP** → objetivo < 300 KB c/u |
| 🔴 Alta | Admin sin autenticación real (URL "difícil de adivinar") | Añadir **login** antes de exponerlo públicamente |
| 🟡 Media | Sin `loading="lazy"` en imágenes | Activar lazy loading para mejorar carga inicial |
| 🟡 Media | Fondo WebGL siempre activo | Respetar `prefers-reduced-motion` y dar opción de apagarlo |
| 🟡 Media | Sin `<picture>` / srcset | Servir imágenes responsivas por tamaño de pantalla |
| 🟢 Baja | Sin JSON-LD ni Open Graph completo | Añadir datos estructurados (`LocalBusiness`) para SEO local |
| 🟢 Baja | JS sin minificar | Minificar para producción |

---

## 🎯 Impacto estimado de optimizar imágenes

```
Peso actual    ████████████████████  5.3 MB
Peso objetivo  ██████░░░░░░░░░░░░░░░  ~1.5 MB   (−70 %)
```

> Optimizar solo las dos imágenes más pesadas (`clases.png` + `uniformes 2026.png`) recortaría **~2.6 MB**, el mayor _quick win_ del sitio.

---

## 🏁 Veredicto

**Un sitio con identidad visual sobresaliente y arquitectura simple y sensata** para un club deportivo. La experiencia de marca es de primer nivel y el enfoque sin framework es acertado para el alcance del proyecto.

Los dos frenos reales son el **peso de las imágenes** (rendimiento) y la **falta de autenticación en el panel admin** (seguridad). Resueltos esos dos puntos, el sitio pasa de "muy bueno" a "excelente".

| 🥇 Próximos 3 pasos |
|---------------------|
| 1. Comprimir imágenes a WebP |
| 2. Añadir login al panel `admin/` |
| 3. Activar `loading="lazy"` + `prefers-reduced-motion` |
