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
8. Deploy the project as a Web App.
9. Set **Execute as** to `Me`.
10. Set **Who has access** to `Anyone`.
11. Copy the Web App URL ending in `/exec`.
12. Paste that URL into `registration-config.js`.

After that, the website forms will save rows into the matching Google Sheet and send an email notification for each new registration.

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

