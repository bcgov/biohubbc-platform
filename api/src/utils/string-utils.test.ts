import { expect } from 'chai';
import { formatPhoneNumber, makeLoginUrl, safeToLowerCase, safeTrim } from './string-utils';

describe('safeToLowerCase', () => {
  describe('returns value lowercase', () => {
    it('when value is a lowercase string', () => {
      expect(safeToLowerCase('string')).to.equal('string');
    });

    it('when value is an uppercase string', () => {
      expect(safeToLowerCase('STRING')).to.equal('string');
    });

    it('when value is a mixed case string', () => {
      expect(safeToLowerCase('sTRiNG')).to.equal('string');
    });
  });

  describe('returns value unaltered', () => {
    it('when value is a negative number', () => {
      expect(safeToLowerCase(-123)).to.equal(-123);
    });

    it('when value is a zero', () => {
      expect(safeToLowerCase(0)).to.equal(0);
    });

    it('when value is a positive number', () => {
      expect(safeToLowerCase(123)).to.equal(123);
    });

    it('when value is `false`', () => {
      expect(safeToLowerCase(false)).to.equal(false);
    });

    it('when value is `true`', () => {
      expect(safeToLowerCase(true)).to.equal(true);
    });

    it('when value is an empty object', () => {
      expect(safeToLowerCase({})).to.eql({});
    });

    it('when value is an empty array', () => {
      expect(safeToLowerCase([])).to.eql([]);
    });

    it('when value is a non-empty array of numbers', () => {
      expect(safeToLowerCase([1, 2, 3])).to.eql([1, 2, 3]);
    });

    it('when value is a non-empty array of strings', () => {
      expect(safeToLowerCase(['1', 'string', 'false'])).to.eql(['1', 'string', 'false']);
    });

    it('when value is a function', () => {
      const fn = (a: number, b: number) => a * b;
      expect(safeToLowerCase(fn)).to.equal(fn);
    });
  });
});

describe('safeTrim', () => {
  describe('returns value trimmed', () => {
    it('when value is a lowercase string', () => {
      expect(safeTrim('  string  ')).to.equal('string');
    });

    it('when value is an uppercase string', () => {
      expect(safeTrim('  STRING  ')).to.equal('STRING');
    });

    it('when value is a mixed case string', () => {
      expect(safeTrim('  sTRiNG  ')).to.equal('sTRiNG');
    });
  });

  describe('returns value unaltered', () => {
    it('when value is a negative number', () => {
      expect(safeTrim(-123)).to.equal(-123);
    });

    it('when value is a zero', () => {
      expect(safeTrim(0)).to.equal(0);
    });

    it('when value is a positive number', () => {
      expect(safeTrim(123)).to.equal(123);
    });

    it('when value is `false`', () => {
      expect(safeTrim(false)).to.equal(false);
    });

    it('when value is `true`', () => {
      expect(safeTrim(true)).to.equal(true);
    });

    it('when value is an empty object', () => {
      expect(safeTrim({})).to.eql({});
    });

    it('when value is an empty array', () => {
      expect(safeTrim([])).to.eql([]);
    });

    it('when value is a non-empty array of numbers', () => {
      expect(safeTrim([1, 2, 3])).to.eql([1, 2, 3]);
    });

    it('when value is a non-empty array of strings', () => {
      expect(safeTrim([' 1 ', ' string ', ' false '])).to.eql([' 1 ', ' string ', ' false ']);
    });

    it('when value is a function', () => {
      const fn = (a: number, b: number) => a * b;
      expect(safeTrim(fn)).to.equal(fn);
    });
  });
});

describe('makeLoginUrl', () => {
  it('should generate a login URL without a redirect', () => {
    const url = makeLoginUrl('http://example.com');

    expect(url).to.equal('http://example.com/login');
  });

  it('should generate a login URL with a relative redirect', () => {
    const url = makeLoginUrl('http://example.com', '/admin/dashboard');

    expect(url).to.equal('http://example.com/login?redirect=%2Fadmin%2Fdashboard');
  });

  it('should generate a login URL with an absolute redirect', () => {
    const url = makeLoginUrl('http://example.com', 'http://example.net');

    expect(url).to.equal('http://example.com/login?redirect=http%3A%2F%2Fexample.net');
  });
});

describe('formatPhoneNumber', () => {
  it('should strip non-numerics', () => {
    const phone = formatPhoneNumber('Phone: 1250 555_1234');

    expect(phone).to.equal('+1 (250) 555-1234');
  });

  it('returns empty string', () => {
    const phone = formatPhoneNumber('');

    expect(phone).to.equal('');
  });

  it('should return a single char', () => {
    const phone = formatPhoneNumber('1');

    expect(phone).to.equal('1');
  });

  it('should return an unformatted phone number for strings beginning with 1 and exceeding 11 numbers', () => {
    const phone = formatPhoneNumber('123456789012');

    expect(phone).to.equal('123456789012');
  });

  it('should return an unformatted phone number for strings not beginning with 1 and exceeding 10 numbers', () => {
    const phone = formatPhoneNumber('07785551234');

    expect(phone).to.equal('07785551234');
  });

  it('returns a string with country code', () => {
    const phone = formatPhoneNumber('17785551234');

    expect(phone).to.equal('+1 (778) 555-1234');
  });

  it('returns a string without country code', () => {
    const phone = formatPhoneNumber('7785551234');

    expect(phone).to.equal('(778) 555-1234');
  });
});
