import { notifyManager } from '@tanstack/react-query';
import { configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom implements neither of these, and MapLibre calls createObjectURL at import time to set up its web worker.
// Provided globally so simply importing a map-rendering component does not fail a test that never renders a map.
if (typeof window !== 'undefined') {
  window.URL.createObjectURL ??= () => 'blob:mock';
  window.URL.revokeObjectURL ??= () => undefined;
}

// Page-level tests assert on content that appears only after an API call resolves and a data grid
// renders, which routinely takes most of Testing Library's 1s default while the full suite runs.
// Vitest still caps each test at its own 5s timeout, so this stays below that: a genuinely missing
// element fails with Testing Library's DOM dump rather than a bare test timeout.
configure({ asyncUtilTimeout: 4000 });

// The query client delivers updates to components on a zero-delay timer. Tests deliver them on a microtask instead:
// a test flushing promises then sees a settled query without advancing (possibly fake) timers, and a `waitFor` whose
// callback mutates the DOM, and so re-runs on every mutation, cannot starve the timer the update is waiting on.
notifyManager.setScheduler(queueMicrotask);

