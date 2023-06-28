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
  if (redirectTo) {
    return `${host}/login?redirect=${encodeURIComponent(redirectTo)}`;
  }

  return `${host}/login`;
};

/**
 * Pretty-prints a phone number.
 *
 * @example formatPhoneNumber(12505551234); // => "+1 (250) 555-1234"
 * @param {string} phoneNumber The phone number to format
 * @returns {string} The formatted phonenumber
 */
export const formatPhoneNumber = (phoneNumber: string) => {
  const fullNumeric = phoneNumber.replace(/\D/g, '');

  if (fullNumeric.length <= 1 || fullNumeric.replace(/^1/, '').length > 10) {
    return fullNumeric;
  }

  let countryCode = '';
  let areaCode = '';
  let exchangeCode = '';
  let subscriberCode = '';

  if (fullNumeric.startsWith('1')) {
    countryCode = '+1';
    areaCode = fullNumeric.slice(1, 4);
    exchangeCode = fullNumeric.slice(4, 7);
    subscriberCode = fullNumeric.slice(7);
  } else {
    areaCode = fullNumeric.slice(0, 3);
    exchangeCode = fullNumeric.slice(3, 6);
    subscriberCode = fullNumeric.slice(6);
  }

  return `${countryCode} (${areaCode}) ${[exchangeCode, subscriberCode].filter(Boolean).join('-')}`.trim();
};
