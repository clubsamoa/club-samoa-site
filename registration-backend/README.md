# Club Samoa Registration Backend

This folder contains the Google Apps Script backend and Excel templates for the two registration databases:

- `club-samoa-registro-uniformes.xlsx`
- `club-samoa-registro-examenes.xlsx`

## Google Sheets Setup

1. Open [script.google.com](https://script.google.com/) and create a new Apps Script project.
2. Paste the contents of `apps-script/Code.gs` into the project.
3. Run `setupClubSamoaRegistros` once.
4. Approve the Google permissions.
5. Check the execution log. It will show the URLs for the two Google Sheets that were created.
6. Optional: run `configureNotificationEmail("tu-correo@example.com")` to choose where notifications go.
7. Deploy the project as a Web App.
8. Set **Execute as** to `Me`.
9. Set **Who has access** to `Anyone`.
10. Copy the Web App URL ending in `/exec`.
11. Paste that URL into `registration-config.js`.

After that, the website forms will save rows into the matching Google Sheet and send an email notification for each new registration.
