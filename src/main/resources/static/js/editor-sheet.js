// ═══════════════════════════════════════════════════════════════════════════
// Editor Sheet — drag handle, snap, visual viewport, exit flow
// Depends on: editor-utils.js (SHEET_SNAP), APP global, setMode (editor.js)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Drag handle ────────────────────────────────────────────────────────
function initDragHandle() {
  const handle = document.getElementById('sheetHandle');
  const sheet  = document.getElementById('bottomSheet');
  if (!handle || !sheet) return;

  let startY = 0, startH = 0, dragging = false;
  const VH = () => (window.visualViewport?.height || window.innerHeight) / 100;
  const SNAP = [SHEET_SNAP.collapsed, SHEET_SNAP.half, SHEET_SNAP.full];

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    startY = e.clientY;
    startH = sheet.offsetHeight;
    handle.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });

  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = startY - e.clientY;
    const minH = SNAP[0] * VH();
    const maxH = window.innerHeight * 0.92;
    sheet.style.height = Math.min(Math.max(startH + dy, minH), maxH) + 'px';
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    const cur = sheet.offsetHeight / VH();
    const mid1 = (SNAP[0] + SNAP[1]) / 2;
    const mid2 = (SNAP[1] + SNAP[2]) / 2;
    const target = cur < mid1 ? SNAP[0] : (cur < mid2 ? SNAP[1] : SNAP[2]);
    snapSheet(target);
    setMode(target <= SNAP[0] ? 'preview' : 'edit');
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

function snapSheet(dvh) {
  const sheet = document.getElementById('bottomSheet');
  if (!sheet) return;
  sheet.style.transition = 'height 0.34s cubic-bezier(0.32,0.72,0,1)';
  sheet.style.height = dvh + 'dvh';

  const panel = document.getElementById('panelContent');
  const collapsed = dvh <= SHEET_SNAP.collapsed;
  if (panel) {
    panel.style.visibility = collapsed ? 'hidden' : '';
    panel.style.pointerEvents = collapsed ? 'none' : '';
  }
}
window._snapSheet = snapSheet;

// ─── Visual Viewport ──────────────────────────────────────────────────────
let _vvListeners = null;

function initVisualViewport() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  const overlay = document.getElementById('editorOverlay');
  if (!overlay) return;

  function update() {
    overlay.style.top    = vv.offsetTop  + 'px';
    overlay.style.left   = vv.offsetLeft + 'px';
    overlay.style.width  = vv.width      + 'px';
    overlay.style.height = vv.height     + 'px';
  }

  if (_vvListeners) {
    vv.removeEventListener('resize', _vvListeners);
    vv.removeEventListener('scroll', _vvListeners);
  }
  _vvListeners = update;
  vv.addEventListener('resize', update, { passive: true });
  vv.addEventListener('scroll', update, { passive: true });
  update();
}

function destroyVisualViewport() {
  if (!window.visualViewport || !_vvListeners) return;
  window.visualViewport.removeEventListener('resize', _vvListeners);
  window.visualViewport.removeEventListener('scroll', _vvListeners);
  _vvListeners = null;
  const overlay = document.getElementById('editorOverlay');
  if (overlay) { overlay.style.top = ''; overlay.style.left = ''; overlay.style.width = ''; overlay.style.height = ''; }
}

// ─── Close editor ────────────────────────────────────────────────────────
function closeEditor() {
  document.getElementById('editorOverlay')?.classList.add('hidden');
  APP.ui.previewReady = false;
  window.removeEventListener('message', onPreviewMessage);
  destroyVisualViewport();
}

// ─── Exit sheet ───────────────────────────────────────────────────────────
function showExitSheet() {
  const sheet = document.getElementById('exitSheet');
  const backdrop = document.getElementById('exitBackdrop');
  const panel = document.getElementById('exitPanel');
  if (!sheet) return;
  sheet.classList.remove('hidden');
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    panel.style.transform = 'translateY(0)';
  });
}

function hideExitSheet() {
  const backdrop = document.getElementById('exitBackdrop');
  const panel = document.getElementById('exitPanel');
  const sheet = document.getElementById('exitSheet');
  if (!sheet) return;
  backdrop.style.opacity = '0';
  panel.style.transform = 'translateY(100%)';
  setTimeout(() => sheet.classList.add('hidden'), 300);
}

document.getElementById('editorBack')?.addEventListener('click', () => {
  if (APP.ui.dirty) showExitSheet();
  else closeEditor();
});

document.getElementById('exitSheet')?.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-exit]')?.dataset.exit;
  if (!action) return;
  if (action === 'cancel') { hideExitSheet(); return; }
  if (action === 'save') { hideExitSheet(); await handleSave(); return; }
  if (action === 'discard') { hideExitSheet(); closeEditor(); }
});
