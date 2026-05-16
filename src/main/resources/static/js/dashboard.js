// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = '';

// ─── Session cache (warms /guests.html) ──────────────────────────────────────
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
  } catch {
    return null;
  }
}

const EVENTS_CACHE_KEY = 'tl:events:list';
const STATS_CACHE_KEY = 'tl:events:stats';

// ─── API ──────────────────────────────────────────────────────────────────────
async function fetchEvents() {
  const res = await fetch(`${BASE_URL}/api/organizer/events`, { credentials: 'include' });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return res.json();
}

async function fetchDashboardSummary() {
  const res = await fetch(`${BASE_URL}/api/organizer/events/summary`, { credentials: 'include' });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return res.json();
}

async function fetchGuests(eventId) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${eventId}/guests`, { credentials: 'include' });
  if (!res.ok) throw new Error('Ошибка загрузки гостей');
  return res.json();
}

async function fetchStats(eventId) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${eventId}/stats`, { credentials: 'include' });
  if (!res.ok) throw new Error('Ошибка загрузки статистики');
  return res.json();
}

async function deleteEvent(eventId) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${eventId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Ошибка удаления');
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function daysBetween(iso) {
  if (!iso) return null;
  const target = new Date(iso);
  const now = new Date();
  target.setHours(0,0,0,0); now.setHours(0,0,0,0);
  return Math.round((target - now) / 86400000);
}

function statusLabel(status) {
  return { DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', CLOSED: 'Закрыто' }[status] || status;
}

function statusChipClass(status) {
  return { DRAFT: 'chip chip-draft', PUBLISHED: 'chip chip-published', CLOSED: 'chip chip-closed' }[status] || 'chip chip-draft';
}

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

function copyLink(url) {
  if (!url) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Ссылка скопирована'))
      .catch(() => fallbackCopy(url));
    return;
  }
  fallbackCopy(url);
}

function fallbackCopy(url) {
  const ta = document.createElement('textarea');
  ta.value = url;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  ta.remove();
  if (ok) showToast('Ссылка скопирована');
  else prompt('Скопируйте ссылку:', url);
}

function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ─── Guests bottom sheet ──────────────────────────────────────────────────────
function openGuestsSheet(event, guests) {
  // Remove any previous instance
  document.getElementById('guestsBackdrop')?.remove();
  document.getElementById('guestsSheet')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'guestsBackdrop';
  backdrop.className = 'bs-backdrop';

  const sheet = document.createElement('div');
  sheet.id = 'guestsSheet';
  sheet.className = 'bs-sheet';

  const personal = guests.filter(g => guestSource(g) === 'PERSONAL_LINK' && g.token).length;
  const publicLink = guests.filter(g => guestSource(g) === 'PUBLIC_LINK').length;

  const guestsHtml = guests.length === 0
    ? `<div class="flex flex-col items-center justify-center py-12 text-center">
         <div class="w-16 h-16 rounded-[20px] bg-mint flex items-center justify-center mb-4">
           <svg class="w-7 h-7 text-sage2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
           </svg>
         </div>
         <p class="font-cormorant italic text-[20px] text-ink mb-1">Гостей пока нет</p>
         <p class="text-[13px] text-muted">Добавьте первого гостя в разделе «Гости»</p>
       </div>`
    : `<div class="flex flex-col">${guests.map(guestRow).join('')}</div>`;

  sheet.innerHTML = `
    <div class="sheet-inner">
      <div class="drag-pill"></div>
      <div class="px-6 md:px-0 pt-2 md:pt-0">
        <div class="flex items-start justify-between gap-4 mb-5">
          <div class="min-w-0">
            <div class="text-[10px] tracking-[0.3em] uppercase text-muted font-medium mb-1">Список гостей</div>
            <h2 class="font-cormorant text-[26px] md:text-[30px] italic font-semibold text-ink leading-tight truncate">${event.title || 'Событие'}</h2>
          </div>
          <button id="guestsCloseBtn"
            class="w-9 h-9 rounded-full bg-cream3 flex items-center justify-center text-muted active:scale-90 transition-transform flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2 md:gap-3 mb-5">
          <div class="rounded-2xl border border-line bg-white p-3 md:p-4 text-center">
            <p class="font-cormorant text-[24px] md:text-[28px] font-semibold text-ink leading-none">${guests.length}</p>
            <p class="text-[10px] uppercase tracking-wider text-muted mt-1.5 font-medium">Всего</p>
          </div>
          <div class="rounded-2xl p-3 md:p-4 text-center" style="background:#C2E0C6;">
            <p class="font-cormorant text-[24px] md:text-[28px] font-semibold leading-none" style="color:#1A3D20;">${personal}</p>
            <p class="text-[10px] uppercase tracking-wider mt-1.5 font-medium" style="color:#3D6B45;">Персональных</p>
          </div>
          <div class="rounded-2xl p-3 md:p-4 text-center" style="background:#F0EDE8;">
            <p class="font-cormorant text-[24px] md:text-[28px] font-semibold leading-none" style="color:#7C6040;">${publicLink}</p>
            <p class="text-[10px] uppercase tracking-wider mt-1.5 font-medium" style="color:#8B7355;">По общей</p>
          </div>
        </div>

        <div class="max-h-[50vh] md:max-h-[60vh] overflow-y-auto -mx-2 px-2">
          ${guestsHtml}
        </div>

        <a href="/guests.html?eventId=${event.id}" class="btn-primary w-full mt-5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
          Открыть полный список
        </a>
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
  sheet.querySelector('#guestsCloseBtn').addEventListener('click', close);
  document.addEventListener('keydown', onEsc);

  // swipe down to close (mobile)
  let startY = 0;
  sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    if (dy > 60) close();
  }, { passive: true });

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  });
}

function guestRow(g) {
  const name = g.name || 'Аноним';
  const initial = name[0].toUpperCase();
  const palettes = [
    { bg: '#C2E0C6', fg: '#1A3D20' },
    { bg: '#E6D5B8', fg: '#7C5520' },
    { bg: '#DDE4EC', fg: '#3A5080' },
    { bg: '#F0DCD5', fg: '#8B4030' },
  ];
  const p = palettes[(name.charCodeAt(0) || 0) % palettes.length];
  const badge = guestSource(g) === 'PUBLIC_LINK'
    ? `<span class="chip chip-draft" style="font-size:10px; padding:3px 8px;"><span class="chip-dot"></span>Общая ссылка</span>`
    : guestSource(g) === 'MANUAL'
      ? `<span class="chip chip-draft" style="font-size:10px; padding:3px 8px;"><span class="chip-dot"></span>Без ссылки</span>`
      : `<span class="chip chip-published" style="font-size:10px; padding:3px 8px;"><span class="chip-dot"></span>Персональная</span>`;

  return `
    <div class="flex items-center gap-3 py-3 px-1 border-b border-line last:border-0">
      <div class="avatar flex-shrink-0" style="width:40px; height:40px; font-size:17px; background:${p.bg}; color:${p.fg};">
        ${initial}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-ink font-medium text-[14px] truncate">${name}</p>
          ${badge}
        </div>
        ${g.phone ? `<p class="text-muted text-[12px] mt-0.5">${g.phone}</p>` : ''}
        ${g.notes ? `<p class="text-muted text-[12px] italic font-cormorant mt-0.5 line-clamp-1">«${g.notes}»</p>` : ''}
      </div>
    </div>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderEmpty() {
  const _gh = document.getElementById('genericHero');
  if (_gh) _gh.style.display = '';
  document.getElementById('content').innerHTML = `
    <div class="flex flex-col items-center justify-center text-center py-20 md:py-28 px-6 fade-in">
      <div class="relative mb-9">
        <div class="w-28 h-28 md:w-32 md:h-32 rounded-[32px] flex items-center justify-center"
             style="background: linear-gradient(145deg, #FFE0EC 0%, #FECFE2 100%); box-shadow: 0 16px 48px rgba(249,59,122,0.20);">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center"
               style="background: linear-gradient(135deg, #F93B7A 0%, #FF6D45 100%); box-shadow: 0 8px 24px rgba(249,59,122,0.35);">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
            </svg>
          </div>
        </div>
        <div class="absolute -top-2 -right-2 w-10 h-10 rounded-2xl flex items-center justify-center"
             style="background:#fff; box-shadow:0 8px 24px rgba(249,59,122,0.15); border:1px solid rgba(249,59,122,0.12);">
          <svg class="w-4 h-4" style="color:#F93B7A" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </div>
        <div class="absolute -bottom-1 -left-3 w-9 h-9 rounded-xl flex items-center justify-center"
             style="background:linear-gradient(145deg,#D4F0D9,#B8DCC0); box-shadow:0 6px 16px rgba(61,107,69,0.15);">
          <svg class="w-4 h-4" style="color:#1A3D20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </div>
      </div>
      <div class="text-[10px] tracking-[0.3em] uppercase font-semibold mb-3" style="color:rgba(249,59,122,0.65)">Начните прямо сейчас</div>
      <h2 class="font-cormorant text-[34px] md:text-[44px] italic font-semibold text-ink leading-tight mb-3">
        Ваше первое<br>приглашение
      </h2>
      <p class="text-muted text-[14px] md:text-[15px] max-w-[300px] leading-relaxed mb-8">
        Красивый сайт-приглашение с RSVP и личными ссылками — за 5 минут.
      </p>
      <div class="flex flex-col sm:flex-row gap-3">
        <a href="/templates.html" class="btn-primary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Выбрать шаблон
        </a>
        <button onclick="showCreateSheet()" class="btn-secondary">Смотреть варианты</button>
      </div>
    </div>`;
  _observeFadeIn();
}

function rsvpStrip(stats) {
  if (!stats) return '';
  const pending = Math.max(0, stats.total - stats.attending - stats.declined - stats.maybe);
  if (stats.total === 0) {
    return `<div class="rsvp-strip empty"><span class="rsvp-strip-hint">Нет гостей</span></div>`;
  }
  return `
    <div class="rsvp-strip">
      <span class="rsvp-chip rsvp-yes" title="Придут">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        ${stats.attending}
      </span>
      <span class="rsvp-chip rsvp-no" title="Не смогут">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        ${stats.declined}
      </span>
      <span class="rsvp-chip rsvp-wait" title="Ждём ответа">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ${pending}
      </span>
      <span class="rsvp-total">/ ${stats.total}</span>
    </div>`;
}

function renderEventCard(event, stats) {
  const eventUrl = buildEventUrl(event) || (event?.slug ? `${location.origin}/e/${event.slug}` : '');
  const coverHtml = event.coverImageUrl
    ? `<img src="${event.coverImageUrl}" alt=""/>`
    : `<div class="event-cover-fallback">
         <span class="font-cormorant italic text-white/80 text-[18px] leading-snug relative z-[1]">${event.title || 'Событие'}</span>
       </div>`;

  const names = event.person1
    ? `${event.person1}${event.person2 ? ' <span class="text-muted">&amp;</span> ' + event.person2 : ''}`
    : '';

  return `
    <div id="card-${event.id}" class="event-card fade-in">
      <a href="${eventUrl}" target="_blank" rel="noopener" class="event-cover block">
        ${coverHtml}
        <div class="absolute top-3 right-3 z-[2]">
          <span class="${statusChipClass(event.status)}"><span class="chip-dot"></span>${statusLabel(event.status)}</span>
        </div>
      </a>

      <div class="p-5 flex-1 flex flex-col">
        <h3 class="font-cormorant text-[22px] md:text-[24px] font-semibold italic text-ink leading-tight mb-0.5 line-clamp-2">${event.title || 'Без названия'}</h3>
        ${names ? `<p class="text-sage text-[13px] font-medium mb-3">${names}</p>` : '<div class="mb-3"></div>'}

        <div class="flex flex-col gap-1.5 mb-4">
          ${event.eventDate ? `
            <div class="flex items-center gap-2 text-muted text-[12.5px]">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>${formatDate(event.eventDate)}</span>
            </div>` : ''}
          ${event.location ? `
            <div class="flex items-center gap-2 text-muted text-[12.5px]">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span class="truncate">${event.location}</span>
            </div>` : ''}
        </div>

        ${rsvpStrip(stats)}

        <div class="mt-auto">
          <div class="flex gap-2 mb-2">
            <button onclick="handleGuests(${event.id})" class="card-btn card-btn-primary">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Гости
            </button>
            <button onclick="copyLink('${eventUrl}')" class="card-btn">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              Ссылка
            </button>
            <a href="/editor.html?id=${event.id}" class="card-btn">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Изменить
            </a>
          </div>
          <button
            id="del-${event.id}"
            onclick="handleDeleteClick(${event.id})"
            class="w-full py-2 text-[11px] text-ink/25 hover:text-red-400 transition-colors rounded-full font-medium tracking-wider uppercase">
            Удалить
          </button>
        </div>
      </div>
    </div>`;
}

// ─── Donut chart (landing-style) ──────────────────────────────────────────────
function renderLpDonut(s) {
  const total = s.total || 0;
  const yes = s.attending || 0;
  const no = s.declined || 0;
  const maybe = s.maybe || 0;
  const wait = Math.max(0, total - yes - no - maybe);
  const R = 50;
  const C = 2 * Math.PI * R;

  const defs = `
    <defs>
      <linearGradient id="lpDonutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F93B7A"/>
        <stop offset="100%" stop-color="#FF6D45"/>
      </linearGradient>
    </defs>`;

  if (total === 0) {
    return `
      <svg viewBox="0 0 120 120" aria-label="Пока нет гостей">
        ${defs}
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="#F3F4F6" stroke-width="14"/>
        <text x="60" y="60" text-anchor="middle" dominant-baseline="central" class="lp-donut-num">0</text>
        <text x="60" y="84" text-anchor="middle" class="lp-donut-cap">ответов</text>
      </svg>`;
  }

  const responded = yes + no + maybe;
  const pct = Math.round((responded / total) * 100);
  const segLen = (v) => (v / total) * C;
  // attending — главный pink-orange градиент. Остальные нейтральные.
  const segs = [
    { len: segLen(yes),   off: 0,                                stroke: 'url(#lpDonutGrad)' },
    { len: segLen(no),    off: segLen(yes),                      stroke: '#9CA3AF' },
    { len: segLen(maybe), off: segLen(yes + no),                 stroke: '#F59E0B' },
    { len: segLen(wait),  off: segLen(yes + no + maybe),         stroke: '#FCE7F3' },
  ].filter(g => g.len > 0.5);

  const segHtml = segs.map((g, i) => `
    <circle class="seg" cx="60" cy="60" r="${R}" fill="none"
      stroke="${g.stroke}" stroke-width="14"
      stroke-dasharray="${g.len.toFixed(2)} ${(C - g.len).toFixed(2)}"
      stroke-dashoffset="${(-g.off).toFixed(2)}"
      style="animation-delay: ${i * 110}ms"/>`).join('');

  return `
    <svg viewBox="0 0 120 120" aria-label="Ответы гостей">
      ${defs}
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="#F3F4F6" stroke-width="14"/>
      ${segHtml}
      <text x="60" y="60" text-anchor="middle" dominant-baseline="central" class="lp-donut-num">${pct}%</text>
      <text x="60" y="84" text-anchor="middle" class="lp-donut-cap">ответили</text>
    </svg>`;
}

// ─── Smart CTA — pink/mint/dark карточка справа ───────────────────────────────
function buildLpCta(event, s, eventUrl) {
  const total = s.total || 0;
  const responded = (s.attending || 0) + (s.declined || 0) + (s.maybe || 0);
  const pending = Math.max(0, total - responded);
  const isDraft = event.status === 'DRAFT';

  const ICONS = {
    lock:  `<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>`,
    users: `<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>`,
    bell:  `<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>`,
    check: `<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>`
  };

  if (isDraft) {
    return { tone: 'dark', eyebrow: 'Внимание', icon: ICONS.lock,
      title: 'Сайт пока не активирован',
      desc: 'Гости видят пустую страницу. Активируйте, чтобы они смогли подтвердить участие.',
      cta: 'Активировать', href: `/paywall.html?event=${event.id}` };
  }
  if (total === 0) {
    return { tone: 'pink', eyebrow: 'Что дальше', icon: ICONS.users,
      title: 'Добавьте первых гостей',
      desc: 'Каждому отправите персональную ссылку с RSVP — без приложений.',
      cta: 'Открыть гостей', href: `/guests.html?eventId=${event.id}` };
  }
  if (pending > 0) {
    return { tone: 'pink', eyebrow: 'Что дальше', icon: ICONS.bell,
      title: `Напомните ${pending} ${pluralize(pending, ['гостю','гостям','гостям'])}`,
      desc: 'Они ещё не ответили. Отправьте ссылку повторно — это часто помогает.',
      cta: 'К не ответившим', href: `/guests.html?eventId=${event.id}&filter=noReply` };
  }
  return { tone: 'mint', eyebrow: 'Готово', icon: ICONS.check,
    title: 'Все гости ответили',
    desc: 'Можно подвести итоги и скачать финальный список для тамады.',
    cta: 'Открыть список', href: `/guests.html?eventId=${event.id}` };
}

// ─── Event Hub (single-event layout, landing-style) ───────────────────────────
function renderEventHub(event, stats) {
  const eventUrl = buildEventUrl(event) || (event?.slug ? `${location.origin}/e/${event.slug}` : '');
  const slugPath = eventUrl.replace(location.origin, '');

  const genericHero = document.getElementById('genericHero');
  if (genericHero) genericHero.style.display = 'none';

  const d = daysBetween(event.eventDate);
  const dateLabel = event.eventDate ? formatDate(event.eventDate) : null;
  const countdown = (() => {
    if (d === null) return null;
    if (d > 0)  return { text: `Осталось ${d} ${pluralize(d, ['день','дня','дней'])}`, num: d, past: false };
    if (d === 0) return { text: 'Событие сегодня', num: '✦', past: false };
    return { text: `${Math.abs(d)} ${pluralize(Math.abs(d), ['день','дня','дней'])} назад`, num: Math.abs(d), past: true };
  })();

  const s = stats || { total: 0, attending: 0, declined: 0, maybe: 0 };
  const pending = Math.max(0, s.total - s.attending - s.declined - s.maybe);

  const cover = event.coverImageUrl
    ? `<div class="hub-cover"><img src="${event.coverImageUrl}" alt=""/></div>`
    : `<div class="hub-cover-fallback"></div>`;

  const namesLine = event.person1
    ? `${event.person1}${event.person2 ? ' <span class="font-cormorant italic" style="opacity:.7; font-size:1.05em;"> &amp; </span> ' + event.person2 : ''}`
    : null;
  const heroTitle = namesLine || event.title || 'Без названия';

  const cta = buildLpCta(event, s, eventUrl);
  const donut = renderLpDonut(s);

  const shareText = encodeURIComponent(`Приглашаем вас${event.title ? ' на ' + event.title : ''}`);
  const waUrl = `https://wa.me/?text=${shareText}%20${encodeURIComponent(eventUrl)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(eventUrl)}&text=${shareText}`;

  const ctaBtnHtml = cta.href
    ? `<a href="${cta.href}" class="lp-cta-btn">${cta.cta}<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-7-7l7 7-7 7"/></svg></a>`
    : `<button onclick="${cta.onclick}" class="lp-cta-btn">${cta.cta}<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-7-7l7 7-7 7"/></svg></button>`;

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="fade-in">
      <!-- HERO (с pink-orange fallback) -->
      <section class="hub-hero">
        ${cover}
        <div class="hub-overlay"></div>
        <div class="hub-status">
          <span class="${statusChipClass(event.status)}"><span class="chip-dot"></span>${statusLabel(event.status)}</span>
        </div>

        <div class="hub-eyebrow">${event.person1 ? (event.title || 'Приглашение') : 'Ваше приглашение'}</div>
        <h1 class="hub-title">${heroTitle}</h1>

        <div class="hub-subtitle">
          ${dateLabel ? `
            <span class="inline-flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${dateLabel}
            </span>` : ''}
          ${event.location ? `
            ${dateLabel ? '<span class="dot"></span>' : ''}
            <span class="inline-flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${event.location}
            </span>` : ''}
        </div>

        ${countdown ? `
          <div class="hub-countdown ${countdown.past ? 'past' : ''}">
            <span class="num">${countdown.num}</span>
            <span>${countdown.text}</span>
          </div>` : ''}

        <div class="hub-cta-row">
          <button type="button" data-action="share-event" data-share-url="${escapeAttr(eventUrl)}" data-share-title="${escapeAttr(event.title || '')}" class="btn-primary">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            Поделиться
          </button>
          <a href="${eventUrl}" target="_blank" rel="noopener" class="btn-secondary">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Посмотреть
          </a>
        </div>
      </section>

      <!-- STATS donut + smart CTA (2 cols) -->
      <div class="lp-grid">
        <!-- Donut card -->
        <div class="lp-card">
          <div class="lp-eyebrow">RSVP</div>
          <div class="lp-stats-body">
            <div class="lp-donut">${donut}</div>
            <div class="lp-legend">
              <div class="lp-leg-row">
                <span class="lp-leg-icon lp-leg-yes">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </span>
                <span class="lp-leg-label">Придут</span>
                <span class="lp-leg-num">${s.attending || 0}</span>
              </div>
              <div class="lp-leg-row">
                <span class="lp-leg-icon lp-leg-no">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </span>
                <span class="lp-leg-label">Не смогут</span>
                <span class="lp-leg-num">${s.declined || 0}</span>
              </div>
              ${s.maybe > 0 ? `
                <div class="lp-leg-row">
                  <span class="lp-leg-icon lp-leg-maybe">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01"/></svg>
                  </span>
                  <span class="lp-leg-label">Возможно</span>
                  <span class="lp-leg-num">${s.maybe}</span>
                </div>` : ''}
              <div class="lp-leg-row">
                <span class="lp-leg-icon lp-leg-wait">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </span>
                <span class="lp-leg-label">Ждут ответа</span>
                <span class="lp-leg-num">${pending}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Smart CTA -->
        <div class="lp-cta tone-${cta.tone}">
          <div class="lp-cta-eyebrow">${cta.eyebrow}</div>
          <div class="lp-cta-icon">
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${cta.icon}</svg>
          </div>
          <div class="lp-cta-title">${cta.title}</div>
          <div class="lp-cta-desc">${cta.desc}</div>
          ${ctaBtnHtml}
        </div>
      </div>

      <!-- 3-action grid (how-it-works style) -->
      <div class="lp-actions">
        <a href="/guests.html?eventId=${event.id}" class="lp-action">
          ${s.total > 0 ? `<span class="lp-action-badge">${s.total}</span>` : ''}
          <div class="lp-action-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <div class="lp-action-body">
            <div class="lp-action-title">Список гостей</div>
            <div class="lp-action-desc">${s.total > 0 ? 'управляйте RSVP' : 'добавьте первого'}</div>
          </div>
          <svg class="lp-action-arrow" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </a>

        <a href="/editor.html?id=${event.id}" class="lp-action">
          <div class="lp-action-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
          <div class="lp-action-body">
            <div class="lp-action-title">Редактор</div>
            <div class="lp-action-desc">текст, фото, блоки</div>
          </div>
          <svg class="lp-action-arrow" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </a>

        <a href="${eventUrl}" target="_blank" rel="noopener" class="lp-action">
          <div class="lp-action-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </div>
          <div class="lp-action-body">
            <div class="lp-action-title">Превью</div>
            <div class="lp-action-desc">как видят гости</div>
          </div>
          <svg class="lp-action-arrow" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </a>
      </div>

      <!-- Share strip -->
      <div class="lp-share">
        <div class="lp-share-eyebrow">Поделиться</div>
        <div class="lp-share-title">Отправьте приглашение гостям</div>
        <button onclick="copyLink('${eventUrl}')" class="lp-share-url" type="button">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          <span class="lp-share-url-text">${slugPath}</span>
          <span class="lp-share-url-cp">Копировать</span>
        </button>
        <div class="lp-share-buttons">
          <a href="${waUrl}" target="_blank" rel="noopener" class="lp-share-btn wa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/></svg>
            WhatsApp
          </a>
          <a href="${tgUrl}" target="_blank" rel="noopener" class="lp-share-btn tg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.27 1.4.18 1.12 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
            Telegram
          </a>
        </div>
      </div>

      <!-- Minimal footer -->
      <div class="lp-footer">
        <button onclick="showCreateSheet()" class="lp-footer-add">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Ещё одно событие
        </button>
        <button id="del-${event.id}" onclick="handleDeleteClick(${event.id})" class="danger-link">
          Удалить
        </button>
      </div>
    </div>`;
  _observeFadeIn();
}

window.shareEvent = async function (url, title) {
  const text = title ? `Приглашаю вас на ${title}` : 'Приглашение';
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch { /* user cancelled */ }
  }
  copyLink(url);
};

function renderEvents(events, statsMap) {
  const _gh = document.getElementById('genericHero');
  if (_gh) _gh.style.display = '';
  const sorted = [...events].sort((a, b) => {
    const da = a.eventDate ? new Date(a.eventDate).getTime() : 0;
    const db = b.eventDate ? new Date(b.eventDate).getTime() : 0;
    return db - da;
  });

  document.getElementById('content').innerHTML = `
    <div class="flex items-center justify-between mb-4 md:mb-5">
      <div class="flex items-baseline gap-3">
        <span class="font-cormorant italic text-[22px] md:text-[26px] font-semibold text-ink">Все</span>
        <span class="text-muted text-[13px]">${events.length} ${pluralize(events.length, ['событие','события','событий'])}</span>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
      ${sorted.map(e => renderEventCard(e, statsMap ? statsMap[e.id] : null)).join('')}
    </div>`;
  _observeFadeIn();
}

function pluralize(n, forms) {
  const m = Math.abs(n) % 100;
  const m1 = m % 10;
  if (m > 10 && m < 20) return forms[2];
  if (m1 > 1 && m1 < 5) return forms[1];
  if (m1 === 1) return forms[0];
  return forms[2];
}

function _observeFadeIn() {
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => el.classList.add('visible'));
  window.ToiAppShell?.scheduleSnapshotCapture?.();
}

function cacheStats(eventId, stats) {
  if (!eventId || !stats) return;
  cacheSet(`tl:event:stats:${eventId}`, stats);
  const existing = cacheGet(STATS_CACHE_KEY, 10 * 60_000) || {};
  existing[eventId] = stats;
  cacheSet(STATS_CACHE_KEY, existing);
}

function removeCachedEvent(eventId) {
  const events = cacheGet(EVENTS_CACHE_KEY, 10 * 60_000);
  if (Array.isArray(events)) {
    cacheSet(EVENTS_CACHE_KEY, events.filter(event => event.id !== eventId));
  }
  const statsMap = cacheGet(STATS_CACHE_KEY, 10 * 60_000);
  if (statsMap && typeof statsMap === 'object') {
    delete statsMap[eventId];
    cacheSet(STATS_CACHE_KEY, statsMap);
  }
  try {
    sessionStorage.removeItem(`tl:event:${eventId}`);
    sessionStorage.removeItem(`tl:guests:${eventId}`);
    sessionStorage.removeItem(`tl:event:stats:${eventId}`);
  } catch {}
}

function prefetchLikelyNextSteps(events) {
  window.ToiAppShell?.prefetchPage('/templates.html');
  if (!events || events.length === 0) return;

  const primary = events[0];
  cacheSet(EVENTS_CACHE_KEY, events);
  cacheSet(`tl:event:${primary.id}`, primary);
  window.ToiAppShell?.prefetchPage(`/guests.html?eventId=${primary.id}`);
  window.ToiAppShell?.prefetchPage(`/editor.html?id=${primary.id}`);

  const opts = { credentials: 'include' };
  window.ToiAppShell?.prefetchJSON(`tl:event:${primary.id}`, `${BASE_URL}/api/organizer/events/${primary.id}`, opts, 2 * 60_000);
  window.ToiAppShell?.prefetchJSON(`tl:guests:${primary.id}`, `${BASE_URL}/api/organizer/events/${primary.id}/guests`, opts, 2 * 60_000);
  window.ToiAppShell?.prefetchJSON(`tl:event:stats:${primary.id}`, `${BASE_URL}/api/organizer/events/${primary.id}/stats`, opts, 2 * 60_000);
}

function renderDashboardSnapshot(events, statsMap) {
  if (!events) return false;
  updatePaymentStrip(events);
  if (events.length === 0) {
    renderEmpty();
    return true;
  }
  if (events.length === 1) {
    const event = events[0];
    const stats = statsMap?.[event.id] || cacheGet(`tl:event:stats:${event.id}`, 10 * 60_000) || null;
    renderEventHub(event, stats);
    cacheSet(`tl:event:${event.id}`, event);
    return true;
  }
  renderEvents(events, statsMap || {});
  return true;
}

async function refreshDashboard() {
  const summary = await fetchDashboardSummary();
  const events = summary.map(item => item.event).filter(Boolean);
  const statsMap = summary.reduce((acc, item) => {
    if (item?.event?.id && item.stats) acc[item.event.id] = item.stats;
    return acc;
  }, {});

  cacheSet(EVENTS_CACHE_KEY, events);
  cacheSet(STATS_CACHE_KEY, statsMap);

  if (events.length === 0) {
    renderEmpty();
    prefetchLikelyNextSteps(events);
    return;
  }

  if (events.length === 1) {
    const event = events[0];
    const stats = statsMap[event.id] || cacheGet(`tl:event:stats:${event.id}`, 10 * 60_000) || null;
    if (stats) cacheStats(event.id, stats);
    renderEventHub(event, stats);
    cacheSet(`tl:event:${event.id}`, event);
    fetchGuests(event.id)
      .then((guests) => cacheSet(`tl:guests:${event.id}`, guests))
      .catch(() => {});
    prefetchLikelyNextSteps(events);
    return;
  }

  Object.entries(statsMap).forEach(([eventId, stats]) => cacheStats(Number(eventId), stats));
  renderEvents(events, statsMap);
  prefetchLikelyNextSteps(events);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
window.handleGuests = async function (eventId) {
  const cachedEvent = cacheGet(`tl:event:${eventId}`, 5 * 60_000)
    || (cacheGet(EVENTS_CACHE_KEY, 5 * 60_000) || []).find((event) => event.id === eventId);
  const cachedGuests = cacheGet(`tl:guests:${eventId}`, 5 * 60_000);

  if (cachedEvent && cachedGuests) {
    openGuestsSheet(cachedEvent, cachedGuests);
  }

  try {
    const [events, guests] = await Promise.all([
      fetchEvents(),
      fetchGuests(eventId),
    ]);
    const event = events.find(e => e.id === eventId) || { id: eventId, title: 'Событие' };
    cacheSet(`tl:event:${eventId}`, event);
    cacheSet(`tl:guests:${eventId}`, guests);
    openGuestsSheet(event, guests);
  } catch {
    showToast('Не удалось загрузить гостей');
  }
};

window.copyLink = copyLink;

const _deleteTimers = {};
window.handleDeleteClick = async function (eventId) {
  const btn = document.getElementById('del-' + eventId);
  if (!btn) return;

  if (_deleteTimers[eventId]) {
    clearTimeout(_deleteTimers[eventId]);
    delete _deleteTimers[eventId];
    btn.textContent = 'Удаление...';
    btn.disabled = true;
    try {
      await deleteEvent(eventId);
      removeCachedEvent(eventId);
      const card = document.getElementById('card-' + eventId);
      if (card) {
        card.style.transition = 'opacity .3s ease, transform .3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(.96)';
        setTimeout(() => { card.remove(); init(); }, 300);
      } else {
        // Hub mode — no per-card wrapper, just re-init whole dashboard
        setTimeout(() => init(), 200);
      }
      showToast('Событие удалено');
    } catch {
      showToast('Не удалось удалить');
      btn.textContent = 'Удалить';
      btn.disabled = false;
    }
  } else {
    btn.textContent = 'Нажмите ещё раз';
    btn.style.color = '#f87171';
    _deleteTimers[eventId] = setTimeout(() => {
      delete _deleteTimers[eventId];
      if (btn) { btn.textContent = 'Удалить'; btn.style.color = ''; }
    }, 3000);
  }
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
let _shareDelegationInstalled = false;
function installShareDelegation() {
  if (_shareDelegationInstalled) return;
  _shareDelegationInstalled = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="share-event"]');
    if (!btn) return;
    e.preventDefault();
    const url = btn.getAttribute('data-share-url') || '';
    const title = btn.getAttribute('data-share-title') || '';
    window.shareEvent(url, title);
  });
}

async function init() {
  installShareDelegation();

  // Render cached content immediately — no need to wait for auth network call.
  const cachedEvents = cacheGet(EVENTS_CACHE_KEY, 2 * 60_000);
  const cachedStats = cacheGet(STATS_CACHE_KEY, 2 * 60_000) || {};
  if (cachedEvents) {
    renderDashboardSnapshot(cachedEvents, cachedStats);
    prefetchLikelyNextSteps(cachedEvents);
  }

  const phone = await window.initAuth();
  if (!phone) return;

  document.querySelectorAll('.user-phone').forEach(el => el.textContent = phone);

  if (cachedEvents) {
    refreshDashboard().catch(() => {});
    return;
  }

  try {
    await refreshDashboard();
  } catch {
    document.getElementById('content').innerHTML = `
      <div class="flex flex-col items-center justify-center text-center py-16 md:py-20 px-6 fade-in">
        <div class="w-16 h-16 rounded-2xl bg-cream3 flex items-center justify-center mb-5">
          <svg class="w-7 h-7 text-muted" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="font-cormorant italic text-[24px] text-ink mb-2">Что-то пошло не так</h3>
        <p class="text-muted text-[14px] mb-6 max-w-[300px]">Не удалось загрузить события. Проверьте соединение.</p>
        <button onclick="location.reload()" class="btn-primary">Попробовать снова</button>
      </div>`;
    _observeFadeIn();
  }
}

async function updatePaymentStrip(events) {
  const strip = document.getElementById('paymentStrip');
  if (!strip) return;
  const hasDraft = Array.isArray(events) && events.some(e => e.status === 'DRAFT');
  if (!hasDraft) { strip.style.display = 'none'; return; }

  const draftEvent = events.find(e => e.status === 'DRAFT');
  if (!draftEvent) { strip.style.display = 'none'; return; }

  // Only a submitted payment should block activation UI. PENDING means the user opened paywall but has not clicked "paid" yet.
  let isAwaitingReview = false;
  try {
    const payments = await fetch('/api/organizer/payments', { credentials: 'include' })
      .then(r => r.ok ? r.json() : []);
    isAwaitingReview = payments.some(p => p.eventId === draftEvent.id && p.status === 'AWAITING_CONFIRMATION');
  } catch (_) {}

  strip.style.display = 'flex';
  strip.innerHTML = isAwaitingReview
    ? `<div>
        <p style="font-size:0.8125rem;font-weight:600;color:#fff;margin:0">Оплата на проверке</p>
        <p style="font-size:0.75rem;color:rgba(255,255,255,0.55);margin:0.125rem 0 0">Мы проверяем оплату — активируем в течение нескольких часов</p>
       </div>
       <span style="flex-shrink:0;background:rgba(255,255,255,0.12);color:#fff;border-radius:999px;padding:0.375rem 1rem;font-size:0.8125rem;font-weight:600">Ожидайте</span>`
    : `<div>
        <p style="font-size:0.8125rem;font-weight:600;color:#fff;margin:0">Ваш сайт не активирован</p>
        <p style="font-size:0.75rem;color:rgba(255,255,255,0.55);margin:0.125rem 0 0">Гости не могут открыть ссылку</p>
       </div>
       <a href="/paywall.html?event=${draftEvent.id}" style="flex-shrink:0;background:linear-gradient(135deg,#F93B7A,#FF6D45);color:#fff;border-radius:999px;padding:0.375rem 1rem;font-size:0.8125rem;font-weight:600;white-space:nowrap;text-decoration:none">Активировать</a>`;
}

init();
