const ADDRESS_RE = /^[^@\s;,<>]+@[^@\s;,<>]+\.[^@\s;,<>]+$/;
const $ = (id) => document.getElementById(id);

function setStatus(text, kind = '') {
  const el = $('status');
  el.textContent = text;
  el.className = kind;
}

/** Separa indirizzi validi e non validi; elimina i duplicati (senza distinguere maiuscole/minuscole). */
function parse(text) {
  const valid = [], invalid = [], seen = new Set();
  for (const token of text.split(/[;,\s]+/).filter(Boolean)) {
    if (!ADDRESS_RE.test(token)) { invalid.push(token); continue; }
    if (!seen.has(token.toLowerCase())) { seen.add(token.toLowerCase()); valid.push(token); }
  }
  return { valid, invalid };
}

async function save() {
  const { valid, invalid } = parse($('addresses').value);
  if (invalid.length) { setStatus('Indirizzi non validi: ' + invalid.join(', '), 'err'); return false; }
  await chrome.storage.local.set({ ccAddresses: valid });
  $('addresses').value = valid.join('\n');
  setStatus(valid.length ? 'Salvato (' + valid.length + ' indirizzi).' : 'Nessun indirizzo configurato.', valid.length ? 'ok' : '');
  return true;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(message) {
  const tab = await activeTab();
  if (!tab || tab.id === undefined) throw new Error('nessuna scheda attiva');
  return chrome.tabs.sendMessage(tab.id, message);
}

const NOT_OUTLOOK = 'Apri Outlook sul web (e ricarica la pagina se l\'hai aperta prima di installare l\'estensione).';

$('save').addEventListener('click', save);

$('run').addEventListener('click', async () => {
  if (!(await save())) return;
  if (!$('addresses').value.trim()) { setStatus('Inserisci almeno un indirizzo CC.', 'err'); return; }
  try {
    await send({ type: 'run' });
    window.close();
  } catch (e) {
    setStatus(NOT_OUTLOOK, 'err');
  }
});

$('diag').addEventListener('click', async () => {
  try {
    const res = await send({ type: 'diagnose' });
    $('report').value = res.report;
  } catch (e) {
    $('report').value = NOT_OUTLOOK;
  }
});

$('copy').addEventListener('click', async () => {
  $('report').select();
  try { await navigator.clipboard.writeText($('report').value); setStatus('Diagnostica copiata.', 'ok'); }
  catch (e) { document.execCommand('copy'); }
});

(async () => {
  const { ccAddresses } = await chrome.storage.local.get({ ccAddresses: [] });
  $('addresses').value = ccAddresses.join('\n');
})();
