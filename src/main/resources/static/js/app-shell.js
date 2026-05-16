(function () {
  const PREFETCHABLE_PATHS = new Set([
    '/',
    '/templates.html',
    '/guests.html',
    '/editor.html'
  ]);
  const SCROLL_KEY_PREFIX = 'tl:scroll:';
  const SNAPSHOT_KEY_PREFIX = 'tl:snapshot:';
  const SNAPSHOT_MAX_AGE = 15 * 60 * 1000;
  const SNAPSHOT_MAX_SIZE = 280000;
  const prefetchedPages = new Set();
  const prefetchedFetches = new Set();
  let swReady = false;
  let snapshotCaptureQueued = false;
  let linkPrefetchInstalled = false;
  let skeletonNavInstalled = false;

  document.documentElement.setAttribute('data-app-shell', 'instant');

  function cacheSet(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ data, at: Date.now() }));
    } catch (_) {}
  }

  function cacheGet(key, maxAge) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof maxAge === 'number' && typeof parsed.at === 'number' && Date.now() - parsed.at > maxAge) {
        return null;
      }
      return parsed.data;
    } catch (_) {
      return null;
    }
  }

  function scheduleIdle(cb) {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(cb, { timeout: 1200 });
    }
    return window.setTimeout(cb, 250);
  }

  function snapshotKey(pathname, search) {
    return SNAPSHOT_KEY_PREFIX + (pathname || location.pathname) + (search || location.search);
  }

  function pageSurface() {
    return document.querySelector('[data-app-surface]');
  }

  // ── Skeleton injection for instant navigation feel ──

  var SKELETON_HTML =
    '<div class="skeleton skeleton-card" style="height:200px;margin-bottom:var(--space-5,20px)"></div>' +
    '<div class="skeleton skeleton-title" style="margin-bottom:var(--space-3,12px)"></div>' +
    '<div class="skeleton skeleton-text" style="width:80%;margin-bottom:var(--space-2,8px)"></div>' +
    '<div class="skeleton skeleton-text" style="width:60%;margin-bottom:var(--space-5,20px)"></div>' +
    '<div class="skeleton skeleton-card" style="height:140px;margin-bottom:var(--space-4,16px)"></div>' +
    '<div class="skeleton skeleton-card" style="height:140px"></div>';

  function injectSkeleton() {
    var surface = pageSurface();
    if (!surface) return;
    surface.setAttribute('data-app-shell-loading', '1');
    surface.innerHTML = SKELETON_HTML;
  }

  function installSkeletonOnNav() {
    if (skeletonNavInstalled) return;
    skeletonNavInstalled = true;
    document.addEventListener('click', function (e) {
      var anchor = anchorFromEvent(e.target);
      if (!shouldPrefetchAnchor(anchor)) return;
      // Don't intercept modifier keys or new tab clicks
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      injectSkeleton();
    }, { capture: true });
  }

  function captureSnapshot() {
    try {
      const surface = pageSurface();
      if (!surface) return false;
      const html = surface.innerHTML;
      if (!html || html.length > SNAPSHOT_MAX_SIZE) return false;
      cacheSet(snapshotKey(), html);
      return true;
    } catch (_) {
      return false;
    }
  }

  function scheduleSnapshotCapture() {
    if (snapshotCaptureQueued) return;
    snapshotCaptureQueued = true;
    scheduleIdle(() => {
      snapshotCaptureQueued = false;
      captureSnapshot();
    });
  }

  function restoreSnapshot() {
    try {
      const surface = pageSurface();
      if (!surface) return false;
      const html = cacheGet(snapshotKey(), SNAPSHOT_MAX_AGE);
      if (!html) return false;
      surface.innerHTML = html;
      document.documentElement.setAttribute('data-app-shell-snapshot', '1');
      return true;
    } catch (_) {
      return false;
    }
  }

  function isInternalAppUrl(url) {
    return url.origin === location.origin && PREFETCHABLE_PATHS.has(url.pathname);
  }

  function normalizeHref(url) {
    return url.pathname + url.search;
  }

  function prefetchPage(href) {
    try {
      const url = new URL(href, location.href);
      if (!isInternalAppUrl(url)) return false;
      const normalized = normalizeHref(url);
      if (prefetchedPages.has(normalized)) return true;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = normalized;
      document.head.appendChild(link);
      prefetchedPages.add(normalized);
      if (!prefetchedFetches.has(normalized)) {
        prefetchedFetches.add(normalized);
        fetch(normalized, {
          credentials: 'same-origin',
          headers: { 'X-App-Shell-Prefetch': '1' }
        }).catch(() => {});
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function warmServiceWorkerUrls(urls) {
    if (!swReady || !navigator.serviceWorker?.controller || !Array.isArray(urls) || urls.length === 0) return;
    navigator.serviceWorker.controller.postMessage({
      type: 'WARM_URLS',
      urls
    });
  }

  async function prefetchJSON(key, url, options, maxAge) {
    const cached = cacheGet(key, maxAge);
    if (cached) return cached;
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        signal: controller?.signal,
        ...(options || {})
      });
      if (!response.ok) return null;
      const data = await response.json();
      cacheSet(key, data);
      return data;
    } catch (_) {
      return null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function anchorFromEvent(target) {
    return target && target.closest ? target.closest('a[href]') : null;
  }

  function shouldPrefetchAnchor(anchor) {
    if (!anchor) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.dataset.prefetch === 'off') return false;
    const href = anchor.getAttribute('href');
    if (!href) return false;
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      return false;
    }
    try {
      return isInternalAppUrl(new URL(href, location.href));
    } catch (_) {
      return false;
    }
  }

  function installLinkPrefetch() {
    if (linkPrefetchInstalled) return;
    linkPrefetchInstalled = true;
    const handler = (event) => {
      const anchor = anchorFromEvent(event.target);
      if (shouldPrefetchAnchor(anchor)) prefetchPage(anchor.href);
    };
    document.addEventListener('touchstart', handler, { capture: true, passive: true });
    document.addEventListener('pointerdown', handler, { capture: true, passive: true });
    document.addEventListener('mouseover', handler, { capture: true, passive: true });
    document.addEventListener('focusin', handler, { capture: true, passive: true });
  }

  function installServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        swReady = true;
        warmServiceWorkerUrls(['/', '/templates.html', '/editor.html']);
        if (registration.active?.postMessage) {
          registration.active.postMessage({ type: 'WARM_URLS', urls: ['/', '/templates.html', '/editor.html'] });
        }
      })
      .catch(() => {});
  }

  function prefetchVisibleLinks(limit) {
    let count = 0;
    const seen = new Set();
    const anchors = document.querySelectorAll('a[href]');
    for (const anchor of anchors) {
      if (!shouldPrefetchAnchor(anchor)) continue;
      const url = new URL(anchor.href, location.href);
      const normalized = normalizeHref(url);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      prefetchPage(normalized);
      count += 1;
      if (count >= (limit || 6)) break;
    }
  }

  function warmCommonPages() {
    if (location.pathname === '/') prefetchPage('/templates.html');
    else prefetchPage('/');
  }

  function scrollKey() {
    return SCROLL_KEY_PREFIX + location.pathname + location.search;
  }

  function saveScroll() {
    cacheSet(scrollKey(), { x: window.scrollX, y: window.scrollY });
  }

  function restoreScroll() {
    if (location.hash) return;
    const saved = cacheGet(scrollKey(), 30 * 60 * 1000);
    if (!saved || typeof saved.y !== 'number') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(saved.x || 0, saved.y || 0);
      });
    });
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  window.addEventListener('pagehide', () => {
    saveScroll();
    captureSnapshot();
  });
  window.addEventListener('beforeunload', () => {
    saveScroll();
    captureSnapshot();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) restoreScroll();
  });

  document.addEventListener('DOMContentLoaded', () => {
    restoreScroll();
    installLinkPrefetch();
    installSkeletonOnNav();
    scheduleIdle(() => {
      installServiceWorker();
      warmCommonPages();
      prefetchVisibleLinks(8);
      warmServiceWorkerUrls(['/', '/templates.html', '/editor.html']);
    });
  });

  window.ToiAppShell = {
    cacheGet,
    cacheSet,
    prefetchPage,
    prefetchJSON,
    scheduleIdle,
    warmServiceWorkerUrls,
    captureSnapshot,
    scheduleSnapshotCapture,
    restoreSnapshot
  };
})();
