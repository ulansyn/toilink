// ═══════════════════════════════════════════════════════════════════════════
// Editor Utils — shared constants, debounce, escape, toast
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_SNAP = { collapsed: 2, half: 40, full: 88 };

const CAT_LABEL = { WEDDING: 'Свадьба', BIRTHDAY: 'День рождения', TOY: 'Той', OTHER: 'Другое' };

const STEP1_CATEGORIES = [
  { key: 'ALL',      label: 'Все' },
  { key: 'WEDDING',  label: 'Свадьба' },
  { key: 'TOY',      label: 'Той' },
  { key: 'BIRTHDAY', label: 'День рождения' },
  { key: 'OTHER',    label: 'Другое' },
];

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function esc(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function normalizeHex(raw) {
  if (!raw) return null;
  let v = String(raw).trim();
  if (!v.startsWith('#')) v = '#' + v;
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
}

// ─── Toast ────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  const v = ['success','error','info'].includes(type) ? type : 'info';
  t.className = `toast toast--${v}`;
  const icons = {
    success: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    error:   '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    info:    '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M13 16h-1v-4h-1m1-4h.01"/></svg>',
  };
  t.innerHTML = `<div class="toast-ico">${icons[v]}</div><div class="toast-msg" style="line-height:1.25">${esc(msg)}</div>`;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
