# TASKS — Migración a Next.js

Plan de ejecución de `PLAN-nextjs.md`. Cada tarea es independientemente testable y se ejecuta en su propio branch.

---

## Convenciones

- **Rama de integración:** `feat/nextjs-migration` (sale de `main`). Todas las tareas salen de ahí y vuelven ahí. `main` solo recibe el merge final en N21.
- **Naming de ramas:** `next/NN-slug-corto` donde `NN` es el número de tarea de este documento.
- **Antes de cada tarea:** `git checkout feat/nextjs-migration && git pull && git checkout -b next/NN-slug`
- **Al terminar:** commit → `git push -u origin next/NN-slug` → PR contra `feat/nextjs-migration` → merge.
- **Mensajes de commit:** Conventional Commits, igual que `TASKS.md`.
- **Definición de "terminada":** `npm run check` (lint + `tsc --noEmit`) limpio, tests verdes, y las pruebas manuales de la tarea ejecutadas.
- **Estimaciones:** `S` < 2 h · `M` 2–5 h · `L` 1–2 días · `XL` 2–4 días.
- **Comparación visual:** para toda tarea de puerto de UI, capturar el sitio actual **antes** de empezar (1440 / 980 / 640 px) y comparar al terminar. Guardar en `docs/visual-baseline/` (no versionar los PNG grandes: `.gitignore`).

---

## Tablero

| # | Tarea | Fase | Est. | Depende de | Estado |
|---|-------|------|:----:|------------|:------:|
| N00 | Prerrequisitos | — | S | — | ⬜ |
| N01 | Scaffold de Next.js | 0 | M | N00 | ⬜ |
| N02 | Fuentes y CSS global | 0 | M | N01 | ⬜ |
| N03 | Header, nav y fondo WebGL | 0 | L | N02 | ⬜ |
| N04 | Home | 1 | L | N03 | ⬜ |
| N05 | Portal de alumnos + formularios | 1 | L | N03 | ⬜ |
| N06 | Comunidad | 1 | M | N03 | ⬜ |
| N07 | Imágenes y rendimiento | 1 | M | N04, N05, N06 | ⬜ |
| N08 | SEO, metadata y redirects | 1 | M | N04, N05, N06 | ⬜ |
| — | **🚦 Hito 1 — deploy del sitio público** | — | — | N07, N08 | ⬜ |
| N09 | Cliente server-side + tipos | 2 | L | N01 | ⬜ |
| N10 | Route Handlers proxy | 2 | L | N09 | ⬜ |
| N11 | Auth del admin + rotación de endpoints | 2 | L | N10 | ⬜ |
| N12 | Shell del admin | 3 | M | N11 | ⬜ |
| N13 | Atletas | 3 | L | N12 | ⬜ |
| N14 | Eventos: listado y alta | 3 | M | N12 | ⬜ |
| N15 | Evento: inscripciones y pesaje | 3 | XL | N13, N14 | ⬜ |
| N16 | Brackets | 3 | XL | N15 | ⬜ |
| N17 | Scoreboard | 3 | XL | N16 | ⬜ |
| N18 | Vistas públicas de proyección | 3 | L | N17 | ⬜ |
| N19 | Tests y CI | 4 | L | N18 | ⬜ |
| N20 | Accesibilidad y pulido | 4 | M | N18 | ⬜ |
| N21 | Deploy y cutover | 5 | L | N19, N20 | ⬜ |

**Se pueden paralelizar:** N04/N05/N06 entre sí · N09 con toda la Fase 1 · N19 y N20 entre sí.
**Camino crítico:** N01 → N02 → N03 → N09 → N10 → N11 → N12 → N15 → N16 → N17 → N21.

---

# FASE 0 — Andamiaje

## Tarea N00: Prerrequisitos

**Branch:** ninguno (trabajo de setup, fuera del repo)
**Estimación:** S

**Qué hacer:**
1. **Mergear `feat/23-editar-resultado` a `main`.** Es la rama en curso y N17 debe portar el scoreboard *con* la edición de resultado post-finalización. Si se queda sin mergear, se porta código viejo.
2. Verificar Node ≥ 20 (`node -v`). Next 15 lo requiere.
3. Crear las credenciales OAuth en Google Cloud Console: proyecto → "Credenciales" → ID de cliente OAuth 2.0 tipo *Aplicación web*. URIs de redirección autorizados: `http://localhost:3000/api/auth/callback/google` y (más adelante) el de producción. Guardar `client_id` y `client_secret`.
4. Decidir la lista de correos con acceso al admin (`ADMIN_ALLOWED_EMAILS`).
5. Confirmar dónde está apuntando hoy el dominio y quién tiene acceso al DNS — se necesita en N21.
6. Crear la rama de integración: `git checkout main && git pull && git checkout -b feat/nextjs-migration && git push -u origin feat/nextjs-migration`.

**Criterio de aceptación:** `main` contiene `feat/23`; existen las credenciales OAuth; la rama `feat/nextjs-migration` está en `origin`.

---

## Tarea N01: Scaffold de Next.js sobre el repo existente

**Branch:** `next/01-scaffold`
**Estimación:** M · **Depende de:** N00

**Qué hacer:**
1. `npx create-next-app@latest` en un directorio temporal con: TypeScript ✓, ESLint ✓, App Router ✓, Tailwind ✗, `src/` ✗, import alias `@/*` ✓. Copiar el resultado a la raíz del repo.
2. `git mv` de los archivos actuales a `legacy/`: `index.html`, `students.html`, `community.html`, `styles.css`, `script.js`, `smoke-background.js`, `registration-config.js`, `admin/`. **No borrar nada.**
3. Copiar `images/` y los tres `icon-*.png` a `public/`. Renombrar `uniformes 2026.png` → `uniformes-2026.png` (el espacio en el nombre rompe URLs).
4. `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`.
5. `.gitignore`: añadir `node_modules/`, `.next/`, `.env*.local`, `docs/visual-baseline/`, `/playwright-report/`, `/test-results/`.
6. Crear `.env.example` (versionado) y `.env.local` (ignorado) con:
   ```
   APPS_SCRIPT_REGISTROS_URL=
   APPS_SCRIPT_EVENTOS_URL=
   AUTH_SECRET=
   AUTH_GOOGLE_ID=
   AUTH_GOOGLE_SECRET=
   ADMIN_ALLOWED_EMAILS=
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   Poblar `.env.local` con los valores actuales de `legacy/registration-config.js`.
7. Prettier + `package.json` script: `"check": "next lint && tsc --noEmit"`.
8. Excluir `legacy/` de ESLint y de `tsconfig` para que no rompa el build.

**Pruebas:**
- `npm run dev` levanta en `:3000` con la página por defecto.
- `npm run build` termina sin errores.
- `npm run check` limpio.
- `ls public/images/` muestra las 17 imágenes; ningún nombre de archivo contiene espacios.

**Criterio de aceptación:** el repo tiene una app Next funcional y el sitio estático intacto bajo `legacy/`.

**Commit sugerido:** `chore(next): scaffold next.js app router con typescript`

---

## Tarea N02: Fuentes, CSS global y tokens

**Branch:** `next/02-estilos-base`
**Estimación:** M · **Depende de:** N01

**Qué hacer:**
1. `cp legacy/styles.css app/globals.css` — **sin editar el contenido**, salvo el paso 3.
2. `cp legacy/admin/styles-admin.css app/admin.css` (se importará en N12).
3. En `app/layout.tsx`, declarar las cuatro fuentes con `next/font/google` respetando los pesos actuales:
   - Anton (400), Oswald (600, 700), Inter (400, 500, 600, 700, 800), Teko (500, 600, 700), `display: "swap"`, `subsets: ["latin"]`.
   - Exponerlas como CSS variables (`variable: "--font-anton"`, etc.) en el `className` del `<html>`.
4. En `globals.css`, sustituir **solo** las declaraciones `font-family: "Anton", ...` por `font-family: var(--font-anton), sans-serif`. No tocar nada más del archivo.
5. `app/layout.tsx`: `<html lang="es">`, `metadata` base con `title`, `description`, `icons` (`/images/logo-black.png` como icon y apple-touch-icon).
6. Verificar que **no** queda ningún `<link>` a `fonts.googleapis.com` ni `preconnect`.

**Pruebas:**
- Capturas de `/` (aunque todavía esté vacía) y del `<body>` con clases de prueba: los cuatro `font-family` resuelven a la fuente correcta en DevTools → Computed.
- Network: cero requests a `fonts.googleapis.com` / `fonts.gstatic.com`.
- `git diff` de `app/globals.css` contra `legacy/styles.css` muestra **solo** cambios de `font-family`.

**Criterio de aceptación:** las fuentes se sirven desde el propio dominio y el CSS es byte-equivalente salvo las variables de fuente.

**Commit sugerido:** `feat(next): css global + fuentes self-hosted con next/font`

---

## Tarea N03: Header, nav y fondo WebGL como componentes

**Branch:** `next/03-layout-publico`
**Estimación:** L · **Depende de:** N02

**Qué hacer:**
1. `components/site/Header.tsx` (server component): lockup de marca (logo + "CLUB SAMOA" / "ESCUELA DE ARTES MARCIALES") y los enlaces sociales del header (Instagram, Facebook, CTA de WhatsApp a `https://wa.me/528333110858`).
2. `components/site/Nav.tsx` (`'use client'`): puerto de `legacy/script.js:13-59`. Debe conservar exactamente:
   - Enlaces: Inicio, Horarios (`/#horarios`), dropdown **Alumnos**, dropdown **Comunidad**, Contacto (`/#contacto`).
   - Dropdown Alumnos → `/alumnos`, `/alumnos#uniformes`, `/alumnos#examenes`.
   - Dropdown Comunidad → `/comunidad`, `/comunidad#precios`, `/comunidad#torneos`.
   - `aria-expanded` sincronizado, `aria-controls`, cierre al hacer click fuera, cierre con `Escape`, click dentro del menú no cierra.
   - `aria-current="page"` en la ruta activa vía `usePathname()`.
3. `components/site/Footer.tsx`: año calculado en render (elimina `[data-year]` de `script.js:216`).
4. `components/site/SmokeBackground.tsx` (`'use client'`): puerto de `legacy/smoke-background.js` (192 líneas) dentro de `useEffect`.
   - Montar con `dynamic(() => import(...), { ssr: false })`.
   - **Guarda nueva:** si `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, no inicializar WebGL (hallazgo 🟡 de `REVIEW.md`).
   - Cleanup en el return del `useEffect`: `cancelAnimationFrame`, remover listener de `resize`, y liberar el contexto WebGL. Sin esto se filtran contextos en cada navegación cliente.
   - Guarda de "WebGL no disponible" → no romper la página.
5. Ensamblar en `app/layout.tsx`: `<SmokeBackground />`, `.page-shell` con `<Header>`, `{children}`, `<Footer>`.

**Pruebas:**
- Teclado: `Tab` llega a los toggles, `Enter`/`Space` abren, `Escape` cierra, el foco no se pierde.
- Con "Reducir movimiento" activo en macOS, el `<canvas>` no se crea (verificar en DevTools → Elements).
- Navegar `/` → `/alumnos` → `/` cinco veces y comprobar en DevTools → Memory que no crecen los contextos WebGL.
- Screen reader (VoiceOver): el estado abierto/cerrado del dropdown se anuncia.

**Criterio de aceptación:** el header se comporta igual que el actual y el fondo respeta `prefers-reduced-motion`.

**Commit sugerido:** `feat(next): header, nav y fondo webgl como componentes`

---

# FASE 1 — Sitio público

## Tarea N04: Home

**Branch:** `next/04-home`
**Estimación:** L · **Depende de:** N03

**Qué hacer:**
1. `content/horarios.ts` — extraer los horarios de `legacy/index.html:186-253` a datos tipados:
   ```ts
   export type BloqueHorario = { inicio: string; fin: string; nota?: string }
   export type GrupoDisciplina = { disciplina: string; bloques: BloqueHorario[] }
   export type BloqueDias = { dias: string; grupos: GrupoDisciplina[] }
   ```
   Dos entradas: *Lunes, Miércoles y Viernes* (Kickboxing 09–10; Lima Lama Kids 17–18 y 18–19; Muay Thai 19–20; MMA 20–21) y *Martes y Jueves* (Jiu Jitsu 09–10; MMA Kids 17–18; Kickboxing 18–19 "Niños" y 19–20 "Jóvenes y adultos"; Jiu Jitsu 20–21).
2. `components/site/ScheduleTimeline.tsx` — renderiza `content/horarios.ts` con el markup actual (`.schedule-event`, `.schedule-node`, `.schedule-card`, `.schedule-days`, `.schedule-groups`, `.schedule-group`).
3. `app/page.tsx` — puerto de `legacy/index.html:93-333`:
   - Hero (`.hero`): eyebrow "Desde 1983", H2, texto, 3 botones, panel con foto de Valeria y los 3 `.hero-stat`.
   - Franja de legado (`.legacy-band`) con la dirección.
   - Sección de horarios con `id="horarios"`.
   - Sección de contacto con `id="contacto"`.
   - Mapa CSS (`.contact-map`, ~35 spans decorativos) — copiar tal cual, es puro adorno con `aria-hidden`.
4. Conservar los `id` `horarios` y `contacto` exactos (los enlaza el nav).
5. Extraer el número de WhatsApp a `lib/constants.ts` (`WHATSAPP_URL`) — hoy está repetido 5 veces en el HTML.

**Pruebas:**
- Diff visual contra `legacy/index.html` en 1440 / 980 / 640 px: sin diferencias perceptibles.
- `/#horarios` y `/#contacto` saltan a la sección correcta, también entrando desde `/alumnos`.
- Los enlaces externos abren en pestaña nueva con `rel="noreferrer"`.
- El mapa lleva a `https://maps.app.goo.gl/XJic3zwHiYcTWni7A`.

**Criterio de aceptación:** la home es indistinguible de la actual y los horarios ya no viven en el markup.

**Commit sugerido:** `feat(next): home migrada a app router`

---

## Tarea N05: Portal de alumnos + formularios

**Branch:** `next/05-alumnos`
**Estimación:** L · **Depende de:** N03

**Qué hacer:**
1. `app/alumnos/page.tsx` — puerto de `legacy/students.html` (448 líneas), con **tres** secciones:
   - `#uniformes` — pedido de uniformes.
   - `#examenes` — exámenes de Lima Lama y Kickboxing.
   - `#examenes-mma-jiujitsu` — exámenes de MMA y JiuJitsu.
2. `lib/schemas.ts` — Zod por tipo de formulario:
   - **Uniforme:** `nombre` (string, req), `whatsapp` (tel, req), `disciplina` (enum, req), `producto` (array de enum `Rashguard | Jersey | Short MMA | Short Kickboxing | Licra (damas) | Karategi`, **min 1** — es el grupo de checkbox que hoy valida `script.js:97-115`), `talla` (enum, req), `cantidad` (int ≥ 1, req), `notas` (opcional).
   - **Examen:** `nombre`, `whatsapp`, `disciplina`, `grado`, `fecha` (todos req), `notas` (opcional).
   - Copiar las opciones de los `<select>` desde el HTML actual, sin inventar valores.
3. `components/site/RegistroForm.tsx` (`'use client'`) — formulario controlado con `useActionState`, estados de envío (botón "Enviando…" como hoy) y errores por campo.
4. **Server Action** `app/alumnos/actions.ts`:
   - Valida con Zod.
   - Genera `submission_id` **en el servidor** (`crypto.randomUUID()`).
   - Construye el `URLSearchParams` con la misma forma que `script.js:117-145`: valores múltiples unidos por `", "`, más `form_type`, `submission_id`, `page_url`, `user_agent`.
   - `POST` a `process.env.APPS_SCRIPT_REGISTROS_URL` **sin** `mode: "no-cors"` — desde el servidor no hay CORS, así que por primera vez se puede leer la respuesta real.
   - Devuelve `{ ok, submissionId }` o `{ ok: false, error }`.
5. Panel de confirmación (`.data-form-confirmation`) mostrando el `submission_id`, replicando `showConfirmationPanel` (`script.js:147`).

> ⚠️ **Este es el cambio funcional más importante de la Fase 1.** Hoy `script.js:195` usa `mode: "no-cors"`: la promesa resuelve aunque Apps Script devuelva 500, así que un alumno puede ver "guardado correctamente" con la Sheet sin escribir. Al mover el POST al servidor, ese fallo silencioso desaparece.

**Pruebas:**
- Envío real de los 3 formularios → 3 filas nuevas y correctas en la Sheet de registros.
- Enviar el formulario de uniforme sin marcar ningún producto → error visible, no se envía.
- Apuntar `APPS_SCRIPT_REGISTROS_URL` a una URL inválida → el usuario ve un mensaje de error (hoy vería éxito).
- El `submission_id` mostrado coincide con el de la Sheet.
- Los anchors `#uniformes`, `#examenes` y `#examenes-mma-jiujitsu` funcionan desde el nav.
- Diff visual en las 3 anchuras.

**Criterio de aceptación:** los 3 formularios escriben en la Sheet y los fallos son visibles para el usuario.

**Commit sugerido:** `feat(next): portal de alumnos con server actions y validacion zod`

---

## Tarea N06: Comunidad

**Branch:** `next/06-comunidad`
**Estimación:** M · **Depende de:** N03

**Qué hacer:**
1. `app/comunidad/page.tsx` — puerto de `legacy/community.html` (331 líneas) con las **tres** secciones: `#precios`, `#torneos`, `#eventos-pasados`.
2. `content/precios.ts` — extraer los paquetes y precios a datos tipados.
3. `content/torneos.ts` — extraer los torneos con su póster, fecha, sede y enlace. Incluye: campeonato nacional 2026, estatal zona norte 2026, regional 2026, IMMAF Youth World Championships, IMMAF Pan American Championships.
4. Componentes `<PreciosGrid>` y `<TorneoCard>`.

> Nota: `#eventos-pasados` **no** está en el menú desplegable de Comunidad, pero sí existe en la página. Conservar el `id` por si está enlazado desde fuera.

**Pruebas:**
- Diff visual en las 3 anchuras.
- Los 3 anchors funcionan desde el nav y por URL directa.
- Cada póster de torneo carga y los enlaces externos llevan al destino correcto.

**Criterio de aceptación:** precios y torneos se actualizan editando `content/`, no markup.

**Commit sugerido:** `feat(next): pagina de comunidad con contenido tipado`

---

## Tarea N07: Imágenes y rendimiento

**Branch:** `next/07-imagenes`
**Estimación:** M · **Depende de:** N04, N05, N06

**Qué hacer:**
1. Sustituir todas las `<img>` por `next/image` con `width`/`height` **reales** (obtener con `sips -g pixelWidth -g pixelHeight public/images/*`). Sin dimensiones correctas hay CLS.
2. `priority` **solo** en la imagen del hero de la home (`valeria.jpg`). Todo lo demás lazy por defecto.
3. Recomprimir en origen las dos imágenes pesadas señaladas en `REVIEW.md`, objetivo < 300 KB c/u:
   - `clases.png` (1.5 MB)
   - `uniformes-2026.png` (1.4 MB)
4. Los iconos sociales (`icon-instagram.png` 33 KB, `icon-facebook.png` 22 KB, `icon-whatsapp.png` 33 KB) se repiten en cada botón: convertirlos a SVG inline o a un sprite. Son ~90 KB para tres iconos monocromos.
5. `next.config.ts`: `images.formats = ['image/avif', 'image/webp']`.
6. `sizes` correcto en las imágenes que cambian de ancho por breakpoint (pósters de torneos, foto del hero).

**Pruebas:**
- Lighthouse móvil en `/` → Performance ≥ 90, CLS < 0.1.
- DevTools → Network en `/` con caché vacía: transferencia total < 1 MB (hoy ~5 MB).
- Las imágenes se sirven como AVIF/WebP (columna Type en Network).
- Ninguna imagen bajo el fold se descarga antes de hacer scroll.

**Criterio de aceptación:** cierra el hallazgo 🔴 de rendimiento de `REVIEW.md`.

**Commit sugerido:** `perf(next): next/image y compresion de assets`

---

## Tarea N08: SEO, metadata y redirects

**Branch:** `next/08-seo`
**Estimación:** M · **Depende de:** N04, N05, N06

**Qué hacer:**
1. `metadata` por ruta (title, description, `alternates.canonical`, Open Graph con imagen, Twitter Card). Descripciones nuevas, específicas por página — no reusar la de la home.
2. JSON-LD en `app/layout.tsx`, tipo `SportsActivityLocation`:
   - `name`: Club Samoa Escuela de Artes Marciales · `foundingDate`: 1983
   - `address`: Allende #300 Sur, esq. Francisco Sarabia, Zona Centro, Ciudad Madero, Tamaulipas
   - `telephone`: +52 833 311 0858 · `sameAs`: Instagram y Facebook
   - `openingHoursSpecification` derivado de `content/horarios.ts` (una sola fuente de verdad)
   - `hasMap`: el enlace de Google Maps actual
3. `app/sitemap.ts` (`/`, `/alumnos`, `/comunidad`) y `app/robots.ts` (permitir todo salvo `/admin` y `/api`).
4. `next.config.ts` → `redirects()` **permanentes (301)**:

   | Origen | Destino |
   |--------|---------|
   | `/index.html` | `/` |
   | `/students.html` | `/alumnos` |
   | `/community.html` | `/comunidad` |
   | `/admin/eventos.html` | `/admin/eventos` |
   | `/admin/evento.html` | `/admin/eventos` |
   | `/admin/atletas.html` | `/admin/atletas` |
   | `/admin/index.html` | `/admin` |
   | `/admin/bracket.html` | `/admin/eventos` |
   | `/admin/scoreboard.html` | `/admin/eventos` |
   | `/admin/scoreboard-public.html` | `/admin/eventos` |

   Los cuatro últimos llevaban query params (`?id=`, `?pelea=`, `?evento=`) que no mapean a un path limpio: redirigir al listado es aceptable, son URLs internas del admin.
5. `NEXT_PUBLIC_SITE_URL` como base de canonical y sitemap.

**Pruebas:**
- [Rich Results Test](https://search.google.com/test/rich-results) valida el JSON-LD sin errores.
- `curl -I http://localhost:3000/students.html` → `301` con `Location: /alumnos`.
- `/sitemap.xml` y `/robots.txt` responden y listan lo esperado.
- Previsualizar el OG en el validador de Facebook/WhatsApp: imagen y título correctos.

**Criterio de aceptación:** sube el hallazgo 🟡 de SEO y ninguna URL indexada queda rota.

**Commit sugerido:** `feat(next): metadata, json-ld y redirects 301`

---

## 🚦 Hito 1 — Deploy del sitio público

**No es una tarea de código.** Antes de tocar el admin:

1. Crear el proyecto en Vercel apuntando a `feat/nextjs-migration`.
2. Configurar `APPS_SCRIPT_REGISTROS_URL` y `NEXT_PUBLIC_SITE_URL` en el entorno de preview.
3. Validar en la URL de preview: las 3 páginas, los 3 formularios contra la Sheet real, Lighthouse, y revisión en un móvil de verdad.
4. **Dejarlo correr una semana** antes de seguir. Si algo del sitio público falla, se descubre ahora y no durante la migración del admin.

El dominio **no** se mueve todavía — eso es N21.

---

# FASE 2 — Capa de datos y auth

## Tarea N09: Cliente server-side de Apps Script + tipos del dominio

**Branch:** `next/09-apps-script-client`
**Estimación:** L · **Depende de:** N01 *(se puede hacer en paralelo con la Fase 1)*

**Qué hacer:**
1. `lib/apps-script.ts` — puerto de `legacy/admin/js/api.js` (250 líneas) al servidor:
   - `appsScript.get(action, params)` y `appsScript.post(action, payload)`.
   - **Quitar** el spinner y el contador de requests en vuelo (`api.js:65-118`) — eso pasa a TanStack Query en N12.
   - **Conservar** el manejo de errores de `api.js:179-213`: respuesta no-JSON → error con los primeros 200 chars del body; `!response.ok` → error con status; `{ ok: false, error }` → error con el mensaje del backend.
   - `class AppsScriptError extends Error` con `status` y `payload` (reemplaza el constructor-función de `api.js:49`).
   - **Nuevo:** `AbortSignal.timeout(20_000)` y un reintento con backoff ante error de red o timeout. Apps Script tiene cold starts de varios segundos.
   - El POST puede seguir usando `Content-Type: text/plain` (el backend lo parsea así en `readPayload_()`), pero ya no por CORS — desde el servidor no hay preflight.
2. `lib/schemas.ts` — Zod para las 5 entidades, derivando los campos de las pestañas de la Sheet documentadas en `PRD-brackets-mma.md` §7 y de los handlers de `Eventos.gs`:
   - `AtletaSchema`, `EventoSchema`, `InscripcionSchema`, `BracketSchema`, `PeleaSchema`.
   - Exportar los tipos inferidos (`export type Atleta = z.infer<typeof AtletaSchema>`).
   - Ojo con los tipos que la Sheet devuelve como string: fechas, booleanos y números pasan por los coercers de `Eventos.gs:548-599`. Usar `z.coerce` donde corresponda.
3. `parseOrThrow(schema, data, action)` — helper que valida y, si falla, lanza un error con el `action` y el path del campo. **Importante:** un fallo de validación debe ser ruidoso en desarrollo pero no tumbar la pantalla en producción; loggear y degradar.

**Pruebas (Vitest, con `fetch` mockeado):**
- Camino feliz: `get` devuelve el objeto parseado.
- Backend responde `{ ok: false, error: "..." }` → lanza `AppsScriptError` con ese mensaje.
- Backend responde HTML (la página de error de Apps Script) → lanza error con los primeros 200 chars.
- Timeout → reintenta una vez y luego lanza.
- `buildGetUrl` codifica correctamente params con acentos y espacios (nombres de atletas).

**Criterio de aceptación:** el cliente cubre las 27 acciones y toda respuesta pasa por Zod.

**Commit sugerido:** `feat(next): cliente server-side de apps script con validacion zod`

---

## Tarea N10: Route Handlers proxy

**Branch:** `next/10-api-routes`
**Estimación:** L · **Depende de:** N09

**Qué hacer:**
1. `app/api/eventos/[action]/route.ts` con `GET` y `POST`.
2. **Allowlist explícita** en `lib/actions-allowlist.ts` — nada de reenviar el path directo a Apps Script:
   ```ts
   export const READ_ACTIONS = ['ping','atletas.list','atletas.get','eventos.list','eventos.get',
     'inscripciones.list','brackets.list','brackets.get','brackets.listfull','peleas.get','peleas.next'] as const
   export const WRITE_ACTIONS = ['atletas.create','atletas.update','atletas.archive','atletas.delete',
     'eventos.create','eventos.update','eventos.setestatus','eventos.delete',
     'inscripciones.create','inscripciones.setpesopesaje','inscripciones.setestatus',
     'inscripciones.setcategoria','inscripciones.clearcategoria','inscripciones.delete',
     'brackets.confirm','brackets.delete','peleas.update','peleas.finalize'] as const
   ```
   `setup` queda **fuera** de la allowlist: es una operación destructiva de mantenimiento que se ejecuta desde el editor de Apps Script.
3. Acción fuera de la allowlist → `404`. Acción de escritura recibida por `GET` → `405`.
4. `lib/api-client.ts` — cliente tipado que usa el navegador contra `/api/eventos/*`. Misma firma que el `api` viejo para facilitar el puerto de los módulos del admin.
5. Cacheado:
   - Lecturas públicas (bracket, scoreboard público): `revalidate` de 10–30 s.
   - Todo lo del admin: `cache: 'no-store'`.
6. Los hooks de escritura de N11 se dejan preparados con un `TODO` y un test que los cubrirá.

**Pruebas:**
- Script que recorre las 11 acciones de lectura contra el backend real y compara la respuesta con la llamada directa a Apps Script — deben ser idénticas.
- `GET /api/eventos/atletas.foo` → 404.
- `GET /api/eventos/atletas.create` → 405.
- **Crítico:** `npm run build && grep -r "script.google.com" .next/static/` no devuelve nada.

**Criterio de aceptación:** las 27 acciones funcionan vía proxy y la URL de Apps Script no llega al navegador.

**Commit sugerido:** `feat(next): route handlers proxy hacia apps script`

---

## Tarea N11: Autenticación del admin + rotación de endpoints

**Branch:** `next/11-auth`
**Estimación:** L · **Depende de:** N10

**Qué hacer:**
1. Auth.js v5 (`next-auth@beta`): `lib/auth.ts` con Google provider y callback `signIn` que rechaza cualquier correo fuera de `ADMIN_ALLOWED_EMAILS` (lista separada por comas, comparada en minúsculas).
2. `app/api/auth/[...nextauth]/route.ts`.
3. `middleware.ts` con `matcher` sobre `/admin/:path*`. **Excluir** `/scoreboard/:path*` y `/bracket/:path*` — se proyectan durante los eventos y no pueden pedir login (decisión D3 del plan).
4. **Verificar la sesión también dentro del Route Handler** para toda acción de `WRITE_ACTIONS` → `401` sin sesión. El middleware por sí solo no basta: protege páginas, no la API.
5. `app/login/page.tsx` — pantalla mínima con el botón de Google, estilada con el CSS del admin.
6. Página de acceso denegado para correos fuera de la allowlist, con un mensaje claro (no un error genérico).
7. Botón de cerrar sesión, que se colocará en el shell en N12.

**Pruebas:**
- `/admin/eventos` sin sesión → redirect a `/login`.
- Login con correo de la allowlist → entra. Con correo fuera → acceso denegado.
- `curl -X POST /api/eventos/atletas.create` sin cookie → `401`.
- `curl /api/eventos/atletas.list` sin cookie → responde (lectura pública, de momento).
- `/scoreboard/123` y `/bracket/456` sin sesión → cargan.
- Sesión persiste tras recargar y tras cerrar/abrir el navegador.

**Criterio de aceptación:** cierra el hallazgo 🔴 de seguridad de `REVIEW.md`.

### 🔐 Paso obligatorio al terminar N11

Las URLs de Apps Script viven en `legacy/registration-config.js`, versionado en un repo **público** de GitHub y presente en todo el historial de git. Hay que asumirlas comprometidas — cualquiera puede escribir en las Sheets hoy.

1. Abrir cada proyecto de Apps Script → **Implementar → Gestionar implementaciones → Nueva versión**, generando una URL `/exec` nueva.
2. **Archivar la implementación anterior** para que la URL vieja deje de responder.
3. Poner las URLs nuevas **solo** en variables de entorno (`.env.local` y Vercel). Nunca en el repo.
4. Verificar que la URL vieja devuelve error y la nueva funciona.

> Mover los endpoints a variables de entorno **no sirve de nada** si no se rotan: las viejas ya están publicadas.

**Commit sugerido:** `feat(next): auth.js con allowlist protegiendo el admin`

---

# FASE 3 — Panel admin

## Tarea N12: Shell del admin

**Branch:** `next/12-admin-shell`
**Estimación:** M · **Depende de:** N11

**Qué hacer:**
1. `app/(admin)/layout.tsx` reemplaza `legacy/admin/js/shell.js` (267 líneas de inyección por DOM):
   - Header con marca y botón de cerrar sesión.
   - Sidebar con los items de `shell.js:22-25`: **Eventos** (🥊, `/admin/eventos`) y **Atletas** (👥, `/admin/atletas`).
   - Item activo por `usePathname()` en vez de `data-section`.
   - Header de página con título y subtítulo: pasan a ser props del componente de página o `metadata`, ya no `data-title`/`data-subtitle` del `<body>`.
   - El slot `data-slot="main-actions"` (que hoy `shell.js` mueve por JS) pasa a ser una prop `actions` del componente de página.
2. Importar `app/admin.css` en este layout (no en el global — no debe cargarse en el sitio público).
3. Provider de TanStack Query con defaults sensatos: `staleTime` 30 s, `retry` 1, `refetchOnWindowFocus` false (Apps Script es lento; refetch agresivo lo satura).
4. `<Toaster>` global para errores de API — reemplaza los `alert()` dispersos.
5. `components/ui/Spinner.tsx` conectado al estado global de TanStack Query, replicando el indicador de `api.js:69-95`.
6. `app/(admin)/admin/page.tsx` — puerto del índice (`legacy/admin/index.html`, 21 líneas).

**Pruebas:**
- Las rutas `/admin`, `/admin/atletas`, `/admin/eventos` renderizan con sidebar y el item activo correcto.
- Cerrar sesión funciona y redirige a `/login`.
- El CSS del admin no se carga en `/` (verificar en Network).
- Un error de API muestra toast, no `alert()`.

**Commit sugerido:** `feat(admin): shell como layout de app router`

---

## Tarea N13: Atletas

**Branch:** `next/13-atletas`
**Estimación:** L · **Depende de:** N12

**Qué hacer:**
1. `lib/reglamento.ts` — **puerto 1:1** de `legacy/admin/js/reglamento.js` (478 líneas). Sin cambios de lógica: solo tipos y `export`. Incluye las categorías de edad de `Eventos.gs:1092-1108` (Mini 1, Mini 2, Infantil, Juvenil D/C/B/A, Junior, Adultos).
2. `app/(admin)/admin/atletas/page.tsx` — puerto de `atletas-listado.js` (402 líneas):
   - Tabla con búsqueda por nombre y filtro por género (`Todos` / `Masculino` / `Femenino`, como `atletas.html:37-39`).
   - Acciones por fila: editar, archivar, borrar.
3. `components/admin/AtletaForm.tsx` — puerto de `atletas-form.js` (470 líneas):
   - Campos: nombre completo, fecha de nacimiento, género, años de práctica, peso, disciplina (ver `Eventos.gs:2290-2300`).
   - Cálculo de categoría en vivo a partir de `lib/reglamento.ts` conforme se edita fecha de nacimiento / peso / género.
   - Validación con Zod, en modal.
4. Mutaciones con TanStack Query + invalidación de la query del listado.
5. Confirmación explícita antes de borrar (distinguir "archivar" de "borrar" — hoy son dos acciones distintas del backend).

**Pruebas:**
- **Vitest sobre `lib/reglamento.ts`** portando todos los casos de `legacy/admin/js/reglamento.test.html`. Esta suite es la red de seguridad de N15 y N16 — no dejarla para después.
- Manual contra la Sheet real: crear → aparece en el listado y en la Sheet; editar → se refleja; archivar → desaparece del listado activo; borrar → se elimina la fila.
- La categoría calculada coincide con la que muestra el admin actual para 5 atletas de prueba.

**Commit sugerido:** `feat(admin): modulo de atletas en next`

---

## Tarea N14: Eventos — listado y alta

**Branch:** `next/14-eventos`
**Estimación:** M · **Depende de:** N12

**Qué hacer:**
1. `app/(admin)/admin/eventos/page.tsx` — puerto de `eventos-listado.js` (314 líneas): listado agrupado o filtrado por estatus, con enlace al detalle.
2. `components/admin/EventoForm.tsx` — puerto de `eventos-form.js` (268 líneas): alta y edición, validación Zod.
3. Cambio de estatus (`eventos.setestatus`) desde el listado.
4. Borrado con confirmación (`eventos.delete`) — advertir que arrastra inscripciones y brackets.
5. Los enlaces al detalle van a `/admin/eventos/[id]` (ya no `evento.html?id=`).

**Pruebas:** crear un evento → aparece en el listado y en la Sheet; editarlo; cambiar estatus; borrar un evento de prueba.

**Commit sugerido:** `feat(admin): listado y formulario de eventos`

---

## Tarea N15: Evento — detalle, inscripciones y pesaje

**Branch:** `next/15-evento-detalle`
**Estimación:** XL · **Depende de:** N13, N14

**Qué hacer:**
1. `app/(admin)/admin/eventos/[id]/page.tsx` con las **5 pestañas** de `legacy/admin/evento.html:20-25`: **Detalle · Inscripciones · Pesaje · Brackets · Resumen**.
   - Pestaña activa en la URL (`?tab=pesaje`) para que sea compartible y sobreviva a un refresh. Hoy se pierde al recargar.
   - Los paneles de Brackets y Resumen se rellenan en N16 y N18; en esta tarea quedan como placeholders.
2. **Detalle** — puerto de `evento.js` (337 líneas): datos del evento y edición inline.
3. **Inscripciones** — puerto de `evento-inscripciones.js` (221) + `inscripciones-form.js` (349): inscribir atletas del catálogo, asignar/limpiar categoría, cambiar estatus, borrar inscripción.
4. **Pesaje** — puerto de `evento-pesaje.js` (519 líneas). Es la pantalla de mayor presión operativa: se usa el día del evento, con fila de atletas esperando.
   - **Optimistic updates** en TanStack Query: el peso se ve inmediatamente, con rollback y toast si el backend falla.
   - Indicador de guardado por fila (pendiente / guardado / error) — con Apps Script tardando 1–3 s, sin esto el operador no sabe si el dato se guardó.
   - Recalcular la categoría en vivo con `lib/reglamento.ts` al capturar el peso.
   - No bloquear la UI mientras guarda: debe poder capturarse el siguiente atleta.

**Pruebas:**
- Inscribir 5 atletas → aparecen en la Sheet con su categoría.
- Capturar peso de los 5 seguidos, sin esperar entre uno y otro → los 5 quedan correctos en la Sheet.
- Simular fallo de red durante un guardado de peso → la fila revierte al valor anterior y aparece un toast.
- Recargar en la pestaña Pesaje → sigue en Pesaje, no salta a Detalle.
- Un peso que cambia de categoría actualiza la categoría mostrada al instante.

**Commit sugerido:** `feat(admin): inscripciones y pesaje del evento`

---

## Tarea N16: Brackets

**Branch:** `next/16-brackets`
**Estimación:** XL · **Depende de:** N15

**Qué hacer:**
1. `lib/bracket-builder.ts` — **puerto 1:1** de `bracket-builder.js` (299 líneas). Lógica pura de agrupación de atletas por categoría, siembra y byes. No cambiar el algoritmo.
2. `components/admin/BracketSvg.tsx` — puerto de `bracket-svg.js` (370 líneas), de `document.createElementNS` imperativo a **JSX declarativo**. Es el mayor beneficio estructural de la migración: el SVG pasa a ser una función de los datos.
   - Mantener idénticos el viewBox, las coordenadas y el sistema de escalado para que el render sea equivalente.
3. Pestaña **Brackets** del evento — puerto de `evento-brackets.js` (717 líneas): preview antes de confirmar → confirmar (`brackets.confirm`) → visualizar → borrar (`brackets.delete`).
4. `app/(publico)/bracket/[bracketId]/page.tsx` — puerto de `legacy/admin/bracket.html` (163 líneas), **sin auth**, para proyección.

**Pruebas:**
- **Vitest sobre `lib/bracket-builder.ts`** portando los casos de `bracket-builder.test.html`: 2, 3, 4, 5, 8 y 16 atletas; categorías con un solo atleta; byes.
- **Snapshot del SVG:** generar el bracket de un evento de prueba en el admin actual y en el nuevo, y comparar. Diferencias solo de formato de atributos, nunca de geometría.
- Confirmar un bracket de prueba → filas correctas en las pestañas `Brackets` y `Peleas` de la Sheet.
- La vista pública del bracket carga sin sesión.

**Commit sugerido:** `feat(admin): brackets con svg declarativo`

---

## Tarea N17: Scoreboard

**Branch:** `next/17-scoreboard`
**Estimación:** XL · **Depende de:** N16

> **La tarea más delicada del plan.** 1,697 líneas de estado imperativo. Reservar tiempo y no comprimirla.

**Qué hacer:**
1. `app/(admin)/admin/scoreboard/[peleaId]/page.tsx` + `components/admin/Scoreboard/`, troceando `scoreboard.js` según sus propias secciones:
   - `<Timer>` — T18 (`scoreboard.js:509-628`)
   - `<PuntosPanel>` — T19, sistema *10-point must* (`:431-508`, `:838-1020`)
   - `<FaltasPanel>` — advertencias y faltas
   - `<FinalizarModal>` — T20 (`:1021-1255`)
   - `useScoreboard()` — `useReducer` que centraliza el estado de la pelea (rounds, puntos, advertencias, faltas, timer)
2. **Timer (`scoreboard.js:518`)**: hoy es `setInterval(tick, 1000)` acumulando. En React hay que anclarlo a un `Date.now()` de referencia y calcular el restante en cada tick, o derivará con los re-renders. Guardar `startedAt` y `pausedAccumulated`, no un contador.
3. **Persistencia (T21)** — conservar tal cual, con guardas de `typeof window !== 'undefined'`:
   - Autosave del snapshot a `localStorage` (`:145`), recuperación al montar (`:337`), limpieza al finalizar (`:1522`).
   - `BroadcastChannel` por pelea (`:85-95`) y por evento (`:121-130`) para sincronizar con la vista pública.
   - Prefetch de la siguiente pelea en `sessionStorage` (`:52-73`, un solo uso).
4. **Búsqueda de la siguiente pelea (T25, `:1256`)** — cruza todo el evento; portar sin cambios.
5. **Atajos de teclado**: el listener global (`:247`) pasa a `useEffect` con cleanup; el del modal de finalización (`:1044-1248`, incluido `Escape`) se ata al ciclo de vida del modal.
6. **Edición de resultado post-finalización** — viene de `feat/23-editar-resultado`, mergeada en N00. Verificar que está incluida.
7. `peleas.update` y `peleas.finalize` vía los Route Handlers, con optimistic update en el marcador.

**Pruebas:**
- **Playwright, pelea completa:** iniciar → puntos a ambos → advertencia → pausa → **recargar la página** (debe recuperar el estado de `localStorage`) → reanudar → finalizar → verificar el resultado en la Sheet.
- **Dos pestañas:** admin y `/scoreboard/[eventoId]` abiertas; cada cambio de puntos se refleja en la pública en < 1 s.
- **Deriva del timer:** dejar correr un round de 3 min y comparar contra un cronómetro externo. Desviación < 1 s.
- Editar el resultado de una pelea ya finalizada → se actualiza en la Sheet.
- `Escape` cierra el modal de finalización sin finalizar.

**Criterio de aceptación:** un evento real puede operarse de principio a fin sin volver al admin viejo.

**Commit sugerido:** `feat(admin): scoreboard como componentes react`

---

## Tarea N18: Vistas públicas de proyección

**Branch:** `next/18-vistas-publicas`
**Estimación:** L · **Depende de:** N17

**Qué hacer:**
1. `app/(publico)/scoreboard/[eventoId]/page.tsx` — puerto de `legacy/admin/scoreboard-public.html` (417 líneas). Sin auth. Escucha el `BroadcastChannel` y el evento `storage` de `localStorage` que emite el scoreboard del admin.
2. Optimizar para proyector: tipografía muy grande, fondo oscuro, sin sidebar ni chrome del admin, sin scroll.
3. Pestaña **Resumen** del evento — puerto de `evento-resumen.js` (314 líneas): resultados de todas las peleas y cierre del evento.
4. Verificar que ninguna de las dos rutas públicas queda dentro del `matcher` del middleware (N11).

**Pruebas:**
- Abrir `/scoreboard/[eventoId]` en una ventana de incógnito (sin sesión) → carga.
- Con el admin operando una pelea, la pública refleja puntos, round y timer.
- Al finalizar una pelea, la pública pasa a la siguiente.
- Probar en una pantalla de 1920×1080 a 3 m de distancia: todo legible.

**Commit sugerido:** `feat(publico): scoreboard y resumen de evento`

---

# FASE 4 — Calidad

## Tarea N19: Tests y CI

**Branch:** `next/19-tests`
**Estimación:** L · **Depende de:** N18

**Qué hacer:**
1. Completar la suite de Vitest sobre `lib/`, portando los 8 `.test.html`:

   | Origen | Destino |
   |--------|---------|
   | `admin/js/api.test.html` | `lib/__tests__/apps-script.test.ts` (hecho en N09) |
   | `admin/js/reglamento.test.html` | `lib/__tests__/reglamento.test.ts` (hecho en N13) |
   | `admin/js/bracket-builder.test.html` | `lib/__tests__/bracket-builder.test.ts` (hecho en N16) |
   | `admin/js/bracket-svg.test.html` | `components/__tests__/BracketSvg.test.tsx` (snapshot) |
   | `admin/js/atletas-api.test.html` | `lib/__tests__/schemas.test.ts` |
   | `admin/js/eventos-api.test.html` | idem |
   | `admin/js/inscripciones-api.test.html` | idem |
   | `admin/js/brackets-api.test.html` | idem |

2. Playwright, 4 flujos:
   - Sitio público: home carga, nav funciona, los 3 anchors saltan.
   - Formulario de uniforme: envío válido → confirmación; envío inválido → error.
   - Auth: `/admin` sin sesión redirige; con sesión mockeada entra.
   - Evento completo: crear → inscribir → pesar → generar bracket → operar una pelea → finalizar.
3. GitHub Actions (`.github/workflows/ci.yml`): en cada PR, `npm ci` → `npm run check` → `vitest run` → `playwright test` (solo los dos primeros flujos; los que tocan la Sheet real quedan manuales o contra una Sheet de pruebas).
4. **Borrar los `.test.html`** una vez portados.

**Criterio de aceptación:** CI verde en PR y ningún test manual sin equivalente automatizado para la lógica pura.

**Commit sugerido:** `test(next): vitest + playwright + ci`

---

## Tarea N20: Accesibilidad y pulido

**Branch:** `next/20-a11y`
**Estimación:** M · **Depende de:** N18

**Qué hacer:**
1. Auditoría con axe DevTools en `/`, `/alumnos`, `/comunidad` y las 6 pantallas del admin. El review daba 8/10 — el objetivo es no perder terreno con el cambio de markup.
2. Foco: visible en todos los interactivos; *focus trap* en los modales (atleta, evento, finalizar pelea); al cerrar un modal el foco vuelve al disparador.
3. `aria-live="polite"` en los estados de formulario y `aria-live` en el marcador para que un lector de pantalla anuncie los cambios de puntos.
4. Las pestañas del evento con el patrón ARIA correcto (`role="tablist"`, `aria-selected`, navegación con flechas) — hoy los roles están puestos pero sin manejo de teclado.
5. Contraste verificado en las vistas de proyección (fondo oscuro + rojo `#f40706` es la combinación de riesgo).
6. `alt` de todas las imágenes revisado: descriptivo en las de contenido, vacío en las decorativas.

**Pruebas:** axe sin violaciones críticas ni serias; recorrido completo solo con teclado en el flujo de evento; VoiceOver en la home y en el formulario de uniformes.

**Commit sugerido:** `fix(a11y): correcciones tras auditoria de la migracion`

---

# FASE 5 — Cutover

## Tarea N21: Deploy y corte de dominio

**Branch:** `next/21-deploy`
**Estimación:** L · **Depende de:** N19, N20

**Qué hacer:**
1. Variables de entorno de **producción** en Vercel, con las URLs de Apps Script **ya rotadas** (N11) y `NEXT_PUBLIC_SITE_URL` con el dominio real.
2. Añadir el URI de redirección OAuth de producción en Google Cloud Console.
3. **Ensayo general en el preview deploy**, con checklist:
   - [ ] Las 3 páginas públicas en móvil y escritorio.
   - [ ] Los 3 formularios escriben en la Sheet real.
   - [ ] Login del admin con las cuentas reales.
   - [ ] Evento de prueba de punta a punta: crear → inscribir → pesar → bracket → 2 peleas → resumen.
   - [ ] Vista pública del scoreboard en un proyector de verdad.
   - [ ] Lighthouse ≥ 90 en las 3 públicas.
4. Merge de `feat/nextjs-migration` a `main`.
5. **Corte de DNS** al proyecto de Vercel. Hacerlo en un momento de bajo tráfico y **nunca la víspera de un evento**.
6. Verificar en producción los 10 redirects 301 de N08.
7. Activar Vercel Analytics y Speed Insights.
8. Enviar el sitemap en Google Search Console y vigilar errores de rastreo durante 2 semanas.
9. **`legacy/` se conserva.** No se borra en esta tarea.

**Criterio de aceptación:** el dominio sirve la app Next, los formularios funcionan y el admin es accesible solo con sesión.

**Commit sugerido:** `chore(deploy): cutover a vercel`

---

## Tarea N22: Retirar el sitio estático

**Branch:** `next/22-limpieza`
**Estimación:** S · **Depende de:** N21 **+ una semana de tráfico real**

**Qué hacer:**
1. Confirmar que pasó al menos una semana desde el cutover **y que se operó al menos un evento real** en la app nueva.
2. `git rm -r legacy/`.
3. Quitar de `.gitignore` y de `tsconfig` las exclusiones de `legacy/`.
4. Actualizar `README.md` con el stack nuevo, cómo levantar el proyecto y las variables de entorno requeridas.
5. Marcar `REVIEW.md` con los hallazgos ya cerrados (rendimiento, seguridad del admin, lazy loading, `prefers-reduced-motion`).

**Criterio de aceptación:** commit propio, aislado y fácil de revertir.

**Commit sugerido:** `chore: eliminar sitio estatico legacy`

---

# FASE 6 — Post-migración (opcional)

No bloquean nada y se evalúan después del cutover.

| # | Tarea | Cuándo tiene sentido |
|---|-------|----------------------|
| N23 | Migrar Sheets → Postgres (Neon/Supabase) + Drizzle | Si la latencia de 1–3 s de Apps Script estorba en el pesaje o el volumen de eventos crece. |
| N24 | Scoreboard en tiempo real vía SSE | Si alguna vez se necesita operar el marcador desde un dispositivo distinto al del proyector. |
| N25 | CSS global → CSS Modules por componente | Deuda conocida de la decisión D2. Archivo por archivo, sin prisa. |
| N26 | PWA / modo offline en el pesaje | Si el wifi del gimnasio falla el día del evento. |
| N27 | CMS ligero para horarios, precios y torneos | Para que el club edite sin tocar código ni esperar un deploy. |

---

# Apéndice — Flujo de trabajo

```bash
# Una sola vez, antes de N01 (ya hecho en N00):
git checkout main && git pull
git checkout -b feat/nextjs-migration
git push -u origin feat/nextjs-migration

# Por cada tarea:
git checkout feat/nextjs-migration && git pull
git checkout -b next/NN-slug
# ...trabajar...
npm run check && npm test
git add . && git commit -m "feat(scope): descripcion"
git push -u origin next/NN-slug
# PR contra feat/nextjs-migration → merge

# Solo en N21:
git checkout main && git merge feat/nextjs-migration
```

**Regla:** `main` debe poder desplegarse en todo momento. Mientras la migración esté a medias, `main` sigue sirviendo el sitio estático actual; el trabajo nuevo vive en `feat/nextjs-migration` y se valida en los preview deploys de Vercel.
