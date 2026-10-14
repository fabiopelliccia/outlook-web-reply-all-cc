# Rispondi a tutti + CC — estensione per Outlook sul web

Estensione per **Chrome** e **Edge** che aggiunge a Outlook sul web
(`outlook.office.com`, `outlook.office365.com`, `outlook.live.com`) il pulsante **Rispondi a tutti + CC**:
fa come "Rispondi a tutti" e mette in **CC** gli indirizzi che hai configurato
(se un indirizzo è già in A, CC o CCN della bozza, non viene aggiunto di nuovo).

Non servono i permessi di amministratore.

---

## 1. Installazione (Chrome o Edge)

1. **Estrai lo zip** in una cartella che **non cancellerai**, ad esempio `C:\Users\<tuo utente>\ReplyAllCcChrome`.
   Il browser usa i file direttamente da lì: se la cartella viene spostata o cancellata, l'estensione sparisce.
2. Apri la pagina delle estensioni:
   - Chrome: scrivi `chrome://extensions` nella barra degli indirizzi
   - Edge: scrivi `edge://extensions`
3. Attiva **Modalità sviluppatore** (interruttore in alto a destra in Chrome, a sinistra in Edge).
4. Clicca **Carica estensione non pacchettizzata** (Edge: **Carica decompressa**) e scegli la cartella estratta
   (quella che contiene `manifest.json`).
5. L'estensione compare nell'elenco. Clicca l'icona a forma di puzzle nella barra del browser e
   **fissa** (puntina) "Rispondi a tutti + CC" per averla sempre visibile.
6. **Ricarica la pagina di Outlook** (F5) se era già aperta.

> Chrome può mostrare all'avvio un avviso sulle "estensioni in modalità sviluppatore": basta
> chiuderlo, non va disattivata l'estensione.

## 2. Uso

1. Clicca l'icona **CC** dell'estensione, scrivi gli indirizzi (uno per riga o separati da `;`) e premi **Salva**.
2. In Outlook sul web **seleziona o apri un messaggio**. Accanto al pulsante "Rispondi a tutti" compare
   un secondo pulsante con una piccola scritta **CC**: cliccalo.
3. Si apre la bozza di risposta con gli indirizzi in CC. Una notifica in basso a destra riepiloga
   cosa è stato aggiunto. L'invio resta manuale.

In alternativa: icona dell'estensione → **Rispondi a tutti + CC**, oppure la scorciatoia **Alt+Shift+C**
(modificabile da `chrome://extensions/shortcuts`).

## 3. Se non funziona

- **Il pulsante CC non compare accanto a "Rispondi a tutti":** ricarica la pagina (F5), poi seleziona un
  messaggio. Puoi usare comunque l'icona dell'estensione o Alt+Shift+C.
- **"Non trovo il campo Cc" / "Non trovo la bozza":** gli indirizzi vengono copiati negli appunti, incollali
  tu in Cc. Poi usa la **Diagnostica**: apri un messaggio, icona dell'estensione → *Diagnostica* →
  *Crea diagnostica* → *Copia*, e invia il testo a chi gestisce l'estensione. Gli indirizzi nel testo sono
  oscurati. Succede se Microsoft cambia la struttura della pagina: la correzione è piccola.
- **L'estensione non si carica o "Modalità sviluppatore" è bloccata:** una policy aziendale impedisce le
  estensioni locali. Serve che l'IT la distribuisca (vedi sotto).
- **Dopo un aggiornamento** della cartella: in `chrome://extensions` clicca l'icona di ricarica
  sull'estensione e ricarica Outlook.

## 4. Aggiornamento e rimozione

- Aggiornamento: sostituisci i file nella cartella, poi ricarica l'estensione da `chrome://extensions`.
- Rimozione: `chrome://extensions` → **Rimuovi**. Gli indirizzi configurati vengono cancellati con lei.

---

## Limiti

- Funziona solo in **Outlook sul web** (non nel client Outlook per Windows: per quello c'è il componente aggiuntivo).
- L'estensione **comanda la pagina** (clicca "Rispondi a tutti" e scrive nel campo Cc) perché
  Outlook sul web non offre un'API per farlo: un aggiornamento grafico di Outlook può richiedere un
  adeguamento.
- I nomi dei campi sono riconosciuti in **italiano e inglese**.
- Gli indirizzi sono salvati **solo in questo browser** (non sono sincronizzati tra computer o profili).
- L'estensione non invia dati a nessuno: legge/modifica solo la pagina di Outlook e conserva localmente
  l'elenco degli indirizzi CC.

## Per chi distribuisce

- Per evitare la modalità sviluppatore l'IT può pubblicare l'estensione sul **Chrome Web Store / Edge Add-ons**
  (anche come "non in elenco") oppure installarla con criteri di gruppo (`ExtensionInstallForcelist`).
- Permessi richiesti: `storage` e accesso ai soli domini di Outlook sul web.
