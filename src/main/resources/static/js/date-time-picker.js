(function () {
  'use strict';

  const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let active = null;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseTime(value) {
    const match = String(value || '').match(/(?:T|^)(\d{2}):(\d{2})/);
    return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: 17, minute: 0 };
  }

  function normalizeValue(mode, date, hour, minute) {
    if (mode === 'time') return `${pad(hour)}:${pad(minute)}`;
    if (mode === 'datetime') return `${isoDate(date)}T${pad(hour)}:${pad(minute)}`;
    return isoDate(date);
  }

  function setValue(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function icon(path) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  function open(input) {
    close();

    const mode = input.dataset.tlPicker || 'date';
    const now = new Date();
    const selectedDate = parseDate(input.value) || new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const time = parseTime(input.value);

    active = {
      input,
      mode,
      viewYear: selectedDate.getFullYear(),
      viewMonth: selectedDate.getMonth(),
      date: selectedDate,
      hour: time.hour,
      minute: time.minute
    };

    document.documentElement.classList.add('tl-dtp-lock');
    render();
  }

  function close() {
    document.querySelector('.tl-dtp-backdrop')?.remove();
    document.documentElement.classList.remove('tl-dtp-lock');
    active = null;
  }

  function render() {
    if (!active) return;
    document.querySelector('.tl-dtp-backdrop')?.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'tl-dtp-backdrop';
    backdrop.innerHTML = `
      <section class="tl-dtp" role="dialog" aria-modal="true" aria-label="Выбор даты и времени">
        ${active.mode === 'time' ? '' : renderHeader()}
        <div class="tl-dtp-body">
          ${active.mode === 'time' ? '' : renderCalendar()}
          ${active.mode === 'date' ? '' : renderTime()}
        </div>
        <footer class="tl-dtp-foot">
          <button class="tl-dtp-btn secondary" type="button" data-dtp-cancel>Отмена</button>
          <button class="tl-dtp-btn primary" type="button" data-dtp-apply>Готово</button>
        </footer>
      </section>
    `;
    document.body.appendChild(backdrop);
    bind(backdrop);
    syncWheels(backdrop);
  }

  function renderHeader() {
    return `
      <header class="tl-dtp-head">
        <button class="tl-dtp-icon" type="button" data-dtp-prev aria-label="Предыдущий месяц">
          ${icon('<path d="m15 18-6-6 6-6"/>')}
        </button>
        <div class="tl-dtp-month">${MONTHS[active.viewMonth]} ${active.viewYear}</div>
        <button class="tl-dtp-icon" type="button" data-dtp-next aria-label="Следующий месяц">
          ${icon('<path d="m9 18 6-6-6-6"/>')}
        </button>
      </header>
    `;
  }

  function renderCalendar() {
    const first = new Date(active.viewYear, active.viewMonth, 1);
    const firstDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(active.viewYear, active.viewMonth + 1, 0).getDate();
    const todayIso = isoDate(new Date());
    const selectedIso = isoDate(active.date);
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push('<span class="tl-dtp-day is-empty"></span>');
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(active.viewYear, active.viewMonth, day);
      const dateIso = isoDate(date);
      const cls = [
        'tl-dtp-day',
        dateIso === todayIso ? 'is-today' : '',
        dateIso === selectedIso ? 'is-selected' : ''
      ].filter(Boolean).join(' ');
      cells.push(`<button class="${cls}" type="button" data-dtp-day="${dateIso}">${day}</button>`);
    }

    return `
      <div class="tl-dtp-week">${WEEK.map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="tl-dtp-grid">${cells.join('')}</div>
    `;
  }

  function renderTime() {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    return `
      <div class="tl-dtp-time">
        <p class="tl-dtp-time-title">Время начала</p>
        <div class="tl-dtp-wheels">
          <div class="tl-dtp-wheel" data-dtp-wheel="hour">
            ${hours.map((h) => `<button class="tl-dtp-option ${h === active.hour ? 'is-selected' : ''}" type="button" data-dtp-hour="${h}">${pad(h)}</button>`).join('')}
          </div>
          <div class="tl-dtp-wheel" data-dtp-wheel="minute">
            ${minutes.map((m) => `<button class="tl-dtp-option ${m === active.minute ? 'is-selected' : ''}" type="button" data-dtp-minute="${m}">${pad(m)}</button>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function bind(root) {
    root.addEventListener('click', (event) => {
      if (event.target === root) {
        close();
        return;
      }

      const prev = event.target.closest('[data-dtp-prev]');
      const next = event.target.closest('[data-dtp-next]');
      const day = event.target.closest('[data-dtp-day]');
      const hour = event.target.closest('[data-dtp-hour]');
      const minute = event.target.closest('[data-dtp-minute]');

      if (prev || next) {
        const delta = next ? 1 : -1;
        active.viewMonth += delta;
        if (active.viewMonth < 0) { active.viewMonth = 11; active.viewYear--; }
        if (active.viewMonth > 11) { active.viewMonth = 0; active.viewYear++; }
        render();
        return;
      }
      if (day) {
        active.date = parseDate(day.dataset.dtpDay) || active.date;
        render();
        return;
      }
      if (hour) {
        active.hour = Number(hour.dataset.dtpHour);
        updateOptionState(root);
        centerOption(hour);
        return;
      }
      if (minute) {
        active.minute = Number(minute.dataset.dtpMinute);
        updateOptionState(root);
        centerOption(minute);
        return;
      }
      if (event.target.closest('[data-dtp-cancel]')) close();
      if (event.target.closest('[data-dtp-apply]')) {
        setValue(active.input, normalizeValue(active.mode, active.date, active.hour, active.minute));
        close();
      }
    });

    root.querySelectorAll('.tl-dtp-wheel').forEach((wheel) => {
      let timer = null;
      wheel.addEventListener('scroll', () => {
        clearTimeout(timer);
        timer = setTimeout(() => pickCentered(wheel), 90);
      }, { passive: true });
    });
  }

  function updateOptionState(root) {
    root.querySelectorAll('[data-dtp-hour]').forEach((el) => {
      el.classList.toggle('is-selected', Number(el.dataset.dtpHour) === active.hour);
    });
    root.querySelectorAll('[data-dtp-minute]').forEach((el) => {
      el.classList.toggle('is-selected', Number(el.dataset.dtpMinute) === active.minute);
    });
  }

  function pickCentered(wheel) {
    const rect = wheel.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    let best = null;
    let bestDistance = Infinity;
    wheel.querySelectorAll('.tl-dtp-option').forEach((option) => {
      const optionRect = option.getBoundingClientRect();
      const optionCenter = optionRect.top + optionRect.height / 2;
      const distance = Math.abs(optionCenter - center);
      if (distance < bestDistance) {
        best = option;
        bestDistance = distance;
      }
    });
    if (!best) return;
    if (best.dataset.dtpHour !== undefined) active.hour = Number(best.dataset.dtpHour);
    if (best.dataset.dtpMinute !== undefined) active.minute = Number(best.dataset.dtpMinute);
    updateOptionState(wheel.closest('.tl-dtp'));
  }

  function centerOption(option) {
    if (!option) return;
    option.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function syncWheels(root) {
    window.setTimeout(() => {
      centerOption(root.querySelector(`[data-dtp-hour="${active.hour}"]`));
      centerOption(root.querySelector(`[data-dtp-minute="${active.minute}"]`));
    }, 0);
  }

  function enhance(scope) {
    (scope || document).querySelectorAll('[data-tl-picker]').forEach((input) => {
      if (input.dataset.tlPickerReady) return;
      input.dataset.tlPickerReady = '1';
      input.readOnly = true;
      input.addEventListener('click', () => open(input));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(input);
        }
      });
    });
  }

  window.ToiDateTimePicker = { enhance, open, close };

  document.addEventListener('DOMContentLoaded', () => enhance(document));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active) close();
  });
})();
