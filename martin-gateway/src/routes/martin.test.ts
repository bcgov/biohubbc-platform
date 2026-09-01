import { expect } from 'chai';
import { after, afterEach, before, describe, it } from 'mocha';
import http from 'node:http';
import { rawGet } from '../__mocks__/http-client.js';
import { defaultTileResponse, gzippedTileBody, startStubMartin, StubMartin } from '../__mocks__/stub-martin.js';
import { TEST_SECOND_SOURCE, TEST_SOURCE } from '../__mocks__/test-setup.js';
import { bearer } from '../__mocks__/token-helpers.js';
import { app } from '../app.js';
import { clearInflight } from '../upstream/inflight.js';

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
    clearInflight();
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

  describe('source isolation', () => {
    it('serves a second allowlisted source', async () => {
      const response = await rawGet(server, `/martin/${TEST_SECOND_SOURCE}/5/5/11`, {
        authorization: bearer({ source: TEST_SECOND_SOURCE })
      });

      expect(response.status).to.equal(200);
      expect(martin.requests[0].url).to.equal(`/${TEST_SECOND_SOURCE}/5/5/11?context=ctx-test&v=testv1`);
    });

    it('rejects a token minted for a different allowlisted source', async () => {
      // Both sources are served, so this is the check that keeps one source's token from reading
      // another's tiles: being allowlisted is not the same as being granted.
      const response = await rawGet(server, `/martin/${TEST_SECOND_SOURCE}/5/5/11`, {
        authorization: bearer({ source: TEST_SOURCE })
      });

      expect(response.status).to.equal(403);
      expect(martin.requests).to.have.length(0);
    });

    it('rejects the reverse pairing too', async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, {
        authorization: bearer({ source: TEST_SECOND_SOURCE })
      });

      expect(response.status).to.equal(403);
      expect(martin.requests).to.have.length(0);
    });

    it('requests each source under its own upstream URL', async () => {
      const context = 'sf:12:34';

      await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, {
        authorization: bearer({ source: TEST_SOURCE, ctx: context })
      });
      await rawGet(server, `/martin/${TEST_SECOND_SOURCE}/5/5/11`, {
        authorization: bearer({ source: TEST_SECOND_SOURCE, ctx: context })
      });

      // Same context and same tile coordinates: only the source path keeps these apart in Martin's
      // cache. The context is percent encoded on the way out, so Martin decodes it back before the
      // tile function sees it.
      const encodedContext = encodeURIComponent(context);

      expect(martin.requests).to.have.length(2);
      expect(martin.requests.map((request) => request.url)).to.eql([
        `/${TEST_SOURCE}/5/5/11?context=${encodedContext}&v=testv1`,
        `/${TEST_SECOND_SOURCE}/5/5/11?context=${encodedContext}&v=testv1`
      ]);
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

      // `v` is the deploy-time source version, part of Martin's cache key; `context` is the only
      // authorization input. Nothing client supplied survives.
      expect(upstreamUrl).to.equal(`/${TEST_SOURCE}/5/5/11?context=trusted-context&v=testv1`);
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

    it("forbids storing tiles and never forwards Martin's caching directive", async () => {
      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      // The stub Martin sends `public, max-age=31536000`; the gateway must replace it. Tile URLs do
      // not identify the caller, so any stored copy could be replayed to a different principal on
      // the same machine without a token check — no cache may hold one.
      expect(response.headers['cache-control']).to.equal('no-store');
    });

    it('passes an empty tile through as a 204 with the same no-store directive', async () => {
      martin.respondWith({ status: 204, headers: { 'content-type': 'application/x-protobuf' } });

      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(204);
      expect(response.body).to.have.length(0);
      expect(response.headers['cache-control']).to.equal('no-store');
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

    it('normalizes an upstream client error instead of passing its body through as a 200', async () => {
      martin.respondWith({
        status: 400,
        body: Buffer.from('{"error":"invalid query parameter"}'),
        headers: { 'content-type': 'application/json' }
      });

      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(502);
      expect(response.body.toString()).to.not.contain('invalid query parameter');
    });

    it('normalizes an empty-bodied redirect instead of mistaking it for an empty tile', async () => {
      // A 3xx has no body; without an explicit status check it would fall into the empty-tile 204
      // path and MapLibre would treat the area as legitimately featureless, never retrying.
      martin.respondWith({ status: 302, headers: { location: 'http://example.com/' } });

      const response = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer() });

      expect(response.status).to.equal(502);
    });
  });

  describe('upstream fetching', () => {
    it('reaches Martin on every request, so a repeat request is never answered locally', async () => {
      // Martin caches the rendered tiles, keyed by the full query string and therefore per
      // context. A cache here would sit in front of that one and have to be invalidated with it.
      const authorization = bearer({ ctx: 'ctx-1' });

      const first = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization });
      const second = await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization });

      expect(first.status).to.equal(200);
      expect(second.status).to.equal(200);
      expect(martin.requests).to.have.length(2);
    });

    it('requests each authorization context under its own upstream URL', async () => {
      // The context is part of the upstream query string, which is exactly what partitions
      // Martin's cache between callers with different access.
      await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer({ ctx: 'ctx-alice' }) });
      await rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization: bearer({ ctx: 'ctx-bob' }) });

      expect(martin.requests).to.have.length(2);
      expect(martin.requests[0].url).to.contain('ctx-alice');
      expect(martin.requests[1].url).to.contain('ctx-bob');
    });

    it('coalesces concurrent requests for the same tile into one upstream fetch', async () => {
      martin.respondWith({ ...defaultTileResponse, delayMs: 50 });

      const authorization = bearer({ ctx: 'ctx-concurrent' });

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => rawGet(server, `/martin/${TEST_SOURCE}/5/5/11`, { authorization }))
      );

      expect(responses.every((response) => response.status === 200)).to.equal(true);
      // Five concurrent requests, one upstream fetch.
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
