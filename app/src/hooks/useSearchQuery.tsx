import qs from 'qs';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

type NumericOperator = '>' | '>=' | '<' | '<=' | '=';

/**
 * A hook for typed URL search params that supports arrays, objects, and numeric operators.
 * All keys are normalized to lowercase for case-insensitive handling.
 */
export function useSearchQueryParams<ParamType extends Record<string, string> = Record<string, string>>() {
  const navigate = useNavigate();
  const location = useLocation();
  // Memoize so searchParams reference stays stable unless location.search changes
  const searchParams = useMemo(() => new TypedURLSearchParams<ParamType>(location.search), [location.search]);
  const setSearchParams = (newParams: TypedURLSearchParams<ParamType>) => {
    navigate(
      {
        pathname: location.pathname,
        search: newParams.toString()
      },
      { replace: true }
    );
  };
  return { searchParams, setSearchParams };
}

/**
 * Typed URLSearchParams supporting arrays, objects, and numeric operators.
 * All keys are normalized to lowercase for case-insensitive handling.
 */
export class TypedURLSearchParams<
  ParamType extends Record<string, string> = Record<string, string>
> extends URLSearchParams {
  /**
   * Normalize key to lowercase for case-insensitive handling
   */
  private normalizeKey(key: string | number | symbol): string {
    return String(key).toLowerCase();
  }

  /**
   * Sets a key-value pair safely (case-insensitive)
   */
  set<K extends keyof ParamType & string>(key: K, value: ParamType[K]) {
    super.set(this.normalizeKey(key), value);
    return this;
  }

  /**
   * Sets or deletes a key depending on value.
   * Supports:
   * - string, number
   * - numeric operators as string (">50", "<=100")
   * - arrays (qs encoded)
   * - objects (qs encoded)
   */
  setOrDelete<K extends keyof ParamType & string>(key: K, value?: unknown) {
    const normalizedKey = this.normalizeKey(key);

    if (value === null || value === undefined) {
      super.delete(normalizedKey);
      return this;
    }
    if (typeof value === 'string') {
      if (value.length === 0) {
        super.delete(normalizedKey);
      } else {
        super.set(normalizedKey, value);
      }
      return this;
    }
    if (typeof value === 'number') {
      super.set(normalizedKey, String(value));
      return this;
    }
    if (Array.isArray(value)) {
      super.set(normalizedKey, qs.stringify(value, { arrayFormat: 'repeat', encode: false }));
      return this;
    }
    if (typeof value === 'object') {
      super.set(normalizedKey, qs.stringify(value, { encode: false }));
      return this;
    }
    // fallback: delete unknown keys
    super.delete(normalizedKey);
    return this;
  }

  /**
   * Allows setting numeric operator strings safely, e.g. ">50", "<=100"
   */
  setNumericOperator<K extends keyof ParamType & string>(key: K, operator: NumericOperator, value: number | string) {
    super.set(this.normalizeKey(key), `${operator}${value}`);
    return this;
  }

  /**
   * Get value by key (case-insensitive), value is normalized to lowercase
   */
  get<K extends keyof ParamType & string>(key: K) {
    const value = super.get(this.normalizeKey(key));
    return value ? this.normalizeKey(value) : null;
  }

  /**
   * Get array of values (case-insensitive), all values normalized to lowercase
   */
  getArray<K extends keyof ParamType & string>(key: K): string[] {
    const value = super.get(this.normalizeKey(key));
    if (!value) {
      return [];
    }
    const parsed = qs.parse(value, { parseArrays: true, strictNullHandling: true }) as Record<string, string>;
    return Object.values(parsed).map((v) => this.normalizeKey(v));
  }

  /**
   * Delete param by key (case-insensitive)
   */
  delete<K extends keyof ParamType & string>(key: K) {
    super.delete(this.normalizeKey(key));
    return this;
  }

  /**
   * Append value to key (case-insensitive)
   */
  append<K extends keyof ParamType & string>(key: K, value: ParamType[K]) {
    super.append(this.normalizeKey(key), value);
    return this;
  }

  entries<K extends keyof ParamType & string>() {
    return super.entries() as URLSearchParamsIterator<[string, ParamType[K]]>;
  }

  forEach<K extends keyof ParamType & string>(
    callback: (value: ParamType[K], key: K, searchParams: URLSearchParams) => void
  ) {
    super.forEach(callback as (value: string, key: string, searchParams: URLSearchParams) => void);
    return this;
  }

  /**
   * Get all values for a key (handles multi-value params like ?q=12&q=35, case-insensitive)
   * Values are normalized to lowercase
   */
  getAll<K extends keyof ParamType & string>(key: K) {
    return super.getAll(this.normalizeKey(key)).map((v) => this.normalizeKey(v)) as K[];
  }

  /**
   * Check if a param exists, optionally with a specific value (case-insensitive).
   * Supports multi-value params (e.g. ?q=12&q=35)
   *
   * Examples:
   * - has('Q') - checks if 'q' param exists (case-insensitive)
   * - has('Q', '12') - checks if 'q' param has the value '12' (case-insensitive key)
   * - has('q', 12) - checks if 'q' param has the value '12' (auto-converts)
   */
  has<K extends keyof ParamType = string>(key: K, value?: string | number | null): boolean {
    const normalizedKey = this.normalizeKey(key);

    if (value === null || value === undefined) {
      // No value provided: just check if key exists
      return super.has(normalizedKey);
    }

    // Value provided: check if it's in the multi-value array
    const stringValue = String(value);
    const allValues = this.getAll(String(normalizedKey) as any);
    return allValues.includes(stringValue);
  }

  /**
   * Get all keys (normalized to lowercase)
   */
  keys<K extends keyof ParamType & string>() {
    return super.keys() as URLSearchParamsIterator<K>;
  }

  sort() {
    super.sort();
    return this;
  }

  /**
   * Get all values (normalized to lowercase)
   */
  values<K extends keyof ParamType & string>(): URLSearchParamsIterator<ParamType[K]> {
    const iterator = super.values();
    return {
      [Symbol.iterator]: () => {
        const innerIterator = iterator[Symbol.iterator]();
        return {
          next: () => {
            const result = innerIterator.next();
            if (result.done) {
              return result;
            }
            return {
              done: false,
              value: this.normalizeKey(result.value) as ParamType[K]
            };
          }
        };
      }
    } as URLSearchParamsIterator<ParamType[K]>;
  }
}
