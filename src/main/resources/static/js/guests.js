// ─── State ────────────────────────────────────────────────────────────────────
const BASE_URL = '';
let eventId   = null;
let eventData = null;
let phone     = null;
let allGuests = [];
let allTables = [];
let _wired    = false;
const EVENTS_CACHE_KEY = 'tl:events:list';
const STATS_CACHE_KEY  = 'tl:events:stats';
const state = {
  filter: 'all',     // all | attending | declined | noReply
  group: 'all',      // 'all' | <groupCode> | '__empty__'
  search: '',
  tab: 'guests',     // guests | tables
};

// ─── Session cache ───────────────────────────────────────────────────────────
function cacheSet(key, data) {
  const payload = JSON.stringify({ data, at: Date.now() });
  try {
    sessionStorage.setItem(key, payload);
  } catch (_) {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('tl:') && k !== key) sessionStorage.removeItem(k);
      }
      sessionStorage.setItem(key, payload);
    } catch (_) {}
  }
}
function cacheGet(key, maxAge = 60_000) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key));
    if (!v || Date.now() - v.at > maxAge) return null;
    return v.data;
  } catch { return null; }
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, success = true) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('error', !success);
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPubliclyVisibleEvent(event) {
  return event?.status === 'PUBLISHED' || event?.status === 'CLOSED';
}

function buildEventUrl(event, guestToken = null) {
  if (!event?.slug) return null;
  const url = new URL(`/e/${event.slug}`, location.origin);
  if (guestToken) url.searchParams.set('token', guestToken);
  if (!isPubliclyVisibleEvent(event) && event.previewToken) {
    url.searchParams.set('preview', event.previewToken);
  }
  return url.toString();
}

function guestSource(guest) {
  return guest?.source || (guest?.token ? 'PERSONAL_LINK' : 'PUBLIC_LINK');
}

function hasPersonalLink(guest) {
  return guestSource(guest) === 'PERSONAL_LINK' && !!guest?.token;
}

function guestLink(guest) {
  if (!eventData?.slug || !hasPersonalLink(guest)) return null;
  return buildEventUrl(eventData, guest.token);
}

function pluralize(n, forms) {
  const m = Math.abs(n) % 100;
  const m1 = m % 10;
  if (m > 10 && m < 20) return forms[2];
  if (m1 > 1 && m1 < 5) return forms[1];
  if (m1 === 1) return forms[0];
  return forms[2];
}

function avatarPalette(name) {
  const palettes = [
    { bg: '#FFF0F5', fg: '#C71F5C' },
    { bg: '#FFE6DD', fg: '#B94A2B' },
    { bg: '#C2E0C6', fg: '#1A3D20' },
    { bg: '#FFF0DD', fg: '#7C5520' },
    { bg: '#F3E7F0', fg: '#70345A' },
  ];
  return palettes[(name.charCodeAt(0) || 0) % palettes.length];
}

function chipFor(status) {
  switch (status) {
    case 'ATTENDING':
      return `<span class="chip-sm" style="background:#C2E0C6; color:#1A3D20;"><span class="chip-dot" style="background:#1A3D20;"></span>Придёт</span>`;
    case 'DECLINED':
      return `<span class="chip-sm" style="background:#FFE0EC; color:#C71F5C;"><span class="chip-dot" style="background:#C71F5C;"></span>Не придёт</span>`;
    case 'MAYBE':
      return `<span class="chip-sm" style="background:#E6D5B8; color:#7C5520;"><span class="chip-dot" style="background:#7C5520;"></span>Возможно</span>`;
    default:
      return `<span class="chip-sm" style="background:#FFF0F5; color:#9B4060;"><span class="chip-dot" style="background:#F93B7A;"></span>Ждём</span>`;
  }
}

// Static color palette by index — keeps chip colors stable per group.
const GROUP_CHIP_PALETTES = [
  { bg: '#E8EEFF', fg: '#2F4DAF' },
  { bg: '#FFE8F5', fg: '#C71F5C' },
  { bg: '#E6F4EA', fg: '#1A6E3A' },
  { bg: '#FFF1E0', fg: '#8A4A20' },
  { bg: '#F3E7F0', fg: '#70345A' },
];

function getGuestGroupsArr(event) {
  if (!event?.guestGroups) return [];
  if (Array.isArray(event.guestGroups)) return event.guestGroups;
  try {
    const parsed = JSON.parse(event.guestGroups);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function findGroupByCode(code) {
  const groups = getGuestGroupsArr(eventData);
  return groups.find(g => g && g.code === code) || null;
}

function sideChip(side) {
  if (!side) return '';
  // Legacy values (GROOM/BRIDE/SHARED/OTHER) — backward compat for old guests.
  const legacy = { GROOM: 'Жених', BRIDE: 'Невеста' };
  let label = legacy[side];
  let idx = side === 'GROOM' ? 0 : side === 'BRIDE' ? 1 : null;
  if (!label) {
    const group = findGroupByCode(side);
    if (!group) return '';
    label = group.label || group.code;
    const groups = getGuestGroupsArr(eventData);
    idx = groups.findIndex(g => g.code === side);
  }
  const palette = GROUP_CHIP_PALETTES[(idx ?? 0) % GROUP_CHIP_PALETTES.length];
  return `<span class="chip-sm" style="background:${palette.bg}; color:${palette.fg}; font-size:10px;">${escapeHtml(label)}</span>`;
}

function relationLabel(g) {
  if (!g.relatedToId || !g.relatedToName) return '';
  const typeMap = {
    SPOUSE: 'супруг/а', FAMILY: 'семья', CHILD: 'ребёнок',
    FRIEND: 'друг/подруга', COMPANION: 'сопровождающий', OTHER: 'с',
  };
  const t = typeMap[g.relationType] || 'с';
  return `${t}: ${escapeHtml(g.relatedToName)}`;
}

// ─── Stats & filtering ────────────────────────────────────────────────────────
function computeStats(guests) {
  const total = guests.length;
  let attending = 0, declined = 0, maybe = 0;
  for (const g of guests) {
    if (g.rsvpStatus === 'ATTENDING') attending++;
    else if (g.rsvpStatus === 'DECLINED') declined++;
    else if (g.rsvpStatus === 'MAYBE') maybe++;
  }
  const noReply = total - attending - declined - maybe;
  return { total, attending, declined, maybe, noReply };
}

function cacheStatsForEvent(id, stats) {
  if (!id || !stats) return;
  const normalized = {
    total: stats.total || 0,
    attending: stats.attending || 0,
    declined: stats.declined || 0,
    maybe: stats.maybe || 0,
  };
  cacheSet(`tl:event:stats:${id}`, normalized);
  const map = cacheGet(STATS_CACHE_KEY, 10 * 60_000) || {};
  map[id] = normalized;
  cacheSet(STATS_CACHE_KEY, map);
}

function syncCachedEventList(event) {
  if (!event?.id) return;
  const existing = cacheGet(EVENTS_CACHE_KEY, 10 * 60_000);
  if (!Array.isArray(existing) || existing.length === 0) return;
  cacheSet(EVENTS_CACHE_KEY, existing.map(item => item.id === event.id ? { ...item, ...event } : item));
}

function syncAllCaches() {
  if (!eventId) return;
  if (eventData) {
    cacheSet(`tl:event:${eventId}`, eventData);
    syncCachedEventList(eventData);
  }
  cacheSet(`tl:guests:${eventId}`, allGuests);
  cacheSet(`tl:tables:${eventId}`, allTables);
  cacheStatsForEvent(eventId, computeStats(allGuests));
}

function warmRelatedPages() {
  window.ToiAppShell?.prefetchPage('/');
  if (eventId) window.ToiAppShell?.prefetchPage(`/editor.html?id=${eventId}`);
}

const FILTERS = {
  all:       { label: 'Все гости',   match: () => true },
  attending: { label: 'Придут',      match: g => g.rsvpStatus === 'ATTENDING' },
  declined:  { label: 'Не придут',   match: g => g.rsvpStatus === 'DECLINED' },
  noReply:   { label: 'Без ответа',  match: g => !g.rsvpStatus },
};

function matchesGroupFilter(guest, groupCode) {
  if (!groupCode || groupCode === 'all') return true;
  const side = guest.side || '';
  if (groupCode === '__empty__') {
    return !side || side === 'SHARED' || side === 'OTHER';
  }
  // Direct match on stored code
  if (side === groupCode) return true;
  // Legacy enum back-compat for wedding guests created before generic groupCode
  if (groupCode === 'groom' && side === 'GROOM') return true;
  if (groupCode === 'bride' && side === 'BRIDE') return true;
  return false;
}

function applyFilters() {
  const f = FILTERS[state.filter] || FILTERS.all;
  const q = state.search.trim().toLowerCase();
  return allGuests.filter(g => {
    if (!f.match(g)) return false;
    if (!matchesGroupFilter(g, state.group)) return false;
    if (!q) return true;
    const hay = `${g.name || ''} ${g.phone || ''} ${g.notes || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderStats() {
  const s = computeStats(allGuests);
  const active = state.filter;

  const cards = [
    { key: 'all',       cls: '',             lbl: 'Приглашено', num: s.total },
    { key: 'attending', cls: 'accent-mint',  lbl: 'Придут',     num: s.attending },
    { key: 'declined',  cls: 'accent-rose',  lbl: 'Не придут',  num: s.declined },
    { key: 'noReply',   cls: 'accent-gold',  lbl: 'Без ответа', num: s.noReply },
  ];

  document.getElementById('stats').innerHTML = cards.map(c => `
    <button type="button"
            data-filter="${c.key}"
            class="stat-card ${c.cls} ${active === c.key ? 'active' : ''} fade-in">
      <span class="lbl">${c.lbl}</span>
      <span class="num">${c.num}</span>
    </button>`).join('');

  renderGroupStats();
  renderGroupFilterChips();
  observeFadeIn();
}

function renderGroupFilterChips() {
  const host = document.getElementById('group-filter-chips');
  if (!host) return;
  const groups = getGuestGroupsArr(eventData);
  if (groups.length === 0) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }

  // Count guests without any group — only show "Без группы" chip if there are such guests
  const emptyCount = allGuests.filter(g => matchesGroupFilter(g, '__empty__')).length;

  const chips = [
    { code: 'all', label: 'Все группы', count: allGuests.length },
    ...groups.filter(g => g && g.code).map(g => ({
      code: g.code,
      label: g.label || g.code,
      count: allGuests.filter(x => matchesGroupFilter(x, g.code)).length,
    })),
    ...(emptyCount > 0 ? [{ code: '__empty__', label: 'Без группы', count: emptyCount }] : []),
  ];

  host.classList.remove('hidden');
  host.innerHTML = chips.map(c => `
    <button type="button" data-group="${escapeHtml(c.code)}"
            class="group-chip whitespace-nowrap px-3 py-1.5 rounded-full border text-[12.5px] transition-colors ${
              state.group === c.code
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-ink border-line hover:border-ink'
            }">
      ${escapeHtml(c.label)}<span class="ml-1 opacity-60">${c.count}</span>
    </button>
  `).join('');

  host.querySelectorAll('[data-group]').forEach(btn => {
    btn.addEventListener('click', () => setGroupFilter(btn.dataset.group));
  });
}

function setGroupFilter(code) {
  state.group = (state.group === code && code !== 'all') ? 'all' : code;
  renderGroupFilterChips();
  renderList();
}

// Per-group counters: rendered only when event has guestGroups defined.
function renderGroupStats() {
  const host = document.getElementById('group-stats');
  if (!host) return;
  const groups = getGuestGroupsArr(eventData);
  if (groups.length === 0) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }

  // Always show "Без группы" as a trailing bucket for guests with empty side
  const rows = [
    ...groups.filter(g => g && g.code).map((g, i) => ({
      code: g.code,
      label: g.label || g.code,
      palette: GROUP_CHIP_PALETTES[i % GROUP_CHIP_PALETTES.length],
    })),
    { code: '__empty__', label: 'Без группы', palette: { bg: '#F0EBE3', fg: '#6B6056' } },
  ];

  // Single pass over guests — O(n) instead of O(n×m)
  const emptyCounter = () => ({ attending: 0, declined: 0, maybe: 0, noReply: 0, total: 0 });
  const buckets = new Map(rows.map(r => [r.code, emptyCounter()]));
  const legacyMap = { GROOM: 'groom', BRIDE: 'bride' };

  for (const g of allGuests) {
    const side = g.side || '';
    const isEmpty = !side || side === 'SHARED' || side === 'OTHER';
    const code = isEmpty ? '__empty__' : (legacyMap[side] || side);
    const bucket = buckets.get(code);
    if (!bucket) continue;
    bucket.total++;
    if (g.rsvpStatus === 'ATTENDING') bucket.attending++;
    else if (g.rsvpStatus === 'DECLINED') bucket.declined++;
    else if (g.rsvpStatus === 'MAYBE') bucket.maybe++;
    else bucket.noReply++;
  }

  const counters = rows.map(row => ({ ...row, ...buckets.get(row.code) }));

  // Hide entirely if all rows are empty (event has groups defined but no matching guests yet).
  if (counters.every(c => c.total === 0)) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }

  host.classList.remove('hidden');
  host.innerHTML = `
    <div class="rounded-2xl border border-line bg-paper p-4 md:p-5">
      <div class="flex items-baseline justify-between mb-3">
        <div class="font-cormorant italic text-[20px] md:text-[22px] font-semibold text-ink">По группам</div>
        <div class="text-[11px] text-muted">Распределение гостей</div>
      </div>
      <div class="flex flex-col gap-2">
        ${counters.filter(c => c.total > 0 || c.code !== '__empty__').map(c => `
          <div class="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-white border border-line">
            <div class="flex items-center gap-2 min-w-0">
              <span class="chip-sm" style="background:${c.palette.bg}; color:${c.palette.fg};">${escapeHtml(c.label)}</span>
              <span class="text-[12px] text-muted">всего ${c.total}</span>
            </div>
            <div class="flex items-center gap-3 text-[12px] whitespace-nowrap">
              <span style="color:#1A6E3A;">✓ ${c.attending}</span>
              <span style="color:#C71F5C;">✕ ${c.declined}</span>
              <span style="color:#7C5520;">? ${c.noReply + c.maybe}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setFilter(key) {
  state.filter = (state.filter === key && key !== 'all') ? 'all' : key;
  renderStats();
  syncToolbar();
  renderList();
}

function syncToolbar() {
  const toolbar = document.getElementById('toolbar');
  const fc = document.getElementById('filter-clear');
  const fcl = document.getElementById('filter-clear-label');
  const searchClear = document.getElementById('search-clear');

  toolbar.classList.remove('hidden');

  if (state.filter !== 'all') {
    fc.classList.remove('hidden');
    fcl.textContent = FILTERS[state.filter].label;
  } else {
    fc.classList.add('hidden');
  }

  if (state.search) searchClear.classList.remove('hidden');
  else searchClear.classList.add('hidden');
}

// ─── Guest row ────────────────────────────────────────────────────────────────
function tableChip(tableId) {
  if (!tableId) return '';
  const t = allTables.find(x => x.id === tableId);
  if (!t) return '';
  return `<span class="chip-sm" style="background:#EEF2FF; color:#4F46E5; font-size:10px;">${escapeHtml(t.name)}</span>`;
}

function guestRow(g) {
  const name    = g.name || 'Аноним';
  const initial = name[0].toUpperCase();
  const p       = avatarPalette(name);
  const chip    = chipFor(g.rsvpStatus);
  const side    = sideChip(g.side);
  const rel     = relationLabel(g);

  const sub = rel
    ? `<span style="font-size:11.5px; color:#9B8B7A;">${rel}</span>`
    : (g.notes
      ? `<span class="italic-notes">«${escapeHtml(g.notes)}»</span>`
      : (g.phone ? escapeHtml(g.phone) : '<span style="font-family:Cormorant Garamond,serif; font-style:italic; font-size:13px;">Без телефона</span>'));

  const copyBtn = hasPersonalLink(g) ? `
    <button class="row-icon-btn copy" data-action="copy" data-guest-id="${g.id}" title="Скопировать ссылку" aria-label="Скопировать">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
    </button>` : '';

  return `
    <div id="gc-${g.id}" class="guest-row fade-in" data-guest-id="${g.id}" data-rsvp="${g.rsvpStatus || ''}">
      <div class="avatar flex-shrink-0"
           style="width:40px; height:40px; border-radius:12px; background:${p.bg}; color:${p.fg}; font-size:18px;">
        ${initial}
      </div>
      <div class="guest-row-main">
        <div class="guest-row-top">
          <span class="guest-row-name">${escapeHtml(name)}</span>
          ${chip}
          ${side}
          ${tableChip(g.tableId)}
        </div>
        <div class="guest-row-sub">${sub}</div>
      </div>
      <div class="guest-row-actions">
        ${copyBtn}
        <button class="row-icon-btn" data-action="menu" data-guest-id="${g.id}" title="Действия" aria-label="Действия">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
        </button>
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─── List render ──────────────────────────────────────────────────────────────
function renderEmpty() {
  document.getElementById('listHeading')?.classList.add('hidden');
  document.getElementById('toolbar')?.classList.add('hidden');
  document.getElementById('guest-list').innerHTML = `
    <div class="flex flex-col items-center justify-center text-center py-14 md:py-20 px-6 fade-in">
      <div class="relative mb-6">
        <div class="w-24 h-24 md:w-28 md:h-28 rounded-[28px] flex items-center justify-center"
             style="background: linear-gradient(135deg, #F93B7A 0%, #FF6D45 100%); box-shadow:0 14px 36px rgba(249,59,122,.22);">
          <svg class="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <div class="absolute -top-3 -right-3 w-11 h-11 rounded-2xl bg-white border border-line flex items-center justify-center" style="box-shadow:0 6px 18px rgba(30,40,32,.08);">
          <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </div>
      </div>
      <div class="text-[10px] tracking-[0.3em] uppercase text-muted font-medium mb-3">Начните список</div>
      <h2 class="font-cormorant text-[30px] md:text-[40px] italic font-semibold text-ink leading-tight mb-3">
        Добавьте <em class="text-accent">первого гостя</em>
      </h2>
      <p class="text-muted text-[14px] md:text-[15px] max-w-[320px] leading-relaxed mb-7">
        Для персональных гостей можно копировать отдельную ссылку, а остальные смогут ответить по общей ссылке события.
      </p>
      <button onclick="openAddSheet()" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        Добавить гостя
      </button>
    </div>`;
  observeFadeIn();
}

function renderList() {
  const container = document.getElementById('guest-list');
  const heading   = document.getElementById('listHeading');
  const title     = document.getElementById('listTitle');
  const countLbl  = document.getElementById('guestCountLabel');

  if (allGuests.length === 0) {
    renderEmpty();
    return;
  }

  const filtered = applyFilters();

  heading?.classList.remove('hidden');
  if (title) title.textContent = FILTERS[state.filter].label;
  if (countLbl) countLbl.textContent = `${filtered.length} ${pluralize(filtered.length, ['гость','гостя','гостей'])}`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-filter fade-in">
        <svg class="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <p class="font-cormorant italic text-[20px] text-ink mb-1">Ничего не найдено</p>
        <p class="text-[13px] text-muted">
          ${state.search
            ? `По запросу «${escapeHtml(state.search)}» — пусто`
            : `В категории «${FILTERS[state.filter].label}» пока никого`}
        </p>
      </div>`;
    observeFadeIn();
    return;
  }

  container.innerHTML = `<div class="space-y-2">${filtered.map(guestRow).join('')}</div>`;
  observeFadeIn();
}

function observeFadeIn() {
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => el.classList.add('visible'));
  window.ToiAppShell?.scheduleSnapshotCapture?.();
}

// ─── Actions bottom sheet ────────────────────────────────────────────────────
function openActionsSheet(g) {
  document.getElementById('actionsBackdrop')?.remove();
  document.getElementById('actionsSheet')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'actionsBackdrop';
  backdrop.className = 'bs-backdrop';

  const sheet = document.createElement('div');
  sheet.id = 'actionsSheet';
  sheet.className = 'bs-sheet';

  const name = g.name || 'Аноним';
  const p = avatarPalette(name);
  const chip = chipFor(g.rsvpStatus);
  const link = guestLink(g);
  const phoneClean = (g.phone || '').replace(/\D/g, '');

  const waUrl = link ? (phoneClean
    ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Дорогой(ая) ${name}, приглашаем вас на ${eventData?.title || 'приглашение'}!\n\n${link}`)}`
    : `https://wa.me/?text=${encodeURIComponent(`Дорогой(ая) ${name}, приглашаем вас на ${eventData?.title || 'приглашение'}!\n\n${link}`)}`) : null;

  const viewUrl = buildEventUrl(eventData, hasPersonalLink(g) ? g.token : null) || '#';

  sheet.innerHTML = `
    <div class="sheet-inner">
      <div class="drag-pill"></div>
      <div class="px-5 md:px-0 pt-2 md:pt-0">
        <div class="flex items-center gap-3 mb-4 pb-4" style="border-bottom: 1px solid #F0EDE8;">
          <div class="avatar flex-shrink-0"
               style="width:48px; height:48px; border-radius:14px; background:${p.bg}; color:${p.fg}; font-size:22px;">
            ${name[0].toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-cormorant italic text-[22px] font-semibold text-ink leading-tight truncate">${escapeHtml(name)}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              ${chip}
              ${g.phone ? `<span class="text-[12px] text-muted">${escapeHtml(g.phone)}</span>` : ''}
            </div>
            ${g.notes ? `<p class="text-[12.5px] text-muted font-cormorant italic mt-1.5 line-clamp-2">«${escapeHtml(g.notes)}»</p>` : ''}
          </div>
        </div>

        <div class="flex flex-col">
          ${link ? `
            <button class="action-row" data-act="copy">
              <div class="action-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              </div>
              <div class="action-main">
                <div class="action-title">Скопировать ссылку</div>
                <div class="action-sub">Отправить в любой мессенджер</div>
              </div>
            </button>` : ''}

          ${waUrl ? `
            <a class="action-row" href="${waUrl}" target="_blank" rel="noopener" data-act="wa">
              <div class="action-icon" style="background: rgba(37,211,102,.10); color:#128C7E;">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div class="action-main">
                <div class="action-title">Отправить в WhatsApp</div>
                <div class="action-sub">${phoneClean ? 'Напрямую гостю' : 'Выбрать контакт'}</div>
              </div>
            </a>` : ''}

          <a class="action-row" href="${viewUrl}" target="_blank" rel="noopener" data-act="view">
            <div class="action-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </div>
            <div class="action-main">
              <div class="action-title">Открыть приглашение</div>
              <div class="action-sub">Как увидит гость</div>
            </div>
          </a>

          <button class="action-row" data-act="edit">
            <div class="action-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </div>
            <div class="action-main">
              <div class="action-title">Редактировать</div>
              <div class="action-sub">Имя, телефон, сторона, связь</div>
            </div>
          </button>

          <div class="action-divider"></div>

          <button class="action-row danger" data-act="delete">
            <div class="action-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a2 2 0 012-2h4a2 2 0 012 2v3"/></svg>
            </div>
            <div class="action-main">
              <div class="action-title">Удалить гостя</div>
              <div class="action-sub">Ссылка перестанет работать</div>
            </div>
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  function close() {
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 400);
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }

  backdrop.onclick = close;
  document.addEventListener('keydown', onEsc);

  let startY = 0;
  sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    if (dy > 60) close();
  }, { passive: true });

  // action handlers
  sheet.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('click', async (ev) => {
      const act = el.getAttribute('data-act');
      if (act === 'copy') {
        ev.preventDefault();
        const url = guestLink(g);
        if (!url) return;
        try {
          await navigator.clipboard.writeText(url);
          toast('Ссылка скопирована');
        } catch {
          prompt('Ссылка гостя:', url);
        }
        close();
      } else if (act === 'edit') {
        ev.preventDefault();
        close();
        setTimeout(() => openEditSheet(g), 260);
      } else if (act === 'delete') {
        ev.preventDefault();
        close();
        setTimeout(() => confirmDelete(g.id), 260);
      }
      // wa/view: native link — just close after
      else setTimeout(close, 100);
    });
  });

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  });
}

// ─── Confirm delete sheet ─────────────────────────────────────────────────────
function confirmDelete(guestId) {
  const g = allGuests.find(x => x.id === guestId);
  if (!g) return;

  document.getElementById('confirmBackdrop')?.remove();
  document.getElementById('confirmSheet')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'confirmBackdrop';
  backdrop.className = 'bs-backdrop';

  const sheet = document.createElement('div');
  sheet.id = 'confirmSheet';
  sheet.className = 'bs-sheet';

  sheet.innerHTML = `
    <div class="sheet-inner">
      <div class="drag-pill"></div>
      <div class="px-5 md:px-0 pt-3 md:pt-0 text-center">
        <div class="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style="background: rgba(184,65,46,.08); color:#B8412E;">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h2 class="font-cormorant italic text-[24px] md:text-[28px] font-semibold text-ink mb-2">Удалить гостя?</h2>
        <p class="text-[14px] text-muted leading-relaxed mb-5 max-w-[320px] mx-auto">
          <strong class="text-ink">${escapeHtml(g.name || 'Аноним')}</strong> исчезнет из&nbsp;списка.
          ${hasPersonalLink(g) ? 'Персональная ссылка перестанет работать.' : ''}
        </p>
        <div class="flex flex-col gap-2">
          <button id="confirm-delete-btn" class="btn-primary w-full" style="background:#B8412E;">
            Да, удалить
          </button>
          <button id="confirm-cancel-btn" class="btn-ghost w-full">
            Отмена
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  function close() {
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 400);
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }

  backdrop.onclick = close;
  document.addEventListener('keydown', onEsc);
  sheet.querySelector('#confirm-cancel-btn').addEventListener('click', close);

  sheet.querySelector('#confirm-delete-btn').addEventListener('click', async () => {
    const btn = sheet.querySelector('#confirm-delete-btn');
    btn.disabled = true;
    btn.textContent = 'Удаление...';
    try {
      await api('DELETE', `/api/organizer/events/${eventId}/guests/${guestId}`);
      allGuests = allGuests.filter(x => x.id !== guestId);
      syncAllCaches();
      renderStats();
      renderList();
      toast('Гость удалён');
      close();
    } catch (err) {
      toast(err.message || 'Не удалось удалить', false);
      btn.disabled = false;
      btn.textContent = 'Да, удалить';
    }
  });

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  });
}

// ─── Edit guest bottom sheet ──────────────────────────────────────────────────
function openEditSheet(g) {
  document.getElementById('editBackdrop')?.remove();
  document.getElementById('editSheet')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'editBackdrop';
  backdrop.className = 'bs-backdrop';

  const sheet = document.createElement('div');
  sheet.id = 'editSheet';
  sheet.className = 'bs-sheet';

  const currentSide   = g.side || 'SHARED';
  const currentStatus = g.rsvpStatus || '';
  const SIDES    = [['GROOM', 'Жених'], ['BRIDE', 'Невеста'], ['SHARED', 'Общий']];
  const STATUSES = [['', 'Ждём'], ['ATTENDING', 'Придёт'], ['DECLINED', 'Не придёт']];

  sheet.innerHTML = `
    <div class="sheet-inner" style="overflow-y:auto;">
      <div class="drag-pill"></div>
      <div class="px-6 md:px-0 pt-3 md:pt-0">
        <div class="text-center mb-6">
          <div class="text-[10px] tracking-[0.3em] uppercase text-muted font-medium mb-2">Редактировать</div>
          <h2 class="font-cormorant text-[28px] md:text-[32px] italic font-semibold text-ink">${escapeHtml(g.name || 'Гость')}</h2>
        </div>
        <form id="edit-form" class="flex flex-col gap-3">
          <div class="input-wrap">
            <input id="edit-name" type="text" value="${escapeHtml(g.name || '')}" placeholder="Имя" class="field" required/>
            <label class="lbl">Имя гостя</label>
          </div>
          <div class="input-wrap">
            <input id="edit-phone" type="tel" value="${escapeHtml(g.phone || '')}" placeholder="Телефон" class="field"/>
            <label class="lbl">Телефон (для WhatsApp)</label>
          </div>
          <div class="input-wrap">
            <input id="edit-notes" type="text" value="${escapeHtml(g.notes || '')}" placeholder="Заметка" class="field"/>
            <label class="lbl">Заметка</label>
          </div>
          <div>
            <div class="field-section-label">Сторона</div>
            <div class="seg-control" id="edit-side-control">
              ${SIDES.map(([v, l]) => `<button type="button" class="seg-btn${currentSide === v ? ' active' : ''}" data-side="${v}">${l}</button>`).join('')}
            </div>
            <input type="hidden" id="edit-side" value="${currentSide}"/>
          </div>
          <div>
            <div class="field-section-label">Статус</div>
            <div class="seg-control" id="edit-status-control">
              ${STATUSES.map(([v, l]) => `<button type="button" class="seg-btn${currentStatus === v ? ' active' : ''}" data-status="${v}">${l}</button>`).join('')}
            </div>
            <input type="hidden" id="edit-status" value="${currentStatus}"/>
          </div>
          ${allTables.length > 0 ? `
          <div>
            <div class="field-section-label">Стол</div>
            <select id="edit-table" class="select-field">
              <option value="">— Не назначен —</option>
              ${allTables.map(t => `<option value="${t.id}"${g.tableId === t.id ? ' selected' : ''}>${escapeHtml(t.name)}${t.capacity ? ` (до ${t.capacity})` : ''}</option>`).join('')}
            </select>
          </div>` : ''}
          <button type="submit" id="editSubmitBtn" class="btn-primary w-full mt-2">Сохранить</button>
        </form>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  function close() {
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 400);
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }
  backdrop.onclick = close;
  document.addEventListener('keydown', onEsc);

  sheet.querySelectorAll('#edit-side-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('#edit-side-control .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sheet.querySelector('#edit-side').value = btn.dataset.side;
    });
  });

  sheet.querySelectorAll('#edit-status-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('#edit-status-control .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sheet.querySelector('#edit-status').value = btn.dataset.status;
    });
  });

  let startY = 0;
  sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (e.touches[0].clientY - startY > 60) close();
  }, { passive: true });

  sheet.querySelector('#edit-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = sheet.querySelector('#editSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Сохраняем...';

    const statusRaw = sheet.querySelector('#edit-status').value;
    const tableSelect = sheet.querySelector('#edit-table');
    const newTableId = tableSelect?.value ? parseInt(tableSelect.value) : null;

    try {
      const updated = await api('PUT', `/api/organizer/events/${eventId}/guests/${g.id}`, {
        name:        sheet.querySelector('#edit-name').value.trim(),
        phone:       sheet.querySelector('#edit-phone').value.trim() || null,
        notes:       sheet.querySelector('#edit-notes').value.trim() || null,
        side:        sheet.querySelector('#edit-side').value || 'SHARED',
        // preserve existing relation — don't clear it from the edit form
        relatedToId: g.relatedToId ?? null,
        relationType: g.relationType ?? null,
        rsvpStatus:  statusRaw === '' ? 'NONE' : statusRaw,
        tableId:     newTableId,
      });
      // update local table counts if table assignment changed
      if (g.tableId !== newTableId) {
        allTables = allTables.map(t => {
          if (t.id === g.tableId) return { ...t, guestCount: Math.max(0, (t.guestCount || 1) - 1) };
          if (t.id === newTableId) return { ...t, guestCount: (t.guestCount || 0) + 1 };
          return t;
        });
      }
      allGuests = allGuests.map(x => x.id === g.id ? updated : x);
      window._allGuestsRef = allGuests;
      syncAllCaches();
      renderStats();
      renderList();
      if (state.tab === 'tables') renderTables();
      toast('Изменения сохранены');
      close();
    } catch (err) {
      toast(err.message || 'Ошибка', false);
      btn.disabled = false;
      btn.textContent = 'Сохранить';
    }
  });

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  });
}

// ─── Event delegation (row clicks) ────────────────────────────────────────────
function wireListDelegation() {
  document.getElementById('guest-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const gid = parseInt(btn.getAttribute('data-guest-id'));
      const g = allGuests.find(x => x.id === gid);
      if (!g) return;
      const act = btn.getAttribute('data-action');
      if (act === 'copy') {
        e.stopPropagation();
        const url = guestLink(g);
        if (!url) { toast('Нет ссылки', false); return; }
        navigator.clipboard.writeText(url)
          .then(() => toast('Ссылка скопирована'))
          .catch(() => prompt('Ссылка:', url));
      } else if (act === 'menu') {
        e.stopPropagation();
        openActionsSheet(g);
      }
      return;
    }
    // tap on row body → open actions
    const row = e.target.closest('.guest-row');
    if (row) {
      const gid = parseInt(row.getAttribute('data-guest-id'));
      const g = allGuests.find(x => x.id === gid);
      if (g) openActionsSheet(g);
    }
  });
}

function wireStatsDelegation() {
  document.getElementById('stats').addEventListener('click', (e) => {
    const card = e.target.closest('[data-filter]');
    if (!card) return;
    setFilter(card.getAttribute('data-filter'));
  });
}

function wireToolbar() {
  const input = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const filterClear = document.getElementById('filter-clear');

  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.search = input.value;
      syncToolbar();
      renderList();
    }, 120);
  });

  searchClear.addEventListener('click', () => {
    input.value = '';
    state.search = '';
    syncToolbar();
    renderList();
    input.focus();
  });

  filterClear.addEventListener('click', () => {
    setFilter('all');
  });
}

// ─── Add guest submit ─────────────────────────────────────────────────────────
window.submitAddGuest = async function (e) {
  e.preventDefault();
  const name         = document.getElementById('add-name').value.trim();
  const phone_       = document.getElementById('add-phone').value.trim();
  const notes        = document.getElementById('add-notes').value.trim();
  const side         = document.getElementById('add-side').value || 'SHARED';
  const rsvpStatus   = document.getElementById('add-status').value || null;
  const withCompanion = document.getElementById('add-companion-check').checked;
  const companionName = withCompanion ? document.getElementById('add-companion-name').value.trim() : null;

  if (!name) { document.getElementById('add-name').focus(); return; }
  if (withCompanion && !companionName) { document.getElementById('add-companion-name').focus(); return; }

  const btn = document.getElementById('addSubmitBtn');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 018-8V2.5M20 12a8 8 0 01-8 8v1.5"/></svg> Добавляем...';

  try {
    await api('POST', `/api/organizer/events/${eventId}/guests`, {
      name, phone: phone_ || null, notes: notes || null,
      side, rsvpStatus, companionName, personalInvite: true,
    });

    closeAddSheet();

    // Fetch guests only — companion appears server-side, event/tables unchanged
    allGuests = await api('GET', `/api/organizer/events/${eventId}/guests`);
    window._allGuestsRef = allGuests;
    cacheSet(`tl:guests:${eventId}`, allGuests);
    cacheStatsForEvent(eventId, computeStats(allGuests));
    renderAll();

    toast(companionName ? 'Добавлено 2 гостя' : 'Гость добавлен');
  } catch (err) {
    toast(err.message || 'Ошибка', false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
};

const PLAN_RANK_G = ['FREE', 'LINK', 'TOI_PRO'];
const PLAN_LABEL_G = { FREE: 'Старт', LINK: 'Той', TOI_PRO: 'Toi Pro' };

function applyEventMeta(event) {
  const name = event?.title || 'Гости';
  document.title = `ToiLink — ${name}`;
  const mob = document.getElementById('mob-event-title'); if (mob) mob.textContent = name;
  const crumb = document.getElementById('crumb-event');   if (crumb) crumb.textContent = name;
  renderShareLinks(event);
  renderUpgradeBanner(event);
}

function renderUpgradeBanner(event) {
  const slot = document.getElementById('upgrade-banner');
  if (!slot) return;
  const plan = event?.planCode || 'FREE';
  if (plan === 'TOI_PRO') { slot.innerHTML = ''; return; }
  const current = PLAN_LABEL_G[plan] || plan;
  const next = plan === 'FREE' ? 'Той' : 'Toi Pro';
  const nextDesc = plan === 'FREE'
    ? 'До 150 гостей, все шаблоны, карта и музыка'
    : 'Рассадка по столикам, персональные ссылки, Excel';
  slot.innerHTML = `
    <div style="background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1.5px solid #fcd34d;border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">⭐</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#92400e;">Тариф «${current}» — хотите больше?</div>
          <div style="font-size:12px;color:#a16207;margin-top:1px;">${nextDesc}</div>
        </div>
      </div>
      <button onclick="goUpgrade()" style="background:#F93B7A;color:#fff;border:none;border-radius:10px;padding:10px 0;font-size:14px;font-weight:700;cursor:pointer;width:100%;letter-spacing:0.01em;">Перейти на «${next}» →</button>
    </div>`;
}

function goUpgrade() {
  location.href = `/paywall.html?event=${eventId}`;
}

// ─── Share links section ──────────────────────────────────────────────────────
function renderShareLinks(event) {
  const host = document.getElementById('share-links');
  if (!host) return;
  if (!event?.slug || !isPubliclyVisibleEvent(event)) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }
  const groups = getGuestGroupsArr(event);
  const baseUrl = `${location.origin}/e/${event.slug}`;
  // Always include the общая link at the end
  const items = [
    ...groups
      .filter(g => g && g.code)
      .map(g => ({
        label: g.label || g.code,
        url: `${baseUrl}/${encodeURIComponent(g.code)}`,
        code: g.code,
      })),
    { label: 'Общая ссылка', url: baseUrl, code: '__shared__' },
  ];

  host.classList.remove('hidden');
  host.innerHTML = `
    <div class="rounded-2xl border border-line bg-paper p-4 md:p-5">
      <div class="flex items-baseline justify-between mb-3">
        <div class="font-cormorant italic text-[20px] md:text-[22px] font-semibold text-ink">Ссылки для рассылки</div>
        <div class="text-[11px] text-muted">${items.length} ${pluralize(items.length, ['ссылка','ссылки','ссылок'])}</div>
      </div>
      <div class="flex flex-col gap-2">
        ${items.map(it => `
          <div class="flex items-center gap-3 py-2 px-3 rounded-xl bg-white border border-line">
            <div class="flex-1 min-w-0">
              <div class="text-[13px] text-ink font-medium">${escapeHtml(it.label)}</div>
              <div class="text-[12px] text-muted truncate" title="${escapeHtml(it.url)}">${escapeHtml(it.url)}</div>
            </div>
            <button type="button" class="chip-sm share-copy-btn" data-url="${escapeHtml(it.url)}"
                    style="background:#F5F0E8; color:#1E2820; cursor:pointer; padding:6px 12px;">
              Копировать
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  host.querySelectorAll('.share-copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
        toast('Ссылка скопирована');
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('Ссылка скопирована'); }
        catch { toast('Не удалось скопировать', false); }
        ta.remove();
      }
    });
  });
}

function renderAll() {
  window._allGuestsRef = allGuests;
  window._allTablesRef = allTables;
  window.eventId = eventId;
  window.api = api;
  window.toast = toast;
  window.renderTables = renderTables;
  window.renderList = renderList;
  window.syncAllCaches = syncAllCaches;
  if (state.tab === 'tables') {
    renderTables();
  } else {
    renderStats();
    if (allGuests.length > 0) syncToolbar();
    renderList();
  }
  if (!_wired) {
    wireStatsDelegation();
    wireListDelegation();
    wireToolbar();
    wireTabs();
    wireTablesContainer();
    _wired = true;
  }
}

async function fetchData() {
  return Promise.all([
    fetch(`${BASE_URL}/api/organizer/events/${eventId}`, {
      credentials: 'include',
      headers: { 'X-User-Phone': phone },
    }).then(r => r.json()),
    api('GET', `/api/organizer/events/${eventId}/guests`),
    api('GET', `/api/organizer/events/${eventId}/tables`),
  ]);
}

async function refreshData() {
  try {
    const [event, guests, tables] = await fetchData();
    const changed =
      JSON.stringify(event) !== JSON.stringify(eventData) ||
      JSON.stringify(guests) !== JSON.stringify(allGuests) ||
      JSON.stringify(tables) !== JSON.stringify(allTables);
    eventData = event;
    allGuests = guests;
    allTables = tables;
    syncAllCaches();
    if (changed) {
      applyEventMeta(event);
      renderAll();
    }
  } catch { /* background — ignore */ }
}

function showErrorState(err) {
  document.getElementById('stats').innerHTML = '';
  document.getElementById('toolbar')?.classList.add('hidden');
  document.getElementById('guest-list').innerHTML = `
    <div class="flex flex-col items-center justify-center text-center py-16 md:py-20 px-6 fade-in">
      <div class="w-16 h-16 rounded-2xl bg-cream3 flex items-center justify-center mb-5">
        <svg class="w-7 h-7 text-muted" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h3 class="font-cormorant italic text-[24px] text-ink mb-2">Что-то пошло не так</h3>
      <p class="text-muted text-[14px] mb-6 max-w-[300px]">${err?.message || 'Не удалось загрузить гостей'}</p>
      <button onclick="location.reload()" class="btn-primary">Попробовать снова</button>
    </div>`;
  observeFadeIn();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(location.search);
  eventId = params.get('eventId') ? parseInt(params.get('eventId')) : null;

  if (!eventId) { location.href = '/index.html'; return; }

  const f = params.get('filter');
  if (f && FILTERS[f]) state.filter = f;

  // Render from cache immediately — don't block on auth network round-trip
  const cachedEvent  = cacheGet(`tl:event:${eventId}`);
  const cachedGuests = cacheGet(`tl:guests:${eventId}`);
  const cachedTables = cacheGet(`tl:tables:${eventId}`);

  if (cachedEvent && cachedGuests) {
    eventData = cachedEvent;
    allGuests = cachedGuests;
    allTables = cachedTables || [];
    applyEventMeta(eventData);
    renderAll();
    warmRelatedPages();
  }

  phone = await window.initAuth();

  if (cachedEvent && cachedGuests) {
    refreshData();
    return;
  }

  try {
    const [event, guests, tables] = await fetchData();
    eventData = event;
    allGuests = guests;
    allTables = tables;
    syncAllCaches();
    applyEventMeta(event);
    renderAll();
    warmRelatedPages();
  } catch (err) {
    showErrorState(err);
  }
}

// ─── Tables ───────────────────────────────────────────────────────────────────

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('#page-tabs .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const gC = document.getElementById('guests-container');
  const tC = document.getElementById('tables-container');
  const fabLabel = document.getElementById('fab-label');
  if (tab === 'tables') {
    gC.classList.add('hidden');
    tC.classList.remove('hidden');
    if (fabLabel) fabLabel.textContent = 'Стол';
    renderTables();
  } else {
    gC.classList.remove('hidden');
    tC.classList.add('hidden');
    if (fabLabel) fabLabel.textContent = 'Гостя';
    renderStats();
    if (allGuests.length > 0) syncToolbar();
    renderList();
  }
}

const POOL_CHIP_LIMIT  = 14;

function shortGuestName(name) {
  if (!name) return 'Аноним';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function guestChip(g, fromTableId) {
  const p = avatarPalette(g.name || 'A');
  const initial = (g.name || 'A')[0].toUpperCase();
  const side = g.side === 'BRIDE' ? 'bride' : g.side === 'GROOM' ? 'groom' : 'shared';
  return `<div class="guest-chip side-${side}" data-guest-id="${g.id}" data-from-table="${fromTableId ?? ''}" title="${escapeHtml(g.name || 'Аноним')}">
    <span class="chip-avatar" style="background:${p.bg};color:${p.fg};">${initial}</span>
    <span class="chip-name">${escapeHtml(shortGuestName(g.name))}</span>
  </div>`;
}

function overflowChip(count, tableId) {
  return `<div class="guest-chip overflow-chip" data-action="assign-guests" data-table-id="${tableId ?? ''}">
    <span style="font-size:12px;font-weight:600;padding:0 4px;">+${count}</span>
  </div>`;
}

// Donut SVG: ring around table number visualizing side mix vs capacity.
function donutChartSvg(bride, groom, shared, capacity, num, overfull) {
  const r = 15.91549430918954; // circumference == 100
  const total = capacity || 1;
  const seg = n => Math.min(100, (n / total) * 100);
  const segs = [];
  if (bride > 0)  segs.push({ len: seg(bride),  color: '#F93B7A' });
  if (groom > 0)  segs.push({ len: seg(groom),  color: '#4A6FD8' });
  if (shared > 0) segs.push({ len: seg(shared), color: '#C7B498' });
  let offset = 0;
  const paths = segs.map(s => {
    const html = `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${s.color}" stroke-width="3.4" stroke-dasharray="${s.len.toFixed(2)} ${(100 - s.len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" stroke-linecap="butt"/>`;
    offset += s.len;
    return html;
  });
  const numClass = overfull ? 'donut-num is-overfull' : 'donut-num';
  return `<div class="card-donut">
    <svg viewBox="0 0 36 36" class="donut-svg" aria-hidden="true">
      <g transform="rotate(-90 18 18)">
        <circle cx="18" cy="18" r="${r}" fill="none" stroke="#F2EEE8" stroke-width="3.4"/>
        ${paths.join('')}
      </g>
    </svg>
    <span class="${numClass}">${num}</span>
  </div>`;
}

// Group guests by connected components on relatedToId — couples & families
// stay visually grouped inside the card.
function groupGuestsForCard(guests) {
  const idToIdx = new Map(guests.map((g, i) => [g.id, i]));
  const parent = guests.map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  guests.forEach((g, i) => {
    if (g.relatedToId != null && idToIdx.has(g.relatedToId)) union(i, idToIdx.get(g.relatedToId));
  });
  const byRoot = new Map();
  guests.forEach((g, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(g);
  });
  return Array.from(byRoot.values()).sort((a, b) => b.length - a.length);
}

function renderTableCard(t, idx) {
  const guests = allGuests.filter(g => g.tableId === t.id);
  const capacity = t.capacity || 12;
  const overfull = guests.length > capacity;

  let bride = 0, groom = 0, shared = 0;
  for (const g of guests) {
    if (g.side === 'BRIDE') bride++;
    else if (g.side === 'GROOM') groom++;
    else shared++;
  }

  const donut = donutChartSvg(bride, groom, shared, capacity, idx + 1, overfull);

  const legend = guests.length === 0 ? '' : `
    <div class="card-legend">
      ${bride  ? `<span class="leg-item"><span class="leg-dot bride"></span>${bride} ${pluralize(bride, ['невеста','невесты','невест'])}</span>` : ''}
      ${groom  ? `<span class="leg-item"><span class="leg-dot groom"></span>${groom} ${pluralize(groom, ['жених','жениха','женихов'])}</span>` : ''}
      ${shared ? `<span class="leg-item"><span class="leg-dot shared"></span>${shared} ${pluralize(shared, ['общий','общих','общих'])}</span>` : ''}
    </div>`;

  // Group guests as couples / families for visual binding
  const groups = guests.length ? groupGuestsForCard(guests) : [];
  const guestsHtml = groups.map(grp => {
    if (grp.length === 1) return guestChip(grp[0], t.id);
    const cls = grp.length === 2 ? 'guest-capsule couple' : 'guest-capsule family';
    return `<div class="${cls}" title="${grp.length === 2 ? 'Пара' : 'Семья'} · ${grp.length}">
      ${grp.map(g => guestChip(g, t.id)).join('')}
    </div>`;
  }).join('');

  return `
    <div class="table-card fade-in" data-drop-table="${t.id}" style="animation-delay:${Math.min(idx, 12) * 45}ms;">
      <div class="table-card-head">
        ${donut}
        <div class="card-title-wrap">
          <div class="card-title">${escapeHtml(t.name)}</div>
          <div class="card-cap">
            <span class="cap-num${overfull ? ' is-overfull' : ''}">${guests.length}</span><span class="cap-sep">/</span><span class="cap-total">${capacity}</span>
            <span class="cap-label">${pluralize(capacity, ['место','места','мест'])}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="row-icon-btn" data-action="edit-table" data-table-id="${t.id}" aria-label="Редактировать">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="row-icon-btn" data-action="delete-table" data-table-id="${t.id}" aria-label="Удалить" style="color:#B8412E;">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a2 2 0 012-2h4a2 2 0 012 2v3"/></svg>
          </button>
        </div>
      </div>
      ${legend}
      <div class="card-guests" data-drop-table="${t.id}">
        ${guests.length === 0
          ? `<div class="card-empty">
              <div class="card-empty-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div class="card-empty-text">Пока пусто. Перетащите гостя или нажмите «Добавить».</div>
            </div>`
          : guestsHtml}
      </div>
      <button class="table-add-btn" data-action="assign-guests" data-table-id="${t.id}">
        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        <span>Добавить гостя</span>
      </button>
    </div>`;
}

function renderTables() {
  const container = document.getElementById('tables-list');
  if (!container) return;
  if (allTables.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center py-14 px-6 fade-in">
        <div class="w-20 h-20 rounded-[24px] flex items-center justify-center mb-5"
             style="background: linear-gradient(135deg, #F93B7A 0%, #FF6D45 100%); box-shadow:0 10px 28px rgba(249,59,122,.22);">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/>
          </svg>
        </div>
        <div class="text-[10px] tracking-[0.3em] uppercase text-muted font-medium mb-3">Рассадка</div>
        <h2 class="font-cormorant text-[30px] italic font-semibold text-ink leading-tight mb-3">
          Добавьте <em class="text-accent">первый стол</em>
        </h2>
        <p class="text-muted text-[14px] max-w-[300px] leading-relaxed mb-7">
          Создайте столы и распределите гостей — каждый заранее узнает своё место.
        </p>
        <button onclick="window.openTableSheet()" class="btn-primary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Создать стол
        </button>
      </div>`;
    observeFadeIn();
    return;
  }

  const unassigned = allGuests.filter(g => !g.tableId);
  const seated = allGuests.length - unassigned.length;
  const pct = allGuests.length ? Math.round(seated / allGuests.length * 100) : 0;

  // Global side mix
  let gBride = 0, gGroom = 0, gShared = 0;
  for (const g of allGuests) {
    if (g.side === 'BRIDE') gBride++;
    else if (g.side === 'GROOM') gGroom++;
    else gShared++;
  }

  container.innerHTML = `
    <section class="seating-hero fade-in">
      <div class="hero-deco" aria-hidden="true"></div>
      <div class="hero-top">
        <div class="hero-title-block">
          <div class="hero-eyebrow">Рассадка</div>
          <h2 class="hero-title">${seated === allGuests.length && allGuests.length > 0 ? 'Все на местах' : 'Гости и столы'}</h2>
        </div>
        <button type="button"
                onclick="window.SmartSeating?.openLaunch()"
                class="hero-cta"
                aria-label="Запустить умную рассадку">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          <span>Расставить</span>
        </button>
      </div>
      <div class="hero-grid">
        <div class="hero-percent">
          <span class="hp-num">${pct}</span><span class="hp-pct">%</span>
          <div class="hp-sub">${seated} из ${allGuests.length} рассажены</div>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hs-num">${allTables.length}</span>
            <span class="hs-lbl">${pluralize(allTables.length, ['стол','стола','столов'])}</span>
          </div>
          <div class="hero-stat">
            <span class="hs-num">${unassigned.length}</span>
            <span class="hs-lbl">без места</span>
          </div>
          <div class="hero-mix">
            ${gBride ? `<span class="hm-row"><span class="leg-dot bride"></span>${gBride}</span>` : ''}
            ${gGroom ? `<span class="hm-row"><span class="leg-dot groom"></span>${gGroom}</span>` : ''}
            ${gShared ? `<span class="hm-row"><span class="leg-dot shared"></span>${gShared}</span>` : ''}
          </div>
        </div>
      </div>
    </section>
    <div class="unassigned-pool mb-4 fade-in" data-drop-table="">
      <div class="flex items-center gap-2 mb-2.5">
        <svg class="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="text-[12px] font-medium text-muted uppercase tracking-wider">Без стола</span>
        <span class="chip-sm" style="background:#F0EDE8;color:#8A7F76;">${unassigned.length}</span>
      </div>
      <div class="flex flex-wrap gap-2 min-h-[32px]">
        ${unassigned.length === 0
          ? `<span class="text-[12px] text-muted italic">Все гости распределены 🎉</span>`
          : unassigned.slice(0, POOL_CHIP_LIMIT).map(g => guestChip(g, null)).join('')
            + (unassigned.length > POOL_CHIP_LIMIT
                ? `<span class="text-[12px] text-muted self-center pl-1">+${unassigned.length - POOL_CHIP_LIMIT} ещё — используй кнопку «Добавить» на столе</span>`
                : '')}
      </div>
    </div>
    <div class="tables-grid">
      ${allTables.map((t, i) => renderTableCard(t, i)).join('')}
    </div>`;
  observeFadeIn();
}

async function moveGuestToTable(guestId, newTableId, oldTableId) {
  const g = allGuests.find(x => x.id === guestId);
  if (!g) return;
  const newTid = newTableId || null;
  if (g.tableId === newTid) return;

  const prevTableId = g.tableId;
  allGuests = allGuests.map(x => x.id === guestId
    ? { ...x, tableId: newTid, tableName: newTid ? (allTables.find(t => t.id === newTid)?.name ?? null) : null }
    : x);
  renderTables();

  try {
    const updated = await api('PUT', `/api/organizer/events/${eventId}/guests/${guestId}`, {
      name: g.name, phone: g.phone || null, notes: g.notes || null,
      side: g.side || 'SHARED', relatedToId: g.relatedToId ?? null,
      relationType: g.relationType ?? null,
      rsvpStatus: g.rsvpStatus ?? null,
      tableId: newTid,
    });
    allGuests = allGuests.map(x => x.id === guestId ? updated : x);
    window._allGuestsRef = allGuests;
    syncAllCaches();
  } catch (err) {
    allGuests = allGuests.map(x => x.id === guestId ? { ...x, tableId: prevTableId } : x);
    renderTables();
    toast(err.message || 'Ошибка', false);
  }
}

function openAssignSheet(tableId) {
  document.getElementById('assignSheetBackdrop')?.remove();
  document.getElementById('assignSheetEl')?.remove();

  const table = allTables.find(t => t.id === tableId);
  if (!table) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'assignSheetBackdrop';
  backdrop.className = 'bs-backdrop';
  const sheet = document.createElement('div');
  sheet.id = 'assignSheetEl';
  sheet.className = 'bs-sheet';

  const preSelected = new Set(allGuests.filter(g => g.tableId === tableId).map(g => g.id));
  const selected = new Set(preSelected);
  const pool = allGuests.filter(g => !g.tableId || g.tableId === tableId);

  function buildRows(query = '') {
    const q = query.toLowerCase();
    const rows = pool.filter(g => !q || (g.name || '').toLowerCase().includes(q));
    if (rows.length === 0) return `<p class="text-center text-muted py-6 text-[13px]">Ничего не найдено</p>`;
    return rows.map(g => {
      const p = avatarPalette(g.name || 'A');
      const chk = selected.has(g.id);
      return `<label class="flex items-center gap-3 py-2.5 cursor-pointer" style="border-bottom:1px solid #F0EDE8;" data-guest-row="${g.id}">
        <div class="avatar flex-shrink-0" style="width:36px;height:36px;border-radius:10px;background:${p.bg};color:${p.fg};font-size:16px;">${(g.name||'A')[0].toUpperCase()}</div>
        <span class="flex-1 text-[14px] font-medium text-ink">${escapeHtml(g.name || 'Аноним')}</span>
        <div class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
             style="border-color:${chk ? '#F93B7A' : '#D1C9BF'};background:${chk ? '#F93B7A' : 'transparent'};">
          ${chk ? `<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>` : ''}
        </div>
      </label>`;
    }).join('');
  }

  sheet.innerHTML = `
    <div class="sheet-inner" style="max-height:85vh;display:flex;flex-direction:column;">
      <div class="drag-pill"></div>
      <div class="px-5 md:px-0 flex-1 min-h-0 flex flex-col">
        <div class="flex items-center gap-3 mb-4">
          <p class="font-cormorant italic text-[22px] font-semibold text-ink flex-1">${escapeHtml(table.name)}</p>
          <button id="assign-close" class="row-icon-btn text-muted">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="relative mb-3">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input id="assign-search" type="text" placeholder="Поиск гостя..." class="w-full pl-9 pr-4 py-2.5 rounded-xl text-[14px]" style="border:1.5px solid #E8E2DB;background:#FAF8F5;outline:none;">
        </div>
        ${pool.length === 0
          ? `<p class="text-center text-muted py-6 text-[13px]">Все гости уже за другими столами</p>`
          : `<div id="assign-list" style="overflow-y:auto;flex:1;">${buildRows()}</div>`}
        <button id="assign-confirm-btn" class="btn-primary w-full mt-4">Готово</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  function close() {
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 400);
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }
  backdrop.onclick = close;
  document.addEventListener('keydown', onEsc);
  sheet.querySelector('#assign-close').addEventListener('click', close);

  const listEl = sheet.querySelector('#assign-list');
  const searchEl = sheet.querySelector('#assign-search');

  listEl?.addEventListener('click', e => {
    const row = e.target.closest('[data-guest-row]');
    if (!row) return;
    const gid = parseInt(row.getAttribute('data-guest-row'));
    if (selected.has(gid)) selected.delete(gid); else selected.add(gid);
    listEl.innerHTML = buildRows(searchEl?.value ?? '');
  });

  searchEl?.addEventListener('input', () => { if (listEl) listEl.innerHTML = buildRows(searchEl.value); });

  sheet.querySelector('#assign-confirm-btn').addEventListener('click', async () => {
    const btn = sheet.querySelector('#assign-confirm-btn');
    btn.disabled = true; btn.textContent = 'Сохраняем...';
    try {
      const toAdd    = [...selected].filter(id => !preSelected.has(id));
      const toRemove = [...preSelected].filter(id => !selected.has(id));
      if (toAdd.length === 0 && toRemove.length === 0) { close(); return; }

      const makeReq = (guestId, newTid) => {
        const g = allGuests.find(x => x.id === guestId);
        if (!g) return Promise.resolve(null);
        return api('PUT', `/api/organizer/events/${eventId}/guests/${guestId}`, {
          name: g.name, phone: g.phone || null, notes: g.notes || null,
          side: g.side || 'SHARED', relatedToId: g.relatedToId ?? null,
          relationType: g.relationType ?? null,
          rsvpStatus: g.rsvpStatus ?? null,
          tableId: newTid,
        });
      };

      const results = await Promise.all([
        ...toAdd.map(id => makeReq(id, tableId)),
        ...toRemove.map(id => makeReq(id, null)),
      ]);

      const byId = Object.fromEntries(results.filter(Boolean).map(r => [r.id, r]));
      allGuests = allGuests.map(g => byId[g.id] ?? g);
      window._allGuestsRef = allGuests;
      syncAllCaches();
      renderTables();
      close();
      toast('Рассадка обновлена');
    } catch (err) {
      toast(err.message || 'Ошибка', false);
      btn.disabled = false; btn.textContent = 'Готово';
    }
  });

  requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); });
}

function openChipActions(g, fromTableId) {
  document.getElementById('chipActionsBackdrop')?.remove();
  document.getElementById('chipActionsSheet')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'chipActionsBackdrop';
  backdrop.className = 'bs-backdrop';
  const sheet = document.createElement('div');
  sheet.id = 'chipActionsSheet';
  sheet.className = 'bs-sheet';

  const p = avatarPalette(g.name || 'A');
  const tableOptions = allTables
    .filter(t => t.id !== fromTableId)
    .map(t => `<button class="w-full text-left px-4 py-3 text-[14px] font-medium text-ink hover:bg-[#FAF8F5] rounded-xl flex items-center gap-3" data-move-to="${t.id}">
      <svg class="w-4 h-4 text-muted flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>
      ${escapeHtml(t.name)}
    </button>`).join('');

  sheet.innerHTML = `
    <div class="sheet-inner" style="max-height:70vh;overflow-y:auto;">
      <div class="drag-pill"></div>
      <div class="px-5 md:px-0">
        <div class="flex items-center gap-3 mb-4 pb-3" style="border-bottom:1px solid #F0EDE8;">
          <div class="avatar flex-shrink-0" style="width:40px;height:40px;border-radius:12px;background:${p.bg};color:${p.fg};font-size:18px;">${(g.name||'A')[0].toUpperCase()}</div>
          <span class="font-medium text-ink flex-1">${escapeHtml(g.name || 'Аноним')}</span>
        </div>
        ${tableOptions.length > 0 ? `
          <p class="text-[11px] uppercase tracking-wider text-muted mb-2 font-medium">Переместить за стол</p>
          <div class="space-y-0.5 mb-3">${tableOptions}</div>` : ''}
        ${fromTableId != null ? `
          <button id="chip-unassign-btn" class="w-full text-left px-4 py-3 text-[14px] font-medium rounded-xl flex items-center gap-3" style="color:#B8412E;">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            Снять со стола
          </button>` : ''}
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  function close() {
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 400);
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }
  backdrop.onclick = close;
  document.addEventListener('keydown', onEsc);

  sheet.querySelectorAll('[data-move-to]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const toId = parseInt(btn.getAttribute('data-move-to'));
      close();
      await moveGuestToTable(g.id, toId, fromTableId);
    });
  });

  sheet.querySelector('#chip-unassign-btn')?.addEventListener('click', async () => {
    close();
    await moveGuestToTable(g.id, null, fromTableId);
    toast('Гость откреплён от стола');
  });

  requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); });
}

function wireDragAndDrop() {
  const container = document.getElementById('tables-list');
  if (!container) return;

  const THRESHOLD = 8;

  container.addEventListener('pointerdown', e => {
    const chip = e.target.closest('.guest-chip');
    if (!chip) return;

    const guestId = parseInt(chip.getAttribute('data-guest-id'));
    const fromTableRaw = chip.getAttribute('data-from-table');
    const fromTable = fromTableRaw ? parseInt(fromTableRaw) : null;
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost = null;
    let activeTarget = null;
    let moved = false;

    function getDropTarget(x, y) {
      if (ghost) ghost.style.display = 'none';
      const el = document.elementFromPoint(x, y);
      if (ghost) ghost.style.display = '';
      return el ? el.closest('[data-drop-table]') : null;
    }

    function clearHighlight() {
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      activeTarget = null;
    }

    function cleanup() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', cleanup);
      if (ghost) { ghost.remove(); ghost = null; }
      clearHighlight();
      chip.classList.remove('is-dragging');
    }

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < THRESHOLD) return;

      if (!moved) {
        moved = true;
        const rect = chip.getBoundingClientRect();
        ghost = chip.cloneNode(true);
        ghost.className = 'guest-chip chip-ghost';
        ghost.style.width = rect.width + 'px';
        document.body.appendChild(ghost);
        chip.classList.add('is-dragging');
      }

      ghost.style.left = (ev.clientX - 20) + 'px';
      ghost.style.top  = (ev.clientY - 15) + 'px';

      const dropEl = getDropTarget(ev.clientX, ev.clientY);
      if (dropEl !== activeTarget) {
        clearHighlight();
        if (dropEl) { dropEl.classList.add('drag-over'); activeTarget = dropEl; }
      }
    }

    function onUp(ev) {
      const dropEl = moved ? getDropTarget(ev.clientX, ev.clientY) : null;
      cleanup();
      if (!moved) return;
      if (dropEl) {
        const rawVal = dropEl.getAttribute('data-drop-table');
        const newTableId = rawVal ? parseInt(rawVal) : null;
        if (newTableId !== fromTable) moveGuestToTable(guestId, newTableId, fromTable);
      }
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', cleanup);
  });
}

window.openTableSheet = function (table = null) {
  document.getElementById('table-edit-id').value = table ? table.id : '';
  document.getElementById('table-name').value = table ? table.name : '';
  document.getElementById('table-capacity').value = table?.capacity ?? '';
  document.getElementById('tableSheetMode').textContent = table ? 'Редактировать стол' : 'Новый стол';
  document.getElementById('tableSheet').classList.add('open');
  document.getElementById('tableBackdrop').classList.add('open');
  setTimeout(() => document.getElementById('table-name')?.focus(), 260);
};

window.closeTableSheet = function () {
  document.getElementById('tableSheet').classList.remove('open');
  document.getElementById('tableBackdrop').classList.remove('open');
  document.getElementById('table-form')?.reset();
  document.getElementById('table-edit-id').value = '';
};

window.submitTableForm = async function (e) {
  e.preventDefault();
  const editId   = document.getElementById('table-edit-id').value;
  const name     = document.getElementById('table-name').value.trim();
  const capRaw   = document.getElementById('table-capacity').value;
  const capacity = capRaw ? parseInt(capRaw) : null;
  const btn      = document.getElementById('tableSubmitBtn');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Сохраняем...';
  try {
    if (editId) {
      const updated = await api('PUT', `/api/organizer/events/${eventId}/tables/${editId}`, { name, capacity });
      allTables = allTables.map(t => t.id === updated.id ? { ...updated, guestCount: t.guestCount } : t);
    } else {
      const created = await api('POST', `/api/organizer/events/${eventId}/tables`, { name, capacity });
      allTables = [...allTables, created];
    }
    window.closeTableSheet();
    renderTables();
    toast(editId ? 'Стол обновлён' : 'Стол создан');
  } catch (err) {
    toast(err.message || 'Ошибка', false);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
};

function confirmDeleteTable(table) {
  document.getElementById('confirmTableBackdrop')?.remove();
  document.getElementById('confirmTableSheet')?.remove();
  const backdrop = document.createElement('div');
  backdrop.id = 'confirmTableBackdrop';
  backdrop.className = 'bs-backdrop';
  const sheet = document.createElement('div');
  sheet.id = 'confirmTableSheet';
  sheet.className = 'bs-sheet';
  const seated = allGuests.filter(g => g.tableId === table.id).length;
  sheet.innerHTML = `
    <div class="sheet-inner">
      <div class="drag-pill"></div>
      <div class="px-5 md:px-0 pt-3 md:pt-0 text-center">
        <div class="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style="background:rgba(184,65,46,.08);color:#B8412E;">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h2 class="font-cormorant italic text-[24px] md:text-[28px] font-semibold text-ink mb-2">Удалить ${escapeHtml(table.name)}?</h2>
        <p class="text-[14px] text-muted leading-relaxed mb-5 max-w-[300px] mx-auto">
          ${seated > 0
            ? `${seated} ${pluralize(seated, ['гость','гостя','гостей'])} ${seated === 1 ? 'будет откреплён' : 'будут откреплены'} от стола.`
            : 'Стол будет удалён.'}
        </p>
        <div class="flex flex-col gap-2">
          <button id="confirm-del-table-btn" class="btn-primary w-full" style="background:#B8412E;">Да, удалить</button>
          <button id="confirm-cancel-table-btn" class="btn-ghost w-full">Отмена</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  function close() {
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 400);
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }
  backdrop.onclick = close;
  document.addEventListener('keydown', onEsc);
  sheet.querySelector('#confirm-cancel-table-btn').addEventListener('click', close);
  sheet.querySelector('#confirm-del-table-btn').addEventListener('click', async () => {
    const btn = sheet.querySelector('#confirm-del-table-btn');
    btn.disabled = true; btn.textContent = 'Удаление...';
    try {
      await api('DELETE', `/api/organizer/events/${eventId}/tables/${table.id}`);
      allGuests = allGuests.map(g => g.tableId === table.id ? { ...g, tableId: null, tableName: null } : g);
      allTables = allTables.filter(t => t.id !== table.id);
      window._allGuestsRef = allGuests;
      syncAllCaches();
      renderTables();
      toast('Стол удалён');
      close();
    } catch (err) {
      toast(err.message || 'Ошибка', false);
      btn.disabled = false; btn.textContent = 'Да, удалить';
    }
  });
  requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); });
}

function wireTabs() {
  document.getElementById('page-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) switchTab(btn.getAttribute('data-tab'));
  });
}

function wireTablesContainer() {
  const container = document.getElementById('tables-list');
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const act = btn.getAttribute('data-action');
      if (act === 'assign-guests') {
        e.stopPropagation();
        openAssignSheet(parseInt(btn.getAttribute('data-table-id')));
        return;
      }
      if (act === 'edit-table' || act === 'delete-table') {
        e.stopPropagation();
        const tableId = parseInt(btn.getAttribute('data-table-id'));
        const table   = allTables.find(t => t.id === tableId);
        if (!table) return;
        if (act === 'edit-table') window.openTableSheet(table);
        else confirmDeleteTable(table);
        return;
      }
    }
    const chip = e.target.closest('.guest-chip[data-guest-id]');
    if (chip) {
      const gid = parseInt(chip.getAttribute('data-guest-id'));
      const fromTableRaw = chip.getAttribute('data-from-table');
      const fromTableId = fromTableRaw ? parseInt(fromTableRaw) : null;
      const g = allGuests.find(x => x.id === gid);
      if (g) openChipActions(g, fromTableId);
    }
  });
  wireDragAndDrop();
}

window.openCurrentAddSheet = function () {
  if (state.tab === 'tables') window.openTableSheet();
  else openAddSheet();
};

init();
