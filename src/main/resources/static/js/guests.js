// ─── State ────────────────────────────────────────────────────────────────────
const BASE_URL = '';
let eventId   = null;
let eventData = null;
let phone     = null;
let allGuests = [];
let _wired    = false;
const EVENTS_CACHE_KEY = 'tl:events:list';
const STATS_CACHE_KEY  = 'tl:events:stats';
const state = {
  filter: 'all',     // all | attending | declined | noReply
  search: '',
};

// ─── Session cache ───────────────────────────────────────────────────────────
function cacheSet(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, at: Date.now() })); } catch {}
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

function sideChip(side) {
  if (side === 'GROOM') return `<span class="chip-sm" style="background:#E8EEFF; color:#2F4DAF; font-size:10px;">Жених</span>`;
  if (side === 'BRIDE') return `<span class="chip-sm" style="background:#FFE8F5; color:#C71F5C; font-size:10px;">Невеста</span>`;
  return '';
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

function applyFilters() {
  const f = FILTERS[state.filter] || FILTERS.all;
  const q = state.search.trim().toLowerCase();
  return allGuests.filter(g => {
    if (!f.match(g)) return false;
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

  observeFadeIn();
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
      });
      allGuests = allGuests.map(x => x.id === g.id ? updated : x);
      window._allGuestsRef = allGuests;
      syncAllCaches();
      renderStats();
      renderList();
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
      side, rsvpStatus, companionName,
    });

    closeAddSheet();

    // Reload full list so companion also appears
    const [event, guests] = await fetchData();
    eventData = event;
    allGuests = guests;
    window._allGuestsRef = allGuests;
    syncAllCaches();
    applyEventMeta(event);
    renderAll();

    toast(companionName ? 'Добавлено 2 гостя' : 'Гость добавлен');
  } catch (err) {
    toast(err.message || 'Ошибка', false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
};

function applyEventMeta(event) {
  const name = event?.title || 'Гости';
  document.title = `ToiLink — ${name}`;
  const mob = document.getElementById('mob-event-title'); if (mob) mob.textContent = name;
  const crumb = document.getElementById('crumb-event');   if (crumb) crumb.textContent = name;
}

function renderAll() {
  window._allGuestsRef = allGuests;
  renderStats();
  if (allGuests.length > 0) syncToolbar();
  renderList();
  if (!_wired) {
    wireStatsDelegation();
    wireListDelegation();
    wireToolbar();
    _wired = true;
  }
}

async function fetchData() {
  return Promise.all([
    fetch(`${BASE_URL}/api/organizer/events/${eventId}`, {
      headers: { 'X-User-Phone': phone },
    }).then(r => r.json()),
    api('GET', `/api/organizer/events/${eventId}/guests`),
  ]);
}

async function refreshData() {
  try {
    const [event, guests] = await fetchData();
    const changed =
      JSON.stringify(event) !== JSON.stringify(eventData) ||
      JSON.stringify(guests) !== JSON.stringify(allGuests);
    eventData = event;
    allGuests = guests;
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

  phone = await window.initAuth();
  // phone is used only for display; API calls use session cookie automatically

  const cachedEvent  = cacheGet(`tl:event:${eventId}`);
  const cachedGuests = cacheGet(`tl:guests:${eventId}`);

  if (cachedEvent && cachedGuests) {
    // Instant render from cache, then revalidate in background
    eventData = cachedEvent;
    allGuests = cachedGuests;
    applyEventMeta(eventData);
    renderAll();
    warmRelatedPages();
    refreshData();
    return;
  }

  try {
    const [event, guests] = await fetchData();
    eventData = event;
    allGuests = guests;
    syncAllCaches();
    applyEventMeta(event);
    renderAll();
    warmRelatedPages();
  } catch (err) {
    showErrorState(err);
  }
}

init();
