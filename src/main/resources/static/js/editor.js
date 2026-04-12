// ═══════════════════════════════════════════════════════════════════════════
// ToiLink Editor v4 — Schema-driven, dynamic block system
// Depends on: editor-utils.js, editor-api.js
// ═══════════════════════════════════════════════════════════════════════════

// ─── State ─────────────────────────────────────────────────────────────────
const APP = {
  form: {
    title: '', person1: '', person2: '', eventDate: '', rsvpDeadline: '',
    language: 'ru',
  },
  blocks: {},
  schema: null,
  ui: {
    editEventId: null,
    existingEvent: null,
    selectedTemplate: null,
    activeBlock: null,
    previewReady: false,
    mode: 'edit',
    step1Category: 'ALL',
    dirty: false,
    savedSnapshot: '',
    photoUploading: false,
    lastExpandedSnap: 40,
    slug: null,
    onboarded: false,
    // Per-block palette state: { 'dresscode.colors': 0 }
    paletteSlots: {},
  },
};

// ─── Schema helpers ───────────────────────────────────────────────────────
function getBlockDefs() {
  return APP.schema?.blocks || [];
}

function getBlockDef(type) {
  return getBlockDefs().find(b => b.type === type);
}

function initStateFromSchema(schema) {
  APP.blocks = {};
  for (const block of schema.blocks) {
    const state = {};
    if (block.toggleable) {
      state.enabled = block.defaultEnabled !== false;
    }
    for (const section of block.sections || []) {
      for (const field of section.fields || []) {
        if (field.type === 'info') continue;
        if (field.scope === 'form') continue; // form fields live in APP.form
        if (field.type === 'rows') {
          state[field.key] = [];
        } else if (field.type === 'color-palette') {
          state[field.key] = [...(field.default || [])];
        } else if (field.type === 'photos') {
          state[field.key] = [];
        } else if (field.type === 'toggle') {
          state[field.key] = field.default ?? false;
        } else {
          state[field.key] = field.default ?? '';
        }
      }
    }
    APP.blocks[block.type] = state;
  }
}

// ─── Debounce ─────────────────────────────────────────────────────────────
const debouncedPreview = debounce(() => sendToPreview(), 200);

// ─── Autosave ─────────────────────────────────────────────────────────────
const debouncedAutosave = debounce(() => {
  if (!APP.ui.dirty) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
    // Delay until user leaves the field
    ae.addEventListener('blur', () => {
      if (APP.ui.dirty) handleSave({ silent: true });
    }, { once: true });
    return;
  }
  handleSave({ silent: true });
}, 3000);

// ─── Dirty tracking ──────────────────────────────────────────────────────
function takeSnapshot() {
  return JSON.stringify({ form: APP.form, blocks: APP.blocks });
}
function markClean() {
  APP.ui.savedSnapshot = takeSnapshot();
  APP.ui.dirty = false;
  setSaveStatus('saved');
}
function markDirty() {
  APP.ui.dirty = takeSnapshot() !== APP.ui.savedSnapshot;
  if (APP.ui.dirty) {
    setSaveStatus('dirty');
    debouncedAutosave();
  }
  updateProgress();
}

// ─── Save status indicator ────────────────────────────────────────────────
function setSaveStatus(state) {
  const dot  = document.getElementById('saveStatusDot');
  const spin = document.getElementById('saveSpinner');
  if (!dot || !spin) return;

  if (state === 'dirty') {
    dot.style.opacity    = '1';
    dot.style.background = '#C9A96E';
    spin.classList.add('hidden');
  } else if (state === 'saving') {
    dot.style.opacity = '0';
    spin.classList.remove('hidden');
  } else if (state === 'saved') {
    dot.style.opacity = '0';
    spin.classList.add('hidden');
  } else if (state === 'error') {
    dot.style.opacity    = '1';
    dot.style.background = '#FF3B30';
    spin.classList.add('hidden');
  } else {
    dot.style.opacity = '0';
    spin.classList.add('hidden');
  }
}

// ─── Progress bar ────────────────────────────────────────────────────────
function calcProgress() {
  const defs = getBlockDefs();
  if (!defs.length) return 0;
  let total = 0, filled = 0;
  for (const def of defs) {
    const enabled = def.required || (APP.blocks[def.type]?.enabled ?? true);
    if (!enabled) continue;
    for (const section of def.sections || []) {
      for (const field of section.fields || []) {
        if (field.type === 'info') continue;
        total++;
        const val = field.scope === 'form' ? APP.form[field.key] : APP.blocks[def.type]?.[field.key];
        if (Array.isArray(val) && val.length > 0) filled++;
        else if (val && String(val).trim()) filled++;
      }
    }
  }
  return total === 0 ? 0 : Math.round((filled / total) * 100);
}

function updateProgress() {
  const pct = calcProgress();
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressPct');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = pct + '%';
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — Editor overlay
// ═══════════════════════════════════════════════════════════════════════════

function openEditorOverlay() {
  const overlay = document.getElementById('editorOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  if (APP.ui.existingEvent) populateFromEvent(APP.ui.existingEvent);

  document.getElementById('editorTitle').value = APP.form.title;
  renderBlockNav();
  activateBlock(APP.ui.activeBlock || getBlockDefs()[0]?.type, true);
  initDragHandle();
  initVisualViewport();
  initPreviewResize();

  // Start with sheet collapsed — show preview + tiles
  snapSheet(SHEET_SNAP.collapsed);

  document.getElementById('previewSkeleton').style.display = '';
  const frame = document.getElementById('previewFrame');
  window.addEventListener('message', onPreviewMessage);

  const tplPath = APP.ui.selectedTemplate?.templatePath || 'template-1';
  frame.src = `/templates/${tplPath}/index.html?mode=preview`;

  markClean();
  updateProgress();
  updatePublishBtn();
}

function populateFromEvent(ev) {
  APP.form.title        = ev.title        || '';
  APP.form.person1      = ev.person1      || '';
  APP.form.person2      = ev.person2      || '';
  APP.form.eventDate    = ev.eventDate    ? ev.eventDate.substring(0, 16) : '';
  APP.form.rsvpDeadline = ev.rsvpDeadline ? ev.rsvpDeadline.substring(0, 16) : '';
  APP.form.language     = ev.language     || 'ru';

  let bc = {};
  try { bc = JSON.parse(ev.blocksConfig || '{}'); } catch (_) {}

  for (const blockDef of getBlockDefs()) {
    const type = blockDef.type;
    const saved = bc[type];
    if (!saved) continue;

    const state = APP.blocks[type];
    if (!state) continue;

    // Restore enabled state
    if (blockDef.toggleable && saved.enabled !== undefined) {
      state.enabled = !!saved.enabled;
    }

    // Restore field values
    for (const section of blockDef.sections || []) {
      for (const field of section.fields || []) {
        if (field.type === 'info') continue;
        if (field.scope === 'form') continue;

        const key = field.key;
        if (saved[key] === undefined) continue;

        if (field.type === 'rows') {
          // Handle legacy format (newline-joined string)
          if (typeof saved[key] === 'string') {
            state[key] = saved[key].split('\n').map(l => l.trim()).filter(Boolean).map(line => {
              const m = line.match(/^(\d{1,2}:\d{2})\s+(.*)/);
              return m ? { time: m[1], title: m[2] } : { time: '', title: line };
            });
          } else if (Array.isArray(saved[key])) {
            state[key] = saved[key];
          }
        } else if (field.type === 'color-palette') {
          // Handle legacy format (comma-separated string)
          if (typeof saved[key] === 'string') {
            state[key] = saved[key].split(',').map(s => s.trim()).filter(Boolean);
          } else if (Array.isArray(saved[key])) {
            state[key] = saved[key];
          }
        } else if (field.type === 'photos') {
          if (Array.isArray(saved[key])) state[key] = saved[key];
        } else {
          state[key] = saved[key];
        }
      }
    }
  }

  // Legacy: hero fields that used different names
  if (bc.hero) {
    if (bc.hero.photoUrl && APP.blocks.hero) APP.blocks.hero.coverPhoto = bc.hero.photoUrl;
    if (bc.hero.badge && APP.blocks.hero) APP.blocks.hero.badge = bc.hero.badge;
    if (bc.hero.subtitle && APP.blocks.hero) APP.blocks.hero.subtitle = bc.hero.subtitle;
    if (bc.hero.timer !== undefined && APP.blocks.hero) APP.blocks.hero.timer = !!bc.hero.timer;
    if (bc.hero.music !== undefined && APP.blocks.hero) APP.blocks.hero.music = !!bc.hero.music;
  }
  // Legacy: timeline items as string
  if (bc.timeline?.items && APP.blocks.timeline) {
    APP.blocks.timeline.events = bc.timeline.items.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const m = line.match(/^(\d{1,2}:\d{2})\s+(.*)/);
      return m ? { time: m[1], title: m[2] } : { time: '', title: line };
    });
  }
  // Legacy: dresscode palette as CSV
  if (bc.dresscode?.palette && typeof bc.dresscode.palette === 'string' && APP.blocks.dresscode) {
    APP.blocks.dresscode.colors = bc.dresscode.palette.split(',').map(s => s.trim());
  }
  // Legacy: location fields
  if (bc.location && APP.blocks.location) {
    if (bc.location.placeName) APP.blocks.location.placeName = bc.location.placeName;
    if (bc.location.address) APP.blocks.location.address = bc.location.address;
    if (bc.location.mapLink) APP.blocks.location.mapLink = bc.location.mapLink;
  }
  // Legacy: greeting
  if (bc.greeting && APP.blocks.greeting) {
    if (bc.greeting.title) APP.blocks.greeting.title = bc.greeting.title;
    if (bc.greeting.text) APP.blocks.greeting.text = bc.greeting.text;
  }
  // Legacy: gallery style
  if (bc.gallery?.style && APP.blocks.gallery) {
    APP.blocks.gallery.style = bc.gallery.style;
  }
}

// ─── Onboarding ──────────────────────────────────────────────────────────

function _addPulseRings(colId) {
  const tile = document.getElementById(colId)?.querySelector('[data-block]');
  if (!tile || tile.querySelector('.tile-pulse-ring')) return;
  const r1 = document.createElement('span'); r1.className = 'tile-pulse-ring';
  const r2 = document.createElement('span'); r2.className = 'tile-pulse-ring';
  tile.appendChild(r1); tile.appendChild(r2);
}

function _removePulseRings() {
  document.querySelectorAll('.tile-pulse-ring').forEach(el => el.remove());
}

function _positionTooltip() {
  const tip       = document.getElementById('onboardingTooltip');
  const firstTile = document.getElementById('tilesLeft')?.querySelector('[data-block]');
  const body      = document.getElementById('editorBody');
  if (!tip || !firstTile || !body) return;

  const tRect = firstTile.getBoundingClientRect();
  const bRect = body.getBoundingClientRect();

  // Place tooltip to the right of the first tile, vertically centered on it
  tip.style.left      = (tRect.right - bRect.left + 10) + 'px';
  tip.style.top       = (tRect.top   - bRect.top  + tRect.height / 2) + 'px';
  tip.style.transform = 'translateY(-50%)';
}

function showOnboardingHint() {
  if (APP.ui.onboarded || localStorage.getItem('tl_onboarded')) return;

  // Dark overlay covers only the phone preview area (not tile columns)
  const overlay = document.getElementById('onboardingOverlay');
  if (overlay) {
    const tL = document.getElementById('tilesLeft');
    const tR = document.getElementById('tilesRight');
    if (tL) overlay.style.left  = tL.offsetWidth + 'px';
    if (tR) overlay.style.right = tR.offsetWidth + 'px';
    overlay.style.opacity = '0';
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  }

  // Pulse rings on first tile of each column
  requestAnimationFrame(() => {
    _addPulseRings('tilesLeft');
    _addPulseRings('tilesRight');
  });

  // Tooltip: position next to first tile, animate in after short delay
  const tip = document.getElementById('onboardingTooltip');
  if (tip) {
    _positionTooltip();
    tip.style.opacity  = '0';
    tip.style.animation = 'none';
    tip.classList.remove('hidden');
    setTimeout(() => {
      tip.style.animation = 'tooltip-in 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards';
    }, 280);
  }
}

function hideOnboardingHint() {
  if (APP.ui.onboarded) return;
  APP.ui.onboarded = true;
  localStorage.setItem('tl_onboarded', '1');

  const overlay = document.getElementById('onboardingOverlay');
  const tip     = document.getElementById('onboardingTooltip');

  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.classList.add('hidden'), 300);
  }
  if (tip) {
    tip.style.transition = 'opacity 0.2s';
    tip.style.opacity    = '0';
    setTimeout(() => { tip.classList.add('hidden'); tip.style.transition = ''; }, 220);
  }

  _removePulseRings();

  // Step 2: glow on first form field after sheet opens
  setTimeout(_glowFirstField, 520);
}

function _glowFirstField() {
  const panel = document.getElementById('panelContent');
  if (!panel) return;
  const field = panel.querySelector('input:not([type=hidden]):not(.sr-only), textarea');
  if (!field) return;

  field.style.transition  = 'box-shadow 0.3s ease, border-color 0.3s ease';
  field.style.borderColor = '#3D6B45';
  field.style.boxShadow   = '0 0 0 4px rgba(61,107,69,0.25)';

  // Scroll field into view
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    field.style.borderColor = '';
    field.style.boxShadow   = '';
    setTimeout(() => { field.style.transition = ''; }, 320);
  }, 1800);
}

function onPreviewMessage(e) {
  if (e.data?.type === 'TEMPLATE_READY') {
    APP.ui.previewReady = true;
    sendToPreview();
    const skel = document.getElementById('previewSkeleton');
    if (skel) skel.style.display = 'none';
    showOnboardingHint();
  }
  if (e.data?.type === 'TEMPLATE_CLICK' && e.data.block) {
    hideOnboardingHint();
    setMode('edit');
    activateBlock(e.data.block);
  }
}

// ─── Mode toggle ──────────────────────────────────────────────────────────
function setMode(mode) {
  APP.ui.mode = mode;
  const toggle = document.getElementById('modeToggle');
  if (!toggle) return;

  toggle.querySelectorAll('button').forEach(btn => {
    const m = btn.dataset.mode;
    if (m === mode) {
      btn.classList.add('bg-white', 'text-[#1E2820]', 'shadow-sm');
      btn.classList.remove('text-[#6B6860]');
    } else {
      btn.classList.remove('bg-white', 'text-[#1E2820]', 'shadow-sm');
      btn.classList.add('text-[#6B6860]');
    }
  });

  const tilesLeft  = document.getElementById('tilesLeft');
  const tilesRight = document.getElementById('tilesRight');

  if (mode === 'preview') {
    snapSheet(SHEET_SNAP.collapsed);
    if (tilesLeft)  { tilesLeft.style.transition  = 'opacity 0.2s, width 0.25s'; tilesLeft.style.opacity  = '0'; tilesLeft.style.width  = '0'; tilesLeft.style.padding  = '0'; tilesLeft.style.overflow = 'hidden'; }
    if (tilesRight) { tilesRight.style.transition = 'opacity 0.2s, width 0.25s'; tilesRight.style.opacity = '0'; tilesRight.style.width = '0'; tilesRight.style.padding = '0'; tilesRight.style.overflow = 'hidden'; }
  } else {
    snapSheet(APP.ui.lastExpandedSnap || SHEET_SNAP.half);
    if (tilesLeft)  { tilesLeft.style.transition  = 'opacity 0.2s, width 0.25s'; tilesLeft.style.opacity  = ''; tilesLeft.style.width  = ''; tilesLeft.style.padding  = ''; tilesLeft.style.overflow = ''; }
    if (tilesRight) { tilesRight.style.transition = 'opacity 0.2s, width 0.25s'; tilesRight.style.opacity = ''; tilesRight.style.width = ''; tilesRight.style.padding = ''; tilesRight.style.overflow = ''; }
  }
}

// ─── Block navigation — small square tiles ──────────────────────────────
function blockIcon(d, size = 16) {
  return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
}

function blockIsEnabled(def) {
  if (def.required) return true;
  return APP.blocks[def.type]?.enabled ?? true;
}

function blockIsFilled(def) {
  for (const section of def.sections || []) {
    for (const field of section.fields || []) {
      if (field.type === 'info') continue;
      const val = field.scope === 'form' ? APP.form[field.key] : APP.blocks[def.type]?.[field.key];
      if (Array.isArray(val) && val.length > 0) return true;
      if (val && String(val).trim()) return true;
    }
  }
  return false;
}

function renderBlockNav() {
  const leftEl = document.getElementById('tilesLeft');
  const rightEl = document.getElementById('tilesRight');
  if (!leftEl || !rightEl) return;
  const defs = getBlockDefs();
  const half = Math.ceil(defs.length / 2);

  function tileHtml(def) {
    const active  = def.type === APP.ui.activeBlock;
    const enabled = blockIsEnabled(def);
    const filled  = blockIsFilled(def);

    // Status dot (top-right) — absent when disabled
    const dotBg = !enabled ? null
      : filled
        ? (active ? '#A8CEB0' : '#3D6B45')
        : (active ? 'rgba(245,200,122,0.7)' : '#C9A96E');
    const dot = dotBg
      ? `<span class="absolute top-2 right-2 w-[6px] h-[6px] rounded-full pointer-events-none" style="background:${dotBg}"></span>`
      : '';

    // Eye-slash overlay for disabled blocks
    const eyeSlash = !enabled && !active
      ? `<span class="absolute bottom-1.5 right-1.5 pointer-events-none opacity-60">
           <svg width="10" height="10" fill="none" stroke="#C5BFB8" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
         </span>`
      : '';

    const tileClass = active
      ? 'bg-[#1E2820] text-white shadow-[0_2px_12px_rgba(30,40,32,0.20)]'
      : enabled
        ? 'bg-white/75 text-[#5C5850] border border-[#E5E5EA]'
        : 'bg-white/30 text-[#C5BFB8] border border-dashed border-[#DDDAD6]';

    return `<button data-block="${def.type}"
      class="relative flex flex-col items-center justify-center gap-1 rounded-2xl w-[58px] h-[62px] transition-all active:scale-93 overflow-hidden ${tileClass}"
      aria-label="${def.label}">
      ${dot}
      ${eyeSlash}
      <span style="opacity:${enabled || active ? '1' : '0.45'}">${blockIcon(def.icon, 18)}</span>
      <span class="text-[9px] font-semibold leading-tight text-center px-1 truncate w-full" style="opacity:${enabled || active ? '1' : '0.5'}">${def.label}</span>
    </button>`;
  }

  leftEl.innerHTML = defs.slice(0, half).map(tileHtml).join('');
  rightEl.innerHTML = defs.slice(half).map(tileHtml).join('');
}

function updateSheetHeader(type) {
  const def = getBlockDef(type);
  if (!def) return;
  const iconEl    = document.getElementById('sheetBlockIcon');
  const titleEl   = document.getElementById('sheetBlockTitle');
  const counterEl = document.getElementById('sheetBlockCounter');
  if (iconEl)  iconEl.innerHTML    = blockIcon(def.icon, 16);
  if (titleEl) titleEl.textContent = def.label;

  const defs = getBlockDefs();
  const idx  = defs.findIndex(d => d.type === type);
  if (counterEl) counterEl.textContent = `${idx + 1} из ${defs.length}`;

  _updateSheetNavBtns(idx, defs.length);
}

function _updateSheetNavBtns(idx, total) {
  const prev = document.getElementById('sheetPrevBtn');
  const next = document.getElementById('sheetNextBtn');
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= total - 1;
}

function _navigateBlock(dir) {
  const defs = getBlockDefs();
  const idx  = defs.findIndex(d => d.type === APP.ui.activeBlock);
  const target = defs[idx + dir];
  if (target) activateBlock(target.type);
}

function activateBlock(type, silent) {
  APP.ui.activeBlock = type;
  renderBlockNav();
  renderPanel(type);
  updateSheetHeader(type);

  // Open sheet when tapping a block (unless silent — initial load)
  if (!silent) {
    hideOnboardingHint();
    snapSheet(APP.ui.lastExpandedSnap || SHEET_SNAP.half);
  }

  scrollPreviewTo(type);
}

// ─── Preview communication ────────────────────────────────────────────────
function buildPreviewConfig() {
  return {
    form: { ...APP.form },
    blocks: JSON.parse(JSON.stringify(APP.blocks)),
    sectionMap: APP.schema?.sectionMap || null,
  };
}

function sendToPreview() {
  if (!APP.ui.previewReady) return;
  try {
    const frame = document.getElementById('previewFrame');
    frame.contentWindow.postMessage({ type: 'EDITOR_UPDATE', config: buildPreviewConfig() }, '*');
  } catch (_) {}
}

function scrollPreviewTo(blockType) {
  const sectionMap = APP.schema?.sectionMap || {};
  const sectionId = sectionMap[blockType];
  if (!sectionId) return;
  try {
    const frame = document.getElementById('previewFrame');
    const target = frame.contentWindow.document.querySelector(`[data-section="${sectionId}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC PANEL RENDERER — reads schema, generates UI
// ═══════════════════════════════════════════════════════════════════════════
function renderPanel(type) {
  const el = document.getElementById('panelContent');
  if (!el) return;
  const blockDef = getBlockDef(type);
  if (!blockDef) { el.innerHTML = ''; return; }

  let html = '';

  // Toggle or required header
  if (blockDef.toggleable) {
    html += blockToggleRow(type, blockDef.label, {
      affectsPrice: blockDef.affectsPrice,
      hint: blockDef.toggleHint || '',
    });
  } else if (blockDef.required) {
    html += `<div class="flex items-center gap-2 bg-[#F0F7F1] rounded-2xl px-3 py-2.5 mb-3">
      <svg width="14" height="14" fill="none" stroke="#3D6B45" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      <span class="text-[12px] font-semibold text-[#3D6B45]">Обязательный блок</span>
    </div>`;
  }

  // All sections — always visible
  for (const section of blockDef.sections || []) {
    let inner = '';
    if (section.label) inner += sectionLabel(section.label);
    for (const field of section.fields) inner += renderField(type, field);
    html += sectionCard(inner);
  }

  el.innerHTML = html;
  el.scrollTop = 0;

  // Post-render bindings
  bindAllPhotoUploads(el, type);
  bindAllPalettes(el, type);
}

// ─── State helpers ────────────────────────────────────────────────────────
function setFieldState(path, value) {
  const parts = path.split('.');
  if (parts.length === 1) {
    // form-level field
    APP.form[parts[0]] = value;
    if (parts[0] === 'title') {
      const titleInput = document.getElementById('editorTitle');
      if (titleInput) titleInput.value = value;
    }
  } else if (parts.length === 2) {
    const [block, key] = parts;
    if (APP.blocks[block] !== undefined) {
      APP.blocks[block][key] = value;
    } else {
      // Fallback to form
      APP.form[path] = value;
    }
  }
}

// Helper to get rows array for a given path
function getRowsArray(rowsKey) {
  const [bType, fKey] = rowsKey.split('.');
  return APP.blocks[bType]?.[fKey];
}

function getRowsFieldDef(rowsKey) {
  const [bType, fKey] = rowsKey.split('.');
  const blockDef = getBlockDef(bType);
  if (!blockDef) return null;
  for (const s of blockDef.sections || []) {
    for (const f of s.fields || []) {
      if (f.key === fKey && f.type === 'rows') return f;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT DELEGATION
// ═══════════════════════════════════════════════════════════════════════════
function initEditorDelegation() {
  const panel = document.getElementById('panelContent');
  if (!panel) return;

  // Date/time picker triggers
  panel.addEventListener('click', (e) => {
    const dtBtn = e.target.closest('[data-dt-picker]');
    if (dtBtn) {
      const fieldPath = dtBtn.dataset.dtPicker;
      const parts = fieldPath.split('.');
      const currentVal = parts.length === 1 ? APP.form[parts[0]] : APP.blocks[parts[0]]?.[parts[1]] || '';
      openDateTimePicker(fieldPath, currentVal);
      return;
    }
    const tpInput = e.target.closest('[data-time-picker]');
    if (tpInput) {
      openTimePicker(tpInput);
      return;
    }
  }, true); // capture phase — fires before other click handlers

  panel.addEventListener('input', (e) => {
    // Regular data-field inputs
    const field = e.target.closest('[data-field]');
    if (field) {
      setFieldState(field.dataset.field, field.value);
      markDirty();
      debouncedPreview();

      // Обновляем счётчик символов для textarea
      const counter = panel.querySelector(`[data-char-counter="${field.dataset.field}"]`);
      if (counter) {
        const len = field.value.length;
        const max = field.maxLength > 0 ? field.maxLength : null;
        counter.textContent = max ? `${len}/${max}` : `${len} симв.`;
        counter.className = `text-[11px] flex-shrink-0 ${(max && len > max * 0.85) ? 'text-[#C9A96E]' : 'text-[#C5BFB8]'}`;
      }

      // Обновляем URL-статус для url-полей
      if (field.dataset.urlValidate) {
        const statusEl = panel.querySelector(`[data-url-status="${field.dataset.field}"]`);
        if (statusEl) {
          const v = field.value.trim();
          if (!v) { statusEl.textContent = ''; return; }
          try { new URL(v); statusEl.textContent = '✓'; statusEl.style.color = '#3D6B45'; }
          catch { statusEl.textContent = '⚠'; statusEl.style.color = '#C9A96E'; }
        }
      }
      return;
    }
    // Rows sub-field inputs
    const rf = e.target.closest('[data-rows-field]');
    if (rf) {
      const arr = getRowsArray(rf.dataset.rowsField);
      const idx = parseInt(rf.dataset.rowsIdx, 10);
      if (arr && arr[idx]) {
        arr[idx][rf.dataset.rowsSubkey] = rf.value;
        markDirty();
        debouncedPreview();
      }
      return;
    }
    // Palette hex input
    const palInput = e.target.closest('[data-pal-input]');
    if (palInput) {
      const val = normalizeHex(palInput.value);
      if (val) applyPaletteColor(palInput.dataset.palInput, val);
    }
  });

  panel.addEventListener('click', (e) => {
    // Block toggle switches
    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      const type = tog.dataset.toggle;
      if (APP.blocks[type] !== undefined) {
        APP.blocks[type].enabled = !APP.blocks[type].enabled;
        tog.classList.toggle('on', APP.blocks[type].enabled);
        markDirty();
        debouncedPreview();
        renderBlockNav();
        if (APP.blocks[type].enabled) {
          const row = tog.closest('.flex.items-center.justify-between');
          if (row) {
            row.classList.remove('toggle-flash');
            void row.offsetWidth;
            row.classList.add('toggle-flash');
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
      return;
    }

    // Field toggle (premium features in blocks)
    const fieldTog = e.target.closest('[data-toggle-field]');
    if (fieldTog) {
      const path = fieldTog.dataset.toggleField;
      const [bType, fKey] = path.split('.');
      if (APP.blocks[bType] !== undefined) {
        APP.blocks[bType][fKey] = !APP.blocks[bType][fKey];
        fieldTog.classList.toggle('on', APP.blocks[bType][fKey]);
        markDirty();
        debouncedPreview();
        if (APP.blocks[bType][fKey]) {
          const row = fieldTog.closest('.flex.items-center.justify-between');
          if (row) {
            row.classList.remove('toggle-flash');
            void row.offsetWidth;
            row.classList.add('toggle-flash');
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
      return;
    }

    // Select buttons
    const selBtn = e.target.closest('[data-select]');
    if (selBtn) {
      const path = selBtn.dataset.select;
      const val = selBtn.dataset.selectVal;
      setFieldState(path, val);
      renderPanel(APP.ui.activeBlock);
      markDirty();
      debouncedPreview();
      return;
    }

    // Rows: add
    const addBtn = e.target.closest('[data-rows-add]');
    if (addBtn) {
      const rowsKey = addBtn.dataset.rowsAdd;
      const arr = getRowsArray(rowsKey);
      const fieldDef = getRowsFieldDef(rowsKey);
      if (arr && fieldDef) {
        const newRow = {};
        for (const rf of fieldDef.rowFields || []) newRow[rf.key] = '';
        arr.push(newRow);
        renderPanel(APP.ui.activeBlock);
        markDirty();
        debouncedPreview();
      }
      return;
    }

    // Rows: move
    const moveBtn = e.target.closest('[data-rows-move]');
    if (moveBtn) {
      const arr = getRowsArray(moveBtn.dataset.rowsMove);
      const idx = parseInt(moveBtn.dataset.rowsIdx, 10);
      const dir = moveBtn.dataset.rowsDir === 'up' ? -1 : 1;
      const next = idx + dir;
      if (arr && next >= 0 && next < arr.length) {
        [arr[idx], arr[next]] = [arr[next], arr[idx]];
        renderPanel(APP.ui.activeBlock);
        markDirty();
        debouncedPreview();
      }
      return;
    }

    // Rows: delete (двойной тап для подтверждения)
    const delBtn = e.target.closest('[data-rows-del]');
    if (delBtn) {
      if (delBtn.dataset.confirming) {
        clearTimeout(Number(delBtn.dataset.confirmTimer));
        const arr = getRowsArray(delBtn.dataset.rowsDel);
        const idx = parseInt(delBtn.dataset.rowsIdx, 10);
        if (arr) {
          arr.splice(idx, 1);
          renderPanel(APP.ui.activeBlock);
          markDirty();
          debouncedPreview();
        }
      } else {
        delBtn.dataset.confirming = '1';
        delBtn.classList.add('bg-[#FEE2E2]', 'text-[#C25252]', 'border-[#FECACA]');
        delBtn.classList.remove('bg-[#FAFAF8]', 'text-[#9A9491]', 'border-[#E8E5E1]');
        delBtn.title = 'Нажмите ещё раз для удаления';
        const t = setTimeout(() => {
          if (delBtn.isConnected) {
            delete delBtn.dataset.confirming;
            delBtn.classList.remove('bg-[#FEE2E2]', 'text-[#C25252]', 'border-[#FECACA]');
            delBtn.classList.add('bg-[#FAFAF8]', 'text-[#9A9491]', 'border-[#E8E5E1]');
            delBtn.title = '';
          }
        }, 2500);
        delBtn.dataset.confirmTimer = String(t);
      }
      return;
    }

    // Photos: delete (двойной тап для подтверждения)
    const photoDel = e.target.closest('[data-photos-del]');
    if (photoDel) {
      if (photoDel.dataset.confirming) {
        clearTimeout(Number(photoDel.dataset.confirmTimer));
        const [bType, fKey] = photoDel.dataset.photosDel.split('.');
        const idx = parseInt(photoDel.dataset.photosIdx, 10);
        if (APP.blocks[bType]?.[fKey]) {
          APP.blocks[bType][fKey].splice(idx, 1);
          renderPanel(APP.ui.activeBlock);
          markDirty();
          debouncedPreview();
        }
      } else {
        photoDel.dataset.confirming = '1';
        photoDel.classList.add('bg-red-500', 'scale-110');
        photoDel.title = 'Ещё раз — удалить';
        const t = setTimeout(() => {
          if (photoDel.isConnected) {
            delete photoDel.dataset.confirming;
            photoDel.classList.remove('bg-red-500', 'scale-110');
            photoDel.title = '';
          }
        }, 2500);
        photoDel.dataset.confirmTimer = String(t);
      }
      return;
    }

    // Photos: move (↑↓ reorder)
    const photoMove = e.target.closest('[data-photos-move]');
    if (photoMove) {
      const [bType, fKey] = photoMove.dataset.photosMove.split('.');
      const arr = APP.blocks[bType]?.[fKey];
      if (!Array.isArray(arr)) return;
      const idx = parseInt(photoMove.dataset.photosIdx, 10);
      const next = photoMove.dataset.photosDir === 'prev' ? idx - 1 : idx + 1;
      if (next >= 0 && next < arr.length) {
        [arr[idx], arr[next]] = [arr[next], arr[idx]];
        renderPanel(APP.ui.activeBlock);
        markDirty();
        debouncedPreview();
      }
      return;
    }

    // Palette: slot select
    const slotBtn = e.target.closest('[data-pal-slot]');
    if (slotBtn) {
      const paletteKey = slotBtn.dataset.palSlot;
      APP.ui.paletteSlots[paletteKey] = Math.max(0, parseInt(slotBtn.dataset.palIdx, 10));
      syncPaletteUI(paletteKey);
      return;
    }

    // Palette: color preset
    const colorBtn = e.target.closest('[data-pal-color]');
    if (colorBtn) {
      applyPaletteColor(colorBtn.dataset.palColor, colorBtn.dataset.palHex, true);
      return;
    }
  });

  // Photos: add (via file input change) — поддержка нескольких файлов
  panel.addEventListener('change', (e) => {
    const addInput = e.target.closest('[data-photos-add]');
    if (addInput) {
      const files = Array.from(addInput.files || []);
      addInput.value = '';
      if (!files.length) return;
      const [bType, fKey] = addInput.dataset.photosAdd.split('.');
      handlePhotosAdd(bType, fKey, files);
    }
  });

  // Block nav delegation (both tile columns)
  for (const id of ['tilesLeft', 'tilesRight']) {
    const col = document.getElementById(id);
    if (col) {
      col.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-block]');
        if (btn) activateBlock(btn.dataset.block);
      });
    }
  }

  // Mode toggle
  const toggle = document.getElementById('modeToggle');
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      const mode = btn.dataset.mode;
      if (mode === 'edit' && APP.ui.mode === 'preview') {
        setMode('edit');
      } else if (mode === 'preview' && APP.ui.mode === 'edit') {
        const sheet = document.getElementById('bottomSheet');
        if (sheet) {
          const vh = (window.visualViewport?.height || window.innerHeight) / 100;
          const cur = sheet.offsetHeight / vh;
          if (cur > SHEET_SNAP.collapsed) {
            APP.ui.lastExpandedSnap = cur < (SHEET_SNAP.half + SHEET_SNAP.full) / 2 ? SHEET_SNAP.half : SHEET_SNAP.full;
          }
        }
        setMode('preview');
      }
    });
  }

  // Collapse button in sheet header
  document.getElementById('sheetCollapseBtn')?.addEventListener('click', () => {
    snapSheet(SHEET_SNAP.collapsed);
  });

  // Block navigation in sheet header
  document.getElementById('sheetPrevBtn')?.addEventListener('click', () => _navigateBlock(-1));
  document.getElementById('sheetNextBtn')?.addEventListener('click', () => _navigateBlock(1));


  // Auto-expand sheet + scroll input into view on focus
  panel.addEventListener('focusin', (e) => {
    if (!e.target.matches('input,textarea,select')) return;
    snapSheet(SHEET_SNAP.full);
    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 340);
  }, true);

  // Photos: drag-and-drop reorder (desktop)
  let _photoDrag = null;

  panel.addEventListener('dragstart', (e) => {
    const item = e.target.closest('[data-photos-drag-key]');
    if (!item) return;
    _photoDrag = { key: item.dataset.photosDragKey, idx: parseInt(item.dataset.photosDragIdx, 10) };
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (item.isConnected) item.style.opacity = '0.4'; }, 0);
  });

  panel.addEventListener('dragend', () => {
    panel.querySelectorAll('[data-photos-drag-key]').forEach(el => {
      el.style.opacity = '';
      el.style.outline = '';
    });
    _photoDrag = null;
  });

  panel.addEventListener('dragover', (e) => {
    const item = e.target.closest('[data-photos-drag-key]');
    if (!item || !_photoDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    item.style.outline = '2px solid #3D6B45';
  });

  panel.addEventListener('dragleave', (e) => {
    const item = e.target.closest('[data-photos-drag-key]');
    if (item) item.style.outline = '';
  });

  panel.addEventListener('drop', (e) => {
    const item = e.target.closest('[data-photos-drag-key]');
    if (!item || !_photoDrag) return;
    e.preventDefault();
    item.style.outline = '';
    const toKey = item.dataset.photosDragKey;
    const toIdx = parseInt(item.dataset.photosDragIdx, 10);
    if (toKey !== _photoDrag.key || toIdx === _photoDrag.idx) return;
    const [bType, fKey] = toKey.split('.');
    const arr = APP.blocks[bType]?.[fKey];
    if (!Array.isArray(arr)) return;
    const [moved] = arr.splice(_photoDrag.idx, 1);
    arr.splice(toIdx, 0, moved);
    _photoDrag = null;
    renderPanel(APP.ui.activeBlock);
    markDirty();
    debouncedPreview();
  });
}

async function handlePhotosAdd(blockType, fieldKey, files) {
  if (APP.ui.photoUploading) return;
  APP.ui.photoUploading = true;

  const max = 10;
  const current = APP.blocks[blockType]?.[fieldKey]?.length || 0;
  const allowed = files.slice(0, Math.max(0, max - current));

  if (!allowed.length) {
    showToast(`Галерея заполнена (макс. ${max} фото)`, 'info');
    APP.ui.photoUploading = false;
    return;
  }

  showToast(`Загружаем ${allowed.length} фото…`);
  let uploaded = 0, failed = 0;

  for (const file of allowed) {
    try {
      const url = await uploadPhoto(file);
      if (!APP.blocks[blockType][fieldKey]) APP.blocks[blockType][fieldKey] = [];
      APP.blocks[blockType][fieldKey].push(url);
      uploaded++;
    } catch {
      failed++;
    }
  }

  renderPanel(APP.ui.activeBlock);
  markDirty();
  debouncedPreview();
  APP.ui.photoUploading = false;

  if (failed === 0) {
    showToast(uploaded === 1 ? 'Фото добавлено' : `Добавлено ${uploaded} фото`, 'success');
  } else {
    showToast(`Загружено ${uploaded}, не удалось: ${failed}`, uploaded > 0 ? 'info' : 'error');
  }
}

// ─── Editor title sync ──────────────────────────────────────────────────
document.getElementById('editorTitle')?.addEventListener('input', function () {
  APP.form.title = this.value;
  markDirty();
});

// ─── Save ─────────────────────────────────────────────────────────────────
async function handleSave(opts = {}) {
  const silent = opts.silent ?? false;
  const phone = localStorage.getItem('tl_phone');
  if (!phone) return;

  const f = APP.form;
  const b = APP.blocks;

  // ─── Валидация ────────────────────────────────────────────────────────────
  if (!f.person1?.trim() && !f.person2?.trim()) {
    if (!silent) {
      showToast('Укажите хотя бы одно имя в блоке «Обложка»', 'error');
      activateBlock('hero');
    }
    return;
  }
  if (!f.eventDate) {
    if (!silent) {
      showToast('Укажите дату события в блоке «Обложка»', 'error');
      activateBlock('hero');
    }
    return;
  }

  const blocksConfig = JSON.parse(JSON.stringify(b));

  const data = {
    title:         f.title || `${f.person1 || ''} & ${f.person2 || ''}`.trim().replace(/^& |& $/, ''),
    person1:       f.person1       || null,
    person2:       f.person2       || null,
    eventDate:     f.eventDate     || null,
    rsvpDeadline:  f.rsvpDeadline  || null,
    language:      f.language      || 'ru',
    coverImageUrl: b.hero?.coverPhoto || null,
    blocksConfig:  JSON.stringify(blocksConfig),
    ...(APP.ui.selectedTemplate && !APP.ui.editEventId ? { templateId: APP.ui.selectedTemplate.id } : {}),
    ...(APP.ui.editEventId ? { status: APP.ui.existingEvent?.status || 'DRAFT' } : {}),
  };

  setSaveStatus('saving');

  try {
    const result = await saveEvent(phone, data, APP.ui.editEventId);

    // Для нового события — запоминаем id и обновляем URL без перезагрузки
    if (!APP.ui.editEventId && result?.id) {
      APP.ui.editEventId = result.id;
      history.replaceState(null, '', `?id=${result.id}`);
    }
    if (result?.slug) APP.ui.slug = result.slug;
    if (result?.status) { if (APP.ui.existingEvent) APP.ui.existingEvent.status = result.status; }
    updatePublishBtn();

    markClean();
  } catch (err) {
    setSaveStatus('error');
    if (!silent) showToast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD TOOLBAR
// ═══════════════════════════════════════════════════════════════════════════

let _kbToolbarActive = false;

function _kbFocusableFields() {
  const panel = document.getElementById('panelContent');
  if (!panel) return [];
  return Array.from(panel.querySelectorAll(
    'input:not([type=hidden]):not(.sr-only), textarea'
  )).filter(el => !el.disabled && el.offsetParent !== null);
}

function _kbUpdateBtns() {
  const fields = _kbFocusableFields();
  const idx    = fields.indexOf(document.activeElement);
  const prev   = document.getElementById('kbPrev');
  const next   = document.getElementById('kbNext');
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx < 0 || idx >= fields.length - 1;
}

function _kbStep(dir) {
  const fields = _kbFocusableFields();
  const idx    = fields.indexOf(document.activeElement);
  const target = fields[idx + dir];
  if (target) {
    target.focus();
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  } else if (dir > 0) {
    document.activeElement?.blur();
  }
  setTimeout(_kbUpdateBtns, 60);
}

function _positionKbToolbar() {
  const vv = window.visualViewport;
  const tb = document.getElementById('kbToolbar');
  if (!vv || !tb) return;
  tb.style.top   = (vv.offsetTop + vv.height) + 'px';
  tb.style.left  = vv.offsetLeft + 'px';
  tb.style.width = vv.width + 'px';
}

function _showKbToolbar() {
  const tb = document.getElementById('kbToolbar');
  if (!tb || _kbToolbarActive) return;
  _kbToolbarActive = true;
  _positionKbToolbar();
  _kbUpdateBtns();
  tb.classList.remove('hidden');
}

function _hideKbToolbar() {
  const tb = document.getElementById('kbToolbar');
  if (!tb || !_kbToolbarActive) return;
  _kbToolbarActive = false;
  tb.classList.add('hidden');
}

function initKbToolbar() {
  if (!window.visualViewport) return;

  let _lastVH = window.visualViewport.height;

  window.visualViewport.addEventListener('resize', () => {
    const vv  = window.visualViewport;
    const kbH = window.innerHeight - vv.height - vv.offsetTop;
    const kbOpen = kbH > 120;

    if (kbOpen) {
      _positionKbToolbar();
      // Only show if a field inside panelContent is focused
      const panel = document.getElementById('panelContent');
      if (panel?.contains(document.activeElement)) _showKbToolbar();
    } else {
      _hideKbToolbar();
    }
  }, { passive: true });

  // Show/hide on focus within panelContent
  document.getElementById('panelContent')?.addEventListener('focusin', (e) => {
    if (!e.target.matches('input, textarea')) return;
    const vv  = window.visualViewport;
    const kbH = window.innerHeight - vv.height - (vv.offsetTop || 0);
    if (kbH > 120) _showKbToolbar();
    setTimeout(_kbUpdateBtns, 60);
  }, true);

  document.getElementById('panelContent')?.addEventListener('focusout', () => {
    // Small delay — focusout fires before the next focusin
    setTimeout(() => {
      const panel = document.getElementById('panelContent');
      if (!panel?.contains(document.activeElement)) _hideKbToolbar();
    }, 100);
  }, true);

  document.getElementById('kbPrev')?.addEventListener('click', () => _kbStep(-1));
  document.getElementById('kbNext')?.addEventListener('click', () => _kbStep(1));
  document.getElementById('kbDone')?.addEventListener('click', () => {
    document.activeElement?.blur();
    _hideKbToolbar();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLISH
// ═══════════════════════════════════════════════════════════════════════════

function getPublicUrl() {
  if (!APP.ui.slug) return null;
  return `${location.origin}/e/${APP.ui.slug}`;
}

function isPublished() {
  return APP.ui.existingEvent?.status === 'PUBLISHED';
}

function updatePublishBtn() {
  const btn   = document.getElementById('publishBtn');
  const label = document.getElementById('publishBtnLabel');
  if (!btn || !label) return;

  if (isPublished()) {
    btn.style.background = 'transparent';
    btn.style.border     = '1.5px solid #3D6B45';
    btn.style.color      = '#3D6B45';
    label.innerHTML = `<span style="display:flex;align-items:center;gap:3px">
      <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
      Ссылка
    </span>`;
  } else {
    btn.style.background = '#3D6B45';
    btn.style.border     = 'none';
    btn.style.color      = 'white';
    label.textContent = 'Опубликовать';
  }
}

function showPublishSheet() {
  const sheet    = document.getElementById('publishSheet');
  const backdrop = document.getElementById('pubBackdrop');
  const panel    = document.getElementById('pubPanel');
  if (!sheet) return;

  // Choose which state to show
  const stateSuccess = document.getElementById('pubStateSuccess');
  const stateConfirm = document.getElementById('pubStateConfirm');

  if (isPublished()) {
    stateSuccess?.classList.remove('hidden');
    stateConfirm?.classList.add('hidden');
    // Fill in link
    const url = getPublicUrl() || '';
    const linkText = document.getElementById('pubLinkText');
    const openBtn  = document.getElementById('pubOpenBtn');
    if (linkText) linkText.textContent = url;
    if (openBtn)  openBtn.href = url;
  } else {
    stateSuccess?.classList.add('hidden');
    stateConfirm?.classList.remove('hidden');
  }

  sheet.classList.remove('hidden');
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    panel.style.transform  = 'translateY(0)';
  });
}

function hidePublishSheet() {
  const backdrop = document.getElementById('pubBackdrop');
  const panel    = document.getElementById('pubPanel');
  const sheet    = document.getElementById('publishSheet');
  if (!sheet) return;
  backdrop.style.opacity = '0';
  panel.style.transform  = 'translateY(100%)';
  setTimeout(() => sheet.classList.add('hidden'), 300);
}

async function handlePublish() {
  const phone = localStorage.getItem('tl_phone');
  if (!phone) return;

  // For new events: save first to get an id
  if (!APP.ui.editEventId || APP.ui.dirty) {
    await handleSave({ silent: true });
    if (!APP.ui.editEventId) return; // validation failed
  }

  setSaveStatus('saving');
  try {
    const f = APP.form;
    const b = APP.blocks;
    const data = {
      title:         f.title || `${f.person1 || ''} & ${f.person2 || ''}`.trim().replace(/^& |& $/, ''),
      person1:       f.person1       || null,
      person2:       f.person2       || null,
      eventDate:     f.eventDate     || null,
      rsvpDeadline:  f.rsvpDeadline  || null,
      language:      f.language      || 'ru',
      coverImageUrl: b.hero?.coverPhoto || null,
      blocksConfig:  JSON.stringify(JSON.parse(JSON.stringify(b))),
      status:        'PUBLISHED',
    };
    const result = await saveEvent(phone, data, APP.ui.editEventId);
    if (result?.slug) APP.ui.slug = result.slug;
    if (result?.status && APP.ui.existingEvent) APP.ui.existingEvent.status = result.status;
    markClean();
    updatePublishBtn();
    // Re-open sheet in success state
    hidePublishSheet();
    setTimeout(() => showPublishSheet(), 320);
  } catch (err) {
    setSaveStatus('error');
    showToast(err.message, 'error');
  }
}

// ─── Publish sheet events ────────────────────────────────────────────────
document.getElementById('publishBtn')?.addEventListener('click', showPublishSheet);

document.getElementById('pubBackdrop')?.addEventListener('click', hidePublishSheet);

document.getElementById('pubCancelBtn')?.addEventListener('click', hidePublishSheet);

document.getElementById('pubConfirmBtn')?.addEventListener('click', handlePublish);

document.getElementById('pubCopyBtn')?.addEventListener('click', async () => {
  const url = getPublicUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Ссылка скопирована', 'success');
  } catch {
    // Fallback for browsers without clipboard API
    const el = document.createElement('input');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Ссылка скопирована', 'success');
  }
  hidePublishSheet();
});

document.getElementById('pubShareBtn')?.addEventListener('click', async () => {
  const url = getPublicUrl();
  if (!url) return;
  const title = APP.form.title || 'Приглашение';
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch (_) {}
  } else {
    await navigator.clipboard.writeText(url).catch(() => {});
    showToast('Ссылка скопирована', 'success');
    hidePublishSheet();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════
async function init() {
  initEditorDelegation();
  initDatePickerEvents();
  initKbToolbar();

  const params = new URLSearchParams(location.search);
  APP.ui.editEventId = params.get('id') ? parseInt(params.get('id')) : null;

  const phone = await window.initAuth?.();
  if (!phone) { location.href = '/'; return; }

  try {
    const templates = await fetchTemplates();
    window._templates = templates;

    if (APP.ui.editEventId) {
      APP.ui.existingEvent = await fetchEvent(APP.ui.editEventId, phone);
      APP.ui.slug = APP.ui.existingEvent.slug || null;
      APP.ui.selectedTemplate = templates.find(t => t.id === APP.ui.existingEvent.templateId) || templates[0];
      APP.form.title = APP.ui.existingEvent.title || '';
      // Load schema before opening editor
      const schemaUrl = `/templates/${APP.ui.selectedTemplate.templatePath}/schema.json`;
      APP.schema = await fetch(schemaUrl).then(r => r.json());
      initStateFromSchema(APP.schema);
      APP.ui.activeBlock = APP.schema.blocks[0]?.type || null;
      openEditorOverlay();
    } else if (templates.length === 1) {
      APP.ui.selectedTemplate = templates[0];
      goToEditor();
    } else {
      renderTemplatePicker(templates);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

init();
