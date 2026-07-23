import { expect } from 'chai';
import { after, afterEach, before, describe, it } from 'mocha';
import http from 'node:http';
import { rawGet } from '../__mocks__/http-client.js';
import { defaultTileResponse, gzippedTileBody, startStubMartin, StubMartin } from '../__mocks__/stub-martin.js';
import { TEST_SOURCE } from '../__mocks__/test-setup.js';
import { bearer } from '../__mocks__/token-helpers.js';
import { app } from '../app.js';
import { clearTileCache } from '../cache/tile-cache.js';

describe('tile route', () => {
  let server: http.Server;
  let martin: StubMartin;

  before(async () => {
    martin = await startStubMartin();
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await martin.close();
  });

  afterEach(() => {
    clearTileCache();
    martin.requests.length = 0;
    martin.respondWith(defaultTileResponse);
  });

  describe('allowlisting', () => {
    it('serves the one allowlisted tile path', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(200);
    });

    it('rejects the Martin catalog endpoint', async () => {
      const response = await rawGet(server, '/catalog', { authorization: bearer() });

      expect(response.status).to.equal(404);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects the catalog even under the /martin prefix', async () => {
      const response = await rawGet(server, '/martin/catalog', { authorization: bearer() });

      expect(response.status).to.equal(404);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects a TileJSON request', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}`, { authorization: bearer() });

      expect(response.status).to.equal(404);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects a composite source request', async () => {
      // Martin supports comma separated composite sources; they must never reach it.
      const response = await rawGet(server, `/martin/${TEST_SOURCE},secret_source/5/5/11`, {
        authorization: bearer()
      });

      expect(response.status).to.equal(404);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects an unapproved source', async () => {
      const response = await rawGet(server, '/martin/some_other_source/5/5/11', {
        authorization: bearer({ source: 'some_other_source' })
      });

      expect(response.status).to.equal(403);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects a path traversal attempt', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/../../../catalog`, {
        authorization: bearer()
      });

      expect(response.status).to.equal(404);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects a zoom level above the configured maximum', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/20/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(404);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects tile coordinates that cannot exist at the requested zoom', async () => {
      // z2 has 4 columns (0-3), so x=99 is impossible.
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/2/99/1`, { authorization: bearer() });

      expect(response.status).to.equal(404);
      expect(martin.requests).to.have.length(0);
    });
  });

  describe('authorization', () => {
    it('rejects a request with no token before contacting Martin', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`);

      expect(response.status).to.equal(401);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects an expired token', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, {
        authorization: bearer({ expiresIn: -60 })
      });

      expect(response.status).to.equal(401);
      expect(martin.requests).to.have.length(0);
    });
  });

  describe('request sanitisation', () => {
    it('strips every client supplied query parameter and injects only the trusted context', async () => {
      await rawGet(
        server,
        `/martin/${TEST_SOURCE}/5/5/11?context=attacker-context&filter=1%3D1&ctx=cache-buster&user_id=42`,
        { authorization: bearer({ ctx: 'trusted-context' }) }
      );

      expect(martin.requests).to.have.length(1);

      const upstreamUrl = martin.requests[0].url;

      expect(upstreamUrl).to.equal(`/${TEST_SOURCE}/5/5/11?context=trusted-context`);
      expect(upstreamUrl).to.not.contain('attacker-context');
      expect(upstreamUrl).to.not.contain('filter');
      expect(upstreamUrl).to.not.contain('user_id');
      expect(upstreamUrl).to.not.contain('cache-buster');
    });

    it('never forwards the client Authorization header to Martin', async () => {
      await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(martin.requests[0].headers.authorization).to.be.undefined;
    });
  });

  describe('response metadata', () => {
    it('preserves content type, ETag and gzip encoding without recompressing', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(200);
      expect(response.headers['content-type']).to.equal('application/x-protobuf');
      expect(response.headers['content-encoding']).to.equal('gzip');
      expect(response.headers['etag']).to.equal('"abc123"');
      // The bytes are Martin's gzip stream, passed through untouched.
      expect(response.body.equals(gzippedTileBody)).to.equal(true);
    });

    it("forces a private cache and never forwards Martin's caching directive", async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      // The stub Martin sends `public, max-age=31536000`; the gateway must replace it so a shared
      // cache can never store one user's authorized tiles.
      expect(response.headers['cache-control']).to.equal('private, max-age=300');
    });

    it('passes an empty tile through as a cacheable 204', async () => {
      martin.respondWith({ status: 204, headers: { 'content-type': 'application/x-protobuf' } });

      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(204);
      expect(response.body).to.have.length(0);

      // Served from cache the second time, without a second upstream request.
      const second = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(second.status).to.equal(204);
      expect(second.headers['x-martin-cache']).to.equal('HIT');
      expect(martin.requests).to.have.length(1);
    });

    it('normalizes an upstream failure without leaking internal detail', async () => {
      martin.respondWith({
        status: 500,
        body: Buffer.from('PG::Error: relation "submission_feature" does not exist'),
        headers: { 'content-type': 'text/plain' }
      });

      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(502);
      expect(response.body.toString()).to.not.contain('submission_feature');
      expect(response.body.toString()).to.not.contain('PG::Error');
    });
  });

  describe('caching', () => {
    it('serves a repeat request from cache', async () => {
      const authorization = bearer({ ctx: 'ctx-1' });

      const first = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization });
      const second = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization });

      expect(first.headers['x-martin-cache']).to.equal('MISS');
      expect(second.headers['x-martin-cache']).to.equal('HIT');
      expect(martin.requests).to.have.length(1);
    });

    it('never shares cached tiles between different authorization contexts', async () => {
      await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer({ ctx: 'ctx-alice' }) });
      const bob = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer({ ctx: 'ctx-bob' }) });

      // Bob's request must reach Martin rather than reuse Alice's tile.
      expect(bob.headers['x-martin-cache']).to.equal('MISS');
      expect(martin.requests).to.have.length(2);
      expect(martin.requests[0].url).to.contain('ctx-alice');
      expect(martin.requests[1].url).to.contain('ctx-bob');
    });

    it('deduplicates concurrent requests for the same tile', async () => {
      martin.respondWith({ ...defaultTileResponse, delayMs: 50 });

      const authorization = bearer({ ctx: 'ctx-concurrent' });

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization }))
      );

      expect(responses.every((response) => response.status === 200)).to.equal(true);
      // Five concurrent misses, one upstream request.
      expect(martin.requests).to.have.length(1);
    });
  });

  describe('logging', () => {
    it('never writes the Authorization header or raw token to the logs', async () => {
      // Force the error path, which is the only place the gateway logs per request detail.
      martin.respondWith({ status: 500, body: Buffer.from('upstream exploded') });

      const authorization = bearer({ ctx: 'ctx-logging' });
      const token = authorization.replace('Bearer ', '');

      const captured: string[] = [];
      const originalStdout = process.stdout.write.bind(process.stdout);
      const originalStderr = process.stderr.write.bind(process.stderr);

      const capture = (chunk: unknown): boolean => {
        captured.push(String(chunk));
        return true;
      };

      process.stdout.write = capture as typeof process.stdout.write;
      process.stderr.write = capture as typeof process.stderr.write;

      try {
        await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization });
      } finally {
        process.stdout.write = originalStdout;
        process.stderr.write = originalStderr;
      }

      const output = captured.join('');

      expect(output).to.not.contain(token);
      expect(output.toLowerCase()).to.not.contain('bearer');
    });
  });

  describe('health', () => {
    it('reports healthy without contacting Martin', async () => {
      const response = await rawGet(server, '/health');

      expect(response.status).to.equal(200);
      expect(JSON.parse(response.body.toString()).status).to.equal('ok');
      expect(martin.requests).to.have.length(0);
    });
  });
});
