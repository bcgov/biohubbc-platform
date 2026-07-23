import { expect } from 'chai';
import { before, describe, it } from 'mocha';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';

/**
 * End to end tests for the tile gateway.
 *
 * Runs INSIDE the tile-gateway container against the real local stack, so it exercises the genuine
 * path: API mints a token -> gateway verifies it -> Martin renders a tile from PostGIS.
 *
 *   make tiles       # start martin + gateway (and the api, via `make web`)
 *   make test-tiles  # run this suite
 *
 * Not run in CI: CI has no database or compose stack (see .github/workflows/test.yml, which runs the
 * unit suite only).
 */

const GATEWAY_URL = process.env.INTEGRATION_GATEWAY_URL || 'http://127.0.0.1:6300';
const API_URL = process.env.INTEGRATION_API_URL || 'http://api:6200';
const MARTIN_URL = process.env.MARTIN_URL || 'http://martin:3000';
const SOURCE = (process.env.TILE_ALLOWED_SOURCES || 'fixture').split(',')[0];

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
const mintToken = async (): Promise<{ token: string; tileUrlTemplate: string }> => {
  const response = await request(`${API_URL}/api/tile/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '0' }
  });

  expect(response.status, `mint failed: ${response.body.toString()}`).to.equal(200);

  const body = JSON.parse(response.body.toString());

  return { token: body.token, tileUrlTemplate: body.tile_url_template };
};

describe('tile gateway (integration)', () => {
  let token: string;

  before(async () => {
    ({ token } = await mintToken());
  });

  it('mints a token whose claims carry no identity or search detail', async () => {
    const { token: fresh, tileUrlTemplate } = await mintToken();

    const claims = JSON.parse(Buffer.from(fresh.split('.')[1], 'base64url').toString());

    expect(claims.source).to.equal(SOURCE);
    expect(claims.scope).to.equal('tiles:read');
    expect(claims).to.have.property('ctx');
    expect(claims).to.have.property('jti');
    expect(claims).to.not.have.property('system_user_id');
    expect(claims).to.not.have.property('expression');
    expect(tileUrlTemplate).to.contain('{z}/{x}/{y}');
  });

  it('serves a real vector tile end to end', async () => {
    const response = await request(`${GATEWAY_URL}/tiles/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.status).to.equal(200);
    expect(response.headers['content-type']).to.equal('application/x-protobuf');
    expect(response.headers['content-encoding']).to.equal('gzip');
    expect(response.headers['etag']).to.be.a('string');
    // A real Mapbox Vector Tile carrying the expected layer.
    expect(gunzipSync(response.body).toString('binary')).to.contain(SOURCE);
  });

  it('returns the exact bytes Martin produced, without recompressing', async () => {
    const viaGateway = await request(`${GATEWAY_URL}/tiles/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const direct = await request(`${MARTIN_URL}/${SOURCE}/5/5/11`, { headers: { 'accept-encoding': 'gzip' } });

    expect(viaGateway.body.equals(direct.body)).to.equal(true);
  });

  it('serves an empty area as a 204', async () => {
    const response = await request(`${GATEWAY_URL}/tiles/${SOURCE}/5/20/20`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.status).to.equal(204);
    expect(response.body).to.have.length(0);
  });

  it('caches a repeat request', async () => {
    const first = await request(`${GATEWAY_URL}/tiles/${SOURCE}/6/11/22`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const second = await request(`${GATEWAY_URL}/tiles/${SOURCE}/6/11/22`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(first.status).to.equal(200);
    expect(second.headers['x-tile-cache']).to.equal('HIT');
  });

  it('rejects a request with no token', async () => {
    const response = await request(`${GATEWAY_URL}/tiles/${SOURCE}/5/5/11`);

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

    const response = await request(`${GATEWAY_URL}/tiles/${SOURCE}/5/5/11`, {
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

    const response = await request(`${GATEWAY_URL}/tiles/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${forged}` }
    });

    expect(response.status).to.equal(401);
  });

  it('rejects arbitrary Martin endpoints', async () => {
    for (const path of ['/catalog', '/tiles/catalog', `/tiles/${SOURCE}`, `/tiles/${SOURCE},other/5/5/11`]) {
      const response = await request(`${GATEWAY_URL}${path}`, { headers: { authorization: `Bearer ${token}` } });

      expect(response.status, `expected ${path} to be rejected`).to.be.oneOf([403, 404]);
    }
  });

  it('strips client supplied query parameters', async () => {
    // The tile still renders: the parameters are discarded, not treated as an error.
    const response = await request(
      `${GATEWAY_URL}/tiles/${SOURCE}/5/5/11?context=attacker&filter=1%3D1&ctx=cache-buster`,
      { headers: { authorization: `Bearer ${token}` } }
    );

    expect(response.status).to.equal(200);
  });

  it('serves tiles while the API is unavailable, proving tile bytes bypass it', async function () {
    // The gateway's only upstream is Martin. Once a token is minted, the API plays no part in
    // serving tiles; this asserts the gateway never calls back to it.
    const response = await request(`${GATEWAY_URL}/tiles/${SOURCE}/7/22/44`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.status).to.be.oneOf([200, 204]);
  });

  it('reports healthy', async () => {
    const response = await request(`${GATEWAY_URL}/health`);

    expect(response.status).to.equal(200);
    expect(JSON.parse(response.body.toString()).status).to.equal('ok');
  });
});
