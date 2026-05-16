'use strict';

// ── Wizard config registry ─────────────────────────────────────
// Each category defines its own steps.
// Field types: text | date | time | photo | toggle | style-picker

const WIZARD_CONFIGS = {

  WEDDING: {
    label: 'Свадьба',
    steps: [
      {
        id: 'names',
        eyebrow: 'Имена',
        title: 'Как зовут\n<em>молодожёнов?</em>',
        hint: 'Имена появятся на обложке приглашения',
        fields: [
          { id: 'person1', type: 'text', label: 'Имя жениха',  required: true, autocomplete: 'given-name', maxlength: 40 },
          { id: 'person2', type: 'text', label: 'Имя невесты', autocomplete: 'given-name', maxlength: 40 },
        ]
      },
      {
        id: 'datetime',
        eyebrow: 'Дата и место',
        title: 'Когда и\n<em>где?</em>',
        hint: 'Данные появятся на сайте и в календарях гостей',
        fields: [
          { id: 'eventDate',    type: 'date', label: 'Дата свадьбы' },
          { id: 'eventTime',    type: 'time', label: 'Время начала' },
          { id: 'venueName',    type: 'text', label: 'Название зала', maxlength: 80 },
          { id: 'venueAddress', type: 'text', label: 'Адрес (необязательно)', maxlength: 120 },
        ]
      },
      {
        id: 'greeting',
        eyebrow: 'Приветствие',
        title: 'Текст\n<em>приглашения</em>',
        hint: 'Тёплые слова для ваших гостей — можно изменить позже',
        skippable: true,
        fields: [
          { id: 'greetingText', type: 'textarea', label: 'Ваш текст', placeholder: 'Дорогие гости, с радостью приглашаем вас разделить этот особенный день с нами…', maxlength: 400 },
        ]
      },
      {
        id: 'extras',
        eyebrow: 'Настройки',
        title: 'Что включим\n<em>на сайте?</em>',
        hint: 'Всё это можно изменить в редакторе',
        skippable: true,
        fields: [
          { id: 'timeline',  type: 'toggle', label: 'Программа дня',            hint: 'Тайминг с временем',                 default: true  },
          { id: 'dresscode', type: 'toggle', label: 'Дресс-код',                hint: 'Цвета и пожелания по стилю',         default: true  },
          { id: 'timer',     type: 'toggle', label: 'Таймер обратного отсчёта', hint: 'Отсчёт до начала события',           premium: true  },
          { id: 'music',     type: 'toggle', label: 'Фоновая музыка',           hint: 'Авто-воспроизведение при открытии',  premium: true  },
        ]
      },
      {
        id: 'photo',
        eyebrow: 'Фото',
        title: 'Добавьте\n<em>фото</em>',
        hint: 'Фото на обложке — можно добавить позже',
        skippable: true,
        fields: [
          { id: 'coverPhoto', type: 'photo' }
        ]
      }
    ]
  },

  TOI: {
    label: 'Той',
    steps: [
      {
        id: 'names',
        eyebrow: 'Мероприятие',
        title: 'Кто\n<em>герой праздника?</em>',
        hint: 'Имя появится на обложке приглашения',
        fields: [
          { id: 'person1', type: 'text', label: 'Герой праздника',             required: true, maxlength: 40 },
          { id: 'person2', type: 'text', label: 'Второе имя (необязательно)',  maxlength: 40 },
        ]
      },
      {
        id: 'datetime',
        eyebrow: 'Дата и место',
        title: 'Когда и\n<em>где?</em>',
        hint: 'Данные появятся на сайте и в календарях гостей',
        fields: [
          { id: 'eventDate',    type: 'date', label: 'Дата мероприятия' },
          { id: 'eventTime',    type: 'time', label: 'Время начала' },
          { id: 'venueName',    type: 'text', label: 'Название зала', maxlength: 80 },
          { id: 'venueAddress', type: 'text', label: 'Адрес (необязательно)', maxlength: 120 },
        ]
      },
      {
        id: 'greeting',
        eyebrow: 'Приветствие',
        title: 'Текст\n<em>приглашения</em>',
        hint: 'Тёплые слова для ваших гостей',
        skippable: true,
        fields: [
          { id: 'greetingText', type: 'textarea', label: 'Ваш текст', placeholder: 'Дорогие гости, приглашаем вас на торжество…', maxlength: 400 },
        ]
      },
      {
        id: 'extras',
        eyebrow: 'Настройки',
        title: 'Что включим\n<em>на сайте?</em>',
        hint: 'Всё это можно изменить в редакторе',
        skippable: true,
        fields: [
          { id: 'timeline',  type: 'toggle', label: 'Программа дня',            hint: 'Тайминг с временем',          default: true  },
          { id: 'dresscode', type: 'toggle', label: 'Дресс-код',                hint: 'Цвета и пожелания по стилю',  default: false },
          { id: 'timer',     type: 'toggle', label: 'Таймер обратного отсчёта', hint: 'Отсчёт до начала события',    premium: true  },
        ]
      },
      {
        id: 'photo',
        eyebrow: 'Фото',
        title: 'Добавьте\n<em>фото</em>',
        hint: 'Фото на обложке — можно добавить позже',
        skippable: true,
        fields: [
          { id: 'coverPhoto', type: 'photo' }
        ]
      }
    ]
  },

  BIRTHDAY: {
    label: 'День рождения',
    steps: [
      {
        id: 'names',
        eyebrow: 'Именинник',
        title: 'Кто\n<em>именинник?</em>',
        hint: 'Имя появится на обложке приглашения',
        fields: [
          { id: 'person1', type: 'text', label: 'Имя именинника', required: true, maxlength: 40 },
        ]
      },
      {
        id: 'datetime',
        eyebrow: 'Дата и место',
        title: 'Когда и\n<em>где?</em>',
        hint: 'Данные появятся на сайте и в календарях гостей',
        fields: [
          { id: 'eventDate',    type: 'date', label: 'Дата праздника' },
          { id: 'eventTime',    type: 'time', label: 'Время начала' },
          { id: 'venueName',    type: 'text', label: 'Название места', maxlength: 80 },
          { id: 'venueAddress', type: 'text', label: 'Адрес (необязательно)', maxlength: 120 },
        ]
      },
      {
        id: 'photo',
        eyebrow: 'Фото',
        title: 'Добавьте\n<em>фото</em>',
        hint: 'Фото на обложке — можно добавить позже',
        skippable: true,
        fields: [
          { id: 'coverPhoto', type: 'photo' }
        ]
      }
    ]
  },

  BABY: {
    label: 'Бешик Той',
    steps: [
      {
        id: 'names',
        eyebrow: 'Малыш',
        title: 'Как зовут\n<em>малыша?</em>',
        hint: 'Имя появится на обложке приглашения',
        fields: [
          { id: 'person1', type: 'text', label: 'Имя ребёнка',                   required: true, maxlength: 40 },
          { id: 'person2', type: 'text', label: 'Имена родителей (необязательно)', maxlength: 40 },
        ]
      },
      {
        id: 'datetime',
        eyebrow: 'Дата и место',
        title: 'Когда и\n<em>где?</em>',
        hint: 'Данные появятся на сайте и в календарях гостей',
        fields: [
          { id: 'eventDate',    type: 'date', label: 'Дата праздника' },
          { id: 'eventTime',    type: 'time', label: 'Время начала' },
          { id: 'venueName',    type: 'text', label: 'Название зала', maxlength: 80 },
          { id: 'venueAddress', type: 'text', label: 'Адрес (необязательно)', maxlength: 120 },
        ]
      },
      {
        id: 'photo',
        eyebrow: 'Фото малыша',
        title: 'Добавьте\n<em>фото</em>',
        hint: 'Фото малыша на обложке — можно добавить позже',
        skippable: true,
        fields: [
          { id: 'coverPhoto', type: 'photo' }
        ]
      }
    ]
  },

  VIDEO: {
    label: 'Видео-приглашение',
    steps: [
      {
        id: 'names',
        eyebrow: 'Имена',
        title: 'Как зовут\n<em>пару?</em>',
        hint: 'Имена появятся в видео',
        fields: [
          { id: 'person1', type: 'text', label: 'Имя первого', required: true, maxlength: 40 },
          { id: 'person2', type: 'text', label: 'Имя второго', maxlength: 40 },
        ]
      },
      {
        id: 'datetime',
        eyebrow: 'Дата',
        title: 'Когда\n<em>праздник?</em>',
        hint: 'Дата и место появятся в видео',
        fields: [
          { id: 'eventDate', type: 'date', label: 'Дата мероприятия' },
          { id: 'eventTime', type: 'time', label: 'Время начала' },
          { id: 'venueName', type: 'text', label: 'Место проведения (необязательно)', maxlength: 80 },
        ]
      },
      {
        id: 'style',
        eyebrow: 'Стиль видео',
        title: 'Выберите\n<em>настроение</em>',
        hint: 'Определяет оформление и цветовую гамму ролика',
        fields: [
          {
            id: 'videoStyle', type: 'style-picker',
            options: [
              { value: 'romantic', label: 'Романтичный', emoji: '🌸', desc: 'Нежные переходы'    },
              { value: 'elegant',  label: 'Элегантный',  emoji: '✨', desc: 'Чистый минимализм'  },
              { value: 'festive',  label: 'Праздничный', emoji: '🎉', desc: 'Яркий и живой'      },
              { value: 'classic',  label: 'Классический',emoji: '🕊️', desc: 'Вечная классика'   },
            ]
          }
        ]
      },
      {
        id: 'photo',
        eyebrow: 'Заставка',
        title: 'Добавьте\n<em>фото</em>',
        hint: 'Заставка видео — можно добавить позже',
        skippable: true,
        fields: [
          { id: 'coverPhoto', type: 'photo' }
        ]
      }
    ]
  }

};

// ── Picker templates ───────────────────────────────────────────
// Colored placeholder cards for the picker step (step 0).
// grad: CSS gradient string. No text inside cards.

const PICKER_TEMPLATES = [
  // SITE — WEDDING (4 карточки)
  { id: 1,  type: 'SITE', category: 'WEDDING',  grad: 'linear-gradient(160deg,#1B2E24 0%,#0D1A14 100%)', premium: false },
  { id: 2,  type: 'SITE', category: 'WEDDING',  grad: 'linear-gradient(160deg,#F7F0E8 0%,#EDE0CC 100%)', premium: false },
  { id: 3,  type: 'SITE', category: 'WEDDING',  grad: 'linear-gradient(160deg,#22103A 0%,#0E0520 100%)', premium: true  },
  { id: 4,  type: 'SITE', category: 'WEDDING',  grad: 'linear-gradient(160deg,#1E1E1E 0%,#2A2220 100%)', premium: false },
  // SITE — TOI (3 карточки)
  { id: 6,  type: 'SITE', category: 'TOI',      grad: 'linear-gradient(160deg,#172B1A 0%,#0E1E10 100%)', premium: false },
  { id: 7,  type: 'SITE', category: 'TOI',      grad: 'linear-gradient(160deg,#3C0E14 0%,#550F18 100%)', premium: true  },
  { id: 11, type: 'SITE', category: 'TOI',      grad: 'linear-gradient(160deg,#2A1A08 0%,#1A0E00 100%)', premium: false },
  // SITE — BIRTHDAY (3 карточки)
  { id: 5,  type: 'SITE', category: 'BIRTHDAY', grad: 'linear-gradient(160deg,#FFF0F3 0%,#FCDCE6 100%)', premium: false },
  { id: 12, type: 'SITE', category: 'BIRTHDAY', grad: 'linear-gradient(160deg,#F3F0FF 0%,#E8E0FF 100%)', premium: false },
  { id: 13, type: 'SITE', category: 'BIRTHDAY', grad: 'linear-gradient(160deg,#FFF8E8 0%,#F5E8C8 100%)', premium: true  },
  // SITE — BABY (2 карточки)
  { id: 8,  type: 'SITE', category: 'BABY',     grad: 'linear-gradient(160deg,#F8EFE2 0%,#EDE0CA 100%)', premium: false },
  { id: 10, type: 'SITE', category: 'BABY',     grad: 'linear-gradient(160deg,#E8F5F8 0%,#D0EAF0 100%)', premium: false },
  // VIDEO — WEDDING (3 карточки)
  { id: 101, type: 'VIDEO', category: 'WEDDING',  grad: 'linear-gradient(160deg,#080808 0%,#1A0812 100%)', premium: false },
  { id: 102, type: 'VIDEO', category: 'WEDDING',  grad: 'linear-gradient(160deg,#0C0A00 0%,#1E1600 100%)', premium: true  },
  { id: 105, type: 'VIDEO', category: 'WEDDING',  grad: 'linear-gradient(160deg,#001014 0%,#001C22 100%)', premium: false },
  // VIDEO — BIRTHDAY (2 карточки)
  { id: 103, type: 'VIDEO', category: 'BIRTHDAY', grad: 'linear-gradient(160deg,#10000A 0%,#200010 100%)', premium: false },
  { id: 106, type: 'VIDEO', category: 'BIRTHDAY', grad: 'linear-gradient(160deg,#100008 0%,#1E0014 100%)', premium: false },
  // VIDEO — TOI (2 карточки)
  { id: 104, type: 'VIDEO', category: 'TOI',      grad: 'linear-gradient(160deg,#000A14 0%,#001020 100%)', premium: false },
  { id: 107, type: 'VIDEO', category: 'TOI',      grad: 'linear-gradient(160deg,#0C0800 0%,#1E1400 100%)', premium: false },
];

// ── Bridge ─────────────────────────────────────────────────────
// Reads localStorage to determine which config to use.

function getWizardConfig() {
  try {
    const raw = localStorage.getItem('tl_template_selection');
    if (raw) {
      const sel = JSON.parse(raw);
      const key = sel.type === 'VIDEO' ? 'VIDEO' : (sel.category || 'WEDDING');
      return WIZARD_CONFIGS[key] || WIZARD_CONFIGS.WEDDING;
    }
  } catch (_) {}
  return WIZARD_CONFIGS.WEDDING;
}
