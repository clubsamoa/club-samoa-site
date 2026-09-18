# Club Samoa Registration Backend

This folder contains the Google Apps Script backend and Excel templates for the two registration databases:

- `club-samoa-registro-uniformes.xlsx`
- `club-samoa-registro-examenes.xlsx`

## Google Sheets Setup

1. Open [script.google.com](https://script.google.com/) and create a new Apps Script project.
2. Paste the contents of `apps-script/Code.gs` into the project.
3. Run `configureDataSheets` once to connect the forms to the existing Google Sheets:
   - Uniformes: `1ZiN8C63ssLsCMhiszuU1I_xXkuIgGzFswmLm0vdp8cU`
   - Exámenes: `1GTkg0CF-AJLX-It04hBneMWBOqN0tNGyZFoW029YtjY`
4. Run `setupClubSamoaRegistros` once if you need Apps Script to format/rebuild the `Registro`, `Resumen`, and `Catalogos` tabs in those Sheets.
5. Approve the Google permissions.
6. Check the execution log. It will show the URLs for the two connected Google Sheets.
7. Optional: run `configureNotificationEmail("tu-correo@example.com")` to choose where notifications go.
8. Run `instalarTriggerDeNotificaciones` once. Without it the emails still go out, but inline — see **Notificaciones por correo** below.
9. Deploy the project as a Web App.
10. Set **Execute as** to `Me`.
11. Set **Who has access** to `Anyone`.
12. Copy the Web App URL ending in `/exec`.
13. Put that URL in the `APPS_SCRIPT_REGISTROS_URL` environment variable — in `.env.local` and in Netlify. **Never commit it**: this repo is public and the endpoint has no auth, so anyone with the URL can write to the Sheets.

After that, the website forms will save rows into the matching Google Sheet and send an email notification for each new registration.

### Notificaciones por correo

`MailApp.sendEmail` tarda lo que tarda, y en el ensayo de cutover (N21) pasó de los 20 s que espera el sitio. Como la fila se escribe **antes** del correo, el alumno veía "no se pudo enviar" con su registro ya guardado: reenviaba, se generaba un `submission_id` nuevo y quedaba duplicado.

Por eso `doPost` ya no manda el correo: escribe la fila, deja el aviso en una cola (Script Properties, una propiedad por pendiente) y responde. El trigger `enviarNotificacionesPendientes` la vacía cada minuto.

- **`instalarTriggerDeNotificaciones()`** — se corre una sola vez desde el editor. Si se corre de nuevo no duplica el trigger.
- **`estadoDeLaColaDeNotificaciones()`** — imprime si el trigger está puesto, si `doPost` lo da por vivo y cuántos avisos quedan sin mandar.
- **`desinstalarTriggerDeNotificaciones()`** — lo quita.

Cada corrida del trigger deja un **latido** (una fecha en Script Properties). `doPost` mira ese latido: si falta o tiene más de 15 minutos, manda el correo en línea igual que antes y deja un aviso en el log. Así nunca se pierde una notificación aunque nadie haya instalado el trigger, aunque alguien lo borre a mano, o aunque Google lo desactive tras varios fallos seguidos.

**`doPost` no puede llamar a `ScriptApp`.** Esa API exige el scope `script.scriptapp`, que la implementación web no tiene autorizado: la primera versión de este cambio comprobaba el trigger con `ScriptApp.getProjectTriggers()` y tumbó todos los registros en producción con `ok:false` — y con la fila ya escrita, que es exactamente el fallo que se venía a curar. De ahí el latido. `ScriptApp` solo aparece en las tres funciones que se corren a mano desde el editor, donde el permiso sí se pide.

Un correo que falle se reintenta 3 veces y después se descarta con un `console.error` — la fila en la Sheet no se toca nunca.

Las pruebas de esta lógica están en `lib/__tests__/code-gs-notificaciones.test.ts`: cargan este `Code.gs` en un `vm` con los servicios de Google sustituidos por dobles, porque desde el repo no hay forma de desplegarlo para probarlo.

---

## Eventos MMA (plataforma de brackets)

Backend independiente para la mini-plataforma de brackets MMA descrita en `PRD-brackets-mma.md`. Vive en un **proyecto Apps Script y Web App separados** del de uniformes/exámenes, para mantener responsabilidades aisladas.

### Setup inicial (una sola vez)

1. Abre [script.google.com](https://script.google.com/) y crea un **nuevo proyecto Apps Script** (no reuses el de Code.gs).
2. Renombra el archivo por defecto a `Eventos.gs` y pega el contenido de `apps-script/Eventos.gs`.
3. (Opcional) Si ya tienes una Google Sheet existente que quieras usar, abre **Project Settings → Script properties** y agrega:
   - `CLUB_SAMOA_EVENTOS_SPREADSHEET_ID` = `<id de tu sheet>`
   Si la omites, `setupEventosSheets()` crea una nueva Sheet llamada `Club Samoa - Eventos MMA` en tu Drive.
4. En el editor de Apps Script selecciona la función `setupEventosSheets` y haz clic en **Run**. Aprueba los permisos cuando se solicite.
5. Abre **View → Logs** y copia la URL de la Sheet que se imprimió. Verifica que tenga 6 pestañas: `Atletas`, `Eventos`, `Inscripciones`, `Brackets`, `Peleas`, `Configuracion`.
6. Despliega como Web App:
   - **Deploy → New deployment → Type: Web app**
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (la URL es difícil de adivinar; en una tarea posterior agregaremos auth real).
   - Copia la URL `/exec`.
7. Pega esa URL en `registration-config.js` como `window.CLUB_SAMOA_EVENTOS_ENDPOINT`.

### Verificación rápida

Una vez desplegado, abre en el navegador:

```
<tu URL /exec>?action=ping
```

Debe responder:

```json
{"ok":true,"service":"Club Samoa — Eventos MMA","version":"0.1.0","timestamp":"..."}
```

Y para forzar la creación/reparación de pestañas remotamente:

```
<tu URL /exec>?action=setup
```

Devuelve `{ ok, spreadsheetUrl, spreadsheetId, tabs }`.

### Endpoints disponibles por tarea

| Tarea | Endpoints |
| --- | --- |
| 01 (esta) | `ping`, `setup` |
| 05 | `atletas.list/get/create/update/archive` |
| 08 | `eventos.list/get/create/update/setEstatus` |
| 10 | `inscripciones.list/create/setPesoPesaje/delete` |
| 15 | `brackets.confirm/list/get`, `peleas.update` |

