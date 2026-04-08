// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = '';

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

function statusLabel(status) {
  return { DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', CLOSED: 'Закрыто' }[status] || status;
}

function statusChipClass(status) {
  return { DRAFT: 'chip chip-draft', PUBLISHED: 'chip chip-published', CLOSED: 'chip chip-closed' }[status] || 'chip chip-draft';
}

function copyLink(slug) {
  const url = `${location.origin}/e/${slug}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Ссылка скопирована!'))
    .catch(() => { prompt('Скопируйте ссылку:', url); });
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed left-1/2 -translate-x-1/2 bg-[#1E2820] text-white text-sm px-5 py-3 rounded-2xl z-50 shadow-lg whitespace-nowrap pointer-events-none transition-all duration-300';
  t.style.bottom = 'calc(80px + env(safe-area-inset-bottom, 0px))';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2200);
}

// ─── Guests bottom sheet ──────────────────────────────────────────────────────
function openGuestsSheet(event, guests) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 bg-black/40 z-40 backdrop-blur-sm';

  const sheet = document.createElement('div');
  sheet.className = 'fixed bottom-0 left-0 right-0 z-50 bg-[#FAFAF8] rounded-t-[28px] max-h-[88vh] flex flex-col md:max-w-lg md:left-1/2 md:-translate-x-1/2';
  sheet.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';

  function close() { backdrop.remove(); sheet.remove(); }
  backdrop.onclick = close;

  const invited   = guests.filter(g => g.token).length;
  const anonymous = guests.filter(g => !g.token).length;

  sheet.innerHTML = `
    <div class="flex justify-center pt-3 pb-1 flex-shrink-0">
      <div class="w-10 h-1 bg-[#1E2820]/10 rounded-full"></div>
    </div>

    <div class="flex items-center justify-between px-6 pt-3 pb-4 border-b border-[#E8E4DE] flex-shrink-0">
      <div>
        <p class="font-semibold text-[#1E2820] text-[17px]">Гости</p>
        <p class="text-xs text-[#6B6860] mt-0.5 font-cormorant italic">${event.title}</p>
      </div>
      <button id="guests-close-btn"
        class="w-9 h-9 rounded-full bg-[#EDE9E4] flex items-center justify-center text-[#6B6860] text-sm font-medium active:scale-90 transition-transform">✕</button>
    </div>

    <div class="grid grid-cols-3 gap-3 px-5 py-4 flex-shrink-0">
      <div class="bg-[#EDE9E4] rounded-2xl p-3 text-center">
        <p class="text-[22px] font-bold text-[#1E2820] leading-none">${guests.length}</p>
        <p class="text-[10px] uppercase tracking-wider text-[#6B6860] mt-1 font-medium">Всего</p>
      </div>
      <div class="bg-[#C2E0C6] rounded-2xl p-3 text-center">
        <p class="text-[22px] font-bold text-[#1A3D20] leading-none">${invited}</p>
        <p class="text-[10px] uppercase tracking-wider text-[#3D6B45] mt-1 font-medium">Invited</p>
      </div>
      <div class="bg-[#F5EFE6] rounded-2xl p-3 text-center">
        <p class="text-[22px] font-bold text-[#7C6040] leading-none">${anonymous}</p>
        <p class="text-[10px] uppercase tracking-wider text-[#8B7355] mt-1 font-medium">Аноним</p>
      </div>
    </div>

    <div class="overflow-y-auto flex-1 px-4 pb-4">
      ${guests.length === 0
        ? `<div class="flex flex-col items-center justify-center py-14 text-center">
             <div class="w-16 h-16 rounded-3xl bg-[#C2E0C6] flex items-center justify-center mb-4">
               <svg class="w-8 h-8 text-[#3D6B45]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
               </svg>
             </div>
             <p class="text-[#1E2820]/50 text-sm">Гостей пока нет</p>
           </div>`
        : guests.map(g => guestRow(g)).join('')}
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  sheet.querySelector('#guests-close-btn').addEventListener('click', close);
  sheet.style.transform = 'translateY(100%)';
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
  requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; });
}

function guestRow(g) {
  const initial = (g.name || '?')[0].toUpperCase();
  const avatarColors = ['bg-[#C2E0C6] text-[#1A3D20]', 'bg-[#F5EFE6] text-[#7C6040]', 'bg-[#DBE4F0] text-[#3A5080]', 'bg-[#F0E0C8] text-[#7A4A1E]'];
  const idx = (g.name || '').charCodeAt(0) % avatarColors.length;
  const badge = g.token
    ? `<span class="text-[10px] px-2 py-0.5 rounded-lg bg-[#C2E0C6] text-[#1A3D20] font-semibold">Invited</span>`
    : `<span class="text-[10px] px-2 py-0.5 rounded-lg bg-[#EDE9E4] text-[#6B6860] font-semibold">Аноним</span>`;

  return `
    <div class="flex items-center gap-3 py-3 border-b border-[#E8E4DE]/60 last:border-0">
      <div class="w-10 h-10 rounded-full ${avatarColors[idx]} flex items-center justify-center font-bold text-sm flex-shrink-0">
        ${initial}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-[#1E2820] font-medium text-sm">${g.name || 'Аноним'}</p>
          ${badge}
        </div>
        ${g.phone ? `<p class="text-[#6B6860] text-xs mt-0.5">${g.phone}</p>` : ''}
        ${g.notes ? `<p class="text-[#6B6860] text-xs italic mt-0.5 line-clamp-1">"${g.notes}"</p>` : ''}
      </div>
    </div>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderEmpty() {
  document.getElementById('content').innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[55vh] text-center px-6">
      <div class="w-24 h-24 rounded-[28px] bg-[#C2E0C6] flex items-center justify-center mb-6">
        <svg class="w-12 h-12 text-[#3D6B45]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/>
        </svg>
      </div>
      <p class="font-cormorant text-[28px] font-semibold text-[#1E2820] mb-2 italic">Нет событий</p>
      <p class="text-[#6B6860] text-sm mb-8 leading-relaxed max-w-[240px]">
        Создайте первое приглашение для вашего особенного события
      </p>
      <a href="/editor.html"
        class="fab">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
        </svg>
        Создать приглашение
      </a>
    </div>`;
}

function renderEventCard(event, phone) {
  const coverHtml = event.coverImageUrl
    ? `<img src="${event.coverImageUrl}" alt="cover" class="w-full h-full object-cover"/>`
    : `<div class="w-full h-full bg-gradient-to-br from-[#5C7E62] via-[#3D6B45] to-[#2D5235] flex items-center justify-center">
         <span class="font-cormorant text-white/70 italic text-lg px-4 text-center leading-snug">${event.title}</span>
       </div>`;

  return `
    <div id="card-${event.id}" class="m3-card overflow-hidden fade-in">
      <a href="/e/${event.slug}" target="_blank" rel="noopener" class="relative block h-44 overflow-hidden group">
        ${coverHtml}
        <div class="absolute top-3 right-3">
          <span class="${statusChipClass(event.status)}">${statusLabel(event.status)}</span>
        </div>
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
          <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-[#1E2820]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            <span class="text-xs font-semibold text-[#1E2820]">Открыть</span>
          </div>
        </div>
      </a>

      <div class="p-5">
        <p class="font-cormorant text-[22px] font-semibold text-[#1E2820] leading-tight mb-0.5 italic">${event.title}</p>
        ${event.person1
          ? `<p class="text-[#3D6B45] text-sm font-medium mb-3">${event.person1}${event.person2 ? ' & ' + event.person2 : ''}</p>`
          : '<div class="mb-3"></div>'}

        <div class="flex flex-col gap-1.5 mb-4">
          ${event.eventDate ? `
            <div class="flex items-center gap-2 text-[#6B6860] text-xs">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <span>${formatDate(event.eventDate)}</span>
            </div>` : ''}
          ${event.location ? `
            <div class="flex items-center gap-2 text-[#6B6860] text-xs">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span class="truncate">${event.location}</span>
            </div>` : ''}
        </div>

        <div class="flex gap-2 mb-3">
          <a href="/guests.html?eventId=${event.id}" class="card-btn card-btn-primary">Гости</a>
          <button onclick="copyLink('${event.slug}')" class="card-btn">Ссылка</button>
          <a href="/editor.html?id=${event.id}" class="card-btn">Изменить</a>
        </div>

        <button
          id="del-${event.id}"
          onclick="handleDeleteClick(${event.id})"
          class="w-full py-2 text-xs text-[#1E2820]/20 hover:text-red-400 transition-colors rounded-xl font-medium">
          Удалить
        </button>
      </div>
    </div>`;
}

function renderEvents(events, phone) {
  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${events.map(e => renderEventCard(e, phone)).join('')}
    </div>`;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));
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
    const event = events.find(e => e.id === eventId) || { title: 'Событие' };
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
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.96)';
        setTimeout(() => card.remove(), 300);
      }
      showToast('Событие удалено');
    } catch {
      showToast('Не удалось удалить');
      btn.textContent = 'Удалить';
      btn.disabled = false;
    }
  } else {
    btn.textContent = 'Нажмите ещё раз для удаления';
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

  try {
    const events = await fetchEvents(phone);
    if (events.length === 0) {
      renderEmpty();
    } else {
      renderEvents(events, phone);
    }
  } catch {
    document.getElementById('content').innerHTML = `
      <div class="text-center py-20 text-[#6B6860]">
        <div class="w-16 h-16 rounded-3xl bg-[#EDE9E4] flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-[#6B6860]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <p class="text-sm mb-4">Не удалось загрузить события</p>
        <button onclick="location.reload()" class="px-5 py-2.5 bg-[#C2E0C6] text-[#1A3D20] rounded-full text-sm font-semibold active:scale-95 transition-transform">
          Попробовать снова
        </button>
      </div>`;
  }
}

init();
