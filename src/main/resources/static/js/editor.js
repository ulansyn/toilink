// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = '';

// ─── State ────────────────────────────────────────────────────────────────────
let selectedTemplate = null;
let editEventId = null;
let existingEvent = null;

// ─── Auth stub ────────────────────────────────────────────────────────────────
function getPhone() { return localStorage.getItem('tl_phone'); }
function requirePhone() {
  let p = getPhone();
  if (!p) {
    p = prompt('Введите ваш номер телефона:\n(например: +996700000000)');
    if (p) localStorage.setItem('tl_phone', p.trim());
  }
  return p?.trim() || null;
}

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
  const url  = id ? `${BASE_URL}/api/organizer/events/${id}` : `${BASE_URL}/api/organizer/events`;
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

// ─── Field labels ─────────────────────────────────────────────────────────────
const fieldLabels = {
  title:     'Заголовок',
  subtitle:  'Подзаголовок',
  image_url: 'URL обложки',
  date:      'Дата',
  address:   'Адрес',
  map_url:   'Ссылка на карту (2GIS, Google Maps)',
  text:      'Текст',
};

function fieldPlaceholder(field) {
  const ph = {
    title:     'Свадьба Айны и Марата',
    subtitle:  'Приглашаем вас разделить этот особенный день',
    image_url: 'https://...',
    date:      '',
    address:   'Бишкек, ресторан Арашан',
    map_url:   'https://2gis.kg/...',
    text:      'Введите текст...',
  };
  return ph[field] || '';
}

function isDateField(field) { return field === 'date'; }
function isTextareaField(field) { return field === 'text' || field === 'subtitle'; }

// ─── Step 1 — Template picker ─────────────────────────────────────────────────
function renderTemplatePicker(templates) {
  const categoryLabel = { WEDDING: 'Свадьба', BIRTHDAY: 'День рождения', TOY: 'Той', OTHER: 'Другое' };

  document.getElementById('step1').innerHTML = `
    <div class="mb-8">
      <h2 class="font-cormorant text-3xl font-semibold text-[#1E2820] mb-1">Выберите шаблон</h2>
      <p class="text-[#1E2820]/40 text-sm">Шаблон определяет блоки вашего приглашения</p>
    </div>

    <!-- Mobile: horizontal scroll carousel -->
    <div class="md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4">
      ${templates.map(t => renderTemplateCard(t, categoryLabel, true)).join('')}
    </div>

    <!-- Desktop: grid -->
    <div class="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${templates.map(t => renderTemplateCard(t, categoryLabel, false)).join('')}
    </div>

    <button id="btn-next-step"
      onclick="goToStep2()"
      disabled
      class="mt-8 w-full py-4 bg-[#1E2820] text-white rounded-2xl font-medium text-base transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] hover:bg-[#2d3d2e]">
      Продолжить →
    </button>`;
}

function renderTemplateCard(t, categoryLabel, snap) {
  const schema = JSON.parse(t.blocksSchema || '[]');
  const blockNames = schema.map(b => b.label || b.type).join(', ');
  return `
    <div onclick="selectTemplate(${t.id})" id="tpl-${t.id}"
      class="${snap ? 'snap-center flex-shrink-0 w-64' : ''} cursor-pointer rounded-3xl border-2 border-[#E5E0D8] bg-white p-5 transition-all duration-200 active:scale-[0.98] hover:border-[#6B8F71] hover:shadow-sm template-card">
      <!-- Icon/thumbnail -->
      <div class="h-28 rounded-2xl bg-gradient-to-br from-[#8B7355] via-[#6B8F71] to-[#4A5C4D] flex items-center justify-center mb-4">
        <span class="font-cormorant text-white/70 italic text-2xl">${t.name}</span>
      </div>
      <div class="flex items-start justify-between gap-2 mb-2">
        <p class="font-medium text-[#1E2820]">${t.name}</p>
        <span class="text-xs px-2 py-0.5 rounded-full bg-[#6B8F71]/10 text-[#6B8F71] flex-shrink-0">${categoryLabel[t.category] || t.category}</span>
      </div>
      ${t.description ? `<p class="text-xs text-[#1E2820]/40 mb-3 leading-relaxed">${t.description}</p>` : ''}
      <p class="text-[10px] text-[#1E2820]/30 uppercase tracking-wider">Блоки: ${blockNames || '—'}</p>
    </div>`;
}

window.selectTemplate = function(id) {
  selectedTemplate = window._templates.find(t => t.id === id);
  document.querySelectorAll('.template-card').forEach(el => {
    el.classList.remove('border-[#6B8F71]', 'shadow-md');
    el.classList.add('border-[#E5E0D8]');
  });
  const card = document.getElementById('tpl-' + id);
  if (card) {
    card.classList.remove('border-[#E5E0D8]');
    card.classList.add('border-[#6B8F71]', 'shadow-md');
  }
  document.getElementById('btn-next-step').disabled = false;
};

window.goToStep2 = function() {
  document.getElementById('step1').classList.add('hidden');
  document.getElementById('step2').classList.remove('hidden');
  renderForm();
};

// ─── Step 2 — Form ────────────────────────────────────────────────────────────
function renderForm() {
  const schema = selectedTemplate ? JSON.parse(selectedTemplate.blocksSchema || '[]') : [];
  const existing = existingEvent;
  let blocksConfig = {};
  try { blocksConfig = JSON.parse(existing?.blocksConfig || '{}'); } catch (_) {}

  const val = (field) => existing?.[field] || '';
  const dateVal = (iso) => iso ? iso.substring(0, 16) : '';

  document.getElementById('step2').innerHTML = `
    <div class="mb-6 flex items-center gap-3">
      ${!editEventId ? `<button onclick="backToStep1()" class="w-9 h-9 rounded-xl border border-[#E5E0D8] flex items-center justify-center text-[#1E2820]/40 active:scale-95 transition-transform">←</button>` : ''}
      <div>
        <h2 class="font-cormorant text-3xl font-semibold text-[#1E2820]">${editEventId ? 'Редактировать' : 'Детали события'}</h2>
        ${selectedTemplate ? `<p class="text-[#1E2820]/40 text-sm">${selectedTemplate.name}</p>` : ''}
      </div>
    </div>

    <form id="event-form" onsubmit="handleSubmit(event)" class="space-y-5">

      <!-- Basic fields -->
      <div class="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <p class="text-xs uppercase tracking-widest text-[#1E2820]/40 pb-1">Основная информация</p>

        ${field('title', 'Название события', 'text', val('title'), 'Свадьба Улансына и Эльнуры', true)}

        <div class="grid grid-cols-2 gap-3">
          ${field('person1', 'Имя 1 (жених / именинник)', 'text', val('person1'), 'Улансын')}
          ${field('person2', 'Имя 2 (невеста)', 'text', val('person2'), 'Эльнура')}
        </div>

        ${field('eventDate', 'Дата и время события', 'datetime-local', dateVal(val('eventDate')))}
        ${field('rsvpDeadline', 'Принимать ответы до', 'datetime-local', dateVal(val('rsvpDeadline')))}
        ${field('location', 'Место проведения', 'text', val('location'), 'Бишкек, ресторан Арашан')}
        ${field('coverImageUrl', 'URL обложки', 'url', val('coverImageUrl'), 'https://...')}

        <div>
          <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-2 block">Язык приглашения</label>
          <select name="language" class="w-full bg-[#FAFAF8] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#1E2820] outline-none focus:border-[#6B8F71] transition-colors">
            <option value="ru" ${val('language') !== 'ky' && val('language') !== 'en' ? 'selected' : ''}>Русский</option>
            <option value="ky" ${val('language') === 'ky' ? 'selected' : ''}>Кыргызча</option>
            <option value="en" ${val('language') === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
      </div>

      <!-- Dynamic blocks from schema -->
      ${schema.length > 0 ? `
        ${schema.map(block => `
          <div class="bg-white rounded-3xl p-5 space-y-4 shadow-sm">
            <p class="text-xs uppercase tracking-widest text-[#1E2820]/40 pb-1">${block.label || block.type}</p>
            ${block.fields.map(f => {
              const val = blocksConfig[block.type]?.[f] || '';
              return blockField(block.type, f, val);
            }).join('')}
          </div>`).join('')}` : ''}

      <!-- Status (edit only) -->
      ${editEventId ? `
        <div class="bg-white rounded-3xl p-5 shadow-sm">
          <p class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-3">Статус</p>
          <div class="flex gap-2">
            ${[['DRAFT','Черновик'],['PUBLISHED','Опубликовать'],['CLOSED','Закрыть']].map(([s, l]) => `
              <button type="button" onclick="setStatus('${s}')" id="status-${s}"
                class="status-btn flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-150 active:scale-[0.97]
                  ${(existing?.status || 'DRAFT') === s ? 'border-[#1E2820] bg-[#1E2820] text-white' : 'border-[#E5E0D8] text-[#1E2820]/50'}">
                ${l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="status-val" name="status" value="${existing?.status || 'DRAFT'}"/>
        </div>` : ''}

      <button type="submit"
        class="w-full py-4 bg-[#1E2820] text-white rounded-2xl font-medium text-base active:scale-[0.98] transition-all duration-200 hover:bg-[#2d3d2e]">
        ${editEventId ? 'Сохранить изменения' : 'Создать приглашение'}
      </button>
    </form>`;
}

function field(name, label, type, value = '', placeholder = '', required = false) {
  return `
    <div>
      <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-2 block">${label}${required ? ' *' : ''}</label>
      <input type="${type}" name="${name}" value="${value}" placeholder="${placeholder}" ${required ? 'required' : ''}
        class="w-full bg-[#FAFAF8] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#1E2820] outline-none focus:border-[#6B8F71] transition-colors"/>
    </div>`;
}

function blockField(blockType, fieldName, value) {
  const label = fieldLabels[fieldName] || fieldName;
  const placeholder = fieldPlaceholder(fieldName);
  const name = `block__${blockType}__${fieldName}`;

  if (isDateField(fieldName)) {
    return `
      <div>
        <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-2 block">${label}</label>
        <input type="datetime-local" name="${name}" value="${value ? value.substring(0,16) : ''}"
          class="w-full bg-[#FAFAF8] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#1E2820] outline-none focus:border-[#6B8F71] transition-colors"/>
      </div>`;
  }
  if (isTextareaField(fieldName)) {
    return `
      <div>
        <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-2 block">${label}</label>
        <textarea name="${name}" rows="3" placeholder="${placeholder}"
          class="w-full bg-[#FAFAF8] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#1E2820] outline-none focus:border-[#6B8F71] transition-colors resize-none">${value}</textarea>
      </div>`;
  }
  return `
    <div>
      <label class="text-xs uppercase tracking-widest text-[#1E2820]/40 mb-2 block">${label}</label>
      <input type="text" name="${name}" value="${value}" placeholder="${placeholder}"
        class="w-full bg-[#FAFAF8] border border-[#E5E0D8] rounded-xl px-4 py-3 text-[#1E2820] outline-none focus:border-[#6B8F71] transition-colors"/>
    </div>`;
}

window.backToStep1 = function() {
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('step1').classList.remove('hidden');
};

window.setStatus = function(status) {
  document.getElementById('status-val').value = status;
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.remove('border-[#1E2820]', 'bg-[#1E2820]', 'text-white');
    btn.classList.add('border-[#E5E0D8]', 'text-[#1E2820]/50');
  });
  const active = document.getElementById('status-' + status);
  if (active) {
    active.classList.remove('border-[#E5E0D8]', 'text-[#1E2820]/50');
    active.classList.add('border-[#1E2820]', 'bg-[#1E2820]', 'text-white');
  }
};

// ─── Submit ───────────────────────────────────────────────────────────────────
window.handleSubmit = async function(e) {
  e.preventDefault();
  const phone = requirePhone();
  if (!phone) return;

  const form = e.target;
  const fd = new FormData(form);

  // Collect blocks_config from block__ prefixed fields
  const blocksConfig = {};
  for (const [key, val] of fd.entries()) {
    if (!key.startsWith('block__')) continue;
    const [, blockType, fieldName] = key.split('__');
    if (!blocksConfig[blockType]) blocksConfig[blockType] = {};
    blocksConfig[blockType][fieldName] = val;
  }

  const data = {
    title:        fd.get('title'),
    person1:      fd.get('person1') || null,
    person2:      fd.get('person2') || null,
    eventDate:    fd.get('eventDate') || null,
    rsvpDeadline: fd.get('rsvpDeadline') || null,
    location:     fd.get('location') || null,
    coverImageUrl: fd.get('coverImageUrl') || null,
    language:     fd.get('language') || 'ru',
    blocksConfig: Object.keys(blocksConfig).length ? JSON.stringify(blocksConfig) : null,
    ...(selectedTemplate && !editEventId ? { templateId: selectedTemplate.id } : {}),
    ...(editEventId ? { status: fd.get('status') } : {}),
  };

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  try {
    await saveEvent(phone, data, editEventId);
    location.href = '/';
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
    btn.textContent = editEventId ? 'Сохранить изменения' : 'Создать приглашение';
  }
};

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-[#1E2820] text-white text-sm px-5 py-3 rounded-2xl z-50 shadow-lg whitespace-nowrap';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(location.search);
  editEventId = params.get('id') ? parseInt(params.get('id')) : null;

  const phone = requirePhone();
  if (!phone) { location.href = '/'; return; }

  try {
    const templates = await fetchTemplates();
    window._templates = templates;

    if (editEventId) {
      // Edit mode: skip template picker, load event data
      existingEvent = await fetchEvent(editEventId, phone);
      selectedTemplate = templates.find(t => t.id === existingEvent.templateId) || null;
      document.getElementById('step1').classList.add('hidden');
      document.getElementById('step2').classList.remove('hidden');
      renderForm();
    } else {
      // Create mode: show template picker
      renderTemplatePicker(templates);
    }
  } catch (err) {
    showToast(err.message);
  }
}

init();
