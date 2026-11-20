let scoring = { mode: 'normal', bonusA: 0, bonusB: 0 };
let scoreValidationTimer;
const scoreError = 'Enter both scores in multiples of 5.';

function toggleMatchTimer() {
  if (freshSession) return;
  Tichu.toggleTimer(state); persist(); renderTimer();
}
function resetMatchTimer() {
  if (freshSession) return;
  delete state.timer;
  persist(); renderTimer(); announce('Match timer reset.');
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
  if ($('score' + team).value === '') return;
  const score = Number($('score' + team).value); if (!Number.isFinite(score)) return;
  const other = team === 'A' ? 'B' : 'A'; $('score' + other).value = 100 - (score - scoring['bonus' + team]) + scoring['bonus' + other];
}
function adjustScore(team, delta) { const input = $('score' + team); if (input.value === '' || !Number.isFinite(Number(input.value))) return; scoring['bonus' + team] += delta; input.value = Number(input.value) + delta; bonusLabels(); scheduleScoreValidation(); }
function setDoubleVictory(team) {
  scoring = { mode: 'normal', bonusA: 0, bonusB: 0 };
  $('scoreA').value = team === 'A' ? '200' : '0';
  $('scoreB').value = team === 'B' ? '200' : '0';
  bonusLabels(); validateScores(); persist();
}
function resetScoring() {
  scoring = { mode: 'normal', bonusA: 0, bonusB: 0 };
  for (const t of ['A', 'B']) $('score' + t).value = '50';
  bonusLabels();
  scheduleScoreValidation();
}

function saveRound() {
  const a = Number($('scoreA').value), b = Number($('scoreB').value);
  if (!validateScores()) return;
  state.hands.push({ a, b, scoring: { ...scoring }, note: $('note').value.trim(), date: new Date().toISOString() });
  const handNumber = state.hands.length, finished = Tichu.complete(state);
  $('note').value = ''; $('noteDetails').open = false; $('error').textContent = ''; resetScoring(); persist(); render();
  if (finished) {
    const g = state.games.at(-1), points = Tichu.totals(g.hands), side = points[0] > points[1] ? 0 : 2;
    announce(`${pairName(g.lineup.slice(side, side + 2))} win ${Math.max(...points)}–${Math.min(...points)}. Ready for the next match.`);
  } else announce(`Hand ${handNumber} saved · ${a} : ${b}`);
}
function undo() {
  if (!state.hands.length && !state.games.length) return;
  if (!confirm('Remove the last hand? A completed match will reopen and its win will be removed.')) return;
  if (!state.hands.length) Tichu.reopen(state);
  const h = state.hands.pop(), meta = h.scoring;
  scoring = { mode: 'normal', bonusA: Number.isFinite(meta?.bonusA) ? meta.bonusA : 0, bonusB: Number.isFinite(meta?.bonusB) ? meta.bonusB : 0 };
  bonusLabels(); $('scoreA').value = h.a; $('scoreB').value = h.b; $('note').value = h.note; $('noteDetails').open = Boolean(h.note);
  persist(); render(); announce('Last hand undone. Review the scores and save again.');
}

function draft() { return { scoring: { ...scoring }, a: $('scoreA').value, b: $('scoreB').value, note: $('note').value }; }
function restoreDraft() {
  const d = state.draft; resetScoring();
  if (d && d.scoring && Number.isFinite(d.scoring.bonusA) && Number.isFinite(d.scoring.bonusB)) {
    scoring = { mode: 'normal', bonusA: d.scoring.bonusA, bonusB: d.scoring.bonusB }; bonusLabels();
    $('scoreA').value = typeof d.a === 'string' ? d.a : '50'; $('scoreB').value = typeof d.b === 'string' ? d.b : '50';
  }
  $('note').value = typeof d?.note === 'string' ? d.note : ''; $('noteDetails').open = Boolean($('note').value);
  scheduleScoreValidation();
}
