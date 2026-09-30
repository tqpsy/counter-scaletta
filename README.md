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
