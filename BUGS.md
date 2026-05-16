# BUGS — фронтовые баги и проблемы

Аудит от 2026-05-16. Сгруппировано по приоритету. Каждый пункт — файл:строка, описание, симптом.

Статус: `[ ]` todo · `[x]` done · `[~]` in progress

---

## HIGH — критические

- [x] **#1 Дублирующиеся слушатели в app-shell** — добавлены guard-флаги `linkPrefetchInstalled`, `skeletonNavInstalled`.
  - `js/app-shell.js:203-212` — `installLinkPrefetch()` / `installSkeletonOnNav()` навешивают `touchstart`, `pointerdown`, `mouseover`, `focusin`, `click` без `removeEventListener` и без guard.
  - Симптом: повторный вызов → дублирование событий, скелетон рендерится несколько раз, утечка памяти.

- [x] **#2 Race condition в initAuth** — мемоизирован Promise + проверка на существующий `#auth-overlay`.
  - `js/initAuth.js:7-21` — `initAuth()` не защищён от параллельных вызовов.
  - Симптом: на двух одновременных вызовах два login-оверлея перекрывают друг друга.

- [x] **#3 XSS / синтаксическая поломка в onclick** — заменено на `data-action="share-event"` + делегированный listener; добавлен `escapeAttr`.
  - `js/dashboard.js:548` — `onclick="shareEvent('${eventUrl}', ${JSON.stringify(event.title||'').replace(/"/g,'&quot;')})"`. При апострофе в URL/title строка ломается.
  - Симптом: потенциальный XSS, гарантированно — поломка кнопки share.

- [x] **#4 location.replace без return** — false positive
  - `js/mobile-editor.js:945-947, 958-960, 1000-1002` — все три места уже имеют `throw` или `return` после `location.replace`. При повторной проверке проблема не подтверждена.

- [x] **#5 localStorage без try/catch** — обёрнуты setItem/getItem в `auth.js` (через хелперы `lsGet/lsSet/lsRemove`), `wizard.js` (3 точки), `login.html`, `paywall.html`, `landing-reference.html`, `index.html`, `mobile-editor.js`. `event.js:290` уже был защищён.
  - `js/event.js:290` и др. — `localStorage.setItem(...)` падает на `QuotaExceededError` или в Safari private mode.
  - Симптом: RSVP-токен теряется на переполненном хранилище / форма ломается.

---

## MEDIUM

- [x] **#6 Двойная регистрация слушателей в guests** — false positive
  - `js/guests.js:943, 973-978, 981-1005` — wire-функции вызываются один раз под guard-флагом `_wired` (guests.js:8, 1144). Проблема не подтверждена.

- [x] **#7 JSON.parse на возможном массиве** — false positive
  - `js/guests.js:129` уже имеет `if (Array.isArray(event.guestGroups)) return event.guestGroups;` перед `JSON.parse`. Проблема не подтверждена.

- [x] **#8 postMessage в неготовый iframe** — false positive
  - `js/wizard.js:403, 454` — есть double-handshake (`load` event + `TEMPLATE_READY` message), все вызовы `sendToIframe` через `if (W.iframeReady)`. Проблема не подтверждена.

- [x] **#9 DOM доступ без null-проверки** — добавлены null-guard на `photoPreviewImg` и `photoDropInner` в `wizard.js:357-365` (audit ошибочно указал `mobile-editor.js`).

- [x] **#10 Кэш в sessionStorage без cap** — `cacheSet` уже был в try/catch; добавлена eviction-стратегия: на ошибке quota вычищаем все `tl:`-ключи кроме целевого и retry. Обновлено в `dashboard.js:5-17`, `guests.js:19-31`.

- [x] **#11 parseInt без NaN-проверки** — false positive
  - `js/guests.js:946, 966` — оба клика защищены последующим `if (!g) return;` после `allGuests.find(...)`. На `NaN` find возвращает undefined, ранний выход; API не дёргается.

- [x] **#12 Невалидируемый URL** — fallback теперь требует `event.slug`; иначе возвращается пустая строка вместо `/e/undefined`. Обновлено в `dashboard.js:334, 495`.

- [x] **#13 postMessage с origin '*'** — заменено на `location.origin` в `mobile-editor.js:379, 646` и `wizard.js:450`; receive-listeners (`mobile-editor.js:1050`, `wizard.js:456`) теперь проверяют `event.origin !== location.origin`.

---

## LOW

- [x] **#14 setInterval без clearInterval** — `event.js:48-78` — модульный `_countdownTimer`, очищается при `diff <= 0`, при повторном `startCountdown` и на `pagehide`.

- [x] **#15 clipboard.writeText без проверки secure context** — `dashboard.js:100-122` — добавлен `fallbackCopy` через `execCommand('copy')` с скрытой textarea; `prompt()` остался только как last-resort.

- [x] **#16 Глобальный флаг snapshot** — false positive
  - `js/app-shell.js:99-106` — флаг работает как debounce: пока один snapshot в очереди, повторные вызовы no-op. Намеренное поведение.

- [x] **#17 Пустое сообщение об ошибке** — `dashboard.js:54` теперь `throw new Error('Ошибка загрузки статистики')` (функция сейчас не вызывается, но сообщение нормализовано).

- [x] **#18 innerHTML без escapeHtml** — false positive
  - Аудит указал `guests.js:639, 1152`, но там нет innerHTML. Sweep по интерполяциям полей (name/phone/notes/label/comment/title) — все рендеры идут через `escapeHtml`.

- [x] **#19 fetch без timeout/abort** — `app-shell.js:159-181` — добавлен `AbortController` с 8s timeout и `clearTimeout` в `finally`.

- [x] **#20 Хрупкий парсинг CSS-классов** — `event.js:259-271` — `(active.dataset.activeClass || '').split(' ').filter(Boolean)` + проверка `cls.length` перед `classList.add`.

- [x] **#21 Service Worker — аудирован, без issues**
  - `sw.js` — версионирование через `SW_VERSION`, cleanup старых caches в `activate`, stale-while-revalidate, `/api/` обходит SW, только 2xx кэшируется, `?v=` strip для cache key. После деплоя — стандартный one-step-behind, на refresh обновляется.
