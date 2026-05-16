/**
 * Bottom Sheet drag-to-dismiss behavior.
 * Enhances any .sheet element that has a .sheet-handle.
 * Auto-initializes via MutationObserver.
 */
(function () {
  'use strict';

  const THRESHOLD = 0.3;  // fraction of sheet height to trigger dismiss
  const VELOCITY_THRESHOLD = 0.5; // px/ms

  let activeSheet = null;
  let startY = 0;
  let startTranslate = 0;
  let sheetHeight = 0;
  let dragging = false;
  let lastY = 0;
  let lastTime = 0;

  function getSheetHeight(el) {
    return el.getBoundingClientRect().height;
  }

  function onTouchStart(e) {
    const touch = e.touches[0];
    startY = touch.clientY;
    lastY = startY;
    lastTime = Date.now();
    dragging = true;

    const sheet = e.target.closest('.sheet');
    if (!sheet) return;
    activeSheet = sheet;
    sheetHeight = getSheetHeight(sheet);

    // Read current transform
    const style = getComputedStyle(sheet);
    const matrix = new DOMMatrixReadOnly(style.transform);
    startTranslate = matrix.m42; // translateY

    sheet.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (!dragging || !activeSheet) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startY;
    lastY = touch.clientY;
    lastTime = Date.now();

    // Only allow dragging down (positive delta)
    const newTranslate = Math.max(0, startTranslate + deltaY);
    activeSheet.style.transform = 'translateY(' + newTranslate + 'px)';
  }

  function onTouchEnd() {
    if (!dragging || !activeSheet) return;
    dragging = false;

    const style = getComputedStyle(activeSheet);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const currentTranslate = matrix.m42;

    const dt = Date.now() - lastTime;
    const velocity = dt > 0 ? (lastY - startY) / dt : 0;

    const dismissThreshold = sheetHeight * THRESHOLD;
    const shouldDismiss = currentTranslate > dismissThreshold || velocity > VELOCITY_THRESHOLD;

    activeSheet.style.transition = '';

    if (shouldDismiss) {
      // Close: slide down
      activeSheet.style.transform = 'translateY(105%)';
      activeSheet.style.transition = 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)';

      const backdrop = document.querySelector('.sheet-backdrop.visible');
      if (backdrop) {
        backdrop.classList.remove('visible');
      }

      activeSheet.addEventListener('transitionend', function handler() {
        activeSheet.removeEventListener('transitionend', handler);
        activeSheet.classList.remove('visible');
        activeSheet.style.transform = 'translateY(100%)';
      });
    } else {
      // Spring back with native-like feel
      activeSheet.style.transform = 'translateY(0)';
      activeSheet.style.transition = 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)';

      activeSheet.addEventListener('transitionend', function handler() {
        activeSheet.removeEventListener('transitionend', handler);
        activeSheet.style.transition = '';
      });
    }

    activeSheet = null;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);

  // Prevent default scroll on sheet handle to avoid page scroll during drag
  document.addEventListener('touchstart', function (e) {
    if (e.target.closest('.sheet-handle')) {
      e.preventDefault();
    }
  }, { passive: false });
})();
