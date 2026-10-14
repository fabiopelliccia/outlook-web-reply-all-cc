# Rispondi a tutti + CC — estensione per Outlook sul web

Estensione per **Chrome** e **Edge** (Manifest V3, JavaScript puro) che aggiunge a Outlook sul web
(`outlook.office.com`, `outlook.office365.com`, `outlook.live.com`, `outlook.cloud.microsoft`) il pulsante
**Rispondi a tutti + CC**:

- fa quello che fa "Rispondi a tutti";
- mette in **CC** gli indirizzi configurati dal popup dell'estensione;
- non aggiunge un indirizzo già presente in A, CC o CCN della bozza;
- si installa **senza permessi di amministratore** (modalità sviluppatore del browser).

> Per **Outlook classico per Windows** esiste il componente aggiuntivo equivalente:
> [outlook-reply-all-cc](https://github.com/fabiopelliccia/outlook-reply-all-cc).

## Installazione

1. Scarica il repository (o `dist\outlook-web-reply-all-cc.zip` dopo `build.ps1`) in una cartella che non cancellerai.
2. `chrome://extensions` (Edge: `edge://extensions`) → attiva **Modalità sviluppatore**.
3. **Carica estensione non pacchettizzata** e scegli la cartella **`extension`** (quella con `manifest.json`).
4. Ricarica Outlook sul web (F5).

Guida completa per l'utente finale, con la risoluzione dei problemi: [extension/README.md](extension/README.md).

## Come funziona

Outlook sul web non offre un'API per rispondere e aggiungere destinatari, quindi il content script
(`extension/content.js`) **pilota la pagina**: clicca il "Rispondi a tutti" nativo, attende la bozza, apre
il campo Cc se è nascosto e vi scrive gli indirizzi (`;` per trasformarli in destinatari), dopo aver
saltato quelli già presenti. Se la bozza si apre in una finestra separata, il lavoro in sospeso
(`chrome.storage.local`) viene completato dalla nuova finestra. Se non trova il campo Cc, copia gli
indirizzi negli appunti e lo segnala.

| File | Ruolo |
|---|---|
| `extension/manifest.json` | Manifest V3: permesso `storage`, content script sui soli domini di Outlook sul web |
| `extension/content.js` | Logica: pulsante in pagina, pulsante flottante di riserva, compilazione del Cc, diagnostica |
| `extension/popup.html/js` | Configurazione degli indirizzi, esecuzione manuale, diagnostica |
| `extension/background.js` | Scorciatoia da tastiera Alt+Shift+C |
| `test/mock-owa.html` | Pagina finta che imita Outlook web, per collaudare `content.js` senza una casella reale |
| `tools/make-icons.ps1` | Genera le icone PNG |

Gli indirizzi sono salvati solo nel browser (`chrome.storage.local`) e non vengono inviati a nessuno.

## Se Outlook cambia la pagina

I selettori si basano sulle etichette accessibili (`aria-label`) in italiano e inglese
(`LABEL_RE`, `REPLY_ALL_RE`, `SHOW_CC_RE` in `content.js`). Il popup ha una **Diagnostica** che elenca
pulsanti e campi visibili (con gli indirizzi oscurati) per capire cosa è cambiato.

## Collaudo della logica

Servire la cartella radice con un server statico qualsiasi e aprire `test/mock-owa.html`
(il pannello "file://" di alcuni strumenti non esegue gli script). Dalla console:

```js
await chrome.storage.local.set({ ccAddresses: ['marta@x.com', 'nuovo@x.com'] });
document.querySelector('[data-racc="1"]').click();   // poi ispezionare i campi della bozza
```

`?nativo=0` rimuove il "Rispondi a tutti" dalla barra per provare il pulsante flottante
(l'URL deve contenere `/mail` perché compaia: `history.pushState({}, '', '/mail/inbox?nativo=0')`).

## Limiti

- Solo Outlook sul web; dipende dalla struttura della pagina di Microsoft.
- Non collaudata su una casella reale con tutte le varianti dell'interfaccia di Outlook sul web.
- Se una policy aziendale blocca le estensioni locali, serve pubblicarla sullo store o distribuirla via criteri di gruppo.
