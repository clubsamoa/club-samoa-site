# PRD: Plataforma de Brackets MMA — Club Samoa

**Versión:** 0.1 (borrador)
**Fecha:** 2026-05-28
**Autora:** Odette Garcia
**Estado:** En revisión

---

## 1. Resumen ejecutivo

Mini-plataforma interna para gestionar eventos de MMA del Club Samoa, integrada al sitio web actual (`clubsamoa.github.io/club-samoa-site`). Permite registrar atletas, agruparlos automáticamente según el Reglamento Unificado FAMM 2025, generar brackets visuales y operar un scoreboard digital en vivo.

Inspirada en Smoothcomp, pero adaptada al volumen real del club (≤200 atletas, ≥5 eventos/año) y operada por una sola persona.

---

## 2. Contexto

- **Sitio actual:** estático, alojado en GitHub Pages.
- **Stack ya en uso:** HTML/CSS/JS vanilla + Google Apps Script + Google Sheets (patrón existente en `registration-backend/`).
- **Operación hoy:** los brackets se arman manualmente (Excel + papel). Es lento y propenso a errores de categorización.
- **Decisión técnica clave:** NO migrar a Next.js. Se replica el patrón actual (Apps Script + Sheets) para minimizar riesgo, costo y deuda técnica.

---

## 3. Objetivos

1. Sistematizar el armado de brackets respetando el Reglamento FAMM 2025 (edad + género + nivel + peso).
2. Reducir el tiempo de armado de brackets de horas a minutos.
3. Eliminar errores de categorización por cálculo manual.
4. Tener un scoreboard digital proyectable durante el evento.
5. Mantener registro digital histórico de eventos, atletas y resultados.

---

## 4. No-objetivos (out of scope)

- **Acceso protegido / autenticación de admin** — explícitamente omitido en esta fase (a definir en fase posterior).
- Sistema de ranking acumulado entre eventos (R1–R6 del reglamento).
- Portal público de inscripciones (los atletas no se registran solos).
- Cobro de inscripciones / pagos.
- Sistema de 3 jueces simultáneos en dispositivos separados.
- Streaming, transmisión en vivo o integración con OBS.
- App móvil nativa.
- Notificaciones push o por email.
- Exportación a PDF (puede venir en fase posterior).
- Multi-idioma (todo en español por ahora).

---

## 5. Usuario

**Único rol en esta fase:** Operador de evento (Odette).

Tareas que ejecuta:
- Carga y mantiene catálogo de atletas.
- Crea eventos y registra inscripciones.
- Captura pesajes el día del evento.
- Genera, ajusta y confirma brackets.
- Opera el scoreboard durante las peleas.
- Captura resultados finales.

---

## 6. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | HTML + CSS + JS vanilla | Consistente con sitio actual |
| Render de brackets | SVG generado en cliente | Sin librerías externas pesadas |
| Backend | Google Apps Script (Web App) | Endpoints `doGet` / `doPost` |
| Base de datos | Google Sheets nueva | `club-samoa-eventos` |
| Hosting | GitHub Pages | Mismo repo `clubsamoa/club-samoa-site` |
| Integración | `fetch` desde HTML hacia URL `/exec` del Apps Script | Patrón ya usado en registros |

**Costo mensual estimado:** $0 USD (todo dentro de cuotas gratuitas de Google).

---

## 7. Estructura de datos (Google Sheets)

**Nombre del archivo:** `club-samoa-eventos`

### Pestaña `Atletas`
| Campo | Tipo | Notas |
|---|---|---|
| id | string | Auto-generado (`atl_001`, etc.) |
| nombre_completo | string | |
| fecha_nacimiento | date | Base para cálculo de división |
| genero | enum | `Masculino` / `Femenino` |
| anios_practica | number | Para sugerir nivel |
| nivel | enum | `Novato` / `Principiante` / `Intermedio` / `Avanzado` |
| peso_referencia_kg | number | Peso histórico/declarado |
| academia | string | |
| pais | string | Default `México` |
| foto_url | string | Opcional |
| activo | boolean | Soft delete |
| creado_en | datetime | |

### Pestaña `Eventos`
| Campo | Tipo | Notas |
|---|---|---|
| id | string | `evt_001` |
| nombre | string | Ej. "Campeonato Estatal Agosto 2026" |
| fecha | date | |
| sede | string | |
| estatus | enum | `borrador` / `activo` / `finalizado` |
| creado_en | datetime | |

### Pestaña `Inscripciones`
| Campo | Tipo | Notas |
|---|---|---|
| id | string | `ins_001` |
| evento_id | string | FK |
| atleta_id | string | FK |
| peso_pesaje_kg | number | Capturado el día del evento |
| categoria_calculada | string | Ej. `Adultos / Masculino / Avanzado / Peso Ligero -70.3kg` |
| estatus | enum | `pendiente_pesaje` / `aprobado` / `rechazado` |

### Pestaña `Brackets`
| Campo | Tipo | Notas |
|---|---|---|
| id | string | `brk_001` |
| evento_id | string | FK |
| categoria | string | Categoría completa |
| tipo_bracket | enum | `single_elimination` / `dos_atletas` |
| num_atletas | number | |
| estatus | enum | `borrador` / `confirmado` / `en_curso` / `finalizado` |
| json_estructura | text | Snapshot de la estructura del bracket |

### Pestaña `Peleas`
| Campo | Tipo | Notas |
|---|---|---|
| id | string | `pel_001` |
| bracket_id | string | FK |
| ronda | string | `final`, `semifinal`, `cuartos`, `octavos`, etc. |
| numero_pelea | number | Orden dentro de la ronda |
| atleta1_id | string | FK |
| atleta2_id | string | FK |
| ganador_id | string | FK, nullable |
| metodo_finalizacion | enum | `KO` / `TKO` / `Sometimiento` / `Decisión Unánime` / `Decisión Dividida` / `Decisión Mayoritaria` / `Decisión Técnica` / `Empate Técnico` / `Descalificación` / `No Contest` |
| round_finalizacion | number | Nullable |
| tiempo_finalizacion | string | `mm:ss`, nullable |
| notas | text | |

### Pestaña `Configuracion`
Constantes globales (versión del reglamento aplicado, etc.). Pestaña de solo lectura.

---

## 8. Reglas de negocio (Reglamento FAMM 2025)

### 8.1 Cálculo automático de división por edad

Se calcula a la **fecha del evento** (no a hoy).

| División | Rango |
|---|---|
| Mini 1 | 4–5 años |
| Mini 2 | 6–7 años |
| Infantil | 8–9 años |
| Juvenil D | 10–11 años |
| Juvenil C | 12–13 años |
| Juvenil B | 14–15 años |
| Juvenil A | 16–17 años |
| Junior | 18–20 años |
| Adultos | 21+ |

### 8.2 Nivel (años de práctica)

| Nivel | Rango |
|---|---|
| Novato | 0 – 1 año |
| Principiante | 1 año 1 mes – 2 años |
| Intermedio | 2 años 1 mes – 3 años |
| Avanzado | 3+ años |

El sistema **sugiere** un nivel basado en años de práctica, pero el operador puede sobreescribir.

### 8.3 Categorías de peso

El sistema aplica la tabla correspondiente del reglamento según (división + género). Ejemplo simplificado para **Adultos Varonil**:

| Categoría | Peso máximo |
|---|---|
| Peso Paja | < 52.2 kg |
| Peso Mosca | < 56.7 kg |
| Peso Gallo | < 61.2 kg |
| Peso Pluma | < 65.8 kg |
| Peso Ligero | < 70.3 kg |
| Superligero | < 74.8 kg |
| Superwelter | < 79.4 kg |
| Medio | < 83.9 kg |
| Supermedio | < 88.4 kg |
| Semipesado | < 93 kg |
| Pesado | < 97 kg |
| Superpesado | ≥ 97 kg |

Las tablas para Mini 1/2, Infantil, Juvenil A–D, Junior y Adultos (ambos géneros) se codifican como tablas estáticas en el frontend, basadas en las páginas 3–5 del reglamento.

### 8.4 Rounds y tiempo según categoría (para scoreboard)

| Categoría | Eliminatorias | Final |
|---|---|---|
| Adultos Avanzados | 1 round × 5 min | 3 rounds × 3 min, descanso 1 min |
| Adultos Novatos/Principiantes/Intermedios | 1 round × 4 min | 1 round × 4 min |
| Junior Avanzado | 1 round × 5 min | 3 rounds × 3 min, descanso 1 min |
| Junior Novato/Principiante/Intermedio | 1 round × 4 min | 1 round × 4 min |
| Juvenil A Avanzado | 1 round × 4 min | 3 rounds × 2 min, descanso 1 min |
| Juvenil A Novato/Principiante/Intermedio | 1 round × 3 min | 1 round × 3 min |
| Juvenil B y C (todos los niveles) | 1 round × 3 min | 1 round × 3 min |
| Juvenil D / Infantil / Mini 1 / Mini 2 (todos los niveles) | 1 round × 2 min | 1 round × 2 min |

El scoreboard auto-configura el timer al abrir la pelea, leyendo categoría + tipo de pelea (eliminatoria / final).

### 8.5 Reglas de agrupación para brackets

Atletas se agrupan por la tupla:
**(género, división de edad, nivel, categoría de peso)**.

- **0 o 1 atleta** en la tupla → no se genera bracket. Se marca como "no viable" y se muestra advertencia.
- **2 atletas** → pelea única (`tipo_bracket = dos_atletas`).
- **3+ atletas** → `single_elimination`. Se sortean posiciones; el bracket completa con "byes" si el número no es potencia de 2.

### 8.6 Tipos de resultado / finalización

Captados al cerrar la pelea (referencia: pág. 14 del reglamento):
- Sometimiento (Tap Out / Rendición verbal)
- KO (Knockout efectivo)
- TKO (intervención del referee)
- Recomendación médica
- Decisión Unánime / Dividida / Mayoritaria
- Decisión Técnica
- Empate Técnico
- Descalificación
- No Contest

### 8.7 Sistema de puntuación

10-point must system. El operador captura el puntaje final consolidado (no hay tarjetas separadas por juez). Campos por round:
- Puntaje atleta 1 (10/9/8/7)
- Puntaje atleta 2 (10/9/8/7)
- Advertencias y faltas (contador independiente)

---

## 9. Features (con prioridad)

### F1 — Gestión de atletas (P0)
- Listado con filtros (género, división calculada, nivel, academia, búsqueda por nombre).
- Crear atleta con validaciones (fecha válida, peso > 0, etc.).
- Editar atleta.
- Archivar (soft delete).

### F2 — Gestión de eventos (P0)
- Crear evento (nombre, fecha, sede).
- Inscribir atletas existentes (multi-select desde el catálogo).
- Cambiar estatus del evento.
- Ver listado de eventos pasados/activos.

### F3 — Pesaje del día (P0)
- Vista de "pesaje" por evento: lista de atletas inscritos.
- Captura del peso real de cada uno.
- Sistema recalcula categoría de peso al momento.
- Si un atleta excede su categoría declarada, alerta visual.

### F4 — Generación de brackets (P0)
- Botón "Generar brackets" a nivel evento.
- Auto-agrupación según §8.5.
- **Preview antes de confirmar:** muestra tabla con cada categoría, número de atletas, atletas asignados.
- Categorías con <2 atletas se marcan como "no viable" (visible pero no genera bracket).
- Operador puede mover atletas manualmente entre categorías (con warning si rompe regla).
- Confirmación por categoría (individual) o "confirmar todas" (masivo).

### F5 — Visualización del bracket (P0)
- Render SVG: cajas conectadas con líneas, estilo Smoothcomp.
- Etiquetas: número de pelea, ronda (Final / Semis / Cuartos / Octavos).
- Cada caja muestra: nombre, academia, bandera (si aplica).
- Indicador visual del ganador (caja resaltada).
- Click en una pelea → abre scoreboard.
- Modo "proyección" (fullscreen, fondo oscuro, sin botones).

### F6 — Edición post-confirmación (P0)
- Botón "Editar bracket" en bracket confirmado.
- Confirmación adicional ("¿Seguro? Esto puede afectar peleas en curso").
- Permite reasignar atletas, cambiar tipo de bracket, regenerar.

### F7 — Scoreboard en vivo (P0)
- Pantalla dedicada por pelea.
- Cabecera con: ambos atletas, academia, banderas, categoría completa.
- Timer grande, auto-configurado al tiempo correcto (§8.4).
- Controles del operador:
  - Start / Pause / Reset
  - Botones de puntos (round actual): 10–10, 10–9, 10–8, 10–7 (cualquiera de los dos atletas)
  - Contador de advertencias por atleta
  - Contador de faltas por atleta
  - Botón "Finalizar pelea" → modal con selector de ganador + método (§8.6) + round + tiempo
- Autosave del estado cada 5 segundos en `localStorage` y cada 30 segundos en Sheets.
- Botón "Modo proyección" (fullscreen oscuro).

### F8 — Captura de resultados (P0)
- Al cerrar la pelea, el ganador auto-avanza en el bracket.
- Editar resultado después (P1 — disponible pero con confirmación).

### F9 — Importar atletas desde CSV (P1)
- Sube un archivo CSV con el formato definido y crea atletas en lote.
- Primera carga inicial desde tu Excel actual.

### F10 — Vista pública/proyección por evento (P2)
- URL pública del bracket (read-only, sin botones de edit).
- Diseño limpio para mostrar en pantalla grande durante el evento.

---

## 10. Flujos principales

### Flujo A — Preparación pre-evento (días antes)
1. Operador entra a `/admin` (sin protección en esta fase).
2. Va a "Atletas" → registra/actualiza atletas que participarán.
3. Va a "Eventos" → crea evento nuevo (nombre, fecha, sede).
4. Selecciona atletas del catálogo y los inscribe al evento.
5. Guarda evento como `borrador`.

### Flujo B — Día del evento, pesaje
1. Operador abre el evento → vista de "Pesaje".
2. Captura el peso real de cada atleta.
3. Sistema recalcula categoría de peso por atleta.
4. Confirma pesajes → estatus cambia a `aprobado`.

### Flujo C — Día del evento, generar brackets
1. Operador clic en "Generar brackets".
2. Sistema agrupa por (género, edad, nivel, peso).
3. Pantalla de preview con todas las categorías y atletas.
4. Operador revisa, ajusta si es necesario.
5. Confirma → estatus de cada bracket pasa a `confirmado`.
6. Estatus del evento pasa a `activo`.

### Flujo D — Durante el evento, pelea
1. Operador abre el bracket de la categoría que va a competir.
2. Clic en la primera pelea → abre scoreboard.
3. Activa "Modo proyección" en pantalla externa.
4. Maneja la pelea: timer, puntos, advertencias, faltas.
5. Al terminar: clic "Finalizar pelea" → selecciona ganador, método, tiempo.
6. Sistema actualiza bracket: ganador avanza a la siguiente ronda.
7. Repite para todas las peleas hasta finalizar.

### Flujo E — Cierre del evento
1. Una vez todas las peleas tienen resultado, operador clic "Finalizar evento".
2. Estatus del evento pasa a `finalizado`.
3. Vista de resumen con podio por categoría.

---

## 11. Estructura propuesta del repo

```
club-samoa-site/
├── index.html                    # (sin cambios)
├── community.html                # (sin cambios)
├── students.html                 # (sin cambios)
├── admin/                        # ← nuevo
│   ├── index.html                # Dashboard admin
│   ├── atletas.html              # Gestión de atletas
│   ├── eventos.html              # Listado de eventos
│   ├── evento.html               # Vista de un evento (pesaje, brackets)
│   ├── bracket.html              # Visualización de un bracket
│   ├── scoreboard.html           # Scoreboard en vivo
│   ├── styles-admin.css
│   └── js/
│       ├── api.js                # Cliente del Apps Script
│       ├── reglamento.js         # Tablas de pesos, edades, niveles, tiempos
│       ├── bracket-builder.js    # Lógica de auto-agrupación
│       ├── bracket-svg.js        # Render SVG
│       └── scoreboard.js         # Timer y controles
├── registration-backend/
│   └── apps-script/
│       ├── Code.gs               # (existente)
│       └── Eventos.gs            # ← nuevo
└── PRD-brackets-mma.md           # este documento
```

---

## 12. Limitaciones conocidas

1. **Latencia:** cada operación contra Sheets toma 1–3 segundos. Aceptable para el flujo descrito.
2. **Cuota Apps Script:** 90 min/día de ejecución. Holgado para 5 eventos/año + administración.
3. **Sin sincronización multi-dispositivo en tiempo real:** si abres el bracket en dos pantallas, hay que refrescar manualmente.
4. **Scoreboard:** si cierras la pestaña accidentalmente, el `localStorage` recupera el estado al reabrir, pero hay riesgo de 5–30 seg de pérdida.
5. **Sin offline:** requiere internet durante el evento. Mitigación: tener hotspot de respaldo.
6. **Visual del bracket:** funcional y limpio, pero no llegará al pulido de Smoothcomp.
7. **Sin protección de acceso en esta fase:** cualquier persona que conozca la URL puede entrar y editar. Asumido como aceptable temporalmente.

---

## 13. Métricas de éxito

- **Tiempo de armado de brackets:** baja de >2 horas (manual) a <30 min.
- **Eventos gestionados:** 100% de los eventos del año en la plataforma.
- **Errores de categoría:** 0 errores por mal cálculo manual.
- **Adopción:** la operadora puede usar el sistema sin asistencia técnica.

---

## 14. Roadmap por fases

### Fase 1 — MVP (4–6 semanas)
- F1, F2, F3, F4, F5, F6, F7, F8 (todos P0).
- Sin acceso protegido.
- Bracket de single elimination + dos atletas.
- Scoreboard con timer, puntos, advertencias, faltas, finalización.

### Fase 2 — Hardening (2–3 semanas adicionales)
- F9 (importar CSV).
- F10 (vista pública/proyección dedicada).
- **Acceso protegido con Google login (admin-only).**
- Mejoras de UX según uso real.

### Fase 3 — Futuro (a evaluar)
- Bracket "double bronze" / double elimination / round robin.
- Sistema de ranking persistente entre eventos (R1–R6).
- Sistema de jueces múltiples (3 dispositivos).
- Export PDF de brackets.
- Histórico por atleta (peleas, récord W-L).

---

## 15. Preguntas abiertas

1. ¿Quieres conservar la nomenclatura exacta del reglamento (ej. "Adultos / Masculino / Avanzado / M:Lightweight -70.3 kg (155 lbs)") o algo más corto en la UI?
2. ¿Necesitas registrar el equipo de protección entregado / revisado por atleta?
3. ¿El nombre del operador / juez central queda registrado en cada pelea, o solo el resultado?
4. ¿El bracket visual debe seguir un estilo específico del Club Samoa (colores, logo) o estilo neutro estilo Smoothcomp está bien?
5. ¿Inicialmente cargamos el catálogo de atletas desde tu Excel actual? Si sí, ¿me lo compartes en la siguiente sesión?
