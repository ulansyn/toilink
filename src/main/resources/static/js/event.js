// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = '';

// ─── Utils ────────────────────────────────────────────────────────────────────
function slug() {
  // /e/abc123 → abc123
  return location.pathname.split('/').filter(Boolean).pop();
}

function guestToken() {
  return new URLSearchParams(location.search).get('token');
}

function previewToken() {
  return new URLSearchParams(location.search).get('preview');
}

function buildPublicEventApiUrl(currentSlug) {
  const url = new URL(`${BASE_URL}/api/public/events/${currentSlug}`, location.origin);
  const preview = previewToken();
  if (preview) url.searchParams.set('preview', preview);
  return url.toString();
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeLinkUrl(value, fallback = '#') {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return fallback;
  if (raw.startsWith('#') || raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw, location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? raw : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeImageUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  if (raw.startsWith('/') || raw.startsWith('blob:')) return raw;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(raw)) return raw;
  try {
    const url = new URL(raw, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? raw : '';
  } catch (_) {
    return '';
  }
}

// ─── Fade-in on scroll ────────────────────────────────────────────────────────
function observeFadeIn() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));
}

// ─── Countdown ────────────────────────────────────────────────────────────────
let _countdownTimer = null;
function startCountdown(iso, container) {
  const target = new Date(iso).getTime();
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      container.innerHTML = '<span class="text-sage">Событие началось!</span>';
      if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    container.innerHTML = `
      <div class="flex gap-3 justify-center">
        ${[['д', d], ['ч', h], ['мин', m], ['сек', s]].map(([l, v]) => `
          <div class="text-center">
            <div class="font-cormorant text-4xl font-semibold text-[#1E2820]">${String(v).padStart(2,'0')}</div>
            <div class="text-xs text-[#1E2820]/50 uppercase tracking-widest mt-1">${l}</div>
          </div>
        `).join('<div class="font-cormorant text-3xl text-sage self-start mt-1">·</div>')}
      </div>`;
  }
  if (_countdownTimer) clearInterval(_countdownTimer);
  tick();
  _countdownTimer = setInterval(tick, 1000);
}

window.addEventListener('pagehide', () => {
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
});

// ─── Block renderers ──────────────────────────────────────────────────────────
const blockRenderers = {
  hero(data, event) {
    const coverImageUrl = safeImageUrl(event.coverImageUrl);
    const title = escapeHtml(data.title || event.title || '');
    return `
      <div class="relative overflow-hidden rounded-3xl mb-6 fade-in">
        ${coverImageUrl
          ? `<img src="${escapeHtml(coverImageUrl)}" alt="cover" class="w-full h-72 md:h-96 object-cover"/>`
          : `<div class="w-full h-72 md:h-96 bg-gradient-to-br from-[#8B7355] via-[#6B8F71] to-[#4A5C4D] flex items-center justify-center">
               <span class="font-cormorant text-5xl text-white/80 italic">${escapeHtml(event.title || '')}</span>
             </div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6">
          <p class="text-white/70 text-sm uppercase tracking-widest mb-2">${escapeHtml(data.subtitle || '')}</p>
          <h1 class="font-cormorant text-4xl md:text-5xl font-semibold text-white leading-tight">${title}</h1>
        </div>
      </div>`;
  },

  countdown(data, event) {
    const dateIso = data.date || event.eventDate;
    if (!dateIso || new Date(dateIso) < new Date()) return '';
    return `
      <div class="bg-white rounded-2xl p-6 mb-4 text-center shadow-sm fade-in">
        <p class="text-[#1E2820]/40 text-xs uppercase tracking-widest mb-4">До события</p>
        <div id="countdown-timer"></div>
      </div>`;
  },

  location(data) {
    if (!data.address) return '';
    // Editor saves the field as `mapLink`; keep `map_url` as legacy fallback
    // for any older configs that pre-date the rename.
    const rawMap = data.mapLink || data.map_url || '';
    const mapUrl = safeLinkUrl(rawMap);
    return `
      <div class="bg-white rounded-2xl p-5 mb-4 flex items-start gap-4 shadow-sm fade-in">
        <div class="w-10 h-10 rounded-xl bg-[#6B8F71]/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-[#6B8F71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <div>
          <p class="text-xs text-[#1E2820]/40 uppercase tracking-widest mb-1">Место</p>
          <p class="text-[#1E2820] font-medium">${escapeHtml(data.address)}</p>
          ${rawMap ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener" class="text-[#6B8F71] text-sm mt-1 inline-block hover:underline">Открыть на карте →</a>` : ''}
        </div>
      </div>`;
  },

  dress_code(data) {
    if (!data.text) return '';
    return `
      <div class="bg-[#F5F0E8] rounded-2xl p-5 mb-4 fade-in">
        <p class="text-xs text-[#1E2820]/40 uppercase tracking-widest mb-2">Дресс-код</p>
        <p class="text-[#1E2820]/80">${escapeHtml(data.text)}</p>
      </div>`;
  },

  info(data) {
    if (!data.text) return '';
    return `
      <div class="bg-white rounded-2xl p-5 mb-4 shadow-sm fade-in">
        ${data.title ? `<p class="font-medium text-[#1E2820] mb-2">${escapeHtml(data.title)}</p>` : ''}
        <p class="text-[#1E2820]/70 leading-relaxed">${escapeHtml(data.text)}</p>
      </div>`;
  },
};

// ─── Render blocks ─────────────────────────────────────────────────────────────
function renderBlocks(event) {
  const container = document.getElementById('blocks');
  if (!container) return;

  let schema = [];
  try { schema = JSON.parse(event.blocksSchema || '[]'); } catch (_) {}

  let config = {};
  try { config = JSON.parse(event.blocksConfig || '{}'); } catch (_) {}

  let html = '';
  for (const block of schema) {
    const data = config[block.type] || {};
    const renderer = blockRenderers[block.type];
    if (renderer) html += renderer(data, event);
  }

  // If no schema — render a basic info block from top-level fields
  if (!schema.length) {
    html = blockRenderers.hero({}, event);
  }

  container.innerHTML = html;

  // Start countdown if rendered
  const timerEl = document.getElementById('countdown-timer');
  if (timerEl && event.eventDate) startCountdown(event.eventDate, timerEl);

  observeFadeIn();
}

// ─── RSVP form ────────────────────────────────────────────────────────────────
let selectedStatus = null;

function renderRsvp(event) {
  const container = document.getElementById('rsvp');
  if (!container) return;

  const isDraft = event.status === 'DRAFT';
  const isClosed = event.status === 'CLOSED';
  const deadlinePassed = event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date();

  if (isDraft || isClosed || deadlinePassed) {
    const title = isDraft ? 'Предпросмотр приглашения' : 'Приём ответов завершён';
    const subtitle = isDraft
      ? 'Событие ещё не опубликовано, поэтому ответы гостей пока отключены.'
      : 'Спасибо за внимание к приглашению.';
    container.innerHTML = `
      <div class="text-center py-6 text-[#1E2820]/40">
        <p class="text-lg">${title}</p>
        <p class="text-sm mt-2">${subtitle}</p>
      </div>`;
    return;
  }

  const hasToken = !!guestToken();

  container.innerHTML = `
    <div class="bg-white rounded-3xl p-6 shadow-sm fade-in">
      <p class="font-cormorant text-2xl font-semibold text-[#1E2820] mb-1">Вы придёте?</p>
      <p class="text-[#1E2820]/40 text-sm mb-6">Пожалуйста, подтвердите своё присутствие</p>

      ${!hasToken ? `
        <div class="mb-5">
          <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-2 block">Ваше имя</label>
          <input id="rsvp-name" type="text" placeholder="Как вас зовут?"
            class="w-full bg-[#FFF8FB] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#1E2820] outline-none focus:border-[#6B8F71] transition-colors"/>
        </div>` : ''}

      <div class="mb-5">
        <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-3 block">Сколько человек придёт?</label>
        <div class="flex items-center gap-4">
          <button onclick="changeGroupSize(-1)" class="w-10 h-10 rounded-full border border-[#E5E0D8] flex items-center justify-center text-xl text-[#1E2820]/60 active:scale-95 transition-transform">−</button>
          <span id="group-size-val" class="font-cormorant text-3xl font-semibold text-[#1E2820] w-8 text-center">1</span>
          <button onclick="changeGroupSize(1)" class="w-10 h-10 rounded-full border border-[#E5E0D8] flex items-center justify-center text-xl text-[#1E2820]/60 active:scale-95 transition-transform">+</button>
        </div>
      </div>

      <div class="flex flex-col gap-3 mb-5">
        ${[
          { status: 'ATTENDING', label: 'Приду!', emoji: '✓', active: 'bg-[#6B8F71] text-white border-[#6B8F71]' },
          { status: 'MAYBE',    label: 'Возможно', emoji: '~', active: 'bg-[#B8A98A] text-white border-[#B8A98A]' },
          { status: 'DECLINED', label: 'Не приду',  emoji: '✕', active: 'bg-[#1E2820] text-white border-[#1E2820]' },
        ].map(btn => `
          <button id="btn-${btn.status}"
            onclick="selectStatus('${btn.status}')"
            class="rsvp-btn w-full py-4 rounded-2xl border-2 border-[#E5E0D8] text-[#1E2820]/60 font-medium transition-all duration-200 active:scale-[0.98] text-base"
            data-active-class="${btn.active}">
            ${btn.label}
          </button>`).join('')}
      </div>

      <div class="mb-5">
        <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-2 block">Комментарий (необязательно)</label>
        <textarea id="rsvp-comment" rows="2" placeholder="Пожелания, аллергии..."
          class="w-full bg-[#FFF8FB] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#1E2820] outline-none focus:border-[#6B8F71] transition-colors resize-none"></textarea>
      </div>

      <button onclick="submitRsvp('${event.slug}')"
        class="w-full py-4 bg-[#1E2820] text-white rounded-2xl font-medium text-base active:scale-[0.98] transition-all duration-200 hover:bg-[#2d3d2e]">
        Отправить ответ
      </button>
    </div>`;

  observeFadeIn();
}

let groupSize = 1;
window.changeGroupSize = function(delta) {
  groupSize = Math.max(1, Math.min(20, groupSize + delta));
  document.getElementById('group-size-val').textContent = groupSize;
};

window.selectStatus = function(status) {
  selectedStatus = status;
  document.querySelectorAll('.rsvp-btn').forEach(btn => {
    btn.className = btn.className.replace(/bg-\S+|text-white|border-\[#[^\]]+\]/g, '').trim();
    btn.classList.add('border-[#E5E0D8]', 'text-[#1E2820]/60');
  });
  const active = document.getElementById('btn-' + status);
  if (active) {
    const cls = (active.dataset.activeClass || '').split(' ').filter(Boolean);
    active.classList.remove('border-[#E5E0D8]', 'text-[#1E2820]/60');
    if (cls.length) active.classList.add(...cls);
  }
};

window.submitRsvp = async function(slug) {
  if (!selectedStatus) {
    showToast('Выберите вариант ответа');
    return;
  }
  const name = document.getElementById('rsvp-name')?.value?.trim() || null;
  const comment = document.getElementById('rsvp-comment')?.value?.trim() || null;
  const savedToken = (() => {
    try { return localStorage.getItem(`rsvp:${slug}:token`); } catch (_) { return null; }
  })();
  const token = guestToken() || savedToken || null;

  try {
    const res = await fetch(`${BASE_URL}/api/public/events/${slug}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestToken: token,
        name,
        status: selectedStatus,
        groupSize,
        comment,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Ошибка');
    const data = await res.json().catch(() => ({}));
    if (data.guestToken) {
      try { localStorage.setItem(`rsvp:${slug}:token`, data.guestToken); } catch (_) {}
    }
    showConfirmation(selectedStatus);
  } catch (e) {
    showToast(e.message);
  }
};

function showConfirmation(status) {
  const messages = {
    ATTENDING: { icon: '🎉', title: 'Отлично! Ждём вас!', sub: 'Ваш ответ сохранён. До встречи на событии!' },
    MAYBE:     { icon: '🙏', title: 'Хорошо, спасибо!', sub: 'Мы учли ваш ответ. Надеемся вас увидеть!' },
    DECLINED:  { icon: '💌', title: 'Спасибо, что сообщили', sub: 'Жаль, что не получится. Будем рады в следующий раз!' },
  };
  const m = messages[status] || messages.ATTENDING;
  document.getElementById('rsvp').innerHTML = `
    <div class="bg-white rounded-3xl p-8 text-center shadow-sm">
      <div class="text-5xl mb-4">${m.icon}</div>
      <p class="font-cormorant text-2xl font-semibold text-[#1E2820] mb-2">${m.title}</p>
      <p class="text-[#1E2820]/50 text-sm leading-relaxed">${m.sub}</p>
    </div>`;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1E2820] text-white text-sm px-5 py-3 rounded-2xl z-50 shadow-lg';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── Date/location header ──────────────────────────────────────────────────────
function renderEventMeta(event) {
  const el = document.getElementById('event-meta');
  if (!el) return;
  const parts = [];
  if (event.eventDate) parts.push(formatDate(event.eventDate) + (formatTime(event.eventDate) ? ' в ' + formatTime(event.eventDate) : ''));
  if (event.location) parts.push(event.location);
  el.textContent = parts.join(' · ');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  const s = slug();
  try {
    const res = await fetch(buildPublicEventApiUrl(s));
    if (!res.ok) { renderError(); return; }
    const event = await res.json();
    renderEventMeta(event);
    renderBlocks(event);
    renderRsvp(event);
  } catch (_) {
    renderError();
  }
}

function renderError() {
  document.getElementById('app').innerHTML = `
    <div class="min-h-screen bg-[#FFF8FB] flex items-center justify-center p-6">
      <div class="text-center">
        <p class="font-cormorant text-6xl text-[#1E2820]/20 mb-4">404</p>
        <p class="text-[#1E2820]/40">Событие не найдено</p>
      </div>
    </div>`;
}

init();
