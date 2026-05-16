(function () {
  const device = document.getElementById('editorDevice');
  const previewFrame = document.getElementById('previewFrame');
  const previewStage = document.getElementById('previewStage');
  const sheet = document.getElementById('editorSheet');
  const sheetBody = document.getElementById('sheetBody');
  const nav = document.getElementById('blockNav');
  const handle = document.getElementById('sheetHandle');
  const backdrop = document.getElementById('sheetBackdrop');
  const expandSheetIcon = document.getElementById('expandSheetIcon');
  const sheetScrollThumb = document.getElementById('sheetScrollThumb');

  const eventId = new URLSearchParams(location.search).get('id');
  let phone = '';
  try { phone = localStorage.getItem('tl_phone') || ''; } catch (_) {}

  const imageOptions = [
    '/templates/template-1/images/hero-bg2.jpg',
    '/templates/template-1/images/couple-photo.jpg',
    '/templates/template-1/images/hero-bg.jpg'
  ];

  const state = {
    activeSection: null,
    snap: 'closed',
    keyboardOpen: false,
    currentFocused: null,
    previewReady: false,
    data: {
      cover: {
        badge: 'Мы женимся',
        person1: 'Улансын',
        person2: 'Эльнура',
        date: '2026-10-13T17:00',
        dateText: '13 октября 2026',
        style: 'classic',
        heroImage: imageOptions[0]
      },
      text: {
        heading: 'Дорогие гости!',
        body: 'Мы рады пригласить вас разделить с нами один из самых счастливых дней в нашей жизни. Ваше присутствие сделает этот вечер по-настоящему тёплым и незабываемым.',
        presetIndex: 0
      },
      calendar: {
        enabled: true
      },
      photos: {
        style: 'carousel',
        items: [imageOptions[1], imageOptions[2]]
      },
      timeline: {
        heading: 'Тайминг',
        events: [
          { time: '16:00', title: 'Сбор гостей', desc: 'Приветственный фуршет и живая музыка' },
          { time: '17:00', title: 'Церемония', desc: 'Трогательный момент обмена клятвами' },
          { time: '18:00', title: 'Банкет', desc: 'Ужин, тосты и программа' },
          { time: '22:00', title: 'Торт', desc: 'Сладкое завершение вечера' }
        ]
      },
      location: {
        enabled: true,
        placeName: 'Royal Hall',
        address: 'г. Бишкек, ул. Мадиева 18/1',
        mapLink: 'https://2gis.kg',
        photo: '/templates/template-1/images/restaurant.jpg'
      },
      dresscode: {
        enabled: true,
        dresscode: 'Будем рады, если вы поддержите мягкую светлую палитру вечера.',
        palette: ['#F8F3EC', '#3D6B45', '#C2A882', '#F1C5CF', '#2C3531'],
        activeSlot: 0
      },
      rsvp: {
        enabled: true,
        rsvpTitle: 'Анкета гостя',
        rsvpText: 'Пожалуйста, подтвердите ваше присутствие.',
        submitButton: 'Подтвердить'
      }
    }
  };

  const sectionMap = {
    hero: 'hero',
    greeting: 'invitation',
    calendar: 'calendar',
    gallery: 'photoStack',
    timeline: 'timeline',
    location: 'location',
    dresscode: 'dresscode',
    rsvp: 'rsvp'
  };

  const sections = {
    cover: { index: 1, title: 'Обложка', block: 'hero', target: 'hero' },
    text: { index: 2, title: 'Текст', block: 'greeting', target: 'invitation' },
    calendar: { index: 3, title: 'Календарь', block: 'calendar', target: 'calendar' },
    photos: { index: 4, title: 'Фото', block: 'gallery', target: 'photoStack' },
    timeline: { index: 5, title: 'Таймлайн', block: 'timeline', target: 'timeline' },
    location: { index: 6, title: 'Место', block: 'location', target: 'location' },
    dresscode: { index: 7, title: 'Дресс-код', block: 'dresscode', target: 'dresscode' },
    rsvp: { index: 8, title: 'Анкета', block: 'rsvp', target: 'rsvp' }
  };

  const history = { stack: [JSON.parse(JSON.stringify(state.data))], index: 0 };
  let historyTimer = null;
  let previewDebounce = null;
  let isDirty = false;
  let autosaveTimer = null;

  function historyPush() {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      history.stack.splice(history.index + 1);
      history.stack.push(JSON.parse(JSON.stringify(state.data)));
      history.index = history.stack.length - 1;
      if (history.stack.length > 60) { history.stack.shift(); history.index--; }
      updateHistoryButtons();
    }, 500);
  }

  function historyUndo() {
    if (history.index <= 0) return;
    clearTimeout(historyTimer);
    history.index--;
    state.data = JSON.parse(JSON.stringify(history.stack[history.index]));
    if (state.activeSection) renderSheet(state.activeSection);
    sendToPreview();
    updateHistoryButtons();
    setDirty(true);
    scheduleAutosave();
  }

  function historyRedo() {
    if (history.index >= history.stack.length - 1) return;
    history.index++;
    state.data = JSON.parse(JSON.stringify(history.stack[history.index]));
    if (state.activeSection) renderSheet(state.activeSection);
    sendToPreview();
    updateHistoryButtons();
    setDirty(true);
    scheduleAutosave();
  }

  function updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = history.index <= 0;
    if (redoBtn) redoBtn.disabled = history.index >= history.stack.length - 1;
  }

  const textPresets = [
    'Мы рады пригласить вас разделить с нами один из самых счастливых дней в нашей жизни. Ваше присутствие сделает этот вечер по-настоящему тёплым и незабываемым.',
    'В этот особенный день нам очень хочется быть рядом с самыми близкими людьми. Будем счастливы видеть вас среди гостей нашего торжества.',
    'Приглашаем вас стать частью дня, с которого начинается наша семейная история. Пусть этот вечер будет наполнен улыбками, теплом и красивыми воспоминаниями.'
  ];

  const monthNames = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getPath(path) {
    return path.split('.').reduce((acc, key) => acc && acc[key], state.data);
  }

  function setPath(path, value) {
    const parts = path.split('.');
    const key = parts.pop();
    const target = parts.reduce((acc, part) => acc[part], state.data);
    target[key] = value;
  }

  function viewportHeight() {
    if (window.visualViewport) return window.visualViewport.height;
    return window.innerHeight;
  }

  function editorHeight() {
    const rect = device.getBoundingClientRect();
    return rect.height || viewportHeight();
  }

  function snapHeight(snap) {
    const h = editorHeight();
    const keyboardInset = Number(device.style.getPropertyValue('--keyboard-inset').replace('px', '')) || 0;
    if (snap === 'collapsed') return Math.max(234, Math.min(280, h * 0.28));
    if (snap === 'expanded') return Math.max(360, h - 88 - keyboardInset);
    if (state.keyboardOpen) return Math.max(330, h - 210 - keyboardInset);
    // +78 compensates for the nav footer that overlaps the sheet bottom
    return Math.min(Math.max(360, h * 0.44), 420);
  }

  function setPreviewScale(sheetHeight, cachedH) {
    const h = cachedH !== undefined ? cachedH : editorHeight();
    if (state.snap === 'closed' || h <= 0) {
      device.style.setProperty('--preview-top', '0px');
      device.style.setProperty('--preview-scale', '1');
      return;
    }
    const top = state.keyboardOpen ? 46 : 54;
    const available = Math.max(0, h - sheetHeight - top - 14);
    const scale = state.keyboardOpen
      ? Math.max(0.18, Math.min(0.3, available / h))
      : Math.max(0.44, Math.min(0.78, available / h));
    device.style.setProperty('--preview-top', `${top}px`);
    device.style.setProperty('--preview-scale', scale.toFixed(3));
  }

  function setSnap(snap, immediate) {
    state.snap = snap;
    device.dataset.snap = snap;
    if (snap === 'closed') {
      device.classList.remove('editing');
      device.style.setProperty('--sheet-height', '0px');
      syncSheetBodyMax(0);
      setPreviewScale(0);
      return;
    }
    device.classList.add('editing');
    const nextHeight = Math.round(snapHeight(snap));
    if (immediate) sheet.style.transition = 'none';
    device.style.setProperty('--sheet-height', `${nextHeight}px`);
    syncSheetBodyMax(nextHeight);
    setPreviewScale(nextHeight);
    if (immediate) {
      sheet.offsetHeight;
      sheet.style.transition = '';
    }
    updateSheetChrome();
    window.setTimeout(updateSheetScrollThumb, 40);
  }

  function updateSheetChrome() {
    if (!expandSheetIcon) return;
    expandSheetIcon.innerHTML = state.snap === 'expanded'
      ? '<path d="m6 9 6 6 6-6"/>'
      : '<path d="m6 15 6-6 6 6"/>';
    const expandBtn = document.getElementById('expandSheet');
    if (expandBtn) {
      expandBtn.setAttribute('aria-label', state.snap === 'expanded' ? 'Свернуть шторку' : 'Развернуть шторку');
    }
  }

  function syncSheetBodyMax(h) {
    // handle-zone (29px) + sheet-header (52px) = 81px chrome overhead
    sheetBody.style.maxHeight = h > 0 ? `${Math.max(0, h - 81)}px` : '';
  }

  function updateSheetScrollThumb() {
    if (!sheetScrollThumb) return;
    const max = sheetBody.scrollHeight - sheetBody.clientHeight;
    const rail = sheetScrollThumb.parentElement;
    if (!rail || max <= 8) {
      if (rail) rail.classList.remove('visible');
      return;
    }
    rail.classList.add('visible');
    const railHeight = rail.clientHeight || 120;
    const thumbHeight = Math.max(28, Math.round((sheetBody.clientHeight / sheetBody.scrollHeight) * railHeight));
    const top = Math.round((sheetBody.scrollTop / max) * (railHeight - thumbHeight));
    sheetScrollThumb.style.height = `${thumbHeight}px`;
    sheetScrollThumb.style.transform = `translateY(${top}px)`;
  }

  function markLive() {
    historyPush();
    setDirty(true);
    scheduleAutosave();
  }

  function setDirty(dirty) {
    isDirty = dirty;
    const btn = document.getElementById('saveBtn');
    if (btn) btn.classList.toggle('dirty', dirty);
  }

  function scheduleAutosave() {
    if (!eventId || !phone) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      if (!isDirty) return;
      try { await saveEvent(); setDirty(false); } catch { showToast('Ошибка сохранения — проверьте соединение', true); }
    }, 3000);
  }

  function showToast(message, isError) {
    const el = document.createElement('div');
    el.className = 'editor-toast' + (isError ? ' error' : '');
    el.textContent = message;
    device.appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const dateStr = `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const h = date.getHours(), m = date.getMinutes();
    return (h || m) ? `${dateStr}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : dateStr;
  }

  function buildPreviewConfig() {
    const d = state.data;
    return {
      sectionMap,
      form: {
        title: `${d.cover.person1} & ${d.cover.person2}`,
        person1: d.cover.person1,
        person2: d.cover.person2,
        eventDate: d.cover.date,
        rsvpDeadline: '',
        language: 'ru'
      },
      blocks: {
        hero: {
          enabled: true,
          badge: d.cover.badge,
          subtitle: 'приглашают на торжество',
          coverPhoto: d.cover.heroImage,
          timer: true,
          music: false
        },
        greeting: {
          enabled: true,
          title: d.text.heading,
          text: d.text.body
        },
        calendar: {
          enabled: d.calendar.enabled
        },
        gallery: {
          enabled: true,
          style: d.photos.style,
          photos: d.photos.items.filter(Boolean)
        },
        timeline: {
          enabled: true,
          events: d.timeline.events.map((event) => ({
            time: event.time,
            title: event.title,
            description: event.desc
          }))
        },
        location: {
          enabled: d.location.enabled,
          placeName: d.location.placeName,
          address: d.location.address,
          mapLink: d.location.mapLink,
          photo: d.location.photo
        },
        dresscode: {
          enabled: d.dresscode.enabled,
          text: d.dresscode.dresscode,
          colors: d.dresscode.palette
        },
        rsvp: {
          enabled: d.rsvp.enabled,
          heading: d.rsvp.rsvpTitle,
          subtitle: d.rsvp.rsvpText,
          submitButton: d.rsvp.submitButton
        }
      }
    };
  }

  function sendToPreview() {
    if (!state.previewReady || !previewFrame?.contentWindow) return;
    previewFrame.contentWindow.postMessage({
      type: 'EDITOR_UPDATE',
      config: buildPreviewConfig()
    }, location.origin);
  }

  function field(label, path, options) {
    const value = getPath(path) ?? '';
    const type = options?.type || 'text';
    const inputMode = options?.inputMode ? ` inputmode="${esc(options.inputMode)}"` : '';
    const placeholder = options?.placeholder ? ` placeholder="${esc(options.placeholder)}"` : '';
    const pickerMode = options?.picker ? ` data-tl-picker="${esc(options.picker)}" inputmode="none"` : '';
    const acValue = (type === 'text' || type === 'textarea') ? 'new-password' : 'off';
    const input = type === 'textarea'
      ? `<textarea rows="${options?.rows || 4}" data-bind="${esc(path)}"${placeholder} autocomplete="${acValue}" spellcheck="false">${esc(value)}</textarea>`
      : `<input type="${esc(options?.picker ? 'text' : type)}" value="${esc(value)}" data-bind="${esc(path)}"${placeholder}${inputMode}${pickerMode} autocomplete="${acValue}" spellcheck="false" />`;
    return `
      <label class="field-row">
        <span class="field-label">${esc(label)}</span>
        <span class="field-control">${input}</span>
      </label>
    `;
  }

  function note(text) {
    return `<div class="sheet-note">${esc(text)}</div>`;
  }

  function switchField(label, path) {
    const value = !!getPath(path);
    return `
      <label class="switch-row">
        <span>
          <strong>${esc(label)}</strong>
          <small>${value ? 'Блок виден в приглашении' : 'Блок скрыт в приглашении'}</small>
        </span>
        <input type="checkbox" data-switch="${esc(path)}" ${value ? 'checked' : ''}>
        <i aria-hidden="true"></i>
      </label>
    `;
  }

  function uploadButton(label, path, multiple) {
    return `
      <label class="soft-button upload-button">
        <input class="sr-only" type="file" accept="image/*" data-file-target="${esc(path)}" ${multiple ? 'multiple' : ''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        ${esc(label)}
      </label>
    `;
  }

  function renderCover() {
    return `
      <div class="field-section">
        ${field('Бейдж', 'cover.badge')}
        <div class="two-col">
          ${field('Имя жениха', 'cover.person1')}
          ${field('Имя невесты', 'cover.person2')}
        </div>
        ${field('Дата и время', 'cover.date', { picker: 'datetime' })}
        <div class="field-row">
          <span class="field-label">Фото обложки</span>
          <div class="photo-picker"><img src="${esc(state.data.cover.heroImage)}" alt=""></div>
          <div class="inline-actions">
            ${uploadButton(state.data.cover.heroImage === imageOptions[0] ? 'Добавить своё фото' : 'Заменить фото', 'cover.heroImage')}
            <button class="soft-button" type="button" data-photo-path="cover.heroImage" data-photo-src="${esc(imageOptions[0])}">Вернуть дефолт</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderText() {
    return `
      <div class="field-section">
        ${field('Заголовок', 'text.heading')}
        ${field('Текст приглашения', 'text.body', { type: 'textarea', rows: 5 })}
        <div class="field-row">
          <span class="field-label">Готовые тексты</span>
          <div class="preset-list">
            ${textPresets.map((text, index) => `
              <button type="button" data-text-preset="${index}" class="${state.data.text.body === text ? 'active' : ''}">
                Вариант ${index + 1}
              </button>
            `).join('')}
            <button type="button" data-generate-text>Сгенерировать</button>
          </div>
        </div>
        ${note('Сейчас “сгенерировать” берёт красивый текст из банка заготовок. Позже сюда легко подключить настоящий AI.')}
      </div>
    `;
  }

  function photoButton(src, active, path, index) {
    return `
      <button class="photo-option ${src === active ? 'active' : ''}" type="button" data-photo-path="${esc(path)}" data-photo-src="${esc(src)}" ${index !== undefined ? `data-photo-index="${index}"` : ''}>
        <img src="${esc(src)}" alt="">
      </button>
    `;
  }

  function renderPhotos() {
    return `
      <div class="field-section">
        <div class="field-row">
          <span class="field-label">Стиль блока</span>
          <div class="segmented">
            <button type="button" data-gallery-style="carousel" class="${state.data.photos.style === 'carousel' ? 'active' : ''}">Карусель</button>
            <button type="button" data-gallery-style="collage" class="${state.data.photos.style === 'collage' ? 'active' : ''}">Коллаж</button>
            <button type="button" data-gallery-style="stack" class="${state.data.photos.style === 'stack' ? 'active' : ''}">Стек</button>
          </div>
        </div>
        <div class="field-row">
          <span class="field-label">Фото ${state.data.photos.items.length} из 10</span>
          <div class="photo-list">
            ${state.data.photos.items.map((src, index) => `
              <div class="photo-card">
                <img src="${esc(src)}" alt="">
                <button type="button" data-remove-photo="${index}" aria-label="Удалить фото">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            `).join('')}
          </div>
          ${state.data.photos.items.length < 10 ? uploadButton('Добавить фото', 'photos.items', true) : note('Достигнут лимит 10 фото для этого шаблона.')}
        </div>
      </div>
    `;
  }

  function renderCalendar() {
    return `
      <div class="field-section">
        ${switchField('Показывать календарь', 'calendar.enabled')}
        ${note('Календарь берёт месяц и выделенный день из даты события на обложке.')}
      </div>
    `;
  }

  function renderTimeline() {
    return `
      <div class="field-section">
        ${field('Заголовок', 'timeline.heading')}
        <div class="timeline-editor">
          ${state.data.timeline.events.map((event, index) => `
            <div class="timeline-card" data-timeline-index="${index}">
              <div class="timeline-card-head">
                <span>${index + 1}</span>
                <button type="button" data-remove-timeline="${index}" aria-label="Удалить пункт">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <div class="timeline-editor-row">
                <span class="field-control"><input data-timeline-field="time" value="${esc(event.time)}" data-tl-picker="time" inputmode="none" autocomplete="new-password" spellcheck="false" aria-label="Время ${index + 1}"></span>
                <span class="field-control"><input data-timeline-field="title" value="${esc(event.title)}" autocomplete="new-password" spellcheck="false" aria-label="Событие ${index + 1}"></span>
              </div>
              <span class="field-control"><input data-timeline-field="desc" value="${esc(event.desc)}" autocomplete="new-password" spellcheck="false" aria-label="Описание ${index + 1}"></span>
            </div>
          `).join('')}
        </div>
        <button class="soft-button" type="button" id="addTimeline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Добавить пункт
        </button>
      </div>
    `;
  }

  function renderLocation() {
    return `
      <div class="field-section">
        ${switchField('Показывать место', 'location.enabled')}
        ${field('Название места', 'location.placeName')}
        ${field('Адрес', 'location.address')}
        ${field('Ссылка на карту', 'location.mapLink', { type: 'url' })}
        <div class="field-row">
          <span class="field-label">Фото места</span>
          <div class="photo-picker"><img src="${esc(state.data.location.photo)}" alt=""></div>
          ${uploadButton('Заменить фото места', 'location.photo')}
        </div>
      </div>
    `;
  }

  function renderDresscode() {
    const paletteOptions = ['#F8F3EC', '#FFFFFF', '#3D6B45', '#C2A882', '#F1C5CF', '#B33030', '#689D34', '#2C3531'];
    return `
      <div class="field-section">
        ${switchField('Показывать дресс-код', 'dresscode.enabled')}
        ${field('Описание', 'dresscode.dresscode', { type: 'textarea', rows: 3 })}
        <div class="field-row">
          <span class="field-label">Палитра гостей</span>
          <div class="palette-slots">
            ${state.data.dresscode.palette.map((color, index) => `
              <button type="button" data-palette-slot="${index}" class="${state.data.dresscode.activeSlot === index ? 'active' : ''}">
                <span style="background:${esc(color)}"></span>
              </button>
            `).join('')}
          </div>
          <div class="palette-grid">
            ${paletteOptions.map((color) => `
              <button class="color-swatch" type="button" data-color="${color}" style="background:${color}" aria-label="${color}"></button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderRsvp() {
    return `
      <div class="field-section">
        ${switchField('Показывать анкету', 'rsvp.enabled')}
        ${field('Заголовок', 'rsvp.rsvpTitle')}
        ${field('Подзаголовок', 'rsvp.rsvpText')}
        ${field('Текст кнопки', 'rsvp.submitButton')}
        ${note('Поля анкеты гостей задаются шаблоном: имя, присутствие, количество гостей и пожелания.')}
      </div>
    `;
  }

  const sheetRenderers = {
    cover: renderCover,
    text: renderText,
    calendar: renderCalendar,
    photos: renderPhotos,
    timeline: renderTimeline,
    location: renderLocation,
    dresscode: renderDresscode,
    rsvp: renderRsvp,
  };

  function renderSheet(section) {
    const titleEl = document.getElementById('sheetTitle');
    if (titleEl) titleEl.textContent = sections[section]?.title || '';
    sheetBody.innerHTML = `<form autocomplete="off" novalidate>${sheetRenderers[section]?.() ?? ''}</form>`;
    sheetBody.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
    window.ToiDateTimePicker?.enhance(sheetBody);
    bindSheetControls();
    updateSheetScrollThumb();
  }

  function activateSection(section, options) {
    const open = () => {
      state.activeSection = section;
      nav.querySelectorAll('.nav-item').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.section === section);
      });
      nav.querySelector(`[data-section="${section}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
      renderSheet(section);
      setSnap(options?.snap || 'medium');
      scrollPreviewTo(section);
    };

    if (state.keyboardOpen && document.activeElement) {
      document.activeElement.blur();
      window.setTimeout(open, 160);
      return;
    }
    open();
  }

  function scrollPreviewTo(section) {
    const targetName = sections[section]?.target;
    if (!targetName || !previewFrame?.contentWindow) return;
    previewFrame.contentWindow.postMessage({ type: 'EDITOR_SCROLL_TO', section: targetName }, location.origin);
  }

  function sendToPreviewDebounced() {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(sendToPreview, 120);
  }

  function bindSheetControls() {
    sheetBody.querySelectorAll('[data-bind]').forEach((control) => {
      control.addEventListener('input', () => {
        const path = control.dataset.bind;
        setPath(path, control.value);
        if (path === 'cover.date') state.data.cover.dateText = formatDate(control.value);
        sendToPreviewDebounced();
        markLive();
      });
      if (!control.dataset.tlPicker) {
        control.addEventListener('focus', () => enterKeyboardMode(control));
      }
    });

    sheetBody.querySelectorAll('[data-switch]').forEach((control) => {
      control.addEventListener('change', () => {
        setPath(control.dataset.switch, control.checked);
        sendToPreview();
        renderSheet(state.activeSection);
        markLive();
      });
    });

    sheetBody.querySelectorAll('[data-file-target]').forEach((control) => {
      control.addEventListener('change', async () => {
        const files = Array.from(control.files || []);
        if (!files.length) return;
        const btn = control.closest('label');
        if (btn) btn.classList.add('loading');
        try {
          const urls = await Promise.all(files.slice(0, 10).map(uploadFile));
          const target = control.dataset.fileTarget;
          if (target === 'photos.items') {
            state.data.photos.items = [...state.data.photos.items, ...urls].slice(0, 10);
          } else {
            setPath(target, urls[0]);
          }
          sendToPreview();
          renderSheet(state.activeSection);
          markLive();
        } catch (err) {
          console.warn('Upload failed:', err?.message);
          showToast('Ошибка загрузки файла', true);
        } finally {
          if (btn) btn.classList.remove('loading');
        }
      });
    });

    sheetBody.querySelectorAll('[data-timeline-field]').forEach((control) => {
      control.addEventListener('input', () => {
        const row = control.closest('[data-timeline-index]');
        const index = Number(row?.dataset.timelineIndex);
        const key = control.dataset.timelineField;
        if (state.data.timeline.events[index]) {
          state.data.timeline.events[index][key] = control.value;
          sendToPreview();
          markLive();
        }
      });
      if (!control.dataset.tlPicker) {
        control.addEventListener('focus', () => enterKeyboardMode(control));
      }
    });

    sheetBody.querySelectorAll('[data-photo-src]').forEach((button) => {
      button.addEventListener('click', () => {
        const path = button.dataset.photoPath;
        setPath(path, button.dataset.photoSrc);
        sendToPreview();
        renderSheet(state.activeSection);
        markLive();
      });
    });

    sheetBody.querySelectorAll('[data-text-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.textPreset);
        state.data.text.presetIndex = index;
        state.data.text.body = textPresets[index] || state.data.text.body;
        sendToPreview();
        renderSheet('text');
        markLive();
      });
    });

    sheetBody.querySelector('[data-generate-text]')?.addEventListener('click', () => {
      state.data.text.presetIndex = (state.data.text.presetIndex + 1) % textPresets.length;
      state.data.text.body = textPresets[state.data.text.presetIndex];
      sendToPreview();
      renderSheet('text');
      markLive();
    });

    sheetBody.querySelectorAll('[data-gallery-style]').forEach((button) => {
      button.addEventListener('click', () => {
        state.data.photos.style = button.dataset.galleryStyle;
        sendToPreview();
        renderSheet('photos');
        markLive();
      });
    });

    sheetBody.querySelectorAll('[data-remove-photo]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.removePhoto);
        state.data.photos.items.splice(index, 1);
        sendToPreview();
        renderSheet('photos');
        markLive();
      });
    });

    sheetBody.querySelectorAll('[data-remove-timeline]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.removeTimeline);
        state.data.timeline.events.splice(index, 1);
        if (state.data.timeline.events.length === 0) {
          state.data.timeline.events.push({ time: '', title: 'Новый пункт', desc: '' });
        }
        sendToPreview();
        renderSheet('timeline');
        markLive();
      });
    });

    sheetBody.querySelectorAll('[data-palette-slot]').forEach((button) => {
      button.addEventListener('click', () => {
        state.data.dresscode.activeSlot = Number(button.dataset.paletteSlot);
        renderSheet('dresscode');
      });
    });

    sheetBody.querySelectorAll('[data-color]').forEach((button) => {
      button.addEventListener('click', () => {
        const color = button.dataset.color;
        state.data.dresscode.palette[state.data.dresscode.activeSlot] = color;
        sendToPreview();
        renderSheet('dresscode');
        markLive();
      });
    });

    document.getElementById('addTimeline')?.addEventListener('click', () => {
      state.data.timeline.events.push({ time: '', title: 'Новый пункт', desc: '' });
      sendToPreview();
      renderSheet('timeline');
      const cards = sheetBody.querySelectorAll('.timeline-card');
      cards[cards.length - 1]?.querySelector('[data-timeline-field="time"]')?.focus();
      markLive();
    });
  }

  function focusableFields() {
    return Array.from(sheetBody.querySelectorAll('input, textarea, select'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
  }

  function focusField(dir) {
    const fields = focusableFields();
    const index = fields.indexOf(document.activeElement);
    const next = fields[index + dir];
    if (next) next.focus();
  }

  function updateKeyboardButtons() {
    const fields = focusableFields();
    const index = fields.indexOf(document.activeElement);
    document.getElementById('prevField').disabled = index <= 0;
    document.getElementById('nextField').disabled = index < 0 || index >= fields.length - 1;
  }

  function enterKeyboardMode(control) {
    state.currentFocused = control;
    state.keyboardOpen = true;
    device.classList.add('keyboard-open');
    setSnap('expanded');
    syncVisualViewport();
    window.setTimeout(() => {
      control.scrollIntoView({ behavior: 'smooth', block: 'center' });
      updateKeyboardButtons();
    }, 80);
  }

  function leaveKeyboardMode() {
    state.keyboardOpen = false;
    state.currentFocused = null;
    device.classList.remove('keyboard-open');
    device.style.setProperty('--keyboard-inset', '0px');
    if (state.snap !== 'closed') setSnap('medium');
  }

  function doneKeyboard() {
    const active = document.activeElement;
    if (active && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) active.blur();
    leaveKeyboardMode();
  }

  function syncVisualViewport() {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    device.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
    const likelyKeyboard = inset > 80 || (window.innerHeight - vv.height) > 120;
    if (!likelyKeyboard && state.keyboardOpen && !document.activeElement?.matches('input, textarea, select')) {
      leaveKeyboardMode();
    } else if (state.snap !== 'closed') {
      setSnap(state.keyboardOpen ? 'expanded' : state.snap, true);
    }
  }

  function closeEditor() {
    doneKeyboard();
    state.activeSection = null;
    nav.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
    setSnap('closed');
  }

  function bindDrag() {
    let startY = 0;
    let startHeight = 0;
    let cachedDeviceH = 0;
    let dragging = false;
    let rafId = null;
    let pendingClientY = 0;

    handle.addEventListener('pointerdown', (event) => {
      dragging = true;
      startY = event.clientY;
      startHeight = parseFloat(device.style.getPropertyValue('--sheet-height')) || snapHeight(state.snap);
      cachedDeviceH = device.getBoundingClientRect().height || viewportHeight();
      handle.setPointerCapture(event.pointerId);
      // Kill transitions on everything that follows --sheet-height
      sheet.style.transition = 'none';
      previewStage.style.transition = 'none';
      nav.style.transition = 'none';
    });

    handle.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      pendingClientY = event.clientY;
      if (rafId) return; // already scheduled, don't pile up
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const dy = startY - pendingClientY;
        const next = Math.round(Math.max(0, Math.min(cachedDeviceH - 80, startHeight + dy)));
        device.style.setProperty('--sheet-height', `${next}px`);
        syncSheetBodyMax(next);
        setPreviewScale(next, cachedDeviceH);
      });
    });

    handle.addEventListener('pointerup', (event) => {
      if (!dragging) return;
      dragging = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      handle.releasePointerCapture(event.pointerId);
      // Restore transitions so snap animation plays
      sheet.style.transition = '';
      previewStage.style.transition = '';
      nav.style.transition = '';
      const h = parseFloat(device.style.getPropertyValue('--sheet-height')) || 0;
      const collapsed = snapHeight('collapsed');
      const medium = snapHeight('medium');
      const expanded = snapHeight('expanded');
      if (h < collapsed * 0.72) closeEditor();
      else if (h < (collapsed + medium) / 2) setSnap('collapsed');
      else if (h < (medium + expanded) / 2) setSnap('medium');
      else setSnap('expanded');
    });

    // OS can cancel pointer (incoming call, low-power, etc.) — without this drag stays locked
    handle.addEventListener('pointercancel', () => {
      if (!dragging) return;
      dragging = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      sheet.style.transition = '';
      previewStage.style.transition = '';
      nav.style.transition = '';
      setSnap(state.snap === 'closed' ? 'closed' : 'medium');
    });
  }

  async function uploadFile(file) {
    if (file.size > 15 * 1024 * 1024) throw new Error('Файл больше 15 МБ');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/organizer/upload', {
      method: 'POST',
      credentials: 'include',
      body: fd
    });
    if (res.status === 401 || res.status === 403) {
      location.replace('/login.html?next=' + encodeURIComponent(location.pathname + location.search));
      throw new Error('Требуется вход');
    }
    if (!res.ok) throw new Error('Ошибка загрузки');
    const data = await res.json();
    return data.url;
  }

  async function loadEvent() {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/organizer/events/${eventId}`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        location.replace('/login.html?next=' + encodeURIComponent(location.pathname + location.search));
        return;
      }
      if (!res.ok) return;
      const event = await res.json();
      if (event.blocksConfig) {
        const saved = JSON.parse(event.blocksConfig);
        state.data = { ...state.data, ...saved };
      } else {
        if (event.person1) state.data.cover.person1 = event.person1;
        if (event.person2) state.data.cover.person2 = event.person2;
        if (event.eventDate) state.data.cover.date = event.eventDate.substring(0, 16);
        if (event.coverImageUrl) state.data.cover.heroImage = event.coverImageUrl;
        if (event.location) state.data.location.address = event.location;
      }
      history.stack[0] = JSON.parse(JSON.stringify(state.data));
      sendToPreview();
    } catch {
      showToast('Не удалось загрузить данные события', true);
    }
  }

  async function saveEvent() {
    if (!eventId) return;
    const d = state.data;
    const dateVal = d.cover.date;
    const eventDate = dateVal ? (dateVal.length === 16 ? dateVal + ':00' : dateVal) : null;
    const res = await fetch(`/api/organizer/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: `${d.cover.person1} & ${d.cover.person2}`,
        person1: d.cover.person1,
        person2: d.cover.person2,
        eventDate,
        location: d.location.address || null,
        coverImageUrl: d.cover.heroImage || null,
        blocksConfig: JSON.stringify(d)
      })
    });
    if (res.status === 401 || res.status === 403) {
      location.replace('/login.html?next=' + encodeURIComponent(location.pathname + location.search));
      return;
    }
    if (!res.ok) throw new Error('Ошибка сохранения');
  }

  function setSaveState(s) {
    const btn = document.getElementById('saveBtn');
    if (!btn) return;
    if (s === 'saving') {
      btn.textContent = '...';
      btn.disabled = true;
    } else if (s === 'saved') {
      clearTimeout(autosaveTimer);
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:3px"><path d="M20 6 9 17l-5-5"/></svg>Сохранено';
      btn.disabled = false;
      setDirty(false);
    } else if (s === 'error') {
      btn.textContent = 'Ошибка';
      btn.disabled = false;
    } else {
      btn.textContent = 'Сохранить';
      btn.disabled = false;
    }
  }

  async function handleSave() {
    const btn = document.getElementById('saveBtn');
    if (btn?.disabled) return;
    if (!eventId || !phone) {
      showToast('Войдите в аккаунт чтобы сохранить', true);
      return;
    }
    setSaveState('saving');
    try {
      await saveEvent();
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
    }
  }

  function init() {
    setSnap('closed', true);
    updateSheetChrome();

    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin) return;
      if (event.data?.type === 'TEMPLATE_READY') {
        state.previewReady = true;
        sendToPreview();
      }
      if (event.data?.type === 'TEMPLATE_CLICK' && event.data.block) {
        const entry = Object.entries(sections).find(([, def]) => def.block === event.data.block);
        if (entry) activateSection(entry[0]);
      }
    });

    previewFrame.addEventListener('load', () => {
      window.setTimeout(() => {
        state.previewReady = true;
        sendToPreview();
      }, 350);
    });

    nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-section]');
      if (button) activateSection(button.dataset.section);
    });

    document.getElementById('closeSheet').addEventListener('click', closeEditor);
    document.getElementById('expandSheet').addEventListener('click', () => {
      setSnap(state.snap === 'expanded' ? 'medium' : 'expanded');
    });
    document.getElementById('undoBtn')?.addEventListener('click', historyUndo);
    document.getElementById('redoBtn')?.addEventListener('click', historyRedo);
    backdrop.addEventListener('click', closeEditor);
    previewStage.addEventListener('click', (event) => {
      if (device.classList.contains('editing') && !state.keyboardOpen && event.detail > 0) closeEditor();
    });

    document.getElementById('prevField').addEventListener('click', () => focusField(-1));
    document.getElementById('nextField').addEventListener('click', () => focusField(1));
    document.getElementById('doneKeyboard').addEventListener('click', doneKeyboard);

    document.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!document.activeElement?.matches('input, textarea, select') && state.keyboardOpen) {
          leaveKeyboardMode();
        }
      }, 40);
    });

    sheetBody.addEventListener('scroll', updateSheetScrollThumb, { passive: true });

    window.visualViewport?.addEventListener('resize', syncVisualViewport);
    window.visualViewport?.addEventListener('scroll', syncVisualViewport);
    window.addEventListener('resize', () => {
      if (state.snap !== 'closed') setSnap(state.snap, true);
    });

    bindDrag();

    document.getElementById('saveBtn')?.addEventListener('click', handleSave);
    loadEvent();
  }

  init();
})();
