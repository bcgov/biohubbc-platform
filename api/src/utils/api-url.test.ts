import { expect } from 'chai';
import { describe, it } from 'mocha';
import { getApiBaseUrl } from './api-url';

describe('getApiBaseUrl', () => {
  const originalHost = process.env.API_HOST;
  const originalPort = process.env.API_PORT;

  afterEach(() => {
    if (originalHost === undefined) {
      delete process.env.API_HOST;
    } else {
      process.env.API_HOST = originalHost;
    }
    if (originalPort === undefined) {
      delete process.env.API_PORT;
    } else {
      process.env.API_PORT = originalPort;
    }
  });

  it('uses http and the configured port for localhost', () => {
    process.env.API_HOST = 'localhost';
    process.env.API_PORT = '6100';

    expect(getApiBaseUrl()).to.equal('http://localhost:6100');
  });

  it('uses https without a port for non-localhost hosts', () => {
    process.env.API_HOST = 'api.biohub.example.com';
    process.env.API_PORT = '6100';

    expect(getApiBaseUrl()).to.equal('https://api.biohub.example.com');
  });

  it('falls back to localhost:6100 when env vars are unset', () => {
    delete process.env.API_HOST;
    delete process.env.API_PORT;

    expect(getApiBaseUrl()).to.equal('http://localhost:6100');
  });
});
