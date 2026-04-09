// ═══════════════════════════════════════════════════════════════════════════
// Template-1 Preview Bridge — postMessage communication with editor
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  const IS_PREVIEW = new URLSearchParams(location.search).get('mode') === 'preview';
  window.__IS_PREVIEW = IS_PREVIEW;
  if (!IS_PREVIEW) return;

  // ─── Suppress features in preview mode ──────────────────────────────────
  if (window.WEDDING_CONFIG) {
    window.WEDDING_CONFIG.sections.envelope = false;
    window.WEDDING_CONFIG.options.enableSecurity = false;
    // Disable scroll-driven animations — elements start hidden (opacity:0) and
    // only become visible via IntersectionObserver, which never fires for
    // dynamically added nodes. Easier to just override in preview.
    window.WEDDING_CONFIG.options.animateOnScroll = false;
    window.WEDDING_CONFIG.options.enableParallax = false;
  }

  // Override animation-related CSS so all elements are visible immediately
  const previewStyle = document.createElement('style');
  previewStyle.textContent = `
    .timeline-item,
    .reveal-heading, .reveal-text, .reveal-card,
    .reveal-circle, .reveal-left, .reveal-right {
      opacity: 1 !important;
      transform: translateY(0) translateX(0) scale(1) !important;
      filter: none !important;
      transition: none !important;
    }
    .reveal-blur-wrapper .char,
    .reveal-blur-wrapper .word,
    .reveal-blur-day {
      opacity: 1 !important;
      animation: none !important;
    }
  `;
  document.head.appendChild(previewStyle);

  // Block guest-loader from running
  window.__SKIP_GUEST_LOADER = true;

  // ─── Section mapping: loaded from schema.json via postMessage ───────────
  // Fallback hardcoded for initial render before first EDITOR_UPDATE arrives
  let SECTION_MAP = {
    hero: 'hero', greeting: 'invitation', calendar: 'calendar',
    gallery: 'photoStack', timeline: 'timeline', location: 'location',
    dresscode: 'dresscode', rsvp: 'rsvp'
  };
  let REVERSE_SECTION_MAP = {};
  function buildReversemap() {
    REVERSE_SECTION_MAP = {};
    for (const [k, v] of Object.entries(SECTION_MAP)) REVERSE_SECTION_MAP[v] = k;
  }
  buildReversemap();

  // ─── Convert editor config → WEDDING_CONFIG ─────────────────────────────
  function applyEditorConfig(cfg) {
    const C = window.WEDDING_CONFIG;
    if (!C) return;
    const form = cfg.form || {};
    const blocks = cfg.blocks || {};

    // Couple / form data
    if (form.person1 !== undefined) C.couple.name1 = form.person1 || 'Имя 1';
    if (form.person2 !== undefined) C.couple.name2 = form.person2 || 'Имя 2';
    if (form.eventDate) {
      C.couple.date = form.eventDate.substring(0, 10);
      const d = new Date(form.eventDate);
      if (!isNaN(d)) {
        const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        C.couple.dateDisplay = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      }
    }
    C.couple.signatureText = `С любовью, ${form.person1 || 'Имя 1'} и ${form.person2 || 'Имя 2'}`;

    // Hero block
    if (blocks.hero) {
      const h = blocks.hero;
      if (h.coverPhoto) C.images.heroBackground = h.coverPhoto;
      // Timer visibility handled via DOM
      // Music
      C.music.enabled = !!h.music;
    }

    // Greeting → Invitation
    if (blocks.greeting) {
      C.sections.invitation = blocks.greeting.enabled !== false;
      C.invitation.heading = blocks.greeting.title || 'Дорогие гости!';
      const txt = blocks.greeting.text || '';
      C.invitation.paragraphs = txt.split('\n').filter(l => l.trim());
      if (C.invitation.paragraphs.length === 0) C.invitation.paragraphs = [''];
    }

    // Calendar
    if (blocks.calendar) {
      C.sections.calendar = !!blocks.calendar.enabled;
    }

    // Gallery
    if (blocks.gallery) {
      C.sections.photoStack = blocks.gallery.enabled !== false;
      if (blocks.gallery.photos && blocks.gallery.photos.length) {
        C.images.gallery = blocks.gallery.photos;
      }
    }

    // Timeline
    if (blocks.timeline) {
      C.sections.timeline = blocks.timeline.enabled !== false;
      if (blocks.timeline.events) {
        C.timeline.events = blocks.timeline.events
          .filter(e => e.time || e.title)
          .map(e => ({
            time: e.time || '',
            title: e.title || '',
            icon: 'cocktail',
            description: ''
          }));
      }
    }

    // Location
    if (blocks.location) {
      C.sections.location = blocks.location.enabled !== false;
      if (blocks.location.placeName !== undefined) C.location.heading = blocks.location.placeName || 'Место';
      if (blocks.location.address !== undefined) C.location.address = blocks.location.address;
      if (blocks.location.mapLink !== undefined) C.location.mapLink = blocks.location.mapLink || '#';
      if (blocks.location.photo) C.images.locationPhoto = blocks.location.photo;
    }

    // Dresscode
    if (blocks.dresscode) {
      C.sections.dresscode = blocks.dresscode.enabled !== false;
      if (blocks.dresscode.text !== undefined) C.dresscode.text = blocks.dresscode.text;
      if (blocks.dresscode.colors) C.dresscode.colors = blocks.dresscode.colors;
    }

    // RSVP
    if (blocks.rsvp) {
      C.sections.rsvp = blocks.rsvp.enabled !== false;
      if (blocks.rsvp.heading) C.rsvp.heading = blocks.rsvp.heading;
      if (blocks.rsvp.subtitle !== undefined) C.rsvp.subtitle = blocks.rsvp.subtitle;
      if (blocks.rsvp.submitButton) C.rsvp.submitButton = blocks.rsvp.submitButton;
    }

    // Always keep envelope off in preview
    C.sections.envelope = false;
    C.sections.hero = true;
  }

  // ─── Toggle section visibility (no .remove()) ──────────────────────────
  function toggleSections() {
    const C = window.WEDDING_CONFIG;
    if (!C) return;
    for (const [blockType, sectionId] of Object.entries(SECTION_MAP)) {
      const el = document.querySelector(`[data-section="${sectionId}"]`);
      if (!el) continue;
      // Hero is always visible
      if (blockType === 'hero') { el.style.display = ''; continue; }
      const enabled = C.sections[sectionId] !== false;
      el.style.display = enabled ? '' : 'none';
    }
    // Also toggle ornaments next to hidden sections
    document.querySelectorAll('.section-ornament').forEach(o => {
      const next = o.nextElementSibling;
      const prev = o.previousElementSibling;
      const nextHidden = next && next.style.display === 'none';
      const prevHidden = prev && prev.style.display === 'none';
      o.style.display = (nextHidden || prevHidden) ? 'none' : '';
    });
    // Wave before dresscode
    document.querySelectorAll('.section-wave').forEach(w => {
      const next = w.nextElementSibling;
      if (next && next.style.display === 'none') w.style.display = 'none';
      else w.style.display = '';
    });
  }

  // ─── Re-render specific parts ───────────────────────────────────────────
  function fullRerender() {
    const renderer = window.weddingRenderer;
    if (!renderer) return;

    renderer.config = window.WEDDING_CONFIG;
    renderer.fillContent();
    renderer.setImages();
    renderer.setLinks();
    renderer.renderInvitation();
    renderer.renderPhotoStack();
    renderer.renderCalendar();
    try { renderer.renderTimeline(); } catch (_) {}
    renderer.renderDresscode();
    renderer.renderRSVP();
    toggleSections();

    // Timer visibility
    const countdown = document.getElementById('hero-countdown');
    if (countdown) {
      const show = window.WEDDING_CONFIG.sections?.hero && window.WEDDING_CONFIG.couple?.date;
      const timerOn = window.WEDDING_CONFIG._timerEnabled;
      countdown.style.display = (show && timerOn) ? '' : 'none';
    }
  }

  // ─── PostMessage listener ───────────────────────────────────────────────
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'EDITOR_UPDATE') {
      // Update section mapping if provided by editor
      if (e.data.config?.sectionMap) {
        SECTION_MAP = e.data.config.sectionMap;
        buildReversemap();
      }
      // Store timer state separately (not in WEDDING_CONFIG standard fields)
      if (e.data.config?.blocks?.hero) {
        window.WEDDING_CONFIG._timerEnabled = !!e.data.config.blocks.hero.timer;
      }
      applyEditorConfig(e.data.config);
      fullRerender();
    }
  });

  // ─── Click delegation: send section clicks to editor ────────────────────
  document.addEventListener('click', (e) => {
    const section = e.target.closest('[data-section]');
    if (!section) return;
    const sectionId = section.getAttribute('data-section');
    const blockType = REVERSE_SECTION_MAP[sectionId];
    if (blockType) {
      window.parent.postMessage({ type: 'TEMPLATE_CLICK', block: blockType }, '*');
    }
  });

  // ─── Notify editor that template is ready ───────────────────────────────
  function notifyReady() {
    window.parent.postMessage({ type: 'TEMPLATE_READY' }, '*');
  }

  // Wait for renderer to finish.
  // Use DOMContentLoaded (not load) so we don't block on slow image/font
  // downloads on mobile — the renderer runs its DOMContentLoaded handler
  // synchronously before any setTimeout fires, so 200 ms is plenty.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(notifyReady, 200));
  } else {
    setTimeout(notifyReady, 200);
  }

  // ─── Patch renderer to not remove sections ─────────────────────────────
  // Override DOMContentLoaded handler behavior — after renderer runs, we fix visibility
  document.addEventListener('DOMContentLoaded', () => {
    // Give renderer time to run, then restore hidden sections and apply our toggle logic
    setTimeout(() => {
      toggleSections();
      // Hide preloader in preview
      const preloader = document.getElementById('ivento-preloader');
      if (preloader) {
        preloader.classList.add('is-hidden');
        document.body.classList.remove('loading-active');
      }
    }, 100);
  });
})();
