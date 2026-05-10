'use strict';

// ── State ──────────────────────────────────────────────────────
const W = {
  step: 'picker',   // 'picker' | 0,1,2... | 'preview' | 'locked'
  phone: '',
  photoDataUrl: null,
  resendTimer: null,
  resendSec: 60,
  iframeReady: false,
  templateId: 'template-1',
  numericTemplateId: null,
  eventId: null,
  config: null,
};

// Picker sub-state
let _pType = 'SITE';
let _pCat  = 'ALL';

const CAT_LABELS = {
  WEDDING: 'Свадьба', TOI: 'Той',
  BIRTHDAY: 'День рождения', BABY: 'Бешик Той',
};

// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // If user came from the catalog page with a pre-selected template, skip picker
  const fromCatalog = sessionStorage.getItem('tl_from_catalog');
  sessionStorage.removeItem('tl_from_catalog');

  if (fromCatalog && localStorage.getItem('tl_template_selection')) {
    initWizard();
  } else {
    showPicker();
  }

  setupPhoneInput();
});

// ── Picker ─────────────────────────────────────────────────────

function showPicker() {
  document.getElementById('pickerScreen').style.display = 'flex';
  document.getElementById('formWizard').style.display   = 'none';
  document.getElementById('previewScreen').style.display = 'none';
  document.getElementById('lockedScreen').style.display  = 'none';
  W.step = 'picker';

  // Wire type tabs
  document.querySelectorAll('.picker-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _pType = btn.dataset.type;
      _pCat  = 'ALL';
      document.querySelectorAll('.picker-type-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.type === _pType));
      renderPickerCats();
      renderPickerGrid();
    });
  });

  renderPickerCats();
  renderPickerGrid();
}

function renderPickerCats() {
  const list = PICKER_TEMPLATES.filter(t => t.type === _pType);
  const counts = { ALL: list.length };
  list.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
  const cats = ['ALL', ...Object.keys(CAT_LABELS).filter(c => counts[c])];

  document.getElementById('pickerCats').innerHTML = cats.map(c => `
    <button class="picker-cat${c === _pCat ? ' active' : ''}" data-cat="${c}">
      ${c === 'ALL' ? 'Все' : CAT_LABELS[c]}
    </button>`).join('');

  document.querySelectorAll('.picker-cat').forEach(b => b.addEventListener('click', () => {
    _pCat = b.dataset.cat;
    document.querySelectorAll('.picker-cat').forEach(x => x.classList.toggle('active', x.dataset.cat === _pCat));
    renderPickerGrid();
  }));
}

function renderPickerGrid() {
  const list = PICKER_TEMPLATES
    .filter(t => t.type === _pType)
    .filter(t => _pCat === 'ALL' || t.category === _pCat);

  document.getElementById('pickerGrid').innerHTML = list.map(t => `
    <div class="p-card" style="background:${t.grad}"
         onclick="pickTemplate(${t.id},'${t.category}','${t.type}')">
      ${t.premium ? '<span class="p-pro">PRO</span>' : ''}
    </div>`).join('');
}

function pickTemplate(id, category, type) {
  try {
    W.numericTemplateId = id;
    W.templateId = 'template-' + id;
    localStorage.setItem('tl_selected_template', W.templateId);
    localStorage.setItem('tl_template_selection', JSON.stringify({
      templateId: W.templateId, category, type,
    }));
  } catch (_) {}

  // Brief active flash then proceed
  const cards = document.querySelectorAll('.p-card');
  cards.forEach(c => {
    if (c.onclick?.toString().includes(id + ',')) c.classList.add('selected');
  });

  setTimeout(() => initWizard(), 150);
}
window.pickTemplate = pickTemplate;

// ── Init wizard after template is chosen ──────────────────────

function initWizard() {
  W.templateId = localStorage.getItem('tl_selected_template') || 'template-1';
  W.config     = getWizardConfig();

  renderWizard();
  restoreDraft();
  W.step = 0;
  updateProgress();
  updateHeader();
  prefetchIframe();

  document.getElementById('pickerScreen').style.display  = 'none';
  document.getElementById('formWizard').style.display    = 'flex';
}

// ── Render wizard from config ──────────────────────────────────

function renderWizard() {
  const n    = W.config.steps.length;
  const barW = n <= 3 ? 6 : n <= 4 ? 5 : 4;

  document.getElementById('progressRow').innerHTML = W.config.steps
    .map((_, i) => `<div class="progress-step future" id="prog${i}" style="width:${barW}rem"></div>`)
    .join('');

  document.getElementById('slidesViewport').innerHTML = W.config.steps
    .map((step, i) => renderSlide(step, i))
    .join('');
}

function renderSlide(step, idx) {
  const anim     = idx === 0;
  const isToggles = step.fields.every(f => f.type === 'toggle');
  return `
    <div class="slide ${idx === 0 ? 'state-current' : 'state-right'}" id="slide${idx}">
      <p class="step-eyebrow${anim ? ' fade-up' : ''}">${step.eyebrow || ''}</p>
      <h1 class="step-title${anim ? ' fade-up delay-1' : ''}">${step.title.replace(/\n/g, '<br/>')}</h1>
      ${step.hint ? `<p class="step-hint${anim ? ' fade-up delay-2' : ''}">${step.hint}</p>` : ''}
      <div class="${isToggles ? 'toggle-group' : 'field-group'}${anim ? ' fade-up delay-3' : ''}">
        ${step.fields.map(renderField).join('')}
      </div>
      ${step.skippable ? `<button class="skip-photo" onclick="wizardNext()">Пропустить →</button>` : ''}
    </div>`;
}

function renderField(field) {
  switch (field.type) {
    case 'text':
    case 'date':
    case 'time': {
      const attrs = [
        `id="${field.id}"`,
        `type="${field.type}"`,
        `placeholder=" "`,
        field.autocomplete ? `autocomplete="${field.autocomplete}"` : '',
        field.maxlength    ? `maxlength="${field.maxlength}"`       : '',
      ].filter(Boolean).join(' ');
      return `
        <div class="field">
          <input class="field-input" ${attrs} oninput="saveDraft()"/>
          <label class="field-label" for="${field.id}">${field.label}</label>
        </div>`;
    }

    case 'textarea':
      return `
        <div class="field">
          <textarea class="field-textarea" id="${field.id}"
            placeholder="${(field.placeholder || field.label || '').replace(/"/g, '&quot;')}"
            ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}
            rows="5"
            oninput="saveDraft()"></textarea>
        </div>`;

    case 'photo':
      return `
        <img class="photo-preview-img" id="photoPreviewImg" src="" alt="" style="display:none"/>
        <label class="photo-drop" id="photoDrop">
          <input type="file" accept="image/*" id="photoInput" onchange="onPhotoSelected(this)"/>
          <div id="photoDropInner">
            <div class="photo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                   stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
            <p>Нажмите или перетащите фото</p>
            <small>JPG, PNG, WEBP — до 10 МБ</small>
          </div>
        </label>`;

    case 'toggle':
      return `
        <div class="toggle-item">
          <div class="toggle-info">
            <span class="toggle-label">${field.label}${field.premium ? ' <span class="badge-pro">PRO</span>' : ''}</span>
            ${field.hint ? `<span class="toggle-hint">${field.hint}</span>` : ''}
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="${field.id}" ${field.default ? 'checked' : ''} onchange="saveDraft()"/>
            <span class="toggle-thumb"></span>
          </label>
        </div>`;

    case 'style-picker':
      return `
        <div class="style-grid">
          ${field.options.map((opt, i) => `
            <button class="style-card${i === 0 ? ' active' : ''}" type="button"
              data-value="${opt.value}" onclick="selectStyle('${field.id}', this)">
              <span class="style-emoji">${opt.emoji}</span>
              <span class="style-name">${opt.label}</span>
              <span class="style-desc">${opt.desc}</span>
            </button>`).join('')}
        </div>
        <input type="hidden" id="${field.id}" value="${field.options[0]?.value || ''}"/>`;

    default:
      return '';
  }
}

// ── Navigation ─────────────────────────────────────────────────

function wizardNext() {
  if (typeof W.step !== 'number') return;
  if (!validateCurrentStep()) return;
  const n = W.config.steps.length;
  if (W.step === n - 1) { goToPreview(); return; }
  transitionTo(W.step + 1);
}

function wizardBack() {
  if (W.step === 'picker') { history.back(); return; }
  if (W.step === 0)        { showPicker(); return; }
  if (W.step === 'preview') { showFormWizard(W.config.steps.length - 1); return; }
  transitionTo(W.step - 1);
}

function transitionTo(next) {
  const prev = W.step;
  slideOut(prev, next > prev ? 'left' : 'right');
  slideIn(next,  next > prev ? 'right' : 'left');
  W.step = next;
  updateProgress();
  updateHeader();
  saveDraft();
}

function slideOut(idx, dir) {
  const el = document.getElementById('slide' + idx);
  if (!el) return;
  el.classList.remove('state-current', 'state-left', 'state-right');
  el.classList.add(dir === 'left' ? 'state-left' : 'state-right');
}

function slideIn(idx, from) {
  const el = document.getElementById('slide' + idx);
  if (!el) return;
  el.classList.remove('state-current', 'state-left', 'state-right');
  el.classList.add(from === 'left' ? 'state-left' : 'state-right');
  void el.offsetWidth;
  el.classList.remove('state-left', 'state-right');
  el.classList.add('state-current');
}

function skipStep() { wizardNext(); }

// ── Progress & header ──────────────────────────────────────────

function updateProgress() {
  if (!W.config) return;
  const n = W.config.steps.length;
  for (let i = 0; i < n; i++) {
    const el = document.getElementById('prog' + i);
    if (!el) continue;
    el.classList.remove('done', 'active', 'future');
    if (typeof W.step !== 'number') continue;
    if      (i < W.step)  el.classList.add('done');
    else if (i === W.step) el.classList.add('active');
    else                   el.classList.add('future');
  }
}

function updateHeader() {
  if (!W.config) return;
  const skipBtn = document.getElementById('headerSkip');
  const nextBtn = document.getElementById('nextBtn');
  if (!skipBtn || !nextBtn) return;
  const curStep = W.config.steps[W.step];
  const isLast  = typeof W.step === 'number' && W.step === W.config.steps.length - 1;
  skipBtn.style.visibility = (typeof W.step === 'number' && curStep?.skippable) ? 'visible' : 'hidden';
  const label = nextBtn.querySelector('.btn-label');
  if (label) label.textContent = isLast ? 'Посмотреть результат →' : 'Далее';
}

// ── Validation ─────────────────────────────────────────────────

function validateCurrentStep() {
  if (typeof W.step !== 'number' || !W.config) return true;
  const step = W.config.steps[W.step];
  if (!step) return true;
  for (const field of step.fields) {
    if (!field.required) continue;
    const el = document.getElementById(field.id);
    if (!el || !el.value.trim()) { shake(field.id); return false; }
  }
  return true;
}

function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'shake 400ms ease';
  el.focus();
}

// ── Photo ──────────────────────────────────────────────────────

function onPhotoSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    W.photoDataUrl = e.target.result;
    const img = document.getElementById('photoPreviewImg');
    img.src = W.photoDataUrl;
    img.style.display = 'block';
    document.getElementById('photoDropInner').style.display = 'none';
    if (W.iframeReady) sendToIframe();
  };
  reader.readAsDataURL(file);
}

// ── Style picker ───────────────────────────────────────────────

function selectStyle(fieldId, btn) {
  btn.closest('.style-grid').querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(fieldId).value = btn.dataset.value;
  saveDraft();
}
window.selectStyle = selectStyle;

// ── Preview screen ─────────────────────────────────────────────

function goToPreview() {
  saveDraft();
  document.getElementById('formWizard').style.display    = 'none';
  document.getElementById('previewScreen').style.display = 'flex';
  W.step = 'preview';
  if (W.iframeReady) sendToIframe();
}

function showFormWizard(step) {
  document.getElementById('previewScreen').style.display = 'none';
  document.getElementById('lockedScreen').style.display  = 'none';
  document.getElementById('pickerScreen').style.display  = 'none';
  document.getElementById('formWizard').style.display    = 'flex';
  W.step = step;
  updateProgress();
  updateHeader();
}

// ── Iframe ─────────────────────────────────────────────────────

function prefetchIframe() {
  const iframe = document.getElementById('previewIframe');
  iframe.src = `/templates/${W.templateId}/index.html?mode=preview`;
  iframe.addEventListener('load', () => { W.iframeReady = true; sendToIframe(); });
}

function getFormData() {
  const data = {};
  if (!W.config) return data;
  W.config.steps.forEach(step => {
    step.fields.forEach(field => {
      if (field.type === 'photo') return;
      const el = document.getElementById(field.id);
      if (!el) return;
      data[field.id] = field.type === 'toggle' ? el.checked : (el.value || '');
    });
  });
  return data;
}

function sendToIframe() {
  const iframe = document.getElementById('previewIframe');
  if (!iframe?.contentWindow) return;
  const d = getFormData();
  iframe.contentWindow.postMessage({
    type: 'EDITOR_UPDATE',
    config: {
      form: {
        person1:   d.person1   || '',
        person2:   d.person2   || '',
        eventDate: d.eventDate || '',
        language:  'ru',
        title: (d.person1 || '') + (d.person2 ? ' & ' + d.person2 : ''),
      },
      blocks: {
        hero:      { coverPhoto: W.photoDataUrl || null, timer: !!d.timer, music: !!d.music },
        greeting:  { enabled: true, title: 'Мы рады пригласить вас!', text: d.greetingText || '' },
        calendar:  { enabled: !!d.eventDate },
        gallery:   { photos: [], style: 'grid' },
        timeline:  { enabled: d.timeline !== undefined ? !!d.timeline : true },
        location:  { enabled: !!(d.venueName), placeName: d.venueName || '', address: d.venueAddress || '', mapLink: '', photo: null },
        dresscode: { enabled: !!d.dresscode },
        rsvp:      { enabled: true, heading: 'Подтвердите участие', subtitle: '', submitButton: 'Подтверждаю' },
      },
      sectionMap: {
        hero: 'hero', greeting: 'invitation', calendar: 'calendar',
        gallery: 'photoStack', timeline: 'timeline', location: 'location',
        dresscode: 'dresscode', rsvp: 'rsvp',
      },
    }
  }, '*');
}

window.addEventListener('message', e => {
  if (e.data?.type === 'TEMPLATE_READY') { W.iframeReady = true; sendToIframe(); }
});

// ── Registration sheet ─────────────────────────────────────────

function showRegSheet() {
  document.getElementById('sheetBackdrop').classList.add('open');
  document.getElementById('regSheet').classList.add('open');
  setTimeout(() => document.getElementById('regPhone')?.focus(), 350);
}

function closeRegSheet() {
  document.getElementById('sheetBackdrop').classList.remove('open');
  document.getElementById('regSheet').classList.remove('open');
}

function setupPhoneInput() {
  const input = document.getElementById('regPhone');
  if (!input) return;
  input.addEventListener('input', () => {
    hideErr('phoneErr');
    let v = input.value.replace(/\D/g, '');
    if (v.startsWith('996')) v = v.slice(3);
    if (v.startsWith('0'))   v = v.slice(1);
    input.value = v.slice(0, 9);
  });
}

async function submitPhone() {
  const raw = document.getElementById('regPhone').value.replace(/\D/g, '');
  if (raw.length < 9) { showErr('phoneErr'); return; }

  const password = document.getElementById('regPassword')?.value || '';
  if (password.length < 4) { showErr('passwordErr'); return; }

  W.phone = '+996' + raw.slice(-9);
  setBusy('phoneCta', true);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: W.phone, password }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showErr('phoneErr', err.message || 'Неверный пароль');
      return;
    }
    await saveEventToApi();
    showSuccessFlash();
  } catch (_) {
    showErr('phoneErr', 'Ошибка сохранения, попробуйте ещё раз');
  } finally {
    setBusy('phoneCta', false);
  }
}

async function saveEventToApi() {
  const d = getFormData();
  const title = [d.person1, d.person2].filter(Boolean).join(' & ') || 'Моё мероприятие';
  const eventDate = d.eventDate
    ? d.eventDate + 'T' + (d.eventTime || '00:00') + ':00'
    : null;
  const blocksConfig = {
    hero:      { coverPhoto: W.photoDataUrl || null, timer: !!d.timer, music: !!d.music },
    greeting:  { enabled: true, title: 'Мы рады пригласить вас!', text: d.greetingText || '' },
    calendar:  { enabled: !!d.eventDate },
    gallery:   { photos: [], style: 'grid' },
    timeline:  { enabled: d.timeline !== undefined ? !!d.timeline : true },
    location:  { enabled: !!(d.venueName), placeName: d.venueName || '', address: d.venueAddress || '', mapLink: '', photo: null },
    dresscode: { enabled: !!d.dresscode },
    rsvp:      { enabled: true, heading: 'Подтвердите участие', subtitle: '', submitButton: 'Подтверждаю' },
  };
  const body = {
    title,
    person1:    d.person1    || null,
    person2:    d.person2    || null,
    templateId: null,
    eventDate,
    location:   [d.venueName, d.venueAddress].filter(Boolean).join(', ') || null,
    language:   'ru',
    blocksConfig: JSON.stringify(blocksConfig),
  };
  const res = await fetch('/api/organizer/events', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:    JSON.stringify(body),
  });
  if (res.ok) {
    const event = await res.json();
    W.eventId = event.id;
    localStorage.setItem('tl_event_id', String(event.id));
  }
}

function showSuccessFlash() {
  closeRegSheet();
  const flash = document.getElementById('successFlash');
  flash.classList.add('show');
  setTimeout(() => { flash.classList.remove('show'); goToLocked(); }, 1400);
}

// ── Locked screen ──────────────────────────────────────────────

function goToLocked() {
  document.getElementById('previewScreen').style.display = 'none';
  document.getElementById('lockedScreen').style.display  = 'flex';
  W.step = 'locked';
  const wrap   = document.querySelector('.locked-iframe-wrap');
  const iframe = document.getElementById('previewIframe');
  wrap.insertBefore(iframe, wrap.firstChild);
}

function goToPaywall() {
  saveDraft();
  location.href = '/paywall.html';
}

function goToEditor() {
  if (W.eventId) location.href = '/editor.html?id=' + W.eventId;
  else           location.href = '/';
}
window.goToEditor = goToEditor;

// ── Draft persistence ──────────────────────────────────────────

function saveDraft() {
  try {
    const d = getFormData();
    d.photoDataUrl = W.photoDataUrl;
    localStorage.setItem('tl_wizard_draft', JSON.stringify(d));
  } catch (_) {}
}

function restoreDraft() {
  if (!W.config) return;
  try {
    const raw = localStorage.getItem('tl_wizard_draft');
    if (!raw) return;
    const d = JSON.parse(raw);
    W.config.steps.forEach(step => {
      step.fields.forEach(field => {
        if (field.type === 'photo' || field.type === 'style-picker') return;
        const el = document.getElementById(field.id);
        if (!el || d[field.id] === undefined) return;
        if (field.type === 'toggle') el.checked = !!d[field.id];
        else                         el.value   = d[field.id];
      });
    });
    if (d.photoDataUrl) {
      W.photoDataUrl = d.photoDataUrl;
      const img = document.getElementById('photoPreviewImg');
      if (img) {
        img.src = W.photoDataUrl;
        img.style.display = 'block';
        const inner = document.getElementById('photoDropInner');
        if (inner) inner.style.display = 'none';
      }
    }
  } catch (_) {}
}

// ── Helpers ────────────────────────────────────────────────────

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (msg) el.textContent = msg;
  el.style.display = 'block';
}

function hideErr(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function setBusy(id, on) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const shakeCSS = document.createElement('style');
shakeCSS.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}60%{transform:translateX(6px)}}`;
document.head.appendChild(shakeCSS);
