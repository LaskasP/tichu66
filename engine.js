/* Browser-independent save validation and match scheduling. */
const Tichu = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const totals = hands => hands.reduce((t, h) => [t[0] + h.a, t[1] + h.b], [0, 0]);
  const won = (hands, target) => { const [a, b] = totals(hands); return Math.max(a, b) >= target && a !== b; };
  const permutation = (order, n) => Array.isArray(order) && order.length === n && new Set(order).size === n && order.every(i => Number.isInteger(i) && i >= 0 && i < n);
  const hand = h => h && Number.isFinite(h.a) && Number.isFinite(h.b) && h.a % 5 === 0 && h.b % 5 === 0 && typeof h.note === 'string';
  const unfinished = (hands, target) => { let a = 0, b = 0; return hands.every(h => { a += h.a; b += h.b; return Math.max(a, b) < target || a === b; }); };
  function schedule(seed) {
    const ring = [...seed], rounds = [];
    for (let r = 0; r < 5; r++) {
      const pairs = [0, 1, 2].map(i => [ring[i], ring[5 - i]]);
      for (let j = 0; j < 3; j++) rounds.push([...pairs[j], ...pairs[(j + 1) % 3], ...pairs[(j + 2) % 3]]);
      ring.splice(1, 0, ring.pop());
    }
    return rounds;
  }
  function lineupAt(s, index) {
    if (s.players.length === 4) return [...s.seed];
    if (s.players.length === 5) { const offset = (5 - index % 5) % 5; return [...s.seed.slice(offset), ...s.seed.slice(0, offset)]; }
    if (s.mode === 'rotating') return [...schedule(s.seed)[index % 15]];
    const pairs = [s.seed.slice(0, 2), s.seed.slice(2, 4), s.seed.slice(4, 6)], j = index % 3;
    return [...pairs[j], ...pairs[(j + 1) % 3], ...pairs[(j + 2) % 3]];
  }
  function create({ name = 'My game', players = Array.from({ length: 5 }, (_, i) => `Player ${i + 1}`), mode = 'rotating', target = 500 } = {}) {
    const seed = players.map((_, i) => i);
    const s = { version: 3, id: id(), name, players, mode: players.length === 4 ? 'fixed' : players.length === 5 ? 'rotating' : mode, seed, order: seed, target, hands: [], games: [], legacy: [] };
    s.order = lineupAt(s, 0); return s;
  }
  function valid(s) {
    if (!s || s.version !== 3 || typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80 || !Array.isArray(s.players)) return false;
    const n = s.players.length;
    if (![4, 5, 6].includes(n) || !s.players.every(p => typeof p === 'string' && p.trim() && p.length <= 40) || !['fixed', 'rotating'].includes(s.mode) || n === 4 && s.mode !== 'fixed' || n === 5 && s.mode !== 'rotating' || !permutation(s.seed, n) || !permutation(s.order, n) || ![500, 1000].includes(s.target)) return false;
    if (!Array.isArray(s.hands) || !s.hands.every(hand) || !unfinished(s.hands, s.target) || !Array.isArray(s.games) || !Array.isArray(s.legacy) || !s.legacy.every(h => h && typeof h === 'object')) return false;
    const samePair = (a, b) => a.every(i => b.includes(i));
    const pairsValid = order => s.mode !== 'fixed' || [order.slice(0, 2), order.slice(2, 4), ...(n === 6 ? [order.slice(4, 6)] : [])].every(pair => s.seed.some((_, i) => i % 2 === 0 && samePair(pair, s.seed.slice(i, i + 2))));
    return pairsValid(s.order) && s.games.every(g => g && permutation(g.lineup, n) && pairsValid(g.lineup) && [500, 1000].includes(g.target) && Array.isArray(g.hands) && g.hands.every(hand) && won(g.hands, g.target) && unfinished(g.hands.slice(0, -1), g.target));
  }
  function migrate(raw, name = 'Imported game') {
    if (!raw || typeof raw !== 'object') throw Error('Invalid backup');
    const s = clone(raw);
    if (s.version === 3) { if (!valid(s)) throw Error('Invalid session'); return s; }
    if (s.version !== 2 && s.version !== 1 && s.version !== undefined) throw Error('Unsupported backup version');
    if (!Array.isArray(s.players) || s.players.length !== 5 || !permutation(s.order, 5)) throw Error('Invalid five-player backup');
    let converted;
    if (s.version === 2) converted = { ...s, version: 3, id: id(), name, mode: 'rotating', seed: [...s.order] };
    else {
      if (!Array.isArray(s.rounds)) throw Error('Missing legacy rounds');
      converted = { ...create({ name, players: s.players }), order: s.order, seed: [...s.order], legacy: s.rounds };
    }
    if (!valid(converted)) throw Error('Invalid backup'); return converted;
  }
  function changeSeat(s, index, player) {
    const n = s.players.length;
    if (!Number.isInteger(index) || index < 0 || index >= n || !Number.isInteger(player) || player < 0 || player >= n || n === 4 && (s.hands.length || s.games.length)) return false;
    const occupied = s.order.indexOf(player);
    if (s.mode === 'fixed' && n === 6 && Math.floor(index / 2) !== Math.floor(occupied / 2)) {
      [s.order[index ^ 1], s.order[occupied ^ 1]] = [s.order[occupied ^ 1], s.order[index ^ 1]];
    }
    [s.order[index], s.order[occupied]] = [s.order[occupied], s.order[index]];
    return true;
  }
  function complete(s) {
    if (!won(s.hands, s.target)) return false;
    s.games.push({ lineup: [...s.order], target: s.target, hands: s.hands }); s.hands = [];
    s.order = s.players.length === 5 ? [s.order[4], ...s.order.slice(0, 4)] : lineupAt(s, s.games.length); return true;
  }
  const next = s => s.players.length === 5 ? [s.order[4], ...s.order.slice(0, 4)] : lineupAt(s, s.games.length + 1);
  return { clone, id, totals, won, permutation, create, valid, migrate, changeSeat, complete, next, lineupAt, schedule };
})();
if (typeof module !== 'undefined') module.exports = Tichu;
