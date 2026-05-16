/**
 * Landing Visual Editor
 *
 * Activates only when URL contains ?edit=1 AND the browser session
 * belongs to an admin (verified by GET /api/admin/landing returning 200).
 *
 * Flow:
 *   1. Sets window.__leEditMode = true synchronously so landing.js skips
 *      the public-API fetch (avoiding config collision).
 *   2. Fetches the current saved config from the admin API.
 *   3. Applies it to the page via window.applyLandingConfig().
 *   4. Injects a top toolbar + pencil overlays over each [data-l-section].
 *   5. Clicking a pencil opens a slide-in panel with the section's form fields.
 *   6. Every field change live-previews via applyLandingConfig().
 *   7. "Сохранить" PUTs the full config to /api/admin/landing.
 */
(function () {
  'use strict';

  // ── Guard: only activate in edit mode ─────────────────────────────────────
  if (!new URLSearchParams(location.search).has('edit')) return;

  // Signal to landing.js to skip the public config fetch.
  window.__leEditMode = true;

  // ── Constants ─────────────────────────────────────────────────────────────
  const ADMIN_API = '/api/admin/landing';

  // ── Section schema ────────────────────────────────────────────────────────
  // Each entry maps to a [data-l-section="key"] element on the landing page.
  //
  // field tuple: [dotPath, label, inputType]
  //   inputType: 'text' (default) | 'textarea' | 'lines' (multiline → string[])
  //              'image' (url text input) | 'color' (color picker)
  //
  // list: { path, title, type: 'text' | 'object', fields? }
  //   'text'   → array of plain strings
  //   'object' → array of objects with sub-fields
  const SECTIONS = [
    {
      key: 'meta',
      title: 'SEO и мета-теги',
      icon: '🔍',
      noOverlay: true,
      fields: [
        ['meta.title',           'Title страницы'],
        ['meta.description',     'Meta description', 'textarea'],
        ['meta.ogTitle',         'OG title (в мессенджерах)'],
        ['meta.ogDescription',   'OG description', 'textarea'],
        ['meta.ogImage',         'OG Image — картинка-превью (URL)', 'image'],
      ],
    },
    {
      key: 'brand',
      title: 'Бренд и логотип',
      icon: '🎨',
      noOverlay: true,
      fields: [
        ['brand.logoText',     'Название (текст логотипа)'],
        ['brand.primaryColor', 'Основной цвет', 'color'],
        ['brand.gradientEnd',  'Цвет градиента (правый)', 'color'],
      ],
    },
    {
      key: 'hero',
      title: 'Первый экран',
      icon: '🌟',
      fields: [
        ['hero.badge',       'Плашка над заголовком'],
        ['hero.titleTop',    'Заголовок — первая строка'],
        ['hero.titleAccent', 'Заголовок — розовый акцент'],
        ['hero.subtitle',    'Подзаголовок', 'textarea'],
        ['hero.primaryCta',  'Главная кнопка'],
        ['hero.secondaryCta','Вторая кнопка'],
        ['hero.bgImage',     'Фото-фон секции (URL)', 'image'],
      ],
      lists: [
        { path: 'hero.bullets', title: 'Галочки доверия', type: 'text' },
      ],
    },
    {
      key: 'miniFeatures',
      title: 'Быстрые преимущества',
      icon: '⚡',
      lists: [
        {
          path: 'miniFeatures', title: 'Три пункта под hero', type: 'object',
          fields: [['title', 'Текст', 'textarea']],
        },
      ],
    },
    {
      key: 'phoneMockup',
      title: 'iPhone мокап',
      icon: '📱',
      fields: [
        ['phoneMockup.screenshotUrl', 'Скриншот в телефоне (URL)', 'image'],
      ],
    },
    {
      key: 'stats',
      title: 'Статистика',
      icon: '📊',
      fields: [
        ['stats.socialProof', 'Текст над цифрами', 'textarea'],
      ],
      lists: [
        {
          path: 'stats.items', title: 'Три цифры', type: 'object',
          fields: [['value', 'Значение'], ['label', 'Подпись']],
        },
      ],
    },
    {
      key: 'trust',
      title: 'Бегущая строка',
      icon: '🏃',
      lists: [
        { path: 'trust', title: 'Trust-фразы', type: 'text' },
      ],
    },
    {
      key: 'categories',
      title: 'Категории событий',
      icon: '🗂️',
      fields: [
        ['categories.eyebrow', 'Надзаголовок'],
        ['categories.title',   'Заголовок'],
      ],
      lists: [
        {
          path: 'categories.items', title: 'Карточки категорий', type: 'object',
          fields: [['emoji', 'Эмодзи'], ['title', 'Название'], ['text', 'Описание']],
        },
      ],
    },
    {
      key: 'how',
      title: 'Как работает',
      icon: '📋',
      fields: [
        ['how.eyebrow',  'Надзаголовок'],
        ['how.title',    'Заголовок'],
        ['how.subtitle', 'Подзаголовок', 'textarea'],
        ['how.cta',      'Кнопка'],
      ],
      lists: [
        {
          path: 'how.steps', title: 'Шаги', type: 'object',
          fields: [['title', 'Название шага'], ['text', 'Описание', 'textarea']],
        },
      ],
    },
    {
      key: 'features',
      title: 'Преимущества',
      icon: '✨',
      fields: [
        ['features.eyebrow',        'Надзаголовок'],
        ['features.title',          'Заголовок'],
        ['features.subtitle',       'Подзаголовок', 'textarea'],
        ['features.highlightTitle', 'Большой блок: заголовок'],
        ['features.highlightText',  'Большой блок: текст', 'textarea'],
        ['features.highlightCta',   'Большой блок: кнопка'],
      ],
      lists: [
        {
          path: 'features.items', title: 'Карточки', type: 'object',
          fields: [['title', 'Заголовок'], ['text', 'Текст', 'textarea']],
        },
      ],
    },
    {
      key: 'comparison',
      title: 'Сравнение с WhatsApp',
      icon: '⚖️',
      fields: [
        ['comparison.eyebrow',  'Надзаголовок'],
        ['comparison.title',    'Заголовок'],
        ['comparison.subtitle', 'Подзаголовок', 'textarea'],
        ['comparison.cta',      'Кнопка'],
      ],
      lists: [
        {
          path: 'comparison.rows', title: 'Строки таблицы', type: 'object',
          fields: [
            ['feature',  'Параметр (строка)'],
            ['whatsapp', 'WhatsApp — текст, «yes» или «no»'],
            ['toilink',  'ToiLink — текст, «yes» или «no»'],
          ],
        },
      ],
    },
    {
      key: 'templates',
      title: 'Шаблоны',
      icon: '🎨',
      fields: [
        ['templates.eyebrow',  'Надзаголовок'],
        ['templates.title',    'Заголовок'],
        ['templates.subtitle', 'Подзаголовок'],
        ['templates.cta',      'Кнопка'],
      ],
    },
    {
      key: 'reviews',
      title: 'Отзывы',
      icon: '⭐',
      fields: [
        ['reviews.eyebrow', 'Надзаголовок'],
        ['reviews.title',   'Заголовок'],
      ],
      lists: [
        {
          path: 'reviews.items', title: 'Отзывы', type: 'object',
          fields: [
            ['avatar',   'Буква аватара (если нет фото)'],
            ['photoUrl', 'Фото аватара (URL)', 'image'],
            ['name',     'Имя'],
            ['meta',     'Подпись (город, тип события)'],
            ['text',     'Текст отзыва', 'textarea'],
          ],
        },
      ],
    },
    {
      key: 'pricing',
      title: 'Тарифы',
      icon: '💰',
      fields: [
        ['pricing.eyebrow',  'Надзаголовок'],
        ['pricing.title',    'Заголовок'],
        ['pricing.subtitle', 'Подзаголовок', 'textarea'],
      ],
      lists: [
        {
          path: 'pricing.plans', title: 'Тарифные планы', type: 'object',
          fields: [
            ['name',        'Название'],
            ['tag',         'Метка'],
            ['description', 'Описание'],
            ['price',       'Цена'],
            ['currency',    'Валюта'],
            ['oldPrice',    'Старая цена'],
            ['note',        'Подпись под ценой'],
            ['badge',       'Плашка сверху'],
            ['cta',         'Кнопка'],
            ['features',    'Пункты — каждый с новой строки', 'lines'],
          ],
        },
        { path: 'pricing.badges', title: 'Значки доверия', type: 'text' },
      ],
    },
    {
      key: 'faq',
      title: 'FAQ',
      icon: '❓',
      fields: [
        ['faq.eyebrow', 'Надзаголовок'],
        ['faq.title',   'Заголовок'],
      ],
      lists: [
        {
          path: 'faq.items', title: 'Вопросы и ответы', type: 'object',
          fields: [['question', 'Вопрос'], ['answer', 'Ответ', 'textarea']],
        },
      ],
    },
    {
      key: 'finalCta',
      title: 'Финальный CTA',
      icon: '🚀',
      fields: [
        ['finalCta.badge',       'Плашка'],
        ['finalCta.title',       'Заголовок', 'textarea'],
        ['finalCta.subtitle',    'Подзаголовок', 'textarea'],
        ['finalCta.primaryCta',  'Главная кнопка'],
        ['finalCta.secondaryCta','Вторая кнопка'],
      ],
      lists: [
        { path: 'finalCta.bullets', title: 'Галочки', type: 'text' },
      ],
    },
    {
      key: 'footer',
      title: 'Футер',
      icon: '📌',
      fields: [
        ['footer.text',      'Описание компании', 'textarea'],
        ['footer.instagram', 'Instagram (ссылка)'],
        ['footer.whatsapp',  'WhatsApp (ссылка)'],
        ['footer.telegram',  'Telegram (ссылка)'],
        ['footer.phone',     'Телефон'],
        ['footer.email',     'Email'],
        ['footer.city',      'Город'],
        ['footer.copyright', 'Copyright'],
      ],
    },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  let config         = {};
  let activeKey      = null;
  let dirty          = false;
  let saveInProgress = false;

  // ── Utilities ─────────────────────────────────────────────────────────────

  // Get a nested value by dot-path: get(obj, 'hero.title') → obj.hero.title
  function deepGet(obj, path) {
    return path.split('.').reduce((cur, key) => cur?.[key], obj);
  }

  // Set a nested value by dot-path, creating missing objects along the way.
  function deepSet(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  // HTML-escape a value for safe insertion into attributes and text nodes.
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function sectionDef(key) {
    return SECTIONS.find(s => s.key === key) ?? null;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectCSS() {
    const el = document.createElement('style');
    el.id = 'le-styles';
    el.textContent = `
      /* Push page content below the fixed toolbar */
      body.le-active { padding-top: 52px !important; }

      /* ── Toolbar ── */
      #le-toolbar {
        position: fixed; top: 0; left: 0; right: 0; height: 52px;
        background: #0C0C0B; color: #F5F5F3;
        display: flex; align-items: center; gap: 10px; padding: 0 16px;
        z-index: 99999; font-family: Inter, system-ui, sans-serif; font-size: 13px;
        box-shadow: 0 2px 16px rgba(0,0,0,.35);
      }
      .le-brand {
        display: flex; align-items: center; gap: 8px;
        font-weight: 600; letter-spacing: -.01em; flex-shrink: 0;
      }
      .le-dot {
        width: 8px; height: 8px; border-radius: 50%; background: #F93B7A;
        animation: le-pulse 2s ease-in-out infinite;
      }
      @keyframes le-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      .le-spacer { flex: 1; }
      .le-seo-btn {
        background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14);
        color: #F5F5F3; border-radius: 6px; padding: 5px 12px;
        cursor: pointer; font-size: 12px; font-weight: 500;
        transition: background .15s;
      }
      .le-seo-btn:hover { background: rgba(255,255,255,.15); }
      .le-dirty {
        display: none; align-items: center; gap: 5px;
        font-size: 11px; font-weight: 600; color: #F59E0B;
      }
      .le-dirty.visible { display: flex; }
      .le-dirty::before {
        content: ''; width: 6px; height: 6px;
        border-radius: 50%; background: #F59E0B;
      }
      .le-save-btn {
        background: #F93B7A; color: #fff; border: none;
        border-radius: 6px; padding: 6px 16px;
        cursor: pointer; font-size: 13px; font-weight: 600;
        transition: opacity .15s; flex-shrink: 0;
      }
      .le-save-btn:disabled { opacity: .45; cursor: default; }
      .le-exit-btn {
        background: transparent; color: rgba(245,245,243,.5); border: none;
        cursor: pointer; font-size: 12px; padding: 5px 8px;
        border-radius: 5px; transition: color .15s; flex-shrink: 0;
      }
      .le-exit-btn:hover { color: #F5F5F3; }

      /* ── Section pencil overlays ── */
      .le-wrap { position: relative; }
      /* Dashed hover border — doesn't affect layout */
      .le-wrap::after {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        border: 2px dashed transparent; border-radius: 3px;
        transition: border-color .18s; z-index: 8998;
      }
      .le-wrap:hover::after         { border-color: rgba(249,59,122,.22); }
      .le-wrap.le-active-wrap::after{ border-color: rgba(249,59,122,.5); }

      .le-pencil {
        position: absolute; top: 12px; right: 12px; z-index: 8999;
        width: 36px; height: 36px; border-radius: 10px;
        background: #0C0C0B; border: 1.5px solid rgba(255,255,255,.18);
        color: #F5F5F3; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transform: scale(.85);
        transition: opacity .18s, transform .18s, background .15s;
        box-shadow: 0 4px 16px rgba(0,0,0,.4);
      }
      .le-wrap:hover .le-pencil,
      .le-pencil.le-active { opacity: 1; transform: scale(1); }
      .le-pencil:hover,
      .le-pencil.le-active { background: #F93B7A; border-color: #F93B7A; }
      .le-pencil svg { pointer-events: none; }

      /* ── Side panel ── */
      #le-panel {
        position: fixed; top: 52px; right: 0; bottom: 0; width: 360px;
        background: #fff; border-left: 1px solid #EBEBE8;
        display: flex; flex-direction: column;
        transform: translateX(102%);
        transition: transform .28s cubic-bezier(.33,1,.68,1);
        z-index: 99990; box-shadow: -8px 0 32px rgba(0,0,0,.08);
        font-family: Inter, system-ui, sans-serif;
      }
      #le-panel.le-open { transform: translateX(0); }

      #le-panel-head {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 16px; border-bottom: 1px solid #EBEBE8;
        flex-shrink: 0; background: #FAFAF9;
      }
      .le-ph-icon  { font-size: 20px; flex-shrink: 0; line-height: 1; }
      .le-ph-title {
        font-size: 14px; font-weight: 600; color: #141413;
        flex: 1; min-width: 0; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
      }
      .le-vis-label {
        display: flex; align-items: center; gap: 5px;
        font-size: 11px; color: #6B6B68; cursor: pointer; flex-shrink: 0;
      }
      .le-vis-label input { accent-color: #F93B7A; width: 14px; height: 14px; cursor: pointer; }
      .le-close {
        width: 28px; height: 28px; border-radius: 7px; background: #F3F3F1;
        border: none; cursor: pointer; color: #6B6B68; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: background .15s, color .15s;
      }
      .le-close:hover { background: #EBEBE8; color: #141413; }

      #le-panel-body {
        flex: 1; overflow-y: auto; padding: 16px;
        display: flex; flex-direction: column; gap: 20px;
      }

      /* Field groups */
      .le-group { display: flex; flex-direction: column; gap: 10px; }
      .le-group-label {
        font-size: 10px; font-weight: 700; letter-spacing: .1em;
        text-transform: uppercase; color: #9D9D99;
        padding-bottom: 8px; border-bottom: 1px solid #EBEBE8;
      }
      .le-field { display: flex; flex-direction: column; gap: 4px; }
      .le-field label { font-size: 11px; font-weight: 600; color: #6B6B68; }
      .le-field input,
      .le-field textarea {
        width: 100%; border: 1.5px solid #EBEBE8; border-radius: 7px;
        padding: 7px 10px; font-size: 13px; font-family: inherit;
        color: #141413; background: #fff; outline: none; resize: vertical;
        transition: border-color .15s, box-shadow .15s; box-sizing: border-box;
      }
      .le-field input:focus,
      .le-field textarea:focus {
        border-color: #F93B7A; box-shadow: 0 0 0 3px rgba(249,59,122,.1);
      }
      .le-field textarea { min-height: 68px; }

      /* List items */
      .le-list-items { display: flex; flex-direction: column; gap: 8px; }
      .le-item {
        display: flex; align-items: flex-start; gap: 6px;
        background: #FAFAF9; border: 1px solid #EBEBE8;
        border-radius: 8px; padding: 10px;
      }
      .le-item-num {
        font-size: 10px; font-weight: 700; color: #9D9D99;
        width: 16px; flex-shrink: 0; padding-top: 8px; text-align: right;
      }
      .le-item-fields { flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
      .le-del {
        width: 24px; height: 24px; border-radius: 5px; background: transparent;
        border: none; color: #9D9D99; cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: background .15s, color .15s; margin-top: 4px;
      }
      .le-del:hover { background: #FFF4F5; color: #D22C3C; }
      .le-add {
        width: 100%; padding: 7px; border: 1.5px dashed #EBEBE8;
        border-radius: 8px; background: transparent; color: #9D9D99;
        font-size: 12px; font-weight: 600; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 5px;
        transition: border-color .15s, color .15s;
      }
      .le-add:hover { border-color: #F93B7A; color: #F93B7A; }
      .le-empty-panel { color: #9D9D99; font-size: 13px; padding: 4px 0; }

      /* ── Toast notification ── */
      #le-toast {
        position: fixed; bottom: 24px; left: 50%;
        transform: translateX(-50%) translateY(16px);
        background: #141413; color: #F5F5F3;
        padding: 10px 20px; border-radius: 99px;
        font-size: 13px; font-weight: 500;
        font-family: Inter, system-ui, sans-serif;
        opacity: 0; transition: opacity .2s, transform .2s;
        z-index: 999999; pointer-events: none; white-space: nowrap;
      }
      #le-toast.le-show { opacity: 1; transform: translateX(-50%) translateY(0); }
      #le-toast.le-error { background: #D22C3C; }
    `;
    document.head.appendChild(el);
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────
  function injectToolbar() {
    const el = document.createElement('div');
    el.id = 'le-toolbar';
    el.innerHTML = `
      <div class="le-brand">
        <span class="le-dot"></span>
        Режим редактирования
      </div>
      <button class="le-seo-btn" id="le-seo-btn">🔍 SEO</button>
      <button class="le-seo-btn" id="le-brand-btn">🎨 Бренд</button>
      <div class="le-spacer"></div>
      <div class="le-dirty" id="le-dirty">Есть изменения</div>
      <button class="le-save-btn" id="le-save-btn">Сохранить</button>
      <button class="le-exit-btn" id="le-exit-btn">✕ Выйти</button>
    `;
    document.body.prepend(el);
    document.body.classList.add('le-active');

    el.querySelector('#le-seo-btn').addEventListener('click', () => openPanel('meta'));
    el.querySelector('#le-brand-btn').addEventListener('click', () => openPanel('brand'));
    el.querySelector('#le-save-btn').addEventListener('click', save);
    el.querySelector('#le-exit-btn').addEventListener('click', exit);
  }

  // ── Side panel ────────────────────────────────────────────────────────────
  function injectPanel() {
    const el = document.createElement('div');
    el.id = 'le-panel';
    el.innerHTML = `
      <div id="le-panel-head">
        <span class="le-ph-icon" id="le-ph-icon"></span>
        <span class="le-ph-title" id="le-ph-title">Секция</span>
        <label class="le-vis-label" id="le-vis-label">
          <input type="checkbox" id="le-vis-check"/> Видима
        </label>
        <button class="le-close" id="le-close-btn" aria-label="Закрыть панель">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div id="le-panel-body"></div>
    `;
    document.body.appendChild(el);

    el.querySelector('#le-close-btn').addEventListener('click', closePanel);
    el.querySelector('#le-vis-check').addEventListener('change', function () {
      if (!activeKey) return;
      config.sections ??= {};
      config.sections[activeKey] = this.checked;
      markDirty();
      schedulePreview();
    });

    // Close panel on Escape
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

    // Toast element
    const toast = document.createElement('div');
    toast.id = 'le-toast';
    document.body.appendChild(toast);
  }

  // ── Pencil overlays ───────────────────────────────────────────────────────
  // Adds pencil buttons to every [data-l-section] that has a section def.
  // Called on init and after each applyLandingConfig() call (some sections
  // rebuild their innerHTML, which would remove children we injected inside).
  // Pencils are appended to the section element itself, NOT inside rebuilt
  // child containers, so they survive most innerHTML replacements.
  function attachPencils() {
    SECTIONS.forEach(def => {
      if (def.noOverlay) return;

      const section = document.querySelector(`[data-l-section="${def.key}"]`);
      if (!section) return;

      section.classList.add('le-wrap');

      // Remove stale pencil if present (e.g. after re-render)
      section.querySelector('.le-pencil')?.remove();

      const btn = document.createElement('button');
      btn.className = 'le-pencil' + (activeKey === def.key ? ' le-active' : '');
      btn.setAttribute('aria-label', `Редактировать: ${def.title}`);
      btn.dataset.leKey = def.key;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>`;
      btn.addEventListener('click', () => openPanel(def.key));
      section.appendChild(btn);
    });
  }

  // ── Panel: open / close ───────────────────────────────────────────────────
  function openPanel(key) {
    const def = sectionDef(key);
    if (!def) return;

    activeKey = key;

    // Update pencil active states
    document.querySelectorAll('.le-pencil').forEach(btn => {
      btn.classList.toggle('le-active', btn.dataset.leKey === key);
    });
    document.querySelectorAll('.le-wrap').forEach(el => {
      el.classList.toggle('le-active-wrap', el.dataset.lSection === key);
    });

    // Panel header
    document.getElementById('le-ph-icon').textContent = def.icon ?? '✏️';
    document.getElementById('le-ph-title').textContent = def.title;

    // Visibility toggle (hidden for meta — it has no page section)
    const visLabel = document.getElementById('le-vis-label');
    const visCheck = document.getElementById('le-vis-check');
    if (def.noOverlay) {
      visLabel.style.display = 'none';
    } else {
      visLabel.style.display = '';
      visCheck.checked = (config.sections?.[key]) !== false;
    }

    // Render form fields
    document.getElementById('le-panel-body').innerHTML = buildPanelHTML(def);

    // Open the panel
    document.getElementById('le-panel').classList.add('le-open');

    // Scroll the section into view
    document.querySelector(`[data-l-section="${key}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closePanel() {
    activeKey = null;
    document.getElementById('le-panel')?.classList.remove('le-open');
    document.querySelectorAll('.le-pencil').forEach(b => b.classList.remove('le-active'));
    document.querySelectorAll('.le-wrap').forEach(el => el.classList.remove('le-active-wrap'));
  }

  // ── Panel HTML builders ───────────────────────────────────────────────────
  function buildPanelHTML(def) {
    const parts = [];

    if (def.fields?.length) {
      const rows = def.fields.map(([path, label, type]) => fieldHTML(path, label, type)).join('');
      parts.push(`<div class="le-group">
        <div class="le-group-label">Настройки</div>
        ${rows}
      </div>`);
    }

    (def.lists ?? []).forEach(list => {
      parts.push(list.type === 'text' ? textListHTML(list) : objectListHTML(list));
    });

    return parts.length
      ? parts.join('')
      : '<div class="le-empty-panel">Нет текстовых полей. Используйте переключатель видимости выше.</div>';
  }

  function fieldHTML(path, label, type = 'text') {
    const value = esc(deepGet(config, path) ?? '');
    const attrs = `data-path="${esc(path)}"`;

    if (type === 'textarea') {
      return `<div class="le-field">
        <label>${esc(label)}</label>
        <textarea ${attrs}>${value}</textarea>
      </div>`;
    }

    if (type === 'color') {
      const hex = value || '#F93B7A';
      return `<div class="le-field">
        <label>${esc(label)}</label>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="color" value="${hex}" ${attrs}
                 style="width:40px;height:32px;padding:2px;border:1.5px solid #EBEBE8;border-radius:6px;cursor:pointer;flex-shrink:0;"/>
          <code class="le-color-hex" style="font-size:12px;color:#6B6B68;font-family:monospace;">${hex}</code>
        </div>
      </div>`;
    }

    if (type === 'image') {
      return `<div class="le-field">
        <label>${esc(label)}</label>
        <input type="text" value="${value}" ${attrs} placeholder="https://..."/>
        ${value ? `<img src="${value}" alt="" style="max-width:100%;height:72px;object-fit:cover;border-radius:6px;margin-top:4px;border:1px solid #EBEBE8;" onerror="this.style.display='none'">` : ''}
      </div>`;
    }

    return `<div class="le-field">
      <label>${esc(label)}</label>
      <input type="text" value="${value}" ${attrs}/>
    </div>`;
  }

  function textListHTML(list) {
    const items = deepGet(config, list.path) ?? [];
    const rows = items.map((item, i) => `
      <div class="le-item">
        <span class="le-item-num">${i + 1}</span>
        <div class="le-item-fields">
          <div class="le-field">
            <input type="text" value="${esc(item)}"
              data-list="${esc(list.path)}" data-idx="${i}"/>
          </div>
        </div>
        <button class="le-del" data-del-list="${esc(list.path)}" data-del-idx="${i}" aria-label="Удалить">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`).join('');

    return `<div class="le-group" data-list-group="${esc(list.path)}">
      <div class="le-group-label">${esc(list.title)}</div>
      <div class="le-list-items">${rows}</div>
      <button class="le-add" data-add-list="${esc(list.path)}" data-add-type="text">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Добавить
      </button>
    </div>`;
  }

  function objectListHTML(list) {
    const items = deepGet(config, list.path) ?? [];
    const rows = items.map((item, i) => {
      const fieldRows = list.fields.map(([key, label, type = 'text']) => {
        const rawVal = type === 'lines' && Array.isArray(item[key])
          ? item[key].join('\n')
          : (item[key] ?? '');
        const val = esc(rawVal);
        const attrs = `data-list="${esc(list.path)}" data-idx="${i}" data-field="${esc(key)}" data-type="${esc(type)}"`;
        if (type === 'textarea' || type === 'lines') {
          return `<div class="le-field"><label>${esc(label)}</label><textarea ${attrs}>${val}</textarea></div>`;
        }
        if (type === 'image') {
          return `<div class="le-field"><label>${esc(label)}</label>
            <input type="text" value="${val}" ${attrs} placeholder="https://..."/>
            ${val ? `<img src="${val}" alt="" style="max-width:100%;height:60px;object-fit:cover;border-radius:6px;margin-top:4px;border:1px solid #EBEBE8;" onerror="this.style.display='none'">` : ''}
          </div>`;
        }
        return `<div class="le-field"><label>${esc(label)}</label><input type="text" value="${val}" ${attrs}/></div>`;
      }).join('');

      return `<div class="le-item">
        <span class="le-item-num">${i + 1}</span>
        <div class="le-item-fields">${fieldRows}</div>
        <button class="le-del" data-del-list="${esc(list.path)}" data-del-idx="${i}" aria-label="Удалить">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
    }).join('');

    return `<div class="le-group" data-list-group="${esc(list.path)}">
      <div class="le-group-label">${esc(list.title)}</div>
      <div class="le-list-items">${rows}</div>
      <button class="le-add" data-add-list="${esc(list.path)}" data-add-type="object">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Добавить
      </button>
    </div>`;
  }

  // ── Event delegation for panel inputs ─────────────────────────────────────
  // Single listener on #le-panel-body handles all field changes, list ops.
  // This survives panel re-renders because we re-bind after innerHTML updates.
  function bindPanelEvents() {
    const body = document.getElementById('le-panel-body');
    if (!body) return;

    body.addEventListener('input', e => {
      const el = e.target;

      // Simple field (text / textarea / color / image) identified by data-path
      if (el.dataset.path) {
        deepSet(config, el.dataset.path, el.value);
        // Sync hex label next to color picker
        if (el.type === 'color') {
          const hexEl = el.parentElement?.querySelector('.le-color-hex');
          if (hexEl) hexEl.textContent = el.value;
        }
        markDirty();
        schedulePreview();
        return;
      }

      // List text item  [data-list] [data-idx]
      if (el.dataset.list && el.dataset.idx !== undefined && !el.dataset.field) {
        const arr = deepGet(config, el.dataset.list) ?? [];
        arr[+el.dataset.idx] = el.value;
        deepSet(config, el.dataset.list, arr);
        markDirty();
        schedulePreview();
        return;
      }

      // Object list field  [data-list] [data-idx] [data-field] [data-type?]
      if (el.dataset.list && el.dataset.field) {
        const arr = deepGet(config, el.dataset.list) ?? [];
        arr[+el.dataset.idx] ??= {};
        arr[+el.dataset.idx][el.dataset.field] =
          el.dataset.type === 'lines'
            ? el.value.split('\n').filter(Boolean)
            : el.value;
        deepSet(config, el.dataset.list, arr);
        markDirty();
        schedulePreview();
      }
    });

    body.addEventListener('click', e => {
      const el = e.target.closest('[data-del-list]');
      const addEl = e.target.closest('[data-add-list]');

      if (el) {
        // Delete list item
        const path = el.dataset.delList;
        const idx  = +el.dataset.delIdx;
        const arr  = (deepGet(config, path) ?? []).filter((_, i) => i !== idx);
        deepSet(config, path, arr);
        markDirty();
        schedulePreview();
        refreshPanel(); // re-render to update item numbers
        return;
      }

      if (addEl) {
        // Add list item
        const path = addEl.dataset.addList;
        const type = addEl.dataset.addType;
        const arr  = deepGet(config, path) ?? [];
        if (type === 'text') {
          arr.push('');
        } else {
          // Build an empty object from the list def's fields
          const def      = sectionDef(activeKey);
          const listDef  = def?.lists?.find(l => l.path === path);
          const emptyObj = Object.fromEntries((listDef?.fields ?? []).map(([k]) => [k, '']));
          arr.push(emptyObj);
        }
        deepSet(config, path, arr);
        markDirty();
        schedulePreview();
        refreshPanel();
        // Scroll to bottom so user sees the new item
        setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
      }
    });
  }

  // Re-render the panel body for the current section (after add/delete).
  function refreshPanel() {
    const def = sectionDef(activeKey);
    if (!def) return;
    document.getElementById('le-panel-body').innerHTML = buildPanelHTML(def);
    bindPanelEvents();
  }

  // ── Live preview ──────────────────────────────────────────────────────────
  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      window.applyLandingConfig?.(config);
      // Re-attach pencils because some sections rebuild their innerHTML.
      attachPencils();
    }, 280);
  }

  // ── Dirty state ───────────────────────────────────────────────────────────
  function markDirty() {
    dirty = true;
    document.getElementById('le-dirty')?.classList.add('visible');
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg, isError = false) {
    const el = document.getElementById('le-toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.classList.toggle('le-error', isError);
    el.classList.add('le-show');
    toastTimer = setTimeout(() => el.classList.remove('le-show'), 2800);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    if (saveInProgress) return;
    saveInProgress = true;

    const btn = document.getElementById('le-save-btn');
    btn.disabled = true;
    btn.textContent = 'Сохранение...';

    try {
      const res = await fetch(ADMIN_API, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentJson: JSON.stringify(config) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      dirty = false;
      document.getElementById('le-dirty')?.classList.remove('visible');
      toast('Сохранено и опубликовано ✓');
    } catch (err) {
      toast('Ошибка: ' + (err.message ?? 'неизвестная'), true);
    } finally {
      saveInProgress = false;
      btn.disabled = false;
      btn.textContent = 'Сохранить';
    }
  }

  // ── Exit ──────────────────────────────────────────────────────────────────
  function exit() {
    if (dirty && !confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
    const url = new URL(location.href);
    url.searchParams.delete('edit');
    location.href = url.toString();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  async function init() {
    // Fetch config from admin API — doubles as an auth check.
    // If the request returns 401/403 or fails, we bail silently.
    const data = await fetch(ADMIN_API, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);

    if (!data) return; // not admin, or network error

    try { config = JSON.parse(data.contentJson || '{}'); } catch { config = {}; }

    injectCSS();
    injectToolbar();
    injectPanel();

    // Wait for DOMContentLoaded before touching the page.
    function onDOMReady() {
      attachPencils();
      bindPanelEvents();

      // Apply our (admin) config to the page immediately.
      // This also overrides whatever landing.js might apply later,
      // but landing.js checks window.__leEditMode and skips its fetch.
      window.applyLandingConfig?.(config);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDOMReady, { once: true });
    } else {
      onDOMReady();
    }
  }

  init();
})();
