import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { expect } from 'vitest';
import {
  downloadFile,
  ensureProtocol,
  firstOrNull,
  getFormattedAmount,
  getFormattedDate,
  getFormattedDateRangeString,
  getFormattedFileSize,
  getFormattedIdentitySource,
  isObject,
  jsonParseObjectProperties,
  jsonStringifyObjectProperties,
  pluralize,
  safeJSONParse,
  safeJSONStringify
} from './Utils';

describe('ensureProtocol', () => {
  it('upgrades the URL if string begins with `http://`', async () => {
    const urlWithProtocol = ensureProtocol('http://someurl.com');
    expect(urlWithProtocol).toEqual('https://someurl.com');
  });

  it('does nothing if string already has `https://`', async () => {
    const url = 'https://someurl.com';
    const urlWithProtocol = ensureProtocol(url);
    expect(urlWithProtocol).toEqual(url);
  });

  it('adds http if string begins with `localhost`', async () => {
    const urlWithProtocol = ensureProtocol('localhost:1234/test');
    expect(urlWithProtocol).toEqual('http://localhost:1234/test');
  });

  it('does nothing if string begins with `http://localhost`', async () => {
    const urlWithProtocol = ensureProtocol('http://localhost:1234/test');
    expect(urlWithProtocol).toEqual('http://localhost:1234/test');
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
    // ignore warning about invalid date string being passed to dayjs
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns empty string if invalid date is provided', async () => {
    const date = 'INVALID DATE STRING';
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
    // ignore warning about invalid date string being passed to dayjs
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns empty string if invalid startDate is provided', async () => {
    const startDate = 'INVALID DATE STRING';
    const formattedDateString = getFormattedDateRangeString(DATE_FORMAT.MediumDateFormat, startDate);
    expect(formattedDateString).toEqual('');
  });

  it('returns empty string if invalid endDate is provided', async () => {
    const startDate = '2021-03-04T22:44:55.478682';
    const endDate = 'INVALID DATE STRING';
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
    const circle: Record<string, any> = {};
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

describe('downloadFile', () => {
  it('should create an anchor element with the provided URL and simulate a click', () => {
    const url = 'https://example.com/file.pdf';
    const anchor = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(anchor, 'click');
    vi.spyOn(anchor, 'remove');

    downloadFile(url);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toEqual(url);
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
  });
});

describe('pluralize', () => {
  it('pluralizes a word', () => {
    const response = pluralize(2, 'apple');
    expect(response).toEqual('apples');
  });

  it('pluralizes a word with undefined quantity', () => {
    const response = pluralize(null as unknown as number, 'orange');
    expect(response).toEqual('oranges');
  });

  it('does not pluralize a single item', () => {
    const response = pluralize(1, 'banana');
    expect(response).toEqual('banana');
  });

  it('pluralizes a word with a custom suffix', () => {
    const response = pluralize(10, 'berr', 'y', 'ies');
    expect(response).toEqual('berries');
  });

  it('does not pluralize a word with a custom suffix and single quantity', () => {
    const response = pluralize(1, 'berr', 'y', 'ies');
    expect(response).toEqual('berry');
  });
});

describe('getFormattedIdentitySource', () => {
  it('returns BCeID Basic', () => {
    const result = getFormattedIdentitySource(SYSTEM_IDENTITY_SOURCE.BCEID_BASIC);

    expect(result).toEqual('BCeID Basic');
  });

  it('returns BCeID Business', () => {
    const result = getFormattedIdentitySource(SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS);

    expect(result).toEqual('BCeID Business');
  });

  it('returns IDIR', () => {
    const result = getFormattedIdentitySource(SYSTEM_IDENTITY_SOURCE.IDIR);

    expect(result).toEqual('IDIR');
  });

  it('returns IDIR', () => {
    const result = getFormattedIdentitySource(SYSTEM_IDENTITY_SOURCE.DATABASE);

    expect(result).toEqual('System');
  });

  it('returns null for unknown identity source', () => {
    const result = getFormattedIdentitySource('__default_test_string' as SYSTEM_IDENTITY_SOURCE);

    expect(result).toEqual(null);
  });

  it('returns null for null identity source', () => {
    const result = getFormattedIdentitySource(null as unknown as SYSTEM_IDENTITY_SOURCE);

    expect(result).toEqual(null);
  });

  describe('firstOrNull', () => {
    it('returns the first element of a non-empty array', () => {
      const response = firstOrNull(['apple', 'banana', 'cherry']);
      expect(response).toEqual('apple');
    });

    it('returns null for an empty array', () => {
      const response = firstOrNull([]);
      expect(response).toBeNull();
    });

    it('works with numbers', () => {
      const response = firstOrNull([10, 20, 30]);
      expect(response).toEqual(10);
    });

    it('works with a single-element array', () => {
      const response = firstOrNull(['only']);
      expect(response).toEqual('only');
    });

    it('works with objects', () => {
      const arr = [{ id: 1 }, { id: 2 }];
      const response = firstOrNull(arr);
      expect(response).toEqual({ id: 1 });
    });
  });
});
