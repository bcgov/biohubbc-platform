import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { DATE_FORMAT, TIME_FORMAT } from 'constants/dateTimeFormats';
import { Feature, Polygon } from 'geojson';
import { LatLngBounds } from 'leaflet';
import _ from 'lodash';
import moment from 'moment';

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
  const dateMoment = moment(date);

  if (!dateMoment.isValid()) {
    //date was invalid
    return '';
  }

  return dateMoment.format(dateFormat);
};

/**
 * Get a formatted time string.
 *
 * @param {TIME_FORMAT} timeFormat
 * @param {string} date ISO 8601 date string
 * @return {string} formatted time string, or an empty string if unable to parse the date
 */
export const getFormattedTime = (timeFormat: TIME_FORMAT, date: string): string => {
  const dateMoment = moment(date);

  if (!dateMoment.isValid()) {
    //date was invalid
    return '';
  }

  return dateMoment.format(timeFormat);
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
 * Converts a `LatLngBounds` object into a GeoJSON Feature object.
 *
 * @export
 * @param {LatLngBounds} bounds
 * @return {*}  {Feature<Polygon>}
 */
export function getFeatureObjectFromLatLngBounds(bounds: LatLngBounds): Feature<Polygon> {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [southWest.lng, southWest.lat],
          [southWest.lng, northEast.lat],
          [northEast.lng, northEast.lat],
          [northEast.lng, southWest.lat],
          [southWest.lng, southWest.lat]
        ]
      ]
    }
  };
}

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
  const newObj = {};

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
  const newObj = {};

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
 * @param {T[]} data an array of objects to be alphabetize
 * @param {string} property a key property to alphabetize the data array on
 * @returns {any[]} Returns an alphabetized array of objects
 */
export const alphabetizeObjects = <T extends { [key: string]: any }>(data: T[], property: string) => {
  return _.sortBy(data, property);
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
