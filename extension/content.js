// Rispondi a tutti + CC per Outlook sul web.
// Clicca il "Rispondi a tutti" nativo, attende la bozza e aggiunge in CC gli indirizzi configurati
// (saltando quelli gia' presenti in A, CC o CCN). Dipende dalla struttura della pagina di Outlook:
// le funzioni "diagnose" e i selettori basati su aria-label servono a correggerla se Microsoft la cambia.
(() => {
  'use strict';
  if (window.__raccLoaded) return;
  window.__raccLoaded = true;

  const TITLE = 'Rispondi a tutti + CC';
  const PENDING_KEY = 'pendingCc';
  const PENDING_TTL = 30000; // ms: tempo massimo per completare la bozza (anche in una finestra separata)
  const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const REPLY_ALL_RE = /^(rispondi a tutti|reply all)\b/i;
  const LABEL_RE = { to: /^(a|to)\s*:?$/i, cc: /^cc\s*:?$/i, bcc: /^(ccn|bcc)\s*:?$/i };
  const SHOW_CC_RE = /^(cc|mostra cc|show cc|aggiungi cc|add cc)$/i;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const alive = () => !!(globalThis.chrome && chrome.runtime && chrome.runtime.id);

  // ---- Archiviazione -------------------------------------------------------------------------
  const store = chrome.storage.local;
  const getAddresses = async () => (await store.get({ ccAddresses: [] })).ccAddresses;
  const getPending = async () => {
    const p = (await store.get(PENDING_KEY))[PENDING_KEY];
    return p && Date.now() - p.ts < PENDING_TTL ? p : null;
  };
  const setPending = (addresses) => store.set({ [PENDING_KEY]: { ts: Date.now(), addresses } });
  const clearPending = () => store.remove(PENDING_KEY);

  // ---- Utilita' DOM --------------------------------------------------------------------------
  const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  /** Etichetta di un controllo (pulsante): aria-label, titolo o testo. */
  function labelOf(el) {
    let l = el.getAttribute('aria-label');
    if (!l) {
      const ids = el.getAttribute('aria-labelledby');
      if (ids) l = ids.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ');
    }
    return (l || el.getAttribute('title') || el.textContent || '').trim();
  }

  /** Etichetta di un campo di testo: mai il testo contenuto, che e' quello digitato dall'utente. */
  function fieldLabel(el) {
    let l = el.getAttribute('aria-label');
    if (!l) {
      const ids = el.getAttribute('aria-labelledby');
      if (ids) l = ids.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ');
    }
    return (l || el.getAttribute('placeholder') || '').trim();
  }

  async function waitFor(fn, timeout, step = 150) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(step);
    }
  }

  function toast(message, kind = 'info') {
    const old = document.getElementById('racc-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'racc-toast';
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', right: '16px', bottom: '64px', zIndex: '2147483647', maxWidth: '380px',
      padding: '10px 14px', borderRadius: '6px', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.35)',
      font: '13px/1.4 "Segoe UI", sans-serif',
      background: kind === 'warn' ? '#a4262c' : kind === 'ok' ? '#107c10' : '#323130'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  // ---- Pulsante nativo "Rispondi a tutti" -----------------------------------------------------
  function nativeReplyAllButtons() {
    return Array.from(document.querySelectorAll('button,[role="button"],[role="menuitem"]')).filter((el) =>
      !el.dataset.racc && isVisible(el) && el.getAttribute('aria-disabled') !== 'true' && !el.disabled &&
      REPLY_ALL_RE.test(labelOf(el)));
  }
  const findNativeReplyAll = () => nativeReplyAllButtons()[0] || null;

  // ---- Campi destinatari della bozza ----------------------------------------------------------
  const EDITABLE = 'input,[contenteditable="true"],[contenteditable=""]';

  /** Il vero elemento editabile: l'elemento stesso o, se e' un wrapper (role=combobox/textbox), il suo figlio. */
  function editableOf(el) {
    if (el.matches(EDITABLE)) return el;
    return el.querySelector(EDITABLE);
  }

  function recipientFields() {
    const out = { to: [], cc: [], bcc: [] };
    const seen = new Set();
    for (const el of document.querySelectorAll('[role="textbox"],[role="combobox"],' + EDITABLE)) {
      const label = fieldLabel(el);
      if (!label) continue;
      const kind = Object.keys(LABEL_RE).find((k) => LABEL_RE[k].test(label));
      if (!kind) continue;
      const field = editableOf(el);
      if (!field || seen.has(field) || !isVisible(field)) continue;
      seen.add(field);
      out[kind].push(field);
    }
    return out;
  }

  /** Il contenitore di un solo campo destinatari (campo + chip dei destinatari gia' inseriti). */
  function wellOf(field, all) {
    const others = all.filter((f) => f !== field);
    const maxUp = others.length ? 5 : 3;
    let well = field.parentElement;
    for (let i = 0; i < maxUp && well && well.parentElement; i++) {
      const up = well.parentElement;
      if (others.some((o) => up.contains(o))) break;
      well = up;
    }
    return well;
  }

  function emailsIn(root) {
    const found = new Set();
    const add = (s) => { for (const m of (s || '').matchAll(EMAIL_RE)) found.add(m[0].toLowerCase()); };
    add(root.textContent);
    for (const el of root.querySelectorAll('[aria-label],[title],[data-email],[data-address]')) {
      add(el.getAttribute('aria-label'));
      add(el.getAttribute('title'));
      add(el.getAttribute('data-email'));
      add(el.getAttribute('data-address'));
    }
    return found;
  }

  /** Indirizzi gia' presenti in A, CC e CCN della bozza. */
  function existingRecipients(fields) {
    const all = [...fields.to, ...fields.cc, ...fields.bcc];
    const present = new Set();
    for (const f of all) for (const e of emailsIn(wellOf(f, all))) present.add(e);
    return present;
  }

  function nearestButton(from, re) {
    let anc = from;
    for (let i = 0; i < 8 && anc; i++, anc = anc.parentElement) {
      for (const b of anc.querySelectorAll('button,[role="button"],a,[role="link"],span[tabindex]')) {
        if (isVisible(b) && re.test(labelOf(b))) return b;
      }
    }
    return null;
  }

  // ---- Inserimento di un destinatario ---------------------------------------------------------
  const fieldText = (f) => String('value' in f ? f.value : f.textContent).replace(/[​\s]/g, '');

  function focusEnd(field) {
    field.focus();
    if (field.isContentEditable) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(field);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function insertText(field, text) {
    focusEnd(field);
    if (document.execCommand('insertText', false, text)) return;
    if ('value' in field) { // fallback per input che non accettano execCommand
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
      setter.call(field, field.value + text);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function pressEnter(field) {
    const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    field.dispatchEvent(new KeyboardEvent('keydown', init));
    field.dispatchEvent(new KeyboardEvent('keypress', init));
    field.dispatchEvent(new KeyboardEvent('keyup', init));
  }

  /** Scrive l'indirizzo nel campo e lo converte in destinatario (";" poi, se serve, Invio). */
  async function addRecipient(field, address) {
    insertText(field, address);
    await sleep(450);                       // lascia a Outlook il tempo di cercare i suggerimenti
    insertText(field, ';');
    await sleep(350);
    if (fieldText(field)) { pressEnter(field); await sleep(350); }
    return !fieldText(field);               // campo svuotato = destinatario creato
  }

  // ---- Compilazione della bozza ---------------------------------------------------------------
  /**
   * Attende la nuova bozza e compila il campo CC. Ritorna 'done' | 'handled' (completata da un'altra
   * finestra) | 'timeout' | 'nocc'.
   */
  async function fillCc(before, timeout) {
    const fields = await waitFor(() => {
      const f = recipientFields();
      return f.to.some((e) => !before.has(e)) ? f : null;
    }, timeout);
    if (!fields) return 'timeout';

    const pending = await getPending();           // "prenota" il lavoro: una sola finestra lo esegue
    if (!pending) return 'handled';
    await clearPending();
    const addresses = pending.addresses;
    await sleep(800);                              // la bozza popola i destinatari in modo asincrono

    let cur = recipientFields();
    const to = cur.to.find((e) => !before.has(e));
    let cc = cur.cc.find((e) => !before.has(e));
    if (!cc && to) {
      const toggle = nearestButton(to, SHOW_CC_RE);
      if (toggle) toggle.click();
      cc = await waitFor(() => recipientFields().cc.find((e) => !before.has(e)), 3000);
    }
    if (!cc) {
      await copyAddresses(addresses);
      toast('Non trovo il campo Cc. Ho copiato gli indirizzi negli appunti: incollali in Cc.', 'warn');
      return 'nocc';
    }

    cur = recipientFields();
    const present = existingRecipients(cur);
    const added = [], skipped = [], failed = [];
    for (const address of addresses) {
      if (present.has(address.toLowerCase())) { skipped.push(address); continue; }
      (await addRecipient(cc, address) ? added : failed).push(address);
      present.add(address.toLowerCase());
    }
    const parts = [];
    if (added.length) parts.push('Aggiunti in CC: ' + added.join('; '));
    if (skipped.length) parts.push('Gia\' presenti: ' + skipped.join('; '));
    if (failed.length) parts.push('Da verificare: ' + failed.join('; '));
    toast(parts.join(' - ') || 'Nessun indirizzo da aggiungere.', failed.length ? 'warn' : 'ok');
    return 'done';
  }

  async function copyAddresses(addresses) {
    try { await navigator.clipboard.writeText(addresses.join('; ')); } catch (e) { /* pagina senza focus */ }
  }

  let running = false;
  async function run() {
    if (running) return;
    running = true;
    try {
      const addresses = await getAddresses();
      if (!addresses.length) {
        toast('Nessun indirizzo CC configurato: clicca l\'icona dell\'estensione nella barra del browser per impostarli.', 'warn');
        return;
      }
      const native = findNativeReplyAll();
      if (!native) {
        toast('Seleziona (o apri) un messaggio: il pulsante "Rispondi a tutti" non e\' disponibile.', 'warn');
        return;
      }
      const f = recipientFields();
      const before = new Set([...f.to, ...f.cc, ...f.bcc]);
      await setPending(addresses);
      native.click();
      const result = await fillCc(before, 12000);
      if (result === 'timeout' && await getPending()) {
        await clearPending();
        await copyAddresses(addresses);
        toast('Non trovo la bozza di risposta. Ho copiato gli indirizzi negli appunti: incollali in Cc.', 'warn');
      }
    } catch (e) {
      console.error('[Rispondi a tutti + CC]', e);
      toast('Errore: ' + (e && e.message ? e.message : e), 'warn');
    } finally {
      running = false;
    }
  }

  // ---- Pulsante nella pagina (accanto a "Rispondi a tutti") -----------------------------------
  function injectButtons() {
    for (const native of nativeReplyAllButtons()) {
      const next = native.nextElementSibling;
      if (next && next.dataset && next.dataset.racc) continue;
      const clone = native.cloneNode(true);
      clone.dataset.racc = '1';
      clone.removeAttribute('id');
      clone.setAttribute('aria-label', TITLE);
      clone.setAttribute('title', TITLE);
      let relabelled = false;
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (REPLY_ALL_RE.test(n.nodeValue.trim())) { n.nodeValue = TITLE; relabelled = true; }
      }
      if (!relabelled) { // pulsante a sola icona: si aggiunge un piccolo "CC"
        const badge = document.createElement('span');
        badge.textContent = 'CC';
        Object.assign(badge.style, { fontSize: '10px', fontWeight: '700', marginLeft: '2px', lineHeight: '1' });
        clone.appendChild(badge);
      }
      clone.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); run(); }, true);
      native.insertAdjacentElement('afterend', clone);
    }
    // Se Outlook non mostra "Rispondi a tutti" come pulsante a se' (es. barra semplificata), si usa un
    // pulsante flottante, cosi' c'e' sempre un modo visibile per lanciare l'azione.
    ensureFloatingButton(location.pathname.includes('/mail') && !document.querySelector('[data-racc="1"]'));
  }

  function ensureFloatingButton(show) {
    const existing = document.getElementById('racc-float');
    if (!show) { if (existing) existing.remove(); return; }
    if (existing) return;
    const f = document.createElement('button');
    f.id = 'racc-float';
    f.type = 'button';
    f.dataset.racc = 'float';
    f.textContent = TITLE;
    f.title = 'Rispondi a tutti e aggiungi in CC gli indirizzi configurati (Alt+Shift+C)';
    Object.assign(f.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483646', padding: '8px 14px',
      border: '0', borderRadius: '18px', cursor: 'pointer', color: '#fff', background: '#0f6cbd',
      boxShadow: '0 2px 8px rgba(0,0,0,.35)', font: '600 13px "Segoe UI", sans-serif'
    });
    f.addEventListener('click', (e) => { e.preventDefault(); run(); });
    document.body.appendChild(f);
  }

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; if (alive()) injectButtons(); }, 400);
  }).observe(document.documentElement, { childList: true, subtree: true });
  injectButtons();

  // ---- Diagnostica (per correggere i selettori se Outlook cambia) -----------------------------
  const mask = (s) => s.replace(/[^\s@"'<>,;]+@/g, '***@'); // la diagnostica non contiene mai indirizzi reali

  function describe(el) {
    const p = el.parentElement;
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      ' role=' + (el.getAttribute('role') || '-') +
      ' aria-label="' + (el.getAttribute('aria-label') || '') + '"' +
      ' title="' + (el.getAttribute('title') || '') + '"' +
      ' class="' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 60) + '"' +
      (p ? ' <- ' + p.tagName.toLowerCase() + ' role=' + (p.getAttribute('role') || '-') : '');
  }

  function diagnose() {
    const lines = [];
    lines.push('Estensione ' + chrome.runtime.getManifest().version + ' - ' + location.origin + ' - lang=' + document.documentElement.lang);
    lines.push('Pulsante Rispondi a tutti trovato: ' + !!findNativeReplyAll());
    const f = recipientFields();
    lines.push('Campi bozza: A=' + f.to.length + ' Cc=' + f.cc.length + ' Ccn=' + f.bcc.length);
    for (const kind of ['to', 'cc', 'bcc']) {
      for (const field of f[kind]) {
        const all = [...f.to, ...f.cc, ...f.bcc];
        lines.push('  ' + kind + ': ' + describe(field) + ' | indirizzi nel contenitore: ' + emailsIn(wellOf(field, all)).size);
      }
    }
    const interesting = /rispond|reply|inoltra|forward|^\s*cc\s*$|ccn|bcc|^\s*a\s*$|^\s*to\s*$/i;
    lines.push('--- Pulsanti rilevanti (visibili)');
    for (const el of document.querySelectorAll('button,[role="button"],[role="menuitem"],a')) {
      if (!isVisible(el)) continue;
      const l = labelOf(el);
      if (l.length > 60 || !interesting.test(l)) continue;
      lines.push(describe(el));
    }
    lines.push('--- Campi di testo con etichetta (visibili)');
    for (const el of document.querySelectorAll('[role="textbox"],[role="combobox"],' + EDITABLE)) {
      if (!isVisible(el) || !fieldLabel(el)) continue;
      lines.push(describe(el));
    }
    return mask(lines.join('\n'));
  }

  // ---- Messaggi da popup / scorciatoia --------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'run') { run(); sendResponse({ ok: true }); }
    else if (msg && msg.type === 'diagnose') { sendResponse({ report: diagnose() }); }
  });

  // Bozza aperta in una finestra separata: se c'e' un lavoro in sospeso lo completa questa finestra.
  (async () => {
    if (await getPending()) fillCc(new Set(), 15000);
  })();
})();
