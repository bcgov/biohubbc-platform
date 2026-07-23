import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

/**
 * Minimal raw HTTP client for tests.
 *
 * Uses `node:http` rather than global `fetch` on purpose: fetch transparently decompresses gzip and
 * hides `Content-Encoding`, which would make it impossible to assert that the gateway passes
 * Martin's compressed bytes through untouched.
 *
 * @param {http.Server} server
 * @param {string} path
 * @param {Record<string, string>} [headers={}]
 * @return {*}  {Promise<RawResponse>}
 */
export const rawGet = (
  server: http.Server,
  path: string,
  headers: Record<string, string> = {}
): Promise<RawResponse> => {
  const { port } = server.address() as AddressInfo;

  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (response) => {
      const chunks: Buffer[] = [];

      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks)
        })
      );
    });

    request.on('error', reject);
    request.end();
  });
};
