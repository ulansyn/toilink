# MANUAL.md — ToiLink: Архитектурный и продуктовый мануал

> Конструктор цифровых приглашений для рынка Кыргызстана. B2C, pay-per-template, две категории (site + video), Java 21 + Spring Boot + PostgreSQL + Vanilla JS, собственный VPS.

---

## Executive Summary

1. **Категории шаблонов — ядро архитектуры.** `templates.category` (`SITE`/`VIDEO`) + полиморфный `event_config_json` (JSONB) + интерфейс `TemplateRenderer` в Java делают site и video взаимозаменяемыми модулями. Третья категория добавляется одной enum-константой и одной реализацией интерфейса, ядро не трогается.
2. **Видео — клиентское, сервер не рендерит.** Сервер хранит только схему сцен и метаданные. mp4 генерируется в браузере через WebCodecs (fallback — MediaRecorder, последний рубеж — ffmpeg.wasm). Это убирает 80% инфраструктурных проблем, но создаёт проблему «защиты от неоплаченного скачивания» — решается watermark + одноразовый signed-token с серверной отметкой `download_consumed_at`.
3. **Аутентификация — телефон + WhatsApp OTP, fallback SMS.** Email в КР — нишевый канал, пароли пользователи теряют, SMS дороги. WhatsApp Business API даёт ≈90% доставки и копеечную стоимость. Регистрация откладывается до момента сохранения события (не на лендинге, не до кастомизации).
4. **Оплата — `PaymentProvider` интерфейс с первого дня.** На старте единственная реализация — `ManualPaymentProvider` (суперадмин жмёт «оплачено»). Добавление O!Dengi/Mbank — новый класс, ноль изменений в `EventService`. Webhook endpoint, таблица `webhook_events` и idempotency-ключи закладываются сразу.
5. **B2B — пустые колонки, не пустые таблицы.** `users.organization_id`, `events.organization_id`, таблица `organizations` существуют, но всегда NULL/пустая. Это даёт миграцию в B2B одной формой регистрации организации без перестройки схемы.
6. **i18n с первого дня — ICU + JSONB-translations.** Один язык на событие (выбирается клиентом), интерфейс админ-панели и лендинг — `ru` основной, `ky` параллельный. Локаль в куке + URL-префикс `/ky/`.
7. **Frontend без бандлера — ES Modules + Import Maps.** Никаких webpack/vite/rollup. Public-страницы рендерит Thymeleaf (SEO + OG-превью), редактор — клиентское SPA на чистых модулях.
8. **VPS в Алматы / Франкфурте, Cloudflare сверху.** Локальные KG-провайдеры на старте дороже и менее надёжны. Cloudflare решает CDN, DDoS и SSL бесплатно. Бэкапы PostgreSQL — pgBackRest на отдельный VPS + еженедельный экспорт в Backblaze B2.
9. **Главные риски:** (a) клиентский видео-рендер на слабых Android — нужен честный fallback и предупреждение; (b) low-trust к онлайн-оплате в КР — поэтому ручная оплата через Kaspi-перевод останется надолго и не должна выглядеть как костыль; (c) единственная точка отказа — суперадмин, ручное подтверждение оплат не масштабируется выше ≈30 событий/день.
10. **Что закладывать сейчас, чтобы не болеть потом:** `organization_id`, `category`, `payment_provider`, audit_log, schema_version у шаблонов, idempotency-ключи на платежах, UTM-трекинг с первого захода. Раздел 13 — полный список с обоснованием стоимости отсрочки.

---

## Раздел 1. Ролевая модель

### 1.1. Роли на старте

| Роль | Аутентификация | Создаётся как |
|---|---|---|
| `SUPER_ADMIN` | email + пароль + 2FA (TOTP) | Сидом БД, единственный |
| `CLIENT` | телефон + WhatsApp OTP | Самостоятельная регистрация |
| `GUEST` | без аккаунта, доступ по ссылке `/e/{slug}` | Не сохраняется в `users` |

### 1.2. Что может делать каждая роль

**SUPER_ADMIN (сейчас):**
- Загружать, редактировать, архивировать шаблоны (site/video).
- Назначать и менять цены.
- Подтверждать оплату вручную, возвращать платежи, отменять события.
- Включать/выключать категории и любые feature flags.
- Управлять пользователями: поиск, блокировка, impersonation, ручная активация.
- Редактировать тексты лендинга и переводы без деплоя.
- Видеть всю аналитику, audit log, payments.

**SUPER_ADMIN (в будущем):** делегирование ролей `MODERATOR` (модерация шаблонов от B2B-партнёров) и `SUPPORT` (только импersonation + reset). На старте всё это делает один человек, отдельные роли не нужны.

**CLIENT (сейчас):**
- Регистрация по телефону, единственный аккаунт.
- Создание `event` из публичного шаблона (только активные шаблоны выбранной категории).
- Кастомизация события через редактор.
- Сохранение черновика бесплатно, бессрочно.
- Получение платёжных реквизитов и инструкций по ручной оплате.
- После активации админом — публикация события, шаринг ссылки, просмотр RSVP-статистики.
- Просмотр истории своих событий и платежей.
- Смена локали интерфейса.

**CLIENT (в будущем):** покупка через автоматический шлюз, реферальная ссылка, повторное использование оплаченного шаблона на новое событие со скидкой.

**GUEST (сейчас):**
- Открыть `/e/{slug}` без регистрации.
- Заполнить RSVP (имя, +/-, количество гостей, аллергии).
- Видеть локацию, расписание, контакты — то, что включил организатор.

**GUEST (в будущем):** мини-аккаунт через WhatsApp-номер (чтобы редактировать свой ответ), уведомления об изменениях события.

### 1.3. Зарезервированные роли (не реализуем, но БД готова)

- `ORGANIZER` — B2B-аккаунт агентства/тойхана. Видит события всех своих клиентов, управляет под-аккаунтами `MANAGER`, имеет общий биллинг.
- `MANAGER` — сотрудник `ORGANIZER`. Может работать только с событиями своей `organization_id`.

### 1.4. Что зарезервировать в схеме сейчас

```sql
-- В users:
organization_id UUID NULL REFERENCES organizations(id),
parent_user_id  UUID NULL REFERENCES users(id),  -- для будущего MANAGER → ORGANIZER
role            VARCHAR(32) NOT NULL DEFAULT 'CLIENT',
                -- enum: SUPER_ADMIN, CLIENT, ORGANIZER, MANAGER

-- В events:
organization_id UUID NULL REFERENCES organizations(id),
                -- сейчас всегда NULL для B2C; B2B-события заполнят

-- Таблица organizations создаётся пустой и ничем не используется.
```

**Почему так, а не EAV или JSON для ролей:** проверка прав в Spring Security должна быть быстрой и индексируемой. Enum-строка + явный FK на организацию — единственный путь, который не требует переписывания `@PreAuthorize` через 6 месяцев.

**Почему `parent_user_id`, а не таблица `memberships`:** на старте один пользователь = одна организация. Many-to-many membership — over-engineering. Если в будущем понадобится — добавим таблицу, не сломав существующее.

---

## Раздел 2. Модульная архитектура категорий

### 2.1. Декларация категории

Категория хранится в `templates.category` (VARCHAR enum: `SITE`, `VIDEO`). **Не отдельная таблица**, потому что:
- Все категории делят 80% полей (slug, name, price_kgs, status, preview_url, schema_json).
- Таблица одна → одна форма админки + один List API → меньше дублирования кода.
- Polymorphic association через `category` + `event_config_json` дешевле, чем STI с двумя таблицами `site_templates` / `video_templates`.

### 2.2. Что общее, что специфичное

| Слой | Общее | Специфичное |
|---|---|---|
| БД | `templates`, `template_versions`, `events`, `payments`, `users` | `event_config_json` интерпретируется по `template.category` |
| Java domain | `Template`, `Event`, `Payment` | `TemplateRenderer`, `TemplateValidator` (по одной реализации на категорию) |
| API | `/api/v1/admin/templates`, `/api/v1/client/events`, `/api/v1/pub/...` | `/api/v1/pub/e/{slug}` (site) vs `/api/v1/pub/v/{slug}` (video метаданные) |
| Frontend | Каталог шаблонов, редактор-движок, схема полей | `renderer-site.js` vs `renderer-video.js`, экспортёры |
| Файлы шаблона | `schema.json`, `preview.jpg`, `meta.json` | `index.html` (site) vs `scenes.json` + assets (video) |

### 2.3. Killswitch категории

Глобальный feature flag `category.video.enabled` (false → весь модуль выключен).

**Что происходит при выключении категории:**

| Объект | Поведение |
|---|---|
| Активные событий этой категории | Остаются доступны по прямой ссылке `/e/{slug}` (гости должны попасть на RSVP). Редактирование владельцем — заблокировано с баннером «категория временно недоступна, ваше событие сохранено». |
| Каталог шаблонов | Шаблоны категории скрыты из публичного каталога, но видны в админке. |
| API | `POST /api/v1/client/events` при создании в выключенной категории отдаёт `403 CategoryDisabled`. `GET` события остаётся доступен. |
| Платежи | Новые `payment_intent` блокируются. Существующие неоплаченные события могут быть оплачены (ручная оплата суперадмина продолжает работать). |
| Лендинг | Секция «Видео-приглашения» скрывается, нав-меню перерисовывается. |

**Реализация:** один Spring `@Component CategoryAvailabilityChecker` с методом `requireEnabled(category)` бросающим `CategoryDisabledException`. Проверка вызывается в `EventService.create()`, в публичном каталоге, и в JS через `/api/v1/pub/feature-flags`.

### 2.4. Структура файлов шаблонов

```
template/
├── site/
│   └── wedding-elegant-1/
│       ├── meta.json           # name_ru, name_ky, price_kgs, version, author
│       ├── schema.json         # описание полей редактора
│       ├── preview.jpg         # 16:9 для каталога
│       ├── preview-mobile.jpg  # 9:16 для мобильного каталога
│       ├── index.html          # Thymeleaf-совместимый шаблон публичной страницы
│       ├── styles.css          # scoped через [data-template="wedding-elegant-1"]
│       ├── editor.js           # опционально: кастомные хуки редактора
│       └── assets/             # дефолтные фото, иконки, фоны
└── video/
    └── wedding-cinematic-1/
        ├── meta.json
        ├── schema.json         # схема редактируемых полей сцен
        ├── preview.jpg
        ├── preview.mp4         # 5-сек превью для каталога
        ├── scenes.json         # описание сцен, длительностей, переходов
        ├── audio/              # дефолтная музыка (mp3/aac)
        ├── fonts/              # WOFF2 шрифты с лицензией
        └── assets/             # видео-фоны, оверлеи, частицы
```

### 2.5. Java-абстракции

```java
public enum TemplateCategory { SITE, VIDEO }

public interface TemplateRenderer {
    TemplateCategory category();
    /** Серверный рендер для публичной страницы (только SITE).
     *  VIDEO возвращает страницу-обёртку с превью и кнопкой генерации. */
    String renderPublicPage(Event event, Locale locale);
}

public interface TemplateValidator {
    TemplateCategory category();
    ValidationResult validateUpload(Path templateDir);
    ValidationResult validateEventConfig(Template template, JsonNode config);
}

public interface TemplateExporter {
    TemplateCategory category();
    /** Метаданные для клиентского экспорта.
     *  Для SITE — никогда не вызывается.
     *  Для VIDEO — возвращает scenes.json + signed URLs ассетов. */
    ExportPayload buildExportPayload(Event event);
}

@Service
public class TemplateRegistry {
    private final Map<TemplateCategory, TemplateRenderer> renderers;
    private final Map<TemplateCategory, TemplateValidator> validators;
    private final Map<TemplateCategory, TemplateExporter> exporters;
    // Spring собирает реализации по @Component через DI
}
```

**Третья категория (например, GIF/PDF в будущем):**
1. Добавить `TemplateCategory.PDF`.
2. Реализовать `PdfTemplateRenderer`, `PdfTemplateValidator`, `PdfTemplateExporter`.
3. Создать папку `template/pdf/`.
4. Добавить пункт в админ-форму загрузки.

Ядро (`EventService`, `TemplateService`, `PaymentService`) не меняется.

---

## Раздел 3. VIDEO — архитектурная специфика

### 3.1. Хранение «шаблона видео»

**На диске** (`template/video/{slug}/`):
- `scenes.json` — массив сцен.
- `assets/` — фоны (mp4 H.264 / WebM VP9), оверлеи (PNG с альфой), партиклы.
- `audio/` — фоновая музыка с лицензией.
- `fonts/` — WOFF2 для рендера текста на Canvas.

```json
// scenes.json (упрощённо)
{
  "version": 1,
  "duration_ms": 15000,
  "resolution": { "w": 1080, "h": 1920 },
  "fps": 30,
  "audio": "audio/main.mp3",
  "scenes": [
    {
      "id": "intro",
      "start_ms": 0,
      "duration_ms": 4000,
      "background": { "type": "video", "src": "assets/bg-intro.mp4" },
      "layers": [
        { "type": "text", "field": "couple_names", "x": 540, "y": 800,
          "font": "fonts/Cormorant.woff2", "size": 96, "color": "#fff",
          "animation": { "in": "fadeIn", "out": "none", "in_ms": 800 } },
        { "type": "text", "field": "wedding_date", "x": 540, "y": 1000,
          "font": "fonts/Inter.woff2", "size": 48, "color": "#e8d4a8" }
      ]
    }
  ]
}
```

**В БД** сцены не дублируются. `templates.schema_json` хранит только описание редактируемых полей (couple_names, wedding_date, photo_1...). Сама структура сцен — файл, потому что бинарные ассеты всё равно на диске, а scenes.json меняется только при выпуске новой версии шаблона.

### 3.2. Редактирование и preview

**Editor flow:**
1. Клиент открывает редактор.
2. JS грузит `schema.json` (поля) и `scenes.json` (структура).
3. Полевая форма (имена, дата, фото) заполняет `event.event_config_json`.
4. **Preview через Canvas в реальном времени:** `<canvas>` 1080×1920 (масштабированный CSS до экрана), на нём `requestAnimationFrame` рисует текущий кадр, текст и ассеты подменяются в живую. Нет рендеринга mp4 для preview — это слишком тяжело.
5. Кнопка «Просмотр» проигрывает Canvas-таймлайн целиком (без mp4-экспорта, без музыки или с музыкой через `<audio>`).

**Финальный экспорт (генерация mp4):**
- Отдельный экран «Скачать видео» с явным предупреждением «займёт 1-3 минуты, не закрывайте вкладку».
- Прогресс-бар по кадрам.

### 3.3. Выбор технологии экспорта

| Технология | Скорость | Качество | Поддержка | Размер бандла | Вердикт |
|---|---|---|---|---|---|
| **WebCodecs API** | Hardware-accelerated, ~realtime | Native H.264 | Chrome 94+, Edge, Safari 16.4+, **не Firefox** | 0 (native) | **Основной путь** |
| **MediaRecorder** | Realtime (15сек = 15сек) | WebM (VP8/VP9), не mp4 | Все браузеры | 0 (native) | **Fallback для Firefox/старых Safari** |
| **ffmpeg.wasm** | 5-10× медленнее | mp4 любого уровня | Все браузеры с SAB+COOP/COEP | ~25 MB | **Последний резерв + post-processing** для конвертации WebM→mp4 |

**Стратегия:**
1. Детектим `VideoEncoder` (WebCodecs). Если есть → encoder с H.264, `bitrate: 6 Mbps`, 30 fps. Это даст 15-сек 1080p mp4 за ~10-30 секунд на современном телефоне.
2. Иначе → MediaRecorder с `video/webm;codecs=vp9`. Получаем WebM. Если телефон Android/iOS примет WebM в WhatsApp — отправляем как есть. Тесты показывают, что WhatsApp Android принимает WebM, iOS — нет.
3. Для iOS без WebCodecs (старые Safari) → ffmpeg.wasm для финального ремукса WebM→mp4. Загружается лениво (`import()`) только когда нужно.

**Не выбираем серверный рендер**, потому что: (а) FFmpeg на VPS под 30 одновременных рендеров требует отдельного worker-пула, очереди, S3 для готовых файлов и денег за CPU; (б) уже спрототипировано клиентское решение; (в) офлоад на устройство — главное архитектурное решение продукта.

### 3.4. Что уходит на сервер

| Данные | Куда | Когда |
|---|---|---|
| `event_config_json` (поля + ссылки на assets) | `events.event_config_json` JSONB | На каждое сохранение черновика |
| Загруженные пользователем фото | `MinIO/uploads/{event_id}/` | При drag&drop в редакторе |
| Готовый mp4 | **Никуда не уходит** | Качается локально |
| Метрика «скачано» | `event_video_downloads` | По факту нажатия «Скачать» |

**Никогда не загружаем готовый mp4 на сервер.** Это сэкономит терабайты трафика и хранилища. Если клиент хочет «отправить через сайт» — это отдельная фича в будущем (web share API).

### 3.5. Защита от неоплаченного скачивания

Видео генерируется в браузере → теоретически можно прочитать `MediaRecorder` blob через DevTools и сохранить без оплаты. **Полностью защититься невозможно**, поэтому защита многослойная:

1. **До оплаты** — экспорт всегда выдаёт видео с watermark «toilink.kg» в правом нижнем углу (отдельный layer в `scenes.json` с `"visible_when": "!paid"`). Watermark рисуется на Canvas **в самом encoder pipeline**, а не CSS-overlay → клиент не сможет «выключить через DevTools» без переписывания JS.
2. **После оплаты** — сервер выдаёт `video_export_token` (signed JWT с `event_id`, `exp: 24h`, `scope: full_quality`). JS перед экспортом дёргает `POST /api/v1/client/events/{id}/video-export-intent` → сервер проверяет `payment.status = SUCCESS` и выдаёт токен. Только при наличии валидного токена в `scenes.json` watermark-layer исчезает и качество поднимается до 1080p (без оплаты — 720p).
3. **Минификация и обфускация** видео-движка через `terser --mangle` (без полноценного билда — отдельным скриптом). Не защищает от serious attacker, но отсекает 99% случайных попыток.
4. **Не пытаемся защитить content** (фото пользователя — его собственность). Защищаем **brand value шаблона** (без watermark — оплачено).

**Этого достаточно для KG-рынка.** Реальных людей не интересует ковыряние DevTools — они либо платят, либо не делают приглашение вообще.

### 3.6. Watermark — техника

В `scenes.json` watermark — обычный layer с условием:
```json
{
  "type": "image", "src": "system/watermark.png",
  "x": 900, "y": 1820, "opacity": 0.7,
  "visible_when": "trial"  // рисуется если export-токен не "full_quality"
}
```

Layer рисуется в том же `drawFrame()`, что и остальные слои. Удалить его в DevTools = переписать функцию рендера, что нетривиально.

### 3.7. Лимиты

| Параметр | Лимит | Обоснование |
|---|---|---|
| Длительность видео | 30 секунд max | WhatsApp Status — 30s, Instagram Story — 60s, всё больше — теряется внимание + рендер на слабом телефоне минуты |
| Разрешение | 1080×1920 (paid) / 720×1280 (trial) | 4K на мобильном Canvas не нужен и убивает рендер |
| FPS | 30 | 60 не даёт визуальной разницы для текста и удваивает время рендера |
| Размер пользовательского фото | 8 MB до загрузки, после WebP-сжатия ≤1.5 MB | Больше — кладёт rendering на старых Android |
| Кол-во пользовательских фото на видео | 6 | Больше — нет смысла за 30 секунд |
| Размер итогового mp4 | ~5-10 MB при 30s/1080p/6Mbps | WhatsApp пропускает до 16 MB без сжатия |

### 3.8. Слабые устройства — fallback

При запуске экспорта:
1. Бенчмарк: 1 секунда «холостого» Canvas-рендеринга. Если FPS < 15 → красный warning «на вашем устройстве экспорт займёт 5+ минут».
2. Если `navigator.deviceMemory < 4` → принудительно понижаем разрешение до 720p, отключаем тяжёлые эффекты (блюр, частицы).
3. Если 3 минуты экспорта прошло без `progressEvent` → диалог «продолжить» / «отменить».
4. **Альтернатива**: кнопка «отправить мне видео в WhatsApp» — в будущем. Пока что: «попробуйте на компьютере» с QR-кодом для перехода на десктоп.

---

## Раздел 4. Архитектура базы данных

PostgreSQL 16+. UTF-8, `timezone = Asia/Bishkek`. UUID v7 (или v4 если v7 ещё не подключён) для всех PK — лучше int auto-increment для распределённости в будущем и невозможности enumerate-атак.

### 4.1. users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role            VARCHAR(32) NOT NULL DEFAULT 'CLIENT'
                    CHECK (role IN ('SUPER_ADMIN','CLIENT','ORGANIZER','MANAGER')),
    phone           VARCHAR(16) UNIQUE,            -- формат E.164: +996700123456
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    email           VARCHAR(255) UNIQUE,           -- для SUPER_ADMIN обязателен, для CLIENT опционален
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   VARCHAR(72),                   -- bcrypt; только SUPER_ADMIN, CLIENT через OTP
    full_name       VARCHAR(120),
    locale          VARCHAR(8)  NOT NULL DEFAULT 'ru'
                    CHECK (locale IN ('ru','ky')),
    organization_id UUID NULL REFERENCES organizations(id),  -- B2B-резерв, всегда NULL на старте
    parent_user_id  UUID NULL REFERENCES users(id),          -- для будущего MANAGER
    avatar_url      VARCHAR(512),
    utm_source      VARCHAR(64),
    utm_medium      VARCHAR(64),
    utm_campaign    VARCHAR(128),
    referrer        VARCHAR(255),
    last_login_at   TIMESTAMPTZ,
    blocked_at      TIMESTAMPTZ,
    blocked_reason  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ NULL,                        -- soft delete для CLIENT
    CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX idx_users_phone           ON users(phone)           WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email           ON users(email)           WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role            ON users(role)            WHERE deleted_at IS NULL;
CREATE INDEX idx_users_organization_id ON users(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_users_created_at      ON users(created_at);
```

**Почему JSONB не используется здесь:** все поля нужны в индексах и для фильтров админки.
**Почему UTM — отдельные колонки, а не JSONB:** запросы аналитики типа `GROUP BY utm_source` должны быть быстрыми и индексируемыми.

### 4.2. organizations (резерв B2B)

```sql
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(64)  UNIQUE NOT NULL,
    contact_phone   VARCHAR(16),
    contact_email   VARCHAR(255),
    billing_account VARCHAR(255),
    plan            VARCHAR(32)  NOT NULL DEFAULT 'FREE'
                    CHECK (plan IN ('FREE','STARTER','PRO','ENTERPRISE')),
    plan_started_at TIMESTAMPTZ,
    plan_expires_at TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ NULL
);
```

**На старте таблица создаётся пустой.** Никогда не INSERT-имся в неё. Существование таблицы означает, что B2B добавляется через регистрацию организации, без `ALTER TABLE` в продакшне.

### 4.3. templates

```sql
CREATE TABLE templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(64)  UNIQUE NOT NULL,
    category        VARCHAR(16)  NOT NULL
                    CHECK (category IN ('SITE','VIDEO')),
    name_ru         VARCHAR(255) NOT NULL,
    name_ky         VARCHAR(255),
    description_ru  TEXT,
    description_ky  TEXT,
    price_kgs       INTEGER NOT NULL CHECK (price_kgs >= 0),  -- в сомах, без копеек
    occasion        VARCHAR(64),                              -- wedding, birthday, anniversary, ...
    status          VARCHAR(16)  NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    current_version_id UUID NULL,                             -- FK на template_versions, ставится после создания первой версии
    preview_url     VARCHAR(512),
    preview_mobile_url VARCHAR(512),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at     TIMESTAMPTZ NULL
);
CREATE INDEX idx_templates_category_status ON templates(category, status) WHERE status = 'ACTIVE';
CREATE INDEX idx_templates_slug            ON templates(slug);
CREATE INDEX idx_templates_occasion        ON templates(occasion) WHERE status = 'ACTIVE';
```

**Почему `price_kgs INTEGER`:** в KG нет копеек на ценах ниже 1000 сомов в реальной коммерции. Целое число избегает плавающей точки. Если потребуется «999.50» — поменяем на `NUMERIC(10,2)` миграцией, поведение SQL-floor подсказок не изменится.

**Почему `name_ru` и `name_ky` колонками, а не в `translations`:** запрос каталога одним JOIN-ом с переводами при каждом отображении — лишний overhead для 2 языков. Когда станет 5 языков — мигрируем.

### 4.4. template_versions

```sql
CREATE TABLE template_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES templates(id),
    version         INTEGER NOT NULL,
    schema_json     JSONB NOT NULL,                          -- спецификация полей редактора
    storage_path    VARCHAR(512) NOT NULL,                   -- template/site/wedding-1/v3/
    changelog       TEXT,
    is_breaking     BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, version)
);
CREATE INDEX idx_template_versions_template_id ON template_versions(template_id);

-- FK с templates после создания таблицы
ALTER TABLE templates
    ADD CONSTRAINT fk_templates_current_version
    FOREIGN KEY (current_version_id) REFERENCES template_versions(id);
```

**Почему отдельная таблица:** при обновлении шаблона мы не теряем историю и можем держать активные события на старой версии. `events.template_version_id` фиксирует версию в момент покупки → клиент защищён от нежданных изменений.

### 4.5. events

```sql
CREATE TABLE events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                 VARCHAR(64) UNIQUE NOT NULL,         -- /e/{slug}
    owner_user_id        UUID NOT NULL REFERENCES users(id),
    organization_id      UUID NULL REFERENCES organizations(id),  -- резерв B2B
    template_id          UUID NOT NULL REFERENCES templates(id),
    template_version_id  UUID NOT NULL REFERENCES template_versions(id),
    category             VARCHAR(16) NOT NULL                 -- денормализовано из templates.category
                         CHECK (category IN ('SITE','VIDEO')),
    title                VARCHAR(255),                        -- "Свадьба Айгуль и Бакыт"
    locale               VARCHAR(8) NOT NULL DEFAULT 'ru'
                         CHECK (locale IN ('ru','ky')),
    status               VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT','PENDING_PAYMENT','ACTIVE','ARCHIVED')),
    paid_at              TIMESTAMPTZ,
    event_config_json    JSONB NOT NULL DEFAULT '{}',         -- значения полей формы; site и video используют разную структуру
    event_date           TIMESTAMPTZ,                         -- дата самого мероприятия (дублируется из config для индексирования)
    rsvp_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    rsvp_deadline        TIMESTAMPTZ,
    max_guests           INTEGER,                             -- лимит RSVP, NULL = без лимита
    custom_domain        VARCHAR(255),                        -- резерв на будущее
    metadata             JSONB NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ NULL
);
CREATE INDEX idx_events_owner          ON events(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_slug           ON events(slug)          WHERE deleted_at IS NULL;
CREATE INDEX idx_events_status         ON events(status);
CREATE INDEX idx_events_category       ON events(category);
CREATE INDEX idx_events_event_date     ON events(event_date)    WHERE deleted_at IS NULL;
CREATE INDEX idx_events_organization   ON events(organization_id) WHERE organization_id IS NOT NULL;
-- JSONB GIN-индекс не нужен на старте: фильтры по содержимому event_config_json не делаются
```

**Почему category денормализован:** для фильтров «все мои видео-приглашения» один индекс вместо JOIN с templates.

**Почему один `event_config_json` для site и video, а не две таблицы:** ядро (CRUD события, оплата, RSVP) идентично. Различия — только в интерпретации JSON. Две таблицы = два сервиса, два эндпоинта, дублирование. JSON Schema валидируется через `TemplateValidator` по категории.

### 4.6. guests, rsvp_responses

```sql
CREATE TABLE rsvp_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id),
    guest_name      VARCHAR(120) NOT NULL,
    guest_phone     VARCHAR(16),
    will_attend     VARCHAR(8) NOT NULL CHECK (will_attend IN ('YES','NO','MAYBE')),
    guests_count    INTEGER NOT NULL DEFAULT 1 CHECK (guests_count >= 0 AND guests_count <= 20),
    message         TEXT,
    custom_fields   JSONB NOT NULL DEFAULT '{}',              -- аллергии, песни и т.п. в зависимости от шаблона
    ip_address      INET,                                     -- против накруток
    user_agent      VARCHAR(512),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rsvp_event_id ON rsvp_responses(event_id);
CREATE INDEX idx_rsvp_phone    ON rsvp_responses(event_id, guest_phone) WHERE guest_phone IS NOT NULL;
```

**Отдельной таблицы `guests` нет**, потому что: (а) гости нигде кроме этого события не используются; (б) приглашённый список (если потребуется) можно хранить в `event_config_json.guest_list` — это редактирование организатора, не отдельная сущность.

### 4.7. payments

```sql
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    provider_code       VARCHAR(32) NOT NULL                  -- 'MANUAL', 'ODENGI', 'MBANK', ...
                        REFERENCES payment_providers(code),
    amount_kgs          INTEGER NOT NULL CHECK (amount_kgs >= 0),
    currency            VARCHAR(3) NOT NULL DEFAULT 'KGS',
    status              VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','PROCESSING','SUCCESS','FAILED','REFUNDED','EXPIRED')),
    provider_txn_id     VARCHAR(255),                         -- ID в системе провайдера
    idempotency_key     VARCHAR(64) UNIQUE NOT NULL,          -- защита от дублей
    payment_method      VARCHAR(64),                          -- 'kaspi_transfer', 'cash', 'odengi_qr', ...
    confirmed_by_user_id UUID REFERENCES users(id),           -- кто подтвердил вручную (SUPER_ADMIN)
    confirmed_at        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',          -- произвольные данные провайдера
    failure_reason      TEXT,
    refunded_at         TIMESTAMPTZ,
    refund_reason       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_event           ON payments(event_id);
CREATE INDEX idx_payments_user            ON payments(user_id);
CREATE INDEX idx_payments_status_created  ON payments(status, created_at);
CREATE INDEX idx_payments_provider_txn    ON payments(provider_code, provider_txn_id) WHERE provider_txn_id IS NOT NULL;
```

### 4.8. payment_providers

```sql
CREATE TABLE payment_providers (
    code            VARCHAR(32) PRIMARY KEY,                  -- 'MANUAL', 'ODENGI', 'MBANK', 'OPTIMA', 'MEGAPAY', 'BALANCE'
    name_ru         VARCHAR(120) NOT NULL,
    name_ky         VARCHAR(120),
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    config          JSONB NOT NULL DEFAULT '{}',              -- ключи API, sandbox/prod, лимиты
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO payment_providers (code, name_ru, name_ky, enabled, sort_order)
VALUES ('MANUAL', 'Перевод на Kaspi', 'Kaspi которуу', TRUE, 1);
```

### 4.9. webhook_events (резерв)

```sql
CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code   VARCHAR(32) NOT NULL REFERENCES payment_providers(code),
    event_type      VARCHAR(64) NOT NULL,
    external_id     VARCHAR(255),                             -- ID события у провайдера
    payload         JSONB NOT NULL,
    signature       VARCHAR(512),
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PROCESSED','FAILED','SKIPPED')),
    attempts        INTEGER NOT NULL DEFAULT 0,
    error           TEXT,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    UNIQUE (provider_code, external_id)
);
CREATE INDEX idx_webhook_status ON webhook_events(status, received_at);
```

`UNIQUE (provider_code, external_id)` — гарантия идемпотентности при повторной доставке.

### 4.10. settings (глобальные key-value)

```sql
CREATE TABLE settings (
    key             VARCHAR(120) PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Сидим:
INSERT INTO settings (key, value, description) VALUES
  ('site.support_phone', '"+996700000000"', 'Контакт поддержки'),
  ('site.support_whatsapp', '"+996700000000"', 'WhatsApp поддержки'),
  ('payments.manual_instructions_ru', '"Переведите на Kaspi ..."', 'Инструкция для ручной оплаты'),
  ('payments.manual_instructions_ky', '"Kaspi номерине которуңуз ..."', 'Кыргызча');
```

### 4.11. feature_flags

```sql
CREATE TABLE feature_flags (
    key             VARCHAR(120) PRIMARY KEY,
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percent INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('category.site.enabled',          TRUE,  'Категория сайт-приглашений доступна'),
  ('category.video.enabled',         TRUE,  'Категория видео-приглашений доступна'),
  ('signup.enabled',                 TRUE,  'Открыта регистрация новых пользователей'),
  ('payments.auto_providers_enabled',FALSE, 'Включены автоматические провайдеры оплаты'),
  ('block.location.enabled',         TRUE,  'Блок локации в шаблонах'),
  ('block.timeline.enabled',         TRUE,  'Блок расписания');
```

### 4.12. audit_log

```sql
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    actor_user_id   UUID REFERENCES users(id),
    actor_role      VARCHAR(32),
    action          VARCHAR(64) NOT NULL,                     -- 'PAYMENT_CONFIRM', 'TEMPLATE_PUBLISH', 'USER_BLOCK'
    target_type     VARCHAR(32),                              -- 'event', 'template', 'user', 'payment'
    target_id       VARCHAR(64),
    metadata        JSONB NOT NULL DEFAULT '{}',
    ip_address      INET,
    user_agent      VARCHAR(512),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_actor       ON audit_log(actor_user_id, created_at);
CREATE INDEX idx_audit_target      ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_action      ON audit_log(action, created_at);
```

`BIGSERIAL` (а не UUID) — потому что лог-таблицы пишутся часто, и sequence-PK дешевле, и они не вылезают в API.

### 4.13. translations

```sql
CREATE TABLE translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace       VARCHAR(64) NOT NULL,                     -- 'landing', 'editor', 'admin', 'errors'
    key             VARCHAR(255) NOT NULL,                    -- 'hero.title'
    locale          VARCHAR(8) NOT NULL CHECK (locale IN ('ru','ky')),
    value           TEXT NOT NULL,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace, key, locale)
);
CREATE INDEX idx_translations_ns_locale ON translations(namespace, locale);
```

### 4.14. otp_codes (для WhatsApp/SMS)

```sql
CREATE TABLE otp_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(16) NOT NULL,
    code_hash       VARCHAR(72) NOT NULL,                     -- bcrypt
    channel         VARCHAR(16) NOT NULL CHECK (channel IN ('WHATSAPP','SMS')),
    purpose         VARCHAR(32) NOT NULL                      -- 'SIGNUP', 'LOGIN', 'PHONE_CHANGE'
                    CHECK (purpose IN ('SIGNUP','LOGIN','PHONE_CHANGE')),
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 5,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_phone_active ON otp_codes(phone) WHERE consumed_at IS NULL;
```

`code_hash` — хешируем код. Если БД утечёт, OTP-коды бесполезны.

### 4.15. event_video_downloads (метрика для VIDEO)

```sql
CREATE TABLE event_video_downloads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id),
    user_id         UUID REFERENCES users(id),
    quality         VARCHAR(8) NOT NULL CHECK (quality IN ('TRIAL','FULL')),
    export_token_id UUID,
    duration_ms     INTEGER,                                  -- сколько занял рендер
    user_agent      VARCHAR(512),
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_video_downloads_event ON event_video_downloads(event_id);
```

### 4.16. Резюме индексов и FK

- **Soft references (без FK):** `audit_log.actor_user_id` если хочется удалять пользователей (но мы используем soft-delete, так что FK можно). Везде остальные — жёсткие FK с `ON DELETE RESTRICT`.
- **JSONB используется:** `event_config_json`, `templates.metadata`, `template_versions.schema_json`, `payments.metadata`, `webhook_events.payload`. Везде где данные структурно изменчивы и не индексируются по содержимому.
- **GIN-индексы на JSONB:** не строим на старте, добавим при первом фильтре по содержимому.

---

## Раздел 5. API Архитектура

### 5.1. Версионирование

- Все маршруты под `/api/v1/`.
- Spring controller базовый class `@RequestMapping("/api/v1/...")`.
- Стратегия миграции на v2: при breaking-изменении создаём `/api/v2/...` и держим v1 минимум 6 месяцев. JS-клиент явно использует `/api/v1/`. Версионирование по URL (а не по header `Accept`) — удобнее дебажить, легче для CDN-кеша.

### 5.2. Namespace-ы

```
/api/v1/admin/...        — только SUPER_ADMIN, JWT scope=admin
/api/v1/client/...       — авторизованный CLIENT (своими событиями)
/api/v1/organizer/...    — РЕЗЕРВ для B2B, на старте отдают 501 Not Implemented
/api/v1/pub/...          — публичные эндпоинты без авторизации (RSVP, чтение события)
/api/v1/auth/...         — OTP, login, refresh
/api/v1/webhooks/...     — приём webhook-ов от платёжных провайдеров (резерв)
```

### 5.3. Аутентификация

**Выбор: JWT access (15 минут) + opaque refresh (30 дней) в HttpOnly cookie.**

| Вариант | Плюсы | Минусы | Вердикт |
|---|---|---|---|
| Stateless JWT в Authorization header | Просто масштабируется | Logout сложно (need denylist), CSRF не страшен но XSS критичен | Часть |
| Server session (Spring Session) | Тривиальный logout, работает | Состояние в Redis или БД — лишняя инфра на старте | Не сейчас |
| **JWT access + refresh в HttpOnly cookie** | XSS не достанет refresh, logout = удалить refresh из БД | Чуть больше кода | **Выбрано** |

`refresh_tokens` таблица:
```sql
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    token_hash  VARCHAR(72) NOT NULL,
    user_agent  VARCHAR(512),
    ip_address  INET,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

OTP flow (см. раздел 10.2 для UX).

### 5.4. Rate limiting

Bucket4j, in-memory, единый `@Component`.

| Эндпоинт | Лимит | Ключ |
|---|---|---|
| `POST /api/v1/auth/otp/send` | 3 / минуту, 10 / сутки | phone |
| `POST /api/v1/auth/otp/verify` | 10 / минуту | phone |
| `POST /api/v1/auth/login` | 5 / минуту | IP |
| `POST /api/v1/pub/rsvp/{slug}` | 30 / минуту | IP+slug |
| `POST /api/v1/client/events` | 10 / минуту, 50 / сутки | user_id |
| `POST /api/v1/admin/*` | 100 / минуту | user_id |

При превышении — `429 Too Many Requests` с `Retry-After`.

### 5.5. Идемпотентность

`Idempotency-Key` header для:
- `POST /api/v1/client/events` (создание события)
- `POST /api/v1/client/payments/intent` (инициация платежа)
- `POST /api/v1/admin/payments/{id}/confirm` (ручное подтверждение)
- `POST /api/v1/webhooks/{provider}` (через `webhook_events.external_id`)

Реализация: таблица `idempotency_keys (key, user_id, response_json, created_at, expires_at)`. При повторном запросе с тем же key — возвращаем сохранённый ответ.

### 5.6. Список endpoint-ов

#### `/api/v1/auth/`
```
POST   /otp/send                    — отправить OTP на WhatsApp/SMS
POST   /otp/verify                  — проверить OTP, выдать access+refresh
POST   /admin/login                 — email+password+TOTP для SUPER_ADMIN
POST   /refresh                     — обновить access по refresh
POST   /logout                      — отозвать refresh
GET    /me                          — текущий пользователь
```

#### `/api/v1/admin/` (SUPER_ADMIN)
```
GET    /dashboard/metrics           — KPI dashboard

GET    /templates                   — список с фильтрами
GET    /templates/{id}              — детали + все версии
POST   /templates                   — создать (мета без файлов)
PUT    /templates/{id}              — обновить мета (название, цена)
POST   /templates/{id}/versions     — загрузить новую версию (zip)
POST   /templates/{id}/publish      — активировать
POST   /templates/{id}/archive      — архивировать
DELETE /templates/{id}              — soft delete
GET    /templates/{id}/stats        — статистика по шаблону

GET    /events                      — все события с фильтрами
GET    /events/{id}                 — полные данные
POST   /events/{id}/activate        — ручная активация (paid)
POST   /events/{id}/cancel          — отмена

GET    /payments                    — все платежи
GET    /payments/{id}
POST   /payments/{id}/confirm       — ручное подтверждение (Idempotency-Key)
POST   /payments/{id}/refund

GET    /users                       — поиск/фильтры
GET    /users/{id}
POST   /users/{id}/block
POST   /users/{id}/unblock
POST   /users/{id}/impersonate      — выдаёт временный JWT для входа под клиентом

GET    /feature-flags
PUT    /feature-flags/{key}

GET    /settings
PUT    /settings/{key}

GET    /translations?namespace=...
PUT    /translations/{ns}/{key}/{locale}

GET    /audit-log

GET    /webhook-events              — для дебага платёжных интеграций
POST   /webhook-events/{id}/replay
```

#### `/api/v1/client/` (CLIENT)
```
GET    /events                      — мои события
POST   /events                      — создать (Idempotency-Key)
GET    /events/{id}                 — мои данные
PUT    /events/{id}                 — обновить event_config_json (drafts)
DELETE /events/{id}                 — soft delete
POST   /events/{id}/publish         — попытка опубликовать (требует paid)

POST   /events/{id}/payment-intent  — инициировать оплату (Idempotency-Key)
GET    /events/{id}/payments        — история платежей по событию

POST   /events/{id}/video-export-token  — выдать токен для экспорта (только VIDEO + paid)

GET    /events/{id}/rsvp            — список ответов гостей
DELETE /events/{id}/rsvp/{rsvpId}   — удалить отдельный ответ

POST   /uploads                     — загрузить фото (multipart, лимит размера)
DELETE /uploads/{id}

GET    /catalog/templates?category=&occasion=&locale=  — публичный каталог
GET    /catalog/templates/{slug}    — детали шаблона
```

#### `/api/v1/pub/` (без авторизации)
```
GET    /e/{slug}                    — публичная страница SITE-события (через Thymeleaf, может отдаваться вне /api/)
GET    /v/{slug}                    — метаданные VIDEO-события (для шаринг-страницы с превью)
GET    /events/{slug}/public        — публичный JSON (имена, дата, RSVP-конфиг — без приватных данных)
POST   /rsvp/{slug}                 — ответ гостя (rate-limited)
GET    /rsvp/{slug}/me?phone=...    — гость может посмотреть свой ответ по номеру

GET    /feature-flags               — публичные флаги (категории)
GET    /catalog/templates           — каталог для лендинга
GET    /translations?namespace=landing&locale=ky  — переводы для статичных страниц
```

#### `/api/v1/organizer/` (резерв B2B)

Все маршруты возвращают `501 Not Implemented` со ссылкой на форму ожидания.

#### `/api/v1/webhooks/` (резерв)
```
POST   /odengi
POST   /mbank
POST   /optima
POST   /megapay
POST   /balance
```

Эндпоинты создаются сейчас, но возвращают `204` без обработки. Это даёт возможность зарегистрировать URL у провайдера до интеграции.

---

## Раздел 6. Frontend Архитектура (Vanilla JS)

### 6.1. Структура static/

```
src/main/resources/static/
├── css/
│   ├── tailwind.css          # сгенерированный output (без webpack — Tailwind CLI)
│   └── editor.css            # минимальные оверрайды
├── js/
│   ├── lib/                  # вендоры (без npm)
│   │   ├── alpine.min.js     # для маленьких реактивных вкраплений (опционально)
│   │   └── ...
│   ├── core/
│   │   ├── api.js            # fetch-обёртка с авторизацией
│   │   ├── router.js         # клиентский роутер для редактора
│   │   ├── store.js          # state с Proxy + listeners
│   │   ├── i18n.js           # геттер переводов
│   │   ├── events.js         # event bus
│   │   └── http-errors.js
│   ├── components/
│   │   ├── modal.js
│   │   ├── bottom-sheet.js
│   │   ├── toast.js
│   │   ├── form-field.js
│   │   └── ...               # каждый — одна функция, рендерит DOM
│   ├── pages/
│   │   ├── landing.js
│   │   ├── catalog.js
│   │   ├── editor/
│   │   │   ├── index.js      # bootstrap
│   │   │   ├── state.js
│   │   │   ├── renderer-site.js
│   │   │   ├── renderer-video.js
│   │   │   ├── exporter-video.js
│   │   │   ├── blocks/       # по блоку на файл
│   │   │   │   ├── hero.js
│   │   │   │   ├── couple.js
│   │   │   │   ├── timeline.js
│   │   │   │   └── rsvp.js
│   │   │   └── schema-form.js
│   │   ├── admin/
│   │   │   ├── dashboard.js
│   │   │   ├── templates.js
│   │   │   ├── payments.js
│   │   │   └── ...
│   │   └── public/
│   │       └── rsvp.js
│   └── importmap.json        # генерируется на старте Spring или статичен
├── img/
├── fonts/
└── uploads/                  # serve через nginx, не Spring
```

### 6.2. Без бандлера — ES Modules + Import Maps

**В index.html:**
```html
<script type="importmap">
{
  "imports": {
    "@core/": "/static/js/core/",
    "@components/": "/static/js/components/",
    "@pages/": "/static/js/pages/"
  }
}
</script>
<script type="module" src="/static/js/pages/editor/index.js"></script>
```

**Tailwind** запускается отдельной командой `npx tailwindcss -i input.css -o static/css/tailwind.css --watch` в dev и `--minify` в prod. **Не jit через CDN** — это ломается на медленных каналах KG.

### 6.3. Routing для редактора

Редактор — одна страница `/editor/{eventId}`. Внутри между блоками — смена URL через History API:
```js
// core/router.js
export function navigate(path, state = {}) {
  history.pushState(state, '', path);
  window.dispatchEvent(new CustomEvent('route:change', { detail: { path, state } }));
}
window.addEventListener('popstate', e => /* re-render */);
```

Не хеш-роутер — он ломает SEO для публичных страниц и не нужен внутри редактора. Простого pushState достаточно.

### 6.4. State Management

**Свой micro-store на Proxy + EventTarget:**

```js
// core/store.js
export function createStore(initial) {
  const listeners = new Set();
  const state = new Proxy(structuredClone(initial), {
    set(t, k, v) { t[k] = v; listeners.forEach(fn => fn(t, k)); return true; }
  });
  return {
    state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    dispatch: (mutator) => mutator(state)
  };
}
```

Размер — 30 строк. Никакого Redux. Для редактора одного `appStore` достаточно. Между блоками синхронизация через подписки.

### 6.5. Code Splitting

Через `import()`:
```js
// pages/editor/index.js
const category = await loadEvent();
const renderer = category === 'VIDEO'
  ? await import('./renderer-video.js')
  : await import('./renderer-site.js');
```

Браузеры кешируют отдельные модули → клиент с site-приглашением никогда не грузит `renderer-video.js` (~80 KB).

### 6.6. UI-компоненты

**Выбор: чистые функции, возвращающие DOM-узлы. Без Web Components, без template literals.**

```js
// components/modal.js
export function modal({ title, content, actions = [] }) {
  const el = document.createElement('div');
  el.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
  el.innerHTML = `<div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
    <h2 class="text-xl font-semibold">${escape(title)}</h2>
    <div class="mt-4">${content}</div>
    <div class="mt-6 flex gap-2 justify-end" data-actions></div>
  </div>`;
  // ... рендерим actions
  return { el, close: () => el.remove() };
}
```

**Сравнение:**

| Подход | Плюсы | Минусы | Вердикт |
|---|---|---|---|
| Web Components (CustomElement) | Стандарт, инкапсуляция | Shadow DOM ломает Tailwind, нужен polyfill для старых WebView | Нет |
| Template literals + lit-html | DX похож на React | Зависимость 5 KB и менталка «я пишу JSX» | Нет |
| **Чистые функции** | Ноль абстракций, читается линейно, Tailwind работает | «Мутаций» больше | **Да** |

Принцип: одна папка `components/`, у каждого файла один экспорт-функция.

### 6.7. editor.js не должен быть 2000 строк

Применяем:
- **Файл по блоку** (`blocks/hero.js`, `blocks/timeline.js`...) — каждый экспортирует `{ render(state), validate(state) }`.
- **Event bus** для cross-block коммуникаций (изменение пары → пересчёт расписания).
- **State machine** для статуса редактора: `IDLE → DIRTY → SAVING → SAVED → ERROR`. Каждый переход — единственный путь, никаких boolean-спагетти.

```js
// core/state-machine.js
const transitions = {
  IDLE:   { EDIT: 'DIRTY' },
  DIRTY:  { SAVE: 'SAVING' },
  SAVING: { OK: 'SAVED', FAIL: 'ERROR' },
  SAVED:  { EDIT: 'DIRTY' },
  ERROR:  { RETRY: 'SAVING', EDIT: 'DIRTY' }
};
```

### 6.8. Публичная страница `/e/{slug}`

**Выбор: server-side render через Thymeleaf для SITE.**

| Подход | SEO | OG-превью в WhatsApp | TTI |
|---|---|---|---|
| **Thymeleaf SSR** | Идеальный | Идеальный (мета-теги в HTML) | Лучший |
| Client-side render | Никакой без prerender | Сломается без crawl-fallback | Хуже на 2G |

Для VIDEO-приглашений `/v/{slug}` — тоже SSR, но без интерактивного редактирования. Страница содержит:
- OG-теги (`og:image` = preview из шаблона + наложенные имена пары через серверный image-rendering)
- Кнопку «Сгенерировать видео» (открывает редактор/экспортёр)
- Видео-превью (mp4 из шаблона, не сгенерированное клиентом)

**OG-превью с динамическими именами:** на сервере генерируем JPG 1200×630 через ImageIO + базовое наложение текста на preview-фон. Кешируем результат как `og/{event_id}.jpg`. Это занимает 200 строк Java и решает огромную проблему «как WhatsApp покажет приглашение в чате».

---

## Раздел 7. Система шаблонов

### 7.1. Структура на диске

См. раздел 2.4. Корневая папка — `template_storage_path` из `application.yaml` (по умолчанию `/var/toilink/templates/`). Каждая версия — подпапка `v{N}`:

```
templates_storage/
└── site/
    └── wedding-elegant-1/
        ├── v1/
        │   ├── meta.json
        │   ├── schema.json
        │   ├── index.html
        │   └── assets/...
        ├── v2/...
        └── current -> v3   # симлинк на текущую опубликованную версию
```

### 7.2. Загрузка через админку

**Формат: ZIP-архив.**

| Вариант | Плюсы | Минусы |
|---|---|---|
| **ZIP** | Атомарно, легко версионировать, фронт прост | Нужно валидировать содержимое |
| Множественная загрузка файлов | Можно править отдельные файлы | Нет атомарности, частичные обновления |

Только ZIP. Файлы по отдельности — против атомарности версий.

### 7.3. Валидация при загрузке

Спринг-сервис `TemplateUploadService.validateAndStore(MultipartFile zip)`:

1. **Размер ZIP** — лимит 50 MB (site), 200 MB (video с ассетами).
2. **Распаковка во временную папку** (`/tmp/template-upload-{uuid}/`).
3. **Защита от Zip Slip:** каждый entry path нормализуется и проверяется, что он остаётся внутри temp-папки.
4. **Обязательные файлы:** `meta.json`, `schema.json`, `preview.jpg`. Для site — `index.html`. Для video — `scenes.json`, как минимум одна сцена.
5. **`meta.json` парсится строго:** `name_ru`, `name_ky` (опционально), `version` (int), `category` (должна совпадать с выбранной в админке), `author`.
6. **`schema.json`:** валидируется через JSON Schema мета-схему (наша). Каждое поле имеет `id`, `type` (text/textarea/date/datetime/photo/photos/select/color/toggle), опционально `required`, `default`, `validation`, `visible_when`.
7. **`index.html` (site):** проверяем, что нет `<script src="http">`, нет `<iframe>` без allowlist, нет `eval`. Передаём через **OWASP Java HTML Sanitizer** в режиме allowlist для template-tags. Это не гарантирует 100% безопасности, но отсекает наивные XSS.
8. **Ассеты:** MIME через Apache Tika. Запрещены: `.exe`, `.js` (кроме `editor.js` если разрешён), `.html` кроме корневого, `.svg` (могут содержать onload).
9. **Шрифты:** только WOFF2.
10. **Audio (video):** только mp3/aac, длина ≥ длительности видео, размер ≤ 5 MB.
11. **Превью-картинка:** проверка размеров, минимум 1080×1920 для каталога.
12. Если всё ОК — папка перемещается в `templates_storage/{category}/{slug}/v{N}/`, в БД создаётся `template_versions` запись со статусом `DRAFT`.

### 7.4. Песочница draft-шаблонов

Шаблон загружен → `template.status = DRAFT`. В публичном каталоге не виден. Просмотр доступен по специальной ссылке `/admin/templates/{id}/preview` или `/e/preview/{template_version_id}/{seed}` где `seed` — детерминированный набор тестовых данных. Можно поделиться ссылкой с тестировщиками.

### 7.5. A/B тест двух версий

**На старте — не реализуем.** Рынок KG слишком мал для статистически значимого A/B на одном шаблоне. Резервируем поле `templates.metadata->>'ab_group'`. Если потребуется — добавим простое: новые события с шансом 50% получают v3, 50% — v2; через месяц смотрим конверсию в paid.

### 7.6. Версионирование при обновлении шаблона

**Решение: lock версии в момент создания события.**

```
event.template_version_id = templates.current_version_id (на момент POST /events)
```

Когда суперадмин загружает v3:
- `current_version_id` обновляется → новые события идут на v3.
- Существующие события на v1, v2 продолжают работать.
- В админке шаблона видно сколько событий на какой версии.

**Когда удалять старые версии:** ручная команда суперадмина «архивировать v1». Перед удалением показывает «N активных событий используют эту версию, миграция требуется». Это редкая операция.

### 7.7. Откат плохой версии

Один клик в админке: `current_version_id` возвращается на предыдущий. v3 переходит в статус `DRAFT`. Существующие события на v3 — остаются (есть кнопка «миграция всех на v2»).

### 7.8. Спецификация schema.json

```json
{
  "version": 1,
  "blocks": [
    {
      "id": "hero",
      "name_ru": "Шапка",
      "name_ky": "Башы",
      "fields": [
        {
          "id": "couple_names",
          "type": "text",
          "label_ru": "Имена пары",
          "label_ky": "Жубайлардын аттары",
          "required": true,
          "default": "Айгуль & Бакыт",
          "validation": { "max_length": 60, "min_length": 2 },
          "placeholder_ru": "Например: Айгуль & Бакыт"
        },
        {
          "id": "wedding_date",
          "type": "datetime",
          "required": true,
          "validation": { "min": "now", "max": "now+2y" }
        },
        {
          "id": "hero_photo",
          "type": "photo",
          "validation": { "max_size_mb": 8, "aspect": "9:16" }
        }
      ]
    },
    {
      "id": "location",
      "fields": [
        {
          "id": "venue_name",
          "type": "text",
          "visible_when": "blocks.location.show == true"
        }
      ]
    }
  ]
}
```

**Типы полей:** `text`, `textarea`, `richtext`, `date`, `datetime`, `time`, `photo`, `photos` (массив), `select`, `radio`, `toggle`, `color`, `coordinates` (для карты), `phone`.

### 7.9. Schema site vs video

| Свойство | site | video |
|---|---|---|
| Структура | Список блоков с полями | Список сцен с привязкой полей к layers |
| `block.id` обязателен | да | нет (привязка к scenes.json через `field` в layer) |
| Поле `photo` | хранится как `<img>` в HTML | передаётся в Canvas как ImageBitmap |
| Поле `coordinates` | да (Google/2GIS embed) | нет |
| Поле `timeline` | массив объектов | нет (видео — короткое) |
| Поле `rsvp` | да | нет (видео — share, не RSVP) |

Один JSON Schema-валидатор работает с обеими — отличается только список разрешённых блоков на категорию.

---

## Раздел 8. Система оплаты

### 8.1. PaymentProvider интерфейс

```java
public interface PaymentProvider {
    String code();
    boolean isEnabled();

    /** Инициирует платёж, возвращает данные для UX (redirect URL, QR, инструкция). */
    PaymentInitResult initiate(PaymentInitRequest req);

    /** Активная проверка статуса (для polling, если webhook ещё не пришёл). */
    PaymentStatus checkStatus(Payment payment);

    /** Обработка webhook-а от провайдера. */
    WebhookProcessResult processWebhook(String rawPayload, Map<String, String> headers);

    /** Возврат средств (если поддерживается). */
    RefundResult refund(Payment payment, int amountKgs, String reason);
}

public record PaymentInitRequest(
    UUID paymentId, UUID eventId, UUID userId,
    int amountKgs, String description,
    String successUrl, String cancelUrl,
    String idempotencyKey
) {}

public record PaymentInitResult(
    String redirectUrl,        // для шлюзов с redirect
    String qrCodeData,         // для O!Dengi QR
    String instructionRu,      // для MANUAL
    String instructionKy,
    Map<String, String> meta
) {}
```

### 8.2. ManualPaymentProvider

```java
@Component
public class ManualPaymentProvider implements PaymentProvider {
    public String code() { return "MANUAL"; }
    public boolean isEnabled() { return true; }

    public PaymentInitResult initiate(PaymentInitRequest req) {
        return new PaymentInitResult(
            null, null,
            settings.get("payments.manual_instructions_ru"),
            settings.get("payments.manual_instructions_ky"),
            Map.of(
                "support_phone", settings.get("site.support_whatsapp"),
                "amount_kgs", String.valueOf(req.amountKgs())
            )
        );
    }

    public PaymentStatus checkStatus(Payment p) { return p.getStatus(); }
    public WebhookProcessResult processWebhook(String r, Map<String,String> h) {
        return WebhookProcessResult.skipped();
    }
    public RefundResult refund(Payment p, int a, String r) {
        return RefundResult.manual();
    }
}
```

Подтверждение делает суперадмин через `POST /api/v1/admin/payments/{id}/confirm` — этот эндпоинт не зависит от провайдера, он меняет `payment.status = SUCCESS` напрямую.

### 8.3. Что нужно подготовить для будущего ODengi/Mbank

**Чтобы добавление было одним классом:**

1. **Бизнес-логика покупки не знает про провайдера:** `EventService.requestPayment(eventId, providerCode)` → `PaymentService.initiate(...)` → `provider.initiate(...)`. Никакой `if (provider.equals("ODENGI"))` нигде в коде.
2. **Webhook endpoint существует уже сейчас:** `/api/v1/webhooks/odengi` зарегистрирован в Spring, возвращает `204 OK` (или `501`). Когда провайдер интегрируется — добавляется реализация, маршрут перехватывается классом.
3. **Idempotency** — на уровне `payments.idempotency_key` UNIQUE. Webhook создаёт `webhook_events` row с UNIQUE по `(provider, external_id)` → дубль игнорируется.
4. **Retry policy:** `webhook_events.attempts` инкрементируется, если `processWebhook` бросает исключение, ставится `status=PENDING`, отдельный scheduled-job перепрашивает.
5. **Конфиги в БД (`payment_providers.config`):** API-ключи, sandbox-флаг — не в `application.yaml`. Это позволяет суперадмину менять ключи без рестарта (только через restricted UI с маскированием).

### 8.4. Webhook-инфраструктура (резерв)

```java
@RestController
@RequestMapping("/api/v1/webhooks")
public class WebhookController {
    @PostMapping("/{providerCode}")
    public ResponseEntity<?> receive(
        @PathVariable String providerCode,
        @RequestBody String rawPayload,
        @RequestHeader Map<String, String> headers
    ) {
        // 1. Сохранить в webhook_events со status=PENDING
        // 2. Try processSync (для быстрых провайдеров)
        // 3. Если timeout/fail — status=PENDING, обработка в фоне
        // 4. Вернуть 200 (важно: 200 даже при бизнес-ошибке, иначе провайдер ретраит)
    }
}
```

Scheduled job `WebhookRetryJob` каждую минуту берёт `webhook_events` с `status=PENDING AND attempts<5`, обрабатывает.

### 8.5. Когда клиент платит

**Решение: оплата запрашивается при попытке "Опубликовать событие" (после кастомизации, до публичного шаринга).**

| Момент | Плюсы | Минусы | Вердикт |
|---|---|---|---|
| Сразу при выборе шаблона | Быстрый деньги в кассу | Высокий drop-off, пользователь не вложился | Нет |
| После кастомизации, при сохранении первого блока | Слишком рано | Пользователь думал "сохранение бесплатно" | Нет |
| **При попытке опубликовать (нажатии "Поделиться ссылкой")** | Пользователь уже вложил время → высокий commitment, видит готовое приглашение | Тратится бэк-серверу (хранятся черновики) | **Выбрано** |
| Только при первом RSVP-открытии | Нечестно по отношению к гостям | Слишком поздно | Нет |

Для VIDEO — оплата запрашивается **при попытке экспорта без watermark** (см. раздел 3.5). Watermark-версию можно скачать бесплатно — это маркетинг.

### 8.6. Что показывается до/после оплаты

| Состояние | Site | Video |
|---|---|---|
| `DRAFT` | Только владелец видит, доступ через `/editor/{id}` | Только владелец, экспорт с watermark разрешён |
| `PENDING_PAYMENT` | Публичный URL `/e/{slug}` отдаёт страницу-заглушку «Событие готовится» | Экспортится с watermark; модалка «оплатите для full HD без watermark» |
| `ACTIVE` (paid) | Полный публичный доступ | Экспорт без watermark в 1080p |
| `ARCHIVED` | 410 Gone (или на отдельную страницу-память) | то же |

### 8.7. Trial / черновик

- **Полный черновик бесплатно, бессрочно.** Фактор удержания — без давления.
- **Лимит черновиков на пользователя:** 5 (защита от спама).
- **Watermark/preview:** для site — видна попытка по `/editor/{id}` (внутренняя для владельца, не публичная). Для video — экспорт работает, но с watermark.
- **Конверсия:** лучше иметь 100 черновиков и 20 оплат, чем 200 регистраций без черновиков. Эффект «завершённости» — главный driver покупки в KG.

### 8.8. Статусы платежей и переходы

```
PENDING ──initiate──> PROCESSING ──provider OK──> SUCCESS
   │                       │
   │                       └──provider FAIL──> FAILED
   │
   └──manual confirm──> SUCCESS (без PROCESSING)
   └──expire (24h)──> EXPIRED

SUCCESS ──admin refund──> REFUNDED
```

- `PENDING` — payment row создан, провайдер ещё не уведомлён.
- `PROCESSING` — провайдер принял (для авто-шлюзов), ждём webhook.
- `SUCCESS` — оплачено, событие активируется автоматически (`event.status = ACTIVE`, `event.paid_at = NOW()`).
- `FAILED` — провайдер вернул ошибку, причина в `failure_reason`.
- `EXPIRED` — пользователь не доплатил за 24 часа.
- `REFUNDED` — суперадмин отменил, событие → `ARCHIVED`.

Переходы — в `PaymentStateMachine`, не в произвольных update-ах. Каждый переход пишет `audit_log`.

---

## Раздел 9. Админ-панель

### 9.1. Управление шаблонами

```
/admin/templates
├── список с фильтрами: категория, статус, occasion
├── поиск по slug/name
├── сорт по: created_at, sort_order, popularity
├── батч-операции: активировать/архивировать выбранные

/admin/templates/{id}
├── основная инфо (название, описание, цена)
├── список версий с кнопкой "опубликовать" / "откатить"
├── загрузка новой версии (ZIP)
├── статистика: купили N раз, конверсия из preview, средний чек
├── активные события на каждой версии
└── архивирование (с предупреждением о N событиях)

/admin/templates/{id}/upload
├── drag&drop ZIP
├── progress-bar валидации
├── live preview как только валидация прошла
├── changelog для версии
└── кнопка "опубликовать" (DRAFT → ACTIVE)
```

**Изменение цены без деплоя:** `PUT /api/v1/admin/templates/{id}` обновляет `price_kgs`. Существующие события не пересчитываются (цена зафиксирована в `payments.amount_kgs` при инициации).

**Архивирование:** `templates.status = ARCHIVED`, `archived_at` ставится. Из публичного каталога исчезает мгновенно. Существующие события продолжают работать (template_version_id защищает).

### 9.2. Ручное подтверждение оплат

```
/admin/payments
├── фильтры: статус, провайдер, период, сумма
├── поиск: phone клиента, slug события, txn_id
├── inline-кнопка "подтвердить" на PENDING/PROCESSING

/admin/payments/{id}/confirm
├── модалка с подтверждением
├── обязательное поле: метод оплаты ("Kaspi на карту", "Mbank QR", "Наличными")
├── обязательное поле: внешний reference (последние 4 цифры карты, txn-id из Kaspi)
├── комментарий
└── кнопка → POST /api/v1/admin/payments/{id}/confirm с Idempotency-Key
```

Запись в `audit_log`:
```json
{
  "action": "PAYMENT_CONFIRM",
  "target_type": "payment", "target_id": "uuid",
  "metadata": {
    "amount_kgs": 1500, "method": "kaspi_transfer",
    "external_ref": "1234", "comment": "Подтверждено в WhatsApp"
  }
}
```

### 9.3. Feature Flags

```
/admin/feature-flags
├── список всех флагов с toggle
├── при выключении category.* — модалка с предупреждением
├── log изменений в audit_log
```

UI ультра-простой: список + чекбоксы. Не строим систему таргетинга на старте.

### 9.4. Управление пользователями

```
/admin/users
├── фильтры: role, locale, payment_status (есть/нет paid event), создан за период
├── поиск по phone/email/name/event_slug
├── inline-actions: блок, разблок, impersonate

/admin/users/{id}
├── профиль
├── список событий с статусами
├── список платежей
├── audit log действий пользователя
├── кнопка impersonate → выдаёт JWT с claim impersonator=admin_id
└── кнопка "soft delete" (deleted_at = NOW)
```

**Impersonation:** `POST /admin/users/{id}/impersonate` → возвращает JWT с `sub=user_id, impersonator=admin_id, exp=15min`. Frontend сохраняет в session storage (не в куки!), при использовании показывает красную плашку «Вы вошли как X». Все действия пишутся в audit_log с `impersonator` пометкой.

**Импорт/экспорт:** на старте — CSV-экспорт пользователей. Импорт не нужен (нет миграции откуда).

### 9.5. Аналитика

#### 9.5.1. Воронка конверсии

```sql
-- Лендинг → регистрация → создание события → оплата
WITH funnel AS (
  SELECT
    DATE_TRUNC('day', u.created_at)        AS day,
    u.utm_source,
    COUNT(DISTINCT u.id)                                                 AS signups,
    COUNT(DISTINCT e.owner_user_id)                                      AS users_with_event,
    COUNT(DISTINCT CASE WHEN p.status='SUCCESS' THEN e.owner_user_id END) AS users_with_payment
  FROM users u
  LEFT JOIN events e   ON e.owner_user_id = u.id AND e.deleted_at IS NULL
  LEFT JOIN payments p ON p.event_id = e.id
  WHERE u.created_at >= NOW() - INTERVAL '30 days'
    AND u.role = 'CLIENT'
  GROUP BY day, u.utm_source
)
SELECT * FROM funnel ORDER BY day DESC, signups DESC;
```

Лендинг-визиты — отдельно через простой `landing_visits` (см. раздел 13.11) или Plausible/Umami.

#### 9.5.2. Популярность шаблонов

```sql
SELECT
  t.slug, t.name_ru, t.category,
  COUNT(e.id)                                          AS events_total,
  COUNT(CASE WHEN e.status='ACTIVE' THEN 1 END)        AS events_paid,
  SUM(CASE WHEN p.status='SUCCESS' THEN p.amount_kgs END) AS revenue_kgs,
  ROUND(100.0 * COUNT(CASE WHEN e.status='ACTIVE' THEN 1 END) / NULLIF(COUNT(e.id),0), 2) AS conversion_pct
FROM templates t
LEFT JOIN events   e ON e.template_id = t.id
LEFT JOIN payments p ON p.event_id = e.id
WHERE t.created_at >= NOW() - INTERVAL '90 days'
GROUP BY t.id
ORDER BY events_paid DESC;
```

#### 9.5.3. Время от регистрации до оплаты

```sql
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (p.confirmed_at - u.created_at))/3600) AS median_hours,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (p.confirmed_at - u.created_at))/3600) AS p90_hours,
  COUNT(*) AS sample
FROM users u
JOIN events e   ON e.owner_user_id = u.id
JOIN payments p ON p.event_id = e.id AND p.status = 'SUCCESS'
WHERE u.created_at >= NOW() - INTERVAL '90 days';
```

#### 9.5.4. UTM источники

```sql
SELECT
  utm_source, utm_medium, utm_campaign,
  COUNT(*)                                      AS signups,
  COUNT(DISTINCT e.id)                          AS events_created,
  SUM(CASE WHEN p.status='SUCCESS' THEN 1 ELSE 0 END) AS payments,
  SUM(CASE WHEN p.status='SUCCESS' THEN p.amount_kgs ELSE 0 END) AS revenue_kgs
FROM users u
LEFT JOIN events e   ON e.owner_user_id = u.id
LEFT JOIN payments p ON p.event_id = e.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY utm_source, utm_medium, utm_campaign
ORDER BY revenue_kgs DESC NULLS LAST;
```

#### 9.5.5. Распределение по локалям

```sql
SELECT
  u.locale,
  COUNT(*)                                                AS users,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status='ACTIVE')   AS paid_events,
  SUM(p.amount_kgs)    FILTER (WHERE p.status='SUCCESS')  AS revenue_kgs
FROM users u
LEFT JOIN events e   ON e.owner_user_id = u.id
LEFT JOIN payments p ON p.event_id = e.id
WHERE u.role = 'CLIENT' AND u.created_at >= NOW() - INTERVAL '90 days'
GROUP BY u.locale;
```

### 9.6. Контент

```
/admin/landing
├── секции (hero, benefits, templates, testimonials, faq, cta) — каждая редактируется
├── для каждой текстовой строки — поля ru / ky
└── preview перед публикацией

/admin/translations
├── фильтр по namespace (landing, editor, admin, errors)
├── inline-edit обоих языков
└── search по key или value

/admin/prices
└── батч-обновление price_kgs шаблонов
```

Хранение — в `translations` и `settings`. Без деплоя.

---

## Раздел 10. Лендинг и конверсия

### 10.1. Структура лендинга

Сверху вниз, mobile-first:

1. **Hero (above fold).** На KG-аудитории работает: крупное фото реального приглашения (не абстрактные иллюстрации) + 1 строка боли «Печатные приглашения дороги и теряются» + 1 строка решения «Создайте цифровое приглашение за 5 минут» + единственный CTA «Посмотреть шаблоны». **Никакой иллюстрации с компьютером и человеком в наушниках** — KG-аудитория не считывает stock-визуал.

2. **Социальное доказательство (сразу после hero).** Не отзывы (см. ниже), а **счётчики**: «1247 приглашений отправлено», «384 свадьбы в этом месяце». Цифры реальные (тянутся из БД), не накрученные.

3. **Каталог из 6-8 топовых шаблонов** с превью + ценой. На клик — открывается preview (не сразу editor — иначе пугаем). Пользователь видит, что есть выбор и за что платят.

4. **Видео-демо** генерации видео-приглашения. **15 секунд max.** Один сюжет: телефон → выбор → ввод имён → готовое видео в WhatsApp. Без озвучки, текст-плашки на ru. Лежит на CDN или встроенный mp4 (не YouTube — тормозит из KG).

5. **Как это работает (3-4 шага)** с иконками: «Выберите шаблон → Заполните данные → Оплатите → Поделитесь ссылкой».

6. **Цены** — открыто, без скрытий. Таблица: «Базовый шаблон 500 сом, Премиум 1500 сом». **Прятать цены до создания события** — это анти-паттерн для KG, low-trust рынок ненавидит «сначала зарегистрируйтесь».

7. **FAQ.** См. ниже.

8. **CTA блок** «Создать приглашение» в конце.

9. **Footer** с поддержкой WhatsApp (огромная зелёная кнопка).

### 10.2. Above-the-fold для KG

| Элемент | Решение |
|---|---|
| Заголовок | Конкретный и осязаемый: «Электронные приглашения для свадеб и тоев». Не «Платформа цифровых событий» — слишком абстрактно. |
| Подзаголовок | «От 500 сом. Готово за 5 минут. Никакой регистрации до оплаты». Снимаем три страха разом. |
| CTA | «Посмотреть шаблоны» (а не «Начать») — снижает commitment. |
| Визуал | Реальное приглашение на телефоне, желательно с местным антуражем (айтыш, тойхана) — не stock-фото из Unsplash. |
| Доверие | Маленький текст «1247 приглашений отправлено • Бишкек, КР». |

### 10.3. Социальное доказательство в KG

KG-пользователи **не оставляют публичных отзывов** — это культурная особенность. Используем:

- **Цифры активности** (счётчики) — они автоматически генерируются из БД.
- **WhatsApp-screenshot отзывов** — с разрешения клиента, размытое имя, скриншот с зелёным фоном WhatsApp. Это работает в KG, потому что выглядит «как настоящее».
- **Логотипы тойхана / организаторов** (когда они появятся) — даже один знакомый бренд = доверие.
- **Видео из соц-сетей реальных клиентов** (re-share в Instagram).
- **Phone-number поддержки в hero** — «Связаться: +996 XXX XXX XXX». Возможность позвонить = доверие.

Не используем накрученные звёздочки, искусственные счётчики «4.9 из 5» — это видно невооружённым глазом и вредит.

### 10.4. Видео-демо

- **Длина: 12-18 секунд.**
- **Формат: 9:16 для мобильного, 16:9 для desktop.** Два файла, через `<source media>`.
- **Что показывается:** реальный экран продукта, без анимаций «как мы клёвые». Это **демо продукта**, а не реклама.
- **Auto-play без звука + click for sound.** Без auto-play на мобиле теряется 70% впечатления.
- **Размер mp4 ≤ 3 MB** для 4G в провинции. Прежде чем заливать — `ffmpeg -crf 30`.

### 10.5. FAQ — обязательные для KG-клиента

1. **«Как я могу быть уверен, что заплатил и приглашение будет работать?»** — «После оплаты приходит подтверждение в WhatsApp в течение часа. Если не пришло — звоните +996...».
2. **«А если у моих гостей плохой интернет?»** — «Страница оптимизирована под 3G. Видео-приглашение скачивается один раз и работает офлайн».
3. **«Можно ли распечатать?»** — «Да, можно сохранить как PDF и распечатать. Но 95% наших клиентов отправляют в WhatsApp» (отвечаем на психологию + перенаправляем).
4. **«А если я ошибся в данных?»** — «Можно редактировать в любой момент даже после оплаты. Гости увидят актуальную версию».
5. **«Кто может видеть мою ссылку?»** — «Только те, кому вы её отправите. Поисковики не индексируют. Можно отключить RSVP».
6. **«А если ваш сервер упадёт перед свадьбой?»** — «Бэкапы каждые 6 часов, автовосстановление. Плюс гости могут скачать видео-приглашение себе».
7. **«Как оплатить?»** — пошаговая инструкция Kaspi-перевода со скриншотами. С упором на «понятный и привычный» процесс.
8. **«Сколько гостей можно пригласить?»** — «Без ограничений».
9. **«А если я не разбираюсь в технике?»** — «Помогаем по WhatsApp. Среднее время создания — 7 минут».
10. **«Можно ли изменить шаблон после оплаты?»** — «Можно поменять данные, но не сам шаблон. Если хотите другой — пишите, перенесём бесплатно».

FAQ — **аккордеон**, открытый по умолчанию первый вопрос (про оплату).

### 10.6. CTA повторение

| Место | Текст | Тон |
|---|---|---|
| Hero | «Посмотреть шаблоны» | Низкий commitment |
| После каталога | «Выбрать шаблон» | Прямой |
| После видео-демо | «Создать своё за 5 минут» | Бенефит |
| После цен | «Начать бесплатно» | Снимает страх |
| После FAQ | «Создать приглашение» | Закрытие |
| Sticky bottom-bar на mobile | «Создать» с зелёным фоном | Постоянно виден |

### 10.7. Регистрация — когда

**Решение: регистрация откладывается до момента сохранения первого черновика.**

| Момент | Drop-off |
|---|---|
| До создания (модалка на лендинге) | 70-80% |
| После выбора шаблона | 50-60% |
| **При попытке сохранить кастомизацию** | 20-30% |
| Только при оплате | <10%, но клиент уже устал |

Выбираем средний вариант — пользователь успевает потрогать продукт и почувствовать «это уже моё», но не успевает потерять час и злиться при неожиданной просьбе зарегистрироваться.

UX: при первом сохранении — bottom-sheet «Сохраним черновик. Введите номер телефона — придёт код в WhatsApp». Без email, без пароля.

### 10.8. Регистрация — как

**Решение: WhatsApp OTP основной канал, SMS fallback. Без email и пароля для CLIENT.**

| Канал | Доставляемость | Стоимость | Привычка KG | Вердикт |
|---|---|---|---|---|
| **WhatsApp OTP (через WABA)** | ~92% | ~$0.005 / отправка | Высокая | **Основной** |
| **SMS** | ~98% (но spam-фильтры на МегаФон) | ~$0.04 / отправка (8× дороже) | Высокая | **Fallback** если WhatsApp недоступен |
| Email + пароль | 60% (многие не имеют активного email) | $0 | Низкая | Нет |
| Magic link на email | то же | $0 | Низкая, не понимают | Нет |
| Telegram-бот | 30-40% (Telegram не доминирует в КР) | $0 | Средняя | Нет |
| Google OAuth | 50-60% (есть аккаунты, но пугаются) | $0 | Низкая, «зачем им мой Google» | Нет |

**Логика OTP:**
1. Пользователь вводит номер `+996 XXX XXX XXX` (формат E.164 с маской).
2. Сервер пытается отправить через WhatsApp Business API (например, через Twilio или прямой WABA).
3. Если в течение 60 секунд WhatsApp не подтвердил доставку — переключение на SMS (через локального оператора, например, Smsline.kg).
4. Код 6 цифр, TTL 5 минут, max 5 попыток.
5. После ввода — пользователь авторизован, refresh-токен на 30 дней. На том же устройстве не нужно вводить OTP заново.

**SUPER_ADMIN — отдельная схема:** email + пароль + TOTP (Google Authenticator). Не унифицирована с CLIENT, потому что ставки выше и человек один — ему не лень настроить TOTP.

**Двойная регистрация (телефон + email)?** Нет, только телефон. Email — опциональный профиль-филд для уведомлений (если клиент захочет получать чек на email). По умолчанию все коммуникации идут в WhatsApp.

### 10.9. Acquisition каналы

#### 10.9.1. Сравнение каналов

| Канал | Стоимость | Скорость | Качество лида | Вердикт для KG |
|---|---|---|---|---|
| **Instagram Ads (taргетинг по интересам "невесты")** | средняя | 1-3 дня | высокое | **Старт** |
| Instagram органика (Reels, посты) | низкая | 1-3 месяца | очень высокое | **Параллельно** |
| TikTok Ads | низкая | быстро | низкое (мало конверсии в КР) | Позже |
| TikTok органика | низкая | 1-3 месяца | средне | Параллельно |
| **Партнёрство с тойхана / залами** | низкая | 1-2 недели | очень высокое (рекомендация = доверие) | **Старт #2** |
| SEO «электронные приглашения Бишкек» | низкая | 3-6 месяцев | высокое | Запустить, ждать |
| Google Ads | средняя | 1-3 дня | среднее | Не сейчас (низкий поисковый объём) |
| Реферальная программа | $0 за лид | требует базы | высочайшее | После 100 первых клиентов |

**Что тестировать первым с минимальным бюджетом ($100-200):**

1. **Instagram Ads** на 2-3 креатива × 7 дней. Таргет: женщины 20-35, КР, интересы «невесты», «свадьба», «организация праздника». Бюджет $30-50/день. Креатив — короткие 9:16 видео генерации приглашения.

2. **Партнёрство с 3-5 тойхана.** Лично прийти в крупные залы Бишкека, договориться: они дают клиентам пробный доступ (промо-код 50% на первый шаблон), мы платим им $5 за каждое использование промо. Без подписания договоров на старте — устные договорённости с владельцем.

3. **Instagram-страница продукта** с 3-5 постами в неделю: реальные приглашения клиентов (с разрешения), советы по подготовке к свадьбе, мини-видео работы с продуктом. Контент = маркетинг, а не реклама.

### 10.10. Виральность встроенная в продукт

1. **Powered-by на бесплатных preview** (страница `/preview/{template}/{seed}`): маленькая ссылка «toilink.kg — создать своё». На оплаченных событиях — нет.
2. **Watermark на trial-видео** убирается только при оплате. Это сильнейший виральный инструмент видео-категории — каждое отправленное в WhatsApp trial-видео содержит наш бренд.
3. **OG-meta для WhatsApp share:** при копировании ссылки `/e/{slug}` в WhatsApp/Instagram — превью-карточка с фото пары, именами, датой и нашим favicon. На сервере генерируем JPG 1200×630 для каждой active страницы (см. раздел 6.8).
4. **Реферальная программа** (после первых 100 клиентов): «приведи друга — каждый получит 200 сом скидки». Реализация: `users.referrer_user_id`, при оплате реферала обоим начисляется скидка на следующий шаблон. **Не сейчас**, но `referrer` колонка уже есть.
5. **«Сохрани QR на свадьбу»:** при оплате генерируем QR-код для печати на пригласительной карточке (если кто-то всё же хочет физическое). На QR — ссылка на наш сайт. Ещё один виральный канал в офлайн.

---

## Раздел 11. i18n (русский + кыргызский)

### 11.1. Где хранить переводы

**Решение: гибрид — статика в JSON-файлах, динамика в БД.**

| Тип контента | Где | Почему |
|---|---|---|
| UI редактора, ошибок, кнопок | `messages_ru.properties`, `messages_ky.properties` | Меняется с деплоем, нужен в `MessageSource` Spring |
| Контент лендинга | `translations` в БД (namespace=`landing`) | Меняется без деплоя суперадмином |
| `template.name_ru`, `name_ky` | колонки `templates` | На каждый каталог-запрос — без JOIN |
| Поля шаблона (`schema.json`) | `label_ru`, `label_ky` в самой schema | Идёт с шаблоном, версионируется вместе |
| RSVP-форма для гостя | `translations` namespace=`rsvp` | Может меняться суперадмином |
| Уведомления (WhatsApp/SMS) | `translations` namespace=`notifications` | Может меняться без деплоя |

### 11.2. Переключение языка

**Приоритет (сверху вниз):**
1. URL-префикс `/ky/...` (для лендинга, для гостевых RSVP-страниц).
2. Кука `locale` (для авторизованных).
3. `users.locale` колонка (для авторизованных).
4. `Accept-Language` header.
5. По умолчанию `ru`.

**Поддоменом не делаем** (ky.toilink.kg). Поддомен требует SSL для каждого, отдельные сессии, лишнюю инфру.

### 11.3. Один язык на событие

**Решение: один язык на событие, выбирается клиентом при создании. Гость не выбирает.**

Причина: смешивать языки в одном приглашении плохо смотрится, а UX выбора языка для гостя — лишний шаг до RSVP. Если организатор хочет двуязычное приглашение — создаёт два события на разных языках или впишет два языка в текстовые поля сам.

`events.locale` определяет: Thymeleaf-шаблон с какой локалью рендерить + язык RSVP-формы + язык подсказок гостю.

### 11.4. Шаблоны на двух языках

В `schema.json`:
```json
{
  "id": "couple_names",
  "label_ru": "Имена пары",
  "label_ky": "Жубайлардын аттары",
  "placeholder_ru": "Айгуль & Бакыт",
  "placeholder_ky": "Айгүл & Бакыт"
}
```

В `index.html` (Thymeleaf для site):
```html
<h1 th:text="${event.config.couple_names}"></h1>
<p th:text="#{event.greeting(${event.config.couple_names})}"></p>
```

`event.greeting` — ключ переводов с параметром, разрешается через `MessageSource` по `event.locale`.

**Системные тексты в шаблоне** (не пользовательский ввод): кнопка «Подтвердить присутствие», «Дата», «Локация» — переводятся через `messages_*.properties` namespace=`templates` (общий для всех шаблонов). Один и тот же шаблон работает на обоих языках без изменений в файлах.

### 11.5. Кыргызский в URL-slug

`slug` события — латиница ASCII только. Транслитерация с кыргызского:
- `ы` → `y`
- `ң` → `n` (или `ng` если нужно различение)
- `ө` → `o`
- `ү` → `u`
- `җ` → `j`

```java
public class KyrgyzSlugifier {
    private static final Map<Character, String> MAP = Map.of(
        'ы', "y", 'Ы', "y",
        'ң', "n", 'Ң', "n",
        'ө', "o", 'Ө', "o",
        'ү', "u", 'Ү', "u"
    );
    public static String slugify(String input) {
        // 1. Translit ky → latin
        // 2. Translit ru → latin (ICU Transliterator)
        // 3. Lowercase, remove non-[a-z0-9-], collapse hyphens
    }
}
```

Результат: «Свадьба Айгуль» → `svadba-aigul-{4сим_random}`. Случайный суффикс — против перебора.

### 11.6. Управление переводами без деплоя

`/admin/translations` (см. раздел 9.6) показывает все ключи из `translations` таблицы с inline-edit. Поиск по namespace + key + locale.

**Что не редактируется через админку:** `messages_*.properties` (системные ошибки, технический UI). Меняется только через деплой — это редкое и осознанное действие.

### 11.7. Fallback стратегия

```java
public String t(String namespace, String key, Locale locale) {
    String value = translationRepo.find(namespace, key, locale.getLanguage());
    if (value == null && !locale.getLanguage().equals("ru")) {
        value = translationRepo.find(namespace, key, "ru");
    }
    if (value == null) {
        log.warn("Missing translation: {}.{}.{}", namespace, key, locale);
        return "{" + namespace + "." + key + "}";  // в dev — видно отсутствие
    }
    return value;
}
```

В production отсутствующие переводы попадают в audit_log с `action=MISSING_TRANSLATION` для последующего добавления админом.

---

## Раздел 12. Инфраструктура

### 12.1. Где разместить VPS

| Локация | Latency до Бишкека | Стоимость VPS (4 vCPU, 8GB) | Юр. простота | Вердикт |
|---|---|---|---|---|
| **Алматы (например, ps.kz)** | ~30-50 ms | ~$25-40/мес | КЗ-юрисдикция, рядом | **Старт** |
| Москва (Selectel, REG.ru) | ~80-120 ms | ~$15-30/мес | санкционные риски, RU-юрисдикция | Нет |
| Франкфурт (Hetzner) | ~150-200 ms | ~$20-30/мес | EU GDPR-простота | Не сейчас |
| Бишкек (локальные хостеры) | ~5-10 ms | ~$30-50/мес, но качество хуже | KG-юрисдикция | После 1000 клиентов |
| AWS/GCP ближайшие регионы | ~80-150 ms | ×3-5 цена | сложно для KG-биллинга | Нет |

**Старт: Hetzner Cloud Hel/Fal или ps.kz Алматы.** Hetzner дешевле и стабильнее, ps.kz даёт меньшую задержку. Для масс-клиентов KG — Алматы предпочтительнее.

Cloudflare сверху (бесплатный план) → пользователи видят CDN-edge в КР, оригин — Алматы. Latency восприятия будет ≤50 мс.

### 12.2. CDN для статики

| Вариант | Цена | Скорость из КР | Вердикт |
|---|---|---|---|
| **Cloudflare Free** | $0 | хорошая (есть Asia POPs) | **Да** |
| Bunny CDN | $0.005/GB | хорошая (Алматы edge) | Через 6 мес если Cloudflare упрётся в лимиты |
| AWS CloudFront | $0.085/GB | хорошая | Дорого |
| Selectel CDN | низкая | RU-only POPs | Нет |

Cloudflare также даёт WAF, DDoS-защиту, бесплатный SSL — берём всё в комплекте.

### 12.3. Бэкапы PostgreSQL

**Стратегия 3-2-1:** 3 копии, 2 разных носителя, 1 offsite.

1. **На том же VPS:** ежедневный `pg_dump` через cron в `/backups/`, ротация 7 дней.
2. **На отдельный VPS** (можно дешёвый storage VPS): pgBackRest с дельта-бэкапом каждые 6 часов, ротация 30 дней.
3. **Offsite — Backblaze B2 (S3-совместим)** еженедельно, ротация 6 месяцев. Backblaze дёшев ($0.005/GB/мес) и поддерживает версионирование.

**Восстановление:** в `runbook.md` (отдельный документ, не в этом файле):
- Сценарий 1: corrupt текущей БД → `pg_restore` из локального дампа.
- Сценарий 2: VPS уничтожен → новый VPS из Алматы → pgBackRest restore из storage VPS.
- Сценарий 3: оба DC упали → restore из B2 (час downtime).

**Тест восстановления:** ежемесячно, помечается в календаре. Если бэкап ни разу не тестировался — его нет.

### 12.4. Мониторинг

**Минимальный стек на старте (всё бесплатно):**
- **UptimeRobot** — пинг главной + `/api/v1/health` каждые 5 минут, 3 чек-пойнта (free).
- **Spring Boot Actuator** — `/actuator/health`, `/actuator/metrics` за `@PreAuthorize("hasRole('SUPER_ADMIN')")`.
- **Sentry** (free tier 5K events/мес) — exception tracking в backend и frontend.
- **Свой dashboard** на `/admin/dashboard` с ключевыми метриками за 24 часа: payments_pending, errors_count, users_signups, slow_queries.

**Не ставим** Prometheus/Grafana/ELK на старте — это операционная нагрузка на одного человека, не оправдана при 100-500 пользователей в день.

### 12.5. Логирование

**Structured JSON logs через Logback** в `/var/log/toilink/app.log` с ротацией (logrotate, 7 дней local + сжатие).

```xml
<encoder class="net.logstash.logback.encoder.LogstashEncoder">
  <customFields>{"app":"toilink","env":"prod"}</customFields>
</encoder>
```

**Куда отправлять:**
- На старте: nigde, оставляем локально. `grep` справляется.
- При росте трафика (>10К запросов/день): self-hosted **Loki + Grafana** на отдельном маленьком VPS, либо **Better Stack** ($25/мес).

**Что обязательно логируем:**
- Любой запрос к `/api/v1/admin/*` с user_id и payload (без секретов).
- Любую неудачную авторизацию.
- Все webhook-входы.
- Все state-переходы платежей.

### 12.6. HTTPS

**Caddy** — единственный reverse proxy. Делает Let's Encrypt автоматически, конфиг в 5 строк:

```
toilink.kg, www.toilink.kg {
    reverse_proxy localhost:8080
    encode gzip zstd
    @static path /static/* /uploads/*
    handle @static {
        root * /var/www/toilink
        file_server
        header Cache-Control "public, max-age=31536000, immutable"
    }
}
```

**Не Nginx**, потому что: Caddy = -50% строк конфига, автоматический SSL, HTTP/3 из коробки. Для одного VPS-хостера это правильный выбор. Nginx — когда понадобятся продвинутые правила.

### 12.7. Storage фотографий

**MinIO self-hosted на том же VPS на старте.**

| Вариант | Цена | Производительность из КР | Сложность |
|---|---|---|---|
| **MinIO на VPS** | $0 (то же железо) | excellent (тот же диск) | низкая |
| Backblaze B2 | $0.005/GB | средняя (US/EU edge) | низкая |
| AWS S3 | $0.023/GB + egress | средняя | средняя |
| Cloudflare R2 | $0.015/GB, free egress | хорошая | низкая, но KG-edge нет |

MinIO даёт S3 API → миграция позже на Backblaze/R2 — поменять endpoint и ключ, ничего больше. До 100GB фото на VPS-диске не больно.

**Структура bucket-ов в MinIO:**
```
templates/         # ассеты шаблонов (read-only)
uploads/           # пользовательские фото
og/                # сгенерированные OG-картинки (cache, можно регенерить)
backups/           # дампы БД (если решим хранить локально)
```

Прямой доступ через signed URLs (presigned), TTL 1 час для пользовательских.

### 12.8. Что отложить и до какого момента

| Технология | Когда внедрять | Триггер |
|---|---|---|
| **Redis** | Когда session-таблица в БД даёт >50ms на login или rate-limiter в памяти не выдерживает (~500 RPS) | До 100 RPS — точно нет |
| **RabbitMQ/Kafka** | Никогда (для этого продукта) | Spring `@Async` + `@Scheduled` + DB-table queue хватит |
| **Отдельный application VPS от БД** | Когда `SELECT pg_stat_activity` показывает >70% CPU долго | До ~5K events/день — один VPS |
| **Read-replica PostgreSQL** | Когда репортинг-запросы аналитики тормозят запись | До 100К пользователей нет смысла |
| **Kubernetes / Docker Swarm** | Никогда (для этого продукта) | systemd + Caddy = достаточно |
| **CI/CD beyond GitHub Actions + ssh deploy** | Никогда | Один человек деплоит |

### 12.9. Deployment

**Простейший pipeline:**
1. `git push` → GitHub.
2. GitHub Actions: `mvn package`, тесты, сборка `app.jar`.
3. SSH копирует jar на VPS в `/opt/toilink/releases/{commit}/app.jar`.
4. Симлинк `/opt/toilink/current` → новый релиз, `systemctl restart toilink`.
5. Health-check, в случае фейла — автоматический rollback симлинка на предыдущий релиз.

**Без Docker** на старте — Java 21 systemd-юнит проще и быстрее. Docker когда понадобится изоляция dev/prod.

```
[Unit]
Description=ToiLink
After=postgresql.service

[Service]
WorkingDirectory=/opt/toilink/current
ExecStart=/usr/bin/java -Xmx2g -jar app.jar
Restart=on-failure
User=toilink
EnvironmentFile=/etc/toilink/env
```

---

## Раздел 13. Что заложить в ядро, чтобы не болеть потом

### 13.1. organization_id колонка на users и events

**Что заложить:** колонка `organization_id UUID NULL` + таблица `organizations` (пустая). FK с `ON DELETE RESTRICT`.

**Почему больно потом:** добавление колонки в `events` на 50К строк требует `ALTER TABLE` с ACCESS EXCLUSIVE LOCK — деградация на минуты. PostgreSQL 11+ имеет fast `ADD COLUMN` без default, но любой код, который JOIN-ит users → events, придётся переписать.

**Сколько стоит сейчас:** ~30 минут (одна колонка, одна таблица, одна миграция).

### 13.2. category на templates

**Что заложить:** `templates.category VARCHAR(16) NOT NULL CHECK (category IN ('SITE','VIDEO'))`. Java enum. Полиморфные интерфейсы в коде.

**Почему больно потом:** если изначально была одна категория (`SITE`) и потом добавили VIDEO без категории-поля — приходится либо иметь две таблицы templates/site_templates/video_templates с дублированием логики, либо мигрировать половину кодовой базы под `if(isVideo)`.

**Сколько стоит сейчас:** ~1 день (интерфейсы + регистр + 2 реализации).

### 13.3. payment_provider абстракция даже при ручной оплате

**Что заложить:** интерфейс `PaymentProvider`, единственная реализация `ManualPaymentProvider`, `payment_providers` таблица с записью `MANUAL`, поле `payments.provider_code` на каждом платеже.

**Почему больно потом:** код «if (paymentMethod == 'cash') ... else ...» расползается по сервисам и контроллерам. Когда подключают O!Dengi, нужно вычистить все эти ифы. Это рефакторинг на неделю, плюс риски.

**Сколько стоит сейчас:** ~1 день (интерфейс + factory + одна реализация).

### 13.4. i18n с первого дня

**Что заложить:** `messages_ru.properties` + `messages_ky.properties` (хотя бы половинчатый перевод), Spring `MessageSource`, `LocaleResolver`, кука + URL-префикс `/ky/`. `users.locale`, `events.locale`. Колонки `name_ku`/`name_ky` на templates.

**Почему больно потом:** добавление i18n в существующий код = трогать каждый контроллер, каждый шаблон, каждую модалку. Месяцы работы. И всегда где-то остаются хардкод-строки.

**Сколько стоит сейчас:** ~3 дня.

### 13.5. Soft delete vs hard delete стратегия

**Что заложить:** `deleted_at TIMESTAMPTZ NULL` на `users`, `events`, `templates`. Все query-методы фильтруют `WHERE deleted_at IS NULL`. Hard delete только в админке после явного подтверждения, и только спустя 30 дней soft.

**Почему больно потом:** случайно удалённое событие клиента = кошмарная поддержка. Soft delete позволяет «откатить» бесплатно. Введение через 6 месяцев требует решать конфликты с FK.

**Сколько стоит сейчас:** ~4 часа (стандарт-конвенция + декоратор репозитория).

**Исключения** (hard delete с самого начала): `audit_log`, `webhook_events`, `otp_codes`, `rsvp_responses` (мелочь, не жалко), `refresh_tokens`.

### 13.6. Audit log на критичные действия

**Что заложить:** таблица `audit_log` + `@Aspect` который перехватывает `@AuditAction("PAYMENT_CONFIRM")` аннотацию.

**Почему больно потом:** «кто подтвердил эту оплату месяц назад?» — без audit_log ответа нет. Восстановить через git+логи невозможно.

**Сколько стоит сейчас:** ~6 часов.

**Что аудитим обязательно:** все админские действия, все state-переходы платежей, блокировки/разблокировки, impersonation, изменения цен и feature flags.

### 13.7. API versioning /v1/

**Что заложить:** `/api/v1/...` с первого commit-а. Всё.

**Почему больно потом:** мобильное приложение в будущем (или внешний интегратор) застрянет на v0. Разделение через 2 года = ад.

**Сколько стоит сейчас:** ~10 минут (одна константа в `@RestController`).

### 13.8. Идемпотентность платёжных операций

**Что заложить:** `payments.idempotency_key UNIQUE NOT NULL`. Контроллер требует header `Idempotency-Key`. Таблица `idempotency_keys` (key, response_json, expires_at).

**Почему больно потом:** double charge при retry → возврат денег → конфликт с клиентом → terrible reviews. Один раз произошедший double charge стоит $100 поддержки и -1 от LTV.

**Сколько стоит сейчас:** ~4 часа.

### 13.9. Schema versioning шаблонов

**Что заложить:** `template_versions` таблица. `events.template_version_id` фиксирует версию.

**Почему больно потом:** клиент создал событие на v1, мы накатили v2 с другими полями → событие сломалось → поддержка восстанавливает руками. Невыносимо при >10 шаблонов.

**Сколько стоит сейчас:** ~1 день.

### 13.10. Feature flags инфраструктура

**Что заложить:** таблица `feature_flags`, бин `FeatureFlagService.isEnabled(key)`, вызовы в ключевых местах (создание события по категории, регистрация, блоки шаблонов).

**Почему больно потом:** при инциденте (видео-рендер ломается на iOS) нет способа быстро отключить категорию без деплоя — это часы downtime.

**Сколько стоит сейчас:** ~3 часа.

### 13.11. UTM tracking на регистрацию

**Что заложить:** колонки `users.utm_source/utm_medium/utm_campaign/referrer`. Frontend считывает query string при первом landing-визите, сохраняет в `localStorage`, отправляет при создании user.

**Почему больно потом:** ROI на Instagram-рекламу — слепая зона. После 3 месяцев потраченных $5К без атрибуции — нельзя выключить плохие кампании.

**Сколько стоит сейчас:** ~3 часа.

### 13.12. Дополнительные пункты для именно этого продукта

#### 13.12.1. Slug стабильность

`events.slug` генерируется один раз и **никогда не меняется** даже если организатор переименовал событие. Иначе ссылки, отправленные гостям в WhatsApp, ломаются. Колонка `events.previous_slugs JSONB[]` для редиректов 301 в будущем.

#### 13.12.2. Phone в E.164 единым форматом

Сразу `+996700123456` без разделителей, на всех уровнях. Никаких "0700 12 34 56". Иначе при подключении SMS-провайдера придётся нормализовать 10К записей.

#### 13.12.3. Locale на `events`, не только на `users`

Один пользователь может создать одно событие на ru, другое на ky. `events.locale` отдельно. Иначе при первой просьбе клиента «хочу на кыргызском, но интерфейс оставить русским» — переписывать.

#### 13.12.4. `templates.metadata JSONB` от старта

Просто пустой `{}`. В будущем туда сложатся: tags, color_scheme_default, supported_countries, ab_group, sponsor_logo. **Без этой колонки** каждое такое поле = новая миграция.

#### 13.12.5. `events.event_date` денормализован из config

Чтобы фильтр «события за следующую неделю» был быстрым (индекс) и чтобы напоминания за 7 дней до события работали. Хранится в JSONB и в колонке (триггер синхронизации или явный update в сервисе).

#### 13.12.6. `accept_terms_at TIMESTAMPTZ` на users

Когда KG-законодательство потребует ToS/Privacy — у нас уже есть точка фиксации согласия. Добавить через год = чек-бокс показать каждому.

#### 13.12.7. `device_fingerprint` на otp_codes (анти-фрод)

Поле в `otp_codes` для anti-fraud (один телефон на несколько пользователей через разные устройства = подозрительно).

#### 13.12.8. Архитектурное правило: сервисы не знают про HTTP

`@Controller` → `@Service` → `@Repository`. Сервис никогда не возвращает `ResponseEntity` и не принимает `HttpServletRequest`. Это кажется педантизмом, но при появлении WebSocket / scheduled-jobs / CLI-команд — всё переиспользуется.

#### 13.12.9. Все деньги в `INTEGER kgs_minor_units` или просто `INTEGER kgs`

Один из вариантов, выбранный навсегда. **Выбираем `INTEGER kgs` (целые сомы)**, потому что в КР цены меньше 100 сомов нереалистичны для нашего продукта, и копейки в Kaspi-переводах не бывают. Если завтра подключим ATM с копейками — миграция на копейки = умножить все на 100.

#### 13.12.10. `timezone = 'Asia/Bishkek'` в БД и приложении явно

Все `TIMESTAMPTZ` хранятся в UTC, но `SET timezone = 'Asia/Bishkek'` в `application.yaml` для отображения. Никогда `LocalDateTime` без зоны — иначе при переезде сервера на другой регион пол-логики поедет.

---

## Заключение

Этот мануал не задумывается как замороженный артефакт. Каждый раздел будет уточнён на практике первого месяца. **Главные точки риска**, на которые смотреть в первую очередь:

1. **Видео-экспорт на реальных устройствах KG** — собрать 5-10 разных Android (бюджетные Samsung/Tecno/Infinix) и протестить. Если на них не работает — продукт не запускается.
2. **WhatsApp Business API доступ из КР** — требует регистрации Facebook Business и верификации. Это может занять 2-3 недели. Закладываем заранее, fallback на SMS у локальных операторов.
3. **Ручная оплата** — пока работает 1 человек, лимит ~30 платежей/день. Если рост быстрее — нужно выводить хотя бы один авто-провайдер раньше плана. Закладываем `PaymentProvider` интерфейс именно для скорости подключения.
4. **Доверие KG-аудитории** — проверяется только полевыми переговорами с тойхана и первыми 20 клиентами. Никакая архитектура не спасёт от отсутствия product-market fit.

Ядро (раздел 2 + 4 + 8) — самое важное. Остальное можно итерировать.
