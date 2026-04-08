// ═══════════════════════════════════════════════════════════════════════════
// ToiLink Editor — Interactive bottom-sheet editor with live preview
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = '';

// ─── State ──────────────────────────────────────────────────────────────────
let editEventId      = null;
let existingEvent    = null;
let selectedTemplate = null;
let activeBlock      = 'main';
let previewReady     = false;

const state = {
  title:        '',
  person1:      '',
  person2:      '',
  eventDate:    '',
  rsvpDeadline: '',
  language:     'ru',
  coverImageUrl:'',
  blocks: {
    hero:      { badge: '✦ Свадьба ✦', subtitle: 'приглашают на торжество' },
    photo:     { enabled: true,  url: '' },
    greeting:  { enabled: true,  title: 'Дорогие гости!', text: '' },
    schedule:  { enabled: true,  rows: [] },
    location:  { enabled: true,  placeName: '', address: '', mapLink: '' },
    dresscode: { enabled: true,  text: '', palette: ['#E8EBE6','#2C3531','#B9C4BC','#F2F4F1','#7C9082'] },
  },
};

// ─── Block definitions for template-2 ───────────────────────────────────────
const BLOCKS = [
  { type: 'main',      label: 'Основное',  icon: mainIcon(),    optional: false },
  { type: 'hero',      label: 'Экран',     icon: heroIcon(),    optional: false },
  { type: 'photo',     label: 'Фото',      icon: photoIcon(),   optional: true  },
  { type: 'greeting',  label: 'Слово',     icon: wordIcon(),    optional: true  },
  { type: 'schedule',  label: 'Программа', icon: schedIcon(),   optional: true  },
  { type: 'location',  label: 'Место',     icon: pinIcon(),     optional: true  },
  { type: 'dresscode', label: 'Стиль',     icon: styleIcon(),   optional: true  },
];

// ─── API ────────────────────────────────────────────────────────────────────
async function fetchTemplates() {
  const res = await fetch(`${BASE_URL}/api/organizer/templates`);
  if (!res.ok) throw new Error('Ошибка загрузки шаблонов');
  return res.json();
}
async function fetchEvent(id, phone) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${id}`, {
    headers: { 'X-User-Phone': phone },
  });
  if (!res.ok) throw new Error('Событие не найдено');
  return res.json();
}
async function saveEvent(phone, data, id = null) {
  const url    = id ? `${BASE_URL}/api/organizer/events/${id}` : `${BASE_URL}/api/organizer/events`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-User-Phone': phone },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Ошибка сохранения');
  }
  return res.json();
}
async function uploadPhoto(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE_URL}/api/organizer/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return (await res.json()).url;
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — Template Picker
// ═══════════════════════════════════════════════════════════════════════════
const CAT_LABEL = { WEDDING: 'Свадьба', BIRTHDAY: 'День рождения', TOY: 'Той', OTHER: 'Другое' };

function renderTemplatePicker(templates) {
  const s1 = document.getElementById('step1');
  if (!s1) return;
  s1.innerHTML = `
    <div class="mb-6">
      <h2 class="font-cormorant text-[28px] font-semibold italic text-[#1E2820] leading-tight">Выберите шаблон</h2>
      <p class="text-[#6B6860] text-sm mt-1">Шаблон определяет оформление приглашения</p>
    </div>
    <div class="flex flex-col gap-3">
      ${templates.map(t => templateCard(t)).join('')}
    </div>
    <button id="btn-next" onclick="goToEditor()" disabled
      class="btn-filled mt-6" style="opacity:0.3">
      Продолжить
    </button>`;
}

function templateCard(t) {
  const preview = t.templatePath === 'template-2'
    ? `<div style="height:80px;background:linear-gradient(135deg,#FAFAF8,#F0EDE9);display:flex;align-items:center;justify-content:center;padding:12px">
         <p style="font-family:Cormorant Garamond,serif;font-style:italic;font-size:22px;color:#1A1A1A;opacity:0.5">А & Б</p>
       </div>`
    : `<div style="height:80px;background:linear-gradient(135deg,#F5F0E8,#EAE4D8);display:flex;align-items:center;justify-content:center">
         <p style="font-family:Cormorant Garamond,serif;font-style:italic;font-size:22px;color:#2C3531;opacity:0.6">А & М</p>
       </div>`;

  return `
    <div onclick="selectTemplate(${t.id})" id="tpl-${t.id}" class="template-card">
      ${preview}
      <div class="px-4 py-3 flex items-center justify-between">
        <div>
          <p class="font-semibold text-[#1E2820] text-[15px]">${t.name}</p>
          ${t.description ? `<p class="text-xs text-[#6B6860] mt-0.5">${t.description}</p>` : ''}
        </div>
        <span class="text-[11px] px-2.5 py-1 rounded-full bg-[#C2E0C6] text-[#1A3D20] font-semibold flex-shrink-0">
          ${CAT_LABEL[t.category] || t.category}
        </span>
      </div>
    </div>`;
}

window.selectTemplate = function (id) {
  selectedTemplate = window._templates?.find(t => t.id === id);
  document.querySelectorAll('.template-card').forEach(el => el.classList.remove('selected'));
  document.getElementById('tpl-' + id)?.classList.add('selected');
  const btn = document.getElementById('btn-next');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
};

window.goToEditor = function () {
  if (!selectedTemplate) return;
  openEditorOverlay();
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — Interactive Editor Overlay
// ═══════════════════════════════════════════════════════════════════════════
function openEditorOverlay() {
  const overlay = document.getElementById('editorOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  // Populate from existing event if editing
  if (existingEvent) populateStateFromEvent(existingEvent);

  document.getElementById('editorTitle').value = state.title;
  renderBlockTabs();
  activateBlock('main');
  initDragHandle();

  // Anchor overlay to visual viewport (keyboard-safe)
  initVisualViewport();

  // Load preview iframe
  const frame = document.getElementById('previewFrame');
  window.addEventListener('message', onPreviewMessage);
  frame.src = '/templates/template-2/index.html?mode=preview';
}

function populateStateFromEvent(ev) {
  state.title        = ev.title        || '';
  state.person1      = ev.person1      || '';
  state.person2      = ev.person2      || '';
  state.eventDate    = ev.eventDate    ? ev.eventDate.substring(0, 16) : '';
  state.rsvpDeadline = ev.rsvpDeadline ? ev.rsvpDeadline.substring(0, 16) : '';
  state.language     = ev.language     || 'ru';
  state.coverImageUrl= ev.coverImageUrl || '';

  let bc = {};
  try { bc = JSON.parse(ev.blocksConfig || '{}'); } catch (_) {}

  if (bc.hero) {
    state.blocks.hero.badge    = bc.hero.badge    || state.blocks.hero.badge;
    state.blocks.hero.subtitle = bc.hero.subtitle || state.blocks.hero.subtitle;
  }
  if (bc.photo) {
    state.blocks.photo.enabled = bc.photo.enabled !== false;
    state.blocks.photo.url     = bc.photo.url || '';
  }
  if (bc.greeting) {
    state.blocks.greeting.enabled = bc.greeting.enabled !== false;
    state.blocks.greeting.title   = bc.greeting.title || '';
    state.blocks.greeting.text    = bc.greeting.text  || '';
  }
  if (bc.schedule) {
    state.blocks.schedule.enabled = bc.schedule.enabled !== false;
    state.blocks.schedule.rows = (bc.schedule.items || '')
      .split('\n').map(l => l.trim()).filter(Boolean)
      .map(line => {
        const m = line.match(/^(\d{1,2}:\d{2})\s+(.*)/);
        return m ? { time: m[1], title: m[2] } : { time: '', title: line };
      });
  }
  if (bc.location) {
    state.blocks.location.enabled   = bc.location.enabled !== false;
    state.blocks.location.placeName = bc.location.placeName || '';
    state.blocks.location.address   = bc.location.address   || '';
    state.blocks.location.mapLink   = bc.location.mapLink   || '';
  }
  if (bc.dresscode) {
    state.blocks.dresscode.enabled = bc.dresscode.enabled !== false;
    state.blocks.dresscode.text    = bc.dresscode.text || '';
    if (bc.dresscode.palette) {
      state.blocks.dresscode.palette = bc.dresscode.palette.split(',').map(s => s.trim());
    }
  }
}

function onPreviewMessage(e) {
  if (e.data?.type === 'T2_READY') {
    previewReady = true;
    sendToPreview();
  }
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
function renderBlockTabs() {
  const el = document.getElementById('blockTabs');
  if (!el) return;
  el.innerHTML = BLOCKS.map(b => `
    <button class="btab${b.type === activeBlock ? ' active' : ''}${hasBlockData(b.type) ? ' has-data' : ''}"
            id="tab-${b.type}" onclick="activateBlock('${b.type}')">
      <span class="dot"></span>
      ${b.icon}
      ${b.label}
    </button>`).join('');
}

function hasBlockData(type) {
  if (type === 'main') return !!(state.person1 || state.person2 || state.eventDate);
  if (type === 'hero') return !!(state.blocks.hero.badge || state.blocks.hero.subtitle);
  const b = state.blocks[type];
  return b && b.enabled;
}

window.activateBlock = function (type) {
  activeBlock = type;
  // If sheet is collapsed, expand to half
  const sheet = document.getElementById('bottomSheet');
  if (sheet && window._snapSheet) {
    const VH = window.innerHeight / 100;
    if (sheet.offsetHeight < 28 * VH) {
      window._snapSheet(46);
    }
  }
  // Update tab states
  BLOCKS.forEach(b => {
    const tab = document.getElementById('tab-' + b.type);
    if (!tab) return;
    tab.classList.toggle('active', b.type === type);
    tab.classList.toggle('has-data', hasBlockData(b.type));
  });
  // Scroll active tab into view
  document.getElementById('tab-' + type)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  // Render panel
  renderPanel(type);
  // Scroll preview to relevant section
  scrollPreviewTo(type);
};

// ─── Preview communication ────────────────────────────────────────────────
function buildPreviewConfig() {
  const b = state.blocks;
  const dateObj = state.eventDate ? new Date(state.eventDate) : null;
  const pad = n => String(n).padStart(2, '0');
  const dateDisplay = dateObj
    ? `${dateObj.getDate()} · ${pad(dateObj.getMonth()+1)} · ${dateObj.getFullYear()}`
    : '';
  const dateShort = dateObj
    ? `${pad(dateObj.getDate())}.${pad(dateObj.getMonth()+1)}.${dateObj.getFullYear()}`
    : '';

  return {
    modules: {
      photo:     b.photo.enabled     && !!b.photo.url,
      greeting:  b.greeting.enabled,
      countdown: !!state.eventDate,
      schedule:  b.schedule.enabled  && b.schedule.rows.length > 0,
      location:  b.location.enabled,
      dresscode: b.dresscode.enabled,
      rsvp:      true,
    },
    badge:       b.hero.badge    || '✦ Свадьба ✦',
    name1:       state.person1   || 'Имя 1',
    name2:       state.person2   || 'Имя 2',
    eventDate:   state.eventDate || null,
    dateDisplay, dateShort,
    subtitle:    b.hero.subtitle || '',
    photoUrl:    b.photo.url     || null,
    greeting:    { title: b.greeting.title, text: b.greeting.text },
    schedule:    b.schedule.rows.filter(r => r.time || r.title),
    location: {
      placeName: b.location.placeName,
      address:   b.location.address,
      mapLink:   b.location.mapLink || '#',
    },
    dresscode: {
      text:    b.dresscode.text,
      palette: b.dresscode.palette,
    },
    rsvp: {
      title:    'Подтверждение',
      subtitle: state.rsvpDeadline
        ? 'Просим подтвердить до ' + new Date(state.rsvpDeadline).toLocaleDateString('ru-RU')
        : '',
      _slug: null,
    },
  };
}

function sendToPreview() {
  if (!previewReady) return;
  try {
    const frame = document.getElementById('previewFrame');
    frame.contentWindow.postMessage({ type: 'T2_UPDATE', config: buildPreviewConfig() }, '*');
  } catch (_) {}
}

function scrollPreviewTo(blockType) {
  const sectionMap = {
    main: 'hero', hero: 'hero', photo: 'photo-block',
    greeting: 'greeting', schedule: 'schedule',
    location: 'location', dresscode: 'dresscode',
  };
  const id = sectionMap[blockType];
  if (!id) return;
  try {
    const frame = document.getElementById('previewFrame');
    const target = frame.contentWindow.document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════
// PANELS
// ═══════════════════════════════════════════════════════════════════════════
function renderPanel(type) {
  const el = document.getElementById('panelContent');
  if (!el) return;
  const renderers = {
    main:      renderMainPanel,
    hero:      renderHeroPanel,
    photo:     renderPhotoPanel,
    greeting:  renderGreetingPanel,
    schedule:  renderSchedulePanel,
    location:  renderLocationPanel,
    dresscode: renderDresscodePanel,
  };
  el.innerHTML = (renderers[type] || (() => ''))();
  el.scrollTop = 0;
  bindPanelListeners(type);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function field(label, input) {
  return `<div class="pfield"><label class="plabel">${label}</label>${input}</div>`;
}
function inp(name, value, placeholder = '', type = 'text') {
  return `<input class="pinput" type="${type}" data-field="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
}
function esc(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function toggleRow(blockType, label, hint = '') {
  const on = state.blocks[blockType]?.enabled;
  return `
    <div class="ptoggle-row">
      <div>
        <div class="ptoggle-label">${label}</div>
        ${hint ? `<div class="ptoggle-hint">${hint}</div>` : ''}
      </div>
      <div class="pswitch ${on ? 'on' : ''}" onclick="toggleBlock('${blockType}')"></div>
    </div>`;
}

window.toggleBlock = function (type) {
  if (!state.blocks[type]) return;
  state.blocks[type].enabled = !state.blocks[type].enabled;
  // update switch
  const sw = document.querySelector(`[onclick="toggleBlock('${type}')"]`);
  if (sw) sw.classList.toggle('on', state.blocks[type].enabled);
  sendToPreview();
  // update tab dot
  const tab = document.getElementById('tab-' + type);
  if (tab) tab.classList.toggle('has-data', hasBlockData(type));
};

// ── Panel: Main (person1, person2, date) ─────────────────────────────────────
function renderMainPanel() {
  return `
    <div class="psection">
      <div class="psection-title">Имена</div>
      ${field('Имя 1 (Жених / Организатор)', inp('person1', state.person1, 'Азамат'))}
      ${field('Имя 2 (Невеста / и др.)',     inp('person2', state.person2, 'Бегимай'))}
    </div>
    <div class="psection">
      <div class="psection-title">Дата и время</div>
      ${field('Дата события', inp('eventDate', state.eventDate, '', 'datetime-local'))}
      ${field('RSVP — принимать ответы до', inp('rsvpDeadline', state.rsvpDeadline, '', 'datetime-local'))}
    </div>
    <div class="psection">
      <div class="psection-title">Название события</div>
      ${field('Заголовок (только для организатора)', inp('title', state.title, 'Свадьба Азамата и Бегимай'))}
    </div>`;
}

// ── Panel: Hero ────────────────────────────────────────────────────────────────
function renderHeroPanel() {
  return `
    <div class="psection">
      <div class="psection-title">Главный экран</div>
      <p style="font-size:13px;color:#9A9491;margin-bottom:14px;line-height:1.5">
        Первое что видит гость — имена, дата, бейдж и подзаголовок.
      </p>
      ${field('Бейдж (маленький текст сверху)', inp('hero.badge', state.blocks.hero.badge, '✦ Свадьба ✦'))}
      ${field('Подзаголовок (под именами)',     inp('hero.subtitle', state.blocks.hero.subtitle, 'приглашают на торжество'))}
    </div>`;
}

// ── Panel: Photo ──────────────────────────────────────────────────────────────
function renderPhotoPanel() {
  const url = state.blocks.photo.url;
  return `
    ${toggleRow('photo', 'Показывать фото', 'Фото пары')}
    <div class="pfield">
      <div class="photo-upload ${url ? 'has-image' : ''}" id="photoUpload" onclick="triggerPhotoFile()">
        <img id="photoPreview" src="${esc(url)}" alt="">
        <div class="photo-upload-placeholder">
          <div class="photo-upload-icon">${photoIcon()}</div>
          <div class="photo-upload-text">Нажмите, чтобы<br>выбрать фото</div>
        </div>
        <div class="photo-change-overlay">Заменить</div>
      </div>
      <input type="file" id="photoFile" accept="image/*" class="hidden" onchange="handlePhotoFile(event)">
    </div>`;
}

window.triggerPhotoFile = function () {
  document.getElementById('photoFile')?.click();
};

window.handlePhotoFile = async function (e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Show local blob preview immediately
  setPhotoPreview(URL.createObjectURL(file));
  showToast('Загрузка...');

  try {
    const url = await uploadPhoto(file);
    state.blocks.photo.url = url;
    setPhotoPreview(url);
    sendToPreview();
    showToast('Фото сохранено');
  } catch {
    showToast('Ошибка загрузки фото');
    setPhotoPreview(state.blocks.photo.url);
  }
};

function setPhotoPreview(url) {
  const preview = document.getElementById('photoPreview');
  const upload  = document.getElementById('photoUpload');
  if (preview) preview.src = url;
  if (upload) upload.classList.toggle('has-image', !!url);
}

// ── Panel: Greeting ────────────────────────────────────────────────────────────
function renderGreetingPanel() {
  return `
    ${toggleRow('greeting', 'Показывать приветствие')}
    ${field('Заголовок', inp('greeting.title', state.blocks.greeting.title, 'Дорогие гости!'))}
    <div class="pfield">
      <label class="plabel">Текст обращения</label>
      <textarea class="ptextarea" data-field="greeting.text"
                placeholder="С большой радостью приглашаем вас разделить с нами этот особенный день...">${esc(state.blocks.greeting.text)}</textarea>
    </div>`;
}

// ── Panel: Schedule ────────────────────────────────────────────────────────────
function renderSchedulePanel() {
  return `
    ${toggleRow('schedule', 'Показывать программу')}
    <div id="schedRows">${renderSchedRows()}</div>
    <button class="sched-add" onclick="addSchedRow()">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
      </svg>
      Добавить пункт
    </button>`;
}

function renderSchedRows() {
  return state.blocks.schedule.rows.map((row, i) => `
    <div class="sched-row" data-row="${i}">
      <input class="sched-time" type="text" value="${esc(row.time)}" placeholder="15:00"
             oninput="updateSchedRow(${i},'time',this.value)">
      <input class="sched-title" type="text" value="${esc(row.title)}" placeholder="Название пункта"
             oninput="updateSchedRow(${i},'title',this.value)">
      <button class="sched-del" onclick="deleteSchedRow(${i})">×</button>
    </div>`).join('');
}

window.addSchedRow = function () {
  state.blocks.schedule.rows.push({ time: '', title: '' });
  document.getElementById('schedRows').innerHTML = renderSchedRows();
  sendToPreview();
};

window.updateSchedRow = function (i, field, value) {
  if (state.blocks.schedule.rows[i]) {
    state.blocks.schedule.rows[i][field] = value;
    sendToPreview();
  }
};

window.deleteSchedRow = function (i) {
  state.blocks.schedule.rows.splice(i, 1);
  document.getElementById('schedRows').innerHTML = renderSchedRows();
  sendToPreview();
};

// ── Panel: Location ────────────────────────────────────────────────────────────
function renderLocationPanel() {
  const l = state.blocks.location;
  return `
    ${toggleRow('location', 'Показывать место')}
    ${field('Название заведения',              inp('location.placeName', l.placeName, 'Ресторан Royal Hall'))}
    ${field('Адрес',                           inp('location.address',   l.address,   'г. Бишкек, ул. Мадиева 18/1'))}
    ${field('Ссылка на карту (2GIS / Google)', inp('location.mapLink',   l.mapLink,   'https://2gis.kg/...', 'url'))}`;
}

// ── Panel: Dresscode ────────────────────────────────────────────────────────────
function renderDresscodePanel() {
  const d = state.blocks.dresscode;
  const swatches = d.palette.slice(0, 5).map((c, i) => `
    <div class="palette-swatch" style="background:${c}">
      <input type="color" value="${c}" data-pal="${i}" oninput="updatePalette(${i},this.value)">
    </div>`).join('');

  return `
    ${toggleRow('dresscode', 'Показывать дресс-код')}
    ${field('Описание', inp('dresscode.text', d.text, 'Будем рады, если вы поддержите цветовую гамму нашей свадьбы'))}
    <div class="pfield">
      <label class="plabel">Цветовая палитра (нажмите для изменения)</label>
      <div class="palette-row" id="paletteRow">${swatches}</div>
    </div>`;
}

window.updatePalette = function (i, color) {
  state.blocks.dresscode.palette[i] = color;
  const swatch = document.querySelector(`[data-pal="${i}"]`)?.closest('.palette-swatch');
  if (swatch) swatch.style.background = color;
  sendToPreview();
};

// ─── Bind input listeners ──────────────────────────────────────────────────
function bindPanelListeners(type) {
  const panel = document.getElementById('panelContent');
  if (!panel) return;

  panel.querySelectorAll('[data-field]').forEach(input => {
    const eventType = input.tagName === 'TEXTAREA' ? 'input' : 'input';
    input.addEventListener(eventType, () => {
      setNestedState(input.dataset.field, input.value);
      sendToPreview();
    });
  });
}

function setNestedState(path, value) {
  const parts = path.split('.');
  if (parts.length === 1) {
    state[parts[0]] = value;
    if (parts[0] === 'title') {
      document.getElementById('editorTitle').value = value;
    }
  } else if (parts.length === 2) {
    if (!state.blocks[parts[0]]) return;
    state.blocks[parts[0]][parts[1]] = value;
  }
}

// ─── Drag handle ──────────────────────────────────────────────────────────────
function initDragHandle() {
  const handle = document.getElementById('sheetHandle');
  const sheet  = document.getElementById('bottomSheet');
  if (!handle || !sheet) return;

  let startY = 0, startH = 0, dragging = false;
  const VH = () => window.innerHeight / 100;
  const SNAP = [11, 46, 88]; // dvh: collapsed / half / full

  function snapSheet(dvh) {
    sheet.style.transition = 'height 0.28s cubic-bezier(0.4,0,0.2,1)';
    sheet.style.height = dvh + 'dvh';
    // Show/hide panel content based on collapsed state
    const panel = document.getElementById('panelContent');
    if (panel) panel.style.visibility = dvh <= SNAP[0] ? 'hidden' : '';
  }

  window._snapSheet = snapSheet;

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
    let target;
    if (cur < 28) target = SNAP[0];
    else if (cur < 67) target = SNAP[1];
    else target = SNAP[2];
    snapSheet(target);
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

window.toggleSheetPeek = function () {
  const sheet = document.getElementById('bottomSheet');
  if (!sheet || !window._snapSheet) return;
  const VH = window.innerHeight / 100;
  const isCollapsed = sheet.offsetHeight < 28 * VH;
  window._snapSheet(isCollapsed ? 46 : 11);
  // Update icon: eye-off when collapsed (preview visible), eye when expanded
  const icon = document.querySelector('#sheetPeek svg');
  if (icon) {
    if (!isCollapsed) {
      // Now collapsing → show eye-off (crossed out)
      icon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round"/>`;
    } else {
      // Now expanding → show eye
      icon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>`;
    }
  }
};

// ─── Visual Viewport — anchor overlay to visible area above keyboard ──────────
// This is the canonical approach: when keyboard appears the overlay shrinks
// to match the visual viewport, so no white space and bottom sheet stays visible.
let _vvListeners = null;

function initVisualViewport() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  const overlay = document.getElementById('editorOverlay');
  if (!overlay) return;

  function update() {
    // Pin the overlay to exactly the visual viewport (visible area above keyboard)
    overlay.style.top    = vv.offsetTop  + 'px';
    overlay.style.left   = vv.offsetLeft + 'px';
    overlay.style.width  = vv.width      + 'px';
    overlay.style.height = vv.height     + 'px';
  }

  // Clean up old listeners if any
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
  // Reset overlay to CSS defaults
  const overlay = document.getElementById('editorOverlay');
  if (overlay) {
    overlay.style.top = '';
    overlay.style.left = '';
    overlay.style.width = '';
    overlay.style.height = '';
  }
}

// ─── Scroll focused input into view inside panel ────────────────────────────
// Ensures input is not hidden under the keyboard when panel is small
document.getElementById('panelContent')?.addEventListener('focusin', (e) => {
  const input = e.target;
  if (!input.matches('input,textarea,select')) return;
  // Small delay to let keyboard fully animate
  setTimeout(() => {
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 320);
}, true);

// ─── Editor title sync ──────────────────────────────────────────────────────
document.getElementById('editorTitle')?.addEventListener('input', function () {
  state.title = this.value;
});

// ─── Save ──────────────────────────────────────────────────────────────────
document.getElementById('editorSave')?.addEventListener('click', handleSave);
document.getElementById('editorBack')?.addEventListener('click', () => {
  document.getElementById('editorOverlay')?.classList.add('hidden');
  previewReady = false;
  window.removeEventListener('message', onPreviewMessage);
  destroyVisualViewport();
});

async function handleSave() {
  const phone = localStorage.getItem('tl_phone');
  if (!phone) return;

  const b = state.blocks;
  const blocksConfig = {
    hero:     { enabled: true, ...b.hero },
    photo:    { enabled: b.photo.enabled,    url:       b.photo.url },
    greeting: { enabled: b.greeting.enabled, title:     b.greeting.title, text: b.greeting.text },
    schedule: {
      enabled: b.schedule.enabled,
      items:   b.schedule.rows.map(r => `${r.time} ${r.title}`.trim()).filter(Boolean).join('\n'),
    },
    location: { enabled: b.location.enabled, ...b.location },
    dresscode: {
      enabled: b.dresscode.enabled,
      text:    b.dresscode.text,
      palette: b.dresscode.palette.join(','),
    },
  };

  const data = {
    title:         state.title || `${state.person1} & ${state.person2}`,
    person1:       state.person1  || null,
    person2:       state.person2  || null,
    eventDate:     state.eventDate     || null,
    rsvpDeadline:  state.rsvpDeadline  || null,
    language:      state.language      || 'ru',
    coverImageUrl: state.blocks.photo.url || null,
    blocksConfig:  JSON.stringify(blocksConfig),
    ...(selectedTemplate && !editEventId ? { templateId: selectedTemplate.id } : {}),
    ...(editEventId ? { status: existingEvent?.status || 'DRAFT' } : {}),
  };

  const btn = document.getElementById('editorSave');
  btn.disabled = true; btn.textContent = 'Сохраняю...';

  try {
    await saveEvent(phone, data, editEventId);
    location.href = '/';
  } catch (err) {
    showToast(err.message);
    btn.disabled = false; btn.textContent = 'Сохранить';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ICONS (inline SVG)
// ═══════════════════════════════════════════════════════════════════════════
function mainIcon()  { return svg('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'); }
function heroIcon()  { return svg('M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'); }
function photoIcon() { return svg('M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'); }
function wordIcon()  { return svg('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'); }
function schedIcon() { return svg('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'); }
function pinIcon()   { return svg('M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z'); }
function styleIcon() { return svg('M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01'); }
function svg(d) {
  return `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════
async function init() {
  const params    = new URLSearchParams(location.search);
  editEventId = params.get('id') ? parseInt(params.get('id')) : null;

  const phone = await window.initAuth?.();
  if (!phone) { location.href = '/'; return; }

  try {
    const templates = await fetchTemplates();
    window._templates = templates;

    if (editEventId) {
      existingEvent    = await fetchEvent(editEventId, phone);
      selectedTemplate = templates.find(t => t.id === existingEvent.templateId) || null;
      state.title      = existingEvent.title || '';
      openEditorOverlay();
    } else {
      // Show template picker only if there are templates
      if (templates.length === 1) {
        // Auto-select if only one template
        selectTemplate(templates[0].id);
        goToEditor();
      } else {
        renderTemplatePicker(templates);
      }
    }
  } catch (err) {
    showToast(err.message);
  }
}

init();
