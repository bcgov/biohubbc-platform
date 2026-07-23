import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Test bootstrap.
 *
 * Loaded through the mocha `file` option so it runs before any spec, which matters because
 * `src/config.ts` reads the environment once at import time. Doing this from an import inside a spec
 * would be fragile: the import organizer can reorder imports and silently break the ordering.
 *
 * Generates a real RSA keypair (plus a second one, to exercise rotation and unknown key handling)
 * rather than checking fixtures into the repository.
 */

const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'martin-gateway-keys-'));

const generate = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

const primary = generate();
const secondary = generate();
/** Never published to the gateway, so tokens signed with it must be rejected. */
const foreign = generate();

export const PRIMARY_KID = 'test-primary';
export const SECONDARY_KID = 'test-secondary';
export const FOREIGN_KID = 'test-foreign';

fs.writeFileSync(path.join(keyDir, `${PRIMARY_KID}.pem`), primary.publicKey);
fs.writeFileSync(path.join(keyDir, `${SECONDARY_KID}.pem`), secondary.publicKey);

export const testKeys = {
  primaryPrivateKey: primary.privateKey,
  secondaryPrivateKey: secondary.privateKey,
  foreignPrivateKey: foreign.privateKey,
  keyDir
};

export const TEST_AUDIENCE = 'biohub-tiles';
export const TEST_ISSUER = 'biohub-api';
export const TEST_SOURCE = 'search';

process.env.NODE_ENV = 'test';
process.env.MARTIN_TOKEN_PUBLIC_KEY_DIR = keyDir;
// The kid the API would sign with; startup asserts a matching public key file is present.
process.env.MARTIN_TOKEN_KID = PRIMARY_KID;
process.env.MARTIN_TOKEN_AUD = TEST_AUDIENCE;
process.env.MARTIN_TOKEN_ISS = TEST_ISSUER;
process.env.MARTIN_ALLOWED_SOURCES = TEST_SOURCE;
process.env.MARTIN_MIN_ZOOM = '0';
process.env.MARTIN_MAX_ZOOM = '15';
process.env.MARTIN_SOURCE_VERSION = 'testv1';
process.env.MARTIN_URL = 'http://127.0.0.1:59999';
process.env.LOG_LEVEL = 'error';
// High enough that the functional tests never trip the limiters; the limiter tests override this.
process.env.RATE_LIMIT_JTI_PER_MIN = '100000';
process.env.RATE_LIMIT_IP_PER_MIN = '100000';
