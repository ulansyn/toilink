# ToiLink — MVP Development Plan

## 1. ЭТАПЫ

### MVP (делаем сейчас)
**Цель:** рабочий продукт локально — создать приглашение, получить ссылку, гость отвечает.

**Результат:**
- Организатор вводит данные события через форму → получает ссылку вида `/e/abc123`
- Гость открывает ссылку → видит красивую страницу → нажимает "Приду / Не приду"
- Организатор видит список гостей и их ответы
- OG preview работает в WhatsApp/Telegram
- Auth — заглушка (phone в header)

### После MVP (не трогаем сейчас)
- OTP авторизация (SMS)
- Загрузка фото
- Несколько шаблонов с редактором блоков
- Email/WhatsApp уведомления
- Планы и оплата (B2B потом)

---

## 2. ПОРЯДОК РАЗРАБОТКИ

### Делать в таком порядке:
1. БД (Liquibase миграции) → Entity → Repository
2. DTO + маппинг
3. Service слой
4. REST API (сначала Organizer, потом Public)
5. OG endpoint (серверный HTML)
6. Frontend (сначала публичная страница гостя, потом дашборд)

### Нельзя делать в начале:
- Spring Security (добавить позже, не блокирует MVP)
- Загрузку файлов/изображений
- Пагинацию
- Отправку SMS
- Платёжную систему

---

## 3. СТРУКТУРА BACKEND

```
kg.toilink
├── config/
│   └── WebConfig.java           # CORS, static resources
├── controller/
│   ├── organizer/
│   │   ├── EventController.java
│   │   ├── GuestController.java
│   │   └── TemplateController.java
│   └── pub/                     # public = зарезервировано в Java
│       ├── PublicEventController.java
│       └── RsvpController.java
├── service/
│   ├── EventService.java
│   ├── GuestService.java
│   ├── RsvpService.java
│   ├── TemplateService.java
│   └── SlugService.java
├── repository/
│   ├── EventRepository.java
│   ├── GuestRepository.java
│   ├── RsvpResponseRepository.java
│   ├── TemplateRepository.java
│   └── UserRepository.java
├── entity/
│   ├── Event.java
│   ├── Guest.java
│   ├── RsvpResponse.java
│   ├── Template.java
│   └── User.java
├── dto/
│   ├── request/
│   │   ├── CreateEventRequest.java
│   │   ├── UpdateEventRequest.java
│   │   └── RsvpRequest.java
│   └── response/
│       ├── EventResponse.java
│       ├── EventPublicResponse.java
│       ├── GuestResponse.java
│       └── TemplateResponse.java
├── exception/
│   ├── NotFoundException.java
│   └── GlobalExceptionHandler.java
└── util/
    └── SlugGenerator.java
```

---

## 4. СТРУКТУРА FRONTEND

```
src/main/resources/
├── static/
│   ├── js/
│   │   ├── api.js          # fetch-обёртка, BASE_URL
│   │   ├── dashboard.js    # список событий организатора
│   │   ├── editor.js       # форма создания/редактирования события
│   │   └── event.js        # публичная страница гостя
│   └── css/
│       └── (Tailwind через CDN в HTML)
└── templates/              # Thymeleaf только для OG-страницы
    └── event-og.html       # server-side render для OG meta tags
```

### Статические HTML (в static/):
- `index.html` — дашборд организатора (список событий)
- `editor.html` — создание/редактирование события
- `event.html` — публичная страница гостя (рендерится JS из API)

### Как работает рендер:
1. Гость открывает `/e/{slug}` → Spring отдаёт `event-og.html` (Thymeleaf) с OG тегами
2. В body — пустой `<div id="app">` + подключение `event.js`
3. `event.js` делает `GET /api/public/events/{slug}` → получает JSON → рендерит блоки вручную через DOM

---

## 5. БАЗА ДАННЫХ

### Таблицы

**users**
```sql
id          BIGSERIAL PRIMARY KEY
phone       VARCHAR(20) UNIQUE NOT NULL
name        VARCHAR(100)
role        VARCHAR(20) NOT NULL DEFAULT 'CLIENT'  -- CLIENT, ADMIN; будущее: BUSINESS, MANAGER
is_active   BOOLEAN NOT NULL DEFAULT TRUE
created_at  TIMESTAMP NOT NULL DEFAULT NOW()
updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
```

**templates**
```sql
id              BIGSERIAL PRIMARY KEY
name            VARCHAR(100) NOT NULL
description     TEXT
thumbnail_url   VARCHAR(500)
category        VARCHAR(50) NOT NULL DEFAULT 'OTHER'  -- WEDDING, BIRTHDAY, TOY, OTHER
blocks_schema   JSONB NOT NULL                         -- схема блоков шаблона
sort_order      INT NOT NULL DEFAULT 0                 -- порядок отображения
is_active       BOOLEAN NOT NULL DEFAULT TRUE
created_at      TIMESTAMP NOT NULL DEFAULT NOW()
updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
```

**events**
```sql
id               BIGSERIAL PRIMARY KEY
user_id          BIGINT REFERENCES users(id)
template_id      BIGINT REFERENCES templates(id)
title            VARCHAR(200) NOT NULL
event_date       TIMESTAMP
location         VARCHAR(500)
cover_image_url  VARCHAR(500)                           -- топ-уровень для OG, не копать в JSONB
slug             VARCHAR(50) UNIQUE NOT NULL
status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT'   -- DRAFT, PUBLISHED, CLOSED
rsvp_deadline    TIMESTAMP                              -- после этой даты RSVP закрыто
language         VARCHAR(10) NOT NULL DEFAULT 'ru'      -- ru, ky, en
blocks_config    JSONB                                  -- заполненные данные блоков
created_at       TIMESTAMP NOT NULL DEFAULT NOW()
updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
```

**guests**
```sql
id          BIGSERIAL PRIMARY KEY
event_id    BIGINT REFERENCES events(id) ON DELETE CASCADE
name        VARCHAR(100)
phone       VARCHAR(20)
notes       TEXT                                        -- заметки организатора о госте
token       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid()
created_at  TIMESTAMP NOT NULL DEFAULT NOW()
```

**rsvp_responses**
```sql
id              BIGSERIAL PRIMARY KEY
guest_id        BIGINT REFERENCES guests(id)
event_id        BIGINT REFERENCES events(id)
status          VARCHAR(20) NOT NULL    -- ATTENDING, DECLINED, MAYBE
group_size      INT NOT NULL DEFAULT 1  -- сколько человек придёт (критично для тоев)
comment         TEXT
responded_at    TIMESTAMP NOT NULL DEFAULT NOW()
updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
UNIQUE (guest_id, event_id)
```

### JSONB — blocks_config

**Зачем:** каждый шаблон имеет свой набор настраиваемых блоков. Хранить их как колонки — нереально (у каждого шаблона разные поля). JSONB даёт гибкость без лишних таблиц на MVP.

**blocks_schema** в `templates` — описывает что есть в шаблоне:
```json
[
  { "type": "hero",      "label": "Главный экран", "fields": ["title", "subtitle", "image_url"] },
  { "type": "countdown", "label": "Обратный отсчёт", "fields": ["date"] },
  { "type": "location",  "label": "Место",          "fields": ["address", "map_url"] }
]
```

**blocks_config** в `events` — реальные данные конкретного события:
```json
{
  "hero":      { "title": "Свадьба Айны и Марата", "subtitle": "Приглашаем вас!", "image_url": "" },
  "countdown": { "date": "2024-09-01T14:00:00" },
  "location":  { "address": "Бишкек, ресторан Арашан", "map_url": "https://2gis.kg/..." }
}
```

Frontend читает `blocks_schema` → знает какие блоки рендерить → берёт данные из `blocks_config`.

---

## 6. API

### Organizer API (`/api/organizer/...`)
Заглушка auth: `X-User-Phone: +996700000000` в header.

| Метод  | URL                                | Body / Params                  | Ответ                    |
|--------|-------------------------------------|-------------------------------|--------------------------|
| GET    | `/api/organizer/templates`          | —                             | `List<TemplateResponse>` |
| GET    | `/api/organizer/events`             | —                             | `List<EventResponse>`    |
| POST   | `/api/organizer/events`             | `CreateEventRequest`          | `EventResponse`          |
| GET    | `/api/organizer/events/{id}`        | —                             | `EventResponse`          |
| PUT    | `/api/organizer/events/{id}`        | `UpdateEventRequest`          | `EventResponse`          |
| DELETE | `/api/organizer/events/{id}`        | —                             | 204                      |
| GET    | `/api/organizer/events/{id}/guests` | —                             | `List<GuestResponse>`    |
| POST   | `/api/organizer/events/{id}/guests` | `{ name, phone }`             | `GuestResponse`          |

### Public API (`/api/public/...`)
Без авторизации.

| Метод | URL                               | Body / Params       | Ответ                        |
|-------|-----------------------------------|---------------------|------------------------------|
| GET   | `/api/public/events/{slug}`       | —                   | `EventPublicResponse`        |
| POST  | `/api/public/events/{slug}/rsvp`  | `RsvpRequest`       | `{ status, message }`        |

### OG endpoint
| Метод | URL          | Описание                              |
|-------|--------------|---------------------------------------|
| GET   | `/e/{slug}`  | Thymeleaf HTML с OG meta + event.js   |

---

## 7. ФРОНТЕНД ЛОГИКА

### Публичная страница гостя (`event.js`)
1. Читает `slug` из URL (`/e/abc123` → slug = `abc123`)
2. `GET /api/public/events/{slug}` → получает `{ title, eventDate, location, blocks_config, blocksSchema }`
3. Итерирует по `blocksSchema` → для каждого блока вызывает `renderBlock(type, data)`
4. `renderBlock` — простой switch/map: создаёт DOM-элементы и вставляет данные
5. RSVP форма — кнопки "Приду" / "Не приду" → `POST /api/public/events/{slug}/rsvp`

### Дашборд организатора (`dashboard.js`)
1. `GET /api/organizer/events` (с X-User-Phone header) → рендерит карточки событий
2. Клик "Посмотреть гостей" → `GET /api/organizer/events/{id}/guests` → таблица

### Редактор события (`editor.js`)
1. `GET /api/organizer/templates` → показывает выбор шаблона
2. После выбора — рендерит форму по `blocks_schema` шаблона
3. Submit → `POST /api/organizer/events` → редирект на дашборд

---

## 8. OPEN GRAPH

**Проблема:** WhatsApp и Telegram при отправке ссылки делают HTTP GET и парсят `<meta>` теги. Они не выполняют JavaScript. Поэтому SPA (чистый JS) не даст preview.

**Решение:** `/e/{slug}` — это Spring MVC endpoint, который возвращает Thymeleaf HTML с уже заполненными OG тегами:

```html
<meta property="og:title"       content="Свадьба Айны и Марата" />
<meta property="og:description" content="1 сентября • Бишкек, ресторан Арашан" />
<meta property="og:image"       content="https://..." />
<meta property="og:url"         content="http://localhost:8080/e/abc123" />
```

Данные берёт из БД по slug прямо на сервере. После загрузки страницы — обычный JS подхватывает и рендерит полную страницу.

Для локальной работы image можно использовать заглушку (стандартная картинка из static/).

---

## 9. ПОШАГОВЫЙ ROADMAP

### ✅ Шаг 1 — Liquibase + DB (DONE)
- Добавлен Liquibase в pom.xml
- `application.yaml`: datasource, liquibase config настроен
- Создан `db/changelog/db.changelog-master.yaml`
- Миграции в YAML: users, templates, events, guests, rsvp_responses
- Seed: 2 шаблона с `blocks_schema` (WEDDING, TOY)

### ✅ Шаг 2 — Entity + Repository (DONE)
- JPA entities: User, Template, Event, Guest, RsvpResponse
- @PrePersist/@PreUpdate для timestamps и дефолтов
- JSONB через @JdbcTypeCode(SqlTypes.JSON) как String
- UUID token в Guest генерируется в @PrePersist
- Repositories: findByPhone, findBySlug, existsBySlug, findAllByEventId, findByToken, findByGuestIdAndEventId

### Шаг 3 — DTO + Exception handling
- Request/Response DTO records (Java records — лаконично)
- `NotFoundException extends RuntimeException`
- `@RestControllerAdvice` GlobalExceptionHandler → возвращает `{ error, message, status }`

### Шаг 4 — SlugService
- Генерация уникального slug: `nanoid`-style (6-8 символов) или `UUID.randomUUID().toString().substring(0,8)`
- Проверка уникальности в БД

### Шаг 5 — Template API
- `TemplateService` + `TemplateController`
- `GET /api/organizer/templates` — список активных шаблонов
- Данные уже есть из seed миграции

### Шаг 6 — Event CRUD
- `EventService`: create (генерирует slug), findById, update, delete, findAllByUser
- `EventController` — все organizer endpoints для events
- Stub auth: `@RequestHeader("X-User-Phone")` → найти/создать user по phone

### Шаг 7 — Guest API
- `GuestService`: addGuest, findAllByEvent
- `GuestController` — endpoints для гостей

### Шаг 8 — Public API + RSVP
- `PublicEventController`: `GET /api/public/events/{slug}` → EventPublicResponse
- `RsvpService` + `RsvpController`: `POST /api/public/events/{slug}/rsvp`
- RsvpRequest: `{ guestToken (optional), name, status }`

### Шаг 9 — OG endpoint (Thymeleaf)
- Добавить `spring-boot-starter-thymeleaf` в pom.xml
- `event-og.html` с OG meta тегами + подключение `event.js`
- `EventPageController`: `GET /e/{slug}` → Thymeleaf model → render

### Шаг 10 — Frontend: публичная страница
- `static/event.html` + `static/js/event.js`
- Fetch данных, рендер блоков, RSVP форма

### Шаг 11 — Frontend: дашборд
- `static/index.html` + `static/js/dashboard.js`
- Список событий, ссылка на редактор, ссылка на список гостей

### Шаг 12 — Frontend: редактор
- `static/editor.html` + `static/js/editor.js`
- Выбор шаблона, динамическая форма по blocks_schema, submit

### Шаг 13 — Финальная проверка
- Полный сценарий: создать событие → скопировать ссылку → открыть в другом окне → ответить RSVP → проверить в дашборде
- OG: проверить через `curl -A "WhatsApp" http://localhost:8080/e/{slug}` — должны быть meta теги

---

## 10. АНТИ-ОШИБКИ

| Ошибка | Почему плохо |
|--------|-------------|
| Начать с Security/JWT | Блокирует всё, MVP не нужен |
| Делать SPA без SSR для OG | WhatsApp/Telegram не увидят preview |
| Хранить блоки в отдельных таблицах | Излишняя сложность, JSONB решает |
| Добавлять React/Vue | Overhead для MVP, Vanilla JS достаточно |
| Делать пагинацию сразу | Трата времени, у MVP мало данных |
| Один God-сервис на всё | Разделяй по доменам с самого начала |
| Игнорировать slug уникальность | Коллизии сломают публичные ссылки |
| Не делать `ON DELETE CASCADE` на guests | Мусор в БД при удалении события |
| Хранить image_url без заглушки | NPE/broken img в OG при пустом поле |
| Коммитить в main напрямую | Работаем через dev → feature-ветки |
