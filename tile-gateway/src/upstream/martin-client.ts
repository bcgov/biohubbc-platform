import http from 'node:http';
import https from 'node:https';
import { config } from '../config.js';
import { badGateway } from '../errors/tile-error.js';
import { getLogger } from '../utils/logger.js';

const defaultLog = getLogger('upstream/martin-client');

const martinUrl = new URL(config.martinUrl);
const isHttps = martinUrl.protocol === 'https:';
const transport = isHttps ? https : http;

/** Keep alive so a viewport pan reuses one connection rather than opening a socket per tile. */
const agent = new (isHttps ? https.Agent : http.Agent)({ keepAlive: true, maxSockets: 64 });

/** Response metadata preserved verbatim from Martin. */
export const PRESERVED_HEADERS = ['content-type', 'content-encoding', 'etag', 'cache-control', 'last-modified'];

export interface UpstreamTileResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  /** Upstream round trip, milliseconds. */
  durationMs: number;
}

/**
 * Fetch a tile from Martin.
 *
 * Deliberately implemented with `node:http` rather than `fetch`/undici. Global fetch transparently
 * decompresses gzip responses and drops the `Content-Encoding` header, which would force the gateway
 * to either serve wrongly labelled bytes or re-compress every tile. Martin already gzips tiles, so
 * the bytes are passed through untouched.
 *
 * @param {string} pathname Already validated and constructed by the caller. Never client supplied.
 * @return {*}  {Promise<UpstreamTileResponse>}
 */
export const fetchTile = (pathname: string): Promise<UpstreamTileResponse> => {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const request = transport.request(
      {
        protocol: martinUrl.protocol,
        hostname: martinUrl.hostname,
        port: martinUrl.port,
        path: pathname,
        method: 'GET',
        agent,
        timeout: config.martinTimeoutMs,
        headers: {
          // Always request gzip so there is exactly one cached representation per tile.
          'accept-encoding': 'gzip'
        }
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => chunks.push(chunk));

        response.on('end', () => {
          const status = response.statusCode ?? 502;

          const headers: Record<string, string> = {};

          for (const header of PRESERVED_HEADERS) {
            const value = response.headers[header];

            if (typeof value === 'string') {
              headers[header] = value;
            }
          }

          resolve({
            status,
            headers,
            body: Buffer.concat(chunks),
            durationMs: Date.now() - startedAt
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy();
      defaultLog.error({ message: 'Martin request timed out', pathname, timeoutMs: config.martinTimeoutMs });
      reject(badGateway());
    });

    request.on('error', (error) => {
      defaultLog.error({ message: 'Martin request failed', pathname, error: error.message });
      reject(badGateway());
    });

    request.end();
  });
};
