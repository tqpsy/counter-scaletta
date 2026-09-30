# Regia Tempi

Dashboard per gestire i tempi dei relatori in eventi live, con Stage Display e Countdown sincronizzati.

L'app è statica: basta pubblicare `index.html`, `app.css`, `sw.js`, `manifest.webmanifest` e `icon.svg`.
Dopo la prima apertura online, dashboard, Stage Display e Countdown funzionano anche senza connessione.

## CSS

Gli stili Tailwind sono precompilati in `app.css`. Se aggiungi o cambi classi in `index.html`, rigenera il file:

```sh
npm install
npm run build:css
```

## Schermi in rete

Con "Schermi in rete" (icona Wi-Fi nella dashboard) Stage Display e Countdown si possono aprire su altri PC, telefoni o proiettori, anche su reti diverse. Il PC di regia crea una stanza con un codice casuale e mostra un QR; gli altri schermi sono in sola lettura. Serve internet su tutti i dispositivi.

La sincronizzazione passa da un progetto Firebase gratuito (piano Spark). Configurazione, una volta sola:

1. Su [console.firebase.google.com](https://console.firebase.google.com) crea un progetto (Google Analytics non serve).
2. Build → Realtime Database → Crea database, posizione `europe-west1`, modalità bloccata.
3. Nella scheda Regole incolla il contenuto di `firebase-rules.json` e pubblica: chi ha il link di una stanza può guardarla, solo il browser che l'ha creata può modificarla.
4. Build → Authentication → Metodo di accesso → attiva "Anonimo".
5. Impostazioni progetto → Le tue app → app Web `</>`: copia `apiKey` e `databaseURL` in `FIREBASE_CONFIG` all'inizio dello script in `index.html`.

Questi due valori non sono segreti: identificano il progetto, la protezione la fanno le regole. Con `FIREBASE_CONFIG` vuoto la funzione resta disattivata.
