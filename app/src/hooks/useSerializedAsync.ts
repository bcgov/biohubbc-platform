import { useCallback, useRef } from 'react';

/**
 * Serializes async operations for a single hook instance.
 *
 * Behavior:
 * - First call executes immediately.
 * - Any overlapping call returns `undefined` and does not execute.
 *
 * Use this for write paths that must not overlap (for example, cart mutations).
 */
export const useSerializedAsync = () => {
  const inProgressRef = useRef(false);

  /**
   * Executes one async operation at a time for this hook instance.
   *
   * @param operation Async operation to run under single-flight lock.
   * @returns Operation result, or `undefined` if another operation is already running.
   */
  const runSerialized = useCallback(
    async <TResult>(operation: () => Promise<TResult>): Promise<TResult | undefined> => {
      if (inProgressRef.current) {
        return undefined;
      }

      inProgressRef.current = true;

      try {
        return await operation();
      } finally {
        inProgressRef.current = false;
      }
    },
    []
  );

  return { runSerialized };
};
