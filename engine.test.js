const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./engine.js');

const players = ['Ada', 'Bo', 'Cy', 'Dee', 'Eli', 'Flo'];
const copy = value => JSON.parse(JSON.stringify(value));
const score = (a, b, note = '') => ({ a, b, note });
const rotate = order => [order[order.length - 1], ...order.slice(0, -1)];

function session(n, mode = 'rotating', target = 500) {
  return engine.create({ name: 'Friday table', players: players.slice(0, n), mode, target });
}

function finish(s) {
  s.hands.push(score(s.target, 0, 'Winning hand'));
  assert.equal(engine.complete(s), true);
  assert.equal(engine.valid(s), true);
}

function v2Backup() {
  return {
    version: 2,
    players: players.slice(0, 5),
    order: [3, 1, 4, 0, 2],
    target: 1000,
    hands: [
      { a: 200, b: -100, note: 'Grand Tichu ✓', date: '2026-11-01T10:00:00Z', scoring: { bonusA: 200, bonusB: 0 } },
      { a: 50, b: 50, note: '', date: '2026-11-01T10:05:00Z' },
    ],
    games: [
      { lineup: [0, 2, 1, 4, 3], target: 500, hands: [score(450, 450, 'Level'), score(100, 0, 'Finished')] },
      { lineup: [4, 0, 2, 1, 3], target: 1000, hands: [score(-100, 1000, 'Team B wins')] },
    ],
    legacy: [{ a: 60, b: 40, note: 'Earlier format', order: [2, 0, 4, 1, 3], date: '2026-10-01' }],
  };
}

test('v2 unfinished import preserves exact fields, metadata and all history without mutating input', () => {
  const raw = v2Backup();
  const before = copy(raw);
  const imported = engine.migrate(raw, 'Imported Friday');
  assert.equal(typeof imported.id, 'string');
  assert.ok(imported.id.length > 0);
  assert.deepEqual(imported, {
    ...before, version: 3, id: imported.id, name: 'Imported Friday',
    mode: 'rotating', seed: before.order,
  });
  assert.equal(engine.valid(imported), true);
  assert.deepEqual(engine.totals(imported.hands), [250, -50]);
  assert.deepEqual(raw, before);
  imported.hands[0].scoring.bonusA = 0;
  imported.games[0].hands[0].note = 'Changed';
  imported.legacy[0].order.reverse();
  imported.players[0] = 'Changed';
  imported.seed.reverse();
  assert.deepEqual(imported.order, before.order, 'seed and current order must be independent');
  assert.deepEqual(raw, before, 'nested imported data must not alias the backup');
});

test('five players: next rotates the original current lineup, including after v2 import', () => {
  const s = engine.migrate(v2Backup());
  let expected = [3, 1, 4, 0, 2];
  for (let i = 0; i < 10; i++) {
    const before = copy(s);
    const upcoming = rotate(expected);
    assert.deepEqual(engine.next(s), upcoming);
    assert.deepEqual(s, before, 'preview must not mutate the session');
    const preview = engine.next(s);
    preview.reverse();
    assert.deepEqual(s, before, 'preview must not alias the current lineup');
    finish(s);
    assert.deepEqual(s.games.at(-1).lineup, expected);
    assert.deepEqual(s.order, upcoming);
    expected = upcoming;
  }
  assert.deepEqual(s.order, [3, 1, 4, 0, 2]);
});

test('four players keep the same teams and lineup after every completion', () => {
  const s = session(4);
  assert.equal(s.mode, 'fixed');
  s.seed = [2, 0, 3, 1];
  s.order = [...s.seed];
  for (let i = 0; i < 8; i++) {
    assert.deepEqual(engine.next(s), [2, 0, 3, 1]);
    finish(s);
    assert.deepEqual(s.order, [2, 0, 3, 1]);
    assert.deepEqual(s.games[i].lineup, [2, 0, 3, 1]);
  }
});

test('six fixed players cycle three intact pairs through A, B and resting', () => {
  const s = session(6, 'fixed');
  s.seed = [4, 1, 5, 0, 3, 2];
  const cycle = [
    [4, 1, 5, 0, 3, 2],
    [5, 0, 3, 2, 4, 1],
    [3, 2, 4, 1, 5, 0],
  ];
  s.order = [...cycle[0]];
  for (let i = 0; i < 9; i++) {
    assert.deepEqual(s.order, cycle[i % 3]);
    assert.deepEqual(engine.next(s), cycle[(i + 1) % 3]);
    finish(s);
    assert.deepEqual(s.games[i].lineup, cycle[i % 3]);
    assert.deepEqual(s.order, cycle[(i + 1) % 3]);
  }
});

test('six rotating players: over 15 matches each plays 10, rests 5 and partners everyone twice', () => {
  const s = session(6);
  s.seed = [3, 0, 5, 2, 1, 4];
  s.order = engine.lineupAt(s, 0);
  const first = [...s.order];
  const plays = Array(6).fill(0);
  const rests = Array(6).fill(0);
  const partners = Array.from({ length: 6 }, () => Array(6).fill(0));
  const lineups = [];
  for (let i = 0; i < 15; i++) {
    const lineup = [...s.order];
    lineups.push(lineup);
    assert.deepEqual([...lineup].sort(), [0, 1, 2, 3, 4, 5]);
    for (const p of lineup.slice(0, 4)) plays[p]++;
    for (const p of lineup.slice(4)) rests[p]++;
    for (const [a, b] of [lineup.slice(0, 2), lineup.slice(2, 4)]) {
      partners[a][b]++;
      partners[b][a]++;
    }
    const upcoming = engine.next(s);
    finish(s);
    assert.deepEqual(s.games[i].lineup, lineup);
    assert.deepEqual(s.order, upcoming);
  }
  assert.equal(new Set(lineups.map(lineup => JSON.stringify(lineup))).size, 15);
  assert.deepEqual(plays, [10, 10, 10, 10, 10, 10]);
  assert.deepEqual(rests, [5, 5, 5, 5, 5, 5]);
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 6; b++) assert.equal(partners[a][b], a === b ? 0 : 2, `partners ${a}, ${b}`);
  }
  assert.deepEqual(s.order, first, 'the schedule repeats after 15 matches');
  for (const expected of lineups) {
    assert.deepEqual(s.order, expected);
    finish(s);
  }
});

for (const [n, mode, target] of [[4, 'fixed', 500], [5, 'rotating', 1000], [6, 'fixed', 1000], [6, 'rotating', 500]]) {
  test(`JSON roundtrip resumes preview and completion: ${n} players, ${mode}, target ${target}`, () => {
    const original = session(n, mode, target);
    for (let i = 0; i < 4; i++) finish(original);
    original.hands.push({ ...score(200, -100, 'In progress'), scoring: { bonusA: 200 }, date: '2026-11-16' });
    original.legacy.push({ a: 20, b: 80, note: 'Archived hand' });
    const exported = copy(original);
    const resumed = engine.migrate(JSON.parse(JSON.stringify(original)));
    assert.deepEqual(resumed, exported);
    assert.deepEqual(engine.next(resumed), engine.next(original));
    assert.equal(engine.complete(resumed), false);
    assert.deepEqual(resumed, exported, 'an unfinished match must survive a completion attempt');
    for (let i = 0; i < 16; i++) {
      const expectedNext = engine.next(original);
      finish(original);
      finish(resumed);
      assert.deepEqual(resumed.order, expectedNext);
      assert.deepEqual(resumed, original);
    }
    assert.deepEqual(engine.migrate(copy(resumed)), resumed, 'completed history can be imported again');
  });
}

test('unsupported backup versions are rejected without changing the input', () => {
  for (const version of [0, -1, 4, 99, '2', null]) {
    const raw = { ...v2Backup(), version };
    const before = copy(raw);
    assert.throws(() => engine.migrate(raw), /Unsupported backup version/);
    assert.deepEqual(raw, before);
  }
});

test('malformed and corrupt backups are rejected', async t => {
  for (const raw of [null, undefined, false, 42, 'not JSON', [], {}]) {
    assert.throws(() => engine.migrate(raw));
  }
  const corruptions = {
    'empty id': s => { s.id = ''; },
    'blank name': s => { s.name = '  '; },
    'name too long': s => { s.name = 'x'.repeat(81); },
    'unsupported player count': s => { s.players.pop(); },
    'blank player': s => { s.players[0] = ''; },
    'player too long': s => { s.players[0] = 'x'.repeat(41); },
    'invalid mode': s => { s.mode = 'random'; },
    'duplicate seed': s => { s.seed[0] = s.seed[1]; },
    'out of range order': s => { s.order[0] = 6; },
    'fractional order': s => { s.order[0] = 0.5; },
    'unsupported target': s => { s.target = 750; },
    'missing hands': s => { delete s.hands; },
    'non-five score': s => { s.hands = [score(51, 50)]; },
    'string score': s => { s.hands = [score('50', 50)]; },
    'non-finite score': s => { s.hands = [score(Infinity, 50)]; },
    'missing note': s => { s.hands = [{ a: 50, b: 50 }]; },
    'null hand': s => { s.hands = [null]; },
    'unarchived winner': s => { s.hands = [score(500, 0)]; },
    'winner followed by tie': s => { s.hands = [score(500, 0), score(0, 500)]; },
    'missing games': s => { delete s.games; },
    'unfinished archived game': s => { s.games = [{ lineup: [...s.order], target: 500, hands: [score(100, 0)] }]; },
    'tied archived game': s => { s.games = [{ lineup: [...s.order], target: 500, hands: [score(500, 500)] }]; },
    'archived game continued after win': s => { s.games = [{ lineup: [...s.order], target: 500, hands: [score(500, 0), score(100, 0)] }]; },
    'invalid archived lineup': s => { s.games = [{ lineup: [0, 0, 2, 3, 4], target: 500, hands: [score(500, 0)] }]; },
    'invalid archived target': s => { s.games = [{ lineup: [...s.order], target: 750, hands: [score(1000, 0)] }]; },
    'missing legacy': s => { delete s.legacy; },
    'null legacy entry': s => { s.legacy = [null]; },
  };
  for (const [name, corrupt] of Object.entries(corruptions)) {
    await t.test(name, () => {
      const raw = session(5);
      corrupt(raw);
      assert.equal(engine.valid(raw), false);
      assert.throws(() => engine.migrate(raw), /Invalid session/);
    });
  }
  for (const n of [4, 6]) {
    const raw = session(n, 'fixed');
    [raw.order[1], raw.order[2]] = [raw.order[2], raw.order[1]];
    assert.equal(engine.valid(raw), false, 'fixed teams cannot be split');
    assert.throws(() => engine.migrate(raw), /Invalid session/);
  }
  const brokenV2 = v2Backup();
  brokenV2.order = [0, 1, 2, 3, 3];
  assert.throws(() => engine.migrate(brokenV2), /Invalid five-player backup/);
  const missingHistory = v2Backup();
  delete missingHistory.games;
  assert.throws(() => engine.migrate(missingHistory), /Invalid backup/);
});

for (const target of [500, 1000]) {
  for (const winner of ['A', 'B']) {
    test(`tie at target ${target} continues until team ${winner} takes the lead`, () => {
      const s = session(5, 'rotating', target);
      s.hands.push(score(target, target, 'Tied at target'));
      assert.equal(engine.won(s.hands, target), false);
      assert.equal(engine.valid(s), true);
      const tied = copy(s);
      assert.equal(engine.complete(s), false);
      assert.deepEqual(s, tied);
      assert.deepEqual(engine.migrate(copy(s)), tied);
      s.hands.push(score(100, 100, 'Still tied above target'));
      assert.equal(engine.won(s.hands, target), false);
      assert.equal(engine.complete(s), false);
      assert.equal(engine.valid(s), true);
      s.hands.push(winner === 'A' ? score(5, -5, 'Decider') : score(-5, 5, 'Decider'));
      const completedHands = copy(s.hands);
      const next = engine.next(s);
      assert.equal(engine.won(s.hands, target), true);
      assert.equal(engine.complete(s), true);
      assert.deepEqual(s.games, [{ lineup: tied.order, target, hands: completedHands }]);
      assert.deepEqual(s.hands, []);
      assert.deepEqual(s.order, next);
      assert.equal(engine.valid(s), true);
      const completed = copy(s);
      assert.equal(engine.complete(s), false, 'completion must not archive the same match twice');
      assert.deepEqual(s, completed);
    });
  }
}
