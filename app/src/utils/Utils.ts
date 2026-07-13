import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { DATE_FORMAT, TIME_FORMAT } from 'constants/dateTimeFormats';
import { Dayjs, default as dayjs } from 'dayjs';
import { getRelativeTimeLabel } from './date';

/**
 * Checks if a url string starts with an `http[s]://` protocol, and adds `https://` if it does not. If the url
 * begins with `localhost`, the `http` protocol is used.
 *
 * @param {string} url
 * @param {('http://' | 'https://')} [protocol='https://'] The protocol to add, if necessary. Defaults to `https://`.
 * @return {*}  {string} the url which is guaranteed to have an `http(s)://` protocol.
 */
export const ensureProtocol = (url: string, protocol: 'http://' | 'https://' = 'https://'): string => {
  if (url.startsWith('localhost')) {
    return `${'http://'}${url}`;
  }

  if (url.startsWith('https://') || url.startsWith('http://localhost')) {
    return url;
  }

  if (url.startsWith('http://')) {
    // If protocol is HTTPS, upgrade the URL
    if (protocol === 'https://') {
      return `${'https://'}${url.slice(7)}`;
    }
  }

  return `${protocol}${url}`;
};

/**
 * Returns a label specifying the number of days since Today.
 * Label will include 'Today', 'Yesterday' or a count of the days.
 *
 * @param {Dayjs} oldDate Older date to get difference from
 * @param {Dayjs} futureDate Future date to get difference from, defaulted to Today.
 * @returns {string} Label constructed with date difference.
 */
export const getDaysSinceDate = (oldDate: Dayjs, futureDate = dayjs()) => {
  const days = futureDate.diff(oldDate, 'days');
  if (days < 1) {
    // today
    return `Today (${oldDate.format(DATE_FORMAT.ShortDateFormat)})`;
  }

  if (days < 2) {
    return `Yesterday (${oldDate.format(DATE_FORMAT.ShortDateFormat)})`;
  }

  const relativeLabel = getRelativeTimeLabel(oldDate, { now: futureDate }) ?? `${days} days ago`;

  return `${relativeLabel} (${oldDate.format(DATE_FORMAT.ShortDateFormat)})`;
};

/**
 * Formats a date range into a formatted string.
 *
 * @param {DATE_FORMAT} dateFormat
 * @param {string} startDate ISO 8601 date string
 * @param {string} [endDate] ISO 8601 date string
 * @param {string} [dateSeparator='-'] specify date range separator
 * @return {string} formatted date string, or an empty string if unable to parse the startDate and/or endDate
 */
export const getFormattedDateRangeString = (
  dateFormat: DATE_FORMAT,
  startDate: string,
  endDate?: string,
  dateSeparator = '-'
): string => {
  const startDateFormatted = getFormattedDate(dateFormat, startDate);

  const endDateFormatted = getFormattedDate(dateFormat, endDate ?? '');

  if (!startDateFormatted || (endDate && !endDateFormatted)) {
    return '';
  }

  if (endDateFormatted) {
    return `${startDateFormatted} ${dateSeparator} ${endDateFormatted}`;
  }

  return startDateFormatted;
};

/**
 * Get a formatted date string.
 *
 * @param {DATE_FORMAT} dateFormat
 * @param {string} date ISO 8601 date string
 * @return {string} formatted date string, or an empty string if unable to parse the date
 */
export const getFormattedDate = (dateFormat: DATE_FORMAT, date: string): string => {
  const dateObject = dayjs(date);

  if (!dateObject.isValid()) {
    //date was invalid
    return '';
  }

  return dateObject.format(dateFormat);
};

/**
 * Get a formatted time string.
 *
 * @param {TIME_FORMAT} timeFormat
 * @param {string} date ISO 8601 date string
 * @return {string} formatted time string, or an empty string if unable to parse the date
 */
export const getFormattedTime = (timeFormat: TIME_FORMAT, date: string): string => {
  const dateObject = dayjs(date);

  if (!dateObject.isValid()) {
    //date was invalid
    return '';
  }

  return dateObject.format(timeFormat);
};

/**
 * Get a formatted amount string.
 *
 * @param {number} amount
 * @return {string} formatted amount string (rounded to the nearest integer), or an empty string if unable to parse the amount
 */
export const getFormattedAmount = (amount: number): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  if (!amount && amount !== 0) {
    //amount was invalid
    return '';
  }
  return formatter.format(amount);
};

export const getFormattedFileSize = (fileSize: number) => {
  if (!fileSize) {
    return '0 KB';
  }

  // kilobyte size
  if (fileSize < 1000000) {
    return `${(fileSize / 1000).toFixed(1)} KB`;
  }

  // megabyte size
  if (fileSize < 1000000000) {
    return `${(fileSize / 1000000).toFixed(1)} MB`;
  }

  // gigabyte size
  return `${(fileSize / 1000000000).toFixed(1)} GB`;
};

/**
 * Format a feature count for display (e.g. on a download tile).
 *
 * Compact forms are for readability of large numbers only: counts under 1000 render plain
 * (`412 features`, singular `1 feature`), while larger counts render with one decimal max and a
 * trailing `.0` stripped (`17.4k features`, `17k features`, `2.5M features`). Lowercase `k` is
 * deliberate — the desired display form is `17.4k`, whereas `Intl.NumberFormat` compact notation
 * emits an uppercase `17.4K`. The band is chosen on the rounded thousands value, so a count that
 * rounds up to 1000k promotes into the M band (999999 → `1M features`, never `1000k features`).
 *
 * A `null` count returns `null` so the caller hides the line entirely rather than rendering a
 * broken value (e.g. versions materialized before counting existed carry no count).
 *
 * @param {number | null} count
 * @return {*}  {(string | null)} formatted count string, or `null` when no count is stored
 */
export const formatFeatureCount = (count: number | null): string | null => {
  if (count === null) {
    return null;
  }

  if (count < 1000) {
    return `${count} ${pluralize(count, 'feature')}`;
  }

  const thousands = Number.parseFloat((count / 1000).toFixed(1));
  if (thousands < 1000) {
    return `${thousands}k features`;
  }

  return `${Number.parseFloat((count / 1000000).toFixed(1))}M features`;
};

/**
 * Check if an unknown value is an object.
 *
 * @param {unknown} obj
 * @return {*}  {boolean} `true` if `obj` is an object, `false` otherwise.
 */
export const isObject = (obj: unknown): obj is Record<string, unknown> => {
  return !!(obj && typeof obj === 'object');
};

/**
 * Safely JSON.parse and return the provided `str`.
 *
 * Why? If `str` is not a JSON.stringified value, JSON.parse will throw an exception, which will be caught, and the
 * original `str` will be returned instead.
 *
 * @param {string} str
 * @return {*}
 */
export const safeJSONParse = (str: string) => {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

/**
 * Safely JSON.stringify a value.
 *
 * Note: If `val` cannot be stringified, the original unaltered `val` will be returned.
 *
 * @param {string} str
 * @return {*}
 */
export const safeJSONStringify = (val: any) => {
  try {
    return JSON.stringify(val);
  } catch {
    return val;
  }
};

/**
 * Parses top level object properties if they are stringified values.
 *
 * @param {Record<string, any>} obj
 * @return {*}
 */
export const jsonParseObjectProperties = (obj: Record<string, any>) => {
  const newObj: Record<string, any> = {};

  Object.entries(obj).forEach(([key, value]) => {
    newObj[key] = safeJSONParse(value);
  });

  return newObj;
};

/**
 * Stringifies top level object properties if they are objects.
 *
 * @param {Record<string, any>} obj
 * @return {*}
 */
export const jsonStringifyObjectProperties = (obj: Record<string, any>) => {
  const newObj: Record<string, any> = {};

  Object.entries(obj).forEach(([key, value]) => {
    newObj[key] = (isObject(value) && safeJSONStringify(value)) || value;
  });

  return newObj;
};

/**
 * Takes an array of objects and produces an object URL pointing to a Blob which contains
 * the array. Supports large arrays thanks to use of Blob datatype.
 * @param entries Array containing objects
 * @returns A data URL, which downloads the given array as a CSV when clicked on in a browser.
 */
export const makeCsvObjectUrl = (entries: Array<Record<string, any>>) => {
  const keys = [...new Set(entries.reduce((acc: string[], entry) => acc.concat(Object.keys(entry)), []))];

  const rows = entries.map((entry: Record<string, any>) => {
    return keys.map((key) => String(entry[key]));
  });

  // Prepend the column names (object keys) to the CSV.
  rows.unshift(keys);

  const csvContent = rows.map((row) => row.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });

  return window.URL.createObjectURL(blob);
};

export const downloadFile = async (url: string): Promise<void> => {
  return new Promise((resolve) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.addEventListener('click', () => {
      anchor.remove();
      resolve();
    });

    anchor.click();
  });
};

/**
 * Builds a URL from multiple (possibly null or undefined) url parts, stripping any
 * double slashes from the resulting URL.
 *
 * @param {(string | undefined)[]} urlParts The parts of the URL
 * @returns The built URL
 */
export const buildUrl = (...urlParts: (string | undefined)[]): string => {
  return urlParts
    .filter((urlPart): urlPart is string => Boolean(urlPart))
    .map((urlPart) => String(urlPart).trim()) // Trim leading and trailing whitespace
    .filter(Boolean)
    .join('/')
    .replace(/([^:]\/)\/+/g, '$1'); // Trim double slashes
};

/** OIDC authorization-response query params appended by Keycloak to the return URL after login. */
const OIDC_RESPONSE_PARAMS = ['code', 'state', 'session_state', 'iss', 'error', 'error_description'];

/**
 * Strips the OIDC authorization-response params from a return URL while preserving any original
 * application query params (e.g. the encoded `expr` search expression). Used by the post-login
 * `onSigninCallback` so the user lands back on the same search results after authenticating.
 *
 * @param {string} href The full return URL (e.g. `window.location.href`).
 * @returns The path + remaining query string, with the OIDC response params removed.
 */
export const stripOidcParams = (href: string): string => {
  const url = new URL(href);
  OIDC_RESPONSE_PARAMS.forEach((param) => url.searchParams.delete(param));
  return `${url.pathname}${url.search}`;
};

/**
 * Reads the post-login return location carried through the OIDC `state` param (set by callers such as
 * the "Request Access" flow that redirect unauthenticated users to login). Used by `onSigninCallback` to
 * navigate back to the originating search after authenticating, since the registered `redirect_uri` is a
 * fixed origin and login otherwise lands on `/`.
 *
 * Only a safe same-origin relative path is returned (must start with a single `/`); anything else —
 * absent state, an absolute URL, or a protocol-relative `//host` — yields `undefined`, guarding against
 * open redirects.
 *
 * @param {unknown} user The OIDC user passed to `onSigninCallback` (its `state` holds the value set at signin).
 * @returns The relative return path, or `undefined` when none/unsafe.
 */
export const getPostLoginReturnTo = (user: unknown): string | undefined => {
  const returnTo = (user as { state?: { returnTo?: unknown } } | null | undefined)?.state?.returnTo;

  if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    return returnTo;
  }

  return undefined;
};

/**
 * Generates the <title> tag text for a React route
 * @param pageName The name of the page, e.g. 'Projects'
 * @returns The content to be rendered in the <title> tag
 */
export const getTitle = (pageName?: string) => {
  return pageName ? `BioHub - ${pageName}` : 'BioHub';
};

/**
 * Pluralizes a word.
 *
 * @example p(2, 'apple'); // => 'apples'
 * @example p(null, 'orange'); // => 'oranges'
 * @example p(1, 'banana'); // => 'banana'
 * @example p(10, 'berr', 'y', 'ies'); // => 'berries'
 *
 * @param quantity The quantity used to infer plural or singular
 * @param word The word to pluralize
 * @param {[string]} singularSuffix The suffix used for a singular item
 * @param {[string]} pluralSuffix The suffix used for plural items
 * @returns
 */
export const pluralize = (quantity: number, word: string, singularSuffix = '', pluralSuffix = 's') => {
  return `${word}${quantity === 1 ? singularSuffix : pluralSuffix}`;
};

/**
 * For a given property, alphabetize an array of objects
 *
 * @param {T[]} data an array of objects to be alphabetized
 * @param {string} property a key property to alphabetize the data array on
 * @returns {T[]} Returns an alphabetized array of objects
 */
export const alphabetizeObjects = <T extends { [key: string]: any }>(data: T[], property: string): T[] => {
  return data.sort((a, b) => {
    if (a[property] < b[property]) {
      return -1;
    }
    if (a[property] > b[property]) {
      return 1;
    }
    return 0;
  });
};

/**
 * Returns a human-readible identity source string.
 *
 * @example getFormattedIdentitySource("BCEIDBUSINESS"); // => "BCeID Business"
 *
 * @param {SYSTEM_IDENTITY_SOURCE} identitySource The identity source
 * @returns {*} {string} the string representing the identity source
 */
export const getFormattedIdentitySource = (identitySource: SYSTEM_IDENTITY_SOURCE): string | null => {
  switch (identitySource) {
    case SYSTEM_IDENTITY_SOURCE.BCEID_BASIC:
      return 'BCeID Basic';

    case SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS:
      return 'BCeID Business';

    case SYSTEM_IDENTITY_SOURCE.IDIR:
      return 'IDIR';

    case SYSTEM_IDENTITY_SOURCE.DATABASE:
      return 'System';

    default:
      return null;
  }
};

/**
 * Get the human-readable label for a user: the Keycloak display name (ex: `Bryan, Luke WLRS:EX`) when
 * available, otherwise the raw user identifier (ex: IDIR username).
 *
 * @param {{ display_name?: string | null; user_identifier: string }} user The user to label
 * @returns {*} {string} the display label for the user
 */
export const getUserLabel = (user: { display_name?: string | null; user_identifier: string }): string => {
  return user.display_name?.trim() || user.user_identifier;
};

/**
 * same implementation as Object.keys but with correct typings for interable
 *
 * @template Obj
 * @param {Obj} obj - object to iterate through
 * @returns {(keyof Obj)[]} array of object keys with correct typings ie: not string[]
 */
export const objectKeys = <Obj extends Record<any, any>>(obj: Obj): (keyof Obj)[] => {
  return Object.keys(obj) as (keyof Obj)[];
};

/**
 * This will grab the first element from an array or return null if nothing is found
 *
 * @param arr array to check
 * @returns T
 */
export const firstOrNull = <T>(arr: readonly T[]): T | null => (arr.length ? arr[0] : null);
