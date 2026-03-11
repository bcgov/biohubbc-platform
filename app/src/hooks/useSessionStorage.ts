import { useCallback, useState } from 'react';

/**
 * Save state between page navigations within the same session.
 *
 * NOTE: This hook will attempt to grab from session storage BEFORE defaulting to initial value.
 * If this hook is being rendered multiple times in children components, a unique key per child
 * must be provided.
 *
 * @template T - Generic.
 * @param {string} sessionStorageId - Session storage identifier.
 * @param {T} initialValue - Initial value for sessionStorage.
 * @returns {[T, (newValue: T) => void]} State and SetState handler.
 */
export const useSessionStorage = <T>(sessionStorageId: string, initialValue: T): [T, (newValue: T) => void] => {
  // session storage key - used to access the stored value
  const prefixedKey = `USE_SESSION_STORAGE_${sessionStorageId}`;

  const [value, setValue] = useState<T>(() => {
    // attempt to retrieve value from session storage
    const storageValue = sessionStorage.getItem(prefixedKey);

    // if session storage is null, default to initialValue
    if (storageValue === null) {
      return initialValue;
    }

    try {
      // attempt to parse storage value
      return JSON.parse(storageValue);
    } catch (error) {
      console.error(`Failed to parse session storage value for key: ${prefixedKey}`, error);
      // unable to parse, return the raw stored value
      return storageValue;
    }
  });

  /**
   * Set the value in session storage and state.
   *
   * @param {T} newValue - Updated value.
   */
  // Keep setter identity stable across renders so consumers can safely use it
  // in dependency arrays (for example cart lifecycle callbacks/effects).
  const setSessionStorageValue = useCallback(
    (newValue: T) => {
      const parsedValue = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      // set session storage value
      sessionStorage.setItem(prefixedKey, parsedValue);
      // set state value
      setValue(newValue);
    },
    [prefixedKey]
  );

  return [value, setSessionStorageValue];
};
