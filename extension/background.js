// Scorciatoia da tastiera (Alt+Shift+C): inoltra il comando alla scheda attiva di Outlook sul web.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'reply-all-cc') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'run' });
  } catch (e) {
    // la scheda attiva non e' Outlook sul web: niente da fare
  }
});
