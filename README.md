# SmartCoach

SmartCoach è una PWA mobile-first per allenamento ibrido: ipertrofia, forza di base, ricostruzione della base aerobica Z2 e gestione del recupero.

## SmartCoach v2
- Home "Oggi" con readiness e allenamento consigliato
- Programma settimanale adattivo: 3 sedute forza + 2 Z2 + recupero
- Riduzione automatica del volume in base a readiness e carico dei turni
- Logger serie-per-serie con kg, ripetizioni e RPE
- Progressione automatica a doppia progressione
- Varianti esercizio e switch Casa / Palestra
- Cardio intercambiabile: corsa, cyclette, corso endurance, camminata
- Storico, volume stimato, costanza e trend del peso
- Check-in sonno / energia / DOMS / stress / RHR / HRV / COROS recovery
- Sezioni Recovery, Corpo, Nutrizione, Sonno, Connessioni e Backup
- Snapshot COROS e turni Google Calendar già integrati nel motore adattivo
- PWA offline con service worker e dati locali
- Backup e ripristino JSON

## Dati e privacy
I log inseriti nell'app restano nel browser tramite localStorage. Il repository non contiene password o token personali.

COROS e Google Calendar vengono letti tramite connessioni autorizzate esterne e riportati nell'app come snapshot. La PWA statica non contiene credenziali. Apple Health/HealthKit non è leggibile direttamente da una PWA browser.

## Deploy
Il deploy di produzione è gestito automaticamente da Vercel a ogni push su `main`. Non è necessario GitHub Pages.

## Programma iniziale
- Lunedì: Lower A
- Martedì: Z2
- Mercoledì: recupero
- Giovedì: Upper
- Venerdì: recupero
- Sabato: Lower B / posterior chain
- Domenica: Z2 easy

Nelle prime due settimane di rientro l'obiettivo è evitare il cedimento, ricostruire tolleranza e aumentare gradualmente volume e carichi.
