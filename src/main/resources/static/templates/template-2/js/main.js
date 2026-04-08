(function () {
  'use strict';

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const el   = id => document.getElementById(id);
  const q    = sel => document.querySelector(sel);
  const setText = (id, v) => { const e = el(id); if (e && v != null) e.textContent = v; };
  const setHTML = (id, v) => { const e = el(id); if (e && v != null) e.innerHTML = v; };
  const setAttr = (id, a, v) => { const e = el(id); if (e && v) e.setAttribute(a, v); };
  const show = id => { const e = el(id); if (e) e.style.display = ''; };
  const hide = id => { const e = el(id); if (e) e.style.display = 'none'; };

  // ─── State for re-callable timers ────────────────────────────────────────────
  let _cdTimer = null;

  // ─── applyConfig ─────────────────────────────────────────────────────────────
  function applyConfig(C) {
    if (!C) return;
    const m = C.modules || {};

    // ── Module visibility ─────────────────────────────────────────────────────
    m.photo     === false ? hide('photo-block') : show('photo-block');
    m.greeting  === false ? hide('greeting')   : show('greeting');
    m.countdown === false ? hide('countdown')  : show('countdown');
    m.schedule  === false ? hide('schedule')   : show('schedule');
    m.location  === false ? hide('location')   : show('location');
    m.dresscode === false ? hide('dresscode')  : show('dresscode');
    m.rsvp      === false ? hide('rsvp')       : show('rsvp');

    // ── Hero ──────────────────────────────────────────────────────────────────
    setText('heroBadge',    C.badge    || '');
    setText('heroName1',    C.name1    || '');
    setText('heroName2',    C.name2    || '');
    setText('heroDate',     C.dateDisplay || '');
    setText('heroSubtitle', C.subtitle || '');

    // ── Photo ─────────────────────────────────────────────────────────────────
    if (m.photo !== false && C.photoUrl) {
      setAttr('mainPhoto', 'src', C.photoUrl);
      el('photo-block') && (el('photo-block').style.display = '');
    }

    // ── Greeting ──────────────────────────────────────────────────────────────
    if (m.greeting !== false) {
      setText('greetingTitle', C.greeting?.title || '');
      const textEl = el('greetingText');
      if (textEl) {
        const raw = C.greeting?.text || '';
        textEl.innerHTML = raw.replace(/\n/g, '<br>');
      }
    }

    // ── Countdown ─────────────────────────────────────────────────────────────
    if (_cdTimer) { clearInterval(_cdTimer); _cdTimer = null; }
    if (m.countdown !== false && C.eventDate) {
      const target = new Date(C.eventDate).getTime();
      function tick() {
        const diff = target - Date.now();
        if (diff <= 0) {
          setText('cd-days', '0'); setText('cd-hours', '00'); setText('cd-mins', '00');
          return;
        }
        setText('cd-days',  Math.floor(diff / 86400000));
        setText('cd-hours', String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'));
        setText('cd-mins',  String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'));
      }
      tick();
      _cdTimer = setInterval(tick, 30000);
    }

    // ── Schedule ──────────────────────────────────────────────────────────────
    if (m.schedule !== false && C.schedule?.length) {
      const list = el('scheduleList');
      if (list) {
        list.innerHTML = C.schedule.map(item => `
          <div class="schedule__item">
            <div class="schedule__time">${item.time}</div>
            <div class="schedule__event">${item.title}</div>
          </div>`).join('');
      }
    }

    // ── Location ──────────────────────────────────────────────────────────────
    if (m.location !== false) {
      setText('locationName',    C.location?.placeName || '');
      setText('locationAddress', C.location?.address   || '');
      const btn = el('locationBtn');
      if (btn) {
        const link = C.location?.mapLink;
        if (link && link !== '#') {
          btn.href = link;
          btn.style.display = '';
        } else {
          btn.style.display = 'none';
        }
      }
    }

    // ── Dresscode ────────────────────────────────────────────────────────────
    if (m.dresscode !== false && C.dresscode) {
      setText('dresscodeText', C.dresscode.text || '');
      const pal = el('dresscodePalette');
      if (pal && C.dresscode.palette?.length) {
        pal.innerHTML = C.dresscode.palette.map(c =>
          `<div class="dresscode__color" style="background:${c}"></div>`
        ).join('');
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    if (C.name1 && C.name2) setText('footerNames', `${C.name1} & ${C.name2}`);
    setText('footerDate', C.dateShort || '');

    // ── RSVP text ─────────────────────────────────────────────────────────────
    setText('rsvpTitle',    C.rsvp?.title    || 'Подтверждение');
    setText('rsvpSubtitle', C.rsvp?.subtitle || '');

    // ── Preview mode: make all reveals instantly visible ─────────────────────
    if (window._t2Preview) {
      document.querySelectorAll('.reveal').forEach(e => e.classList.add('visible'));
    }
  }

  // ─── Expose for preview mode ──────────────────────────────────────────────
  window.T2_APPLY = applyConfig;

  // ─── Initial apply ────────────────────────────────────────────────────────
  if (window.T2_CONFIG) applyConfig(window.T2_CONFIG);

  // ─── One-time interactivity (skip in preview) ─────────────────────────────
  if (window._t2Preview) return;

  // Scroll reveal
  if (!window._t2RevealInit) {
    window._t2RevealInit = true;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(e => obs.observe(e));
  }

  // RSVP form
  const form = el('rsvpForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const name   = (el('rsvpName')?.value || '').trim();
      const attend = el('rsvpAttend')?.value;
      if (!name) return;

      const btn = el('rsvpBtn');
      btn.disabled = true;
      btn.textContent = 'Отправка...';

      const C    = window.T2_CONFIG || {};
      const slug = C.rsvp?._slug;

      if (slug) {
        try {
          const res = await fetch('/api/public/events/' + slug + '/rsvp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guestToken: C.rsvp?._guestToken || null,
              name,
              status: attend === 'yes' ? 'ATTENDING' : 'DECLINED',
              groupSize: 1, comment: null,
            }),
          });
          if (!res.ok) throw new Error();
        } catch {
          btn.disabled = false;
          btn.textContent = 'Отправить';
          return;
        }
      }

      form.style.display = 'none';
      const success = el('rsvpSuccess');
      if (success) success.classList.add('visible');
    });
  }

})();
