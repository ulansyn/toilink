// ═══════════════════════════════════════════════════════════════════════════
// Editor Sheet — drag handle, snap, visual viewport, exit flow
// Depends on: editor-utils.js (SHEET_SNAP), APP global, setMode (editor.js)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Compute preview scale ─────────────────────────────────────────────────
function computePreviewScale() {
  const col = document.getElementById('previewCol');
  if (!col) return;
  const avail = col.clientWidth - 12;
  const scale = Math.min(avail / 375, 0.75);
  document.getElementById('editorBody').style.setProperty('--mob-scale', scale.toFixed(4));
}

// ─── Snap state ────────────────────────────────────────────────────────────
// Tracks the current snap level so viewport resize can re-apply it in px
let _currentSnap = SHEET_SNAP.collapsed;

const COLLAPSED_PX = 44; // drag handle touch target (Apple HIG minimum)

function snapSheet(pct) {
  _currentSnap = pct;
  const sheet = document.getElementById('bottomSheet');
  if (!sheet) return;
  sheet.style.transition = 'height 0.34s cubic-bezier(0.32,0.72,0,1)';

  // Always use visual viewport height so the sheet respects keyboard space
  const avail = window.visualViewport?.height || window.innerHeight;
  const collapsed = pct <= SHEET_SNAP.collapsed;
  sheet.style.height = collapsed ? COLLAPSED_PX + 'px' : Math.round(avail * pct / 100) + 'px';

  const panel = document.getElementById('panelContent');
  if (panel) {
    panel.style.visibility = collapsed ? 'hidden' : '';
    panel.style.pointerEvents = collapsed ? 'none' : '';
  }

  // Show/hide sheet block header
  const header = document.getElementById('sheetBlockHeader');
  if (header) header.classList.toggle('hidden', collapsed);

}
window._snapSheet = snapSheet;

// ─── Drag handle ────────────────────────────────────────────────────────
function initDragHandle() {
  const handle = document.getElementById('sheetHandle');
  const sheet  = document.getElementById('bottomSheet');
  if (!handle || !sheet) return;

  let startY = 0, startH = 0, dragging = false;
  const VH   = () => (window.visualViewport?.height || window.innerHeight) / 100;
  const SNAP = [SHEET_SNAP.collapsed, SHEET_SNAP.half, SHEET_SNAP.full];

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    startY   = e.clientY;
    startH   = sheet.offsetHeight;
    handle.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
    navigator.vibrate?.(8);
  });

  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy   = startY - e.clientY;
    const maxH = (window.visualViewport?.height || window.innerHeight) * 0.92;
    sheet.style.height = Math.min(Math.max(startH + dy, 0), maxH) + 'px';
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    const cur = sheet.offsetHeight / VH();
    let best = SNAP[0], bestDist = Infinity;
    for (const s of SNAP) {
      const d = Math.abs(cur - s);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    snapSheet(best);
  };

  handle.addEventListener('pointerup',     endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

// ─── Visual Viewport ──────────────────────────────────────────────────────
// Keeps the overlay locked to the visual viewport (handles keyboard resize).
// On every resize (keyboard open/close) we re-apply the current snap so the
// sheet height stays correct in px relative to the new available space.
let _vvListeners = null;

function initVisualViewport() {
  if (!window.visualViewport) return;
  const vv      = window.visualViewport;
  const overlay = document.getElementById('editorOverlay');
  if (!overlay) return;

  function update() {
    overlay.style.top    = vv.offsetTop  + 'px';
    overlay.style.left   = vv.offsetLeft + 'px';
    overlay.style.width  = vv.width      + 'px';
    overlay.style.height = vv.height     + 'px';
    // Re-apply current snap so sheet px matches the new viewport height
    snapSheet(_currentSnap);
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
  if (overlay) {
    overlay.style.top = ''; overlay.style.left = '';
    overlay.style.width = ''; overlay.style.height = '';
  }
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
  const sheet    = document.getElementById('exitSheet');
  const backdrop = document.getElementById('exitBackdrop');
  const panel    = document.getElementById('exitPanel');
  if (!sheet) return;
  sheet.classList.remove('hidden');
  requestAnimationFrame(() => {
    backdrop.style.opacity  = '1';
    panel.style.transform   = 'translateY(0)';
  });
}

function hideExitSheet() {
  const backdrop = document.getElementById('exitBackdrop');
  const panel    = document.getElementById('exitPanel');
  const sheet    = document.getElementById('exitSheet');
  if (!sheet) return;
  backdrop.style.opacity = '0';
  panel.style.transform  = 'translateY(100%)';
  setTimeout(() => sheet.classList.add('hidden'), 300);
}

document.getElementById('editorBack')?.addEventListener('click', () => {
  if (APP.ui.dirty) showExitSheet();
  else closeEditor();
});

document.getElementById('exitSheet')?.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-exit]')?.dataset.exit;
  if (!action) return;
  if (action === 'cancel')  { hideExitSheet(); return; }
  if (action === 'save')    { hideExitSheet(); await handleSave(); return; }
  if (action === 'discard') { hideExitSheet(); closeEditor(); }
});

// ─── Resize observer for preview scale ──────────────────────────────────
let _resizeObs = null;
function initPreviewResize() {
  const col = document.getElementById('previewCol');
  if (!col) return;
  computePreviewScale();
  if (_resizeObs) _resizeObs.disconnect();
  _resizeObs = new ResizeObserver(() => computePreviewScale());
  _resizeObs.observe(col);
}
