import * as crypto from 'node:crypto';
import { IDBConnection } from '../database/db';
import { HTTP401 } from '../errors/http-error';
import { AccessKeyView } from '../models/access-key';
import { AccessKeyRepository } from '../repositories/access-key-repository';
import { DBService } from './db-service';

/**
 * Number of months until a newly created key expires.
 */
const KEY_EXPIRY_MONTHS = 6;

/**
 * Byte length of the random prefix segment.
 * 6 bytes → 8 base64url characters (each base64 char encodes 6 bits; 6 bytes = 48 bits = 8 chars).
 */
const PREFIX_BYTES = 6;

/**
 * Number of base64url characters produced from `PREFIX_BYTES`.
 *
 * base64url encodes 6 bits per character, so: ceil(PREFIX_BYTES * 8 / 6) = 8.
 * This constant is used for positional parsing during verification — it must stay in
 * sync with `PREFIX_BYTES`.  Never derive the prefix boundary from delimiter search;
 * base64url output may contain `_`, making any `_`-search approach ambiguous.
 */
const PREFIX_SEGMENT_CHARS = Math.ceil((PREFIX_BYTES * 8) / 6);

/**
 * Byte length of the random secret segment.
 * 32 bytes → ~43 base64url characters (~192 bits of entropy).
 */
const SECRET_BYTES = 32;

/**
 * Format: `biohub_<8charPrefix>_<43charSecret>`
 *
 * The prefix portion (`biohub_<8charPrefix>`) is stored in `key_prefix` for display/lookup.
 * The full plaintext string is scrypt-hashed (using `key_prefix` as salt) and stored in
 * `key_hash` for verification.
 *
 * The `_` between prefix and secret sits at a fixed, known index derived from
 * `KEY_VENDOR_PREFIX.length + 1 + PREFIX_SEGMENT_CHARS`.  Verification must use
 * positional parsing (not `indexOf` / `lastIndexOf`) because base64url may contain `_`.
 */
const KEY_VENDOR_PREFIX = 'biohub';

/**
 * Output byte length for the scrypt-derived key (32 bytes → 64 hex chars).
 */
const SCRYPT_KEYLEN = 32;

/**
 * Scrypt cost parameters.
 *
 * N=16384 meets OWASP minimum for interactive logins; since API keys are high-entropy random
 * tokens the cost could be lower, but this provides defence-in-depth against DB compromise
 * while keeping per-request latency well under 100 ms on modern hardware.
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Derive a hex-encoded scrypt hash of `plaintext` using `salt`.
 *
 * Using `key_prefix` as the salt means no additional column is required — each key has a
 * unique, randomly-generated prefix that functions as a per-key salt.
 */
const deriveKeyHash = (plaintext: string, salt: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, derived) => {
      if (err) {
        reject(err);
      } else {
        resolve(derived.toString('hex'));
      }
    });
  });
};

/**
 * Result of a successful access key creation.
 */
export interface ICreateAccessKeyResult {
  /** Public view of the persisted record (no `key_hash`). */
  access_key: AccessKeyView;
  /** The full plaintext key — shown to the user exactly once; never persisted. */
  plaintext_key: string;
}

/**
 * Minimal result from a successful key verification, used by the auth handler.
 */
export interface IVerifyAccessKeyResult {
  access_key_id: string;
  system_user_id: number;
}

export class AccessKeyService extends DBService {
  accessKeyRepository: AccessKeyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.accessKeyRepository = new AccessKeyRepository(connection);
  }

  /**
   * Generate and persist a new API key for a system user.
   *
   * The plaintext key is returned exactly once; `key_hash` is stored in the database and
   * the plaintext is never logged or persisted beyond this response.
   *
   * @param {number} systemUserId - Owner of the new key.
   * @param {string} name - Human-readable label supplied by the user.
   * @return {Promise<ICreateAccessKeyResult>}
   * @memberof AccessKeyService
   */
  async createAccessKey(systemUserId: number, name: string): Promise<ICreateAccessKeyResult> {
    const prefixSegment = crypto.randomBytes(PREFIX_BYTES).toString('base64url');
    const secretSegment = crypto.randomBytes(SECRET_BYTES).toString('base64url');

    const keyPrefix = `${KEY_VENDOR_PREFIX}_${prefixSegment}`;
    const plaintextKey = `${keyPrefix}_${secretSegment}`;

    const keyHash = await deriveKeyHash(plaintextKey, keyPrefix);

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + KEY_EXPIRY_MONTHS);

    const accessKey = await this.accessKeyRepository.insertAccessKey({
      system_user_id: systemUserId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      expires_at: expiresAt.toISOString()
    });

    return { access_key: accessKey, plaintext_key: plaintextKey };
  }

  /**
   * List all active access keys belonging to a system user.
   *
   * `key_hash` is never included in the response.
   *
   * @param {number} systemUserId
   * @return {Promise<AccessKeyView[]>}
   * @memberof AccessKeyService
   */
  async listAccessKeys(systemUserId: number): Promise<AccessKeyView[]> {
    return this.accessKeyRepository.listAccessKeysByUserId(systemUserId);
  }

  /**
   * Revoke an access key owned by a system user.
   *
   * Owner-scoping is enforced in the repository layer.
   *
   * @param {string} accessKeyId
   * @param {number} systemUserId
   * @return {Promise<void>}
   * @memberof AccessKeyService
   */
  async revokeAccessKey(accessKeyId: string, systemUserId: number): Promise<void> {
    return this.accessKeyRepository.revokeAccessKey(accessKeyId, systemUserId);
  }

  /**
   * Verify a plaintext API key and return its owner information.
   *
   * Steps:
   * 1. Parse `key_prefix` positionally using known fixed lengths (base64url segments may contain `_`).
   * 2. Look up the row by prefix.
   * 3. Constant-time compare the scrypt hash of the supplied key against the stored hash.
   * 4. Reject if the key is expired, revoked, or soft-deleted.
   *
   * Throws `HTTP401` for any failure to ensure consistent error behaviour regardless of failure mode.
   *
   * @param {string} plaintextKey - The full plaintext API key (e.g. `biohub_AbCdEfGh_...`).
   * @return {Promise<IVerifyAccessKeyResult>}
   * @throws {HTTP401} if the key is missing, invalid, expired, or revoked.
   * @memberof AccessKeyService
   */
  async verifyAccessKey(plaintextKey: string): Promise<IVerifyAccessKeyResult> {
    // Positional parse — `_`-search is unreliable because base64url output may contain `_`.
    // The delimiter between key_prefix and secret sits at a fixed, computable index:
    //   <vendor>_<prefixSegment>_<secret>
    //   └─ KEY_VENDOR_PREFIX.length ─┘↑└─ PREFIX_SEGMENT_CHARS ─┘↑
    //                                 6                             15
    const vendorPrefixWithSep = `${KEY_VENDOR_PREFIX}_`;
    const keyPrefixLength = vendorPrefixWithSep.length + PREFIX_SEGMENT_CHARS;
    const secretDelimiterIndex = keyPrefixLength; // position of `_` between prefix and secret

    const keyPrefix = plaintextKey.substring(0, keyPrefixLength);
    const delimiter = plaintextKey[secretDelimiterIndex];
    const secretSegment = plaintextKey.substring(secretDelimiterIndex + 1);

    if (
      !keyPrefix.startsWith(vendorPrefixWithSep) ||
      keyPrefix.length !== keyPrefixLength ||
      delimiter !== '_' ||
      secretSegment.length === 0
    ) {
      throw new HTTP401('Access Denied');
    }

    const record = await this.accessKeyRepository.getAccessKeyByPrefix(keyPrefix);

    if (!record) {
      throw new HTTP401('Access Denied');
    }

    // Derive the hash using the stored prefix as salt, then compare in constant time.
    const suppliedHash = await deriveKeyHash(plaintextKey, record.key_prefix);
    const storedHashBuffer = Buffer.from(record.key_hash, 'hex');
    const suppliedHashBuffer = Buffer.from(suppliedHash, 'hex');

    if (
      storedHashBuffer.length !== suppliedHashBuffer.length ||
      !crypto.timingSafeEqual(storedHashBuffer, suppliedHashBuffer)
    ) {
      throw new HTTP401('Access Denied');
    }

    if (record.revoked_at !== null) {
      throw new HTTP401('Access Denied');
    }

    if (new Date(record.expires_at) <= new Date()) {
      throw new HTTP401('Access Denied');
    }

    return { access_key_id: record.access_key_id, system_user_id: record.system_user_id };
  }

  /**
   * Update the `last_used_at` timestamp for an access key.
   *
   * @param {string} accessKeyId
   * @return {Promise<void>}
   * @memberof AccessKeyService
   */
  async touchLastUsedAt(accessKeyId: string): Promise<void> {
    return this.accessKeyRepository.touchLastUsedAt(accessKeyId);
  }
}
