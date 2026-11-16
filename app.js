const key = 'tichu-sessions-v1', legacyKey = 'tichu-five-v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const { totals, won } = Tichu;
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
if (!library.sessions.length) library.sessions.push(Tichu.create());
if (!library.activeId) library.activeId = library.sessions[0].id;
let state = library.sessions.find(s => s.id === library.activeId);
let scoring = { mode: 'normal', bonusA: 0, bonusB: 0 };
let scoreValidationTimer;
const scoreError = 'Enter both scores in multiples of 5.';
let storageBlocked = Boolean(startupError);
let editingSetup = false;
function persist() {
  state.draft = draft();
  if (storageBlocked) { $('error').textContent = 'Original browser data is preserved. Export JSON before closing; local saving is unavailable until the saved data is recovered.'; return; }
  try { localStorage.setItem(key, JSON.stringify(library)); }
  catch { $('error').textContent = 'Browser storage is unavailable. Export JSON before closing.'; }
}
const pairName = pair => pair.map(i => state.players[i]).join(' + ');
const matchup = order => `${pairName(order.slice(0, 2))} vs ${pairName(order.slice(2, 4))}`;
const modeLabel = s => `${s.players.length} players · ${s.mode === 'fixed' ? 'Fixed pairs' : 'Rotating partners'}`;
function render() {
  const locked = state.hands.length > 0, fixed = state.mode === 'fixed';
  $('sessionSelect').innerHTML = library.sessions.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  $('sessionSelect').value = state.id;
  $('editSetup').disabled = Boolean(state.hands.length || state.games.length || state.legacy.length);
  $('brandDetail').textContent = ` / ${state.players.length}`;
  document.title = `${state.name} · tichu66`;
  for (let i = 0; i < 4; i++) {
    $('p' + i).innerHTML = state.players.map((n, j) => `<option value="${j}">${esc(n)}</option>`).join('');
    $('p' + i).value = state.order[i];
    $('p' + i).disabled = state.players.length === 4 && (locked || state.games.length > 0);
  }
  $('target').value = state.target; $('target').disabled = locked;
  const [a, b] = totals(state.hands);
  for (const [team, points] of [['A', a], ['B', b]]) {
    $('total' + team).textContent = points;
    $('progress' + team).max = state.target;
    $('progress' + team).value = Math.max(0, Math.min(state.target, points));
  }
  $('undoButton').disabled = !state.hands.length && !state.games.length;
  $('bench').innerHTML = state.players.length === 4 ? 'Everyone plays · Fixed pairs' : state.order.slice(4).map((player, i) => `<label class="bench-pick" for="rest${i}">Sitting out${state.players.length === 6 ? ` ${i + 1}` : ''}<select id="rest${i}" onchange="lineupChanged(${i + 4})">${state.players.map((name, id) => `<option value="${id}"${id === player ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`).join('');
  $('nextLineup').textContent = state.players.length === 4 ? '' : `Next match: ${matchup(Tichu.next(state))}`;
  $('roundTitle').textContent = `Match ${state.games.length + 1} · Hand ${state.hands.length + 1}`;
  $('gameStatus').textContent = `First to ${state.target} points with a lead. ${modeLabel(state)}.`;
  $('rounds').textContent = state.games.length;
  $('playersTitle').textContent = fixed ? 'Team standings' : 'Personal standings';
  $('playersEyebrow').textContent = 'YOUR TABLE';
  $('standingsIntro').textContent = fixed ? 'Your pairs. Your shared wins.' : 'Different teams. Your own wins.';
  $('standingsLabel').textContent = fixed ? 'Pair' : 'Player';
  $('standingsHelp').textContent = fixed ? 'Only completed matches count. The pairs finishing the match receive its points and result.' : 'Only completed matches count. The players finishing the match receive their team’s full points and win or loss. Players sitting out at the finish receive no result.';
  $('rulesRotation').textContent = 'Scores stay with Team A and Team B until one reaches the target with a lead. A tie means another hand. ' + (state.players.length === 4 ? 'The same pairs play the next match.' : 'Change who sits out anytime. The finishing lineup receives the match points and result. ' + (state.players.length === 5 ? 'Then the resting player rotates in.' : fixed ? 'Fixed pairs move together. Pairs take turns: A–B, B–C, C–A.' : 'The next lineup follows the balanced 15-match schedule.'));
  let stats = fixed ? Array.from({ length: state.players.length / 2 }, (_, id) => ({ name: pairName(state.seed.slice(id * 2, id * 2 + 2)), id, w: 0, n: 0, pts: 0 })) : state.players.map((name, id) => ({ name, id, w: 0, n: 0, pts: 0 }));
  for (const g of state.games) {
    const points = totals(g.hands);
    for (let side = 0; side < 2; side++) {
      const pair = g.lineup.slice(side * 2, side * 2 + 2);
      const recipients = fixed ? [stats[Math.floor(state.seed.indexOf(pair[0]) / 2)]] : pair.map(i => stats[i]);
      for (const s of recipients) { s.n++; s.pts += points[side]; if (points[side] > points[1 - side]) s.w++; }
    }
  }
  stats.sort((a, b) => b.w - a.w || b.pts - a.pts);
  $('leader').textContent = stats[0].w ? stats.filter(s => s.w === stats[0].w).map(s => s.name).join(', ') : '—';
  $('standings').innerHTML = stats.map(s => `<tr><td>${esc(s.name)}</td><td><strong>${s.w}</strong></td><td>${s.n}</td><td>${s.n ? Math.round(s.w / s.n * 100) : 0}%</td><td>${s.pts}</td></tr>`).join('');
  const hands = hs => hs.map((h, i) => `<p><small>Hand ${i + 1}: ${h.a} : ${h.b}${h.note ? ' · ' + esc(h.note) : ''}</small></p>`).join('');
  $('history').innerHTML = (state.hands.length ? `<article><strong>Current match · ${a} : ${b}</strong><p>${esc(matchup(state.order))}</p>${hands(state.hands)}</article>` : '') + state.games.map((g, i) => {
    const [a, b] = totals(g.hands);
    return `<article><div class="row"><small>MATCH ${i + 1} · TARGET ${g.target}</small><strong>${a} : ${b} · Team ${a > b ? 'A' : 'B'} wins</strong></div><p>${esc(matchup(g.lineup))}</p>${g.lineup.length > 4 ? `<small>Resting: ${esc(g.lineup.slice(4).map(i => state.players[i]).join(' & '))}</small>` : ''}${hands(g.hands)}</article>`;
  }).reverse().join('') + (!state.games.length && !state.hands.length ? '<div class="empty">Record your first hand.<br>Wins count when a full match is completed.</div>' : '') + (state.legacy.length ? `<details><summary>${state.legacy.length} earlier hand records (excluded from match wins)</summary><p class="helper">Earlier records used a different lineup each hand. They remain in your JSON exports.</p>${state.legacy.map((r, i) => `<p>Earlier hand ${i + 1}: ${esc(r.a)} : ${esc(r.b)} · ${esc(r.note || '')}</p>`).join('')}</details>` : '');
}
function changeTarget() { if (state.hands.length) return; state.target = Number($('target').value); persist(); render(); }
function lineupChanged(index) {
  const input = $(index < 4 ? 'p' + index : 'rest' + (index - 4));
  if (!Tichu.changeSeat(state, index, Number(input.value))) { render(); return; }
  if (state.players.length < 6 && !state.hands.length && !state.games.length) state.seed = [...state.order];
  persist(); render();
}
function invalidScore(input) { return input.value === '' || !Number.isFinite(Number(input.value)) || Number(input.value) % 5 !== 0; }
function validateScores() {
  clearTimeout(scoreValidationTimer);
  let valid = true;
  for (const id of ['scoreA', 'scoreB']) {
    const invalid = invalidScore($(id));
    if (invalid) $(id).setAttribute('aria-invalid', 'true');
    else $(id).removeAttribute('aria-invalid');
    if (invalid) valid = false;
  }
  if (!valid) $('error').textContent = scoreError;
  else if ($('error').textContent === scoreError) $('error').textContent = '';
  return valid;
}
function scheduleScoreValidation() {
  clearTimeout(scoreValidationTimer);
  if (['scoreA', 'scoreB'].every(id => !invalidScore($(id)))) validateScores();
  else scoreValidationTimer = setTimeout(validateScores, 1000);
}
function bonusLabels() { for (const t of ['A', 'B']) $('bonus' + t).textContent = 'Tichu adjustment: ' + (scoring['bonus' + t] > 0 ? '+' : '') + scoring['bonus' + t]; }
function syncScore(team) {
  if (scoring.mode !== 'normal' || $('score' + team).value === '') return;
  const score = Number($('score' + team).value); if (!Number.isFinite(score)) return;
  const other = team === 'A' ? 'B' : 'A'; $('score' + other).value = 100 - (score - scoring['bonus' + team]) + scoring['bonus' + other];
}
function adjustScore(team, delta) { const input = $('score' + team); if (input.value === '' || !Number.isFinite(Number(input.value))) return; scoring['bonus' + team] += delta; input.value = Number(input.value) + delta; bonusLabels(); scheduleScoreValidation(); }
function changeScoreMode() {
  scoring.mode = $('scoreMode').value;
  let a = 50, b = 50; if (scoring.mode === 'doubleA') { a = 200; b = 0; } if (scoring.mode === 'doubleB') { a = 0; b = 200; }
  for (const t of ['A', 'B']) $('score' + t).readOnly = scoring.mode === 'doubleA' || scoring.mode === 'doubleB';
  if (scoring.mode !== 'manual') { $('scoreA').value = a + scoring.bonusA; $('scoreB').value = b + scoring.bonusB; }
  scheduleScoreValidation();
}
function resetScoring() { scoring = { mode: 'normal', bonusA: 0, bonusB: 0 }; $('scoreMode').value = 'normal'; changeScoreMode(); bonusLabels(); }
function saveRound() {
  const a = Number($('scoreA').value), b = Number($('scoreB').value);
  if (!validateScores()) return;
  state.hands.push({ a, b, scoring: { ...scoring }, note: $('note').value.trim(), date: new Date().toISOString() });
  const handNumber = state.hands.length, finished = Tichu.complete(state);
  $('note').value = ''; $('noteDetails').open = false; $('error').textContent = ''; resetScoring(); persist(); render();
  if (finished) {
    const g = state.games.at(-1), points = totals(g.hands), side = points[0] > points[1] ? 0 : 2;
    announce(`${pairName(g.lineup.slice(side, side + 2))} win ${Math.max(...points)}–${Math.min(...points)}. Ready for the next match.`);
  } else announce(`Hand ${handNumber} saved · ${a} : ${b}`);
}
function undo() {
  if (!state.hands.length && !state.games.length) return;
  if (!confirm('Remove the last hand? A completed match will reopen and its win will be removed.')) return;
  if (!state.hands.length) { const g = state.games.pop(); state.order = [...g.lineup]; state.target = g.target; state.hands = g.hands; }
  const h = state.hands.pop(), meta = h.scoring;
  scoring = meta && ['normal', 'manual', 'doubleA', 'doubleB'].includes(meta.mode) && Number.isFinite(meta.bonusA) && Number.isFinite(meta.bonusB) ? { ...meta } : { mode: 'manual', bonusA: 0, bonusB: 0 };
  $('scoreMode').value = scoring.mode; changeScoreMode(); bonusLabels(); $('scoreA').value = h.a; $('scoreB').value = h.b; $('note').value = h.note; $('noteDetails').open = Boolean(h.note);
  persist(); render(); announce('Last hand undone. Review the scores and save again.');
}
function openPlayers() { $('playerInputs').innerHTML = state.players.map((n, i) => `<label for="name${i}">Player ${i + 1}</label><input id="name${i}" required maxlength="40" value="${esc(n)}">`).join(''); $('playersDialog').showModal(); }
$('playersForm').onsubmit = e => {
  e.preventDefault(); const names = state.players.map((_, i) => $('name' + i).value.trim());
  if (names.some(n => !n) || new Set(names.map(n => n.toLowerCase())).size !== names.length) { alert('Enter a different name for every player.'); return; }
  state.players = names; persist(); render(); $('playersDialog').close();
};
function draft() { return { scoring: { ...scoring }, a: $('scoreA').value, b: $('scoreB').value, note: $('note').value }; }
function restoreDraft() {
  const d = state.draft; resetScoring();
  if (d && d.scoring && ['normal', 'manual', 'doubleA', 'doubleB'].includes(d.scoring.mode) && Number.isFinite(d.scoring.bonusA) && Number.isFinite(d.scoring.bonusB)) {
    scoring = { ...d.scoring }; $('scoreMode').value = scoring.mode; changeScoreMode(); bonusLabels();
    $('scoreA').value = typeof d.a === 'string' ? d.a : '50'; $('scoreB').value = typeof d.b === 'string' ? d.b : '50';
  }
  $('note').value = typeof d?.note === 'string' ? d.note : ''; $('noteDetails').open = Boolean($('note').value);
  scheduleScoreValidation();
}
function activate(s) {
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
}
$('sessionForm').onsubmit = e => {
  e.preventDefault(); const name = $('sessionName').value.trim(), players = [...$('setupPlayers').querySelectorAll('input')].map(i => i.value.trim());
  if (!name || players.some(n => !n) || new Set(players.map(n => n.toLowerCase())).size !== players.length) {
    $('setupError').textContent = 'Enter a game name and a different name for every player.';
    $('setupError').focus(); return;
  }
  const s = Tichu.create({ name, players, mode: $('sessionMode').value, target: Number($('setupTarget').value) });
  if (editingSetup) {
    s.id = state.id; s.draft = draft(); library.sessions[library.sessions.indexOf(state)] = s; state = s; restoreDraft(); persist(); render();
  } else { library.sessions.push(s); activate(s); }
  $('sessionDialog').close(); announce(`${s.name} ${editingSetup ? 'updated' : 'created'}. Ready for the first hand.`);
};
function exportData() {
  state.draft = draft();
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
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
        state.draft = draft(); library.sessions[index] = s;
        // Activate without copying the outgoing draft over imported data.
        library.activeId = s.id; state = s; restoreDraft(); persist(); render(); showView('game');
      } else if (action.trim().toLowerCase() === 'copy') { s.id = Tichu.id(); s.name = `${s.name.slice(0, 73)} (copy)`; library.sessions.push(s); activate(s); }
      else { alert('Import cancelled. Enter update or copy next time.'); return; }
    } else { library.sessions.push(s); activate(s); }
    announce(`${s.name} imported. Your saved match is ready to continue.`);
  } catch { alert('This JSON is not a supported Tichu game. Your current games were kept.'); }
  finally { e.target.value = ''; }
}
function announce(message) { $('feedback').textContent = message; $('feedback').hidden = false; }
function showView(view) {
  $('pageMenu').hidePopover?.(); if (!['game', 'players', 'history'].includes(view)) view = 'game';
  for (const name of ['game', 'players', 'history']) { $('view-' + name).hidden = name !== view; if (name === view) $('nav-' + name).setAttribute('aria-current', 'page'); else $('nav-' + name).removeAttribute('aria-current'); }
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
}
render(); restoreDraft(); if (startupError) $('error').textContent = startupError;
showView(location.hash.slice(1) || 'game');
// Keep entered, unsaved hand values with their own session as well.
for (const id of ['scoreA', 'scoreB']) $(id).addEventListener('input', scheduleScoreValidation);
for (const id of ['scoreA', 'scoreB', 'scoreMode', 'note']) {
  $(id).addEventListener('input', persist);
  $(id).addEventListener('change', persist);
}
document.querySelectorAll('.adjustments button').forEach(button => button.addEventListener('click', persist));
if (!startupError) persist();
