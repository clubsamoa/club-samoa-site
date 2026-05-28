# TASKS — Plataforma de Brackets MMA

Plan de ejecución del PRD `PRD-brackets-mma.md`. Cada tarea es independientemente testable y debe ejecutarse en su propio feature branch. Al terminar una tarea: commit, push y abrir PR (o merge directo si se trabaja en solitario).

## Convenciones

- **Rama base:** `main`
- **Naming de ramas:** `feat/NN-slug-corto` donde `NN` es el número de tarea de este documento.
- **Mensajes de commit:** estilo [Conventional Commits](https://www.conventionalcommits.org/) — `feat(scope): descripción` / `fix(scope): ...` / `test(scope): ...` / `docs(scope): ...`.
- **Antes de cada tarea:** `git checkout main && git pull && git checkout -b feat/NN-slug`
- **Al terminar:** `git add . && git commit -m "..."` → `git push -u origin feat/NN-slug` → merge a `main`.
- **Tests:** preferir tests automatizados para lógica pura (reglamento, agrupación). UI se valida con manual testing.

---

# FASE 0 — Cimientos

## Tarea 01: Crear Google Sheet de eventos y configurar Apps Script base

**Branch:** `feat/01-apps-script-eventos-base`

**Qué hacer:**
1. Crear una nueva Google Sheet llamada `club-samoa-eventos` con las 6 pestañas del PRD §7 (`Atletas`, `Eventos`, `Inscripciones`, `Brackets`, `Peleas`, `Configuracion`), cada una con sus encabezados de columna.
2. Crear archivo `registration-backend/apps-script/Eventos.gs` con esqueleto de endpoints `doGet` / `doPost`, helper para leer/escribir filas, y función `setupEventosSheets()` que crea/valida las pestañas e índices.
3. Documentar setup en `registration-backend/README.md` (sección nueva: "Eventos MMA").
4. Desplegar como nuevo Web App separado del de uniformes/exámenes. Guardar la URL `/exec` en `registration-config.js`.

**Pruebas:**
- Manual: Abrir la Sheet y verificar que las 6 pestañas existan con encabezados correctos.
- Manual: Llamar a la URL del Web App desde el navegador con `?action=ping` → debe responder `{"ok":true,"version":"0.1"}`.
- Manual: Llamar con `?action=setup` → debe re-crear encabezados si faltan.

**Commit sugerido:** `feat(eventos): scaffold apps script + sheets para mma brackets`

---

## Tarea 02: Codificar el reglamento FAMM 2025 como módulo JS

**Branch:** `feat/02-reglamento-engine`

**Qué hacer:**
Crear `admin/js/reglamento.js` con tablas estáticas y funciones puras:
- `calcularDivisionEdad(fechaNacimiento, fechaEvento) → string` (Mini 1, Mini 2, …, Adultos).
- `sugerirNivel(aniosPractica) → string` (Novato, Principiante, Intermedio, Avanzado).
- `categoriasPesoPara(division, genero) → Array<{nombre, pesoMax}>`.
- `calcularCategoriaPeso(division, genero, pesoKg) → {nombre, pesoMax} | null`.
- `tiempoPelea(division, nivel, esFinal) → {rounds, segundosPorRound, segundosDescanso}`.
- Constante `METODOS_FINALIZACION = [...]`.

**Pruebas:**
Crear `admin/js/reglamento.test.html` (página estática que corre asserts en consola al cargar). Casos:
- `calcularDivisionEdad('2000-03-15', '2026-08-07')` → `'Adultos'`.
- `calcularDivisionEdad('2016-01-01', '2026-08-07')` → `'Juvenil D'`.
- `sugerirNivel(0.5)` → `'Novato'`; `sugerirNivel(2.5)` → `'Intermedio'`; `sugerirNivel(5)` → `'Avanzado'`.
- `calcularCategoriaPeso('Adultos', 'Masculino', 69.5)` → `'Peso Ligero'`.
- `calcularCategoriaPeso('Adultos', 'Femenino', 47)` → `'Átomo'`.
- `tiempoPelea('Adultos', 'Avanzado', true)` → `{rounds: 3, segundosPorRound: 180, segundosDescanso: 60}`.
- `tiempoPelea('Adultos', 'Novato', false)` → `{rounds: 1, segundosPorRound: 240, …}`.

Abrir `admin/js/reglamento.test.html` en el navegador → verificar consola: todos los asserts deben pasar.

**Commit sugerido:** `feat(reglamento): cálculos puros de división, nivel, peso y tiempos`

---

## Tarea 03: Cliente HTTP base hacia Apps Script

**Branch:** `feat/03-api-client`

**Qué hacer:**
Crear `admin/js/api.js` con un wrapper sobre `fetch`:
- `api.get(action, params)` → GET a la URL `/exec` con query params.
- `api.post(action, payload)` → POST con `Content-Type: text/plain` (por convención Apps Script para evitar preflight CORS).
- Manejo uniforme de errores → throw `ApiError(message, status)`.
- Indicador global de loading (CSS spinner).

**Pruebas:**
- Manual: en consola del navegador en `admin/` → `await api.get('ping')` → `{ok: true, version: '0.1'}`.
- Manual: cortar internet → llamada debe rechazar con `ApiError`.

**Commit sugerido:** `feat(api): cliente http base con manejo de errores`

---

## Tarea 04: Layout de admin shell + navegación

**Branch:** `feat/04-admin-shell`

**Qué hacer:**
- Crear `admin/index.html` con header (logo Club Samoa), nav lateral (Atletas, Eventos), área de contenido vacía.
- Crear `admin/styles-admin.css` (paleta consistente con sitio actual).
- Crear placeholders: `admin/atletas.html`, `admin/eventos.html`. Cada uno con título y un "Coming soon".
- Asegurar que `admin/index.html` redirige (o link) a `eventos.html` por default.

**Pruebas:**
- Manual: abrir `clubsamoa.github.io/club-samoa-site/admin/` localmente — debe verse el shell.
- Manual: clicar en nav "Atletas" y "Eventos" — debe navegar.
- Manual: probar en mobile (responsive) — nav debe ser usable.

**Commit sugerido:** `feat(admin): layout base y navegación`

---

# FASE 1 — Catálogo de Atletas

## Tarea 05: Endpoints backend de atletas (CRUD)

**Branch:** `feat/05-atletas-backend`

**Qué hacer:**
En `Eventos.gs`, agregar acciones:
- `action=atletas.list` → array de atletas activos.
- `action=atletas.get&id=X` → un atleta.
- `action=atletas.create` (POST con payload).
- `action=atletas.update` (POST con id + cambios).
- `action=atletas.archive` (POST con id) → setea `activo = false`.

Auto-generar ID `atl_XXX` correlativo. Validar tipos (fecha ISO, peso > 0, género ∈ enum).

**Pruebas:**
- Manual con `curl`:
  ```bash
  curl "URL/exec?action=atletas.list"
  curl -X POST "URL/exec" -H "Content-Type: text/plain" \
    -d '{"action":"atletas.create","payload":{"nombre_completo":"Test","fecha_nacimiento":"2000-01-01","genero":"Masculino","anios_practica":4,"peso_referencia_kg":70,"academia":"Test","pais":"México"}}'
  ```
- Verificar en la Sheet que la fila aparece.
- Probar update y archive con el ID devuelto.

**Commit sugerido:** `feat(atletas): endpoints crud en apps script`

---

## Tarea 06: UI listado de atletas

**Branch:** `feat/06-atletas-listado`

**Qué hacer:**
- `admin/atletas.html`: tabla con columnas (nombre, género, división, nivel, peso ref., academia, acciones).
- Carga inicial vía `api.get('atletas.list')`.
- División y nivel calculados en cliente con `reglamento.js` (usar fecha de hoy para división mostrada en listado).
- Filtros: género (toggle), nivel (dropdown), búsqueda por nombre.
- Botón "Nuevo atleta".
- Estado de loading y empty state.

**Pruebas:**
- Manual: con la sheet vacía, mostrar empty state.
- Manual: agregar 3 atletas vía endpoint o directo en Sheets, recargar → deben aparecer.
- Manual: probar cada filtro (debe reducir filas correctamente).
- Manual: búsqueda case-insensitive.

**Commit sugerido:** `feat(atletas): listado con filtros y búsqueda`

---

## Tarea 07: UI crear/editar atleta

**Branch:** `feat/07-atletas-form`

**Qué hacer:**
- Modal o página dedicada con formulario:
  - Nombre completo (required)
  - Fecha nacimiento (date picker, required)
  - Género (radio, required)
  - Años de práctica (number, required) → al cambiar, sugiere nivel
  - Nivel (dropdown, prellenado por sugerencia, editable)
  - Peso de referencia (number, required, > 0)
  - Academia (text)
  - País (text, default México)
  - Foto URL (opcional)
- Botón "Guardar" → `api.post('atletas.create' o 'atletas.update')`.
- Validaciones en cliente antes de enviar.
- Botón "Archivar" en modo edición → confirmación → `api.post('atletas.archive')`.

**Pruebas:**
- Manual: crear atleta con datos válidos → aparece en listado.
- Manual: dejar campos requeridos vacíos → muestra error en UI, no envía.
- Manual: cambiar años de práctica → nivel se actualiza automáticamente.
- Manual: editar atleta existente → cambios persisten.
- Manual: archivar atleta → desaparece del listado activo.

**Commit sugerido:** `feat(atletas): formulario crear/editar/archivar`

---

# FASE 2 — Eventos e Inscripciones

## Tarea 08: Endpoints backend de eventos

**Branch:** `feat/08-eventos-backend`

**Qué hacer:**
Acciones en `Eventos.gs`:
- `eventos.list`, `eventos.get`, `eventos.create`, `eventos.update`, `eventos.setEstatus`.
- Auto-generar `evt_XXX`.
- Validar fecha futura/pasada permitida, sede requerida.

**Pruebas:**
- Manual con `curl`: crear evento, listar, cambiar estatus → verificar en Sheet.

**Commit sugerido:** `feat(eventos): endpoints crud en apps script`

---

## Tarea 09: UI listado y creación de eventos

**Branch:** `feat/09-eventos-listado`

**Qué hacer:**
- `admin/eventos.html`: tarjetas o tabla con eventos. Filtro por estatus.
- Botón "Nuevo evento" → modal con nombre, fecha, sede.
- Click en evento → navega a `evento.html?id=evt_XXX`.

**Pruebas:**
- Manual: crear 2 eventos. Verificar listado y filtros.
- Manual: click en evento — abre `evento.html` (puede estar vacío todavía).

**Commit sugerido:** `feat(eventos): listado y creación`

---

## Tarea 10: Endpoints backend de inscripciones

**Branch:** `feat/10-inscripciones-backend`

**Qué hacer:**
- `inscripciones.list&evento_id=X`
- `inscripciones.create` — toma `evento_id` + array de `atleta_id`.
- `inscripciones.setPesoPesaje` — un atleta.
- `inscripciones.delete`
- Al insertar, recalcular `categoria_calculada` en backend usando peso_referencia hasta que haya pesaje.

**Pruebas:**
- Manual con `curl`: inscribir 5 atletas a un evento, verificar `categoria_calculada` autogenerada.
- Capturar peso de pesaje y verificar que la categoría se recalcula.

**Commit sugerido:** `feat(inscripciones): endpoints crud + cálculo de categoría`

---

## Tarea 11: UI página de evento — inscribir atletas

**Branch:** `feat/11-evento-inscripciones-ui`

**Qué hacer:**
- `admin/evento.html?id=X`: muestra info del evento + tabs (Inscripciones / Pesaje / Brackets).
- Tab "Inscripciones": tabla de atletas inscritos + botón "Agregar atletas".
- Modal de agregar: lista filtrable del catálogo, multi-select, "Inscribir seleccionados".
- Botón "Quitar" por fila.

**Pruebas:**
- Manual: inscribir 5 atletas, verificar que aparecen.
- Manual: quitar uno, verificar que se elimina.
- Manual: no se permiten duplicados (el modal oculta atletas ya inscritos).

**Commit sugerido:** `feat(evento): ui de inscripciones`

---

## Tarea 12: UI pesaje del día

**Branch:** `feat/12-pesaje-ui`

**Qué hacer:**
- Tab "Pesaje" en `evento.html`: tabla con atletas inscritos, columna editable de peso real.
- Al editar peso → llama `inscripciones.setPesoPesaje` → recalcula categoría.
- Indicador visual: categoría declarada vs categoría real (si difiere, badge ámbar).
- Botón "Aprobar pesaje" por atleta → estatus `aprobado`.

**Pruebas:**
- Manual: inscribir un atleta con peso ref. 70 kg (Peso Ligero). Capturar pesaje 75 kg → debe re-clasificar a Superwelter o el correspondiente.
- Manual: aprobar pesaje → fila cambia de estado.

**Commit sugerido:** `feat(pesaje): captura de peso y recalculo de categoría`

---

# FASE 3 — Brackets

## Tarea 13: Algoritmo de agrupación de atletas

**Branch:** `feat/13-bracket-agrupacion`

**Qué hacer:**
Crear `admin/js/bracket-builder.js`:
- `agruparAtletas(inscripciones) → Array<{categoria, atletas, viable, tipo_sugerido}>`.
- Cada categoría es la tupla (género + división + nivel + peso).
- `viable = atletas.length >= 2`.
- `tipo_sugerido = atletas.length === 2 ? 'dos_atletas' : 'single_elimination'`.
- `generarSingleElimination(atletas) → Array<peleas>` con byes si N no es potencia de 2.

**Pruebas:**
Crear `admin/js/bracket-builder.test.html` con asserts:
- 0 atletas → no viable.
- 1 atleta → no viable.
- 2 atletas → tipo `dos_atletas`, 1 pelea.
- 3 atletas → tipo `single_elimination`, semis (1 con bye) + final, total 2 peleas activas.
- 4 atletas → 2 semis + 1 final, 3 peleas.
- 5 atletas → 8-bracket con 3 byes, 7 peleas (3 con bye en R1).
- 8 atletas → 7 peleas exactas.

Abrir `bracket-builder.test.html`, verificar consola.

**Commit sugerido:** `feat(brackets): algoritmo de agrupación y single elimination`

---

## Tarea 14: UI preview de brackets (antes de confirmar)

**Branch:** `feat/14-bracket-preview-ui`

**Qué hacer:**
- Tab "Brackets" en `evento.html`.
- Botón "Generar brackets" → corre `agruparAtletas` con inscripciones aprobadas.
- Render: lista de categorías. Cada una con:
  - Nombre completo de categoría.
  - Atletas asignados (chips).
  - Estado: viable / no viable.
  - Selector de tipo de bracket (si viable).
  - Botón "Mover atleta" (para ajustar manualmente).
- Botón "Confirmar todos los brackets viables" → llama a backend.

**Pruebas:**
- Manual: con 5 atletas aprobados, algunos en categorías viables y otras solo con 1, click en "Generar brackets" → ver preview.
- Manual: mover un atleta entre categorías manualmente, confirmar que se recalcula.
- Manual: click "Confirmar" → verificar en Sheet `Brackets` que se crearon filas.

**Commit sugerido:** `feat(brackets): preview con edición manual antes de confirmar`

---

## Tarea 15: Endpoints backend de brackets y peleas

**Branch:** `feat/15-brackets-backend`

**Qué hacer:**
- `brackets.confirm` — recibe array de brackets + estructura, persiste en Sheets, crea filas en `Peleas`.
- `brackets.list&evento_id=X`
- `brackets.get&id=X` (con peleas anidadas)
- `peleas.update` — actualizar resultado de una pelea.
- Al cerrar una pelea con ganador, el backend auto-avanza al ganador a la siguiente ronda.

**Pruebas:**
- Manual con `curl`: confirmar un bracket de 4 atletas → verificar 3 filas en `Peleas`.
- Actualizar pelea 1 (semis) con ganador → verificar que pelea 3 (final) recibe el `atleta1_id` correcto.

**Commit sugerido:** `feat(brackets): persistencia y avance automático`

---

## Tarea 16: Render SVG del bracket

**Branch:** `feat/16-bracket-svg`

**Qué hacer:**
Crear `admin/js/bracket-svg.js`:
- `renderBracket(svgEl, bracketData)`.
- Layout calculado: cajas (atleta1, atleta2) por pelea, líneas conectando rondas.
- Etiquetas: número de pelea, ronda.
- Estilo: cajas oscuras, texto blanco, bandera + nombre + academia.
- Caja del ganador resaltada.

**Pruebas:**
- Manual: crear `admin/bracket-svg.test.html` con datos mockeados de 2, 4, 8 atletas → renderizar y verificar visualmente que se ve correcto.
- Manual: probar con 5 atletas (impares con byes).

**Commit sugerido:** `feat(brackets): render svg estilo smoothcomp`

---

## Tarea 17: Página de bracket en vivo

**Branch:** `feat/17-bracket-vista`

**Qué hacer:**
- `admin/bracket.html?id=brk_XXX`.
- Header con categoría completa, número de atletas.
- Render SVG con datos del backend.
- Click en pelea → abre `scoreboard.html?pelea_id=X`.
- Botón "Editar bracket" → modal de confirmación → permite reasignar atletas.
- Modo proyección (botón fullscreen).

**Pruebas:**
- Manual: abrir un bracket confirmado, verificar render.
- Manual: probar modo proyección.
- Manual: clic en una pelea → debe abrir el scoreboard (puede estar vacío todavía).

**Commit sugerido:** `feat(brackets): página de bracket interactiva`

---

# FASE 4 — Scoreboard

## Tarea 18: Scoreboard — timer

**Branch:** `feat/18-scoreboard-timer`

**Qué hacer:**
- `admin/scoreboard.html?pelea_id=X`.
- Carga datos de la pelea + categoría.
- Lee de `reglamento.js` cuántos rounds y duración.
- UI grande del timer (MM:SS) + indicador de round actual (Round 1/3).
- Controles: Start, Pause, Reset round, Next round.
- Sonido de campana al finalizar round (opcional).

**Pruebas:**
- Manual: abrir scoreboard de un Adulto Avanzado en final → debe configurar 3 rounds × 3 min.
- Manual: Start → timer corre. Pause → para. Next round → reset y avanza el contador.
- Manual: en Juvenil A Novato debe ser 1 round × 3 min.

**Commit sugerido:** `feat(scoreboard): timer con configuración automática por categoría`

---

## Tarea 19: Scoreboard — puntos, advertencias y faltas

**Branch:** `feat/19-scoreboard-puntos`

**Qué hacer:**
- Por atleta: contador de puntos del round actual (10/9/8/7).
- Botones para asignar 10-10, 10-9, 10-8, 10-7.
- Contador independiente de advertencias y faltas por atleta.
- Tabla resumen de rounds (puntos por round, suma).

**Pruebas:**
- Manual: simular pelea de 3 rounds, asignar puntos, verificar suma.
- Manual: incrementar advertencias y faltas, verificar contadores.

**Commit sugerido:** `feat(scoreboard): puntuación, advertencias y faltas`

---

## Tarea 20: Scoreboard — finalización de pelea

**Branch:** `feat/20-scoreboard-finalizar`

**Qué hacer:**
- Botón "Finalizar pelea" → modal con:
  - Selector de ganador (atleta1 / atleta2 / empate).
  - Selector de método (de `METODOS_FINALIZACION`).
  - Round de finalización.
  - Tiempo de finalización (MM:SS).
  - Notas (textarea).
- Al confirmar → `api.post('peleas.update')` → cierra y redirige al bracket.
- Botón "Cancelar" cierra el modal.

**Pruebas:**
- Manual: finalizar una pelea por KO → ganador avanza en bracket.
- Manual: finalizar por Decisión Unánime → mismo comportamiento.
- Manual: regresar al bracket, verificar que la siguiente ronda tiene al ganador correcto.

**Commit sugerido:** `feat(scoreboard): captura de resultado y cierre de pelea`

---

## Tarea 21: Scoreboard — autosave y modo proyección

**Branch:** `feat/21-scoreboard-persistencia`

**Qué hacer:**
- Autosave del estado del scoreboard cada 5s en `localStorage`.
- Autosave en backend (campo `notas` o pestaña temporal) cada 30s.
- Al abrir scoreboard, si hay estado guardado en `localStorage` para esa pelea → ofrecer "Restaurar".
- Botón "Modo proyección" → fullscreen, fondo negro, oculta controles, muestra solo timer + nombres + puntos.

**Pruebas:**
- Manual: empezar pelea, capturar puntos, recargar la pestaña → debe ofrecer restaurar estado.
- Manual: activar modo proyección → fullscreen sin controles.

**Commit sugerido:** `feat(scoreboard): autosave en localStorage y modo proyección`

---

# FASE 5 — Cierre y Polish

## Tarea 22: Vista de resumen de evento

**Branch:** `feat/22-evento-resumen`

**Qué hacer:**
- Tab "Resumen" en `evento.html`.
- Cuando todas las peleas tengan ganador, mostrar podio (1°, 2°, 3°) por categoría.
- Botón "Finalizar evento" → estatus `finalizado` → readonly.

**Pruebas:**
- Manual: con un evento donde todos los brackets se completaron, verificar podio.
- Manual: finalizar evento → no se puede editar más (UI deshabilitada).

**Commit sugerido:** `feat(evento): resumen con podio y cierre de evento`

---

## Tarea 23: Edición de resultado post-finalización

**Branch:** `feat/23-editar-resultado`

**Qué hacer:**
- En la vista del bracket, click en una pelea ya finalizada permite "Editar resultado" con modal de confirmación.
- Si cambia el ganador, regenerar/actualizar las rondas posteriores (el backend recalcula avances).

**Pruebas:**
- Manual: finalizar pelea de semis, finalizar pelea de final, regresar y editar resultado de semis → debe re-actualizar la final.

**Commit sugerido:** `feat(brackets): edición de resultado con recalculo de avances`

---

## Tarea 24: Integración con sitio principal (link a admin)

**Branch:** `feat/24-link-admin`

**Qué hacer:**
- En `index.html` del sitio principal, agregar discreto link a `/admin/` (footer o sección oculta).
- Verificar que no rompe ningún flujo público existente.

**Pruebas:**
- Manual: navegar al sitio principal → encontrar link → llegar a admin.
- Manual: regresión visual del sitio principal (compara con producción).

**Commit sugerido:** `feat(site): link al panel admin desde el sitio principal`

---

# FASE 6 — Post-MVP (opcionales)

## Tarea 25: Importar atletas desde CSV

**Branch:** `feat/25-importar-csv`

**Qué hacer:**
- Pantalla en `atletas.html` con uploader CSV.
- Parsear CSV en cliente, mostrar preview con validaciones.
- Botón "Importar" → batch insert al backend.
- Plantilla CSV descargable.

**Pruebas:**
- Manual: descargar plantilla, llenar 10 filas, subir, verificar que aparecen.
- Manual: subir CSV con errores (peso negativo, fecha inválida) → debe mostrar errores fila por fila sin importar las malas.

**Commit sugerido:** `feat(atletas): importación en lote desde csv`

---

## Tarea 26: Vista pública de bracket (read-only)

**Branch:** `feat/26-bracket-publico`

**Qué hacer:**
- `bracket-publico.html?id=brk_XXX` — solo SVG, sin controles, fullscreen-friendly.
- URL compartible.

**Pruebas:**
- Manual: abrir URL en ventana incógnita, verificar que se ve sin opciones de edición.

**Commit sugerido:** `feat(brackets): vista pública read-only`

---

## Tarea 27: Acceso protegido para admin

**Branch:** `feat/27-admin-auth`

**Qué hacer:**
- Implementar Google Sign-In en `/admin/`.
- Validar email contra whitelist en Apps Script.
- Si no autorizado → redirige a home.

**Pruebas:**
- Manual: entrar con cuenta autorizada → entra.
- Manual: entrar con cuenta random → rechazo.

**Commit sugerido:** `feat(admin): autenticación con google sign-in`

---

# Apéndice — Setup inicial de Git Flow

```bash
# Una sola vez, antes de empezar la Tarea 01:
cd /Users/odettegarcia/Documents/club-samoa-site
git checkout main
git pull
git status   # debe estar limpio

# Por cada tarea:
git checkout main
git pull
git checkout -b feat/NN-slug
# ...trabajar...
git add .
git commit -m "feat(scope): mensaje"
git push -u origin feat/NN-slug
# merge a main (GitHub UI o `git checkout main && git merge feat/NN-slug && git push`)
```

## Checklist al cerrar cada tarea

- [ ] Todos los archivos nuevos/modificados están commiteados.
- [ ] La rama está pusheada a `origin`.
- [ ] Las pruebas (manuales o automatizadas) listadas pasan.
- [ ] No quedan `console.log` o código comentado obvio.
- [ ] El sitio principal sigue funcionando (smoke test rápido).
- [ ] Si la tarea modifica el reglamento o cálculos, actualizar `PRD-brackets-mma.md`.
