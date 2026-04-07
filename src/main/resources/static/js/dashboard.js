// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = '';

// ─── Auth stub ────────────────────────────────────────────────────────────────
function getPhone() {
  return localStorage.getItem('tl_phone');
}

function setPhone(phone) {
  localStorage.setItem('tl_phone', phone);
}

function promptPhone() {
  const phone = prompt('Введите ваш номер телефона для входа:\n(например: +996700000000)');
  if (!phone || phone.trim().length < 7) return null;
  const clean = phone.trim();
  setPhone(clean);
  return clean;
}

function requirePhone() {
  return getPhone() || promptPhone();
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

function statusClass(status) {
  return {
    DRAFT:     'bg-[#F5F0E8] text-[#B8A98A]',
    PUBLISHED: 'bg-[#6B8F71]/10 text-[#6B8F71]',
    CLOSED:    'bg-[#1E2820]/8 text-[#1E2820]/40',
  }[status] || 'bg-gray-100 text-gray-500';
}

function copyLink(slug) {
  const url = `${location.origin}/e/${slug}`;
  navigator.clipboard.writeText(url).then(() => showToast('Ссылка скопирована!')).catch(() => {
    prompt('Скопируйте ссылку:', url);
  });
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-[#1E2820] text-white text-sm px-5 py-3 rounded-2xl z-50 shadow-lg whitespace-nowrap';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ─── Guests bottom sheet ──────────────────────────────────────────────────────
function openGuestsSheet(event, guests) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 bg-black/40 z-40 backdrop-blur-sm';
  backdrop.onclick = () => { backdrop.remove(); sheet.remove(); };

  const attending = guests.filter(g => g.rsvpStatus === 'ATTENDING').length;

  const sheet = document.createElement('div');
  sheet.className = 'fixed bottom-0 left-0 right-0 z-50 bg-[#FAFAF8] rounded-t-3xl max-h-[80vh] flex flex-col md:max-w-lg md:left-1/2 md:-translate-x-1/2';
  sheet.innerHTML = `
    <div class="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E5E0D8]">
      <div>
        <p class="font-cormorant text-xl font-semibold text-[#1E2820]">Гости</p>
        <p class="text-xs text-[#1E2820]/40 mt-0.5">${event.title} · ${guests.length} чел.</p>
      </div>
      <button onclick="this.closest('.fixed').previousSibling.click()" class="w-8 h-8 rounded-full bg-[#1E2820]/8 flex items-center justify-center text-[#1E2820]/40 active:scale-95">✕</button>
    </div>
    <div class="overflow-y-auto flex-1 p-4">
      ${guests.length === 0
        ? `<div class="text-center py-10 text-[#1E2820]/30">
             <p class="text-4xl mb-3">👥</p>
             <p>Гостей пока нет</p>
           </div>`
        : guests.map(g => `
            <div class="flex items-center gap-3 py-3 border-b border-[#E5E0D8]/50 last:border-0">
              <div class="w-9 h-9 rounded-full bg-[#6B8F71]/10 flex items-center justify-center text-[#6B8F71] font-medium text-sm flex-shrink-0">
                ${(g.name || '?')[0].toUpperCase()}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[#1E2820] font-medium text-sm truncate">${g.name || 'Аноним'}</p>
                ${g.phone ? `<p class="text-[#1E2820]/40 text-xs">${g.phone}</p>` : ''}
              </div>
              <div class="flex-shrink-0">
                <span class="text-xs px-2 py-1 rounded-full ${g.token ? 'bg-[#6B8F71]/10 text-[#6B8F71]' : 'bg-[#F5F0E8] text-[#B8A98A]'}">
                  ${g.token ? '✓ Приглашён' : 'Анонимный'}
                </span>
              </div>
            </div>`).join('')}
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  // animate in
  sheet.style.transform = 'translateY(100%)';
  sheet.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
  requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; });
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderEmpty() {
  document.getElementById('content').innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div class="w-20 h-20 rounded-3xl bg-[#6B8F71]/10 flex items-center justify-center mb-6">
        <svg class="w-10 h-10 text-[#6B8F71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/>
        </svg>
      </div>
      <p class="font-cormorant text-2xl font-semibold text-[#1E2820] mb-2">Нет событий</p>
      <p class="text-[#1E2820]/40 text-sm mb-8 leading-relaxed">Создайте первое приглашение<br/>для вашего особенного события</p>
      <a href="/editor.html" class="px-8 py-4 bg-[#1E2820] text-white rounded-2xl font-medium text-sm active:scale-[0.98] transition-transform hover:bg-[#2d3d2e]">
        Создать приглашение
      </a>
    </div>`;
}

function renderEventCard(event, phone) {
  return `
    <div class="bg-white rounded-3xl overflow-hidden shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 fade-in">
      <!-- Cover -->
      <div class="relative h-40 overflow-hidden">
        ${event.coverImageUrl
          ? `<img src="${event.coverImageUrl}" alt="cover" class="w-full h-full object-cover"/>`
          : `<div class="w-full h-full bg-gradient-to-br from-[#8B7355] via-[#6B8F71] to-[#4A5C4D] flex items-center justify-center">
               <span class="font-cormorant text-white/60 italic text-2xl">${event.title}</span>
             </div>`}
        <div class="absolute top-3 right-3">
          <span class="text-xs px-3 py-1 rounded-full font-medium ${statusClass(event.status)}">
            ${statusLabel(event.status)}
          </span>
        </div>
      </div>

      <!-- Info -->
      <div class="p-5">
        <p class="font-cormorant text-xl font-semibold text-[#1E2820] leading-tight mb-1">${event.title}</p>
        ${event.person1 ? `<p class="text-[#6B8F71] text-sm mb-3">${event.person1}${event.person2 ? ' & ' + event.person2 : ''}</p>` : '<div class="mb-3"></div>'}

        <div class="flex flex-col gap-1.5 mb-4">
          ${event.eventDate ? `
            <div class="flex items-center gap-2 text-[#1E2820]/50 text-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${formatDate(event.eventDate)}
            </div>` : ''}
          ${event.location ? `
            <div class="flex items-center gap-2 text-[#1E2820]/50 text-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
              <span class="truncate">${event.location}</span>
            </div>` : ''}
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button onclick="handleGuests(${event.id})"
            class="flex-1 py-2.5 border border-[#E5E0D8] rounded-xl text-[#1E2820]/60 text-sm font-medium active:scale-[0.98] transition-transform hover:border-[#6B8F71] hover:text-[#6B8F71]">
            👥 Гости
          </button>
          <button onclick="copyLink('${event.slug}')"
            class="flex-1 py-2.5 border border-[#E5E0D8] rounded-xl text-[#1E2820]/60 text-sm font-medium active:scale-[0.98] transition-transform hover:border-[#6B8F71] hover:text-[#6B8F71]">
            🔗 Ссылка
          </button>
          <a href="/editor.html?id=${event.id}"
            class="flex-1 py-2.5 border border-[#E5E0D8] rounded-xl text-[#1E2820]/60 text-sm font-medium text-center active:scale-[0.98] transition-transform hover:border-[#6B8F71] hover:text-[#6B8F71]">
            ✏️ Редакт.
          </a>
        </div>
      </div>
    </div>`;
}

function renderEvents(events, phone) {
  document.getElementById('content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${events.map(e => renderEventCard(e, phone)).join('')}
    </div>`;

  // observe fade-in
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.05 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
window.handleGuests = async function(eventId) {
  const phone = requirePhone();
  if (!phone) return;
  try {
    const [events, guests] = await Promise.all([
      fetchEvents(phone),
      fetchGuests(eventId, phone),
    ]);
    const event = events.find(e => e.id === eventId);
    openGuestsSheet(event || { title: 'Событие' }, guests);
  } catch (e) {
    showToast('Не удалось загрузить гостей');
  }
};

window.copyLink = copyLink;

// ─── Bottom nav active tab ────────────────────────────────────────────────────
function initBottomNav() {
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('text-[#6B8F71]'));
      tab.classList.add('text-[#6B8F71]');
    });
  });
  // Set home as active on load
  document.querySelector('[data-tab="home"]')?.classList.add('text-[#6B8F71]');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  const phone = requirePhone();
  if (!phone) {
    document.getElementById('content').innerHTML = `
      <div class="text-center py-20 text-[#1E2820]/40">
        <p>Необходимо указать номер телефона</p>
        <button onclick="location.reload()" class="mt-4 text-[#6B8F71] underline text-sm">Попробовать снова</button>
      </div>`;
    return;
  }

  // Show user phone in header
  document.querySelectorAll('.user-phone').forEach(el => el.textContent = phone);

  try {
    const events = await fetchEvents(phone);
    if (events.length === 0) {
      renderEmpty();
    } else {
      renderEvents(events, phone);
    }
  } catch (e) {
    showToast('Ошибка загрузки');
  }

  initBottomNav();
}

init();
