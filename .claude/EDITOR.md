# ToiLink Editor — Мануал

## Файловая структура

### Редактор (`static/`)
| Файл | Роль |
|------|------|
| `editor.html` | Страница с двумя фазами: step1 (выбор шаблона) + editorOverlay (сам редактор) |
| `js/editor.js` | Главный контроллер: APP state, блочная навигация, preview-коммуникация, сохранение |
| `js/editor-utils.js` | Константы (SHEET_SNAP, CAT_LABEL), debounce, esc, normalizeHex, showToast |
| `js/editor-api.js` | HTTP-клиент: fetchTemplates(), fetchEvent(), saveEvent(), uploadPhoto() |
| `js/editor-fields.js` | Рендереры полей (floatInput, photo, palette, rows и т.д.) + post-render биндинги |
| `js/editor-picker.js` | UI выбора шаблона: renderTemplatePicker(), selectTemplate(), goToEditor() |
| `js/editor-sheet.js` | Drag-handle для bottom sheet, snap, visual viewport, exit flow |

### Шаблон (`static/templates/template-1/`)
| Файл | Роль |
|------|------|
| `index.html` | Страница приглашения; `data-section` / `data-content` / `data-img` атрибуты |
| `js/config.js` | `window.WEDDING_CONFIG` — единый объект данных шаблона |
| `js/bridge.js` | PostMessage-мост с редактором: applyEditorConfig() → fullRerender() |
| `js/renderer.js` | `WeddingRenderer` — читает WEDDING_CONFIG, заполняет DOM |
| `schema.json` | Декларативное описание блоков (типы, поля, дефолты) |

---

## Глобальный state (APP в editor.js)

```js
APP = {
  form: { title, person1, person2, eventDate, rsvpDeadline, language },
  blocks: {
    hero:      { coverPhoto, badge, subtitle, timer, music },
    greeting:  { enabled, title, text },
    calendar:  { enabled },
    gallery:   { photos[], style },
    timeline:  { enabled, events[] },       // events: [{time, title}]
    location:  { enabled, placeName, address, mapLink, photo },
    dresscode: { enabled, text, colors[] }, // colors: ['#HEX', ...]
    rsvp:      { enabled, heading, subtitle, submitButton },
  },
  schema: { blocks: [...blockDefs], sectionMap: {...} },
  ui: { editEventId, selectedTemplate, activeBlock, mode, dirty, savedSnapshot, ... }
}
```

Поля с `"scope": "form"` в schema.json хранятся в `APP.form`. Остальные — в `APP.blocks[blockType]`.

---

## Schema-driven система (schema.json)

Каждый блок:
- `type` — ключ (hero, greeting, calendar, gallery, timeline, location, dresscode, rsvp)
- `num` — номер 01–08 для навигации
- `required: true` | `toggleable: true` — обязательный или переключаемый
- `affectsPrice: true` — значок ₸ в навигации
- `sections[].fields[]` — массив полей

### Типы полей
| Тип | Поведение |
|-----|-----------|
| `text` | floatInput с floating label |
| `textarea` | floatTextarea + счётчик символов |
| `datetime-local` | floatInput type=datetime-local |
| `photo` | одно фото, upload → S3, возврат URL |
| `photos` | мультифото (до maxCount=10), drag-to-reorder |
| `toggle` | pswitch, для premium-фич блока |
| `select` | grid или inline кнопки (display: "grid" | default) |
| `color-palette` | N слотов + preset-цвета + HEX-ввод |
| `rows` | динамические строки с rowFields (timeline events и т.п.) |
| `info` | read-only инфо-карточка, не сохраняется |

---

## Поток данных: Редактор → Preview

```
Пользователь меняет поле
  → setFieldState(path, value)   // path = "blockType.key" или "key" (для form)
  → markDirty()
  → debouncedPreview() [200ms]
    → sendToPreview()
      → iframe.postMessage({ type: 'EDITOR_UPDATE', config: { form, blocks, sectionMap } })
        → bridge.js: applyEditorConfig(cfg)   // маппинг → WEDDING_CONFIG
          → fullRerender()                    // renderer + toggleSections()
```

### Маппинг в applyEditorConfig() (bridge.js)
```
form.person1           → WEDDING_CONFIG.couple.name1
form.person2           → WEDDING_CONFIG.couple.name2
form.eventDate         → WEDDING_CONFIG.couple.date + dateDisplay
blocks.hero.coverPhoto → WEDDING_CONFIG.images.heroBackground
blocks.hero.music      → WEDDING_CONFIG.music.enabled
blocks.greeting.*      → WEDDING_CONFIG.invitation.*
blocks.gallery.photos  → WEDDING_CONFIG.images.gallery
blocks.timeline.events → WEDDING_CONFIG.timeline.events
blocks.location.*      → WEDDING_CONFIG.location.*
blocks.dresscode.*     → WEDDING_CONFIG.dresscode.*
blocks.rsvp.*          → WEDDING_CONFIG.rsvp.*
```

## Поток данных: Preview → Редактор (клик по секции)

```
Клик в iframe по [data-section]
  → bridge.js: postMessage({ type: 'TEMPLATE_CLICK', block: blockType })
    → editor.js onPreviewMessage()
      → setMode('edit') + activateBlock(blockType)
```

---

## sectionMap: блок ↔ data-section

Определён в `schema.json` и передаётся с каждым EDITOR_UPDATE:

```json
{
  "hero":      "hero",
  "greeting":  "invitation",
  "calendar":  "calendar",
  "gallery":   "photoStack",
  "timeline":  "timeline",
  "location":  "location",
  "dresscode": "dresscode",
  "rsvp":      "rsvp"
}
```

Используется в двух местах:
- `scrollPreviewTo(blockType)` — скролл iframe к нужной секции
- `bridge.js` (reverse map) — клик в iframe → определение blockType

---

## Bottom Sheet

Snap-точки (в dvh), константы в `editor-utils.js`:
```js
SHEET_SNAP = { collapsed: 14, half: 52, full: 90 }
```

- `collapsed (14)` → preview-режим, panel скрыт (`visibility: hidden`)
- `half (52)` → дефолт при открытии редактора
- `full (90)` → развёрнутый редактор

Если снапнулся на collapsed → автоматически `setMode('preview')`.

---

## Блочная навигация

`renderBlockNav()` — горизонтальный скроллируемый ряд кнопок 01–08.

Точка-индикатор у каждого блока:
- зелёная → блок заполнен (есть значение в любом поле)
- жёлтая → блок пуст
- серая → disabled (toggleable, выключен)
- `₸` → affectsPrice

`activateBlock(type)`:
1. `renderBlockNav()` — перерисовывает навигацию
2. `renderPanel(type)` — рендерит поля активного блока
3. `scrollPreviewTo(type)` — скроллит preview к секции

`renderPanel(type)` читает blockDef из `APP.schema`, рендерит секции через `renderField()`, затем `bindAllPhotoUploads()`.

---

## Сохранение (handleSave)

**Валидация:** нужно хотя бы одно из person1/person2 + обязательно eventDate.

**Payload** для POST/PUT `/api/organizer/events[/{id}]`:
```json
{
  "title":         "авто: person1 & person2 если пусто",
  "person1":       "...",
  "person2":       "...",
  "eventDate":     "...",
  "rsvpDeadline":  "...",
  "language":      "ru",
  "coverImageUrl": "blocks.hero.coverPhoto",
  "blocksConfig":  "JSON.stringify(APP.blocks)",
  "templateId":    "(только при создании)"
}
```

Header: `X-User-Phone: <phone>` из `localStorage.tl_phone`.

После создания: URL обновляется до `?id=N` без перезагрузки (`history.replaceState`).

---

## Загрузка события (editEventId)

URL `?id=N` → `fetchEvent()` → `populateFromEvent()`:
- `ev.blocksConfig` (JSON строка) парсится → мержится в `APP.blocks`
- Legacy-маппинги (для старых событий):
  - `hero.photoUrl` → `hero.coverPhoto`
  - `timeline.items` (строка с `\n`) → `timeline.events[]`
  - `dresscode.palette` (CSV строка) → `dresscode.colors[]`

При смене шаблона: `migrateBlocks()` переносит совпадающие по ключам поля в новую схему.

---

## Публичная страница `/e/{slug}`

`EventPageController.java` роутит по `templatePath`:
- `template-1` → Thymeleaf-вью `event-wedding`
- `template-2` → Thymeleaf-вью `event-minimal`

В Thymeleaf-модель передаётся:
- `eventBlocksConfig` — JSON строка с blocksConfig
- `eventPerson1`, `eventPerson2`, `eventDate`, `eventSlug`
- OG-теги: `ogImage`, `ogDescription`, `ogUrl`

Thymeleaf-шаблон инжектирует данные в inline-скрипт → перезаписывает `WEDDING_CONFIG` → renderer рендерит страницу.

---

## WeddingRenderer (template-1/js/renderer.js)

```js
renderer.applyTheme()         // CSS-переменные из WEDDING_CONFIG.theme.colors
renderer.fillContent()        // [data-content="couple.name1"] → значение из config
renderer.setImages()          // [data-img="heroBackground"] → src / backgroundImage
renderer.setLinks()           // [data-link="location.mapLink"] → href
renderer.renderInvitation()   // секция invitation
renderer.renderPhotoStack()   // секция photoStack — gallery[]
renderer.renderCalendar()     // секция calendar
renderer.renderTimeline()     // секция timeline — events[]
renderer.renderDresscode()    // секция dresscode — colors[]
renderer.renderRSVP()         // секция rsvp — тексты
```

**В preview-режиме** (`?mode=preview` в URL iframe):
- `bridge.js` подключается и отключает: envelope, анимации, security, parallax
- `toggleSections()` использует `display: none` вместо `.remove()` — чтобы элементы можно было вернуть
- Клики по секциям → TEMPLATE_CLICK в родительский редактор

---

## API endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/organizer/templates` | GET | Список шаблонов |
| `/api/organizer/events` | POST | Создать событие |
| `/api/organizer/events/{id}` | GET | Получить событие |
| `/api/organizer/events/{id}` | PUT | Обновить событие |
| `/api/organizer/upload` | POST (multipart) | Загрузить фото → `{url}` |
| `/e/{slug}` | GET | Публичная страница (Thymeleaf) |

---

## 8 блоков template-1

| # | type | required/toggleable | Поля |
|---|------|--------------------|----|
| 01 | `hero` | required | person1\*, person2\*, title\*, eventDate\*, rsvpDeadline\*, badge, subtitle, coverPhoto, timer(toggle), music(toggle) |
| 02 | `greeting` | toggleable | title, text |
| 03 | `calendar` | toggleable + affectsPrice | только info (дата из form) |
| 04 | `gallery` | required | style(select), photos[] |
| 05 | `timeline` | toggleable | events[]: {time, title} |
| 06 | `location` | toggleable | placeName, address, mapLink, photo |
| 07 | `dresscode` | toggleable | text, colors[] (5 слотов) |
| 08 | `rsvp` | toggleable | heading, subtitle, submitButton |

\* — `scope: "form"`, хранятся в `APP.form`, не в `APP.blocks`
