import debounce from 'lodash-es/debounce';
import { useEffect, useMemo, useRef } from 'react';

/**
 * hook to delay multiple repeditive executions of callback
 *
 * @param {() => void} callback - function to fire
 * @param {number} [msDelay] - milliseconds to delay callback fire
 * @returns {DebouncedFunc<() => void>} - debounced callback
 */
const useDebounce = (callback: () => void, msDelay = 500) => {
  const ref = useRef(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  const debouncedCallback = useMemo(() => {
    const func = () => {
      ref.current?.();
    };

    return debounce(func, msDelay);
  }, [msDelay]);

  return debouncedCallback;
};

export default useDebounce;
