(async function () {
  'use strict';

  const params     = new URLSearchParams(location.search);
  const isPreview  = params.get('mode') === 'preview';
  const slug       = location.pathname.split('/').filter(Boolean).pop();
  const guestToken = params.get('token');

  // ─── Preview mode: no API call, listen for postMessage ────────────────────
  if (isPreview) {
    window._t2Preview = true;
    window.T2_CONFIG = { modules: {} };
    await loadScript('/templates/template-2/js/main.js');
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('visible'));

    window.addEventListener('message', (e) => {
      if (e.data?.type === 'T2_UPDATE' && typeof window.T2_APPLY === 'function') {
        window.T2_CONFIG = e.data.config;
        window.T2_APPLY(e.data.config);
      }
    });

    // Signal ready to parent editor
    window.parent.postMessage({ type: 'T2_READY' }, '*');
    return;
  }

  // ─── Normal mode: fetch from API ──────────────────────────────────────────
  try {
    const res = await fetch('/api/public/events/' + slug);
    if (!res.ok) { showError(); return; }
    const event = await res.json();

    let bc = {};
    try { bc = JSON.parse(event.blocksConfig || '{}'); } catch (_) {}

    const enabled = (block) => !block || block.enabled !== false;

    // Date formatting
    const dateObj = event.eventDate ? new Date(event.eventDate) : null;
    const pad = n => String(n).padStart(2, '0');
    const dateDisplay = dateObj
      ? `${dateObj.getDate()} · ${pad(dateObj.getMonth() + 1)} · ${dateObj.getFullYear()}`
      : '';
    const dateShort = dateObj
      ? `${pad(dateObj.getDate())}.${pad(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`
      : '';

    // Schedule
    const scheduleItems = ((bc.schedule?.items) || '')
      .split('\n').map(l => l.trim()).filter(Boolean)
      .map(line => {
        const m = line.match(/^(\d{1,2}:\d{2})\s+(.*)/);
        return m ? { time: m[1], title: m[2] } : { time: '', title: line };
      });

    // Dresscode palette
    const palette = ((bc.dresscode?.palette) || '#E8EBE6,#2C3531,#B9C4BC,#F2F4F1,#7C9082')
      .split(',').map(s => s.trim()).filter(Boolean);

    // Photo
    const photoUrl = bc.photo?.url || null;

    window.T2_CONFIG = {
      modules: {
        photo:     enabled(bc.photo)     && !!photoUrl,
        greeting:  enabled(bc.greeting)  && !!(bc.greeting?.text),
        countdown: !!event.eventDate,
        schedule:  enabled(bc.schedule)  && scheduleItems.length > 0,
        location:  enabled(bc.location)  && !!(bc.location?.placeName || bc.location?.address),
        dresscode: enabled(bc.dresscode) && !!(bc.dresscode?.text || bc.dresscode?.palette),
        rsvp:      event.status !== 'CLOSED',
      },
      badge:       bc.hero?.badge    || '',
      name1:       event.person1     || '',
      name2:       event.person2     || '',
      eventDate:   event.eventDate   || null,
      dateDisplay, dateShort,
      subtitle:    bc.hero?.subtitle || '',
      photoUrl,
      greeting: {
        title: bc.greeting?.title || '',
        text:  bc.greeting?.text  || '',
      },
      schedule: scheduleItems,
      location: {
        placeName: bc.location?.placeName || '',
        address:   bc.location?.address   || event.location || '',
        mapLink:   bc.location?.mapLink   || '#',
      },
      dresscode: {
        text:    bc.dresscode?.text || '',
        palette: palette,
      },
      rsvp: {
        title:   'Подтверждение',
        subtitle: event.rsvpDeadline
          ? 'Просим подтвердить до ' + new Date(event.rsvpDeadline).toLocaleDateString('ru-RU')
          : '',
        _slug:       slug,
        _guestToken: guestToken,
      },
    };

    await loadScript('/templates/template-2/js/main.js');

  } catch (e) {
    console.error('ToiLink bridge error:', e);
    showError();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function showError() {
    document.body.style.cssText = 'margin:0;background:#FAFAF8;display:flex;align-items:center;justify-content:center;min-height:100dvh;font-family:sans-serif';
    document.body.innerHTML = `<div style="text-align:center;color:#111;padding:40px">
      <p style="font-size:56px;opacity:0.08;font-family:serif;font-style:italic">404</p>
      <p style="opacity:0.35;margin-top:8px;font-size:14px">Приглашение не найдено</p>
    </div>`;
  }
})();
