# ToiLink — Style Audit & Fix Report (2026-05-06)

---

## ✅ Что исправлено (сделано сегодня)

### Критические баги
| # | Файл | Проблема | Исправление |
|---|---|---|---|
| 1 | `editor.html:246` | `font-semibold;` — Tailwind класс написан как CSS-свойство (не работает) | → `font-weight: 600;` |
| 2 | `index.html` | `paymentStrip` имел `display:none` дважды в одном атрибуте | Убрано дублирование |
| 3 | `index.html` | `.text-sage { color: #F93B7A !important }` — sage переопределён как розовый | → `.text-accent { color: #F93B7A }`, HTML исправлен |

### Мёртвый код
| # | Файл | До | После |
|---|---|---|---|
| 4 | `dashboard.html` | 1129 строк CSS+HTML (редирект на `/` первой строкой) | 9 строк — чистый редирект |

### Шрифты (производительность)
| # | Файл | Убрано | Осталось |
|---|---|---|---|
| 5 | `landing.html` | Great Vibes, Italiana, Pinyon Script, Montserrat (4 лишних семьи) | Cormorant Garamond + Inter |
| 6 | `landing.html` | Cormorant Garamond импортировался дважды | Один чистый импорт |
| 7 | `video-editor.html` | Montserrat (не использовался) | Cormorant Garamond + Inter |
| 8 | `editor.html` | Только 400 regular Cormorant | Добавлены 600 semibold весы |

### Meta / SEO
| # | Файл | До | После |
|---|---|---|---|
| 9 | `landing.html` | Нет `theme-color` | Добавлен `#ffffff` |
| 10 | `index.html` | `theme-color: #FAFAF8` (не совпадало с реальным фоном) | → `#FFF8FB` (совпадает) |
| 11 | `editor.html` | `theme-color: #F2F2F7` (iOS gray, никак не связан с дизайном) | → `#FAFAF8` |

### Дизайн-система — подключена везде
До этого tokens.css + base.css не были подключены **ни на одной странице**.

| Страница | tokens.css | base.css | app-shell.css |
|---|---|---|---|
| `index.html` | ✅ добавлен | ✅ добавлен | ✅ был |
| `guests.html` | ✅ добавлен | ✅ добавлен | ✅ был |
| `editor.html` | ✅ добавлен | ✅ добавлен | ✅ был |
| `wizard.html` | ✅ добавлен | ✅ добавлен | — |
| `paywall.html` | ✅ добавлен | ✅ добавлен | — |
| `templates.html` | ✅ добавлен | ✅ добавлен | — |
| `video-editor.html` | ✅ добавлен | ✅ добавлен | — |

### CSS reset — убраны дубли
Каждая страница повторяла одни и те же 3 строки reset (`box-sizing`, scrollbar, tap-highlight). Теперь это в `base.css` — убрано из: `index.html`, `guests.html`, `editor.html`, `wizard.html`, `paywall.html`, `templates.html`, `video-editor.html`.

### tokens.css — переписан под реальный дизайн
Старый `tokens.css` определял Fraunces + pressed olive (#5C5B3F) — нигде не использовалось.
Новый токены:
- Шрифты: Cormorant Garamond + Inter (как во всех app-страницах)
- Акцент: `--color-accent: #F93B7A` (розовый, как в реальном коде)
- Фон: `--color-bg: #FFF8FB` (как в index.html)
- Sage: `--color-sage: #3D6B45` (для guests, editor)
- Полная z-index шкала (50→60→70→80→90)

### base.css — дополнен
Добавлены `-webkit-tap-highlight-color: transparent` и скрытие scrollbar — теперь base.css покрывает весь стандартный reset.

### app-shell.css — использует токены
`background: #FAFAF8` (хардкод) → `background: var(--color-bg, #FAFAF8)`.

### Z-index — согласован
`bs-backdrop` в `index.html` и `guests.html`: `z-index: 59` → `50` (совпадает с `--z-sheet-backdrop: 50` в tokens).

---

## ⚠️ Что НЕ исправлено (требует решения)

### 1. Два разных serif-шрифта в одном проекте
- `index.html`, `guests.html`, `editor.html`, `templates.html`, `video-editor.html` — **Cormorant Garamond**
- `wizard.html`, `paywall.html` — **Fraunces**

**Что делать:** Выбрать один. Рекомендация — Cormorant Garamond (большинство страниц). Wizard/paywall переключить в Cormorant. Потребует замены font-family в их `<style>` и обновления Google Fonts импорта.

### 2. Tailwind CDN в продакшне (5 страниц)
- `index.html`, `guests.html`, `editor.html`, `landing.html`, `video-editor.html`
- **Проблема:** Tailwind CDN = ~350KB JS, не purged. Медленная загрузка.
- **Что делать:** Либо перейти на Tailwind CLI с purge, либо заменить tailwind-классы на utility-классы из base.css. Это большой рефакторинг — нужна отдельная задача.

### 3. Кнопки: 4 разных реализации `.btn-primary`
| Страница | Стиль |
|---|---|
| `index.html` | Розовый градиент (#F93B7A→#FF6D45) |
| `guests.html` | Тёмный (#1E2820) |
| `landing.html` | `.btn-pink` (розовый) |
| `components.css` | Тёмный → olive hover |

`components.css` содержит правильные компоненты, но ни одна страница его не подключает.
**Что делать:** Подключить `components.css` к app-страницам + убрать дублирующие определения кнопок.

### 4. Нижняя навигация: 3 реализации
- `index.html`/`guests.html`: `.nav-bar / .nav-item`
- `components.css`: `.bottom-nav / .bottom-nav-item`
- Разные цвета, разная структура.
**Что делать:** Подключить `components.css`, убрать inline nav CSS.

### 5. Цвет фона: index vs guests
- `index.html`: `#FFF8FB` (тёплый розово-белый) + pink radial glow
- `guests.html`: `#FAFAF8` (нейтральный кремовый)
- **Вопрос дизайна:** должны быть одинаковы? Рекомендация — да, единый app-фон.

### 6. landing.html — 2020 строк
Самый большой файл. Нет отдельного CSS-файла. Тяжело поддерживать.
**Что делать:** Вынести стили в `/css/landing.css`. Это низкий приоритет пока работает.

### 7. editor.html — фон #F2F2F7 (iOS серый)
Визуально отличается от всего остального. Сделано намеренно для ощущения "нативного" редактора.
Если хочется единообразия — поменять на #FAFAF8 или #FFF8FB.

---

## 📊 Итог по страницам

| Страница | До | После |
|---|---|---|
| `landing.html` | 6 шрифтов, нет theme-color | 2 шрифта, theme-color ✅ |
| `index.html` | 3 бага, дубли reset, мёртвый text-sage | Всё исправлено |
| `guests.html` | Дубли, z-index 59 | Чисто, z-index 50 |
| `editor.html` | Синт. ошибка, iOS theme-color, узкий font import | Всё исправлено |
| `dashboard.html` | 1129 строк мёртвого кода | 9 строк |
| `templates.html` | Только свой CSS | + tokens + base |
| `wizard.html` | Только свой CSS | + tokens + base |
| `paywall.html` | Только свой CSS | + tokens + base |
| `video-editor.html` | Montserrat, дубли | Чисто |
| `css/tokens.css` | Fraunces + olive (нигде не использовались) | Реальная палитра |
| `css/base.css` | Нет scrollbar/tap reset | Полный reset |
| `css/app-shell.css` | Хардкод цвет | var(--color-bg) |
