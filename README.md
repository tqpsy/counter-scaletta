# Regia Tempi

Dashboard per gestire i tempi dei relatori in eventi live, con Stage Display e Countdown sincronizzati.

L'app è statica: basta pubblicare `index.html`, `app.css`, `sw.js`, `manifest.webmanifest`, `icon.svg` e la cartella `vendor`.
Dopo la prima apertura online, dashboard, Stage Display e Countdown funzionano anche senza connessione.

## CSS

Gli stili Tailwind sono precompilati in `app.css`. Se aggiungi o cambi classi in `index.html`, rigenera il file:

```sh
npm install
npm run build:css
```

## Schermi in rete

Con "Schermi in rete" (icona Wi-Fi nella dashboard) Stage Display e Countdown si possono aprire su altri PC, telefoni o proiettori. Il PC di regia crea una stanza con un codice casuale e mostra un QR; gli altri schermi sono in sola lettura. Ci sono due modi:

- **Via internet** (Firebase): schermi anche su reti diverse, serve internet su tutti i dispositivi.
- **In rete locale** (server locale): senza internet, tutti gli schermi sulla stessa rete Wi-Fi o sullo stesso router.

### Via internet (Firebase)

La sincronizzazione passa da un progetto Firebase gratuito (piano Spark). Configurazione, una volta sola:

1. Su [console.firebase.google.com](https://console.firebase.google.com) crea un progetto (Google Analytics non serve).
2. Build → Realtime Database → Crea database, posizione `europe-west1`, modalità bloccata.
3. Nella scheda Regole incolla il contenuto di `firebase-rules.json` e pubblica: chi ha il link di una stanza può guardarla, solo il browser che l'ha creata può modificarla.
4. Build → Authentication → Metodo di accesso → attiva "Anonimo".
5. Impostazioni progetto → Le tue app → app Web `</>`: copia `apiKey` e `databaseURL` in `FIREBASE_CONFIG` all'inizio dello script in `index.html`.

Questi due valori non sono segreti: identificano il progetto, la protezione la fanno le regole. Con `FIREBASE_CONFIG` vuoto la funzione resta disattivata.

### In rete locale (senza internet)

Il PC di regia fa da server per gli altri schermi. Serve [Node.js](https://nodejs.org) (versione LTS), da installare una volta.

1. Scarica il progetto da GitHub (Code → Download ZIP) ed estrailo sul PC di regia.
2. Nella cartella `server` fai doppio clic su `avvia-server.bat` (Windows) o `avvia-server.command` (Mac) e lascia aperta la finestra. La prima volta Windows chiede se consentire l'accesso alla rete: consenti le reti private.
3. Apri la dashboard come sempre e in "Schermi in rete" premi "Attiva in rete locale". Chrome o Edge possono chiedere il permesso di accedere ai dispositivi della rete locale: consenti.
4. Inquadra il QR con gli altri dispositivi, collegati alla stessa rete del PC.

Il server serve l'app agli schermi della sala e offre la stessa API del Realtime Database, quindi l'app usa lo stesso codice nei due casi. Solo il browser che ha creato la stanza può modificarla. La porta è la 8765 (si cambia con la variabile `REGIA_PORT`, ma la dashboard usa sempre la 8765).

## Programma per Windows

La cartella `desktop` contiene Regia Tempi come programma per PC (Electron). È la stessa app del sito, con in più il server locale già incluso: non serve installare Node.js né avviare `avvia-server`.

- **Rete locale senza internet**: il server parte da solo con il programma, quindi "Attiva in rete locale" funziona subito. La prima volta Windows chiede se consentire l'accesso alla rete: consenti le reti private.
- **Via internet (Firebase)**: funziona come dal sito, e i link per gli altri schermi puntano al sito pubblico.
- **Secondo schermo**: Stage e Countdown si aprono in finestre del programma, a schermo intero sul secondo schermo senza dover cliccare.
- L'import da PDF scarica pdf.js da internet la prima volta che si usa.

### Scaricarlo

Da GitHub → Releases, oppure dal pulsante "Scarica per Windows" nelle impostazioni della dashboard:

- `Regia-Tempi-Setup.exe` installa il programma (icona sul desktop e nel menu Start).
- `Regia-Tempi-Portable.exe` si avvia senza installare, per esempio da una chiavetta USB.

Il programma non è firmato, quindi Windows può mostrare "PC protetto": clic su "Ulteriori informazioni" e poi "Esegui comunque".

### Come si aggiorna

Il workflow "App per PC" (`.github/workflows/app-pc.yml`) ricostruisce il programma a ogni modifica dei file dell'app su `main` e aggiorna la Release `pc-v<versione>`. Per una versione nuova con un nome nuovo, alza `version` in `desktop/package.json`. Si può anche avviare a mano da Actions → "App per PC" → Run workflow.

Per provarlo in locale: `cd desktop && npm install && npm start`. Per costruire l'installer: `npm run dist` (i file finiscono in `desktop/dist`).
