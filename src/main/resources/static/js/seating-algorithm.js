// Smart Wedding Seating v3 — pure algorithm module (no DOM).
// Exports `runSeating(input)`. Designed to run in main thread or Web Worker.
'use strict';

const DEFAULT_CAPACITY = 12;
const SPLIT_PRIORITY = ['OTHER', 'COMPANION', 'FRIEND', 'FAMILY', 'CHILD', 'SPOUSE'];

// ─── RNG (Mulberry32) ─────────────────────────────────────────────────────
function makeRng(seed) {
  let s = (seed >>> 0) || 0xC0FFEE;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, n) => Math.floor(rng() * n);
const pick = (rng, arr) => arr[randInt(rng, arr.length)];

// ─── Gender detection ─────────────────────────────────────────────────────
const FEMALE_NAMES = new Set([
  'айгуль','айжан','айнур','айгерим','нургуль','бермет','гулнара','гулим',
  'жылдыз','назгуль','мээрим','чолпон','зулайка','перизат','динара','камила',
  'малика','назира','бурул','гулзат','индира','жыпар','алтынай','зарина',
  'венера','салтанат','асель','айдай','айзада','айпери','айсулуу','анара',
  'бегимай','гульмира','жамиля','зейнеп','каныкей','клара','лейла','медина',
  'нурия','роза','сайкал','турсунай','умут','шахида','эльмира','юлия',
]);
const MALE_NAMES = new Set([
  'азамат','бакыт','нурлан','талант','мирбек','эрлан','бекзат','жаныбек',
  'тимур','алишер','канат','улан','чынгыз','данияр','мурат','аскар','руслан',
  'санжар','болот','жоомарт','ырысбек','эмиль','рустам','феруз','дильшод',
  'азиз','алмаз','арсен','бакай','бахтияр','бекболот','дастан','жыргалбек',
  'кубат','максат','медер','нурбек','омурбек','рахат','сапар','турат',
  'улукбек','эрбол','эрмек','эсен','адилет','артём','владимир','максим',
]);

function tokenize(name) {
  if (!name) return [];
  return String(name).toLowerCase().split(/[\s\-]+/).filter(t => t.length > 2);
}

function detectOnToken(t) {
  if (!t) return null;
  if (t === 'кызы') return { gender: 'female', conf: 1.0 };
  if (t === 'уулу') return { gender: 'male',   conf: 1.0 };
  if (/(ова|ева)$/.test(t))   return { gender: 'female', conf: 0.97 };
  if (/(ов|ев)$/.test(t))     return { gender: 'male',   conf: 0.97 };
  if (/ина$/.test(t))         return { gender: 'female', conf: 0.92 };
  if (/ин$/.test(t))          return { gender: 'male',   conf: 0.85 };
  if (/(бек|хан|али|мир|бай|жан)$/.test(t)) return { gender: 'male', conf: 0.85 };
  if (/(гуль|зат|бубу|сулуу)$/.test(t))      return { gender: 'female', conf: 0.80 };
  if (FEMALE_NAMES.has(t))    return { gender: 'female', conf: 0.75 };
  if (MALE_NAMES.has(t))      return { gender: 'male',   conf: 0.75 };
  return null;
}

function detectGender(name) {
  const tokens = tokenize(name);
  if (tokens.length === 0) return { gender: 'unknown', conf: 0.5 };
  // Cyrillic check — latin → unknown for now
  if (!/[а-яёөңү]/i.test(tokens.join(''))) return { gender: 'unknown', conf: 0.5 };

  const candidates = [];
  const first = detectOnToken(tokens[0]);
  if (first) candidates.push(first);
  if (tokens.length > 1) {
    const last = detectOnToken(tokens[tokens.length - 1]);
    if (last) candidates.push(last);
  }
  // Check "кызы"/"уулу" anywhere
  for (const t of tokens) {
    if (t === 'кызы') candidates.push({ gender: 'female', conf: 1.0 });
    else if (t === 'уулу') candidates.push({ gender: 'male', conf: 1.0 });
  }
  if (candidates.length === 0) return { gender: 'unknown', conf: 0.5 };
  candidates.sort((a, b) => b.conf - a.conf);
  return candidates[0];
}

// ─── Union-Find groups via relatedToId ────────────────────────────────────
function buildGroups(guests) {
  const idToIdx = new Map();
  guests.forEach((g, i) => idToIdx.set(g.id, i));

  const parent = guests.map((_, i) => i);
  const rank = guests.map(() => 0);
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  }

  guests.forEach((g, i) => {
    if (g.relatedToId != null && idToIdx.has(g.relatedToId)) {
      union(i, idToIdx.get(g.relatedToId));
    }
  });

  const byRoot = new Map();
  guests.forEach((g, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(g.id);
  });

  let gid = 0;
  const groups = [];
  const guestToGroup = new Map();
  for (const memberIds of byRoot.values()) {
    const id = gid++;
    groups.push({ id, memberIds });
    for (const mid of memberIds) guestToGroup.set(mid, id);
  }
  return { groups, guestToGroup };
}

// Compute group-level metadata (side, locked, relation strength).
function annotateGroups(groups, guestById, hardReset) {
  for (const grp of groups) {
    const members = grp.memberIds.map(id => guestById.get(id));
    // Group side: dominant of members; SHARED if tied
    const sideCounts = { BRIDE: 0, GROOM: 0, SHARED: 0 };
    for (const m of members) sideCounts[m.side || 'SHARED']++;
    grp.side = sideCounts.BRIDE > sideCounts.GROOM
      ? (sideCounts.BRIDE >= sideCounts.SHARED ? 'BRIDE' : 'SHARED')
      : sideCounts.GROOM > sideCounts.BRIDE
        ? (sideCounts.GROOM >= sideCounts.SHARED ? 'GROOM' : 'SHARED')
        : 'SHARED';

    // Locked: if ALL members share the same non-null tableId AND not hardReset
    const tids = new Set(members.map(m => m.tableId).filter(x => x != null));
    if (!hardReset && tids.size === 1 && members.every(m => m.tableId != null)) {
      grp.locked = true;
      grp.lockedTableId = members[0].tableId;
    } else {
      grp.locked = false;
      grp.lockedTableId = null;
    }

    // Has SPOUSE relation? (strongest)
    grp.hasSpouse = members.some(m => m.relationType === 'SPOUSE');
    grp.size = members.length;
  }
}

// ─── Preflight & filtering ────────────────────────────────────────────────
// Returns: { activeGuests, declinedWithTable, oversizedGroups, lockedOverflow }
function preflight(guests, tables, opts) {
  const includePending = opts.includePending !== false; // default true
  const hardReset = !!opts.hardReset;

  const activeIds = new Set();
  const declinedWithTable = [];

  for (const g of guests) {
    const status = g.rsvpStatus;
    if (status === 'DECLINED') {
      if (g.tableId != null) declinedWithTable.push(g.id);
      continue;
    }
    if (!includePending && (status == null || status === 'PENDING')) continue;
    // MAYBE — treat as included while migration is pending
    activeIds.add(g.id);
  }

  // Filter to active guests only — DECLINED have tableId cleared in result
  const activeGuests = guests.filter(g => activeIds.has(g.id));

  // Orphan tableIds → silent fix
  const validTableIds = new Set(tables.map(t => t.id));
  for (const g of activeGuests) {
    if (g.tableId != null && !validTableIds.has(g.tableId)) g.tableId = null;
  }

  // If hardReset → clear all tableIds on active
  if (hardReset) for (const g of activeGuests) g.tableId = null;

  return { activeGuests, declinedWithTable, hardReset, includePending };
}

function findOversizedGroups(groups, tables) {
  const maxCap = tables.reduce((m, t) => Math.max(m, t.capacity || DEFAULT_CAPACITY), 0) || DEFAULT_CAPACITY;
  return groups.filter(g => g.size > maxCap).map(g => ({ groupId: g.id, size: g.size, maxCapacity: maxCap, memberIds: g.memberIds.slice() }));
}

function findLockedOverflow(tables, guestById, groups) {
  // Count locked occupancy per table
  const counts = new Map();
  for (const grp of groups) {
    if (!grp.locked) continue;
    counts.set(grp.lockedTableId, (counts.get(grp.lockedTableId) || 0) + grp.size);
  }
  const overflow = [];
  for (const t of tables) {
    const cap = t.capacity || DEFAULT_CAPACITY;
    const cnt = counts.get(t.id) || 0;
    if (cnt > cap) overflow.push({ tableId: t.id, name: t.name, capacity: cap, lockedCount: cnt });
  }
  return overflow;
}

// ─── Zoning ───────────────────────────────────────────────────────────────
function planZones(tables, groups, guestById) {
  // Step 1 — forced zones from locked guests
  const lockedSideByTable = new Map(); // tableId → { BRIDE, GROOM, SHARED }
  for (const grp of groups) {
    if (!grp.locked) continue;
    const cap = lockedSideByTable.get(grp.lockedTableId) || { BRIDE: 0, GROOM: 0, SHARED: 0 };
    for (const mid of grp.memberIds) {
      const side = guestById.get(mid).side || 'SHARED';
      cap[side]++;
    }
    lockedSideByTable.set(grp.lockedTableId, cap);
  }

  const zoneByTable = new Map();
  const remainingTables = [];
  for (const t of tables) {
    const lock = lockedSideByTable.get(t.id);
    if (lock && (lock.BRIDE > 0 || lock.GROOM > 0)) {
      // Forced zone by dominance
      const z = lock.BRIDE > lock.GROOM ? 'BRIDE' : lock.GROOM > lock.BRIDE ? 'GROOM' : 'SHARED';
      zoneByTable.set(t.id, z);
    } else {
      remainingTables.push(t);
    }
  }

  // Step 2 — compute counts among unlocked active groups
  let brideActive = 0, groomActive = 0;
  for (const grp of groups) {
    if (grp.locked) continue;
    if (grp.side === 'BRIDE') brideActive += grp.size;
    else if (grp.side === 'GROOM') groomActive += grp.size;
  }

  // Single-side event → no zoning, mark all remaining as SHARED
  if (brideActive === 0 && groomActive === 0) {
    for (const t of remainingTables) zoneByTable.set(t.id, 'SHARED');
    return zoneByTable;
  }

  const avgCap = remainingTables.reduce((s, t) => s + (t.capacity || DEFAULT_CAPACITY), 0) / Math.max(1, remainingTables.length);
  let brideZone = Math.ceil(brideActive / Math.max(1, avgCap));
  let groomZone = Math.ceil(groomActive / Math.max(1, avgCap));
  if (brideZone + groomZone > remainingTables.length) {
    const scale = remainingTables.length / (brideZone + groomZone);
    brideZone = Math.floor(brideZone * scale);
    groomZone = Math.floor(groomZone * scale);
  }
  // Assign zones to remaining tables in order
  let i = 0;
  for (; i < brideZone && i < remainingTables.length; i++) zoneByTable.set(remainingTables[i].id, 'BRIDE');
  for (; i < brideZone + groomZone && i < remainingTables.length; i++) zoneByTable.set(remainingTables[i].id, 'GROOM');
  for (; i < remainingTables.length; i++) zoneByTable.set(remainingTables[i].id, 'SHARED');
  return zoneByTable;
}

// ─── State + Score ────────────────────────────────────────────────────────
function buildState(tables, groups, guestById, zoneByTable) {
  // byTable: tableId → Set<guestId>
  // byGuest: guestId → tableId (null if unassigned)
  // groupTables: groupId → Map<tableId, count>
  // separatedGroups: number
  const byTable = new Map();
  const byGuest = new Map();
  const groupTables = new Map();
  const capByTable = new Map();
  const zoneByTableMap = new Map(zoneByTable);
  const guestToGroup = new Map();
  for (const t of tables) {
    byTable.set(t.id, new Set());
    capByTable.set(t.id, t.capacity || DEFAULT_CAPACITY);
  }
  for (const grp of groups) {
    groupTables.set(grp.id, new Map());
    for (const mid of grp.memberIds) guestToGroup.set(mid, grp.id);
  }

  // Place locked guests
  for (const grp of groups) {
    if (!grp.locked) continue;
    const tid = grp.lockedTableId;
    if (!byTable.has(tid)) continue; // safety
    for (const mid of grp.memberIds) {
      byTable.get(tid).add(mid);
      byGuest.set(mid, tid);
      const gt = groupTables.get(grp.id);
      gt.set(tid, (gt.get(tid) || 0) + 1);
    }
  }

  return {
    tables,
    groups,
    guestById,
    byTable,
    byGuest,
    capByTable,
    zoneByTable: zoneByTableMap,
    groupTables,
    guestToGroup,
    separatedGroups: 0,
    lockedGuests: new Set(Array.from(byGuest.keys())),
  };
}

function tableScore(state, tableId) {
  const seated = state.byTable.get(tableId);
  const size = seated.size;
  const cap = state.capByTable.get(tableId);
  if (size === 0) return 0;
  const zone = state.zoneByTable.get(tableId);

  // SidePurity zone-aware
  let bride = 0, groom = 0, shared = 0;
  let wF = 0, wM = 0;
  for (const gid of seated) {
    const g = state.guestById.get(gid);
    const s = g.side || 'SHARED';
    if (s === 'BRIDE') bride++;
    else if (s === 'GROOM') groom++;
    else shared++;
    if (g.gender === 'female') wF += g.conf;
    else if (g.gender === 'male') wM += g.conf;
  }
  let sidePurity;
  if (zone === 'BRIDE') sidePurity = (bride + shared * 0.5) / size;
  else if (zone === 'GROOM') sidePurity = (groom + shared * 0.5) / size;
  else sidePurity = 1.0; // SHARED zone: no penalty

  // GenderBalance — only on known
  const known = wF + wM;
  let genderBalance;
  if (known < 1) genderBalance = 1.0;
  else {
    const ratio = wF / known;
    genderBalance = 1 - Math.abs(ratio - 0.5) * 2;
  }

  // FillScore
  const fill = size / cap;
  let fillScore;
  if (fill > 1) fillScore = 0; // shouldn't happen — hard constraint, but safe
  else if (fill < 0.5) fillScore = (fill / 0.5) * 0.5;
  else if (fill <= 0.9) fillScore = 1.0;
  else fillScore = 0.7;

  return 40 * sidePurity + 20 * genderBalance + 15 * fillScore;
}

function globalScore(state) {
  let total = 0;
  for (const t of state.tables) total += tableScore(state, t.id);
  // CoupleIntegrity weight = 100
  const totalGroups = state.groups.length;
  const couplePart = totalGroups > 0 ? (1 - state.separatedGroups / totalGroups) * 100 : 100;
  return total + couplePart;
}

// Update separatedGroups counter incrementally — call after any membership change.
// We recompute the affected groups' status from groupTables (cheap).
function recomputeSeparation(state, affectedGroupIds) {
  for (const gid of affectedGroupIds) {
    const map = state.groupTables.get(gid);
    const present = Array.from(map.entries()).filter(([_, c]) => c > 0);
    const wasSeparated = state._separationByGroup ? state._separationByGroup.get(gid) || false : null;
    const isSeparated = present.length > 1;
    if (!state._separationByGroup) state._separationByGroup = new Map();
    state._separationByGroup.set(gid, isSeparated);
    if (wasSeparated === null) continue; // initial, handled in initSeparation
    if (wasSeparated && !isSeparated) state.separatedGroups--;
    else if (!wasSeparated && isSeparated) state.separatedGroups++;
  }
}

function initSeparation(state) {
  state._separationByGroup = new Map();
  state.separatedGroups = 0;
  for (const grp of state.groups) {
    const map = state.groupTables.get(grp.id);
    const present = Array.from(map.entries()).filter(([_, c]) => c > 0);
    const isSeparated = present.length > 1;
    state._separationByGroup.set(grp.id, isSeparated);
    if (isSeparated) state.separatedGroups++;
  }
}

// ─── Membership ops (atomic, return list of affected tables/groups) ──────
function placeGuest(state, guestId, tableId) {
  const grp = state.guestToGroup.get(guestId);
  state.byGuest.set(guestId, tableId);
  state.byTable.get(tableId).add(guestId);
  const gt = state.groupTables.get(grp);
  gt.set(tableId, (gt.get(tableId) || 0) + 1);
}
function removeGuest(state, guestId) {
  const tid = state.byGuest.get(guestId);
  if (tid == null) return null;
  const grp = state.guestToGroup.get(guestId);
  state.byTable.get(tid).delete(guestId);
  state.byGuest.delete(guestId);
  const gt = state.groupTables.get(grp);
  const c = (gt.get(tid) || 0) - 1;
  if (c <= 0) gt.delete(tid); else gt.set(tid, c);
  return tid;
}

// ─── Greedy init ──────────────────────────────────────────────────────────
function greedyInit(state, groups, rng) {
  // Sort unassigned groups: spouse pairs first, larger groups before singletons,
  // BRIDE/GROOM before SHARED so they fit own zone first.
  const unassigned = groups.filter(g => !g.locked).slice();
  unassigned.sort((a, b) => {
    if (a.hasSpouse !== b.hasSpouse) return b.hasSpouse - a.hasSpouse;
    if (a.size !== b.size) return b.size - a.size;
    const sw = s => s === 'SHARED' ? 1 : 0;
    return sw(a.side) - sw(b.side);
  });

  const unassignedGuests = [];

  for (const grp of unassigned) {
    // Find candidate tables ranked by: matching zone, free seats, current side mix
    const candidates = state.tables
      .map(t => {
        const free = state.capByTable.get(t.id) - state.byTable.get(t.id).size;
        return { t, free };
      })
      .filter(({ free }) => free > 0);
    if (candidates.length === 0) {
      for (const mid of grp.memberIds) unassignedGuests.push({ guestId: mid, reason: 'NO_SEATS' });
      continue;
    }

    const want = grp.side; // BRIDE/GROOM/SHARED
    candidates.sort((a, b) => {
      const zoneA = state.zoneByTable.get(a.t.id);
      const zoneB = state.zoneByTable.get(b.t.id);
      const matchA = (want !== 'SHARED' && zoneA === want) ? 0 : (zoneA === 'SHARED' ? 1 : 2);
      const matchB = (want !== 'SHARED' && zoneB === want) ? 0 : (zoneB === 'SHARED' ? 1 : 2);
      if (matchA !== matchB) return matchA - matchB;
      // prefer tables with more free seats (consolidate big groups)
      if (a.free !== b.free) return b.free - a.free;
      return 0;
    });

    // Try to fit whole group
    const fit = candidates.find(c => c.free >= grp.size);
    if (fit) {
      for (const mid of grp.memberIds) placeGuest(state, mid, fit.t.id);
      continue;
    }

    // Split with priority — keep SPOUSE bound members together
    // Build sub-groups: collapse SPOUSE-linked subset first
    const members = grp.memberIds.map(id => state.guestById.get(id));
    const subgroups = splitGroupByPriority(members);
    // Place each subgroup in best available candidate
    for (const sub of subgroups) {
      const target = candidates.find(c => state.capByTable.get(c.t.id) - state.byTable.get(c.t.id).size >= sub.length);
      if (target) {
        for (const m of sub) placeGuest(state, m.id, target.t.id);
      } else {
        // Place individually wherever possible
        for (const m of sub) {
          const free = candidates.find(c => state.capByTable.get(c.t.id) - state.byTable.get(c.t.id).size >= 1);
          if (free) placeGuest(state, m.id, free.t.id);
          else unassignedGuests.push({ guestId: m.id, reason: 'NO_SEATS' });
        }
      }
    }
  }

  initSeparation(state);
  return unassignedGuests;
}

// Split a group into atomic sub-groups: SPOUSE pairs stay bound,
// others split individually but ordered by priority of severance.
function splitGroupByPriority(members) {
  // Find SPOUSE-linked sub-clusters first (UF within members)
  const idx = new Map(members.map((m, i) => [m.id, i]));
  const parent = members.map((_, i) => i);
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
  members.forEach((m, i) => {
    if (m.relationType === 'SPOUSE' && m.relatedToId != null && idx.has(m.relatedToId)) {
      union(i, idx.get(m.relatedToId));
    }
  });
  const byRoot = new Map();
  members.forEach((m, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(m);
  });
  const subs = Array.from(byRoot.values());
  // Order: SPOUSE pairs first (largest), then by SPLIT_PRIORITY for singletons
  subs.sort((a, b) => {
    const aHasSpouse = a.some(m => m.relationType === 'SPOUSE');
    const bHasSpouse = b.some(m => m.relationType === 'SPOUSE');
    if (aHasSpouse !== bHasSpouse) return bHasSpouse - aHasSpouse;
    return b.length - a.length;
  });
  return subs;
}

// ─── Simulated Annealing ─────────────────────────────────────────────────
function simulatedAnnealing(state, groups, rng, iterations, onProgress) {
  const tables = state.tables;
  const moveableGroups = groups.filter(g => !g.locked);
  if (moveableGroups.length === 0) return { bestState: state, bestScore: globalScore(state) };

  let T = 100.0;
  const T_min = 0.5;
  const cooling = Math.pow(T_min / T, 1 / Math.max(1, iterations));

  let currentScore = globalScore(state);
  let bestScore = currentScore;
  let bestSnapshot = snapshotAssignment(state);
  let sinceImprove = 0;
  let reheated = false;

  // Pick a guest from a moveable group at a given table
  function pickMoveableGuestAt(tableId) {
    const seated = Array.from(state.byTable.get(tableId)).filter(gid => !state.lockedGuests.has(gid));
    if (seated.length === 0) return null;
    return pick(rng, seated);
  }
  function pickGroupAt(tableId) {
    // pick a non-locked group that has all its members at this table
    const cand = [];
    for (const grp of moveableGroups) {
      const gt = state.groupTables.get(grp.id);
      if (gt.size === 1 && gt.get(tableId) === grp.size) cand.push(grp);
    }
    return cand.length === 0 ? null : pick(rng, cand);
  }

  const hasCouples = moveableGroups.some(g => g.size >= 2);

  for (let iter = 0; iter < iterations; iter++) {
    if (onProgress && (iter & 0xFF) === 0) onProgress(iter / iterations);

    // Operator selection — adaptive: if no couples, fold SWAP_GROUPS into SWAP_GUESTS
    const r = rng();
    let op;
    if (!hasCouples) op = r < 0.7 ? 'SWAP' : 'MOVE';
    else op = r < 0.6 ? 'SWAP' : r < 0.85 ? 'MOVE' : 'SWAP_GROUPS';

    let accepted = false;
    if (op === 'SWAP') accepted = trySwapGuests(state, rng);
    else if (op === 'MOVE') accepted = tryMoveGuest(state, rng);
    else accepted = trySwapGroups(state, rng, pickGroupAt);

    if (accepted.gained != null) {
      // Metropolis
      const delta = accepted.gained;
      if (delta > 0 || rng() < Math.exp(delta / T)) {
        currentScore += delta;
        accepted.commit();
        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestSnapshot = snapshotAssignment(state);
          sinceImprove = 0;
        } else sinceImprove++;
      } else {
        accepted.rollback();
        sinceImprove++;
      }
    } else {
      sinceImprove++;
    }

    // Reheat once if stagnant
    if (!reheated && sinceImprove > Math.floor(iterations / 4)) {
      T = Math.max(T * 2, 30);
      reheated = true;
      sinceImprove = 0;
    }

    T *= cooling;
  }

  // Restore best
  restoreAssignment(state, bestSnapshot);
  return { bestState: state, bestScore };
}

// Helpers — try a move, return { gained, commit, rollback } or { gained: null }.
function trySwapGuests(state, rng) {
  const tables = state.tables;
  if (tables.length < 2) return { gained: null };
  const aTable = pick(rng, tables);
  const bTable = pick(rng, tables.filter(t => t.id !== aTable.id));
  if (!bTable) return { gained: null };
  const aGuests = Array.from(state.byTable.get(aTable.id)).filter(gid => !state.lockedGuests.has(gid));
  const bGuests = Array.from(state.byTable.get(bTable.id)).filter(gid => !state.lockedGuests.has(gid));
  if (aGuests.length === 0 || bGuests.length === 0) return { gained: null };
  const ga = pick(rng, aGuests);
  const gb = pick(rng, bGuests);

  const before = tableScore(state, aTable.id) + tableScore(state, bTable.id);
  const sepBefore = state.separatedGroups;
  const grpA = state.guestToGroup.get(ga);
  const grpB = state.guestToGroup.get(gb);

  // Perform
  removeGuest(state, ga);
  removeGuest(state, gb);
  placeGuest(state, ga, bTable.id);
  placeGuest(state, gb, aTable.id);
  recomputeSeparation(state, new Set([grpA, grpB]));

  const after = tableScore(state, aTable.id) + tableScore(state, bTable.id);
  const totalGroups = state.groups.length;
  const couplesDelta = totalGroups > 0 ? ((state._sepBefore || sepBefore) - state.separatedGroups) * (100 / totalGroups) : 0;
  const gained = (after - before) + couplesDelta;

  return {
    gained,
    commit: () => {},
    rollback: () => {
      removeGuest(state, ga);
      removeGuest(state, gb);
      placeGuest(state, ga, aTable.id);
      placeGuest(state, gb, bTable.id);
      recomputeSeparation(state, new Set([grpA, grpB]));
    },
  };
}

function tryMoveGuest(state, rng) {
  const tables = state.tables;
  if (tables.length < 2) return { gained: null };
  const src = pick(rng, tables);
  const dst = pick(rng, tables.filter(t => t.id !== src.id));
  if (!dst) return { gained: null };
  const dstFree = state.capByTable.get(dst.id) - state.byTable.get(dst.id).size;
  if (dstFree <= 0) return { gained: null };
  const srcGuests = Array.from(state.byTable.get(src.id)).filter(gid => !state.lockedGuests.has(gid));
  if (srcGuests.length === 0) return { gained: null };
  const g = pick(rng, srcGuests);
  const grp = state.guestToGroup.get(g);

  const before = tableScore(state, src.id) + tableScore(state, dst.id);
  const sepBefore = state.separatedGroups;

  removeGuest(state, g);
  placeGuest(state, g, dst.id);
  recomputeSeparation(state, new Set([grp]));

  const after = tableScore(state, src.id) + tableScore(state, dst.id);
  const totalGroups = state.groups.length;
  const couplesDelta = totalGroups > 0 ? (sepBefore - state.separatedGroups) * (100 / totalGroups) : 0;
  const gained = (after - before) + couplesDelta;

  return {
    gained,
    commit: () => {},
    rollback: () => {
      removeGuest(state, g);
      placeGuest(state, g, src.id);
      recomputeSeparation(state, new Set([grp]));
    },
  };
}

function trySwapGroups(state, rng, pickGroupAt) {
  const tables = state.tables;
  if (tables.length < 2) return { gained: null };
  const aTable = pick(rng, tables);
  const grpA = pickGroupAt(aTable.id);
  if (!grpA) return { gained: null };
  const bCandidates = tables.filter(t => t.id !== aTable.id);
  const bTable = pick(rng, bCandidates);
  const grpB = pickGroupAt(bTable.id);
  if (!grpB) return { gained: null };
  if (grpA.id === grpB.id) return { gained: null };
  // Sizes must match (else capacity might break)
  if (grpA.size !== grpB.size) return { gained: null };

  const before = tableScore(state, aTable.id) + tableScore(state, bTable.id);

  for (const mid of grpA.memberIds) removeGuest(state, mid);
  for (const mid of grpB.memberIds) removeGuest(state, mid);
  for (const mid of grpA.memberIds) placeGuest(state, mid, bTable.id);
  for (const mid of grpB.memberIds) placeGuest(state, mid, aTable.id);
  // group integrity unchanged (whole groups moved)

  const after = tableScore(state, aTable.id) + tableScore(state, bTable.id);
  const gained = after - before;

  return {
    gained,
    commit: () => {},
    rollback: () => {
      for (const mid of grpA.memberIds) removeGuest(state, mid);
      for (const mid of grpB.memberIds) removeGuest(state, mid);
      for (const mid of grpA.memberIds) placeGuest(state, mid, aTable.id);
      for (const mid of grpB.memberIds) placeGuest(state, mid, bTable.id);
    },
  };
}

// ─── Snapshot / restore (cheap clone of byGuest) ──────────────────────────
function snapshotAssignment(state) {
  return new Map(state.byGuest);
}
function restoreAssignment(state, snap) {
  // clear
  for (const set of state.byTable.values()) set.clear();
  state.byGuest = new Map();
  for (const [_, m] of state.groupTables) m.clear();
  for (const [gid, tid] of snap) {
    state.byTable.get(tid).add(gid);
    state.byGuest.set(gid, tid);
    const grp = state.guestToGroup.get(gid);
    const gt = state.groupTables.get(grp);
    gt.set(tid, (gt.get(tid) || 0) + 1);
  }
  initSeparation(state);
}

// ─── Report builder ──────────────────────────────────────────────────────
function buildReport(state, groups, oversized, lockedOverflow, declinedFreed, unassigned, score, options) {
  const totalGroups = state.groups.length;
  const couplePct = totalGroups > 0 ? (1 - state.separatedGroups / totalGroups) * 100 : 100;

  const tables = state.tables.map(t => {
    const seated = state.byTable.get(t.id);
    const cap = state.capByTable.get(t.id);
    const zone = state.zoneByTable.get(t.id);
    let bride = 0, groom = 0, shared = 0;
    let wF = 0, wM = 0;
    for (const gid of seated) {
      const g = state.guestById.get(gid);
      const s = g.side || 'SHARED';
      if (s === 'BRIDE') bride++; else if (s === 'GROOM') groom++; else shared++;
      if (g.gender === 'female') wF += g.conf;
      else if (g.gender === 'male') wM += g.conf;
    }
    return {
      id: t.id,
      name: t.name,
      capacity: cap,
      seated: seated.size,
      zone,
      sideMix: { BRIDE: bride, GROOM: groom, SHARED: shared },
      gender: { female: wF, male: wM },
      score: tableScore(state, t.id),
      virtual: !!t.virtual,
    };
  });

  // Separated groups list
  const separatedList = [];
  for (const grp of groups) {
    if (state._separationByGroup && state._separationByGroup.get(grp.id)) {
      const tables = Array.from(state.groupTables.get(grp.id).entries())
        .map(([tid, count]) => ({ tableId: tid, count }));
      separatedList.push({
        groupId: grp.id,
        memberIds: grp.memberIds.slice(),
        tables,
      });
    }
  }

  // Assignments
  const assignments = [];
  for (const [gid, tid] of state.byGuest) assignments.push({ guestId: gid, tableId: tid });
  // Unassigned guests get null assignment so they're saved correctly
  for (const u of unassigned) assignments.push({ guestId: u.guestId, tableId: null });
  // DECLINED with previous tableId → clear
  for (const did of (options._declinedWithTable || [])) {
    assignments.push({ guestId: did, tableId: null });
  }

  return {
    score: {
      total: score,
      couplesPct: couplePct,
      maxPossible: 100 + state.tables.length * 75, // 40+20+15
    },
    tables,
    separatedGroups: separatedList,
    oversizedGroups: oversized,
    lockedOverflow,
    declinedFreed,
    unassigned,
    assignments,
  };
}

// ─── Pipeline ────────────────────────────────────────────────────────────
function runSeating(input) {
  const { guests, tables, options = {} } = input;
  if (!Array.isArray(guests) || !Array.isArray(tables)) {
    throw new Error('runSeating: guests and tables must be arrays');
  }
  if (tables.length === 0) {
    return {
      score: { total: 0, couplesPct: 100, maxPossible: 0 },
      tables: [],
      separatedGroups: [],
      oversizedGroups: [],
      lockedOverflow: [],
      declinedFreed: [],
      unassigned: guests.filter(g => g.rsvpStatus !== 'DECLINED').map(g => ({ guestId: g.id, reason: 'NO_TABLES' })),
      assignments: [],
    };
  }

  // Clone guests so we don't mutate caller's data
  const guestsClone = guests.map(g => ({ ...g }));
  for (const g of guestsClone) {
    const det = detectGender(g.name);
    g.gender = det.gender;
    g.conf = det.conf;
  }

  // Preflight
  const pf = preflight(guestsClone, tables, options);
  const declinedFreed = pf.declinedWithTable.slice();

  const activeGuests = pf.activeGuests;
  const guestById = new Map(activeGuests.map(g => [g.id, g]));

  // Auto-create virtual tables if capacity insufficient
  const allowCreate = options.allowCreateTables !== false;
  const defaultCap = options.defaultTableSize || DEFAULT_CAPACITY;
  let workingTables = tables.slice();
  let newTables = [];
  if (allowCreate && activeGuests.length > 0) {
    const currentCap = workingTables.reduce((s, t) => s + (t.capacity || defaultCap), 0);
    // Aim for 85% fill (comfort zone) so we don't pack to the brim
    const targetCap = Math.ceil(activeGuests.length / 0.85);
    const deficit = targetCap - currentCap;
    if (deficit > 0) {
      const needed = Math.ceil(deficit / defaultCap);
      const baseNum = workingTables.length;
      for (let i = 0; i < needed; i++) {
        const t = {
          id: -(i + 1), // temp id (negative)
          name: `Стол ${baseNum + i + 1}`,
          capacity: defaultCap,
          virtual: true,
        };
        workingTables.push(t);
        newTables.push({ tempId: t.id, name: t.name, capacity: t.capacity });
      }
    }
  }

  // Groups
  const { groups } = buildGroups(activeGuests);
  annotateGroups(groups, guestById, pf.hardReset);

  // Preflight warnings
  const oversizedGroups = findOversizedGroups(groups, workingTables);
  const lockedOverflow = findLockedOverflow(workingTables, guestById, groups);

  // Zoning
  const zoneByTable = planZones(workingTables, groups, guestById);

  // Build state with locked already placed
  const state = buildState(workingTables, groups, guestById, zoneByTable);

  // Multi-restart SA
  const N = activeGuests.length;
  const iterations = Math.min(30000, Math.max(5000, Math.floor(N * Math.log2(Math.max(2, N)) * 30)));
  const restarts = (options.restarts != null) ? options.restarts : 3;
  const seed = options.seed != null ? options.seed : (Date.now() & 0xFFFFFFFF);

  let bestSnapshot = null;
  let bestScore = -Infinity;
  let bestUnassigned = [];

  for (let r = 0; r < restarts; r++) {
    const rng = makeRng(seed + r * 7919);
    // Reset state for run
    if (r > 0) {
      // Clear non-locked assignments
      for (const grp of groups) {
        if (grp.locked) continue;
        for (const mid of grp.memberIds) {
          if (state.byGuest.has(mid)) {
            const tid = state.byGuest.get(mid);
            state.byTable.get(tid).delete(mid);
            state.byGuest.delete(mid);
            const gt = state.groupTables.get(grp.id);
            const c = (gt.get(tid) || 0) - 1;
            if (c <= 0) gt.delete(tid); else gt.set(tid, c);
          }
        }
      }
    }
    const unassigned = greedyInit(state, groups, rng);

    const progressBase = r / restarts;
    const progressSlice = 1 / restarts;
    const onProgress = options.onProgress
      ? (frac) => options.onProgress(progressBase + frac * progressSlice)
      : null;

    simulatedAnnealing(state, groups, rng, iterations, onProgress);
    const sc = globalScore(state);
    if (sc > bestScore) {
      bestScore = sc;
      bestSnapshot = snapshotAssignment(state);
      bestUnassigned = unassigned.slice();
    }
  }

  if (bestSnapshot) restoreAssignment(state, bestSnapshot);

  // Tag declined for assignment clearing
  const report = buildReport(
    state, groups,
    oversizedGroups,
    lockedOverflow,
    declinedFreed,
    bestUnassigned,
    bestScore,
    { _declinedWithTable: declinedFreed },
  );
  report.newTables = newTables;
  report.meta = {
    iterations,
    restarts,
    seed,
    activeGuestCount: activeGuests.length,
    declinedCount: guests.length - activeGuests.length - (options.includePending === false ? guests.filter(g => (g.rsvpStatus == null || g.rsvpStatus === 'PENDING') && g.rsvpStatus !== 'DECLINED').length : 0),
    options: { includePending: options.includePending !== false, hardReset: !!options.hardReset, allowCreateTables: allowCreate },
  };
  return report;
}

// ─── Exports ─────────────────────────────────────────────────────────────
if (typeof self !== 'undefined') {
  self.SeatingAlgo = { runSeating, detectGender, buildGroups };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runSeating, detectGender, buildGroups };
}
