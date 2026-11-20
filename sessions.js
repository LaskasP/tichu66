const key = 'tichu-sessions-v1', legacyKey = 'tichu-five-v1';
let library = { version: 1, activeId: '', sessions: [] }, startupError = '';
try {
  const stored = localStorage.getItem(key);
  if (stored) {
    const saved = JSON.parse(stored);
    if (saved.version !== 1 || !Array.isArray(saved.sessions) || !saved.sessions.length || !saved.sessions.every(Tichu.valid) || new Set(saved.sessions.map(s => s.id)).size !== saved.sessions.length || !saved.sessions.some(s => s.id === saved.activeId)) throw Error();
    library = saved;
  } else {
    const old = localStorage.getItem(legacyKey);
    if (old) library.sessions.push(Tichu.migrate(JSON.parse(old), 'My existing game'));
  }
} catch { startupError = 'Saved data could not be loaded. It has been left untouched. Import your JSON backup to continue.'; }
let freshSession = !library.sessions.length && !startupError;
if (!library.sessions.length) library.sessions.push(Tichu.create());
if (!library.activeId) library.activeId = library.sessions[0].id;
let state = library.sessions.find(s => s.id === library.activeId);
let storageBlocked = Boolean(startupError);
let editingSetup = false;

function persist() {
  state.draft = draft();
  // A fresh visit is not a saved game until setup or import succeeds.
  if (freshSession) return;
  if (storageBlocked) { $('error').textContent = 'Original browser data is preserved. Export JSON before closing; local saving is unavailable until the saved data is recovered.'; return; }
  try { localStorage.setItem(key, JSON.stringify(library)); }
  catch { $('error').textContent = 'Browser storage is unavailable. Export JSON before closing.'; }
}

function openPlayers() { $('playerInputs').innerHTML = state.players.map((n, i) => `<label for="name${i}">Player ${i + 1}</label><input id="name${i}" required maxlength="40" value="${esc(n)}">`).join(''); $('playersDialog').showModal(); }
$('playersForm').onsubmit = e => {
  e.preventDefault(); const names = state.players.map((_, i) => $('name' + i).value.trim());
  if (names.some(n => !n) || new Set(names.map(n => n.toLowerCase())).size !== names.length) { alert('Enter a different name for every player.'); return; }
  state.players = names; persist(); render(); $('playersDialog').close();
};

function activate(s) {
  Tichu.pauseTimer(state);
  if (freshSession) { library.sessions = [s]; freshSession = false; }
  state.draft = draft(); state = s; library.activeId = s.id; restoreDraft();
  $('error').textContent = ''; $('feedback').hidden = true; persist(); render(); showView('game');
}
function switchSession(id) { const s = library.sessions.find(s => s.id === id); if (s && s !== state) activate(s); }
function renameSession() { const value = prompt('Game name', state.name); if (value === null) return; const name = value.trim(); if (!name || name.length > 80) { alert('Enter a game name of 1–80 characters.'); return; } state.name = name; persist(); render(); }
function openGameSessions() {
  $('pageMenu').hidePopover();
  $('gamesDialog').showModal();
}
for (const id of ['gamesDialog', 'sessionDialog']) {
  $(id).addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.querySelector('.menu-button').focus();
  });
}
function openSessionSetup(edit = false) {
  if (edit && (state.hands.length || state.games.length || state.legacy.length)) return;
  $('gamesDialog').close();
  editingSetup = edit;
  $('sessionForm').reset(); $('setupPlayers').innerHTML = ''; $('setupError').textContent = '';
  $('sessionSetupTitle').textContent = edit ? 'Game setup' : 'New game';
  $('sessionForm').querySelector('[type="submit"]').textContent = edit ? 'Save setup' : 'Create game';
  if (edit) {
    $('sessionName').value = state.name; $('playerCount').value = state.players.length; $('sessionMode').value = state.mode; $('setupTarget').value = state.target;
  }
  setupChanged();
  if (edit) state.seed.forEach((id, i) => { $('setupName' + i).value = state.players[id]; });
  $('sessionDialog').showModal();
}
function setupChanged() {
  const count = Number($('playerCount').value), previous = [...$('setupPlayers').querySelectorAll('input')].map(i => i.value);
  const mode = $('sessionMode'); mode.disabled = count !== 6; if (count !== 6) mode.value = count === 4 ? 'fixed' : 'rotating';
  const fixed = mode.value === 'fixed';
  $('setupHint').textContent = count === 4 ? 'Two fixed pairs. Everyone plays every match.' : count === 5 ? 'Four play, one rests. The existing rotation continues after each match.' : fixed ? 'Three fixed pairs take turns: A–B, B–C, C–A.' : 'Four play, two rest. Over 15 matches, everyone partners with everyone twice.';
  $('setupPlayers').innerHTML = Array.from({ length: count }, (_, i) => `<label for="setupName${i}">${fixed ? `Pair ${String.fromCharCode(65 + Math.floor(i / 2))} · Player ${i % 2 + 1}` : `Player ${i + 1}`}</label><input id="setupName${i}" required maxlength="40" value="${esc(previous[i] ?? `Player ${i + 1}`)}">`).join('');
  syncDropdowns();
}
$('sessionForm').onsubmit = e => {
  e.preventDefault(); const name = $('sessionName').value.trim(), players = [...$('setupPlayers').querySelectorAll('input')].map(i => i.value.trim());
  if (!name || players.some(n => !n) || new Set(players.map(n => n.toLowerCase())).size !== players.length) {
    $('setupError').textContent = 'Enter a game name and a different name for every player.';
    $('setupError').focus(); return;
  }
  const s = Tichu.create({ name, players, mode: $('sessionMode').value, target: Number($('setupTarget').value) });
  if (editingSetup) {
    freshSession = false;
    s.id = state.id; s.draft = draft(); if (state.timer) s.timer = { ...state.timer }; library.sessions[library.sessions.indexOf(state)] = s; state = s; restoreDraft(); persist(); render();
  } else { library.sessions.push(s); activate(s); }
  $('sessionDialog').close(); announce(`${s.name} ${editingSetup ? 'updated' : 'created'}. Ready for the first hand.`);
};

function exportData() {
  state.draft = draft();
  const backup = Tichu.clone(state); Tichu.pauseTimer(backup);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = (state.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || 'tichu-game') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importData(e) {
  try {
    const file = e.target.files[0]; if (!file) return;
    const raw = JSON.parse(await file.text()); let name = 'Imported game';
    if (raw.version !== 3) { name = prompt('Name for this imported game', file.name.replace(/\.json$/i, '').slice(0, 80))?.trim(); if (!name) return; }
    const s = Tichu.migrate(raw, name), index = library.sessions.findIndex(item => item.id === s.id);
    if (index >= 0) {
      const action = prompt('A game with this ID already exists. Type “update” to replace it, or “copy” to keep both.', 'copy');
      if (action === null) return;
      if (action.trim().toLowerCase() === 'update') {
        Tichu.pauseTimer(state);
        state.draft = draft(); library.sessions[index] = s;
        // Activate without copying the outgoing draft over imported data.
        library.activeId = s.id; state = s; restoreDraft(); persist(); render(); showView('game');
      } else if (action.trim().toLowerCase() === 'copy') { s.id = Tichu.id(); s.name = `${s.name.slice(0, 73)} (copy)`; library.sessions.push(s); activate(s); }
      else { alert('Import cancelled. Enter update or copy next time.'); return; }
    } else { library.sessions.push(s); activate(s); }
    $('sessionDialog').close(); $('gamesDialog').close();
    announce(`${s.name} imported. Your saved match is ready to continue.`);
  } catch { alert('This JSON is not a supported Tichu game. Your current games were kept.'); }
  finally { e.target.value = ''; }
}
