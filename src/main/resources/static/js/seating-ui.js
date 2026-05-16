// Smart seating UI controller — launch sheet + report sheet, owns Worker lifecycle.
// Depends on global helpers from guests.js: api(), toast(), eventId, allGuests, allTables.
'use strict';

(function () {
  let worker = null;
  let currentResult = null;
  let currentOptions = null;

  function openLaunchSheet() {
    if (!Array.isArray(window._allGuestsRef) || !Array.isArray(window._allTablesRef)) {
      window.toast?.('Данные ещё загружаются', false);
      return;
    }
    const guests = window._allGuestsRef;
    const tables = window._allTablesRef;
    if (tables.length === 0) {
      window.toast?.('Сначала создайте хотя бы один стол', false);
      return;
    }
    const sheet = document.getElementById('seatLaunchSheet');
    const backdrop = document.getElementById('seatLaunchBackdrop');
    if (!sheet || !backdrop) return;

    // Counters for the dialog body
    const total = guests.length;
    const attending = guests.filter(g => g.rsvpStatus === 'ATTENDING').length;
    const pending = guests.filter(g => g.rsvpStatus == null || g.rsvpStatus === 'PENDING').length;
    const declined = guests.filter(g => g.rsvpStatus === 'DECLINED').length;
    const totalCapacity = tables.reduce((s, t) => s + (t.capacity || 12), 0);
    const willSeat = attending + pending;

    sheet.querySelector('#seat-counter').textContent =
      `${attending} придут · ${pending} ждём · ${declined} отказались`;
    sheet.querySelector('#seat-capacity-line').textContent =
      `${tables.length} ${pluralize(tables.length, ['стол','стола','столов'])} · ${totalCapacity} ${pluralize(totalCapacity, ['место','места','мест'])} всего`;
    sheet.querySelector('#seat-target-line').textContent =
      `Будем рассаживать: ${willSeat} ${pluralize(willSeat, ['гость','гостя','гостей'])}`;

    // Reset controls
    sheet.querySelector('#seat-include-pending').checked = true;
    setSeatMode('soft');

    // Compute preflight warnings (preview only — no full algorithm yet)
    const warnings = previewWarnings(guests, tables);
    renderPreflight(warnings);

    sheet.querySelector('#seat-progress').style.display = 'none';
    sheet.querySelector('#seat-run-btn').disabled = false;

    sheet.classList.add('open');
    backdrop.classList.add('open');
  }

  function closeLaunchSheet() {
    document.getElementById('seatLaunchSheet')?.classList.remove('open');
    document.getElementById('seatLaunchBackdrop')?.classList.remove('open');
    if (worker) { worker.terminate(); worker = null; }
  }

  function openReportSheet() {
    const sheet = document.getElementById('seatReportSheet');
    const backdrop = document.getElementById('seatReportBackdrop');
    if (!sheet || !backdrop || !currentResult) return;
    renderReport(currentResult);
    sheet.classList.add('open');
    backdrop.classList.add('open');
  }

  function closeReportSheet() {
    document.getElementById('seatReportSheet')?.classList.remove('open');
    document.getElementById('seatReportBackdrop')?.classList.remove('open');
  }

  function setSeatMode(mode) {
    document.querySelectorAll('#seat-mode-control .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.getElementById('seat-mode').value = mode;
  }

  // ─── Preflight (fast scan, no full algorithm) ─────────────────────────────
  function previewWarnings(guests, tables) {
    // Find groups via Union-Find (mirror of algorithm's logic)
    const active = guests.filter(g => g.rsvpStatus !== 'DECLINED');
    const idToIdx = new Map();
    active.forEach((g, i) => idToIdx.set(g.id, i));
    const parent = active.map((_, i) => i);
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    active.forEach((g, i) => {
      if (g.relatedToId != null && idToIdx.has(g.relatedToId)) union(i, idToIdx.get(g.relatedToId));
    });
    const groupSizes = new Map();
    active.forEach((g, i) => {
      const r = find(i);
      groupSizes.set(r, (groupSizes.get(r) || 0) + 1);
    });

    const maxCap = tables.reduce((m, t) => Math.max(m, t.capacity || 12), 0) || 12;
    const oversized = Array.from(groupSizes.values()).filter(s => s > maxCap).length;

    // Locked overflow
    const lockedByTable = new Map();
    active.forEach(g => {
      if (g.tableId != null) lockedByTable.set(g.tableId, (lockedByTable.get(g.tableId) || 0) + 1);
    });
    const overflow = tables
      .map(t => ({ name: t.name, cap: t.capacity || 12, cnt: lockedByTable.get(t.id) || 0 }))
      .filter(t => t.cnt > t.cap);

    const declinedWithTable = guests.filter(g => g.rsvpStatus === 'DECLINED' && g.tableId != null).length;

    return { oversized, overflow, declinedWithTable };
  }

  function renderPreflight(w) {
    const box = document.getElementById('seat-preflight');
    if (!box) return;
    const items = [];
    if (w.overflow.length > 0) {
      items.push(`
        <div class="seat-warn seat-warn-strong">
          <div class="seat-warn-title">⚠ Столы перегружены</div>
          <div class="seat-warn-body">
            ${w.overflow.map(o => `«${escapeHtml(o.name)}»: ${o.cnt} гостей при вместимости ${o.cap}`).join('<br>')}
            <div style="margin-top:6px; font-size:12px;">Алгоритм не сможет это исправить. Увеличьте вместимость или переместите лишних гостей.</div>
          </div>
        </div>`);
    }
    if (w.oversized > 0) {
      items.push(`
        <div class="seat-warn">
          <div class="seat-warn-title">Большие группы</div>
          <div class="seat-warn-body">${w.oversized} ${pluralize(w.oversized, ['группа','группы','групп'])} больше самого большого стола — придётся разделить (сохранив супружеские пары вместе).</div>
        </div>`);
    }
    if (w.declinedWithTable > 0) {
      items.push(`
        <div class="seat-warn seat-warn-soft">
          <div class="seat-warn-body">Освободим ${w.declinedWithTable} ${pluralize(w.declinedWithTable, ['место','места','мест'])} от отказавшихся гостей.</div>
        </div>`);
    }
    box.innerHTML = items.join('');
    box.style.display = items.length ? '' : 'none';
  }

  // ─── Run via Worker ───────────────────────────────────────────────────────
  async function runSeating() {
    const launchSheet = document.getElementById('seatLaunchSheet');
    const includePending = launchSheet.querySelector('#seat-include-pending').checked;
    const mode = launchSheet.querySelector('#seat-mode').value || 'soft';
    const hardReset = mode === 'hard';

    if (hardReset) {
      const ok = window.confirm('Сбросить все ручные привязки гостей к столам и пересадить с нуля?');
      if (!ok) return;
    }

    const guests = window._allGuestsRef.map(g => ({
      id: g.id,
      name: g.name,
      side: g.side || 'SHARED',
      rsvpStatus: g.rsvpStatus || null,
      tableId: g.tableId ?? null,
      relatedToId: g.relatedToId ?? null,
      relationType: g.relationType || null,
    }));
    const tables = window._allTablesRef.map(t => ({
      id: t.id,
      name: t.name,
      capacity: t.capacity || 12,
    }));

    currentOptions = { includePending, hardReset };
    const progressBar = launchSheet.querySelector('#seat-progress-bar');
    const progressBox = launchSheet.querySelector('#seat-progress');
    const runBtn = launchSheet.querySelector('#seat-run-btn');
    progressBox.style.display = '';
    progressBar.style.width = '0%';
    runBtn.disabled = true;
    runBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 018-8V2.5M20 12a8 8 0 01-8 8v1.5"/></svg> Рассаживаем...';

    try {
      const result = await runInWorker({ guests, tables, options: { includePending, hardReset } }, frac => {
        progressBar.style.width = `${Math.round(frac * 100)}%`;
      });
      currentResult = result;
      closeLaunchSheet();
      openReportSheet();
    } catch (err) {
      window.toast?.(err.message || 'Ошибка алгоритма', false);
      runBtn.disabled = false;
      runBtn.innerHTML = 'Запустить рассадку';
      progressBox.style.display = 'none';
    }
  }

  function runInWorker(payload, onProgress) {
    return new Promise((resolve, reject) => {
      try {
        if (worker) worker.terminate();
        worker = new Worker('/js/seating-worker.js');
        worker.onmessage = (ev) => {
          const { type, frac, result, message } = ev.data || {};
          if (type === 'progress') onProgress?.(frac);
          else if (type === 'done') { worker.terminate(); worker = null; resolve(result); }
          else if (type === 'error') { worker.terminate(); worker = null; reject(new Error(message)); }
        };
        worker.onerror = (e) => { worker?.terminate(); worker = null; reject(e); };
        worker.postMessage({ type: 'run', payload });
      } catch (e) { reject(e); }
    });
  }

  // ─── Report rendering ─────────────────────────────────────────────────────
  function renderReport(result) {
    const pct = Math.round(result.score.total / Math.max(1, result.score.maxPossible) * 100);
    document.getElementById('seat-score-num').textContent = `${pct}%`;
    document.getElementById('seat-score-sub').textContent =
      `Сохранность пар: ${Math.round(result.score.couplesPct)}%`;

    // Tables breakdown
    const tableList = document.getElementById('seat-report-tables');
    tableList.innerHTML = result.tables.map(t => {
      const fill = Math.round((t.seated / Math.max(1, t.capacity)) * 100);
      const zoneLabel = t.zone === 'BRIDE' ? 'Невеста' : t.zone === 'GROOM' ? 'Жених' : 'Общий';
      const zoneColor = t.zone === 'BRIDE' ? '#C71F5C' : t.zone === 'GROOM' ? '#2F4DAF' : '#7C5520';
      return `
        <div class="seat-report-table">
          <div class="srt-head">
            <span class="srt-name">${escapeHtml(t.name)}</span>
            <span class="srt-zone" style="color:${zoneColor};">${zoneLabel}</span>
            <span class="srt-fill">${t.seated}/${t.capacity}</span>
          </div>
          <div class="srt-mix">
            ${t.sideMix.BRIDE ? `<span style="color:#C71F5C;">●${t.sideMix.BRIDE}</span>` : ''}
            ${t.sideMix.GROOM ? `<span style="color:#2F4DAF;">●${t.sideMix.GROOM}</span>` : ''}
            ${t.sideMix.SHARED ? `<span style="color:#8A7F76;">●${t.sideMix.SHARED}</span>` : ''}
            <span class="srt-bar"><span class="srt-bar-fill" style="width:${fill}%;"></span></span>
          </div>
        </div>`;
    }).join('');

    // Warnings
    const warns = [];
    if (result.separatedGroups.length > 0) {
      warns.push(`${result.separatedGroups.length} ${pluralize(result.separatedGroups.length, ['группа разделена','группы разделены','групп разделено'])}`);
    }
    if (result.oversizedGroups.length > 0) {
      warns.push(`${result.oversizedGroups.length} больших групп пришлось разделить`);
    }
    if (result.lockedOverflow.length > 0) {
      warns.push(`${result.lockedOverflow.length} столов перегружены вручную`);
    }
    if (result.unassigned.length > 0) {
      warns.push(`${result.unassigned.length} ${pluralize(result.unassigned.length, ['гость','гостя','гостей'])} не получили место`);
    }
    if (result.declinedFreed.length > 0) {
      warns.push(`Освобождено ${result.declinedFreed.length} ${pluralize(result.declinedFreed.length, ['место','места','мест'])} от отказавшихся`);
    }
    document.getElementById('seat-report-warns').innerHTML = warns.length
      ? warns.map(w => `<div class="seat-report-warn">${w}</div>`).join('')
      : '<div class="seat-report-ok">Без конфликтов</div>';

    // Diff vs current
    const currentByGuest = new Map();
    for (const g of window._allGuestsRef) currentByGuest.set(g.id, g.tableId ?? null);
    let moves = 0;
    for (const a of result.assignments) {
      const cur = currentByGuest.get(a.guestId);
      if (cur !== a.tableId) moves++;
    }
    document.getElementById('seat-report-diff').textContent =
      `${moves} ${pluralize(moves, ['гость переедет','гостя переедет','гостей переедет'])}`;
  }

  // ─── Apply ────────────────────────────────────────────────────────────────
  async function applyResult() {
    if (!currentResult) return;
    const btn = document.getElementById('seat-apply-btn');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 018-8V2.5M20 12a8 8 0 01-8 8v1.5"/></svg> Сохраняем...';

    try {
      const eid = window.eventId || (new URLSearchParams(location.search)).get('id');
      await window.api('PUT', `/api/organizer/events/${eid}/seating`, {
        assignments: currentResult.assignments,
      });
      // Update local state in-memory to reflect new tableIds
      const byId = new Map(currentResult.assignments.map(a => [a.guestId, a.tableId]));
      window._allGuestsRef = window._allGuestsRef.map(g =>
        byId.has(g.id) ? { ...g, tableId: byId.get(g.id), tableName: byId.get(g.id) ? (window._allTablesRef.find(t => t.id === byId.get(g.id))?.name ?? null) : null } : g
      );
      window.allGuests = window._allGuestsRef;
      window.toast?.('Рассадка применена');
      closeReportSheet();
      window.syncAllCaches?.();
      // Re-render whichever tab is open
      if (window.renderTables) window.renderTables();
      if (window.renderList) window.renderList();
    } catch (err) {
      window.toast?.(err.message || 'Не удалось сохранить', false);
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  // ─── Regenerate ───────────────────────────────────────────────────────────
  function regenerate(hardReset) {
    closeReportSheet();
    openLaunchSheet();
    setTimeout(() => {
      setSeatMode(hardReset ? 'hard' : 'soft');
    }, 50);
  }

  // ─── Wiring ───────────────────────────────────────────────────────────────
  function wire() {
    document.getElementById('seat-launch-btn-close')?.addEventListener('click', closeLaunchSheet);
    document.getElementById('seat-run-btn')?.addEventListener('click', runSeating);
    document.getElementById('seat-mode-control')?.addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (btn) setSeatMode(btn.dataset.mode);
    });

    document.getElementById('seat-report-close')?.addEventListener('click', closeReportSheet);
    document.getElementById('seat-apply-btn')?.addEventListener('click', applyResult);
    document.getElementById('seat-regen-soft-btn')?.addEventListener('click', () => regenerate(false));
    document.getElementById('seat-regen-hard-btn')?.addEventListener('click', () => regenerate(true));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function pluralize(n, forms) {
    const m = Math.abs(n) % 100;
    const m1 = m % 10;
    if (m > 10 && m < 20) return forms[2];
    if (m1 > 1 && m1 < 5) return forms[1];
    if (m1 === 1) return forms[0];
    return forms[2];
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.SmartSeating = {
    openLaunch: openLaunchSheet,
    closeLaunch: closeLaunchSheet,
    closeReport: closeReportSheet,
    wire,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
