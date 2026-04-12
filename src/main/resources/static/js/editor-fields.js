// ═══════════════════════════════════════════════════════════════════════════
// Editor Fields — HTML helpers, field renderers, palette/photo bindings
// Depends on: editor-utils.js (esc, normalizeHex), APP global (editor.js)
// ═══════════════════════════════════════════════════════════════════════════

// ─── HTML helpers ─────────────────────────────────────────────────────────
function floatInput(field, label, value, opts = {}) {
  const id = 'f_' + field.replace(/[^a-zA-Z0-9_-]/g, '_');
  const type = opts.type || 'text';
  const isUrl = opts.urlValidate;
  const urlStatus = isUrl && value ? _urlStatus(value) : null;
  const urlIndicator = isUrl ? `<span data-url-status="${field}" class="absolute right-3 top-1/2 -translate-y-1/2 text-[16px] leading-none">${urlStatus ?? ''}</span>` : '';
  const hint = opts.hint ? `<p class="mt-1 text-[11px] text-[#B0AB9E] leading-snug">${esc(opts.hint)}</p>` : '';
  return `<div class="mb-1.5">
    <div class="relative">
      <input id="${id}" data-field="${field}" type="${type}" placeholder=" " value="${esc(value)}"
        ${opts.inputMode ? `inputmode="${opts.inputMode}"` : ''} ${opts.maxLength ? `maxlength="${opts.maxLength}"` : ''}
        ${isUrl ? `data-url-validate="1"` : ''}
        class="peer w-full rounded-xl bg-[#F2F2F7] border border-transparent px-3 pt-5 pb-1.5 text-[14px] font-medium text-[#1E2820] outline-none transition-all focus:bg-white focus:border-[#3D6B45] focus:shadow-[0_0_0_3px_rgba(61,107,69,0.12)] ${isUrl ? 'pr-9' : ''}"
        style="-webkit-appearance:none; appearance:none">
      <label for="${id}" class="absolute left-3 top-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-[#9A9491]
        transition-all duration-150 peer-placeholder-shown:top-3 peer-placeholder-shown:text-[13px]
        peer-placeholder-shown:font-medium peer-placeholder-shown:tracking-normal peer-placeholder-shown:normal-case
        peer-placeholder-shown:text-[#6B6860] peer-focus:text-[#3D6B45]">${esc(label)}</label>
      ${urlIndicator}
    </div>${hint}</div>`;
}

function _urlStatus(val) {
  if (!val) return '';
  try { new URL(val); return '✓'; } catch { return '⚠'; }
}

function renderDateTimeField(fieldPath, label, value, hint) {
  const id = 'f_' + fieldPath.replace(/[^a-zA-Z0-9_-]/g, '_');
  const display = typeof formatDTDisplay === 'function' ? formatDTDisplay(value) : '';
  const hintHtml = hint ? `<p class="mt-1 text-[11px] text-[#B0AB9E] leading-snug">${esc(hint)}</p>` : '';
  return `<div class="mb-1.5">
    <button type="button" id="${id}" data-dt-picker="${fieldPath}"
      class="w-full rounded-xl bg-[#F2F2F7] border border-transparent px-3 pt-5 pb-2 text-left relative active:bg-white active:border-[#3D6B45] transition-colors"
      style="-webkit-appearance:none;appearance:none">
      <span class="absolute left-3 top-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-[#9A9491]">${esc(label)}</span>
      <span data-dt-display class="text-[13px] font-medium" style="color:${display ? '#1E2820' : '#B0AB9E'}">
        ${display || 'Выбрать дату и время'}
      </span>
    </button>
    ${hintHtml}
  </div>`;
}

function floatTextarea(field, label, value, opts = {}) {
  const id = 'f_' + field.replace(/[^a-zA-Z0-9_-]/g, '_');
  const hint = opts.hint ? `<p class="mt-1 text-[11px] text-[#B0AB9E] leading-snug">${esc(opts.hint)}</p>` : '';
  const len = String(value || '').length;
  const max = opts.maxLength || null;
  const counterText = max ? `${len}/${max}` : `${len} симв.`;
  const counterColor = (max && len > max * 0.85) ? 'text-[#C9A96E]' : 'text-[#C5BFB8]';
  return `<div class="mb-1.5">
    <div class="relative">
      <textarea id="${id}" data-field="${field}" rows="${opts.rows || 2}" placeholder=" "
        ${max ? `maxlength="${max}"` : ''}
        class="peer w-full rounded-xl bg-[#F2F2F7] border border-transparent px-3 pt-5 pb-2 text-[14px] font-medium text-[#1E2820] outline-none transition-all resize-none leading-snug focus:bg-white focus:border-[#3D6B45] focus:shadow-[0_0_0_3px_rgba(61,107,69,0.12)]">${esc(value)}</textarea>
      <label for="${id}" class="absolute left-3 top-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-[#9A9491]
        transition-all duration-150 peer-placeholder-shown:top-3 peer-placeholder-shown:text-[13px]
        peer-placeholder-shown:font-medium peer-placeholder-shown:tracking-normal peer-placeholder-shown:normal-case
        peer-placeholder-shown:text-[#6B6860] peer-focus:text-[#3D6B45]">${esc(label)}</label>
    </div>
    <div class="flex justify-between items-start mt-0.5 gap-2">
      ${hint ? `<p class="text-[11px] text-[#B0AB9E] leading-snug">${esc(opts.hint)}</p>` : '<span></span>'}
      <span data-char-counter="${field}" class="text-[10px] flex-shrink-0 ${counterColor}">${counterText}</span>
    </div>
  </div>`;
}

function blockToggleRow(blockType, label, opts = {}) {
  const on = APP.blocks[blockType]?.enabled ?? true;
  const badges = [];
  if (opts.affectsPrice) badges.push(`<span class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F5EDD8] text-[#C9A96E] border border-[#E8D9B0]">₸</span>`);
  const statusText = on ? 'Включён' : 'Выключен';
  return `<div class="bg-white rounded-2xl px-3 py-3 mb-3 flex items-center justify-between" style="box-shadow:0 1px 3px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.05)">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5">
        <span class="text-[13px] font-semibold text-[#1E2820]">Показывать блок</span>
        ${badges.join('')}
      </div>
      <div class="text-[11px] mt-0.5 ${on ? 'text-[#3D6B45]' : 'text-[#8E8E93]'}">${opts.hint || statusText}</div>
    </div>
    <div class="pswitch ${on ? 'on' : ''} ml-3 flex-shrink-0" data-toggle="${blockType}"></div>
  </div>`;
}

function premiumFeatureRow(blockType, field, label, hint, enabled) {
  return `<div class="flex items-center justify-between py-2 border-b border-[#E5E5EA] last:border-b-0">
    <div>
      <div class="flex items-center gap-1.5">
        <span class="text-[12px] font-medium text-[#1E2820]">${label}</span>
        <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F5EDD8] text-[#C9A96E] border border-[#E8D9B0]">Premium</span>
      </div>
      ${hint ? `<div class="text-[11px] text-[#B0AB9E] mt-0.5">${hint}</div>` : ''}
    </div>
    <div class="pswitch ${enabled ? 'on' : ''} ml-2" data-toggle-field="${blockType}.${field}"></div>
  </div>`;
}

function sectionCard(inner) {
  return `<div class="bg-white rounded-2xl px-3 py-3 mb-3 last:mb-1" style="box-shadow:0 1px 3px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.05)">${inner}</div>`;
}

function sectionLabel(text) {
  return `<div class="text-[11px] font-semibold text-[#8E8E93] mb-2">${text}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FIELD RENDERERS — one function per field type
// ═══════════════════════════════════════════════════════════════════════════

function renderField(blockType, field) {
  const fieldPath = field.scope === 'form' ? field.key : `${blockType}.${field.key}`;
  const value = field.scope === 'form' ? APP.form[field.key] : (APP.blocks[blockType]?.[field.key] ?? '');

  switch (field.type) {
    case 'text':
      return floatInput(fieldPath, field.label, value, {
        type: field.inputType || 'text',
        hint: field.hint,
        maxLength: field.maxLength,
        inputMode: field.inputMode,
        urlValidate: field.inputType === 'url',
      });

    case 'textarea':
      return floatTextarea(fieldPath, field.label, value, {
        rows: field.rows || 3,
        hint: field.hint,
      });

    case 'datetime-local':
      return renderDateTimeField(fieldPath, field.label, value, field.hint);

    case 'photo':
      return renderPhotoField(blockType, field, value);

    case 'photos':
      return renderPhotosField(blockType, field, value);

    case 'toggle':
      return premiumFeatureRow(blockType, field.key, field.label, field.hint || '', !!value);

    case 'select':
      return renderSelectField(blockType, field, value);

    case 'color-palette':
      return renderPaletteField(blockType, field, value);

    case 'rows':
      return renderRowsField(blockType, field, value);

    case 'info':
      return renderInfoField(field);

    default:
      return '';
  }
}

// ─── Photo upload (single) ────────────────────────────────────────────────
function renderPhotoField(blockType, field, url) {
  const uid = `photo_${blockType}_${field.key}`;
  const aspect = field.aspectRatio || '4/3';

  if (field.thumbnail) {
    // Compact thumbnail row (for tall aspect ratios like 9/16)
    return `
    <div class="flex items-center gap-3 py-1">
      <div class="photo-upload ${url ? 'has-image' : ''} flex-shrink-0" id="${uid}"
           data-photo-block="${blockType}" data-photo-key="${field.key}"
           style="width:64px; height:114px; aspect-ratio:${aspect}; border-radius:10px">
        <img id="${uid}_preview" src="${esc(url)}" alt="">
        <div class="photo-upload-placeholder flex flex-col items-center gap-1">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
        <button type="button" class="photo-edit-btn" id="${uid}_editBtn" style="width:28px;height:28px;top:6px;right:6px">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <div class="photo-upload-loading" id="${uid}_loading">
          <div class="w-4 h-4 rounded-full border-2 border-white/28 border-t-white/92" style="animation:spin .85s linear infinite"></div>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-semibold text-[#1E2820]">${esc(field.label)}</p>
        ${field.hint ? `<p class="text-[11px] text-[#B0AB9E] mt-1 leading-snug">${esc(field.hint)}</p>` : ''}
        ${!url ? `<p class="text-[11px] text-[#3D6B45] mt-2 font-medium">Нажмите на превью →</p>` : `<p class="text-[11px] text-[#3D6B45] mt-2 font-medium">Фото загружено ✓</p>`}
      </div>
    </div>
    <input type="file" id="${uid}_file" accept="image/*" class="hidden">`;
  }

  return `
    <div class="photo-upload ${url ? 'has-image' : ''}" id="${uid}" data-photo-block="${blockType}" data-photo-key="${field.key}" style="aspect-ratio:${aspect}">
      <img id="${uid}_preview" src="${esc(url)}" alt="">
      <div class="photo-upload-placeholder flex flex-col items-center gap-2">
        <div class="w-11 h-11 rounded-[14px] bg-[#E8E5E1] flex items-center justify-center text-[#9A9491]">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
        <div class="text-[13px] text-[#9A9491] text-center leading-snug">Нажмите, чтобы<br>выбрать фото</div>
      </div>
      <button type="button" class="photo-edit-btn" id="${uid}_editBtn">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      </button>
      <div class="photo-upload-loading" id="${uid}_loading">
        <div class="w-5 h-5 rounded-full border-2 border-white/28 border-t-white/92" style="animation:spin .85s linear infinite"></div>
        <div class="text-[13px] font-semibold">Загружаем…</div>
      </div>
    </div>
    <input type="file" id="${uid}_file" accept="image/*" class="hidden">
    ${field.hint ? `<p class="text-[12px] text-[#B0AB9E] text-center mt-2">${esc(field.hint)}</p>` : ''}`;
}

// ─── Photos (multi) ───────────────────────────────────────────────────────
function renderPhotosField(blockType, field, photos) {
  const arr = Array.isArray(photos) ? photos : [];
  const max = field.maxCount || 10;
  const photosKey = `${blockType}.${field.key}`;
  return `
    <div class="grid grid-cols-3 gap-2 mb-2" data-photos-grid="${photosKey}">
      ${arr.map((url, i) => `
        <div class="relative aspect-square rounded-xl overflow-hidden border border-[#E8E5E1] transition-opacity"
          draggable="true"
          data-photos-drag-key="${photosKey}"
          data-photos-drag-idx="${i}">
          <img src="${esc(url)}" class="w-full h-full object-cover pointer-events-none">
          <button data-photos-del="${photosKey}" data-photos-idx="${i}" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <div class="absolute bottom-1 left-1 flex gap-1">
            <button data-photos-move="${photosKey}" data-photos-dir="prev" data-photos-idx="${i}" ${i === 0 ? 'disabled' : ''} class="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button data-photos-move="${photosKey}" data-photos-dir="next" data-photos-idx="${i}" ${i === arr.length - 1 ? 'disabled' : ''} class="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      `).join('')}
      ${arr.length < max ? `
        <label class="aspect-square rounded-xl border-2 border-dashed border-[#DDD9D4] bg-[#F5F3F0] flex flex-col items-center justify-center gap-1 cursor-pointer active:bg-[#EDEAE6]">
          <svg width="20" height="20" fill="none" stroke="#9A9491" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          <span class="text-[10px] text-[#9A9491]">${arr.length}/${max}</span>
          <input type="file" accept="image/*" multiple class="hidden" data-photos-add="${photosKey}">
        </label>
      ` : ''}
    </div>
    ${field.hint ? `<p class="text-[12px] text-[#B0AB9E]">${esc(field.hint)}</p>` : ''}`;
}

// ─── Select (grid or inline) ──────────────────────────────────────────────
function renderSelectField(blockType, field, value) {
  const opts = field.options || [];
  if (field.display === 'grid') {
    return `<div class="grid grid-cols-2 gap-2 mb-3">
      ${opts.map(opt => {
        const active = value === opt.value;
        return `<button data-select="${blockType}.${field.key}" data-select-val="${opt.value}" class="p-3 rounded-2xl border text-left transition-all active:scale-95
          ${active ? 'border-[#3D6B45] bg-[#F0F7F1]' : 'border-[#E8E4DE] bg-[#F5F3F0]'}">
          <div class="text-[13px] font-semibold ${active ? 'text-[#1E2820]' : 'text-[#6B6860]'}">${opt.label}</div>
          ${opt.desc ? `<div class="text-[11px] text-[#B0AB9E] mt-0.5">${opt.desc}</div>` : ''}
          ${active ? '<div class="mt-1.5 w-4 h-1 rounded-full bg-[#3D6B45]"></div>' : ''}
        </button>`;
      }).join('')}
    </div>`;
  }
  // Inline buttons
  return `<div class="flex gap-2 mb-3">
    ${opts.map(opt => {
      const active = value === opt.value;
      return `<button data-select="${blockType}.${field.key}" data-select-val="${opt.value}" class="flex-1 py-2.5 rounded-2xl border text-center text-[13px] font-semibold transition-all active:scale-95
        ${active ? 'border-[#3D6B45] bg-[#F0F7F1] text-[#1E2820]' : 'border-[#E8E4DE] bg-[#F5F3F0] text-[#6B6860]'}">${opt.label}</button>`;
    }).join('')}
  </div>`;
}

// ─── Color palette ────────────────────────────────────────────────────────
function renderPaletteField(blockType, field, palette) {
  const paletteKey = `${blockType}.${field.key}`;
  const slotCount = field.slotCount || 5;
  const fallback = field.default || ['#E8EBE6','#2C3531','#B9C4BC','#F2F4F1','#7C9082'];
  const colors = (Array.isArray(palette) && palette.length ? palette : fallback).slice(0, slotCount);
  const activeSlot = APP.ui.paletteSlots[paletteKey] || 0;
  const activeColor = colors[activeSlot] || colors[0] || '#3D6B45';
  const presets = field.presets || [];

  return `<div class="mb-2.5" data-palette="${paletteKey}">
    <div class="flex items-center justify-between mb-2">
      <p class="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#9A9491]">${esc(field.label)}</p>
      <p class="text-[11px] text-[#9A9491]" data-pal-slot-label="${paletteKey}">Цвет ${activeSlot + 1} из ${slotCount}</p>
    </div>
    <div class="flex gap-2 mb-3" data-pal-slots="${paletteKey}">
      ${colors.map((c, i) => `<button class="pal-slot ${i === activeSlot ? 'active' : ''}" data-pal-slot="${paletteKey}" data-pal-idx="${i}" style="background:${c}" title="Цвет ${i + 1}">
        <span class="pal-check"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>
      </button>`).join('')}
    </div>
    ${presets.length ? `<p class="text-[11px] text-[#B0AB9E] mb-2">Нажмите на цвет ниже — он применится к выбранному слоту</p>` : ''}
    ${presets.length ? `<div class="grid grid-cols-8 gap-2" data-pal-presets="${paletteKey}">
      ${presets.map(c => `<button class="pal-preset ${c.toLowerCase() === activeColor.toLowerCase() ? 'active' : ''}" data-pal-color="${paletteKey}" data-pal-hex="${c}" style="background:${c}">
        <span class="pal-check"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>
      </button>`).join('')}
    </div>` : ''}
    <div class="mt-3 relative">
      <input data-pal-input="${paletteKey}" class="peer w-full rounded-2xl bg-[#F5F3F0] border border-transparent px-4 pt-6 pb-2 text-[15px] font-medium text-[#1E2820] outline-none transition-colors pr-14 focus:bg-[#EDEAE6] focus:border-[#3D6B45]" type="text" placeholder=" " value="${esc(activeColor)}">
      <label class="absolute left-4 top-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#9A9491] transition-all duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-placeholder-shown:font-medium peer-placeholder-shown:tracking-normal peer-placeholder-shown:normal-case peer-placeholder-shown:text-[#6B6860] peer-focus:text-[#3D6B45]">HEX цвет</label>
      <div data-pal-preview="${paletteKey}" class="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border border-[#E8E5E1]" style="background:${esc(activeColor)}"></div>
    </div>
    <p class="mt-1.5 text-[12px] text-[#B0AB9E]">Например: #FF5733</p>
  </div>`;
}

// ─── Dynamic rows ─────────────────────────────────────────────────────────
function renderRowsField(blockType, field, rows) {
  const arr = Array.isArray(rows) ? rows : [];
  const rowsKey = `${blockType}.${field.key}`;
  let rowsHtml = '';

  if (arr.length === 0) {
    rowsHtml = `<div class="text-center py-6 text-[#1E2820]/35">
      <p class="font-cormorant text-[20px] italic font-semibold">Пока пусто</p>
      <p class="text-sm mt-1">Добавьте первый пункт</p></div>`;
  } else {
    rowsHtml = arr.map((r, i) => {
      const fieldInputs = (field.rowFields || []).map(rf => {
        const w = rf.width ? `width:${rf.width}; flex-shrink:0;` : 'flex:1;';
        const val = r[rf.key] || '';
        const isTimePicker = rf.key === 'time' && rf.inputMode === 'numeric';
        const extraAttrs = isTimePicker ? 'readonly data-time-picker' : (rf.inputMode ? `inputmode="${rf.inputMode}"` : '');
        const extraClass = isTimePicker ? 'cursor-pointer caret-transparent' : '';
        return `<input data-rows-field="${rowsKey}" data-rows-subkey="${rf.key}" data-rows-idx="${i}" style="${w}" class="py-2.5 px-2.5 bg-[#F5F3F0] border-[1.5px] border-transparent rounded-xl text-sm font-medium text-[#1E2820] outline-none ${rf.width ? 'text-center' : ''} focus:bg-[#EDEAE6] focus:border-[#3D6B45] ${extraClass}" type="text" placeholder="${esc(rf.placeholder || rf.label)}" value="${esc(val)}" ${extraAttrs}>`;
      }).join('');

      return `<div class="flex items-center gap-2.5 p-2.5 border border-[#F0EDE9] rounded-2xl bg-white/90 mb-2" data-rows-row="${rowsKey}" data-rows-idx="${i}">
        <div class="flex flex-col gap-1 flex-shrink-0">
          <button data-rows-move="${rowsKey}" data-rows-dir="up" data-rows-idx="${i}" ${i === 0 ? 'disabled' : ''} class="w-10 h-10 rounded-xl border border-[#E8E5E1] bg-[#FAFAF8] text-[#6B6860] flex items-center justify-center active:scale-95 disabled:opacity-35">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button data-rows-move="${rowsKey}" data-rows-dir="down" data-rows-idx="${i}" ${i === arr.length - 1 ? 'disabled' : ''} class="w-10 h-10 rounded-xl border border-[#E8E5E1] bg-[#FAFAF8] text-[#6B6860] flex items-center justify-center active:scale-95 disabled:opacity-35">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div class="flex-1 min-w-0 flex items-center gap-2">${fieldInputs}</div>
        <button data-rows-del="${rowsKey}" data-rows-idx="${i}" class="w-10 h-10 rounded-full border border-[#E8E5E1] bg-[#FAFAF8] text-[#9A9491] flex items-center justify-center flex-shrink-0 active:scale-94 transition-colors">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>`;
    }).join('');
  }

  return `<div data-rows-container="${rowsKey}">${rowsHtml}</div>
    <button data-rows-add="${rowsKey}" class="mt-1 w-full h-12 rounded-2xl bg-[#F5F3F0] border border-[#E8E5E1] text-[#1E2820] font-semibold text-[13px] active:scale-95 transition-transform flex items-center justify-center gap-2">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
      Добавить пункт
    </button>
    ${field.hint ? `<p class="mt-2 text-[12px] text-[#B0AB9E]">${esc(field.hint)}</p>` : ''}`;
}

// ─── Info (read-only) ─────────────────────────────────────────────────────
function renderInfoField(field) {
  let html = '<div class="mt-2 p-4 rounded-2xl bg-[#F5F3F0] text-[13px] text-[#6B6860] leading-relaxed">';
  if (field.title) html += `<p class="font-semibold text-[#1E2820] mb-2">${esc(field.title)}</p>`;
  if (field.text) html += `<p>${esc(field.text)}</p>`;
  if (field.items) {
    html += `<div class="space-y-1.5">${field.items.map(q =>
      `<div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-[#C2E0C6] flex items-center justify-center flex-shrink-0">
          <svg width="10" height="10" fill="none" stroke="#1A3D20" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <span>${esc(q)}</span>
      </div>`).join('')}</div>`;
  }
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════
// POST-RENDER BINDINGS — photo uploads, palette sync
// ═══════════════════════════════════════════════════════════════════════════

function bindAllPhotoUploads(panel, blockType) {
  panel.querySelectorAll('[data-photo-block]').forEach(upload => {
    const bType = upload.dataset.photoBlock;
    const key = upload.dataset.photoKey;
    const uid = `photo_${bType}_${key}`;
    const fileInput = document.getElementById(`${uid}_file`);
    const editBtn = document.getElementById(`${uid}_editBtn`);
    if (!fileInput) return;

    const open = () => { if (!APP.ui.photoUploading) fileInput.click(); };
    upload.addEventListener('click', open);
    editBtn?.addEventListener('click', (e) => { e.stopPropagation(); open(); });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file || APP.ui.photoUploading) return;

      APP.ui.photoUploading = true;
      upload.classList.add('uploading');
      const blobUrl = URL.createObjectURL(file);
      const img = document.getElementById(`${uid}_preview`);
      if (img) img.src = blobUrl;
      upload.classList.add('has-image');
      showToast('Загружаем фото…');

      try {
        const url = await uploadPhoto(file);
        APP.blocks[bType][key] = url;
        if (img) img.src = url;
        markDirty();
        debouncedPreview();
        showToast('Фото сохранено', 'success');
      } catch {
        showToast('Не удалось загрузить фото', 'error');
        const prev = APP.blocks[bType]?.[key] || '';
        if (img) img.src = prev;
        upload.classList.toggle('has-image', !!prev);
      } finally {
        APP.ui.photoUploading = false;
        upload.classList.remove('uploading');
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      }
    });
  });
}

function bindAllPalettes(panel, blockType) {
  // Palette sync is handled by event delegation — nothing special needed here
}

function syncPaletteUI(paletteKey) {
  const panel = document.getElementById('panelContent');
  if (!panel) return;
  const [bType, fKey] = paletteKey.split('.');
  const blockState = APP.blocks[bType];
  if (!blockState) return;
  const blockDef = getBlockDef(bType);
  if (!blockDef) return;

  let fieldDef = null;
  for (const s of blockDef.sections || []) {
    for (const f of s.fields || []) {
      if (f.key === fKey && f.type === 'color-palette') { fieldDef = f; break; }
    }
    if (fieldDef) break;
  }
  if (!fieldDef) return;

  const slotCount = fieldDef.slotCount || 5;
  const fallback = fieldDef.default || [];
  const palette = (Array.isArray(blockState[fKey]) && blockState[fKey].length ? blockState[fKey] : fallback).slice(0, slotCount);
  const activeSlot = APP.ui.paletteSlots[paletteKey] || 0;
  const active = palette[activeSlot] || palette[0] || '#3D6B45';

  panel.querySelectorAll(`[data-pal-slot="${paletteKey}"]`).forEach(btn => {
    const idx = parseInt(btn.dataset.palIdx, 10);
    btn.style.background = palette[idx] || '#FFF';
    btn.classList.toggle('active', idx === activeSlot);
  });
  panel.querySelectorAll(`[data-pal-color="${paletteKey}"]`).forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.palHex || '').toLowerCase() === active.toLowerCase());
  });
  const hexInput = panel.querySelector(`[data-pal-input="${paletteKey}"]`);
  if (hexInput) hexInput.value = active;
  const prev = panel.querySelector(`[data-pal-preview="${paletteKey}"]`);
  if (prev) prev.style.background = active;
  const slotLabel = panel.querySelector(`[data-pal-slot-label="${paletteKey}"]`);
  if (slotLabel) slotLabel.textContent = `Цвет ${activeSlot + 1} из ${palette.length}`;
}

function applyPaletteColor(paletteKey, color, autoAdvance = false) {
  const [bType, fKey] = paletteKey.split('.');
  const blockState = APP.blocks[bType];
  if (!blockState) return;
  const blockDef = getBlockDef(bType);
  if (!blockDef) return;

  let fieldDef = null;
  for (const s of blockDef.sections || []) {
    for (const f of s.fields || []) {
      if (f.key === fKey) { fieldDef = f; break; }
    }
    if (fieldDef) break;
  }
  const slotCount = fieldDef?.slotCount || 5;
  const fallback = fieldDef?.default || [];
  if (!blockState[fKey] || blockState[fKey].length < slotCount) {
    blockState[fKey] = (blockState[fKey] || []).concat(fallback).slice(0, slotCount);
  }
  const slot = APP.ui.paletteSlots[paletteKey] || 0;
  blockState[fKey][slot] = color;

  // Авто-переход к следующему слоту (только при клике на пресет)
  if (autoAdvance) {
    APP.ui.paletteSlots[paletteKey] = slot + 1 < slotCount ? slot + 1 : 0;
  }

  syncPaletteUI(paletteKey);
  markDirty();
  debouncedPreview();
}
