// Worker for smart seating — loads algorithm module via importScripts.
'use strict';
importScripts('seating-algorithm.js?v=2');

self.addEventListener('message', (ev) => {
  const { type, payload } = ev.data || {};
  if (type !== 'run') return;
  try {
    const { runSeating } = self.SeatingAlgo;
    const result = runSeating({
      ...payload,
      options: {
        ...(payload.options || {}),
        onProgress: (frac) => self.postMessage({ type: 'progress', frac }),
      },
    });
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
});
