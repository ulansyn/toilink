// ─── State ────────────────────────────────────────────────────────────────────
const BASE_URL = '';
let eventId  = null;
let eventData = null; // full event for slug
let phone    = null;

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'X-User-Phone': phone,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, success = true) {
  const t = document.createElement('div');
  t.className = `fixed left-1/2 -translate-x-1/2 text-white text-sm px-5 py-3 rounded-2xl z-[60] shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-300 ${success ? 'bg-[#1E2820]' : 'bg-red-500'}`;
  t.style.bottom = 'calc(80px + env(safe-area-inset-bottom, 0px))';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2200);
}

// ─── Copy link ────────────────────────────────────────────────────────────────
function guestLink(guest) {
  if (!eventData?.slug || !guest.token) return null;
  return `${location.origin}/e/${eventData.slug}?token=${guest.token}`;
}

function copyGuestLink(guest) {
  const url = guestLink(guest);
  if (!url) { toast('Нет ссылки для этого гостя', false); return; }
  navigator.clipboard.writeText(url)
    .then(() => toast('Ссылка скопирована!'))
    .catch(() => prompt('Ссылка гостя:', url));
}

// ─── Render stats ─────────────────────────────────────────────────────────────
function renderStats(guests) {
  const invited   = guests.filter(g => g.token).length;
  const withNotes = guests.filter(g => g.notes).length;
  document.getElementById('stats').innerHTML = `
    <div class="stat-card bg-[#EDE9E4]">
      <p class="text-[26px] font-bold text-[#1E2820] leading-none">${guests.length}</p>
      <p class="text-[10px] uppercase tracking-wider text-[#6B6860] font-semibold">Всего</p>
    </div>
    <div class="stat-card bg-[#C2E0C6]">
      <p class="text-[26px] font-bold text-[#1A3D20] leading-none">${invited}</p>
      <p class="text-[10px] uppercase tracking-wider text-[#3D6B45] font-semibold">Invited</p>
    </div>
    <div class="stat-card bg-[#F5EFE6]">
      <p class="text-[26px] font-bold text-[#7C6040] leading-none">${withNotes}</p>
      <p class="text-[10px] uppercase tracking-wider text-[#8B7355] font-semibold">Заметки</p>
    </div>`;
}

// ─── Render guest list ────────────────────────────────────────────────────────
function renderGuests(guests) {
  const container = document.getElementById('guest-list');

  if (guests.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-20 h-20 rounded-[24px] bg-[#C2E0C6] flex items-center justify-center mb-5">
          <svg class="w-10 h-10 text-[#3D6B45]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <p class="font-cormorant text-[26px] font-semibold italic text-[#1E2820] mb-2">Гостей пока нет</p>
        <p class="text-[#6B6860] text-sm mb-7 max-w-[220px] leading-relaxed">Добавьте первого гостя и отправьте ему личную ссылку</p>
        <button onclick="openAddSheet()" class="fab">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
          Добавить гостя
        </button>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="space-y-2">${guests.map(g => guestCard(g)).join('')}</div>`;
}

function guestCard(g) {
  const initial  = (g.name || '?')[0].toUpperCase();
  const link     = guestLink(g);
  const avatarColors = [
    'bg-[#C2E0C6] text-[#1A3D20]',
    'bg-[#F5EFE6] text-[#7C6040]',
    'bg-[#DBE4F0] text-[#3A5080]',
    'bg-[#F0E0C8] text-[#7A4A1E]'
  ];
  const colorIdx = (g.name || '').charCodeAt(0) % avatarColors.length;

  return `
    <div id="gc-${g.id}" class="guest-card">
      <div class="flex items-center gap-3 p-4">
        <div class="w-12 h-12 rounded-full ${avatarColors[colorIdx]} flex items-center justify-center font-bold text-base flex-shrink-0">
          ${initial}
        </div>

        <div class="flex-1 min-w-0">
          <p class="font-semibold text-[#1E2820] text-[15px] leading-tight">${g.name || 'Аноним'}</p>
          ${g.phone
            ? `<p class="text-xs text-[#6B6860] mt-0.5">${g.phone}</p>`
            : '<p class="text-xs text-[#6B6860]/60 mt-0.5 italic">Без телефона</p>'}
          ${g.notes ? `<p class="text-xs text-[#6B6860] italic mt-0.5 line-clamp-1">"${g.notes}"</p>` : ''}
        </div>

        <button onclick="copyGuestLink(${JSON.stringify(g).replace(/"/g, '&quot;')})"
          class="flex-shrink-0 px-3 py-2.5 bg-[#C2E0C6] text-[#1A3D20] rounded-xl text-xs font-semibold
                 active:scale-95 transition-transform flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          Ссылка
        </button>
      </div>

      ${link ? `
        <div class="px-4 pb-3 -mt-1">
          <div class="flex items-center gap-2 bg-[#3D6B45]/6 rounded-xl px-3 py-2">
            <svg class="w-3.5 h-3.5 text-[#3D6B45] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
            <p class="text-[10px] text-[#3D6B45] truncate flex-1 font-mono">${link}</p>
          </div>
        </div>` : ''}

      <div class="flex border-t border-[#E8E4DE]/70">
        <a href="/e/${eventData?.slug || ''}?token=${g.token || ''}" target="_blank" rel="noopener"
          class="flex-1 py-3 text-center text-xs text-[#6B6860] hover:text-[#3D6B45] hover:bg-[#3D6B45]/5 transition-colors flex items-center justify-center gap-1.5 font-medium">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          Просмотр
        </a>
        <div class="w-px bg-[#E8E4DE]/70"></div>
        <button id="del-btn-${g.id}" onclick="handleDelete(${g.id})"
          class="flex-1 py-3 text-center text-xs text-[#1E2820]/25 hover:text-red-400 hover:bg-red-50/60 transition-colors font-medium">
          Удалить
        </button>
      </div>
    </div>`;
}

// ─── Delete (soft confirm) ────────────────────────────────────────────────────
const _delTimers = {};
window.handleDelete = async function (guestId) {
  const btn = document.getElementById('del-btn-' + guestId);
  if (!btn) return;

  if (_delTimers[guestId]) {
    clearTimeout(_delTimers[guestId]);
    delete _delTimers[guestId];
    btn.textContent = '...';
    btn.disabled = true;
    try {
      await api('DELETE', `/api/organizer/events/${eventId}/guests/${guestId}`);
      const card = document.getElementById('gc-' + guestId);
      if (card) {
        card.style.transition = 'opacity 0.25s, transform 0.25s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.97)';
        setTimeout(() => {
          card.remove();
          refreshStats();
        }, 250);
      }
      toast('Гость удалён');
    } catch {
      toast('Не удалось удалить', false);
      btn.textContent = 'Удалить';
      btn.disabled = false;
    }
  } else {
    btn.textContent = 'Удалить?';
    btn.style.color = '#f87171';
    _delTimers[guestId] = setTimeout(() => {
      delete _delTimers[guestId];
      if (btn) { btn.textContent = 'Удалить'; btn.style.color = ''; }
    }, 3000);
  }
};

function refreshStats() {
  const cards = document.querySelectorAll('[id^="gc-"]');
  document.getElementById('stats').querySelector('p').textContent = cards.length;
}

// ─── Add guest sheet ──────────────────────────────────────────────────────────
window.openAddSheet = function () {
  document.getElementById('add-backdrop').classList.remove('hidden');
  const sheet = document.getElementById('add-sheet');
  requestAnimationFrame(() => sheet.classList.add('open'));
  document.getElementById('add-name').focus();
};

function closeAddSheet() {
  document.getElementById('add-sheet').classList.remove('open');
  setTimeout(() => document.getElementById('add-backdrop').classList.add('hidden'), 300);
  document.getElementById('add-form').reset();
}

document.getElementById('add-backdrop').addEventListener('click', closeAddSheet);

window.submitAddGuest = async function (e) {
  e.preventDefault();
  const name  = document.getElementById('add-name').value.trim();
  const phone_ = document.getElementById('add-phone').value.trim();
  const notes = document.getElementById('add-notes').value.trim();

  if (!name) {
    document.getElementById('add-name').focus();
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Добавляем...';

  try {
    const guest = await api('POST', `/api/organizer/events/${eventId}/guests`, {
      name,
      phone: phone_ || null,
      notes: notes || null,
    });

    closeAddSheet();

    // Prepend new guest card
    const container = document.getElementById('guest-list');
    const existing = container.querySelector('.space-y-3');
    if (existing) {
      existing.insertAdjacentHTML('afterbegin', guestCard(guest));
    } else {
      // Was empty state — re-render
      container.innerHTML = `<div class="space-y-3">${guestCard(guest)}</div>`;
    }

    // Update stats
    const totalEl = document.querySelector('#stats div:first-child p');
    if (totalEl) totalEl.textContent = parseInt(totalEl.textContent || '0') + 1;
    const invEl = document.querySelector('#stats div:nth-child(2) p');
    if (invEl && guest.token) invEl.textContent = parseInt(invEl.textContent || '0') + 1;

    // Auto-copy link
    if (guest.token && eventData?.slug) {
      const url = `${location.origin}/e/${eventData.slug}?token=${guest.token}`;
      navigator.clipboard.writeText(url).then(() => toast(`Гость добавлен! Ссылка скопирована`));
    } else {
      toast('Гость добавлен!');
    }
  } catch (err) {
    toast(err.message || 'Ошибка', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Добавить и получить ссылку';
  }
};

// Make copyGuestLink accessible from inline onclick with parsed object
window.copyGuestLink = function (g) {
  const link = guestLink(g);
  if (!link) { toast('Нет токена у гостя', false); return; }
  navigator.clipboard.writeText(link)
    .then(() => toast('Ссылка скопирована!'))
    .catch(() => prompt('Ссылка:', link));
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(location.search);
  eventId = params.get('eventId') ? parseInt(params.get('eventId')) : null;

  if (!eventId) { location.href = '/'; return; }

  phone = await window.initAuth();
  if (!phone) return;

  try {
    const [event, guests] = await Promise.all([
      fetch(`${BASE_URL}/api/organizer/events/${eventId}`, {
        headers: { 'X-User-Phone': phone },
      }).then(r => r.json()),
      api('GET', `/api/organizer/events/${eventId}/guests`),
    ]);

    eventData = event;

    // Set page titles
    const name = event.title || 'Гости';
    document.title = `ToiLink — ${name}`;
    document.getElementById('hdr-event-title').textContent = name;
    document.getElementById('mob-event-title').textContent = name;

    renderStats(guests);
    renderGuests(guests);
  } catch (err) {
    document.getElementById('guest-list').innerHTML = `
      <p class="text-center text-[#1E2820]/40 py-12">${err.message || 'Ошибка загрузки'}</p>`;
  }
}

init();
