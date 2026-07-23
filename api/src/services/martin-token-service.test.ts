import chai, { expect } from 'chai';
import jwt from 'jsonwebtoken';
import { describe } from 'mocha';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTPError } from '../errors/http-error';
import { MartinTokenService, resetMartinTokenSigningKey } from './martin-token-service';

chai.use(sinonChai);

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

describe('MartinTokenService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetMartinTokenSigningKey();

    process.env.MARTIN_TOKEN_PRIVATE_KEY_PATH = '/fake/private.pem';
    process.env.MARTIN_TOKEN_KID = '2026-07';
    process.env.MARTIN_TOKEN_AUD = 'biohub-tiles';
    process.env.MARTIN_TOKEN_ISS = 'biohub-api';
    process.env.MARTIN_TOKEN_TTL_SECONDS = '900';

    sinon.stub(fs, 'readFileSync').returns(privateKey);
  });

  afterEach(() => {
    sinon.restore();
    resetMartinTokenSigningKey();
    process.env = { ...originalEnv };
  });

  describe('mintToken', () => {
    it('signs a verifiable RS256 token carrying the expected claims', () => {
      const { token, expiresIn, jti } = new MartinTokenService().mintToken({ source: 'fixture', ctx: 'ctx-123' });

      expect(expiresIn).to.equal(900);

      const claims = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        audience: 'biohub-tiles',
        issuer: 'biohub-api'
      }) as Record<string, any>;

      expect(claims.source).to.equal('fixture');
      expect(claims.ctx).to.equal('ctx-123');
      expect(claims.scope).to.equal('tiles:read');
      expect(claims.jti).to.equal(jti);
      expect(claims.exp).to.be.a('number');
    });

    it('sets the key id header so the gateway can select a public key', () => {
      const { token } = new MartinTokenService().mintToken({ source: 'fixture', ctx: 'ctx-123' });

      const decoded = jwt.decode(token, { complete: true });

      expect(decoded?.header.kid).to.equal('2026-07');
      expect(decoded?.header.alg).to.equal('RS256');
    });

    it('does not leak identity, scope ids or search expressions into the token', () => {
      const { token } = new MartinTokenService().mintToken({ source: 'fixture', ctx: 'ctx-123' });

      const claims = jwt.decode(token) as Record<string, unknown>;

      expect(claims).to.not.have.property('system_user_id');
      expect(claims).to.not.have.property('security_scope_ids');
      expect(claims).to.not.have.property('expression');
      expect(claims).to.not.have.property('feature_ids');
      expect(Object.keys(claims).sort()).to.eql(['aud', 'ctx', 'exp', 'iat', 'iss', 'jti', 'scope', 'source']);
    });

    it('mints a unique jti per token, so rate limiting is per session', () => {
      const service = new MartinTokenService();

      const first = service.mintToken({ source: 'fixture', ctx: 'ctx-1' });
      const second = service.mintToken({ source: 'fixture', ctx: 'ctx-1' });

      expect(first.jti).to.not.equal(second.jti);
    });

    it('throws a 500 when the signing key path is not configured', () => {
      delete process.env.MARTIN_TOKEN_PRIVATE_KEY_PATH;

      try {
        new MartinTokenService().mintToken({ source: 'fixture', ctx: 'ctx-1' });
        expect.fail('expected mintToken to throw');
      } catch (error) {
        expect((error as HTTPError).status).to.equal(500);
        expect((error as HTTPError).message).to.equal('Tile tokens are not configured');
      }
    });

    it('throws a 500 when the key id is not configured', () => {
      delete process.env.MARTIN_TOKEN_KID;

      try {
        new MartinTokenService().mintToken({ source: 'fixture', ctx: 'ctx-1' });
        expect.fail('expected mintToken to throw');
      } catch (error) {
        expect((error as HTTPError).status).to.equal(500);
      }
    });
  });

  describe('getMartinUrlTemplate', () => {
    it('returns a relative template by default, so tiles are same origin', () => {
      delete process.env.MARTIN_EXTERNAL_URL;

      expect(new MartinTokenService().getMartinUrlTemplate('fixture')).to.equal('/martin/fixture/{z}/{x}/{y}');
    });

    it('honours a configured base url and trims a trailing slash', () => {
      process.env.MARTIN_EXTERNAL_URL = 'http://localhost:6300/martin/';

      expect(new MartinTokenService().getMartinUrlTemplate('fixture')).to.equal(
        'http://localhost:6300/martin/fixture/{z}/{x}/{y}'
      );
    });
  });
});
