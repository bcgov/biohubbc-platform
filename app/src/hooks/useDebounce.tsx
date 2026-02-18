import debounce, { DebouncedFunc } from 'lodash-es/debounce';
import { useEffect, useMemo, useRef } from 'react';

/**
 * Hook to delay multiple repetitive executions of a callback.
 *
 * Uses a ref to always call the latest callback, so the debounced function
 * remains stable even when the callback captures changing state.
 *
 * @template T - The callback function type
 * @param callback - Function to debounce (can accept parameters)
 * @param msDelay - Milliseconds to delay callback execution (default: 500)
 * @returns Debounced callback with same signature as input
 *
 * @example
 * // No parameters
 * const debouncedSave = useDebounce(() => save(formData), 300);
 *
 * @example
 * // With parameters - callback always sees current state
 * const debouncedSearch = useDebounce((term: string) => {
 *   api.search(term, currentFilters); // currentFilters is always fresh
 * }, 300);
 * debouncedSearch('query');
 */
const useDebounce = <T extends (...args: any[]) => void>(callback: T, msDelay = 500): DebouncedFunc<T> => {
  const ref = useRef(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  const debouncedCallback = useMemo(() => {
    const func = (...args: Parameters<T>) => {
      ref.current?.(...args);
    };

    return debounce(func, msDelay) as DebouncedFunc<T>;
  }, [msDelay]);

  return debouncedCallback;
};

export default useDebounce;
