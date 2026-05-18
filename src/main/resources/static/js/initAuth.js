/**
 * initAuth — shared auth overlay module
 *
 * Checks the server session. If absent, renders a full-screen onboarding
 * overlay and returns a Promise that resolves with the phone after login.
 */
let _authPromise = null;
window.initAuth = function () {
  if (_authPromise) return _authPromise;
  _authPromise = new Promise((resolve) => {
    const done = (phone) => {
      resolve(phone);
    };
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.phone) {
          try { localStorage.setItem('tl_phone', data.phone); } catch (_) {}
          done(data.phone);
          return;
        }
        startOverlay(done);
      })
      .catch(() => startOverlay(done));
  });
  return _authPromise;
};

function startOverlay(resolve) {
    if (document.getElementById('auth-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      background: #FFF8FB;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px;
      opacity: 1; transition: opacity 0.4s ease;
      font-family: 'Inter', sans-serif;
    `;

    overlay.innerHTML = `
      <style>
        #auth-overlay .m3-input-wrap { position: relative; margin-bottom: 4px; }
        #auth-overlay .m3-inp {
          width: 100%; padding: 18px 16px 6px;
          background: #EDE9E4; border: none;
          border-radius: 14px 14px 0 0;
          border-bottom: 2px solid #B0AB9E;
          font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 500;
          color: #1E2820; outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        #auth-overlay .m3-inp:focus { border-bottom-color: #3D6B45; background: #E8E4DC; }
        #auth-overlay .m3-inp::placeholder { color: transparent; }
        #auth-overlay .m3-lbl {
          position: absolute; left: 16px; top: 13px;
          font-size: 16px; color: #6B6860; pointer-events: none;
          transition: all 0.2s ease;
        }
        #auth-overlay .m3-inp:focus ~ .m3-lbl,
        #auth-overlay .m3-inp:not(:placeholder-shown) ~ .m3-lbl {
          top: 5px; font-size: 11px; font-weight: 600; color: #3D6B45; letter-spacing: 0.3px;
        }
        #auth-overlay .auth-btn {
          width: 100%; padding: 17px; border-radius: 14px; border: none;
          background: #3D6B45; color: white; font-family: 'Inter', sans-serif;
          font-size: 16px; font-weight: 600; cursor: pointer;
          box-shadow: 0 3px 10px rgba(61,107,69,0.32);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        #auth-overlay .auth-btn:active { transform: scale(0.97); box-shadow: 0 1px 5px rgba(61,107,69,0.25); }
      </style>

      <div style="width: 100%; max-width: 360px;">
        <!-- Logo -->
        <div style="text-align: center; margin-bottom: 40px;">
          <div style="width: 72px; height: 72px; background: #C2E0C6; border-radius: 22px;
                      display: flex; align-items: center; justify-content: center;
                      margin: 0 auto 18px; box-shadow: 0 4px 16px rgba(61,107,69,0.2);">
            <svg width="36" height="36" fill="none" stroke="#3D6B45" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <p style="font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 600;
                    font-style: italic; color: #1E2820; margin: 0 0 8px;">ToiLink</p>
          <p style="font-size: 14px; color: #6B6860; line-height: 1.5; margin: 0;">
            Красивые приглашения<br/>для особенных событий
          </p>
        </div>

        <!-- Form -->
        <div class="m3-input-wrap" style="margin-bottom: 16px;">
          <input
            id="auth-phone-input"
            type="tel"
            autocomplete="tel"
            placeholder="Номер телефона"
            class="m3-inp"
          />
          <label for="auth-phone-input" class="m3-lbl">Номер телефона</label>
        </div>
        <div class="m3-input-wrap" style="margin-bottom: 16px;">
          <input
            id="auth-password-input"
            type="password"
            autocomplete="current-password"
            placeholder="Пароль"
            class="m3-inp"
          />
          <label for="auth-password-input" class="m3-lbl">Пароль</label>
        </div>
        <p id="auth-error" style="font-size: 12px; color: #ef4444; margin: -8px 0 12px 4px; display: none;">
          Введите корректный номер (минимум 7 цифр)
        </p>

        <button id="auth-submit" class="auth-btn">Войти</button>
      </div>`;

    document.body.appendChild(overlay);

    const input    = overlay.querySelector('#auth-phone-input');
    const passInput = overlay.querySelector('#auth-password-input');
    const btn      = overlay.querySelector('#auth-submit');
    const err      = overlay.querySelector('#auth-error');

    requestAnimationFrame(() => input.focus());

    async function submit() {
      const phone = input.value.trim();
      if (!phone || phone.replace(/\D/g, '').length < 7) {
        err.textContent = 'Введите корректный номер (минимум 7 цифр)';
        err.style.display = 'block';
        input.style.borderBottomColor = '#fca5a5';
        return;
      }
      const password = passInput.value;
      if (password.length < 4) {
        err.textContent = 'Пароль минимум 4 символа';
        err.style.display = 'block';
        passInput.style.borderBottomColor = '#fca5a5';
        return;
      }

      err.style.display = 'none';
      btn.disabled = true;
      btn.textContent = '...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password }),
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          err.textContent = data.message || 'Неверный пароль';
          err.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Войти';
          return;
        }
        try { localStorage.setItem('tl_phone', phone); } catch (_) {}
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); resolve(phone); }, 400);
      } catch (_) {
        err.textContent = 'Ошибка соединения';
        err.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Войти';
      }
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') passInput.focus(); });
    passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    input.addEventListener('input', () => { err.style.display = 'none'; input.style.borderBottomColor = ''; });
    passInput.addEventListener('input', () => { err.style.display = 'none'; passInput.style.borderBottomColor = ''; });
}
