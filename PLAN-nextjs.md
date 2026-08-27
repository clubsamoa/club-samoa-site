# PLAN — Migración a Next.js

> Blueprint de la migración del sitio de **Club Samoa** de HTML estático + JS vanilla a una web app **Next.js (App Router)**.
>
> _Fecha: 27 jul 2026_ · Documento hermano de `PRD-brackets-mma.md`, `TASKS.md` y `REVIEW.md`.

---

## 1. Punto de partida

| Capa | Hoy |
|------|-----|
| Sitio público | `index.html`, `students.html`, `community.html` + `styles.css` (1,724 líneas) + `script.js` + `smoke-background.js` (WebGL) |
| Panel admin | `admin/` — 6 páginas HTML + 15 módulos JS IIFE (~5,500 líneas) + `styles-admin.css` |
| Shell del admin | `admin/js/shell.js` inyecta header/sidebar por DOM a partir de `data-*` del `<body>` |
| Backend | 2 Web Apps de Google Apps Script + Google Sheets (`Code.gs` registros, `Eventos.gs` 2,486 líneas / 27 acciones) |
| Cliente HTTP | `admin/js/api.js` — `api.get(action, params)` / `api.post(action, payload)` contra `window.CLUB_SAMOA_EVENTOS_ENDPOINT` |
| Config | `registration-config.js` — endpoints hardcodeados en el cliente |
| Tests | 8 páginas `*.test.html` de ejecución manual en navegador |
| Build / deploy | Ninguno. Archivos servidos directamente. |
| Peso | ~18 MB, **5.3 MB solo en imágenes** |

**Superficie de la API de eventos (27 acciones):** `ping`, `setup`, `atletas.{list,get,create,update,archive,delete}`, `eventos.{list,get,create,update,setestatus,delete}`, `inscripciones.{list,create,setpesopesaje,setestatus,setcategoria,clearcategoria,delete}`, `brackets.{confirm,list,get,listfull,delete}`, `peleas.{update,get,next,finalize}`.

---

## 2. Por qué migrar

La migración se justifica si resuelve problemas reales. Estos son los que resuelve — tres de ellos son hallazgos abiertos de `REVIEW.md`:

| Problema actual | Qué lo resuelve en Next.js |
|-----------------|----------------------------|
| 🔴 **Rendimiento 5/10** — 5.3 MB de imágenes sin optimizar, sin `lazy`, sin `srcset` | `next/image`: WebP/AVIF automático, `srcset` por breakpoint, lazy por defecto. Es el mayor _quick win_ y sale casi gratis. |
| 🔴 **Admin sin autenticación** — protegido solo por "URL difícil de adivinar" | `middleware.ts` + Auth.js protegiendo `/admin` a nivel de servidor. Imposible sin backend propio. |
| 🔴 **Endpoints de Apps Script expuestos en el cliente** — `registration-config.js` está en el repo público; cualquiera puede escribir en las Sheets | Los endpoints pasan a variables de entorno del servidor; el navegador solo habla con `/api/*` de Next. |
| 🟡 SEO 7/10 — sin JSON-LD, OG incompleto | Metadata API, `sitemap.ts`, `robots.ts`, JSON-LD `LocalBusiness`. |
| 🟡 Duplicación de header/nav en 3 HTML + shell inyectado por DOM | Componentes y `layout.tsx`. El nav se escribe una vez. |
| 🟡 Tests manuales en `.test.html` | Vitest en CI sobre la lógica pura (reglamento, agrupación, SVG). |
| 🟡 Sin tipos: payloads del backend consumidos "a ciegas" | TypeScript + Zod validando lo que devuelve Apps Script. |

**Lo que la migración NO resuelve** (y conviene tener claro): la latencia de Apps Script (~1–3 s por request) y el hecho de que Google Sheets no es una base de datos transaccional. Eso se aborda —opcionalmente— en la Fase 6.

---

## 3. Decisiones de arquitectura

Cinco decisiones que definen el resto del plan. Cada una elige **el camino de menor riesgo**, porque el objetivo es migrar sin romper un sitio que hoy funciona.

### D1 — Apps Script se queda como backend (por ahora)

No se migran las Google Sheets a una base de datos en esta migración. `Eventos.gs` son 2,486 líneas de lógica de negocio probada (reglamento FAMM, agrupación de brackets, finalización de peleas); reescribirla y migrarla a la vez que se reescribe el frontend es cómo se rompen los proyectos.

**Cambio sí necesario:** el navegador deja de llamar a Apps Script directamente. Next.js expone Route Handlers (`/api/eventos/[...]`) que hacen el fetch en el servidor. Beneficios inmediatos:
- El endpoint de Apps Script nunca llega al cliente.
- Desaparece el problema de CORS (el hack de `Content-Type: text/plain` en `api.js:166` deja de ser necesario en el navegador).
- Se puede cachear (`revalidate`) lo que es de lectura pública.
- Se puede exigir sesión antes de proxyear una escritura.

### D2 — El CSS se conserva casi tal cual

`styles.css` y `styles-admin.css` se importan como CSS global desde `app/layout.tsx`. **No se reescribe a Tailwind ni a CSS Modules en esta migración.** La identidad visual está calificada 9/10 en el review: el riesgo de tocarla no compensa. Se migra el markup a JSX conservando los mismos nombres de clase, de modo que cualquier regresión visual sea un bug de markup y no de estilos.

Refactor a CSS Modules queda como trabajo posterior, archivo por archivo.

### D3 — Auth con Auth.js, proveedor Google, allowlist de correos

El club tiene pocos administradores. Login con Google + una allowlist de correos en variable de entorno evita gestionar contraseñas, hashes y recuperación de cuenta. `middleware.ts` protege `/admin/*`; los Route Handlers de escritura vuelven a verificar la sesión (nunca confiar solo en el middleware).

**Excepción deliberada:** `/scoreboard/publico` y la vista pública de bracket quedan **fuera** del gate — se proyectan en pantalla durante los eventos y no deben pedir login.

### D4 — El scoreboard mantiene su sincronía actual

`scoreboard.js` sincroniza con la vista pública vía `localStorage` + `BroadcastChannel` + `sessionStorage` (autosave, prefetch de la siguiente pelea). Eso funciona **solo entre pestañas del mismo navegador** — que es exactamente el caso de uso real: una laptop, el operador en una pestaña, el proyector en otra.

Se migra tal cual, envuelto en `'use client'` y con guardas de `typeof window`. **No se introduce WebSockets/SSE en esta migración.** Si algún día se necesita marcador en dispositivos separados, es un proyecto aparte.

### D5 — Migración por rutas, con convivencia

El sitio estático y la app Next conviven durante la migración: primero se levanta Next con el sitio público, se verifica en producción, y solo después se migra el admin. En ningún momento hay un "big bang". El corte de dominio ocurre en la Fase 5, con los estáticos aún en el repo como red de seguridad.

---

## 4. Stack objetivo

| Capa | Elección | Nota |
|------|----------|------|
| Framework | **Next.js 15+, App Router** | Server Components por defecto |
| Lenguaje | **TypeScript** en `strict` | |
| Estilos | CSS global existente | D2 |
| Fuentes | `next/font/google` | Anton, Oswald, Inter, Teko — self-hosted, sin FOUT ni preconnect |
| Imágenes | `next/image` | Resuelve el hallazgo 🔴 de rendimiento |
| Auth | **Auth.js v5** (`next-auth`), Google provider | D3 |
| Validación | **Zod** | Formularios + respuestas de Apps Script |
| Datos del cliente | **TanStack Query** en el admin | Reemplaza el estado manual + spinner de `api.js` |
| Tests unitarios | **Vitest** | Sustituye los `.test.html` |
| E2E | **Playwright** | Smoke de rutas críticas |
| Lint / formato | ESLint (`next/core-web-vitals`) + Prettier | |
| Hosting | **Netlify** | Ya alojaba el sitio del club (`clubsamoa.netlify.app`); su runtime de Next.js soporta `next/image`, Route Handlers y proxy — verificado en producción |
| Backend de datos | Apps Script + Sheets (sin cambios) | D1 |

---

## 5. Estructura destino

```
club-samoa-site/
├─ app/
│  ├─ layout.tsx                    # <html>, fuentes, CSS global, JSON-LD
│  ├─ page.tsx                      # index.html
│  ├─ alumnos/page.tsx              # students.html
│  ├─ comunidad/page.tsx            # community.html
│  ├─ sitemap.ts  robots.ts
│  ├─ (admin)/
│  │  ├─ layout.tsx                 # shell.js → layout real (header + sidebar)
│  │  ├─ admin/page.tsx
│  │  ├─ admin/atletas/page.tsx
│  │  ├─ admin/eventos/page.tsx
│  │  ├─ admin/eventos/[id]/page.tsx
│  │  ├─ admin/eventos/[id]/bracket/[bracketId]/page.tsx
│  │  └─ admin/scoreboard/[peleaId]/page.tsx
│  ├─ (publico)/
│  │  ├─ scoreboard/[eventoId]/page.tsx      # sin auth — proyección
│  │  └─ bracket/[bracketId]/page.tsx        # sin auth — vista pública
│  └─ api/
│     ├─ auth/[...nextauth]/route.ts
│     ├─ eventos/[...action]/route.ts        # proxy a Apps Script (D1)
│     └─ registros/route.ts                  # uniformes / exámenes
├─ components/
│  ├─ site/       Header, Nav, Footer, SmokeBackground, ScheduleTimeline…
│  ├─ admin/      AdminShell, Sidebar, AtletaForm, EventoForm, BracketSvg…
│  └─ ui/         Button, Modal, Toast, Spinner…
├─ lib/
│  ├─ apps-script.ts    # cliente server-side (ex admin/js/api.js)
│  ├─ schemas.ts        # Zod: Atleta, Evento, Inscripcion, Bracket, Pelea
│  ├─ reglamento.ts     # ex admin/js/reglamento.js — lógica pura, portada 1:1
│  ├─ bracket-builder.ts
│  └─ auth.ts
├─ content/
│  ├─ horarios.ts       # los horarios salen del HTML a datos tipados
│  ├─ precios.ts
│  └─ torneos.ts
├─ public/images/…
├─ registration-backend/            # sin cambios
└─ legacy/                          # los .html actuales, hasta el cutover
```

### Mapa de migración

| Origen | Destino |
|--------|---------|
| `index.html` | `app/page.tsx` + `components/site/*` + `content/horarios.ts` |
| `students.html` | `app/alumnos/page.tsx` + `app/api/registros/route.ts` |
| `community.html` | `app/comunidad/page.tsx` + `content/{precios,torneos}.ts` |
| `script.js` | Se disuelve: nav → `<Nav>`, formularios → Server Actions, año → render |
| `smoke-background.js` | `components/site/SmokeBackground.tsx` (`dynamic`, `ssr:false`) |
| `styles.css` / `styles-admin.css` | `app/globals.css` / `app/admin.css` (sin cambios de contenido) |
| `admin/js/api.js` | `lib/apps-script.ts` (servidor) + `lib/api-client.ts` (fetch a `/api`) |
| `admin/js/shell.js` | `app/(admin)/layout.tsx` — se elimina la inyección por DOM |
| `admin/js/reglamento.js` | `lib/reglamento.ts` — puerto 1:1, sin cambios de lógica |
| `admin/js/bracket-builder.js` | `lib/bracket-builder.ts` — puerto 1:1 |
| `admin/js/bracket-svg.js` | `components/admin/BracketSvg.tsx` — de `createElementNS` a JSX |
| `admin/js/scoreboard.js` (1,697 líneas) | `components/admin/Scoreboard/*` — troceado en 4–5 componentes |
| `admin/js/*.test.html` | `lib/__tests__/*.test.ts` (Vitest) |
| `registration-config.js` | `.env.local` / variables de entorno de Netlify |

### Rutas y redirecciones

Las URLs cambian de `.html` a rutas limpias. `next.config.ts` debe declarar redirects **301 permanentes** para no perder lo que ya está indexado ni romper enlaces compartidos por WhatsApp:

| Antes | Después |
|-------|---------|
| `/index.html` | `/` |
| `/students.html` | `/alumnos` |
| `/community.html` | `/comunidad` |
| `/admin/eventos.html` | `/admin/eventos` |
| `/admin/evento.html?id=X` | `/admin/eventos/X` |
| `/admin/bracket.html?id=X` | `/bracket/X` |
| `/admin/scoreboard.html?pelea=X` | `/admin/scoreboard/X` |
| `/admin/scoreboard-public.html?evento=X` | `/scoreboard/X` |

Los anchors (`#horarios`, `#uniformes`, `#examenes`, `#precios`, `#torneos`) deben conservarse **con el mismo `id`** — están enlazados desde los menús desplegables y probablemente desde redes.

---

## 6. Fases y tareas

Convenciones idénticas a `TASKS.md`: rama base `main`, naming `feat/NN-slug`, Conventional Commits, una tarea = una rama = un PR. La numeración arranca en **N01** (prefijo `next/`) para no chocar con las tareas 01–27 de `TASKS.md`.

Rama de integración: **`feat/nextjs-migration`**. Cada tarea sale de ahí y vuelve ahí; `main` solo recibe el merge final en la Fase 5.

---

### FASE 0 — Andamiaje (no cambia nada visible)

#### N01 · Scaffold de Next.js sobre el repo existente
**Branch:** `next/01-scaffold`

1. `npx create-next-app@latest` con TypeScript, App Router, ESLint, sin Tailwind, sin `src/`.
2. Mover los `.html`/`.js`/`.css` actuales a `legacy/` (sin borrarlos). Copiar `images/` y los tres `icon-*.png` a `public/`.
3. `.gitignore`: añadir `node_modules/`, `.next/`, `.env*.local`.
4. `.env.example` con `APPS_SCRIPT_REGISTROS_URL`, `APPS_SCRIPT_EVENTOS_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_ALLOWED_EMAILS`.
5. Prettier + script `npm run check` = `lint` + `tsc --noEmit`.

**Pruebas:** `npm run dev` levanta en `:3000`; `npm run build` pasa; `npm run check` limpio.
**Commit:** `chore(next): scaffold next.js app router con typescript`

#### N02 · Fuentes, CSS global y tokens
**Branch:** `next/02-estilos-base`

1. `app/globals.css` ← `legacy/styles.css` **sin editar el contenido**.
2. Anton / Oswald / Inter / Teko vía `next/font/google` con los mismos pesos; exponerlas como CSS variables y sustituir solo las declaraciones `font-family` del CSS por esas variables.
3. Eliminar los `<link>` a Google Fonts y los `preconnect`.
4. `app/layout.tsx`: `<html lang="es">`, favicon, `apple-touch-icon`, metadata base.

**Pruebas:** capturas de `/` en 1440 / 980 / 640 px comparadas contra el sitio actual — sin diferencias tipográficas ni de espaciado.
**Commit:** `feat(next): css global + fuentes self-hosted con next/font`

#### N03 · Header, nav y footer como componentes
**Branch:** `next/03-layout-publico`

1. `components/site/Header.tsx` + `Nav.tsx` con los dos dropdowns (Alumnos, Comunidad) como componente cliente: `aria-expanded`, cierre por click-outside y Escape — paridad exacta con `script.js:27-59`.
2. `Footer.tsx` con el año calculado en render (adiós `[data-year]`).
3. `components/site/SmokeBackground.tsx`: puerto de `smoke-background.js` en `useEffect`, montado con `dynamic(..., { ssr: false })`, **con guarda de `prefers-reduced-motion`** (hallazgo 🟡 de `REVIEW.md`) y cleanup del `requestAnimationFrame` al desmontar.

**Pruebas:** navegación por teclado en los dropdowns; con "reducir movimiento" activo en el SO no se inicializa el canvas WebGL.
**Commit:** `feat(next): header, nav y fondo webgl como componentes`

---

### FASE 1 — Sitio público

#### N04 · Home
**Branch:** `next/04-home`

1. `app/page.tsx` — puerto de `index.html`: hero, franja de legado, horarios, contacto, mapa CSS.
2. Los horarios salen del markup a `content/horarios.ts` tipado (`{ dias, disciplinas: [{ nombre, bloques[] }] }`) y se renderizan en un `<ScheduleTimeline>`. Actualizar horarios deja de ser editar HTML.
3. Conservar los `id` `#horarios` y `#contacto`.

**Pruebas:** diff visual contra `legacy/index.html` en las tres anchuras; los anchors de los dropdowns saltan a la sección correcta.
**Commit:** `feat(next): home migrada a app router`

#### N05 · Portal de alumnos + formularios
**Branch:** `next/05-alumnos`

1. `app/alumnos/page.tsx` — puerto de `students.html` con las secciones `#uniformes` y `#examenes` (3 formularios: 1 de uniforme, 2 de examen).
2. Esquemas Zod por tipo de formulario, incluida la validación de grupos de checkbox (`validateCheckboxGroups` en `script.js:97`).
3. **Server Action** que valida y hace POST a `APPS_SCRIPT_REGISTROS_URL` desde el servidor. Esto elimina el `mode: "no-cors"` de `script.js:195` — hoy el envío se da por bueno sin poder leer la respuesta; ahora se conoce el resultado real.
4. Panel de confirmación con `submission_id` generado **en el servidor**.

**Pruebas:** envío real de los 3 formularios → fila correcta en la Sheet; validación de campos requeridos y de grupos de checkbox; error del backend visible en pantalla (hoy es invisible).
**Commit:** `feat(next): portal de alumnos con server actions y validacion zod`

#### N06 · Comunidad
**Branch:** `next/06-comunidad`

1. `app/comunidad/page.tsx` — puerto de `community.html`, secciones `#precios` y `#torneos`.
2. Precios y torneos a `content/precios.ts` y `content/torneos.ts`.
3. Los pósters de torneos (`campeonato-nacional-2026.jpg`, `estatal-znorte2026.jpeg`, `regional2026.jpg`, IMMAF) vía `next/image`.

**Pruebas:** diff visual; enlaces externos con `rel="noreferrer"` y `target="_blank"`.
**Commit:** `feat(next): pagina de comunidad con contenido tipado`

#### N07 · Imágenes y rendimiento
**Branch:** `next/07-imagenes`

1. Todas las `<img>` → `next/image` con `width`/`height` reales (evita CLS).
2. `priority` únicamente en el hero (`valeria.jpg`); el resto lazy por defecto.
3. `clases.png` (1.5 MB) y `uniformes 2026.png` (1.4 MB): recomprimir en origen además de dejar que Next sirva WebP/AVIF — los 2.6 MB de `REVIEW.md`.
4. Renombrar `uniformes 2026.png` → `uniformes-2026.png` (el espacio en el nombre es una fuente segura de bugs de URL).

**Pruebas:** Lighthouse en `/` móvil ≥ 90 en Performance; el DevTools Network de la home baja de ~5 MB a < 1 MB.
**Commit:** `perf(next): next/image en todo el sitio publico`

#### N08 · SEO y metadata
**Branch:** `next/08-seo`

1. `metadata` por ruta: title, description, canonical, Open Graph, Twitter Card.
2. JSON-LD `LocalBusiness` / `SportsActivityLocation` en `layout.tsx`: dirección (Allende #300 Sur, Zona Centro, Ciudad Madero), teléfono, horarios, perfiles sociales, fundación 1983.
3. `app/sitemap.ts` y `app/robots.ts`.
4. Los redirects 301 de §5 en `next.config.ts`.

**Pruebas:** Rich Results Test valida el JSON-LD; `curl -I /students.html` → `301` a `/alumnos`; `/sitemap.xml` lista las 3 rutas públicas.
**Commit:** `feat(next): metadata, json-ld y redirects 301`

> **🚦 Hito 1 — el sitio público ya se puede desplegar.** Deploy a Netlify en un dominio de preview, validación de una semana, y recién entonces se sigue con el admin.

---

### FASE 2 — Capa de datos y auth

#### N09 · Cliente server-side de Apps Script + tipos del dominio
**Branch:** `next/09-apps-script-client`

1. `lib/apps-script.ts`: `appsScript.get(action, params)` / `.post(action, payload)` — puerto de `admin/js/api.js` **sin** el spinner ni el contador de requests (eso pasa a TanStack Query), y con `timeout` + 1 reintento (Apps Script tiene cold starts de varios segundos).
2. `lib/schemas.ts`: Zod para `Atleta`, `Evento`, `Inscripcion`, `Bracket`, `Pelea` + tipos inferidos.
3. Mantener el mapeo `{ ok: false, error }` → excepción tipada, igual que `api.js:205`.
4. Las Sheets siguen siendo la fuente de verdad; Zod es una red que avisa cuando la forma de los datos cambia.

**Pruebas:** Vitest con respuestas de Apps Script mockeadas — camino feliz, `ok:false`, respuesta no-JSON, timeout.
**Commit:** `feat(next): cliente server-side de apps script con validacion zod`

#### N10 · Route Handlers proxy
**Branch:** `next/10-api-routes`

1. `app/api/eventos/[...action]/route.ts`: mapea `GET /api/eventos/atletas.list` y `POST /api/eventos/peleas.update` a las 27 acciones del backend.
2. **Allowlist explícita de acciones.** Nada de pasar el path directo a Apps Script.
3. Las acciones de escritura (`*.create|update|delete|archive|confirm|finalize|set*`) exigen sesión — se activa en N11.
4. `lib/api-client.ts`: el fetch que usa el navegador contra `/api/*`, tipado.
5. Cache: `revalidate` corto en lecturas públicas (bracket, scoreboard público); `no-store` en todo lo del admin.

**Pruebas:** cada una de las 27 acciones responde igual que la llamada directa a Apps Script; una acción fuera de la allowlist devuelve 404; `APPS_SCRIPT_EVENTOS_URL` no aparece en ningún bundle del cliente (`grep -r "script.google.com" .next/static/`).
**Commit:** `feat(next): route handlers proxy hacia apps script`

#### N11 · Autenticación del admin
**Branch:** `next/11-auth`

1. Auth.js v5 con Google provider; `signIn` restringido por `ADMIN_ALLOWED_EMAILS`.
2. `middleware.ts` protege `/admin/*` — **excluyendo** `/scoreboard/*` y `/bracket/*` (D3).
3. Verificación de sesión **también** dentro de los Route Handlers de escritura.
4. Página `/login` y botón de salir en el shell del admin.

**Pruebas:** `/admin/eventos` sin sesión → redirect a `/login`; correo fuera de la allowlist → acceso denegado; `POST /api/eventos/atletas.create` sin cookie → 401; `/scoreboard/X` sigue abierto sin sesión.
**Commit:** `feat(next): auth.js con allowlist protegiendo el admin`

> **🔐 Al terminar N11: redesplegar los dos Web Apps de Apps Script con URL nueva** y meter las nuevas URLs solo en las variables de entorno de Netlify. Las URLs actuales están en `registration-config.js`, versionado en un repo público — hay que asumirlas comprometidas. Este paso es el que realmente cierra el agujero.

---

### FASE 3 — Panel admin

#### N12 · Shell del admin
**Branch:** `next/12-admin-shell`

1. `app/(admin)/layout.tsx` reemplaza `admin/js/shell.js`: header, sidebar (Eventos, Atletas), estado activo por `usePathname()`, breadcrumb.
2. `admin.css` ← `legacy/admin/styles-admin.css` sin cambios.
3. Proveedor de TanStack Query + un `<Toaster>` para errores de API (hoy hay `alert()` y estados sueltos).
4. Título/subtítulo vía `metadata` por página, no vía `data-*` del `<body>`.

**Pruebas:** las 6 rutas del admin renderizan con sidebar correcto y el item activo marcado.
**Commit:** `feat(admin): shell como layout de app router`

#### N13 · Atletas
**Branch:** `next/13-atletas`

Puerto de `atletas-listado.js` (402) + `atletas-form.js` (470). Listado con búsqueda y filtros, alta/edición en modal, archivar y borrar con confirmación. `lib/reglamento.ts` (puerto 1:1 de `reglamento.js`, 478 líneas) alimenta el cálculo de categoría por edad/peso/género.

**Pruebas:** Vitest sobre `lib/reglamento.ts` con los casos de `reglamento.test.html`; manual: CRUD completo contra la Sheet real.
**Commit:** `feat(admin): modulo de atletas en next`

#### N14 · Eventos: listado y alta
**Branch:** `next/14-eventos`

Puerto de `eventos-listado.js` (314) + `eventos-form.js` (268). Listado por estatus, creación/edición, cambio de estatus, borrado.
**Commit:** `feat(admin): listado y formulario de eventos`

#### N15 · Evento: inscripciones y pesaje
**Branch:** `next/15-evento-detalle`

`app/(admin)/admin/eventos/[id]/page.tsx` con tabs. Puerto de `evento.js` (337), `evento-inscripciones.js` (221), `inscripciones-form.js` (349) y `evento-pesaje.js` (519). El pesaje es la pantalla de mayor presión operativa (se usa el día del evento, contrarreloj): optimistic updates de TanStack Query e indicador claro de guardado.
**Commit:** `feat(admin): inscripciones y pesaje del evento`

#### N16 · Brackets
**Branch:** `next/16-brackets`

Puerto de `bracket-builder.js` (299) → `lib/bracket-builder.ts`; `evento-brackets.js` (717) → componentes; `bracket-svg.js` (370) → `<BracketSvg>` en JSX (de `createElementNS` imperativo a declarativo — el mayor beneficio estructural de toda la migración). Preview → confirmar → ver.

**Pruebas:** Vitest sobre `bracket-builder.ts` con los casos de `bracket-builder.test.html`; snapshot del SVG comparado contra el render actual.
**Commit:** `feat(admin): brackets con svg declarativo`

#### N17 · Scoreboard
**Branch:** `next/17-scoreboard`

La tarea más delicada: 1,697 líneas. Trocear `scoreboard.js` en `<Timer>`, `<PuntosPanel>`, `<FaltasPanel>`, `<FinalizarModal>` bajo un `useReducer` que centralice el estado de la pelea. Conservar tal cual (D4): autosave a `localStorage`, `BroadcastChannel`, prefetch de la siguiente pelea en `sessionStorage`, atajos de teclado y edición de resultado post-finalización (`feat/23`, la rama en curso — **hay que mergearla a `main` antes de empezar esta tarea**).

⚠️ El timer usa `setInterval` a 1 s (`scoreboard.js:518`); en React hay que anclarlo a `Date.now()` en cada tick, no acumular, o derivará bajo re-renders.

**Pruebas:** Playwright — pelea completa: iniciar, puntos, advertencia, pausa, recargar la página (recupera de `localStorage`), finalizar; y una segunda pestaña pública reflejando los cambios.
**Commit:** `feat(admin): scoreboard como componentes react`

#### N18 · Vistas públicas: scoreboard y bracket
**Branch:** `next/18-vistas-publicas`

`app/(publico)/scoreboard/[eventoId]` (puerto de `scoreboard-public.html`, 417 líneas) y `app/(publico)/bracket/[bracketId]` (`bracket.html`). Sin auth, optimizadas para proyector: tipografía grande, fondo oscuro, sin chrome. Puerto de `evento-resumen.js` (314) para el cierre del evento.
**Commit:** `feat(publico): scoreboard y bracket de proyeccion`

---

### FASE 4 — Calidad

#### N19 · Suite de tests
**Branch:** `next/19-tests`

1. Vitest sobre `lib/`: `reglamento`, `bracket-builder`, `apps-script`, `schemas` — portando los casos de los 8 `.test.html`.
2. Playwright: home carga y navega; envío de formulario de uniforme; login del admin; flujo evento → inscripción → bracket → pelea.
3. GitHub Actions: `lint` + `tsc` + `vitest` en cada PR.
4. Borrar los `.test.html` una vez portados.

**Commit:** `test(next): vitest + playwright + ci`

#### N20 · Accesibilidad y pulido
**Branch:** `next/20-a11y`

Auditoría axe en las 3 páginas públicas + admin; foco visible y orden de tabulación en modales; `aria-live` en los estados de formulario y en el marcador; contraste verificado. El review daba 8/10 — el objetivo es no perder terreno con el cambio de markup.
**Commit:** `fix(a11y): correcciones tras auditoria de la migracion`

---

### FASE 5 — Cutover

#### N21 · Deploy y corte de dominio
**Branch:** `next/21-deploy`

1. Proyecto en Netlify; variables de entorno de producción (con las URLs de Apps Script **rotadas**, ver N11).
2. Preview deploy revisado a fondo: las 3 páginas públicas, los 3 formularios contra la Sheet real, un evento de prueba completo de punta a punta.
3. Apuntar el dominio real a Netlify. Verificar los 301 de §5 en producción.
4. Netlify Analytics + Speed Insights.
5. Merge de `feat/nextjs-migration` a `main`.
6. **`legacy/` se conserva una semana más** y se borra en un commit aparte, ya con tráfico real validado.

**Pruebas:** Lighthouse ≥ 90 en las 3 públicas; formularios funcionando en producción; login del admin con las cuentas reales; un evento real operado de principio a fin.
**Commit:** `chore(deploy): cutover a netlify` → luego `chore: eliminar sitio estatico legacy`

---

### FASE 6 — Post-migración (opcional, no bloquea nada)

| # | Qué | Por qué |
|---|-----|---------|
| N22 | Migrar Sheets → Postgres (Neon/Supabase) + Drizzle | Elimina la latencia de 1–3 s y da transaccionalidad real. Solo si el volumen de eventos lo justifica. |
| N23 | Scoreboard en tiempo real vía SSE | Permitiría el marcador en dispositivos separados (hoy es una sola máquina, D4). |
| N24 | CSS global → CSS Modules por componente | Deuda conocida de D2. Archivo por archivo, sin prisa. |
| N25 | PWA / offline en el pesaje | El gimnasio puede tener mal wifi el día del evento. |
| N26 | CMS ligero para horarios y precios | Que el club edite sin tocar código ni esperar un deploy. |

---

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|:-------:|------------|
| **Regresión visual** al pasar 3,000+ líneas de HTML a JSX | Alto | D2: no se toca el CSS. Capturas antes/después en 3 anchuras por cada tarea de puerto. |
| **`scoreboard.js`** (1,697 líneas de estado imperativo) mal portado | Alto | N17 aislada, con Playwright cubriendo una pelea completa. Ensayo con un evento real antes del cutover. |
| **Apps Script rate limits** (cuotas por usuario/día) | Medio | Los Route Handlers ahora llaman con la identidad del servidor: se centralizan y se pueden cachear. Monitorear tras el cutover. |
| **Endpoints ya comprometidos** en el repo público | Alto | Rotación obligatoria tras N11. No es opcional. |
| **Migración a medias** que se estanca | Medio | Hito 1: el sitio público sale a producción por sí solo. Si el admin se retrasa, lo ya hecho ya está entregando valor. |
| **Pérdida de SEO** por cambio de URLs | Medio | Redirects 301 en N08 + sitemap. Verificar en Search Console tras el corte. |
| **Coste de Netlify** | Bajo | El plan gratuito cubre de sobra este tráfico. Vigilar las transformaciones de `next/image` y los minutos de build. |
| **Complejidad nueva** (build, deps, CI) donde antes había cero | Medio | Real y hay que asumirlo: se cambia simplicidad por auth, rendimiento y tipos. Es el precio de resolver los 🔴 del review. |

---

## 8. Definition of done

La migración está terminada cuando:

- [ ] Las 3 páginas públicas son visualmente idénticas al sitio actual en 1440 / 980 / 640 px.
- [ ] Lighthouse móvil ≥ 90 en Performance en `/`, `/alumnos` y `/comunidad`.
- [ ] La home pesa < 1 MB en la primera carga (hoy ~5 MB).
- [ ] Los 3 formularios de registro escriben en la Sheet **y reportan errores reales** al usuario.
- [ ] `/admin/*` exige sesión; `/scoreboard/*` y `/bracket/*` siguen abiertos.
- [ ] Ninguna URL de Apps Script aparece en un bundle del cliente, y las URLs viejas están rotadas.
- [ ] Las 27 acciones del backend funcionan a través de los Route Handlers.
- [ ] Un evento completo —inscripción, pesaje, bracket, peleas, resumen— operado de punta a punta en la app nueva.
- [ ] Vitest y Playwright verdes en CI.
- [ ] Redirects 301 activos para las 8 URLs de §5.
- [ ] `legacy/` eliminado.

## 9. Plan de reversión

Hasta N21, la reversión es trivial: el sitio estático sigue en `legacy/` y sirviéndose desde el hosting actual. Después del corte de dominio, revertir = apuntar el DNS de vuelta. Por eso `legacy/` no se borra hasta una semana después del cutover, en un commit propio y fácil de revertir.

Apps Script y las Sheets **no se tocan en ningún momento** de este plan — el dato queda intacto pase lo que pase. Esa es la razón de fondo de la decisión D1.
