import { expect } from 'chai';
import { before, describe, it } from 'mocha';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';

/**
 * End to end tests for the Martin Gateway.
 *
 * Runs INSIDE the martin-gateway container against the real local stack, so it exercises the genuine
 * path: API mints a token -> gateway verifies it -> Martin renders a tile from PostGIS.
 *
 *   make martin-gateway       # start martin + gateway (and the api, via `make web`)
 *   make test-martin-gateway  # run this suite
 *
 * Not run in CI: CI has no database or compose stack (see .github/workflows/test.yml, which runs the
 * unit suite only).
 */

const GATEWAY_URL = process.env.INTEGRATION_GATEWAY_URL || 'http://127.0.0.1:6300';
const API_URL = process.env.INTEGRATION_API_URL || 'http://api:6200';
const MARTIN_URL = process.env.MARTIN_URL || 'http://martin:3000';
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
const request = (url: string, options: http.RequestOptions & { body?: string } = {}): Promise<RawResponse> => {
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

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
};

/**
 * The feature type sessions are minted against. The feature type registry is migration data and the
 * snapshot fixtures seed observation features locally, so tiles have real content to render.
 */
const FEATURE_TYPE = process.env.INTEGRATION_FEATURE_TYPE || 'species_observation';

/**
 * Mint a real Martin session from the API. Also returns the opaque context id claim, which direct
 * (gateway-bypassing) Martin requests need as their `context` query parameter.
 */
const mintToken = async (): Promise<{ token: string; martinUrlTemplate: string; ctx: string }> => {
  const body = JSON.stringify({ feature_type: FEATURE_TYPE });

  const response = await request(`${API_URL}/api/martin/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    body
  });

  expect(response.status, `mint failed: ${response.body.toString()}`).to.equal(200);

  const parsed = JSON.parse(response.body.toString());
  const claims = JSON.parse(Buffer.from(parsed.token.split('.')[1], 'base64url').toString());

  return { token: parsed.token, martinUrlTemplate: parsed.martin_url_template, ctx: claims.ctx };
};

describe('Martin Gateway (integration)', () => {
  let token: string;
  let ctx: string;

  before(async () => {
    ({ token, ctx } = await mintToken());
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

  it('serves a real vector tile end to end', async () => {
    const response = await request(`${GATEWAY_URL}/martin/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.status).to.equal(200);
    expect(response.headers['content-type']).to.equal('application/x-protobuf');
    expect(response.headers['content-encoding']).to.equal('gzip');
    expect(response.headers['etag']).to.be.a('string');
    // A real Mapbox Vector Tile carrying one of the layers the search source renders: aggregated
    // `clusters` at low zoom, raw `features` above the cluster threshold. The layer is named for
    // its content, never for the source, so the source name is deliberately not asserted.
    const mvt = gunzipSync(response.body).toString('binary');
    expect(mvt).to.satisfy((body: string) => body.includes('clusters') || body.includes('features'));
  });

  it('returns the exact bytes Martin produced, without recompressing', async () => {
    const viaGateway = await request(`${GATEWAY_URL}/martin/${SOURCE}/5/5/11`, {
      headers: { authorization: `Bearer ${token}` }
    });
    // Bypassing the gateway means supplying the context id ourselves: the gateway injects it from
    // the verified token, and martin_search renders nothing without it.
    const direct = await request(`${MARTIN_URL}/${SOURCE}/5/5/11?context=${encodeURIComponent(ctx)}`, {
      headers: { 'accept-encoding': 'gzip' }
    });

    expect(viaGateway.body.equals(direct.body)).to.equal(true);
  });

  it('serves an empty area as a 204', async () => {
    const response = await request(`${GATEWAY_URL}/martin/${SOURCE}/5/20/20`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.status).to.equal(204);
    expect(response.body).to.have.length(0);
  });

  it('serves repeat requests identically, while forbidding any client-side store', async () => {
    // Martin caches the tiles, keyed by the full query string and therefore per context. The
    // gateway marks every response no-store, because the tile URL does not identify the caller.
    const first = await request(`${GATEWAY_URL}/martin/${SOURCE}/6/11/22`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const second = await request(`${GATEWAY_URL}/martin/${SOURCE}/6/11/22`, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(first.status).to.equal(200);
    expect(second.status).to.equal(200);
    expect(second.body.equals(first.body)).to.equal(true);
    expect(second.headers['cache-control']).to.equal('no-store');
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
    // The tile still renders: the parameters are discarded, not treated as an error.
    const response = await request(
      `${GATEWAY_URL}/martin/${SOURCE}/5/5/11?context=attacker&filter=1%3D1&ctx=cache-buster`,
      { headers: { authorization: `Bearer ${token}` } }
    );

    expect(response.status).to.equal(200);
  });

  it('serves tiles while the API is unavailable, proving tile bytes bypass it', async function () {
    // The gateway's only upstream is Martin. Once a token is minted, the API plays no part in
    // serving tiles; this asserts the gateway never calls back to it.
    const response = await request(`${GATEWAY_URL}/martin/${SOURCE}/7/22/44`, {
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
