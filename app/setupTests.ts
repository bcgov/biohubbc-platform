import '@testing-library/jest-dom/vitest';

// jsdom implements neither of these, and MapLibre calls createObjectURL at import time to set up its web worker.
// Provided globally so simply importing a map-rendering component does not fail a test that never renders a map.
if (typeof window !== 'undefined') {
  window.URL.createObjectURL ??= () => 'blob:mock';
  window.URL.revokeObjectURL ??= () => undefined;
}
