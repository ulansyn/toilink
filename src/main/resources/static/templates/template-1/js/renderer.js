

class WeddingRenderer {
  constructor(config) {
    this.config = config;
  }

  applyTheme() {
    const root = document.documentElement;
    Object.entries(this.config.theme.colors).forEach(([key, value]) => {
      const cssVarName = `--${this.camelToKebab(key)}`;
      root.style.setProperty(cssVarName, value);
    });
    Object.entries(this.config.theme.fonts).forEach(([key, value]) => {
      const cssVarName = `--${key}-font`;
      root.style.setProperty(cssVarName, value);
    });
  }

  camelToKebab(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  fillContent() {
    document.querySelectorAll('[data-content]').forEach(el => {
      const path = el.getAttribute('data-content');


      if (path.includes('.charAt(0)')) {
        const baseAttr = path.split('.charAt(0)')[0];
        const fullValue = this.getNestedValue(this.config, baseAttr);
        if (fullValue) el.textContent = fullValue.charAt(0).toUpperCase();
        return;
      }

      const value = this.getNestedValue(this.config, path);
      if (value) el.textContent = value;
    });
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  safeLinkUrl(value, fallback = '#') {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return fallback;
    if (raw.startsWith('#') || raw.startsWith('/')) return raw;
    try {
      const url = new URL(raw, location.origin);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? raw : fallback;
    } catch (_) {
      return fallback;
    }
  }

  safeImageUrl(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (raw.startsWith('/') || raw.startsWith('blob:')) return raw;
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(raw)) return raw;
    try {
      const url = new URL(raw, location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? raw : '';
    } catch (_) {
      return '';
    }
  }

  safeCssColor(value) {
    const raw = String(value == null ? '' : value).trim();
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
    if (/^(?:rgb|hsl)a?\(\s*[\d.%\s,/-]+\)$/i.test(raw)) return raw;
    return '#d9c7aa';
  }

  setImages() {
    document.querySelectorAll('[data-img]').forEach(el => {
      const imgKey = el.getAttribute('data-img');
      const src = this.safeImageUrl(this.config.images[imgKey]);
      if (src) {
        if (el.tagName === 'IMG') {
          el.src = src;
        } else {
          el.style.backgroundImage = `url("${src}")`;
        }
      }
    });
  }

  setLinks() {
    document.querySelectorAll('[data-link]').forEach(el => {
      const path = el.getAttribute('data-link');
      const href = this.safeLinkUrl(this.getNestedValue(this.config, path));
      if (href && el.tagName === 'A') {
        el.href = href;
      }
    });
  }

  renderHero() {
    if (!this.config.sections.hero) {
      const el = document.querySelector('[data-section="hero"]');
      if (el) { if (window.__IS_PREVIEW) el.style.display = 'none'; else el.remove(); }
    }
  }

  renderInvitation() {
    const el = document.querySelector('[data-section="invitation"]');
    if (!this.config.sections.invitation) {
      if (el) { if (window.__IS_PREVIEW) el.style.display = 'none'; else el.remove(); }
      return;
    }
    if (el) el.style.display = '';
    const container = document.querySelector('[data-render="invitation.paragraphs"]');
    if (!container) return;
    container.innerHTML = this.config.invitation.paragraphs
      .map(p => `<p>${this.escapeHtml(p)}</p>`)
      .join('');
  }

  renderPhotoStack() {
    const section = document.querySelector('[data-section="photoStack"]');
    if (!this.config.sections.photoStack) {
      if (section) { if (window.__IS_PREVIEW) section.style.display = 'none'; else section.remove(); }
      return;
    }
    if (section) section.style.display = '';
    section.innerHTML = '';
    const photos = (this.config.images.gallery || [this.config.images.couplePhoto])
      .map(src => this.safeImageUrl(src))
      .filter(Boolean);

    section.innerHTML = `
      <div class="gallery-editorial">
        <div class="gallery-label">
          <span class="gallery-label-line"></span>
          <span class="gallery-label-text">Наши моменты</span>
          <span class="gallery-label-line"></span>
        </div>
        <div class="gallery-photo-wrap">
          <div class="gallery-photo-inner" id="gallery-track">
            ${photos.map((src, i) => `
              <img src="${this.escapeHtml(src)}" class="gallery-slide ${i === 0 ? 'active' : ''}" alt="Photo ${i + 1}" draggable="false">
            `).join('')}
          </div>
          <div class="gallery-photo-frame"></div>
          ${photos.length > 1 ? `
            <button class="gallery-arrow gallery-prev" aria-label="Назад">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="gallery-arrow gallery-next" aria-label="Вперёд">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          ` : ''}
        </div>
        ${photos.length > 1 ? `
          <div class="gallery-pager">
            ${photos.map((_, i) => `<span class="gallery-pip ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    if (photos.length > 1) {
      this.setupGallery(photos.length);
    }
  }

  setupGallery(count) {
    let currentIndex = 0;
    const slides = document.querySelectorAll('.gallery-slide');
    const pips = document.querySelectorAll('.gallery-pip');

    const go = (index) => {
      slides[currentIndex].classList.remove('active');
      if (pips[currentIndex]) pips[currentIndex].classList.remove('active');
      currentIndex = ((index % count) + count) % count;
      slides[currentIndex].classList.add('active');
      if (pips[currentIndex]) pips[currentIndex].classList.add('active');
    };

    document.querySelector('.gallery-prev')?.addEventListener('click', () => go(currentIndex - 1));
    document.querySelector('.gallery-next')?.addEventListener('click', () => go(currentIndex + 1));
    pips.forEach(p => p.addEventListener('click', () => go(+p.dataset.index)));
    setInterval(() => go(currentIndex + 1), 5000);
  }

  renderLocation() {
    const el = document.querySelector('[data-section="location"]');
    if (!this.config.sections.location) {
      if (el) { if (window.__IS_PREVIEW) el.style.display = 'none'; else el.remove(); }
      return;
    }
    if (el) el.style.display = '';
  }

  getIconSvg(name) {
    const style = 'style="width:32px; height:32px; display:block; fill:var(--accent-gold);"';
    const icons = {
      rings: `<svg ${style} viewBox="0 0 24 24"><path d="M17 3a4 4 0 0 0-3.72 2.54 4 4 0 1 0-4.56 0A4 4 0 0 0 5 3a4 4 0 0 0 0 8c.36 0 .7-.06 1.03-.17a5.5 5.5 0 1 0 11.94 0A4 4 0 0 0 17 3zm-6 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm6 7a4 4 0 1 1-2.92-1.3l.06-.05a5.52 5.52 0 0 0 5.72 0l.06.05A4 4 0 0 1 17 12.5z"/></svg>`,
      cocktail: `<svg ${style} viewBox="0 0 24 24"><path d="M7.5,7L5.5,5H18.5L16.5,7M11,13V19H6V21H18V19H13V13L21,5V3H3V5L11,13Z"/></svg>`,
      dinner: `<svg ${style} viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>`,
      cake: `<svg ${style} viewBox="0 0 24 24"><path d="M12,13C12,12.45 11.55,12 11,12C10.45,12 10,12.45 10,13V14H12V13M15,13C15,12.45 14.55,12 14,12C13.45,12 13,12.45 13,13V14H15V13M10,17H12V16H10V17M13,17H15V16H13V17M18,9H17V7C17,5.9 16.1,5 15,5H14V3H13V5H11V3H10V5H9C7.9,5 7,5.9 7,7V9H6C4.9,9 4,9.9 4,11V19C4,20.1 4.9,21 6,21H18C19.1,21 20,20.1 20,19V11C20,9.9 19.1,9 18,9M18,19H6V11H18V19Z"/></svg>`,
      music: `<svg ${style} viewBox="0 0 24 24"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/></svg>`
    };
    return icons[name] || `<svg ${style} viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>`;
  }

  renderTimeline() {
    const tEl = document.querySelector('[data-section="timeline"]');
    if (!this.config.sections.timeline) {
      if (tEl) { if (window.__IS_PREVIEW) tEl.style.display = 'none'; else tEl.remove(); }
      return;
    }
    if (tEl) tEl.style.display = '';
    const container = document.querySelector('[data-render="timeline.events"]');
    if (!container) return;
    container.innerHTML = '';
    this.config.timeline.events.forEach((event) => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      const iconSvg = this.getIconSvg(event.icon || 'music');
      const time = this.escapeHtml(event.time);
      const title = this.escapeHtml(event.title || event.text);
      const description = this.escapeHtml(event.description);
      item.innerHTML = `
        <div class="timeline-header">
            <span class="timeline-time">${time}</span>
            <div class="timeline-icon-inline">${iconSvg}</div>
            <h3 class="timeline-title">${title}</h3>
        </div>
        ${event.description ? `<p class="timeline-desc">${description}</p>` : ''}
      `;
      container.appendChild(item);
    });
  }

  renderCalendar() {
    const cEl = document.querySelector('[data-section="calendar"]');
    if (!this.config.sections.calendar) {
      if (cEl) { if (window.__IS_PREVIEW) cEl.style.display = 'none'; else cEl.remove(); }
      return;
    }
    if (cEl) cEl.style.display = '';
    const grid = document.getElementById('calendar-grid');
    const heading = document.querySelector('.calendar-heading');
    if (!grid || !this.config.couple.date) return;
    grid.innerHTML = '';
    const [year, month, day] = this.config.couple.date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    let monthName = dateObj.toLocaleString('ru-RU', { month: 'long' });
    monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    if (heading) heading.textContent = `${monthName} ${year}`;
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayNames.forEach(name => {
      const el = document.createElement('div');
      el.className = 'calendar-day-name';
      el.textContent = name;
      grid.appendChild(el);
    });
    const daysInMonth = new Date(year, month, 0).getDate();
    let firstDayIndex = new Date(year, month - 1, 1).getDay();
    firstDayIndex = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;
    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('div');
      grid.appendChild(empty);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = i;
      if (i === day) dayEl.classList.add('active');
      grid.appendChild(dayEl);
    }
  }

  renderDresscode() {
    const dEl = document.querySelector('[data-section="dresscode"]');
    if (!this.config.sections.dresscode) {
      if (dEl) { if (window.__IS_PREVIEW) dEl.style.display = 'none'; else dEl.remove(); }
      return;
    }
    if (dEl) dEl.style.display = '';
    const palette = document.querySelector('[data-render="dresscode.colors"]');
    if (!palette) return;
    palette.innerHTML = this.config.dresscode.colors
      .map((color, i) => {
        const safeColor = this.safeCssColor(color);
        return `<span class="dresscode-circle circle-${i + 1}" style="background: ${safeColor}; color: ${safeColor}"></span>`;
      })
      .join('');
  }

  renderRSVP() {
    const rEl = document.querySelector('[data-section="rsvp"]');
    if (!this.config.sections.rsvp) {
      if (rEl) { if (window.__IS_PREVIEW) rEl.style.display = 'none'; else rEl.remove(); }
      return;
    }
    if (rEl) rEl.style.display = '';
    const container = document.querySelector('[data-render="rsvp"]');
    if (!container) return;
    const rsvp = this.config.rsvp;
    const fields = rsvp.fields || {};
    const nameField = fields.name || {};
    const presenceField = fields.presence || {};
    const messageField = fields.message || {};
    const formAction = this.safeLinkUrl(rsvp.formAction);
    const formMethod = String(rsvp.method || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST';

    // Check if event is closed for responses (skip in editor preview)
    const meta = window.EVENT_META;
    if (meta && !window.__IS_PREVIEW) {
      const deadlinePassed = meta.rsvpDeadline && new Date(meta.rsvpDeadline) < new Date();
      if (meta.status === 'DRAFT' || meta.status === 'CLOSED' || deadlinePassed) {
        const title = meta.status === 'DRAFT' ? 'Предпросмотр приглашения' : 'Приём ответов завершён';
        const subtitle = meta.status === 'DRAFT'
          ? 'Событие ещё не опубликовано, поэтому ответы гостей пока отключены.'
          : 'Спасибо за внимание к приглашению.';
        container.innerHTML = `
          <div class="rsvp-form-wrap" style="text-align:center; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🕊️</div>
            <h2 class="rsvp-heading" style="margin-bottom: 12px;">${title}</h2>
            <p class="rsvp-subtitle" style="opacity: 0.75;">${subtitle}</p>
          </div>
        `;
        return;
      }
    }
    const allowCompanion = rsvp.allowCompanion !== false; // default true on wedding template
    const companionFieldHtml = allowCompanion ? `
          <div class="rsvp-field rsvp-companion-toggle">
            <label class="rsvp-checkbox-row">
              <input type="checkbox" id="rsvp-companion" name="with_companion">
              <span>Со мной супруг(а)</span>
            </label>
          </div>
          <div class="rsvp-field rsvp-field--floating rsvp-companion-name" id="rsvp-companion-wrap" style="display:none;">
            <input type="text" id="rsvp-spouse" class="rsvp-input" placeholder=" " name="spouse_name" maxlength="100">
            <label class="rsvp-floating-label" for="rsvp-spouse">Имя супруга/и</label>
          </div>` : '';

    container.innerHTML = `
      <div class="rsvp-form-wrap">
        <h2 class="rsvp-heading">${this.escapeHtml(rsvp.heading)}</h2>
        <p class="rsvp-subtitle">${this.escapeHtml(rsvp.subtitle)}</p>
        <form class="rsvp-form" action="${this.escapeHtml(formAction)}" method="${this.escapeHtml(formMethod)}" novalidate>
          <div class="rsvp-field rsvp-field--floating">
            <input type="text" id="rsvp-name" class="rsvp-input" placeholder=" " name="name" ${nameField.required ? 'required' : ''}>
            <label class="rsvp-floating-label" for="rsvp-name">${this.escapeHtml(nameField.label)}</label>
          </div>

          <div class="rsvp-field rsvp-field--floating">
            <input type="tel" id="rsvp-phone" class="rsvp-input" placeholder=" " name="phone" autocomplete="tel" inputmode="tel" maxlength="20">
            <label class="rsvp-floating-label" for="rsvp-phone">Телефон</label>
          </div>

          <div class="rsvp-field rsvp-presence-field">
            <span class="rsvp-static-label">${this.escapeHtml(presenceField.label)}</span>
            <div class="rsvp-presence-toggle">
              <label class="presence-option">
                <input type="radio" name="presence" value="yes" checked>
                <div class="presence-box"><span class="emoji">${this.escapeHtml(presenceField.yesEmoji)}</span><span class="text">${this.escapeHtml(presenceField.yesText)}</span></div>
              </label>
              <label class="presence-option">
                <input type="radio" name="presence" value="no">
                <div class="presence-box"><span class="emoji">${this.escapeHtml(presenceField.noEmoji)}</span><span class="text">${this.escapeHtml(presenceField.noText)}</span></div>
              </label>
            </div>
          </div>

          ${companionFieldHtml}

          <div class="rsvp-field rsvp-field--floating">
            <textarea id="rsvp-message" class="rsvp-input rsvp-textarea" placeholder=" " name="message"></textarea>
            <label class="rsvp-floating-label" for="rsvp-message">${this.escapeHtml(messageField.label)}</label>
          </div>

          <button type="submit" class="rsvp-button">
            <span class="btn-text">${this.escapeHtml(rsvp.submitButton)}</span>
          </button>
        </form>
      </div>
      <div class="rsvp-success">
        <div class="rsvp-success-icon-wrap">
            <div class="rsvp-success-circle">
                <svg viewBox="0 0 24 24" fill="none" class="check-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        </div>
        <div class="rsvp-success-title">Ответ принят!</div>
        <p class="rsvp-success-text">До нашей встречи осталось:</p>
        
        <div class="rsvp-success-timer" id="rsvp-timer">
            <div class="timer-unit">
                <span class="timer-val" id="rsvp-d">0</span>
                <span class="timer-lab">дней</span>
            </div>
            <div class="timer-unit">
                <span class="timer-val" id="rsvp-h">0</span>
                <span class="timer-lab">часов</span>
            </div>
            <div class="timer-unit">
                <span class="timer-val" id="rsvp-m">0</span>
                <span class="timer-lab">минут</span>
            </div>
            <div class="timer-unit">
                <span class="timer-val" id="rsvp-s">00</span>
                <span class="timer-lab">секунд</span>
            </div>
        </div>

        <div class="rsvp-promo">
          <p class="rsvp-promo-text">Понравилось пригласительное? ✨<br>Закажите такое же:</p>
          <a href="https://instagram.com/ivento_kg" target="_blank" class="rsvp-promo-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            @ivento_kg
          </a>
        </div>
      </div>
    `;


    const form = container.querySelector('.rsvp-form');
    const wrap = container.querySelector('.rsvp-form-wrap');
    const success = container.querySelector('.rsvp-success');

    // Show/hide spouse name field based on companion checkbox
    const companionCb = form.querySelector('#rsvp-companion');
    const companionWrap = form.querySelector('#rsvp-companion-wrap');
    if (companionCb && companionWrap) {
      companionCb.addEventListener('change', () => {
        companionWrap.style.display = companionCb.checked ? '' : 'none';
        if (!companionCb.checked) {
          const sp = companionWrap.querySelector('#rsvp-spouse');
          if (sp) sp.value = '';
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      let isValid = true;
      form.querySelectorAll('[required]').forEach(input => {
        if (!input.value.trim()) {
          isValid = false;
          input.parentElement.classList.add('has-error');
          input.addEventListener('input', () => input.parentElement.classList.remove('has-error'), { once: true });
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

      const showSuccess = () => {
        wrap.classList.add('is-hidden');
        success.classList.add('is-visible');
        this.startRSVPCountdown();
      };

      // Editor preview: fake success, don't hit backend
      if (window.__IS_PREVIEW) {
        setTimeout(showSuccess, 1000);
        return;
      }

      const meta = window.EVENT_META || {};
      const slug = meta.slug;
      if (!slug) {
        btn.classList.remove('is-loading');
        this._showRsvpError(form, 'Не удалось определить событие');
        return;
      }

      const presence = form.querySelector('[name="presence"]:checked')?.value || 'yes';
      const status = presence === 'yes' ? 'ATTENDING' : 'DECLINED';
      const name = form.querySelector('[name="name"]')?.value?.trim() || null;
      const phone = form.querySelector('[name="phone"]')?.value?.trim() || null;
      const withCompanion = !!form.querySelector('#rsvp-companion')?.checked;
      const spouseName = withCompanion
        ? (form.querySelector('[name="spouse_name"]')?.value?.trim() || null)
        : null;
      const comment = form.querySelector('[name="message"]')?.value?.trim() || null;
      const groupCode = (meta.prefilledGroupCode || '').trim() || null;

      // Token priority: URL param (personal invite) > localStorage (repeat anonymous visit)
      const urlToken = new URLSearchParams(location.search).get('token') || null;
      const savedToken = localStorage.getItem(`rsvp:${slug}:token`);
      const token = urlToken || savedToken || null;

      try {
        const res = await fetch(`/api/public/events/${encodeURIComponent(slug)}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestToken: token,
            name,
            phone,
            groupCode,
            spouseName,
            status,
            comment
          })
        });
        if (!res.ok) {
          let msg = 'Не удалось отправить ответ';
          try {
            const body = await res.json();
            if (body && body.message) msg = body.message;
          } catch (_) {}
          throw new Error(msg);
        }

        // Save guestToken from response so repeat visits update the same guest
        try {
          const data = await res.json();
          if (data.guestToken) {
            localStorage.setItem(`rsvp:${slug}:token`, data.guestToken);
          }
        } catch (_) {}

        showSuccess();
      } catch (err) {
        btn.classList.remove('is-loading');
        this._showRsvpError(form, err.message || 'Ошибка отправки');
      }
    });
  }

  _showRsvpError(form, message) {
    let errEl = form.querySelector('.rsvp-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'rsvp-error';
      errEl.style.cssText = 'color:#b33030; text-align:center; margin-top:12px; font-size:14px;';
      form.appendChild(errEl);
    }
    errEl.textContent = message;
    form.classList.add('form-shake');
    setTimeout(() => form.classList.remove('form-shake'), 500);
  }

  startRSVPCountdown() {
    const targetDate = new Date(this.config.couple.date).getTime();
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

  render() {
    this.applyTheme();
    this.fillContent();
    this.setImages();
    this.setLinks();
    this.renderHero();
    this.renderInvitation();
    this.renderPhotoStack();
    this.renderLocation();
    this.renderCalendar();
    try { this.renderTimeline(); } catch (e) { }
    this.renderDresscode();
    this.renderRSVP();


    this.initPreloaderDismissal();
  }

  initPreloaderDismissal() {
    const preloader = document.getElementById('ivento-preloader');
    if (!preloader) return;

    const hide = () => {
      setTimeout(() => {
        preloader.classList.add('is-hidden');

        if (this.config.sections && this.config.sections.envelope === false) {
          document.body.classList.remove('loading-active');
        }
      }, 800);
    };

    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const renderer = new WeddingRenderer(window.WEDDING_CONFIG);
  window.weddingRenderer = renderer; // Expose renderer for preview bridge updates.
  renderer.render();
});
