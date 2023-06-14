import { isString } from 'lodash';

/**
 * Safely apply `.toLowerCase()` to a value of unknown type.
 *
 * If the value is not a string, then the original unaltered value will be returned.
 *
 * @export
 * @template T
 * @param {T} value
 * @return {*}  {T}
 */
export function safeToLowerCase<T>(value: T): T {
  if (isString(value)) {
    return value.toLowerCase() as unknown as T;
  }

  return value;
}

/**
 * Safely apply `.trim()` to a value of unknown type.
 *
 * If the value is not a string, then the original unaltered value will be returned.
 *
 * @export
 * @template T
 * @param {T} value
 * @return {*}  {T}
 */
export function safeTrim<T>(value: T): T {
  if (isString(value)) {
    return value.trim() as unknown as T;
  }

  return value;
}

/**
 * Generates a login URL the includes an optional redirect URL.
 * 
 * @param {string} host The host of the application
 * @param {[string]} redirectTo The URL that the user will be redirected to upon logging in
 * @returns The login URL
 */
export const makeLoginUrl = (host: string, redirectTo?: string) => {
  return `${host}/login${redirectTo && `?redirect=${encodeURIComponent(redirectTo)}`}`;
}
