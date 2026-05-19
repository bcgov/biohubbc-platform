/**
 * Returns a normalized env value, or undefined when the value should be treated as missing.
 */
export const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return undefined;
  }

  return normalized;
};

/**
 * Returns the first finite numeric env value from the provided keys.
 *
 * Missing, empty, and non-numeric values are ignored.
 */
export const getOptionalNumberEnv = (keys: string | string[]): number | undefined => {
  const normalizedKeys = Array.isArray(keys) ? keys : [keys];

  for (const key of normalizedKeys) {
    const value = getOptionalEnv(key);
    if (value === undefined) {
      continue;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

/**
 * Returns the first finite numeric env value from the provided keys, or a default.
 */
export const getNumberEnv = (keys: string | string[], defaultValue: number): number => {
  return getOptionalNumberEnv(keys) ?? defaultValue;
};
