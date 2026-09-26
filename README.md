# SmartCoach

SmartCoach v3 è una PWA mobile-first per allenamento ibrido. Il principio della v3 è semplice: le schermate non hanno più dataset separati. Home, Settimana, Training, Recovery, Sonno e Trend leggono lo stesso stato atleta costruito da COROS, Apple Health, Google Calendar e log SmartCoach.

## SmartCoach v3

- Timeline unica COROS + SmartCoach, con deduplicazione per ID attività
- Planner settimanale dinamico: considera allenamenti già svolti, recovery, training load, turni e obiettivi
- Readiness spiegabile: sonno, HRV, FC riposo, COROS Recovery, turni e check-in soggettivo
- COROS Running Fitness: VO₂max, Running Level, soglia, race predictor, load ratio e attività
- Zone FC del Running Fitness Test trattate come valori COROS autorevoli, senza ricalcolo
- Apple Health con storico 180 giorni, passi, distanza, HRV e FC a riposo
- Sonno Apple Health ricostruito per intervalli: notte principale separata dai pisolini e attribuita al giorno di risveglio
- COROS usato come fallback per sonno e passi se Apple Health non ha un dato giornaliero valido
- Google Calendar usato per ricavare automaticamente il carico dei turni
- Trend 7/28/90 giorni: corsa, km, passi, distanza, sonno, HRV, FC riposo, load ratio e storico allenamenti
- PWA offline con cache versionata e backup locale

## Flussi dati

### Apple Health

Apple Watch / iPhone → Apple Health → Health Exporter → `/api/health` → Vercel Blob → SmartCoach.

L'API conserva i batch originali. Quando il parser viene aggiornato, lo storico può essere ricostruito senza richiedere un nuovo export completo.

### COROS

SmartCoach → `/api/coros-connect` → OAuth COROS → COROS MCP → `/api/coros` → Vercel Blob → SmartCoach.

La PWA sincronizza all'apertura, quando torna visibile e periodicamente mentre è in uso. Il backend mantiene uno snapshot in cache e conserva la cronologia delle valutazioni fitness.

### Google Calendar

Google Calendar private iCal feed → `/api/calendar` → SmartCoach.

Configurare su Vercel la variabile server-side:

`GOOGLE_CALENDAR_ICS_URL`

con l'indirizzo iCal privato del calendario. L'URL resta sul server e non viene inviato al browser.

## Variabili Vercel

- `BLOB_READ_WRITE_TOKEN` — obbligatoria per Health e persistenza COROS
- `GOOGLE_CALENDAR_ICS_URL` — necessaria per il sync automatico dei turni

L'autorizzazione COROS viene completata dall'utente tramite OAuth e i token vengono conservati nel Blob privato.

## Deploy

La produzione è distribuita automaticamente da Vercel quando viene aggiornato `main`.

## Privacy

Il repository non contiene token COROS, URL iCal privati o password. I dati locali dell'allenamento restano nel browser; Health e gli snapshot COROS usati per la sincronizzazione sono conservati nel Blob privato del progetto Vercel.

<!-- Redeploy trigger: refresh production environment variables for Google Calendar -->

<!-- Redeploy trigger: Google Calendar env linked to smartcoach -->
