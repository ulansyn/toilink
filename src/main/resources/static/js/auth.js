/**
 * ToiLink Auth Module — Shared authentication with proper redirects
 */

const AUTH_KEY = 'tl_phone';
const AUTH_RETURN_KEY = 'auth_return_to';

/**
 * Get stored phone
 */
export function getStoredPhone() {
  return localStorage.getItem(AUTH_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!localStorage.getItem(AUTH_KEY);
}

/**
 * Set return URL before opening auth
 */
export function setReturnUrl(url) {
  localStorage.setItem(AUTH_RETURN_KEY, url || location.pathname);
}

/**
 * Get and clear return URL, default to dashboard
 */
export function getReturnUrl() {
  const url = localStorage.getItem(AUTH_RETURN_KEY) || '/';
  localStorage.removeItem(AUTH_RETURN_KEY);
  return url;
}

/**
 * Save phone after successful auth
 */
export function savePhone(phone) {
  localStorage.setItem(AUTH_KEY, phone);
}

/**
 * Clear auth (logout)
 */
export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

/**
 * Open auth bottom sheet
 * @param {Object} options
 * @param {Function} options.onSuccess - called with phone after auth
 * @param {Function} options.onClose - called when sheet is closed without auth
 * @param {boolean} options.returnToDashboard - if true, redirects to dashboard after auth
 */
export function openAuthSheet({ onSuccess, onClose, returnToDashboard = false } = {}) {
  // Set return URL if specified
  if (returnToDashboard) {
    setReturnUrl('/');
  }

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  document.body.appendChild(backdrop);

  // Create sheet
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-handle">
      <div class="sheet-handle-bar"></div>
    </div>
    <div class="sheet-content">
      <div class="sheet-header">
        <h2 class="sheet-title">Вход</h2>
        <button class="btn-icon" id="auth-close-btn" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <p class="text-secondary text-small mb-6">Введите номер телефона для входа</p>

      <form id="auth-form" class="flex flex-col gap-4">
        <div class="input-group">
          <input
            type="tel"
            id="auth-phone"
            class="input"
            placeholder=" "
            autocomplete="tel"
            inputmode="tel"
          />
          <label for="auth-phone" class="input-label">+996</label>
        </div>

        <button type="submit" class="btn btn-gold btn-full" id="auth-submit">
          Продолжить
        </button>

        <p class="text-caption text-muted text-center">
          Продолжая, вы соглашаетесь с условиями использования
        </p>
      </form>
    </div>
  `;

  document.body.appendChild(sheet);

  // Get elements
  const form = sheet.querySelector('#auth-form');
  const phoneInput = sheet.querySelector('#auth-phone');
  const closeBtn = sheet.querySelector('#auth-close-btn');
  const submitBtn = sheet.querySelector('#auth-submit');

  // Format phone as user types
  phoneInput.addEventListener('input', (e) => {
    formatPhone(e.target);
    e.target.value = formatPhone(e.target);
  });

  // Close functions
  const close = () => {
    sheet.classList.remove('visible');
    backdrop.classList.remove('visible');
    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 300);
    onClose?.();
  };

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  // Handle submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawPhone = phoneInput.value.replace(/\D/g, '');

    if (rawPhone.length < 7) {
      phoneInput.style.borderColor = 'var(--color-error)';
      phoneInput.focus();
      return;
    }

    // Build full phone with +
    const phone = '+' + rawPhone;

    // Show loading
    submitBtn.disabled = true;
    submitBtn.textContent = '...';

    // Simulate brief delay for UX
    await new Promise(r => setTimeout(r, 300));

    // Save auth
    savePhone(phone);

    // Close sheet
    sheet.classList.remove('visible');
    backdrop.classList.remove('visible');

    setTimeout(() => {
      backdrop.remove();
      sheet.remove();

      // Call success
      onSuccess?.(phone);

      // Redirect if needed
      if (returnToDashboard) {
        const returnUrl = getReturnUrl();
        location.href = returnUrl;
      }
    }, 300);
  });

  // Animate in
  requestAnimationFrame(() => {
    backdrop.classList.add('visible');
    sheet.classList.add('visible');
    phoneInput.focus();
  });

  // Return close function
  return { close };
}

/**
 * Format phone input with Kyrgyz format
 */
function formatPhone(el) {
  let v = el.value.replace(/\D/g, '');

  if (!v.startsWith('996') && v.length > 0) {
    if (v.startsWith('0')) {
      v = '996' + v.slice(1);
    }
  }

  if (v.length > 12) {
    v = v.slice(0, 12);
  }

  if (v.length === 0) {
    return '';
  }

  let formatted = '+' + v;

  if (v.length > 3) {
    formatted = '+' + v.slice(0, 3) + ' ' + v.slice(3);
  }
  if (v.length > 6) {
    formatted = '+' + v.slice(0, 3) + ' ' + v.slice(3, 6) + ' ' + v.slice(6);
  }
  if (v.length > 9) {
    formatted = '+' + v.slice(0, 3) + ' ' + v.slice(3, 6) + ' ' + v.slice(6, 9) + ' ' + v.slice(9);
  }

  return formatted;
}

/**
 * Require auth — redirect to auth if not logged in
 * @param {string} returnTo - URL to return to after auth
 * @returns {boolean} true if authenticated, redirects if not
 */
export function requireAuth(returnTo = location.pathname) {
  if (!isAuthenticated()) {
    setReturnUrl(returnTo);
    openAuthSheet({ returnToDashboard: true });
    return false;
  }
  return true;
}

/**
 * Init auth check — check stored phone and call callback
 * @param {Function} callback - called with phone if authenticated, null if not
 */
export function initAuth(callback) {
  const phone = getStoredPhone();
  callback(phone);
}

// Make available globally for non-module scripts
window.ToiLinkAuth = {
  getStoredPhone,
  isAuthenticated,
  setReturnUrl,
  getReturnUrl,
  savePhone,
  clearAuth,
  openAuthSheet,
  requireAuth,
  initAuth
};
