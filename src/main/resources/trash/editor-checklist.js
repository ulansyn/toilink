// ═══════════════════════════════════════════════════════════════════════════
// Editor Checklist — smart task list, focus mode, sticky header bridge
// Depends on: APP (editor.js)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Checklist tasks ───────────────────────────────────────────────────────
const CHECKLIST_TASKS = [
  {
    id: 'names',
    label: 'Имена',
    block: 'hero',
    check: () => !!(APP.form.person1?.trim() || APP.form.person2?.trim()),
  },
  {
    id: 'date',
    label: 'Дата',
    block: 'hero',
    check: () => !!APP.form.eventDate,
  },
  {
    id: 'cover',
    label: 'Обложка',
    block: 'hero',
    check: () => !!APP.blocks.hero?.coverPhoto,
  },
  {
    id: 'greeting',
    label: 'Приветствие',
    block: 'greeting',
    check: () => {
      const g = APP.blocks.greeting;
      return g?.enabled !== false && !!(g?.title?.trim() || g?.text?.trim());
    },
  },
  {
    id: 'gallery',
    label: 'Галерея',
    block: 'gallery',
    check: () => !!(APP.blocks.gallery?.photos?.length),
  },
  {
    id: 'timeline',
    label: 'Программа',
    block: 'timeline',
    check: () => !!(APP.blocks.timeline?.events?.length),
  },
  {
    id: 'location',
    label: 'Место',
    block: 'location',
    check: () => {
      const l = APP.blocks.location;
      return l?.enabled !== false && !!(l?.placeName?.trim() || l?.address?.trim());
    },
  },
];

// ─── Render checklist ──────────────────────────────────────────────────────
function renderChecklist() {
  const bar = document.getElementById('checklistBar');
  if (!bar) return;

  const tasksHtml = CHECKLIST_TASKS.map(task => {
    const done = task.check();
    const active = APP.ui.activeBlock === task.block;
    const cls = done ? 'done' : active ? 'active' : 'pending';
    const icon = done
      ? `<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`
      : '';
    return `<button class="cl-item ${cls}" data-task="${task.id}" data-block="${task.block}" title="${task.label}">
      <span class="cl-check">${icon}</span>
      ${task.label}
    </button>`;
  }).join('');

  bar.innerHTML = tasksHtml;

  // Delegate: single listener survives re-renders
  bar.onclick = (e) => {
    const btn = e.target.closest('.cl-item');
    if (btn) { activateBlock(btn.dataset.block); hideOnboardingHint(); }
  };
}

// ─── Render checklist ──────────────────────────────────────────────────────
const scheduleChecklistUpdate = debounce(renderChecklist, 80);

// ─── Focus Mode ────────────────────────────────────────────────────────────
let _isFocusMode = false;
let _focusModeTimeout = null;

function enterFocusMode() {
  if (_isFocusMode) return;
  _isFocusMode = true;
  document.getElementById('tilesLeft')?.classList.add('focus-mode');
  document.getElementById('tilesRight')?.classList.add('focus-mode');
  // Expand sheet if not already full
  snapSheet(SHEET_SNAP.half);
}

function exitFocusMode() {
  if (!_isFocusMode) return;
  _isFocusMode = false;
  clearTimeout(_focusModeTimeout);
  // Delay so rapid field switches don't flicker
  _focusModeTimeout = setTimeout(() => {
    document.getElementById('tilesLeft')?.classList.remove('focus-mode');
    document.getElementById('tilesRight')?.classList.remove('focus-mode');
  }, 150);
}

function initFocusMode() {
  // Focus mode is primarily for mobile virtual keyboard handling
  const panel = document.getElementById('panelContentMobile');
  if (!panel) return;

  // Focus in
  panel.addEventListener('focusin', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) {
      enterFocusMode();
    }
  }, true);

  panel.addEventListener('focusout', (e) => {
    if (!panel.contains(e.relatedTarget)) {
      setTimeout(() => { // allow next focusin to cancel
        if (!panel.contains(document.activeElement)) {
          exitFocusMode();
        }
      }, 100);
    }
  }, true);

  // Also exit on tap outside panel (e.g. mode toggle)
  document.addEventListener('mousedown', (e) => {
    if (_isFocusMode && !e.target.closest('#panelContent, #bottomSheet')) {
      exitFocusMode();
    }
  });
}

// ─── Sticky Section Header (preview bridge) ─────────────────────────────────
let _lastVisibleSection = null;

function initStickyHeader() {
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'SECTION_VISIBLE') {
      updateStickyHeader(e.data.blockType, e.data.label);
    }
  });

  document.getElementById('sheetCloseBtn')?.addEventListener('click', () => {
    exitFocusMode();
    snapSheet(SHEET_SNAP.collapsed);
  });
}

function updateStickyHeader(blockType, label) {
  const header = document.getElementById('stickySectionHeader');
  const labelEl = document.getElementById('stickyLabel');
  const editBtn = document.getElementById('stickyEditBtn');
  if (!header || !labelEl) return;

  if (!blockType || APP.ui.mode === 'preview') {
    header.classList.remove('visible');
    _lastVisibleSection = null;
    return;
  }

  // Guard: skip if same section
  if (_lastVisibleSection === blockType) return;
  _lastVisibleSection = blockType;

  labelEl.textContent = label || '';

  // Show header
  header.classList.add('visible');

  // Edit button → activate block
  if (editBtn) {
    editBtn.onclick = () => { setMode('edit'); activateBlock(blockType); };
  }
}

// Show sticky header when entering edit mode, hide when preview mode
function showStickyHeader(blockType) {
  const def = getBlockDef(blockType);
  if (def) updateStickyHeader(blockType, def.label);
}

function hideStickyHeader() {
  document.getElementById('stickySectionHeader')?.classList.remove('visible');
  _lastVisibleSection = null;
}
