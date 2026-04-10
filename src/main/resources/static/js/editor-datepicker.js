// ═══════════════════════════════════════════════════════════════════════════
// Editor DatePicker — кастомные пикеры даты/времени
// Depends on: editor-utils.js (esc), setFieldState, markDirty, debouncedPreview
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_RU  = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WDAYS      = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ─── State ────────────────────────────────────────────────────────────────
let _dp = { cb: null, type: null, year: 2026, month: 3, day: null, hour: 12, minute: 0 };

// ─── Formatters ───────────────────────────────────────────────────────────
function formatDTDisplay(val) {
  if (!val) return '';
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '';
  return `${+m[3]} ${MONTHS_GEN[+m[2]-1]} ${m[1]}, ${m[4]}:${m[5]}`;
}

function parseDTLocal(val) {
  const m = (val||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { year:+m[1], month:+m[2]-1, day:+m[3], hour:+m[4], minute:+m[5] };
}

function toDTLocal(s) {
  const p = n => String(n).padStart(2,'0');
  return `${s.year}-${p(s.month+1)}-${p(s.day)}T${p(s.hour)}:${p(s.minute)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────
function openDateTimePicker(fieldPath, currentVal) {
  const parsed = parseDTLocal(currentVal);
  const now = new Date();
  _dp = {
    type: 'datetime',
    year:   parsed?.year   ?? now.getFullYear(),
    month:  parsed?.month  ?? now.getMonth(),
    day:    parsed?.day    ?? null,
    hour:   parsed?.hour   ?? 12,
    minute: parsed?.minute ?? 0,
    cb: (val) => {
      setFieldState(fieldPath, val);
      markDirty();
      debouncedPreview();
      const id = 'f_' + fieldPath.replace(/[^a-zA-Z0-9_-]/g, '_');
      const span = document.getElementById(id)?.querySelector('[data-dt-display]');
      if (span) {
        span.textContent = formatDTDisplay(val) || 'Выбрать дату и время';
        span.style.color = val ? '#1E2820' : '#B0AB9E';
      }
    },
  };
  _renderPicker();
  _openSheet();
}

function openTimePicker(inputEl) {
  const m = (inputEl.value || '').match(/^(\d{1,2}):(\d{2})/);
  _dp = {
    type: 'time',
    year: 2026, month: 0, day: null,
    hour:   m ? +m[1] : 12,
    minute: m ? +m[2] : 0,
    cb: (val) => {
      inputEl.value = val;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    },
  };
  _renderPicker();
  _openSheet();
}

// ─── Sheet lifecycle ──────────────────────────────────────────────────────
function _openSheet() {
  const sheet = document.getElementById('datePickerSheet');
  if (!sheet) return;
  sheet.classList.remove('hidden');
  requestAnimationFrame(() => {
    const bd = document.getElementById('dpBackdrop');
    const p  = document.getElementById('dpPanel');
    if (bd) bd.style.opacity = '1';
    if (p)  p.style.transform = 'translateY(0)';
  });
}

function _closeSheet() {
  const bd = document.getElementById('dpBackdrop');
  const p  = document.getElementById('dpPanel');
  if (bd) bd.style.opacity = '0';
  if (p)  p.style.transform = 'translateY(100%)';
  setTimeout(() => document.getElementById('datePickerSheet')?.classList.add('hidden'), 280);
}

// ─── Renderers ────────────────────────────────────────────────────────────
function _renderPicker() {
  const panel = document.getElementById('dpPanel');
  if (!panel) return;
  panel.innerHTML = _dp.type === 'time' ? _buildTimeUI() : _buildDateTimeUI();
}

function _buildDateTimeUI() {
  const h = String(_dp.hour).padStart(2,'0');
  const m = String(_dp.minute).padStart(2,'0');
  const confirmDisabled = !_dp.day;
  return `
    <div class="relative flex items-center justify-between px-4 pt-5 pb-3">
      <div class="absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 rounded-full bg-[#DDD9D4]"></div>
      <span class="text-[14px] font-semibold text-[#1E2820]">Дата и время</span>
      <button id="dpConfirm" class="h-8 px-4 rounded-full text-[12px] font-semibold text-white transition-opacity
        ${confirmDisabled ? 'bg-[#DDD9D4] pointer-events-none' : 'bg-[#1E2820] active:opacity-75'}">Готово</button>
    </div>

    <div class="px-3 pb-1">
      <div class="flex items-center justify-between mb-2 px-1">
        <button id="dpPrevMonth" class="w-9 h-9 rounded-full bg-[#F5F3F0] flex items-center justify-center active:scale-93 transition-transform">
          <svg width="16" height="16" fill="none" stroke="#1E2820" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="text-[14px] font-semibold text-[#1E2820]">${MONTHS_RU[_dp.month]} ${_dp.year}</span>
        <button id="dpNextMonth" class="w-9 h-9 rounded-full bg-[#F5F3F0] flex items-center justify-center active:scale-93 transition-transform">
          <svg width="16" height="16" fill="none" stroke="#1E2820" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      ${_buildCalendarGrid(_dp.year, _dp.month, _dp.day)}
    </div>

    <div class="mx-3 mb-4 mt-1 px-3 py-3 rounded-2xl bg-[#F5F3F0] flex items-center justify-center gap-3">
      <span class="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#9A9491] w-12 text-right">Время</span>
      <div class="flex items-center gap-1.5">
        <button data-dp-adj="hour:-1" class="w-7 h-7 rounded-full bg-white border border-[#E8E5E1] flex items-center justify-center active:scale-90">
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>
        </button>
        <span id="dpHour" class="w-9 text-center text-[18px] font-semibold text-[#1E2820] tabular-nums">${h}</span>
        <button data-dp-adj="hour:1" class="w-7 h-7 rounded-full bg-white border border-[#E8E5E1] flex items-center justify-center active:scale-90">
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
      <span class="text-[18px] font-semibold text-[#9A9491]">:</span>
      <div class="flex items-center gap-1.5">
        <button data-dp-adj="min:-5" class="w-7 h-7 rounded-full bg-white border border-[#E8E5E1] flex items-center justify-center active:scale-90">
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>
        </button>
        <span id="dpMinute" class="w-9 text-center text-[18px] font-semibold text-[#1E2820] tabular-nums">${m}</span>
        <button data-dp-adj="min:5" class="w-7 h-7 rounded-full bg-white border border-[#E8E5E1] flex items-center justify-center active:scale-90">
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
    </div>`;
}

function _buildTimeUI() {
  const h = String(_dp.hour).padStart(2,'0');
  const m = String(_dp.minute).padStart(2,'0');
  return `
    <div class="relative flex items-center justify-between px-4 pt-5 pb-3">
      <div class="absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 rounded-full bg-[#DDD9D4]"></div>
      <span class="text-[14px] font-semibold text-[#1E2820]">Время</span>
      <div class="flex items-center gap-2">
        <button id="dpClear" class="h-8 px-3 rounded-full bg-[#F5F3F0] text-[#6B6860] text-[12px] font-semibold active:opacity-75">Убрать</button>
        <button id="dpConfirm" class="h-8 px-4 rounded-full bg-[#1E2820] text-white text-[12px] font-semibold active:opacity-75">Готово</button>
      </div>
    </div>
    <div class="flex items-center justify-center gap-6 px-4 pb-8 pt-4">
      <div class="flex flex-col items-center gap-3">
        <span class="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#9A9491]">Часы</span>
        <button data-dp-adj="hour:-1" class="w-11 h-11 rounded-full bg-[#F5F3F0] flex items-center justify-center active:scale-90 transition-transform">
          <svg width="14" height="14" fill="none" stroke="#1E2820" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>
        </button>
        <span id="dpHour" class="text-[36px] font-semibold text-[#1E2820] w-20 text-center tabular-nums">${h}</span>
        <button data-dp-adj="hour:1" class="w-11 h-11 rounded-full bg-[#F5F3F0] flex items-center justify-center active:scale-90 transition-transform">
          <svg width="14" height="14" fill="none" stroke="#1E2820" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
      <span class="text-[44px] font-semibold text-[#9A9491] leading-none pb-1">:</span>
      <div class="flex flex-col items-center gap-3">
        <span class="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#9A9491]">Минуты</span>
        <button data-dp-adj="min:-5" class="w-11 h-11 rounded-full bg-[#F5F3F0] flex items-center justify-center active:scale-90 transition-transform">
          <svg width="14" height="14" fill="none" stroke="#1E2820" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>
        </button>
        <span id="dpMinute" class="text-[36px] font-semibold text-[#1E2820] w-20 text-center tabular-nums">${m}</span>
        <button data-dp-adj="min:5" class="w-11 h-11 rounded-full bg-[#F5F3F0] flex items-center justify-center active:scale-90 transition-transform">
          <svg width="14" height="14" fill="none" stroke="#1E2820" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
    </div>`;
}

function _buildCalendarGrid(year, month, selectedDay) {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // Mon-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  let cells = WDAYS.map(d =>
    `<div class="text-[10px] font-semibold text-[#9A9491] text-center py-1">${d}</div>`
  ).join('');

  for (let i = 0; i < startOffset; i++) cells += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const sel     = d === selectedDay;
    const isToday = isCurrentMonth && d === today.getDate();
    cells += `<button data-dp-day="${d}"
      class="w-full aspect-square rounded-full flex items-center justify-center text-[13px] transition-all active:scale-90
        ${sel
          ? 'bg-[#1E2820] text-white font-semibold'
          : isToday
            ? 'bg-[#F0F7F1] text-[#3D6B45] font-semibold'
            : 'text-[#1E2820]'}"
    >${d}</button>`;
  }

  return `<div class="grid grid-cols-7 gap-0.5">${cells}</div>`;
}

function _updateTimeDisplay() {
  const hEl = document.getElementById('dpHour');
  const mEl = document.getElementById('dpMinute');
  if (hEl) hEl.textContent = String(_dp.hour).padStart(2,'0');
  if (mEl) mEl.textContent = String(_dp.minute).padStart(2,'0');
}

// ─── Event delegation ─────────────────────────────────────────────────────
function initDatePickerEvents() {
  const sheet = document.getElementById('datePickerSheet');
  if (!sheet) return;

  sheet.addEventListener('click', (e) => {
    if (e.target.id === 'dpBackdrop') { _closeSheet(); return; }

    if (e.target.closest('#dpConfirm')) {
      if (_dp.cb) {
        if (_dp.type === 'datetime' && _dp.day) {
          _dp.cb(toDTLocal(_dp));
        } else if (_dp.type === 'time') {
          _dp.cb(String(_dp.hour).padStart(2,'0') + ':' + String(_dp.minute).padStart(2,'0'));
        }
      }
      _closeSheet();
      return;
    }

    if (e.target.closest('#dpClear')) {
      if (_dp.cb) _dp.cb('');
      _closeSheet();
      return;
    }

    if (e.target.closest('#dpPrevMonth')) {
      _dp.month--; if (_dp.month < 0) { _dp.month = 11; _dp.year--; } _dp.day = null;
      _renderPicker(); return;
    }
    if (e.target.closest('#dpNextMonth')) {
      _dp.month++; if (_dp.month > 11) { _dp.month = 0; _dp.year++; } _dp.day = null;
      _renderPicker(); return;
    }

    const dayBtn = e.target.closest('[data-dp-day]');
    if (dayBtn) {
      _dp.day = +dayBtn.dataset.dpDay;
      _renderPicker();
      return;
    }

    const adj = e.target.closest('[data-dp-adj]');
    if (adj) {
      const [field, delta] = adj.dataset.dpAdj.split(':');
      const d = +delta;
      if (field === 'hour') {
        _dp.hour = (_dp.hour + d + 24) % 24;
      } else {
        _dp.minute = (_dp.minute + d + 60) % 60;
      }
      _updateTimeDisplay();
      if (_dp.type === 'datetime') {
        const btn = document.getElementById('dpConfirm');
        if (btn) {
          btn.className = btn.className.replace(/bg-\[\S+\]/, _dp.day ? 'bg-[#1E2820]' : 'bg-[#DDD9D4]');
          btn.classList.toggle('pointer-events-none', !_dp.day);
        }
      }
    }
  });
}
