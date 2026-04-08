// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = '';

/**
 * ImgBB API key for automatic photo upload.
 * Get a free key at https://imgbb.com/
 * Leave empty to use manual URL input as fallback.
 */
const IMGBB_KEY = '';

// ─── State ────────────────────────────────────────────────────────────────────
let selectedTemplate = null;
let editEventId      = null;
let existingEvent    = null;

// ─── API ──────────────────────────────────────────────────────────────────────
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
  const res    = await fetch(url, {
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

// Upload image file to ImgBB, return URL string or throw
async function uploadToImgbb(file) {
  if (!IMGBB_KEY) throw new Error('IMGBB_KEY не настроен');
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST', body: fd,
  });
  if (!res.ok) throw new Error('Ошибка загрузки');
  const json = await res.json();
  return json.data.display_url;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed left-1/2 -translate-x-1/2 bg-[#1E2820] text-white text-sm px-5 py-3 rounded-2xl z-50 shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-300';
  t.style.bottom = 'calc(80px + env(safe-area-inset-bottom, 0px))';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

const fieldLabels = {
  title:       'Заголовок',       subtitle:    'Подзаголовок',
  badge:       'Бейдж',          image_url:   'Обложка',
  date:        'Дата',           address:     'Адрес',
  map_url:     'Ссылка на карту (2GIS / Google Maps)',
  text:        'Текст',
  photo1:      'Главное фото',   carousel1:   'Фото карусели 1',
  carousel2:   'Фото карусели 2', carousel3:  'Фото карусели 3',
  photoBottom: 'Нижнее фото',   items:       'Программа дня',
  placeName:   'Название заведения', mapLink: 'Ссылка на карту',
  btnText:     'Текст кнопки',   palette:    'Цвета дресс-кода',
  author:      'Автор цитаты',
};

const fieldPlaceholders = {
  title: 'Свадьба Айны и Марата', subtitle: 'Приглашаем разделить этот особенный день',
  badge: '✦ Свадьба ✦', address: 'Бишкек, ресторан Арашан',
  map_url: 'https://2gis.kg/...', mapLink: 'https://2gis.kg/...',
  text: 'Дорогие гости!...',
  items: '15:00 — Сбор гостей\n16:00 — Торжественная церемония\n17:00 — Праздничный банкет',
  placeName: 'Ресторан Royal Hall', btnText: 'Показать на карте',
  author: 'Антуан де Сент-Экзюпери',
};

// Icons per block type, displayed in the block header
const blockIcons = {
  hero:      `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3l14 9-14 9V3z"/></svg>`,
  greeting:  `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>`,
  photos:    `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  schedule:  `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  location:  `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>`,
  dresscode: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>`,
  quote:     `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
};

const DEFAULT_PALETTE = ['#E8EBE6', '#2C3531', '#B9C4BC', '#F2F4F1', '#7C9082'];

// ─── Step 1 — Template picker ─────────────────────────────────────────────────
const categoryLabel = { WEDDING: 'Свадьба', BIRTHDAY: 'День рождения', TOY: 'Той', OTHER: 'Другое' };

function templateThumb(category, name) {
  const map = {
    WEDDING:  `<div class="h-32 rounded-2xl bg-[#F5F0E8] border border-[#E5E0D8] flex flex-col items-center justify-center gap-1.5">
                 <p class="font-cormorant italic text-[#1E2820]/70 text-3xl leading-none">А &amp; М</p>
                 <div class="w-10 h-px bg-[#B8A98A]/50"></div>
                 <p class="text-[8px] uppercase tracking-[0.25em] text-[#B8A98A]">свадьба</p>
               </div>`,
    BIRTHDAY: `<div class="h-32 rounded-2xl bg-gradient-to-br from-[#FDE68A]/30 to-[#FCA5A5]/25 border border-[#FDE68A]/40 flex flex-col items-center justify-center gap-2">
                 <svg class="w-9 h-9 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6l3-3 3 3M12 3v6M6 21V10a2 2 0 012-2h8a2 2 0 012 2v11"/></svg>
                 <p class="text-xs font-medium text-[#92400E]/60">День рождения</p>
               </div>`,
    TOY:      `<div class="h-32 rounded-2xl bg-gradient-to-br from-[#D1FAE5]/50 to-[#6B8F71]/15 border border-[#6B8F71]/20 flex flex-col items-center justify-center gap-2">
                 <svg class="w-9 h-9 text-[#6B8F71]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                 <p class="text-xs font-medium text-[#065F46]/60">Той</p>
               </div>`,
  };
  return map[category] || `<div class="h-32 rounded-2xl bg-[#F5F5F4] border border-[#E7E5E4] flex items-center justify-center">
    <p class="text-sm font-medium text-[#1E2820]/30">${name}</p></div>`;
}

function renderTemplatePicker(templates) {
  document.getElementById('step1').innerHTML = `
    <div class="mb-6">
      <h2 class="font-cormorant text-[28px] font-semibold italic text-[#1E2820] leading-tight">Выберите шаблон</h2>
      <p class="text-[#6B6860] text-sm mt-1">Шаблон определяет оформление вашего приглашения</p>
    </div>

    <div class="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4">
      ${templates.map(t => templateCard(t, true)).join('')}
    </div>
    <div class="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${templates.map(t => templateCard(t, false)).join('')}
    </div>

    <button id="btn-next" onclick="goToStep2()" disabled
      class="mt-6 w-full py-4 bg-[#3D6B45] text-white rounded-2xl font-semibold text-[15px] transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
      style="box-shadow: 0 2px 8px rgba(61,107,69,0.28)">
      Продолжить
    </button>`;
}

function templateCard(t, snap) {
  return `
    <div onclick="selectTemplate(${t.id})" id="tpl-${t.id}"
      class="${snap ? 'snap-center flex-shrink-0 w-64' : ''} cursor-pointer rounded-[20px] border-2 border-[#E8E4DE] bg-white p-5 transition-all duration-200 active:scale-[0.97] template-card"
      style="box-shadow: 0 1px 3px rgba(0,0,0,0.06)">
      ${templateThumb(t.category, t.name)}
      <div class="flex items-start justify-between gap-2 mt-4 mb-1">
        <p class="font-semibold text-[#1E2820] text-[15px]">${t.name}</p>
        <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-[#C2E0C6] text-[#1A3D20] font-semibold flex-shrink-0">
          ${categoryLabel[t.category] || t.category}
        </span>
      </div>
      ${t.description ? `<p class="text-xs text-[#6B6860] leading-relaxed">${t.description}</p>` : ''}
    </div>`;
}

window.selectTemplate = function (id) {
  selectedTemplate = window._templates.find(t => t.id === id);
  document.querySelectorAll('.template-card').forEach(el => {
    el.classList.remove('border-[#3D6B45]');
    el.classList.add('border-[#E8E4DE]');
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
  });
  const card = document.getElementById('tpl-' + id);
  if (card) {
    card.classList.replace('border-[#E8E4DE]', 'border-[#3D6B45]');
    card.style.boxShadow = '0 4px 16px rgba(61,107,69,0.15)';
  }
  document.getElementById('btn-next').disabled = false;
};

window.goToStep2 = function () {
  document.getElementById('step1').classList.add('hidden');
  document.getElementById('step2').classList.remove('hidden');
  renderForm();
  const prevBtn = document.getElementById('preview-btn');
  if (prevBtn && existingEvent?.slug) prevBtn.classList.remove('hidden');
};

// ─── Step 2 — Form with block toggles ────────────────────────────────────────
function renderForm() {
  const schema = selectedTemplate ? JSON.parse(selectedTemplate.blocksSchema || '[]') : [];
  let blocksConfig = {};
  try { blocksConfig = JSON.parse(existingEvent?.blocksConfig || '{}'); } catch (_) {}

  const v     = (f) => existingEvent?.[f] || '';
  const dv    = (iso) => iso ? iso.substring(0, 16) : '';

  document.getElementById('step2').innerHTML = `
    <!-- Back + title -->
    <div class="flex items-center gap-3 mb-6">
      ${!editEventId
        ? `<button onclick="backToStep1()" class="w-10 h-10 rounded-full bg-[#EDE9E4] flex items-center justify-center text-[#5C5850] active:scale-90 transition-transform flex-shrink-0">
             <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
           </button>`
        : ''}
      <div>
        <h2 class="font-cormorant text-[28px] font-semibold italic text-[#1E2820] leading-tight">
          ${editEventId ? 'Редактировать' : 'Основная информация'}
        </h2>
        ${selectedTemplate ? `<p class="text-[#6B6860] text-sm mt-0.5">${selectedTemplate.name}</p>` : ''}
      </div>
    </div>

    <form id="event-form" onsubmit="handleSubmit(event)" class="space-y-4">

      <!-- ── Основная карточка ── -->
      <div class="bg-white rounded-[20px] p-5 space-y-4" style="box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 6px rgba(0,0,0,0.04)">
        <p class="text-[11px] uppercase tracking-widest text-[#6B6860] font-semibold">Основное</p>

        ${basicField('title', 'Название события *', 'text', v('title'), 'Свадьба Айны и Марата', true)}

        <div class="grid grid-cols-2 gap-3">
          ${basicField('person1', 'Имя 1', 'text', v('person1'), 'Айна')}
          ${basicField('person2', 'Имя 2', 'text', v('person2'), 'Марат')}
        </div>

        ${basicField('eventDate', 'Дата события', 'datetime-local', dv(v('eventDate')))}
        ${basicField('location', 'Место', 'text', v('location'), 'Бишкек, ресторан Арашан')}

        <!-- Language -->
        <div>
          <label class="text-[10px] uppercase tracking-widest text-[#6B6860] mb-2 block font-semibold">Язык</label>
          <div class="flex gap-2">
            ${[['ru','Русский'],['ky','Кыргызча'],['en','English']].map(([val, lbl]) => `
              <button type="button" onclick="setLang('${val}')" id="lang-${val}"
                class="lang-btn flex-1 py-2.5 rounded-2xl border-2 text-xs font-semibold transition-all active:scale-95
                  ${(v('language') || 'ru') === val ? 'border-[#3D6B45] bg-[#3D6B45] text-white' : 'border-[#E8E4DE] text-[#6B6860] bg-[#EDE9E4]'}">
                ${lbl}
              </button>`).join('')}
          </div>
          <input type="hidden" id="lang-val" name="language" value="${v('language') || 'ru'}"/>
        </div>
      </div>

      <!-- ── Обложка ── -->
      <div class="bg-white rounded-[20px] p-5" style="box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 6px rgba(0,0,0,0.04)">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-xl bg-[#C2E0C6] flex items-center justify-center">
            <svg class="w-4 h-4 text-[#3D6B45]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <p class="text-[11px] uppercase tracking-widest text-[#6B6860] font-semibold">Обложка события</p>
        </div>
        ${photoWidget('coverImageUrl', v('coverImageUrl'))}
      </div>

      <!-- ── Дополнительно (RSVP deadline) ── -->
      <div class="bg-white rounded-[20px] p-5" style="box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 6px rgba(0,0,0,0.04)">
        <p class="text-[11px] uppercase tracking-widest text-[#6B6860] font-semibold mb-4">Дополнительно</p>
        ${basicField('rsvpDeadline', 'Принимать ответы до', 'datetime-local', dv(v('rsvpDeadline')))}
      </div>

      <!-- ── Блоки шаблона ── -->
      ${schema.map(block => blockSection(block, blocksConfig)).join('')}

      <!-- ── Статус (только редактирование) ── -->
      ${editEventId ? `
        <div class="bg-white rounded-[20px] p-5" style="box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 6px rgba(0,0,0,0.04)">
          <p class="text-[11px] uppercase tracking-widest text-[#6B6860] font-semibold mb-4">Статус события</p>
          <div class="flex gap-2">
            ${[['DRAFT','Черновик'],['PUBLISHED','Опубликовано'],['CLOSED','Закрыто']].map(([s,l]) => `
              <button type="button" onclick="setStatus('${s}')" id="status-${s}"
                class="status-btn flex-1 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-[0.97]
                  ${(existingEvent?.status || 'DRAFT') === s ? 'border-[#3D6B45] bg-[#3D6B45] text-white' : 'border-[#E8E4DE] text-[#6B6860] bg-[#EDE9E4]'}">
                ${l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="status-val" name="status" value="${existingEvent?.status || 'DRAFT'}"/>
        </div>` : ''}

      <button type="submit"
        class="w-full py-4 bg-[#3D6B45] text-white rounded-2xl font-semibold text-[15px] active:scale-[0.97] transition-all"
        style="box-shadow: 0 2px 8px rgba(61,107,69,0.28)">
        ${editEventId ? 'Сохранить изменения' : 'Создать приглашение'}
      </button>
    </form>`;
}

// ─── Block section with toggle ────────────────────────────────────────────────
function blockSection(block, blocksConfig) {
  const blockData = blocksConfig[block.type] || {};
  // Block is enabled if it has any non-empty field OR it's a new event (no existing config)
  const hasData = Object.values(blockData).some(v => v && String(v).trim());
  const isEnabled = !existingEvent ? true : hasData;
  const icon = blockIcons[block.type] || blockIcons.hero;
  const id = 'block-' + block.type;

  return `
    <div class="bg-white rounded-[20px] overflow-hidden" id="section-${block.type}"
         style="box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 6px rgba(0,0,0,0.04)">
      <div class="flex items-center gap-3 px-5 py-4 cursor-pointer" onclick="toggleBlock('${block.type}')">
        <div class="w-10 h-10 rounded-2xl bg-[#C2E0C6] flex items-center justify-center text-[#3D6B45] flex-shrink-0">
          ${icon}
        </div>
        <div class="flex-1">
          <p class="font-semibold text-[#1E2820] text-[15px]">${block.label || block.type}</p>
          <p class="text-xs text-[#6B6860] block-subtitle-${block.type}">${isEnabled ? 'Включено' : 'Отключено'}</p>
        </div>
        <div class="relative w-12 h-7 flex-shrink-0" onclick="event.stopPropagation(); toggleBlock('${block.type}')">
          <input type="checkbox" id="toggle-${block.type}" ${isEnabled ? 'checked' : ''}
            class="sr-only peer" onchange="onToggleChange('${block.type}')"/>
          <div class="w-12 h-7 bg-[#E8E4DE] peer-checked:bg-[#3D6B45] rounded-full transition-colors duration-200"></div>
          <div class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-5"></div>
        </div>
      </div>

      <div id="${id}" class="${isEnabled ? '' : 'hidden'} px-5 pb-5 space-y-4 border-t border-[#E8E4DE]/60 pt-4">
        ${block.fields.map(f => blockField(block.type, f, blockData[f] || '')).join('')}
      </div>
    </div>`;
}

window.toggleBlock = function (blockType) {
  const checkbox = document.getElementById('toggle-' + blockType);
  if (checkbox) { checkbox.checked = !checkbox.checked; onToggleChange(blockType); }
};

window.onToggleChange = function (blockType) {
  const checkbox = document.getElementById('toggle-' + blockType);
  const fields   = document.getElementById('block-' + blockType);
  const subtitle = document.querySelector('.block-subtitle-' + blockType);
  const enabled  = checkbox.checked;

  if (fields) fields.classList.toggle('hidden', !enabled);
  if (subtitle) subtitle.textContent = enabled ? 'Включено' : 'Отключено';
};

// ─── Basic (non-block) field ──────────────────────────────────────────────────
function basicField(name, label, type, value = '', placeholder = '', required = false) {
  return `
    <div>
      <label class="text-[10px] uppercase tracking-widest text-[#6B6860] mb-2 block font-semibold letter-spacing-wider">${label}</label>
      <input type="${type}" name="${name}" value="${value}" placeholder="${placeholder || label}" ${required ? 'required' : ''}
        class="w-full bg-[#EDE9E4] border-b-2 border-[#B0AB9E] rounded-t-2xl px-4 py-3.5 text-[#1E2820] outline-none focus:border-[#3D6B45] focus:bg-[#E8E4DC] transition-all text-[15px] font-medium"/>
    </div>`;
}

// ─── Block field router ───────────────────────────────────────────────────────
function blockField(blockType, fieldName, value) {
  const label       = fieldLabels[fieldName] || fieldName;
  const placeholder = fieldPlaceholders[fieldName] || '';
  const name        = `block__${blockType}__${fieldName}`;

  if (fieldName === 'palette') return paletteField(name, label, value);
  if (fieldName === 'date') return datetimeField(name, label, value);
  if (['text', 'subtitle', 'items'].includes(fieldName)) return textareaField(name, label, value, placeholder, fieldName);
  if (['photo1','carousel1','carousel2','carousel3','photoBottom','image_url'].includes(fieldName))
    return photoWidget(name, value, label);

  return `
    <div>
      <label class="text-[10px] uppercase tracking-widest text-[#6B6860] mb-2 block font-semibold">${label}</label>
      <input type="text" name="${name}" value="${value}" placeholder="${placeholder}"
        class="w-full bg-[#EDE9E4] border-b-2 border-[#B0AB9E] rounded-t-2xl px-4 py-3.5 text-[#1E2820] text-[15px] outline-none focus:border-[#3D6B45] focus:bg-[#E8E4DC] transition-all font-medium"/>
    </div>`;
}

function datetimeField(name, label, value) {
  return `
    <div>
      <label class="text-[10px] uppercase tracking-widest text-[#6B6860] mb-2 block font-semibold">${label}</label>
      <input type="datetime-local" name="${name}" value="${value ? value.substring(0,16) : ''}"
        class="w-full bg-[#EDE9E4] border-b-2 border-[#B0AB9E] rounded-t-2xl px-4 py-3.5 text-[#1E2820] text-[15px] outline-none focus:border-[#3D6B45] focus:bg-[#E8E4DC] transition-all"/>
    </div>`;
}

function textareaField(name, label, value, placeholder, fieldName) {
  const hint = fieldName === 'items'
    ? `<p class="text-[10px] text-[#6B6860]/60 mb-2">Каждое с новой строки: <span class="font-mono bg-[#EDE9E4] px-1 rounded">18:00 — Сбор гостей</span></p>`
    : '';
  return `
    <div>
      <label class="text-[10px] uppercase tracking-widest text-[#6B6860] mb-2 block font-semibold">${label}</label>
      ${hint}
      <textarea name="${name}" rows="4" placeholder="${placeholder}"
        class="w-full bg-[#EDE9E4] border-b-2 border-[#B0AB9E] rounded-t-2xl px-4 py-3.5 text-[#1E2820] text-[15px] outline-none focus:border-[#3D6B45] focus:bg-[#E8E4DC] transition-all resize-none ${fieldName === 'items' ? 'font-mono' : ''}">${value}</textarea>
    </div>`;
}

// ─── Photo widget: visual upload square + URL fallback ───────────────────────
function photoWidget(name, currentUrl, label) {
  const uid     = 'photo-' + name.replace(/[^a-z0-9]/gi, '_');
  const hasImg  = !!currentUrl;
  return `
    <div>
      ${label ? `<label class="text-[10px] uppercase tracking-widest text-[#1E2820]/40 mb-2 block">${label}</label>` : ''}
      <!-- Upload area -->
      <div id="${uid}-area"
        onclick="triggerPhotoInput('${uid}')"
        class="relative w-full aspect-video rounded-2xl border-2 border-dashed border-[#E8E4DE] bg-[#EDE9E4] overflow-hidden cursor-pointer hover:border-[#3D6B45] hover:bg-[#E8E4DC] transition-colors group">

        <img id="${uid}-preview"
          src="${currentUrl || ''}"
          class="absolute inset-0 w-full h-full object-cover ${hasImg ? '' : 'hidden'}"
          alt="preview"/>

        <div id="${uid}-placeholder"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 ${hasImg ? 'hidden' : ''}">
          <div class="w-12 h-12 rounded-2xl bg-[#C2E0C6] flex items-center justify-center group-hover:bg-[#B0D4B6] transition-colors">
            <svg class="w-6 h-6 text-[#3D6B45]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <div class="text-center">
            <p class="text-sm font-medium text-[#1E2820]/50">Нажмите, чтобы выбрать фото</p>
            <p class="text-xs text-[#1E2820]/30 mt-0.5">JPG, PNG, WEBP</p>
          </div>
        </div>

        <!-- Change overlay (on hover when image exists) -->
        <div id="${uid}-overlay"
          class="absolute inset-0 bg-black/30 ${hasImg ? 'opacity-0 hover:opacity-100' : 'hidden'} transition-opacity flex items-center justify-center">
          <p class="text-white text-xs font-medium">Заменить фото</p>
        </div>

        <!-- Upload progress -->
        <div id="${uid}-progress"
          class="absolute inset-0 bg-black/50 hidden flex-col items-center justify-center gap-2">
          <div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p class="text-white text-xs">Загрузка...</p>
        </div>
      </div>

      <!-- Hidden file input -->
      <input type="file" id="${uid}-file" accept="image/*" class="hidden"
        onchange="handlePhotoSelected('${uid}', '${name}')"/>

      <!-- URL input (shown as "paste link" fallback) -->
      <div id="${uid}-url-row" class="mt-2">
        <button type="button" onclick="toggleUrlInput('${uid}')"
          class="text-[10px] text-[#1E2820]/30 hover:text-[#6B8F71] transition-colors flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          Вставить ссылку вручную
        </button>
        <div id="${uid}-url-input" class="${hasImg ? '' : 'hidden'} mt-2">
          <input type="url" name="${name}" id="${uid}-url-val" value="${currentUrl || ''}"
            placeholder="https://i.ibb.co/..."
            oninput="onUrlInput('${uid}')"
            class="w-full bg-[#FAFAF8] border border-[#E5E0D8] rounded-xl px-3 py-2 text-[#1E2820] text-xs outline-none focus:border-[#6B8F71] transition-colors"/>
        </div>
      </div>
    </div>`;
}

window.triggerPhotoInput = function (uid) {
  document.getElementById(uid + '-file')?.click();
};

window.toggleUrlInput = function (uid) {
  const row = document.getElementById(uid + '-url-input');
  if (row) row.classList.toggle('hidden');
};

window.onUrlInput = function (uid) {
  const urlVal = document.getElementById(uid + '-url-val')?.value || '';
  const preview = document.getElementById(uid + '-preview');
  const placeholder = document.getElementById(uid + '-placeholder');
  const overlay = document.getElementById(uid + '-overlay');
  if (urlVal) {
    if (preview) { preview.src = urlVal; preview.classList.remove('hidden'); }
    if (placeholder) placeholder.classList.add('hidden');
    if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('opacity-0'); }
  } else {
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    if (placeholder) placeholder.classList.remove('hidden');
    if (overlay) overlay.classList.add('hidden');
  }
};

window.handlePhotoSelected = async function (uid, name) {
  const fileInput = document.getElementById(uid + '-file');
  const file = fileInput?.files?.[0];
  if (!file) return;

  const preview     = document.getElementById(uid + '-preview');
  const placeholder = document.getElementById(uid + '-placeholder');
  const overlay     = document.getElementById(uid + '-overlay');
  const progress    = document.getElementById(uid + '-progress');
  const urlInput    = document.getElementById(uid + '-url-val');

  // Show local preview immediately
  const localUrl = URL.createObjectURL(file);
  if (preview)  { preview.src = localUrl; preview.classList.remove('hidden'); }
  if (placeholder) placeholder.classList.add('hidden');
  if (overlay)  { overlay.classList.remove('hidden'); overlay.classList.add('opacity-0'); }

  if (IMGBB_KEY) {
    // Attempt upload
    if (progress) progress.classList.remove('hidden');
    try {
      const remoteUrl = await uploadToImgbb(file);
      if (urlInput) urlInput.value = remoteUrl;
      if (preview)  preview.src = remoteUrl;
      // Also ensure the hidden/visible url field is correct
      ensurePhotoUrlField(uid, name, remoteUrl);
    } catch {
      showToast('Авто-загрузка не удалась. Вставьте ссылку вручную.');
      ensurePhotoUrlField(uid, name, '');
      // Show URL input so user can paste
      const urlRow = document.getElementById(uid + '-url-input');
      if (urlRow) urlRow.classList.remove('hidden');
    } finally {
      if (progress) progress.classList.add('hidden');
    }
  } else {
    // No key — show URL input as reminder
    const urlRow = document.getElementById(uid + '-url-input');
    if (urlRow) urlRow.classList.remove('hidden');
    showToast('Загрузите фото на imgbb.com и вставьте ссылку');
    ensurePhotoUrlField(uid, name, '');
  }
};

// Ensures the hidden url input carries the correct `name` attribute
function ensurePhotoUrlField(uid, name, value) {
  let urlInput = document.getElementById(uid + '-url-val');
  if (!urlInput) {
    urlInput = document.createElement('input');
    urlInput.type = 'hidden';
    urlInput.id   = uid + '-url-val';
    urlInput.name = name;
    document.getElementById(uid + '-url-row')?.appendChild(urlInput);
  }
  urlInput.name  = name;
  urlInput.value = value;
}

// ─── Palette: 5 color-swatch pickers ─────────────────────────────────────────
function paletteField(name, label, value) {
  const parts = value
    ? value.split(',').map(c => c.trim())
    : [...DEFAULT_PALETTE];
  while (parts.length < 5) parts.push(DEFAULT_PALETTE[parts.length] || '#CCCCCC');
  const safe = name.replace(/[^a-z0-9]/gi, '_');

  const swatches = parts.slice(0, 5).map((color, i) => `
    <div class="flex flex-col items-center gap-1">
      <label class="w-10 h-10 rounded-xl border-2 border-[#E5E0D8] cursor-pointer overflow-hidden hover:scale-105 transition-transform block"
        style="background:${color}">
        <input type="color" class="opacity-0 w-full h-full cursor-pointer"
          data-idx="${i}" value="${color}" oninput="updatePalette('${safe}')"/>
      </label>
      <span class="text-[8px] text-[#1E2820]/30 font-mono">${color}</span>
    </div>`).join('');

  return `
    <div>
      <label class="text-[10px] uppercase tracking-widest text-[#1E2820]/40 mb-3 block">${label}</label>
      <div class="flex gap-3 items-end" id="pal-${safe}">${swatches}</div>
      <input type="hidden" name="${name}" id="pal-hidden-${safe}" value="${parts.slice(0,5).join(',')}"/>
      <p class="text-[10px] text-[#1E2820]/30 mt-2">Нажмите на цвет, чтобы изменить</p>
    </div>`;
}

window.updatePalette = function (safe) {
  const container = document.getElementById('pal-' + safe);
  const hidden    = document.getElementById('pal-hidden-' + safe);
  if (!container || !hidden) return;
  const pickers = container.querySelectorAll('input[type="color"]');
  const colors  = Array.from(pickers).map(p => p.value);
  hidden.value  = colors.join(',');
  pickers.forEach((p, i) => {
    const lbl  = p.closest('label');
    const span = lbl?.nextElementSibling;
    if (lbl)  lbl.style.background = p.value;
    if (span) span.textContent = p.value;
  });
};

// ─── Lang / Status buttons ────────────────────────────────────────────────────
window.setLang = function (lang) {
  document.getElementById('lang-val').value = lang;
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.remove('border-[#3D6B45]', 'bg-[#3D6B45]', 'text-white');
    b.classList.add('border-[#E8E4DE]', 'text-[#6B6860]', 'bg-[#EDE9E4]');
  });
  const active = document.getElementById('lang-' + lang);
  if (active) {
    active.classList.remove('border-[#E8E4DE]', 'text-[#6B6860]', 'bg-[#EDE9E4]');
    active.classList.add('border-[#3D6B45]', 'bg-[#3D6B45]', 'text-white');
  }
};

window.setStatus = function (status) {
  document.getElementById('status-val').value = status;
  document.querySelectorAll('.status-btn').forEach(b => {
    b.classList.remove('border-[#3D6B45]', 'bg-[#3D6B45]', 'text-white');
    b.classList.add('border-[#E8E4DE]', 'text-[#6B6860]', 'bg-[#EDE9E4]');
  });
  const active = document.getElementById('status-' + status);
  if (active) {
    active.classList.remove('border-[#E8E4DE]', 'text-[#6B6860]', 'bg-[#EDE9E4]');
    active.classList.add('border-[#3D6B45]', 'bg-[#3D6B45]', 'text-white');
  }
};

window.backToStep1 = function () {
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('step1').classList.remove('hidden');
};

// ─── Submit ───────────────────────────────────────────────────────────────────
window.handleSubmit = async function (e) {
  e.preventDefault();
  const phone = localStorage.getItem('tl_phone');
  if (!phone) return;

  const fd = new FormData(e.target);

  // Collect block data (only from enabled blocks)
  const blocksConfig = {};
  const schema = selectedTemplate ? JSON.parse(selectedTemplate.blocksSchema || '[]') : [];
  for (const block of schema) {
    const checkbox = document.getElementById('toggle-' + block.type);
    if (!checkbox?.checked) continue;  // skip disabled blocks
    blocksConfig[block.type] = {};
    for (const f of block.fields) {
      const val = fd.get(`block__${block.type}__${f}`);
      if (val !== null) blocksConfig[block.type][f] = val;
    }
  }

  const data = {
    title:         fd.get('title'),
    person1:       fd.get('person1') || null,
    person2:       fd.get('person2') || null,
    eventDate:     fd.get('eventDate') || null,
    rsvpDeadline:  fd.get('rsvpDeadline') || null,
    location:      fd.get('location') || null,
    coverImageUrl: fd.get('coverImageUrl') || null,
    language:      fd.get('language') || 'ru',
    blocksConfig:  Object.keys(blocksConfig).length ? JSON.stringify(blocksConfig) : null,
    ...(selectedTemplate && !editEventId ? { templateId: selectedTemplate.id } : {}),
    ...(editEventId ? { status: fd.get('status') } : {}),
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Сохранение...';

  try {
    await saveEvent(phone, data, editEventId);
    location.href = '/';
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
    btn.textContent = editEventId ? 'Сохранить изменения' : 'Создать приглашение';
  }
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(location.search);
  editEventId  = params.get('id') ? parseInt(params.get('id')) : null;

  const phone = await window.initAuth();
  if (!phone) { location.href = '/'; return; }

  try {
    const templates = await fetchTemplates();
    window._templates = templates;

    if (editEventId) {
      existingEvent    = await fetchEvent(editEventId, phone);
      selectedTemplate = templates.find(t => t.id === existingEvent.templateId) || null;
      document.getElementById('step1').classList.add('hidden');
      document.getElementById('step2').classList.remove('hidden');
      renderForm();
      // Show preview button
      const prevBtn = document.getElementById('preview-btn');
      if (prevBtn && existingEvent.slug) {
        prevBtn.classList.remove('hidden');
        prevBtn.onclick = () => window.open(`/e/${existingEvent.slug}`, '_blank', 'noopener');
      }
    } else {
      renderTemplatePicker(templates);
    }
  } catch (err) {
    showToast(err.message);
  }
}

init();
