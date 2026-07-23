import http from 'node:http';
import { gzipSync } from 'node:zlib';

export interface StubMartinRequest {
  url: string;
  headers: http.IncomingHttpHeaders;
}

export interface StubMartin {
  server: http.Server;
  port: number;
  /** Every request the gateway made upstream, in order. */
  requests: StubMartinRequest[];
  /** Set the next response. */
  respondWith: (response: StubResponse) => void;
  close: () => Promise<void>;
}

export interface StubResponse {
  status: number;
  body?: Buffer;
  headers?: Record<string, string>;
  /** Delay before responding, to exercise concurrency. */
  delayMs?: number;
}

/** A gzipped protobuf body, matching what Martin actually serves. */
export const gzippedTileBody = gzipSync(Buffer.from('fake-mvt-payload'));

export const defaultTileResponse: StubResponse = {
  status: 200,
  body: gzippedTileBody,
  headers: {
    'content-type': 'application/x-protobuf',
    'content-encoding': 'gzip',
    etag: '"abc123"',
    'cache-control': 'max-age=300'
  }
};

/**
 * Start a stub Martin server.
 *
 * A real HTTP server rather than a stubbed client, so the test exercises the actual `node:http`
 * request path, including how headers and gzipped bodies survive the round trip.
 *
 * Binds the exact port `MARTIN_URL` points at, because the gateway resolves that URL once at import
 * time.
 *
 * @return {*}  {Promise<StubMartin>}
 */
export const startStubMartin = async (): Promise<StubMartin> => {
  const martinPort = Number(new URL(process.env.MARTIN_URL ?? 'http://127.0.0.1:59999').port);
  const requests: StubMartinRequest[] = [];
  let nextResponse: StubResponse = defaultTileResponse;

  const server = http.createServer((req, res) => {
    requests.push({ url: req.url ?? '', headers: req.headers });

    const respond = () => {
      const { status, body, headers } = nextResponse;

      for (const [key, value] of Object.entries(headers ?? {})) {
        res.setHeader(key, value);
      }

      if (status === 204 || !body) {
        res.writeHead(status);
        res.end();
        return;
      }

      res.writeHead(status);
      res.end(body);
    };

    if (nextResponse.delayMs) {
      setTimeout(respond, nextResponse.delayMs);
    } else {
      respond();
    }
  });

  await new Promise<void>((resolve) => server.listen(martinPort, '127.0.0.1', resolve));

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to start stub Martin');
  }

  return {
    server,
    port: address.port,
    requests,
    respondWith: (response: StubResponse) => {
      nextResponse = response;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
};
