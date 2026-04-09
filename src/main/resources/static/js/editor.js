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
    lastExpandedSnap: 52,
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

// ─── Dirty tracking ──────────────────────────────────────────────────────
function takeSnapshot() {
  return JSON.stringify({ form: APP.form, blocks: APP.blocks });
}
function markClean() {
  APP.ui.savedSnapshot = takeSnapshot();
  APP.ui.dirty = false;
  updateSaveButtonState();
}
function markDirty() {
  APP.ui.dirty = takeSnapshot() !== APP.ui.savedSnapshot;
  updateSaveButtonState();
}
function updateSaveButtonState() {
  const btn = document.getElementById('editorSave');
  if (!btn) return;
  const lbl = btn.querySelector('.save-label');
  btn.style.background = APP.ui.dirty ? '#3D6B45' : '#1E2820';
  if (lbl) lbl.textContent = APP.ui.dirty ? '● Сохранить' : 'Сохранить';
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
  activateBlock(APP.ui.activeBlock || getBlockDefs()[0]?.type);
  initDragHandle();
  initVisualViewport();
  setMode('edit');

  document.getElementById('previewSkeleton').style.display = '';
  const frame = document.getElementById('previewFrame');
  window.addEventListener('message', onPreviewMessage);

  const tplPath = APP.ui.selectedTemplate?.templatePath || 'template-1';
  frame.src = `/templates/${tplPath}/index.html?mode=preview`;

  markClean();
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

function onPreviewMessage(e) {
  if (e.data?.type === 'TEMPLATE_READY') {
    APP.ui.previewReady = true;
    sendToPreview();
    const skel = document.getElementById('previewSkeleton');
    if (skel) skel.style.display = 'none';
  }
  if (e.data?.type === 'TEMPLATE_CLICK' && e.data.block) {
    setMode('edit');
    activateBlock(e.data.block);
  }
}

// ─── Mode toggle ──────────────────────────────────────────────────────────
function setMode(mode) {
  APP.ui.mode = mode;
  const sheet = document.getElementById('bottomSheet');
  const toggle = document.getElementById('modeToggle');
  if (!sheet || !toggle) return;

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

  if (mode === 'preview') {
    snapSheet(SHEET_SNAP.collapsed);
  } else {
    snapSheet(APP.ui.lastExpandedSnap);
  }
}

// ─── Block navigation — numbered horizontal strip ────────────────────────
function blockIcon(d) {
  return `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
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
  const el = document.getElementById('blockGrid');
  if (!el) return;
  const defs = getBlockDefs();

  el.innerHTML = `
    <div class="relative -mx-0">
      <div class="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none rounded-tl-[20px]"></div>
      <div class="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
      <div data-block-scroller class="flex gap-2 px-4 pb-3 overflow-x-auto" style="scrollbar-width:none; -webkit-overflow-scrolling:touch">
        ${defs.map(def => {
          const active  = def.type === APP.ui.activeBlock;
          const enabled = blockIsEnabled(def);
          const numStr  = String(def.num).padStart(2, '0');
          const filled  = blockIsFilled(def);
          const badge   = def.affectsPrice
            ? `<span class="absolute top-1 right-1 text-[8px] font-bold text-[#C9A96E] leading-none">₸</span>`
            : (!enabled
                ? `<span class="absolute top-1.5 right-1.5 w-[5px] h-[5px] rounded-full ${active ? 'bg-white/40' : 'bg-[#DDD9D4]'}"></span>`
                : (filled
                    ? `<span class="absolute top-1.5 right-1.5 w-[5px] h-[5px] rounded-full ${active ? 'bg-[#A8CEB0]' : 'bg-[#3D6B45]'}"></span>`
                    : `<span class="absolute top-1.5 right-1.5 w-[5px] h-[5px] rounded-full ${active ? 'bg-[#F5C87A]/80' : 'bg-[#C9A96E]'}"></span>`
                  ));
          return `<button data-block="${def.type}"
            class="relative flex-shrink-0 flex flex-col items-center gap-1 pt-4 pb-2.5 px-3 rounded-2xl w-[68px] text-[11px] font-semibold transition-all active:scale-95
              ${active ? 'bg-[#1E2820] text-white' : 'bg-[#F5F3F0] text-[#6B6860]'}"
            aria-label="${def.label} (блок ${def.num})">
            <span class="absolute top-1.5 left-2 text-[9px] font-bold tracking-wide ${active ? 'text-white/50' : 'text-[#1E2820]/25'}">${numStr}</span>
            ${badge}
            ${blockIcon(def.icon)}
            <span class="leading-tight text-center">${def.label}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const scroller = el.querySelector('[data-block-scroller]');
    const activeBtn = el.querySelector(`[data-block="${APP.ui.activeBlock}"]`);
    if (!scroller || !activeBtn) return;
    const target = activeBtn.offsetLeft - scroller.offsetWidth / 2 + activeBtn.offsetWidth / 2;
    scroller.scrollLeft = Math.max(0, target);
  });
}

function activateBlock(type) {
  APP.ui.activeBlock = type;
  const sheet = document.getElementById('bottomSheet');
  if (sheet) {
    const VH = window.innerHeight / 100;
    if (sheet.offsetHeight < 28 * VH) setMode('edit');
  }
  renderBlockNav();
  renderPanel(type);
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
    html += `<div class="flex items-center justify-between mb-3 pb-3 border-b border-[#F0EDE9]">
      <div>
        <span class="text-[15px] font-semibold text-[#1E2820]">${blockDef.label}</span>
        <div class="text-[12px] text-[#B0AB9E] mt-0.5">Обязательный блок — всегда отображается.</div>
      </div>
      <div class="w-5 h-5 rounded-full bg-[#C2E0C6] flex items-center justify-center">
        <svg width="12" height="12" fill="none" stroke="#1A3D20" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
    </div>`;
  }

  // Sections with fields
  for (const section of blockDef.sections || []) {
    let inner = '';
    if (section.label) inner += sectionLabel(section.label);
    for (const field of section.fields) {
      inner += renderField(type, field);
    }
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

  // Block nav delegation
  const grid = document.getElementById('blockGrid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-block]');
      if (btn) activateBlock(btn.dataset.block);
    });
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
          APP.ui.lastExpandedSnap = cur < (SHEET_SNAP.half + SHEET_SNAP.full) / 2 ? SHEET_SNAP.half : SHEET_SNAP.full;
        }
        setMode('preview');
      }
    });
  }

  // Scroll focused input into view
  panel.addEventListener('focusin', (e) => {
    if (!e.target.matches('input,textarea,select')) return;
    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 320);
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
document.getElementById('editorSave')?.addEventListener('click', handleSave);

async function handleSave() {
  const phone = localStorage.getItem('tl_phone');
  if (!phone) return;

  const f = APP.form;
  const b = APP.blocks;

  // ─── Валидация ────────────────────────────────────────────────────────────
  if (!f.person1?.trim() && !f.person2?.trim()) {
    showToast('Укажите хотя бы одно имя в блоке «Обложка»', 'error');
    activateBlock('hero');
    return;
  }
  if (!f.eventDate) {
    showToast('Укажите дату события в блоке «Обложка»', 'error');
    activateBlock('hero');
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

  const btn = document.getElementById('editorSave');
  const lbl = btn?.querySelector('.save-label');
  btn.disabled = true;
  btn.querySelector('.save-spinner').style.display = 'inline-block';
  if (lbl) lbl.textContent = 'Сохраняю…';

  try {
    const result = await saveEvent(phone, data, APP.ui.editEventId);

    // Для нового события — запоминаем id и обновляем URL без перезагрузки
    if (!APP.ui.editEventId && result?.id) {
      APP.ui.editEventId = result.id;
      history.replaceState(null, '', `?id=${result.id}`);
    }

    markClean();
    showToast('Сохранено', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.save-spinner').style.display = 'none';
    updateSaveButtonState();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════
async function init() {
  initEditorDelegation();

  const params = new URLSearchParams(location.search);
  APP.ui.editEventId = params.get('id') ? parseInt(params.get('id')) : null;

  const phone = await window.initAuth?.();
  if (!phone) { location.href = '/'; return; }

  try {
    const templates = await fetchTemplates();
    window._templates = templates;

    if (APP.ui.editEventId) {
      APP.ui.existingEvent = await fetchEvent(APP.ui.editEventId, phone);
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
