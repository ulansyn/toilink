/**
 * guest-loader.js — Ivento Wedding
 * ─────────────────────────────────────────────────────────
 * Подключать ПОСЛЕ config.js и renderer.js в index.html:
 *   <script src="js/guest-loader.js"></script>
 *
 * Что делает:
 *  1. Читает ?id= из URL
 *  2. Спрашивает Apps Script — кто этот гость, отвечал ли он
 *  3. Если уже отвечал — показывает заглушку вместо формы
 *  4. Если нет — вставляет имя в поле, делает его readonly
 *  5. Перехватывает submit формы → отправляет в Google Sheets
 *  6. Если ?id= нет вообще — форма работает анонимно (старое поведение)
 * ─────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // Skip in preview mode
  if (window.__SKIP_GUEST_LOADER) return;

  // ─── Читаем ID гостя из URL ────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const GUEST_ID = params.get('id') || null;

  // ─── URL Apps Script берём из конфига ──────────────────
  // Добавь в config.js:  googleScript: { url: "https://script.google.com/macros/s/XXXX/exec" }
  function getScriptUrl() {
    return (
      window.WEDDING_CONFIG &&
      window.WEDDING_CONFIG.googleScript &&
      window.WEDDING_CONFIG.googleScript.url
    ) || null;
  }

  // ─── Утилита: GET запрос к Apps Script ─────────────────
  async function appsScriptGet(params) {
    const url = getScriptUrl();
    if (!url) return null;
    const qs = new URLSearchParams(params).toString();
    return new Promise((resolve) => {
      const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
      window[callbackName] = function (data) {
        delete window[callbackName];
        document.body.removeChild(script);
        resolve(data);
      };

      const script = document.createElement('script');
      script.src = `${url}?${qs}&callback=${callbackName}`;
      script.onerror = function () {
        delete window[callbackName];
        document.body.removeChild(script);
        console.warn('[GuestLoader] JSONP failed');
        resolve(null);
      };
      document.body.appendChild(script);
    });
  }

  // ─── Утилита: POST запрос к Apps Script ────────────────
  async function appsScriptPost(body) {
    const url = getScriptUrl();
    if (!url) return null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
      // no-cors fetch opaque response
      return { status: "success" };
    } catch (e) {
      console.warn('[GuestLoader] POST failed', e);
      return null;
    }
  }

  // ─── Показать "уже ответили" вместо формы ──────────────
  function showAlreadyAnswered(guestName, status) {
    const container = document.querySelector('[data-render="rsvp"]');
    if (!container) return;

    const emoji = status === 'yes' ? '🤍' : '🕊️';
    const answer = status === 'yes' ? 'придёте' : 'не сможете прийти';

    container.innerHTML = `
      <div class="rsvp-form-wrap" style="text-align:center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">${emoji}</div>
        <h2 class="rsvp-heading" style="margin-bottom: 12px;">
          ${guestName ? guestName + ',' : ''} вы уже ответили
        </h2>
        <p class="rsvp-subtitle" style="opacity: 0.75;">
          Ваш ответ записан — вы ${answer}.<br>
          Изменить ответ уже нельзя. Если это ошибка,<br>свяжитесь с организаторами.
        </p>
      </div>
    `;
  }

  // ─── Перехватить submit и отправить в Sheets ───────────
  function interceptForm(guestId, prefillName) {
    // Форма рендерится renderer.js, ждём её появления
    const tryIntercept = () => {
      const form = document.querySelector('.rsvp-form');
      const nameInput = document.getElementById('rsvp-name');
      if (!form) return; // ещё не отрендерена

      // Вставляем имя гостя в поле и блокируем редактирование
      if (prefillName && nameInput) {
        nameInput.value = prefillName;
        nameInput.readOnly = true;
        nameInput.style.opacity = '0.75';
        nameInput.style.cursor = 'default';
        // Убираем ошибку валидации — имя уже заполнено
        nameInput.parentElement.classList.remove('has-error');
      }

      // Перехватываем отправку
      form.addEventListener('submit', async function handler(e) {
        e.preventDefault();
        e.stopImmediatePropagation(); // отменяем дефолтный обработчик renderer.js

        // Валидация
        let isValid = true;
        form.querySelectorAll('[required]').forEach(input => {
          if (!input.value.trim()) {
            isValid = false;
            input.parentElement.classList.add('has-error');
            input.addEventListener('input', () =>
              input.parentElement.classList.remove('has-error'), { once: true });
          }
        });
        if (!isValid) {
          form.classList.add('form-shake');
          setTimeout(() => form.classList.remove('form-shake'), 500);
          return;
        }

        const btn = form.querySelector('.rsvp-button');
        if (btn.classList.contains('is-loading')) return;
        btn.classList.add('is-loading');

        // Собираем данные
        const payload = {
          action: 'rsvp',
          id: guestId, // может быть null для анонимов
          name: form.querySelector('[name="name"]')?.value?.trim() || '',
          presence: form.querySelector('[name="presence"]:checked')?.value || 'yes',
          guestCount: form.querySelector('[name="guest_count"]')?.value || '1',
          message: form.querySelector('[name="message"]')?.value?.trim() || ''
        };

        const result = await appsScriptPost(payload);

        if (result && result.error === 'already_answered') {
          // Кто-то уже ответил пока форма была открыта
          showAlreadyAnswered(payload.name, result.status);
          return;
        }

        // Показываем success
        const wrap = form.closest('.rsvp-form-wrap');
        const success = document.querySelector('.rsvp-success');
        if (wrap && success) {
          wrap.classList.add('is-hidden');
          success.classList.add('is-visible');

          // Запускаем таймер (вытягиваем из глобальной конфигурации)
          if (window.WEDDING_CONFIG && window.WEDDING_CONFIG.couple && window.WEDDING_CONFIG.couple.date) {
            // Если в scope есть функция из renderer (window.weddingRenderer), используем её, иначе свою
            if (typeof window.weddingRenderer !== 'undefined' && window.weddingRenderer.startRSVPCountdown) {
              window.weddingRenderer.startRSVPCountdown();
            } else {
              startRSVPCountdown(window.WEDDING_CONFIG.couple.date);
            }
          }
        }

      }, true); // capture: true — срабатываем раньше renderer.js

    };

    // Ждём пока renderer отрисует форму
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryIntercept);
    } else {
      setTimeout(tryIntercept, 200);
    }
  }

  function startRSVPCountdown(dateString) {
    const targetDate = new Date(dateString).getTime();
    if (isNaN(targetDate)) return;

    const update = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) return;

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const dEl = document.getElementById('rsvp-d');
      const hEl = document.getElementById('rsvp-h');
      const mEl = document.getElementById('rsvp-m');
      const sEl = document.getElementById('rsvp-s');

      if (dEl) dEl.textContent = d;
      if (hEl) hEl.textContent = h;
      if (mEl) mEl.textContent = m;
      if (sEl) sEl.textContent = s.toString().padStart(2, '0');
    };

    update();
    setInterval(update, 1000);
  }

  // ─── Главная функция ───────────────────────────────────
  async function init() {
    const scriptUrl = getScriptUrl();

    // Нет конфига — не можем отправить данные
    if (!scriptUrl) {
      console.info('[GuestLoader] Анонимный режим (нет scriptUrl)');
      return;
    }

    // Запрашиваем данные гостя
    let data = null;
    if (GUEST_ID) {
      data = await appsScriptGet({ action: 'getGuest', id: GUEST_ID });
    }

    if (!data || data.error) {
      // Гость не найден — форма работает анонимно
      if (GUEST_ID) console.warn('[GuestLoader] Гость не найден:', GUEST_ID);
      interceptForm(null, null);
      return;
    }

    if (data.answered) {
      // Уже ответил — ждём рендер и заменяем форму заглушкой
      const waitAndReplace = () => {
        const container = document.querySelector('[data-render="rsvp"]');
        // Проверяем что renderer уже отработал
        if (!container || !container.querySelector('.rsvp-form-wrap')) {
          setTimeout(waitAndReplace, 150);
          return;
        }
        showAlreadyAnswered(data.name, data.status);
      };
      setTimeout(waitAndReplace, 250);
      return;
    }

    // Гость найден, ещё не отвечал — перехватываем форму
    interceptForm(GUEST_ID, data.name);

    // Персонализируем заголовок приглашения если есть имя
    if (data.name) {
      const waitForHeading = () => {
        const heading = document.querySelector('.invitation-heading');
        if (heading) {
          heading.textContent = `Дорогой(-ая) ${data.name}!`;
        }
      };
      setTimeout(waitForHeading, 300);
    }
  }

  // Запускаем после полной загрузки (renderer.js тоже на DOMContentLoaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

})();