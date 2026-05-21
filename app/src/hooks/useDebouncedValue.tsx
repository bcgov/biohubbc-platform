import { useEffect, useState } from 'react';

/**
 * Returns a delayed copy of a changing value.
 *
 * Use this when render state should update immediately, but downstream effects
 * or child components should receive the value only after it has stopped
 * changing for the configured delay. Each input change cancels the previous
 * timer, so only the latest value is emitted after the debounce window.
 *
 * This hook debounces values rather than callbacks. That keeps consumers simple
 * when the debounced value is passed through props, used as a dependency, or
 * read during render. Timer APIs are read from `globalThis` so the hook works in
 * browser-like test environments without depending directly on `window`.
 *
 * @template T Type of the value being debounced.
 * @param {T} value - Current source value.
 * @param {number} [msDelay=300] - Debounce delay in milliseconds.
 * @param {T} [initialDebouncedValue=value] - Initial emitted value before the first debounce window completes.
 * @returns {T} Most recent value that survived the full debounce delay.
 */
const useDebouncedValue = <T,>(value: T, msDelay = 300, initialDebouncedValue = value): T => {
  const [debouncedValue, setDebouncedValue] = useState(initialDebouncedValue);

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => setDebouncedValue(value), msDelay);

    return () => globalThis.clearTimeout(timeoutId);
  }, [msDelay, value]);

  return debouncedValue;
};

export default useDebouncedValue;
