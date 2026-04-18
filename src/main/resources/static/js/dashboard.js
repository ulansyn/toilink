// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = '';

// ─── Session cache (warms /guests.html) ──────────────────────────────────────
function cacheSet(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, at: Date.now() })); } catch {}
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function fetchEvents(phone) {
  const res = await fetch(`${BASE_URL}/api/organizer/events`, {
    headers: { 'X-User-Phone': phone },
  });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return res.json();
}

async function fetchGuests(eventId, phone) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${eventId}/guests`, {
    headers: { 'X-User-Phone': phone },
  });
  if (!res.ok) throw new Error('Ошибка загрузки гостей');
  return res.json();
}

async function fetchStats(eventId, phone) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${eventId}/stats`, {
    headers: { 'X-User-Phone': phone },
  });
  if (!res.ok) throw new Error('stats');
  return res.json();
}

async function deleteEvent(eventId, phone) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${eventId}`, {
    method: 'DELETE',
    headers: { 'X-User-Phone': phone },
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

function copyLink(slug) {
  const url = `${location.origin}/e/${slug}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Ссылка скопирована'))
    .catch(() => { prompt('Скопируйте ссылку:', url); });
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

  const invited   = guests.filter(g => g.token).length;
  const anonymous = guests.filter(g => !g.token).length;

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
            <p class="font-cormorant text-[24px] md:text-[28px] font-semibold leading-none" style="color:#1A3D20;">${invited}</p>
            <p class="text-[10px] uppercase tracking-wider mt-1.5 font-medium" style="color:#3D6B45;">Приглашено</p>
          </div>
          <div class="rounded-2xl p-3 md:p-4 text-center" style="background:#F0EDE8;">
            <p class="font-cormorant text-[24px] md:text-[28px] font-semibold leading-none" style="color:#7C6040;">${anonymous}</p>
            <p class="text-[10px] uppercase tracking-wider mt-1.5 font-medium" style="color:#8B7355;">Аноним</p>
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
  const badge = g.token
    ? `<span class="chip chip-published" style="font-size:10px; padding:3px 8px;"><span class="chip-dot"></span>Приглашён</span>`
    : `<span class="chip chip-draft" style="font-size:10px; padding:3px 8px;"><span class="chip-dot"></span>Аноним</span>`;

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
  document.getElementById('content').innerHTML = `
    <div class="flex flex-col items-center justify-center text-center py-16 md:py-24 px-6 fade-in">
      <div class="relative mb-7">
        <div class="w-24 h-24 md:w-28 md:h-28 rounded-[28px] flex items-center justify-center"
             style="background: linear-gradient(160deg, #C2E0C6 0%, #A8D2B0 100%);">
          <svg class="w-10 h-10 md:w-12 md:h-12 text-sage2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <div class="absolute -top-3 -right-3 w-11 h-11 rounded-2xl bg-white border border-line flex items-center justify-center" style="box-shadow:0 6px 18px rgba(30,40,32,.08);">
          <svg class="w-5 h-5 text-sage" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </div>
      </div>
      <div class="text-[10px] tracking-[0.3em] uppercase text-muted font-medium mb-3">Начните с первого</div>
      <h2 class="font-cormorant text-[32px] md:text-[42px] italic font-semibold text-ink leading-tight mb-3">
        Создайте своё <em class="text-sage">первое</em> приглашение
      </h2>
      <p class="text-muted text-[14px] md:text-[15px] max-w-[340px] leading-relaxed mb-8">
        Выберите красивый шаблон, заполните детали — и получите готовую ссылку для гостей за пару минут.
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
      <a href="/e/${event.slug}" target="_blank" rel="noopener" class="event-cover block">
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
            <button onclick="copyLink('${event.slug}')" class="card-btn">
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

// ─── Event Hub (single-event layout) ──────────────────────────────────────────
function renderEventHub(event, stats) {
  // hide generic hero
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

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="fade-in">
      <!-- HERO -->
      <section class="hub-hero">
        ${cover}
        <div class="hub-overlay"></div>
        <div class="hub-status">
          <span class="${statusChipClass(event.status)}"><span class="chip-dot"></span>${statusLabel(event.status)}</span>
        </div>

        <div class="hub-eyebrow">${event.person1 ? event.title : 'Ваше приглашение'}</div>
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
          <button onclick="shareEvent('${event.slug}', ${JSON.stringify(event.title || '').replace(/"/g, '&quot;')})" class="btn-primary">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            Поделиться
          </button>
          <a href="/e/${event.slug}" target="_blank" rel="noopener" class="btn-secondary">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Посмотреть
          </a>
        </div>
      </section>

      <!-- KPI strip -->
      <div class="hub-section-heading">
        <h3>RSVP</h3>
        <span class="sub">нажмите, чтобы открыть список</span>
      </div>
      <div class="kpi-grid">
        <a href="/guests.html?eventId=${event.id}" class="kpi">
          <span class="num" data-kpi="total">${s.total}</span>
          <span class="lbl">Всего гостей</span>
          <span class="kpi-arrow" aria-hidden="true">→</span>
        </a>
        <a href="/guests.html?eventId=${event.id}&filter=attending" class="kpi accent-mint">
          <span class="num" data-kpi="attending">${s.attending}</span>
          <span class="lbl">Придут</span>
          <span class="kpi-arrow" aria-hidden="true">→</span>
        </a>
        <a href="/guests.html?eventId=${event.id}&filter=declined" class="kpi accent-rose">
          <span class="num" data-kpi="declined">${s.declined}</span>
          <span class="lbl">Не смогут</span>
          <span class="kpi-arrow" aria-hidden="true">→</span>
        </a>
        <a href="/guests.html?eventId=${event.id}&filter=noReply" class="kpi accent-gold">
          <span class="num" data-kpi="pending">${pending}</span>
          <span class="lbl">Ждём ответа</span>
          <span class="kpi-arrow" aria-hidden="true">→</span>
        </a>
      </div>

      <!-- Action tiles -->
      <div class="hub-section-heading">
        <h3>Управление</h3>
        <span class="sub">всё необходимое в одном месте</span>
      </div>
      <div class="hub-tiles">
        <a href="/guests.html?eventId=${event.id}" class="hub-tile">
          <div class="hub-tile-icon" style="background: linear-gradient(160deg, #C2E0C6 0%, #A8D2B0 100%); color: #1A3D20;">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="hub-tile-title">Список гостей</div>
            <div class="hub-tile-desc">${s.total > 0 ? `${s.total} ${pluralize(s.total, ['человек','человека','человек'])}` : 'добавьте первого'}</div>
          </div>
          <div class="hub-tile-arrow">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </div>
        </a>

        <a href="/editor.html?id=${event.id}" class="hub-tile">
          <div class="hub-tile-icon" style="background: linear-gradient(160deg, #F5EDE0 0%, #ECDCC2 100%); color: #7C5520;">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="hub-tile-title">Редактировать</div>
            <div class="hub-tile-desc">текст, фото, блоки</div>
          </div>
          <div class="hub-tile-arrow">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </div>
        </a>

        <button onclick="copyLink('${event.slug}')" class="hub-tile w-full text-left">
          <div class="hub-tile-icon" style="background: linear-gradient(160deg, #E0E8F0 0%, #CDD9E8 100%); color: #3A5080;">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="hub-tile-title">Скопировать ссылку</div>
            <div class="hub-tile-desc">для WhatsApp, Telegram</div>
          </div>
          <div class="hub-tile-arrow">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </div>
        </button>
      </div>

      <!-- Footer -->
      <div class="hub-footer">
        <button onclick="copyLink('${event.slug}')" class="slug-pill" title="Скопировать">
          <svg class="w-3.5 h-3.5 text-sage" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          ${location.origin}/e/<strong>${event.slug}</strong>
        </button>
        <div class="flex items-center gap-2">
          <button onclick="showCreateSheet()" class="btn-ghost" style="font-size: 12px;">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Ещё одно событие
          </button>
          <button id="del-${event.id}" onclick="handleDeleteClick(${event.id})" class="danger-link">
            Удалить
          </button>
        </div>
      </div>
    </div>`;
  _observeFadeIn();
}

window.shareEvent = async function (slug, title) {
  const url = `${location.origin}/e/${slug}`;
  const text = title ? `Приглашаю вас на ${title}` : 'Приглашение';
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch { /* user cancelled */ }
  }
  copyLink(slug);
};

function renderEvents(events, statsMap) {
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
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => io.observe(el));
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
window.handleGuests = async function (eventId) {
  const phone = localStorage.getItem('tl_phone');
  if (!phone) return;
  try {
    const [events, guests] = await Promise.all([
      fetchEvents(phone),
      fetchGuests(eventId, phone),
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
  const phone = localStorage.getItem('tl_phone');
  if (!phone) return;

  const btn = document.getElementById('del-' + eventId);
  if (!btn) return;

  if (_deleteTimers[eventId]) {
    clearTimeout(_deleteTimers[eventId]);
    delete _deleteTimers[eventId];
    btn.textContent = 'Удаление...';
    btn.disabled = true;
    try {
      await deleteEvent(eventId, phone);
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
async function init() {
  const phone = await window.initAuth();
  if (!phone) return;

  document.querySelectorAll('.user-phone').forEach(el => el.textContent = phone);

  // reset generic hero visibility (may have been hidden by Hub render previously)
  const genericHero = document.getElementById('genericHero');
  if (genericHero) genericHero.style.display = '';

  try {
    const events = await fetchEvents(phone);
    if (events.length === 0) {
      renderEmpty();
    } else if (events.length === 1) {
      let stats = null;
      try { stats = await fetchStats(events[0].id, phone); } catch { /* optional */ }
      renderEventHub(events[0], stats);
      // Warm cache for /guests.html so KPI click opens instantly
      cacheSet(`tl:event:${events[0].id}`, events[0]);
      fetchGuests(events[0].id, phone)
        .then(guests => cacheSet(`tl:guests:${events[0].id}`, guests))
        .catch(() => {});
    } else {
      // batch-fetch stats, then render
      const statsMap = {};
      const results = await Promise.allSettled(events.map(e => fetchStats(e.id, phone)));
      results.forEach((r, i) => { if (r.status === 'fulfilled') statsMap[events[i].id] = r.value; });
      renderEvents(events, statsMap);
    }
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

init();
