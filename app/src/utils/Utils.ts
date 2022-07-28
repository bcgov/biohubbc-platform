import { DATE_FORMAT, TIME_FORMAT } from 'constants/dateTimeFormats';
import { IConfig } from 'contexts/configContext';
import { Feature, Polygon } from 'geojson';
import { LatLngBounds } from 'leaflet';
import moment from 'moment';

/**
 * Checks if a url string starts with an `http(s)://` protocol, and adds `https://` if it does not.
 *
 * @param {string} url
 * @param {('http://' | 'https://')} [protocol='https://'] The protocol to add, if necessary. Defaults to `https://`.
 * @return {*}  {string} the url which is guaranteed to have an `http(s)://` protocol.
 */
export const ensureProtocol = (url: string, protocol: 'http://' | 'https://' = 'https://'): string => {
  return ((url.startsWith('http://') || url.startsWith('https://')) && url) || `${protocol}${url}`;
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

  const endDateFormatted = getFormattedDate(dateFormat, endDate || '');

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

/**
 * Returns a url that when navigated to, will log the user out, redirecting them to the login page.
 *
 * @param {IConfig} config
 * @return {*}  {(string | undefined)}
 */
export const getLogOutUrl = (config: IConfig): string | undefined => {
  if (!config || !config.KEYCLOAK_CONFIG?.url || !config.KEYCLOAK_CONFIG?.realm || !config.SITEMINDER_LOGOUT_URL) {
    return;
  }

  const localRedirectURL = `${window.location.origin}/`;

  const keycloakLogoutRedirectURL = `${config.KEYCLOAK_CONFIG.url}/realms/${config.KEYCLOAK_CONFIG.realm}/protocol/openid-connect/logout?redirect_uri=${localRedirectURL}`;

  return `${config.SITEMINDER_LOGOUT_URL}?returl=${keycloakLogoutRedirectURL}&retnow=1`;
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
export const isObject = (obj: unknown): boolean => {
  return typeof obj === 'object' && obj !== null;
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
