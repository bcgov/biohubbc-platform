import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  FOREIGN_KID,
  PRIMARY_KID,
  SECONDARY_KID,
  TEST_AUDIENCE,
  TEST_ISSUER,
  TEST_SOURCE,
  testKeys
} from '../__mocks__/test-setup.js';
import { bearer, signTestToken } from '../__mocks__/token-helpers.js';
import { TileError } from '../errors/tile-error.js';
import { assertExpectedKidPresent, verifyMartinToken } from './verify-token.js';

/**
 * Assert that verification fails with the expected status.
 *
 * @param {(() => unknown)} run
 * @param {number} status
 */
const expectStatus = (run: () => unknown, status: number) => {
  try {
    run();
    expect.fail('expected verification to throw');
  } catch (error) {
    expect(error).to.be.instanceOf(TileError);
    expect((error as TileError).status).to.equal(status);
  }
};

describe('verifyMartinToken', () => {
  describe('valid tokens', () => {
    it('accepts a correctly signed token and returns its claims', () => {
      const claims = verifyMartinToken(bearer({ ctx: 'ctx-abc', jti: 'jti-abc' }), TEST_SOURCE);

      expect(claims.ctx).to.equal('ctx-abc');
      expect(claims.jti).to.equal('jti-abc');
      expect(claims.source).to.equal(TEST_SOURCE);
    });

    it('accepts a token signed with the second published key (rotation window)', () => {
      const token = bearer({ privateKey: testKeys.secondaryPrivateKey, kid: SECONDARY_KID });

      expect(verifyMartinToken(token, TEST_SOURCE).source).to.equal(TEST_SOURCE);
    });
  });

  describe('401 - the caller should re-mint', () => {
    it('rejects a missing Authorization header', () => {
      expectStatus(() => verifyMartinToken(undefined, TEST_SOURCE), 401);
    });

    it('rejects a non-bearer Authorization header', () => {
      expectStatus(() => verifyMartinToken('Basic abc123', TEST_SOURCE), 401);
    });

    it('rejects a malformed token', () => {
      expectStatus(() => verifyMartinToken('Bearer not-a-jwt', TEST_SOURCE), 401);
    });

    it('rejects an invalid signature (token signed by an unpublished key)', () => {
      // Signed with a real key, but presented under a published kid, so the signature check fails.
      const token = signTestToken({ privateKey: testKeys.foreignPrivateKey });

      expectStatus(() => verifyMartinToken(`Bearer ${token}`, TEST_SOURCE), 401);
    });

    it('rejects a token signed with an unknown key id', () => {
      const token = signTestToken({ privateKey: testKeys.foreignPrivateKey, kid: FOREIGN_KID });

      expectStatus(() => verifyMartinToken(`Bearer ${token}`, TEST_SOURCE), 401);
    });

    it('rejects an expired token', () => {
      expectStatus(() => verifyMartinToken(bearer({ expiresIn: -60 }), TEST_SOURCE), 401);
    });

    it('rejects an unsigned "alg: none" token', () => {
      // The classic algorithm confusion attack: a verifier that does not pin its algorithms can be
      // talked into accepting a token with no signature at all.
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url').replace(/=+$/, '');

      const header = encode({ alg: 'none', typ: 'JWT', kid: PRIMARY_KID });
      const payload = encode({
        source: TEST_SOURCE,
        ctx: 'forged-context',
        scope: 'tiles:read',
        jti: 'forged',
        aud: TEST_AUDIENCE,
        iss: TEST_ISSUER,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      expectStatus(() => verifyMartinToken(`Bearer ${header}.${payload}.`, TEST_SOURCE), 401);
    });

    it('rejects a token whose payload was edited after signing', () => {
      const token = signTestToken({ ctx: 'ctx-original' });
      const [header, , signature] = token.split('.');

      const forgedPayload = Buffer.from(
        JSON.stringify({
          source: TEST_SOURCE,
          ctx: 'ctx-escalated',
          scope: 'tiles:read',
          jti: 'forged',
          aud: TEST_AUDIENCE,
          iss: TEST_ISSUER,
          exp: Math.floor(Date.now() / 1000) + 3600
        })
      )
        .toString('base64url')
        .replace(/=+$/, '');

      expectStatus(() => verifyMartinToken(`Bearer ${header}.${forgedPayload}.${signature}`, TEST_SOURCE), 401);
    });

    it('rejects an incorrect audience', () => {
      expectStatus(() => verifyMartinToken(bearer({ audience: 'some-other-audience' }), TEST_SOURCE), 401);
    });

    it('rejects an incorrect issuer', () => {
      expectStatus(() => verifyMartinToken(bearer({ issuer: 'evil-issuer' }), TEST_SOURCE), 401);
    });

    it('rejects a token missing the context claim', () => {
      expectStatus(() => verifyMartinToken(bearer({ omit: ['ctx'] }), TEST_SOURCE), 401);
    });

    it('rejects a token missing the jti claim', () => {
      expectStatus(() => verifyMartinToken(bearer({ omit: ['jti'] }), TEST_SOURCE), 401);
    });

    it('does not disclose why verification failed', () => {
      /**
       * Capture the message produced for a given token.
       */
      const messageFor = (authorization: string): string => {
        try {
          verifyMartinToken(authorization, TEST_SOURCE);
          expect.fail('expected verification to throw');
        } catch (error) {
          return (error as TileError).message;
        }
      };

      // An expired token and a badly signed one must be indistinguishable to the caller, so that a
      // probing client cannot learn whether it holds a genuine but stale token.
      const expiredMessage = messageFor(bearer({ expiresIn: -60 }));
      const badSignatureMessage = messageFor(`Bearer ${signTestToken({ privateKey: testKeys.foreignPrivateKey })}`);

      expect(expiredMessage).to.equal(badSignatureMessage);
      // ...and neither leaks the underlying library's wording.
      expect(expiredMessage).to.not.match(/jwt|malformed|signature/i);
    });
  });

  describe('403 - the token will never work for this request', () => {
    it('rejects a token scoped to a different source', () => {
      expectStatus(() => verifyMartinToken(bearer({ source: 'some-other-source' }), TEST_SOURCE), 403);
    });

    it('rejects a token without the required scope', () => {
      expectStatus(() => verifyMartinToken(bearer({ scope: 'something:else' }), TEST_SOURCE), 403);
    });

    it('rejects a token with no scope claim', () => {
      expectStatus(() => verifyMartinToken(bearer({ omit: ['scope'] }), TEST_SOURCE), 403);
    });
  });
});

describe('assertExpectedKidPresent', () => {
  const keys = new Map([
    [PRIMARY_KID, 'pem'],
    [SECONDARY_KID, 'pem']
  ]);

  it('passes when the expected kid has a loaded public key', () => {
    expect(() => assertExpectedKidPresent(keys, PRIMARY_KID)).to.not.throw();
  });

  it('is skipped when no expected kid is configured', () => {
    expect(() => assertExpectedKidPresent(keys, null)).to.not.throw();
  });

  it('fails startup when the expected kid has no matching key file', () => {
    // A mis-named key file otherwise passes every health check and silently 401s every tile.
    expect(() => assertExpectedKidPresent(keys, FOREIGN_KID)).to.throw(
      /test-foreign\.pem.*test-primary, test-secondary/
    );
  });
});
