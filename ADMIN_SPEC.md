# ADMIN_SPEC.md

> **Документ:** Спецификация админ-панели ToiLink (MVP)
> **Версия:** 2.0 — упрощённая, под solo-разработку
> **Аудитория:** разработчик (он же superadmin)

---

## 1. Главное

Админка — это отдельный backoffice (`admin.toilink.kg`), через который я (superadmin) управляю всем: пользователями, событиями, оплатами, шаблонами, контентом лендинга и метриками.

**Ключевые принципы:**
- Одна роль — **superadmin**. Полный доступ ко всему.
- Простота: минимум абстракций, максимум прямых CRUD-операций.
- Безопасность: 2FA, audit log, soft-delete.
- Бизнес-логика в UI, не в коде (цены, тексты, лимиты).
- Desktop-first, плотные таблицы, быстрый поиск.

**Чего НЕ будет:**
- Сложной RBAC-системы с десятком ролей.
- 4-eyes principle, корпоративных approval flow.
- Multi-tenant, франшиз, партнёрского кабинета.
- ML-аналитики, прогнозов LTV, ClickHouse.
- Мобильной админки.

*Задел на будущее:* если появится менеджер поддержки — добавится одна роль `manager` с ограниченным доступом (read + support actions). Это одна роль, не иерархия.

---

## 2. Авторизация

- Вход: телефон + пароль + TOTP (Google Authenticator).
- JWT: access (15 мин) + refresh (7 дней).
- Вход с нового IP → уведомление в Telegram.
- 5 неверных попыток → блок на 15 мин.
- Все логины пишутся в `admin_login_events`.

---

## 3. Навигация (сайдбар)

```
ToiLink Admin
├─ 📊 Дашборд
├─ 👥 Пользователи
├─ 💌 События
├─ 🙋 Гости и RSVP
├─ 🎨 Шаблоны
├─ 🌐 Лендинг (CMS)
├─ 💰 Финансы
│   ├─ Тарифы
│   ├─ Оплаты
│   └─ Промокоды
├─ 🖼 Медиа
├─ 📈 Аналитика
├─ 🛟 Поддержка
├─ ⚙️ Системные настройки
├─ 🚩 Feature flags
├─ 📋 Audit log
└─ 🩺 Здоровье
```

---

## 4. Дашборд

Одна страница — состояние бизнеса за 10 секунд.

**KPI-карточки (сегодня / 7д / 30д):**
- Новые пользователи
- Созданные события
- Опубликованные события
- Подтверждённые оплаты (кол-во + сумма)
- Выручка нетто
- Активных RSVP за сегодня

**Графики:**
- Новые пользователи / События / Оплаты по дням (90 дней) — линейный.
- Воронка: Signup → Event Created → Published → Paid.
- Топ-5 шаблонов по созданным событиям.

**Системные индикаторы:**
- Последний бэкап (когда, размер, статус).
- Ошибки за сегодня (count).

Данные кэшируются на 5 мин, лейбл «обновлено N мин назад».

---

## 5. Пользователи

### 5.1. Таблица
Колонки: телефон, имя, статус (активен/заблокирован), дата регистрации, кол-во событий, сумма оплат, последняя активность.

Фильтры: поиск по телефону/имени, статус, есть/нет оплат.

### 5.2. Карточка пользователя
- Шапка: имя, телефон, роль, статус, дата регистрации, последний вход.
- Вкладки: **События**, **Оплаты**, **Гости**, **Активность** (логины), **Заметки**.
- Действия: заблокировать/разблокировать (с причиной), сбросить пароль, удалить (soft-delete).
- Кнопка «войти как пользователь» (impersonation) — открывает кабинет клиента с баннером «Вы зашли как [имя]». Только просмотр, без действий от имени пользователя.

### 5.3. Impersonation
- Создаётся короткоживущий токен (15 мин).
- В кабинете клиента — заметный баннер.
- Пишется в audit log.
- Read-only: нельзя оплатить, изменить пароль, удалить событие.

### 5.4. API
```
GET    /api/admin/users?search=&status=&page=
GET    /api/admin/users/{id}
PATCH  /api/admin/users/{id}
POST   /api/admin/users/{id}/block      { reason }
POST   /api/admin/users/{id}/unblock
POST   /api/admin/users/{id}/reset-password
DELETE /api/admin/users/{id}            # soft-delete
POST   /api/admin/users/{id}/impersonate
GET    /api/admin/users/{id}/events
GET    /api/admin/users/{id}/payments
GET    /api/admin/users/{id}/activity
POST   /api/admin/users/{id}/notes
```

---

## 6. События

### 6.1. Таблица
Колонки: ID, обложка (миниатюра), title, person1+person2, eventDate, статус, шаблон, владелец, гостей, оплат, дата создания.

Фильтры: статус, шаблон, диапазон дат, наличие оплаты, поиск по slug/владельцу.

Быстрые пресеты: «без оплаты, опубликовано», «удалённые».

### 6.2. Карточка события
Вкладки: **Контент** (blocksConfig), **Гости**, **RSVP**, **Оплаты**, **Медиа**, **Аудит**.

Действия:
- Открыть публичную страницу / превью.
- Сменить статус (DRAFT/PUBLISHED/CLOSED).
- Сбросить кэш страницы.
- Заменить шаблон (с миграцией blocksConfig).
- Удалить (soft-delete, корзина 30 дней).
- Экспорт RSVP в Excel.

### 6.3. API
```
GET    /api/admin/events?...
GET    /api/admin/events/{id}
PATCH  /api/admin/events/{id}
DELETE /api/admin/events/{id}            # soft
POST   /api/admin/events/{id}/restore
POST   /api/admin/events/{id}/reset-cache
POST   /api/admin/events/{id}/migrate-template { newTemplateId }
GET    /api/admin/events/{id}/guests/export.xlsx
```

---

## 7. Гости и RSVP

### 7.1. Таблица
Колонки: имя, телефон, источник (PERSONAL_LINK/PUBLIC_LINK/MANUAL), событие, владелец, статус RSVP, groupSize, комментарий, respondedAt.

Фильтры: по событию, статусу, источнику.

### 7.2. Действия
- Изменить ответ (пишется в `rsvp_history`).
- Удалить гостя.
- Перегенерировать персональную ссылку.
- Экспорт CSV/Excel.

### 7.3. Импорт CSV
- Загрузка файла, валидация телефонов, проверка дублей.
- Отчёт: сколько добавлено, сколько пропущено, сколько дублей.

### 7.4. Поиск дублей
- По телефону внутри одного события.
- Ручное объединение.

### 7.5. API
```
GET    /api/admin/guests?eventId=&status=
PATCH  /api/admin/guests/{id}
DELETE /api/admin/guests/{id}
POST   /api/admin/guests/import          (multipart csv)
POST   /api/admin/guests/find-duplicates?eventId=
POST   /api/admin/guests/merge           { keepId, mergeIds[] }
GET    /api/admin/rsvp/{id}/history
```

---

## 8. Шаблоны

### 8.1. Поля шаблона
name, description, thumbnailUrl, category, templatePath, blocksSchema (JSON), sortOrder, isActive, isPaid, price, version.

### 8.2. Действия
- Создать / редактировать / дублировать.
- Активировать / скрыть (isActive).
- Сменить порядок (drag-n-drop).
- Превью с тестовыми данными.

### 8.3. Версионирование (лёгкое)
- У шаблона есть `version` (число).
- При изменении blocksSchema версия инкрементится.
- Существующие события продолжают работать на своей версии.
- Кнопка «мигрировать события на новую версию» — массовая операция с подтверждением.

### 8.4. Безопасность
- Нельзя удалить шаблон, на котором есть события.
- Деактивация прячет шаблон из выдачи новым клиентам, но не ломает существующие события.

### 8.5. API
```
GET    /api/admin/templates
POST   /api/admin/templates
PATCH  /api/admin/templates/{id}
POST   /api/admin/templates/{id}/duplicate
POST   /api/admin/templates/{id}/migrate-events
GET    /api/admin/templates/{id}/usage
```

---

## 9. Лендинг (CMS)

Управление контентом `landing.html` без правки кода.

### 9.1. Блоки лендинга
Каждый блок — запись в `landing_content` с key, language (kk/ru/en), content_json.

| Блок | Что редактируется |
|---|---|
| Hero | title, subtitle, cta_text, bg_image |
| Features | items: [{icon, title, text}] |
| HowItWorks | steps: [{title, text, image}] |
| Templates showcase | templateIds[] |
| Pricing | planIds[] |
| FAQ | items: [{q, a}] |
| Testimonials | items: [{name, text, rating}] |
| Footer | contacts, links |
| SEO | title, description, og:title, og:image |

### 9.2. Действия
- Редактировать блок (по языкам).
- Toggle видимости блока.
- Сменить порядок блоков.
- Превью изменений перед публикацией.
- История версий блока — возможность отката.

### 9.3. API
```
GET    /api/admin/landing
PATCH  /api/admin/landing/blocks/{id}
POST   /api/admin/landing/blocks/reorder
POST   /api/admin/landing/blocks/{id}/publish
POST   /api/admin/landing/blocks/{id}/rollback/{versionId}
```

---

## 10. Финансы

### 10.1. Тарифы

Поля: code (free/activation/premium), name_json (kk/ru/en), price, billing_type (one_time), limits_json, is_active, sort_order.

Лимиты: max_events_per_user, max_guests_per_event, max_photos_per_event, video_access (bool), premium_templates (bool).

API:
```
GET    /api/admin/plans
POST   /api/admin/plans
PATCH  /api/admin/plans/{id}
```

### 10.2. Оплаты

**Текущая реальность (KG):** пользователь платит через QR/МБанк/O!Деньги/Элсом → присылает чек в WhatsApp → админ сверяет и подтверждает вручную.

**Сущность Payment:**
- user_id, event_id, plan_id, plan_snapshot_json
- amount, currency (KGS), method (QR_BANK, MBANK, ODENGI, ELSOM, MANUAL)
- status: PENDING → AWAITING_CONFIRMATION → CONFIRMED / REJECTED / REFUNDED
- external_ref (номер чека), receipt_url (скрин), notes
- confirmed_at, rejected_reason

**Очередь подтверждения:**
- Список платежей со статусом AWAITING_CONFIRMATION.
- Карточка платежа: данные клиента, сумма, метод, чек.
- Кнопки: Подтвердить / Отклонить (с причиной) / Возврат.
- После подтверждения — авто-активация события (если было неактивно).

**Неопознанные платежи:**
- Запись из банковской выписки, которую не можем привязать к пользователю.
- Ручной ввод: сумма, метод, external_ref, дата.
- Кнопка «привязать к пользователю» — поиск по телефону/сумме/дате.

API:
```
GET    /api/admin/payments?status=&method=&from=&to=
GET    /api/admin/payments/{id}
POST   /api/admin/payments/{id}/confirm   { external_ref }
POST   /api/admin/payments/{id}/reject    { reason }
POST   /api/admin/payments/{id}/refund    { amount, reason }
POST   /api/admin/payments/orphan         { amount, method, ref, dateTime }
POST   /api/admin/payments/orphan/{id}/link { userId, eventId }
GET    /api/admin/payments/export.xlsx?from=&to=
```

### 10.3. Промокоды

Поля: code (unique), type (PERCENT/FIXED), value, applies_to_plans[], valid_from/to, max_uses_total, max_uses_per_user, current_uses, is_active.

API:
```
GET    /api/admin/promo
POST   /api/admin/promo
PATCH  /api/admin/promo/{id}
```

---

## 11. Медиа

### 11.1. Назначение
Просмотр и управление загруженными файлами (фото/видео).

### 11.2. Таблица
Колонки: превью, original_name, kind, size_bytes, mime, владелец, событие, uploaded_at.

Фильтры: по типу, владельцу, событию, «орфаны» (не привязаны к сущности).

### 11.3. Действия
- Просмотр / скачать.
- Удалить (soft, корзина 30 дней).
- Очистка орфанов (сухой прогон → подтверждение → удаление).

### 11.4. Лимиты загрузки (настраиваются в системных настройках)
- max-size: 10 MB фото / 100 MB видео.
- Допустимые mime-типы (whitelist).
- Magic-bytes проверка.

### 11.5. Будущий S3
Сейчас файлы в `/uploads/`. В системных настройках — toggle «использовать S3» + конфиг (endpoint, bucket, keys). Фоновый job миграции.

### 11.6. API
```
GET    /api/admin/media?kind=&owner=&event=&orphan=&page=
DELETE /api/admin/media/{id}
POST   /api/admin/media/cleanup-orphans  { dryRun: bool }
```

---

## 12. Аналитика

### 12.1. Архитектура
- Таблица `analytics_events` — append-only лог событий.
- `analytics_daily` — агрегаты за день (заполняются cron'ом).
- UI читает агрегаты; сырой лог — для drill-down.

### 12.2. Ключевые события для логирования
**Лендинг:** landing_view, landing_cta_click, pricing_plan_click.
**Регистрация:** signup_started, signup_completed, login_success.
**События:** event_create_started, template_selected, event_published.
**Гости:** guest_added, rsvp_submitted.
**Оплата:** paywall_shown, payment_started, payment_confirmed, promo_code_applied.

### 12.3. Дашборды аналитики
- **Пользователи:** новые регистрации по дням, DAU/WAU/MAU.
- **События:** Created vs Published vs Paid по дням, распределение по шаблонам и языкам.
- **Воронка:** Visit → Signup → Event Created → Published → Paid (абсолютные числа и %).
- **Оплаты:** выручка по дням/неделям/месяцам, метод оплаты — доля и средний чек.
- **RSVP:** % Attending / Declined / Maybe, средний groupSize.
- **Шаблоны:** топ по выбору, топ по оплатам.
- **Лендинг:** визиты, уникальные посетители.

### 12.4. Экспорт
CSV/Excel на каждом дашборде.

### 12.5. API
```
POST   /api/analytics/event              (публичный, для фронта)
GET    /api/admin/analytics/funnel?from=&to=
GET    /api/admin/analytics/revenue?from=&to=
GET    /api/admin/analytics/templates/usage
GET    /api/admin/analytics/landing
GET    /api/admin/analytics/export?metric=&from=&to=&format=
```

---

## 13. Поддержка

### 13.1. Тикеты
Поля: user_id, event_id, channel (whatsapp/web/phone), subject, status (OPEN/IN_PROGRESS/RESOLVED/CLOSED), priority, created_at, resolved_at.

Сообщения: ticket_id, author_kind (USER/ADMIN), text, created_at.

### 13.2. Действия
- Ответить клиенту.
- Внутренняя заметка (не видна клиенту).
- Прикрепить к событию.
- Закрыть с причиной.

### 13.3. API
```
GET    /api/admin/tickets?status=&priority=
GET    /api/admin/tickets/{id}
POST   /api/admin/tickets/{id}/reply     { text, isInternalNote }
PATCH  /api/admin/tickets/{id}           # status, priority
```

---

## 14. Системные настройки

### 14.1. Группы настроек
- **Общие:** название платформы, контакты, часовой пояс, язык по умолчанию.
- **Лимиты:** размер файлов, кол-во событий на пользователя.
- **SMS/WhatsApp:** API ключи провайдеров (зашифрованы, маскированы в UI).
- **Платежи:** реквизиты, текст QR-инструкции.
- **Сторадж:** local или S3 + конфиг.
- **Юр. документы:** Terms, Privacy (с версионированием).
- **SEO:** robots.txt, sitemap.

### 14.2. Безопасность
- Секреты хранятся зашифрованными.
- В UI отображаются маскированно (`****1234`).
- Изменение пишется в audit как «secret rotated» (без значения).

### 14.3. API
```
GET    /api/admin/settings
PATCH  /api/admin/settings/{key}
```

---

## 15. Feature Flags

### 15.1. Сущность
key, description, enabled (bool), rollout_percent (0–100), updated_at.

### 15.2. Примеры флагов
- `video_invites.enabled`
- `landing.new_hero`
- `editor.media_compression`
- `payment.mbank_qr`

### 15.3. API
```
GET    /api/admin/feature-flags
PATCH  /api/admin/feature-flags/{key}
```

Флаги отдаются фронту при загрузке. Изменение пишется в audit.

---

## 16. Audit Log

### 16.1. Сущность `admin_audit_logs`
id, admin_user_id, action_code, target_type, target_id, before_json, after_json, reason, ip, user_agent, created_at.

Иммутабельный (только INSERT, без UPDATE/DELETE). Архивируется ежемесячно.

### 16.2. Что логируется
- Любое изменение пользователя, события, шаблона, тарифа, контента лендинга.
- Подтверждение/отклонение/возврат оплаты.
- Impersonation (старт и конец).
- Любое удаление или восстановление.
- Изменение секретов и системных настроек.
- Toggle feature flags.

### 16.3. UI
Таблица с фильтрами: админ, действие, тип цели, диапазон дат. Экспорт CSV.

### 16.4. API
```
GET    /api/admin/audit?admin=&action=&target_type=&from=&to=&page=
GET    /api/admin/audit/export.csv?...
```

---

## 17. Бэкапы

### 17.1. Типы
- Полный дамп БД (pg_dump) — ежедневно 02:00.
- Медиа-снимок (rsync в S3) — раз в неделю.

### 17.2. Хранение
- Локально: 7 дней.
- S3/Object storage: 90 дней.

### 17.3. Сущность `backup_jobs`
id, type, status (RUNNING/SUCCESS/FAILED), started_at, finished_at, size_bytes, location, sha256, triggered_by (cron/manual), error.

### 17.4. Действия в админке
- Запустить бэкап вручную.
- Скачать последний.
- Журнал бэкапов с проверкой целостности (sha256).
- Восстановить в staging (тестовый прогон).

### 17.5. Soft-delete и корзина
- На всех ключевых сущностях: User, Event, Guest, Template, Media.
- Поле `deleted_at`. Cron раз в день: полное удаление записей с `deleted_at > 30 дней`.
- UI: фильтр «корзина» → список удалённого → кнопка «восстановить».

### 17.6. API
```
GET    /api/admin/backups
POST   /api/admin/backups/trigger
GET    /api/admin/backups/{id}/download
POST   /api/admin/backups/{id}/verify-staging
GET    /api/admin/trash?type=&page=
POST   /api/admin/trash/{type}/{id}/restore
```

---

## 18. Здоровье системы

### 18.1. Что показывать
- CPU/RAM/Disk сервера.
- БД: connections, slow queries.
- Очереди (длина, упавшие задачи).
- Внешние сервисы: SMS/WhatsApp/S3 — статус за 24ч.
- HTTP error rate (4xx/5xx).
- Последние ошибки в логах.

### 18.2. Источники
Spring Boot Actuator + системные метрики.

---

## 19. Безопасность

### 19.1. Доступ
- Только через `admin.toilink.kg`.
- 2FA (TOTP) обязателен.
- Сессия: 15 мин access + refresh. Авто-логаут через 30 мин неактивности.

### 19.2. Защита данных
- CSRF-токены на все state-changing endpoints.
- Sanitization HTML в полях лендинга.
- Телефоны в аудите — маскированные (`0700***432`).
- Логи без PII.

### 19.3. Rate limiting
- На public API (analytics_events) — per IP.
- На admin API — per user.
- На отправку SMS — per phone.

### 19.4. Защита от случайных действий
- Soft-delete везде.
- Корзина 30 дней.
- Подтверждение фразой для деструктивных действий (удаление пользователя, удаление опубликованного события).
- Dry-run на массовых операциях (импорт CSV, миграция шаблонов, очистка орфанов).

---

## 20. База данных: новые таблицы

### 20.1. `admin_audit_logs`
```sql
id            uuid pk
admin_user_id uuid fk → users
action_code   text
target_type   text        -- user, event, payment, template, ...
target_id     text
before_json   jsonb
after_json    jsonb
reason        text
ip            text
user_agent    text
created_at    timestamptz default now()
```

### 20.2. `payments`
```sql
id                  uuid pk
user_id             uuid fk → users
event_id            uuid fk → events (nullable)
plan_id             uuid fk → pricing_plans
plan_snapshot_json  jsonb
amount              numeric(12,2)
currency            text default 'KGS'
method              text        -- QR_BANK, MBANK, ODENGI, ELSOM, MANUAL
status              text        -- PENDING, AWAITING_CONFIRMATION, CONFIRMED, REJECTED, REFUNDED
external_ref        text
receipt_url         text
promo_code_id       uuid fk → promo_codes (nullable)
confirmed_at        timestamptz
confirmed_by        uuid fk → users (nullable)
rejected_reason     text
refunded_amount     numeric(12,2)
refunded_at         timestamptz
notes               text
created_at          timestamptz default now()
updated_at          timestamptz default now()
```

### 20.3. `pricing_plans`
```sql
id                   uuid pk
code                 text unique
name_json            jsonb       -- { kk, ru, en }
description_json     jsonb
price                numeric(12,2)
currency             text default 'KGS'
billing_type         text default 'ONE_TIME'
limits_json          jsonb
is_active            bool default true
is_visible_landing   bool default true
sort_order           int
valid_from           timestamptz
valid_to             timestamptz
created_at           timestamptz default now()
updated_at           timestamptz default now()
```

### 20.4. `promo_codes`
```sql
id                 uuid pk
code               text unique
type               text        -- PERCENT, FIXED
value              numeric
applies_to_plans   text[]
valid_from         timestamptz
valid_to           timestamptz
max_uses_total     int
max_uses_per_user  int default 1
current_uses       int default 0
min_amount         numeric
is_active          bool default true
description        text
created_at         timestamptz default now()
```

### 20.5. `landing_content`
```sql
id              uuid pk
block_key       text         -- hero, features, faq, ...
language        text         -- kk, ru, en
order_index     int
is_visible      bool default true
content_json    jsonb
version         int default 1
updated_at      timestamptz default now()
```

### 20.6. `landing_content_versions`
```sql
id              uuid pk
landing_id      uuid fk → landing_content
content_json    jsonb
created_at      timestamptz default now()
note            text
```

### 20.7. `analytics_events` (партиции по дате)
```sql
id            bigserial
name          text
user_id       uuid
event_id      uuid
session_id    text
ts            timestamptz default now()
ip            inet
country       text
city          text
device        text
browser       text
os            text
utm_source    text
utm_medium    text
utm_campaign  text
referrer      text
props         jsonb
```

### 20.8. `analytics_daily`
```sql
date           date
metric_key     text
dimension_json jsonb
value          numeric
PRIMARY KEY (date, metric_key, dimension_json)
```

### 20.9. `feature_flags`
```sql
key             text pk
description     text
enabled         bool default false
rollout_percent int default 100
updated_at      timestamptz default now()
```

### 20.10. `admin_notes`
```sql
id              uuid pk
target_type     text        -- user, event, payment, ticket
target_id       text
text            text
created_at      timestamptz default now()
```

### 20.11. `backup_jobs`
```sql
id              uuid pk
type            text        -- DB_FULL, MEDIA
status          text        -- RUNNING, SUCCESS, FAILED
started_at      timestamptz
finished_at     timestamptz
size_bytes      bigint
location        text
sha256          text
triggered_by    text        -- cron, manual
error           text
```

### 20.12. Дополнительные таблицы
- `user_login_events` — история входов пользователей.
- `admin_login_events` — история входов в админку.
- `rsvp_history` — история изменений RSVP.
- `support_tickets` / `support_messages` — тикеты поддержки.
- `payment_orphans` — неопознанные банковские платежи.

### 20.13. Поля на существующих таблицах
- `users`: `role` (USER / SUPERADMIN), `last_login_at`, `last_login_ip`, `failed_login_count`, `locked_until`, `deleted_at`.
- `events`: `deleted_at`, `template_version`.
- `guests`: `deleted_at`.
- `templates`: `deleted_at`, `version`, `is_active`.
- `media_assets`: `deleted_at`.

---

## 21. API-карта

```
/api/admin/auth/login
/api/admin/auth/2fa/verify
/api/admin/auth/refresh
/api/admin/auth/logout

/api/admin/users/...
/api/admin/events/...
/api/admin/guests/...
/api/admin/rsvp/...
/api/admin/templates/...
/api/admin/landing/...
/api/admin/plans/...
/api/admin/payments/...
/api/admin/promo/...
/api/admin/media/...
/api/admin/analytics/...
/api/admin/tickets/...
/api/admin/backups/...
/api/admin/settings/...
/api/admin/feature-flags/...
/api/admin/audit/...
/api/admin/health/...
```

Все требуют Bearer JWT с `role = SUPERADMIN`. State-changing запросы пишутся в audit.

---

## 22. Roadmap

### 22.1. MVP (4–6 недель) — критическая операционка
- [ ] Поддомен `admin.toilink.kg`, авторизация с 2FA.
- [ ] CRUD пользователей + поиск по телефону + impersonation.
- [ ] Список и карточка событий + смена статуса.
- [ ] Очередь оплат + ручное подтверждение.
- [ ] Список шаблонов + toggle isActive + сортировка.
- [ ] Дашборд: 6 KPI + воронка.
- [ ] Audit log.
- [ ] Soft-delete + корзина.
- [ ] Базовая аналитика (ключевые события).
- [ ] Бэкап daily + ручной.
- [ ] Управление тарифами.
- [ ] CMS лендинга (минимум: hero, faq, pricing).

### 22.2. Версия 1 (следующие 4–6 недель)
- [ ] Полноценная CMS лендинга с историей версий.
- [ ] Промокоды.
- [ ] Тикеты поддержки.
- [ ] Медиа-менеджер + очистка орфанов.
- [ ] Экспорт RSVP в Excel.
- [ ] Feature flags.
- [ ] Полная аналитика (воронка, источники, retention).

### 22.3. Версия 2 (горизонт 2–3 месяца)
- [ ] Версионирование шаблонов + миграции.
- [ ] Переход на S3.
- [ ] Видео-приглашения (каталог + рендер + биллинг).
- [ ] Нотификации (SMS/WhatsApp — transactional).
- [ ] Автоматическая сверка с банком (если появится API).

---

## 23. Резюме

Админка ToiLink — это **операционный пульт для одного человека**, в котором:

- Все данные платформы видны на одном экране.
- Платёж подтверждается за минуту без открытия БД.
- Пользователь находится по телефону за секунду.
- Цены, тексты и шаблоны меняются в UI без релиза.
- Любое действие оставляет след в аудите.
- Любое удаление — мягкое, с корзиной на 30 дней.

Без ролей, без комитетов, без enterprise-наследия. Быстро, просто, надёжно.

---

*Документ живой. После согласования — декомпозиция на задачи в трекере.*
