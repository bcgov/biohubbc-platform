import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { IConfig } from 'contexts/configContext';
import { LatLngBounds, LatLngLiteral } from 'leaflet';
import {
  ensureProtocol,
  getFeatureObjectFromLatLngBounds,
  getFormattedAmount,
  getFormattedDate,
  getFormattedDateRangeString,
  getFormattedFileSize,
  getLogOutUrl,
  isObject,
  jsonParseObjectProperties,
  jsonStringifyObjectProperties,
  safeJSONParse,
  safeJSONStringify
} from './Utils';

describe('ensureProtocol', () => {
  it('does nothing if string already has `http://`', async () => {
    const url = 'http://someurl.com';
    const urlWithProtocol = ensureProtocol(url);
    expect(urlWithProtocol).toEqual(url);
  });

  it('does nothing if string already has `https://`', async () => {
    const url = 'https://someurl.com';
    const urlWithProtocol = ensureProtocol(url);
    expect(urlWithProtocol).toEqual(url);
  });

  it('adds `https://` when no protocol param is provided', async () => {
    const url = 'someurl.com';
    const urlWithProtocol = ensureProtocol(url);
    expect(urlWithProtocol).toEqual(`https://${url}`);
  });

  it('adds `https://` when provided', async () => {
    const url = 'someurl.com';
    const urlWithProtocol = ensureProtocol(url, 'https://');
    expect(urlWithProtocol).toEqual(`https://${url}`);
  });

  it('adds `http://` when provided', async () => {
    const url = 'someurl.com';
    const urlWithProtocol = ensureProtocol(url, 'http://');
    expect(urlWithProtocol).toEqual(`http://${url}`);
  });
});

describe('getFormattedAmount', () => {
  it('returns a valid amount string when amount is valid', () => {
    const amount = 10000000;
    expect(getFormattedAmount(amount)).toEqual('$10,000,000');
  });

  it('returns empty string when amount is invalid', () => {
    expect(getFormattedAmount(null as unknown as number)).toEqual('');
  });
});

describe('getFormattedDate', () => {
  beforeAll(() => {
    // ignore warning about invalid date string being passed to moment
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns empty string if invalid date is provided', async () => {
    const date = '12312312312312312';
    const formattedDateString = getFormattedDate(DATE_FORMAT.MediumDateFormat, date);
    expect(formattedDateString).toEqual('');
  });

  it('returns formatted date string if valid date is provided', async () => {
    const date = '2021-03-04T22:44:55.478682';
    const formattedDateString = getFormattedDate(DATE_FORMAT.MediumDateFormat, date);
    expect(formattedDateString).toEqual('March 4, 2021');
  });
});

describe('getFormattedDateRangeString', () => {
  beforeAll(() => {
    // ignore warning about invalid date string being passed to moment
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns empty string if invalid startDate is provided', async () => {
    const startDate = '12312312312312312';
    const formattedDateString = getFormattedDateRangeString(DATE_FORMAT.MediumDateFormat, startDate);
    expect(formattedDateString).toEqual('');
  });

  it('returns empty string if invalid endDate is provided', async () => {
    const startDate = '2021-03-04T22:44:55.478682';
    const endDate = '12312312312312312';
    const formattedDateString = getFormattedDateRangeString(DATE_FORMAT.MediumDateFormat, startDate, endDate);
    expect(formattedDateString).toEqual('');
  });

  it('returns formatted string if valid startDate is provided', async () => {
    const startDate = '2021-03-04T22:44:55.478682';
    const formattedDateString = getFormattedDateRangeString(DATE_FORMAT.MediumDateFormat, startDate);
    expect(formattedDateString).toEqual('March 4, 2021');
  });

  it('returns formatted string if valid startDate is provided', async () => {
    const startDate = '2021-03-04T22:44:55.478682';
    const endDate = '2021-05-25T22:44:55.478682';
    const formattedDateString = getFormattedDateRangeString(DATE_FORMAT.MediumDateFormat, startDate, endDate);
    expect(formattedDateString).toEqual('March 4, 2021 - May 25, 2021');
  });

  it('returns formatted string with custom dateSeparator', async () => {
    const startDate = '2021-03-04T22:44:55.478682';
    const endDate = '2021-05-25T22:44:55.478682';
    const formattedDateString = getFormattedDateRangeString(DATE_FORMAT.MediumDateFormat, startDate, endDate, '//');
    expect(formattedDateString).toEqual('March 4, 2021 // May 25, 2021');
  });
});

describe('getLogOutUrl', () => {
  it('returns null when config is null', () => {
    expect(getLogOutUrl(null as unknown as IConfig)).toBeUndefined();
  });

  it('returns null when config is missing `KEYCLOAK_CONFIG.url`', () => {
    const config = {
      API_HOST: '',
      CHANGE_VERSION: '',
      NODE_ENV: '',
      VERSION: '',
      KEYCLOAK_CONFIG: {
        url: '',
        realm: 'myrealm',
        clientId: ''
      },
      SITEMINDER_LOGOUT_URL: 'https://www.siteminderlogout.com',
      N8N_HOST: '',
      REACT_APP_NODE_ENV: 'local',
      MAX_UPLOAD_NUM_FILES: 10,
      MAX_UPLOAD_FILE_SIZE: 52428800
    };

    expect(getLogOutUrl(config)).toBeUndefined();
  });

  it('returns null when config is missing `KEYCLOAK_CONFIG.realm`', () => {
    const config = {
      API_HOST: '',
      CHANGE_VERSION: '',
      NODE_ENV: '',
      VERSION: '',
      KEYCLOAK_CONFIG: {
        url: 'https://www.keycloaklogout.com/auth',
        realm: '',
        clientId: ''
      },
      SITEMINDER_LOGOUT_URL: 'https://www.siteminderlogout.com',
      N8N_HOST: '',
      REACT_APP_NODE_ENV: 'local',
      MAX_UPLOAD_NUM_FILES: 10,
      MAX_UPLOAD_FILE_SIZE: 52428800
    };

    expect(getLogOutUrl(config)).toBeUndefined();
  });

  it('returns null when config is missing `SITEMINDER_LOGOUT_URL`', () => {
    const config = {
      API_HOST: '',
      CHANGE_VERSION: '',
      NODE_ENV: '',
      VERSION: '',
      KEYCLOAK_CONFIG: {
        url: 'https://www.keycloaklogout.com/auth',
        realm: 'myrealm',
        clientId: ''
      },
      SITEMINDER_LOGOUT_URL: '',
      N8N_HOST: '',
      REACT_APP_NODE_ENV: 'local',
      MAX_UPLOAD_NUM_FILES: 10,
      MAX_UPLOAD_FILE_SIZE: 52428800
    };

    expect(getLogOutUrl(config)).toBeUndefined();
  });

  it('returns a log out url', () => {
    // @ts-ignore
    delete window.location;

    // @ts-ignore
    window.location = {
      origin: 'https://biohub.com'
    };

    const config = {
      API_HOST: '',
      CHANGE_VERSION: '',
      NODE_ENV: '',
      VERSION: '',
      KEYCLOAK_CONFIG: {
        url: 'https://www.keycloaklogout.com/auth',
        realm: 'myrealm',
        clientId: ''
      },
      SITEMINDER_LOGOUT_URL: 'https://www.siteminderlogout.com',
      N8N_HOST: '',
      REACT_APP_NODE_ENV: 'local',
      MAX_UPLOAD_NUM_FILES: 10,
      MAX_UPLOAD_FILE_SIZE: 52428800
    };

    expect(getLogOutUrl(config)).toEqual(
      'https://www.siteminderlogout.com?returl=https://www.keycloaklogout.com/auth/realms/myrealm/protocol/openid-connect/logout?redirect_uri=https://biohub.com/&retnow=1'
    );
  });
});

describe('getFormattedFileSize', () => {
  it('returns `0 KB` if no file size exists', async () => {
    const formattedFileSize = getFormattedFileSize(null as unknown as number);
    expect(formattedFileSize).toEqual('0 KB');
  });

  it('returns answer in KB if fileSize < 1000000', async () => {
    const formattedFileSize = getFormattedFileSize(20000);
    expect(formattedFileSize).toEqual('20.0 KB');
  });

  it('returns answer in MB if fileSize < 1000000000', async () => {
    const formattedFileSize = getFormattedFileSize(200000000);
    expect(formattedFileSize).toEqual('200.0 MB');
  });

  it('returns answer in GB if fileSize >= 1000000000', async () => {
    const formattedFileSize = getFormattedFileSize(1000000000);
    expect(formattedFileSize).toEqual('1.0 GB');
  });
});

describe('getFeatureObjectFromLatLngBounds', () => {
  it('returns a feature object', () => {
    const southWest: LatLngLiteral = { lat: 111, lng: 222 };
    const northEast: LatLngLiteral = { lat: 333, lng: 444 };

    const bounds = new LatLngBounds(southWest, northEast);

    const feature = getFeatureObjectFromLatLngBounds(bounds);

    expect(feature).toEqual({
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
    });
  });
});

describe('isObject', () => {
  describe('returns false', () => {
    it('when undefined', () => {
      expect(isObject(undefined)).toEqual(false);
    });

    it('when null', () => {
      expect(isObject(null)).toEqual(false);
    });

    it('when an empty string', () => {
      expect(isObject('')).toEqual(false);
    });

    it('when a string', () => {
      expect(isObject('hello')).toEqual(false);
    });

    it('when a negative number', () => {
      expect(isObject(-1)).toEqual(false);
    });

    it('when 0', () => {
      expect(isObject(0)).toEqual(false);
    });

    it('when a positive number', () => {
      expect(isObject(1)).toEqual(false);
    });

    it('when true', () => {
      expect(isObject(true)).toEqual(false);
    });

    it('when false', () => {
      expect(isObject(false)).toEqual(false);
    });
  });

  describe('returns true', () => {
    it('when an array', () => {
      expect(isObject([])).toEqual(true);
    });

    it('when a curly bracket object', () => {
      expect(isObject({})).toEqual(true);
    });

    it('when a new Object', () => {
      // eslint-disable-next-line no-new-object
      expect(isObject(new Object())).toEqual(true);
    });
  });
});

describe('safeJSONParse', () => {
  it('returns original value when not a stringified string', () => {
    expect(safeJSONParse('not stringified')).toEqual('not stringified');
  });

  it('returns parsed value when a stringified string', () => {
    expect(safeJSONParse(JSON.stringify('stringified'))).toEqual('stringified');
  });

  it('returns parsed value when a stringified object', () => {
    expect(safeJSONParse(JSON.stringify({ val: ['a', 'b'] }))).toEqual({ val: ['a', 'b'] });
  });
});

describe('safeJSONStringify', () => {
  it('returns stringified object value', () => {
    expect(safeJSONStringify({ val: ['a', 'b'] })).toEqual('{"val":["a","b"]}');
  });

  it('returns stringified array value', () => {
    expect(safeJSONStringify(['a', 'b'])).toEqual('["a","b"]');
  });

  it('returns original value if the value cannot be stringified', () => {
    const circle = {};
    circle['circle'] = circle;

    expect(safeJSONStringify(circle)).toEqual(circle);
  });
});

describe('jsonParseObjectProperties', () => {
  it('returns parsed object', () => {
    // Prevent prettier removing escaped quotes, which are necessary to represent stringified values
    // prettier-ignore
    // eslint-disable-next-line no-useless-escape
    const input = { array: '[\"a\",\"b\"]', obj: '{\"val\":[\"a\",\"b\"]}', str: 'a', num: 1, bool: true };

    expect(jsonParseObjectProperties(input)).toEqual({
      array: ['a', 'b'],
      obj: { val: ['a', 'b'] },
      str: 'a',
      num: 1,
      bool: true
    });
  });
});

describe('jsonStringifyObjectProperties', () => {
  it('returns stringified object', () => {
    // Prevent prettier removing escaped quotes, which are necessary to represent stringified values
    // prettier-ignore
    // eslint-disable-next-line
    const output = { array: '[\"a\",\"b\"]', obj: '{\"val\":[\"a\",\"b\"]}', str: 'a', num: 1, bool: true };

    expect(
      jsonStringifyObjectProperties({
        array: ['a', 'b'],
        obj: { val: ['a', 'b'] },
        str: 'a',
        num: 1,
        bool: true
      })
    ).toEqual(output);
  });
});
