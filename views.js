const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pairName = pair => pair.map(i => state.players[i]).join(' + ');
const matchup = order => `${pairName(order.slice(0, 2))} vs ${pairName(order.slice(2, 4))}`;
const modeLabel = s => `${s.players.length} players · ${s.mode === 'fixed' ? 'Fixed pairs' : 'Rotating partners'}`;

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function renderTimer() {
  const running = Boolean(state.timer && state.timer.startedAt !== null);
  $('timerDisplay').textContent = formatDuration(Tichu.elapsed(state));
  $('timerStatus').textContent = running ? 'Running' : state.timer ? 'Paused' : 'Ready';
  $('timerButtonLabel').textContent = running ? 'Pause' : 'Play';
  $('timerButton').setAttribute('aria-label', `${running ? 'Pause' : 'Play'} match timer`);
  $('timerIcon').setAttribute('d', running ? 'M5 3h4v14H5zM12 3h4v14h-4z' : 'M6 3 17 10 6 17Z');
}

function render() {
  renderTimer();
  const locked = state.hands.length > 0;
  const fixed = state.mode === 'fixed';
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
  const [a, b] = Tichu.totals(state.hands);
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
  $('rulesRotation').textContent = 'Scores stay with Team A and Team B until one reaches the target with a lead. A tie means another hand. ' + (state.players.length === 4 ? 'The same pairs play the next match.' : 'Change who sits out anytime. The finishing lineup receives the match points and result. ' + (state.players.length === 5 ? 'Then the resting player rotates in.' : fixed ? 'Fixed pairs move together. Pairs take turns: A–B, B–C, C–A.' : 'The next lineup follows the balanced 15-match schedule.'));
  renderStandings(fixed);
  renderHistory(a, b);
  syncDropdowns();
}

function renderStandings(fixed) {
  $('rounds').textContent = state.games.length;
  $('playersTitle').textContent = fixed ? 'Team standings' : 'Personal standings';
  $('playersEyebrow').textContent = 'YOUR TABLE';
  $('standingsIntro').textContent = fixed ? 'Your pairs. Your shared wins.' : 'Different teams. Your own wins.';
  $('standingsLabel').textContent = fixed ? 'Pair' : 'Player';
  $('standingsHelp').textContent = fixed ? 'Only completed matches count. The pairs finishing the match receive its points and result.' : 'Only completed matches count. The players finishing the match receive their team’s full points and win or loss. Players sitting out at the finish receive no result.';
  let stats = fixed ? Array.from({ length: state.players.length / 2 }, (_, id) => ({ name: pairName(state.seed.slice(id * 2, id * 2 + 2)), id, w: 0, n: 0, pts: 0 })) : state.players.map((name, id) => ({ name, id, w: 0, n: 0, pts: 0 }));
  for (const g of state.games) {
    const points = Tichu.totals(g.hands);
    for (let side = 0; side < 2; side++) {
      const pair = g.lineup.slice(side * 2, side * 2 + 2);
      const recipients = fixed ? [stats[Math.floor(state.seed.indexOf(pair[0]) / 2)]] : pair.map(i => stats[i]);
      for (const s of recipients) { s.n++; s.pts += points[side]; if (points[side] > points[1 - side]) s.w++; }
    }
  }
  stats.sort((a, b) => b.w - a.w || b.pts - a.pts);
  $('leader').textContent = stats[0].w ? stats.filter(s => s.w === stats[0].w).map(s => s.name).join(', ') : '—';
  $('standings').innerHTML = stats.map(s => `<tr><td>${esc(s.name)}</td><td><strong>${s.w}</strong></td><td>${s.n}</td><td>${s.n ? Math.round(s.w / s.n * 100) : 0}%</td><td>${s.pts}</td></tr>`).join('');
}

function renderHistory(a, b) {
  const hands = hs => hs.map((h, i) => `<p><small>Hand ${i + 1}: ${h.a} : ${h.b}${h.note ? ' · ' + esc(h.note) : ''}</small></p>`).join('');
  $('history').innerHTML = (state.hands.length ? `<article><strong>Current match · ${a} : ${b}</strong><p>${esc(matchup(state.order))}</p>${hands(state.hands)}</article>` : '') + state.games.map((g, i) => {
    const [a, b] = Tichu.totals(g.hands);
    return `<article><div class="row"><small>MATCH ${i + 1} · TARGET ${g.target}</small><strong>${a} : ${b} · Team ${a > b ? 'A' : 'B'} wins</strong></div><p>${esc(matchup(g.lineup))}</p>${g.durationMs !== undefined ? `<p class="match-duration">Match time · ${formatDuration(g.durationMs)}</p>` : ''}${g.lineup.length > 4 ? `<small>Resting: ${esc(g.lineup.slice(4).map(i => state.players[i]).join(' & '))}</small>` : ''}${hands(g.hands)}</article>`;
  }).reverse().join('') + (!state.games.length && !state.hands.length ? '<div class="empty">Record your first hand.<br>Wins count when a full match is completed.</div>' : '') + (state.legacy.length ? `<details><summary>${state.legacy.length} earlier hand records (excluded from match wins)</summary><p class="helper">Earlier records used a different lineup each hand. They remain in your JSON exports.</p>${state.legacy.map((r, i) => `<p>Earlier hand ${i + 1}: ${esc(r.a)} : ${esc(r.b)} · ${esc(r.note || '')}</p>`).join('')}</details>` : '');
}

let feedbackTimer;
function announce(message) {
  clearTimeout(feedbackTimer);
  $('feedback').textContent = message;
  $('feedback').hidden = false;
  feedbackTimer = setTimeout(() => { $('feedback').hidden = true; }, 3000);
}
function showView(view) {
  $('pageMenu').hidePopover?.(); if (!['game', 'players', 'history'].includes(view)) view = 'game';
  for (const name of ['game', 'players', 'history']) { $('view-' + name).hidden = name !== view; if (name === view) $('nav-' + name).setAttribute('aria-current', 'page'); else $('nav-' + name).removeAttribute('aria-current'); }
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
}
