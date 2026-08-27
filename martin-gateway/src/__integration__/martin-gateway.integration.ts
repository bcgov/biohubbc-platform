import { expect } from 'chai';
import { before, describe, it } from 'mocha';
import http from 'node:http';

/**
 * End to end tests for the Martin Gateway.
 *
 * Runs INSIDE the martin-gateway container against the real local stack, so it exercises the genuine
 * path: API mints a token -> gateway verifies it -> Martin.
 *
 * This ticket deploys the gateway itself; Martin publishes no sources yet, so what is asserted here
 * is token minting, verification, and rejection behaviour. Tile rendering, byte fidelity and caching
 * are covered once SIMSBIOHUB-1103 publishes the `search` source.
 *
 *   make martin-gateway       # start martin + gateway (and the api, via `make web`)
 *   make test-martin-gateway  # run this suite
 *
 * Not run in CI: CI has no database or compose stack (see .github/workflows/test.yml, which runs the
 * unit suite only).
 */

const GATEWAY_URL = process.env.INTEGRATION_GATEWAY_URL || 'http://127.0.0.1:6300';
const API_URL = process.env.INTEGRATION_API_URL || 'http://api:6200';
const SOURCE = (process.env.MARTIN_ALLOWED_SOURCES || 'search').split(',')[0];

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

/**
 * Raw HTTP request helper.
 *
 * Uses `node:http` rather than fetch so gzip bodies and `Content-Encoding` survive intact.
 */
const request = (url: string, options: http.RequestOptions = {}): Promise<RawResponse> => {
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: options.method || 'GET',
        headers: options.headers
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );

    req.on('error', reject);
    req.end();
  });
};

/**
 * Mint a real tile token from the API.
 */
const mintToken = async (): Promise<{ token: string; martinUrlTemplate: string }> => {
  const response = await request(`${API_URL}/api/martin/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '0' }
  });

  expect(response.status, `mint failed: ${response.body.toString()}`).to.equal(200);

  const body = JSON.parse(response.body.toString());

  return { token: body.token, martinUrlTemplate: body.martin_url_template };
};

describe('Martin Gateway (integration)', () => {
  let token: string;

  before(async () => {
    ({ token } = await mintToken());
  });

  it('mints a token whose claims carry no identity or search detail', async () => {
    const { token: fresh, martinUrlTemplate } = await mintToken();

    const claims = JSON.parse(Buffer.from(fresh.split('.')[1], 'base64url').toString());

    expect(claims.source).to.equal(SOURCE);
    expect(claims.scope).to.equal('tiles:read');
    expect(claims).to.have.property('ctx');
    expect(claims).to.have.property('jti');
    expect(claims).to.not.have.property('system_user_id');
    expect(claims).to.not.have.property('expression');
    expect(martinUrlTemplate).to.contain('{z}/{x}/{y}');
  });

  it('authenticates, but has no source to serve until the search source lands', async () => {
    // Martin publishes nothing in this ticket, so an authenticated request reaches Martin and comes
    // back empty handed. Tile rendering, byte fidelity and caching are covered by SIMSBIOHUB-1103,
    // which publishes `search`.
    const response = await request(`${GATEWAY_URL}/martin/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.status).to.equal(404);
  });

  it('rejects a request with no token', async () => {
    const response = await request(`${GATEWAY_URL}/martin/${SOURCE}/5/5/11`);

    expect(response.status).to.equal(401);
  });

  it('rejects a tampered token', async () => {
    const [header, payload, signature] = token.split('.');
    // Flip a character mid-signature: changing the LAST character can leave the decoded bytes
    // unchanged, because it carries unused padding bits.
    const middle = Math.floor(signature.length / 2);
    const tampered = `${header}.${payload}.${signature.slice(0, middle)}${
      signature[middle] === 'A' ? 'B' : 'A'
    }${signature.slice(middle + 1)}`;

    const response = await request(`${GATEWAY_URL}/martin/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${tampered}` }
    });

    expect(response.status).to.equal(401);
  });

  it('rejects an unsigned token', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url').replace(/=+$/, '');

    const forged = `${encode({ alg: 'none', typ: 'JWT', kid: 'local' })}.${encode({
      source: SOURCE,
      ctx: 'forged',
      scope: 'tiles:read',
      jti: 'forged',
      aud: 'biohub-tiles',
      iss: 'biohub-api',
      exp: Math.floor(Date.now() / 1000) + 3600
    })}.`;

    const response = await request(`${GATEWAY_URL}/martin/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${forged}` }
    });

    expect(response.status).to.equal(401);
  });

  it('rejects arbitrary Martin endpoints', async () => {
    for (const path of ['/catalog', '/martin/catalog', `/martin/${SOURCE}`, `/martin/${SOURCE},other/5/5/11`]) {
      const response = await request(`${GATEWAY_URL}${path}`, { headers: { authorization: `Bearer ${token}` } });

      expect(response.status, `expected ${path} to be rejected`).to.be.oneOf([403, 404]);
    }
  });

  it('strips client supplied query parameters', async () => {
    // The parameters are discarded rather than treated as an error, so this fails the same way an
    // unadorned request does (404 until a source is published) and never 400s.
    const response = await request(
      `${GATEWAY_URL}/martin/${SOURCE}/5/5/11?context=attacker&filter=1%3D1&ctx=cache-buster`,
      { headers: { authorization: `Bearer ${token}` } }
    );

    expect(response.status).to.equal(404);
  });

  it('reports healthy', async () => {
    const response = await request(`${GATEWAY_URL}/health`);

    expect(response.status).to.equal(200);
    expect(JSON.parse(response.body.toString()).status).to.equal('ok');
  });
});
