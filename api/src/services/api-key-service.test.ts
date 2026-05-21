import chai, { expect } from 'chai';
import { describe } from 'mocha';
import * as crypto from 'node:crypto';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { HTTP401 } from '../errors/http-error';
import { ApiKey, ApiKeyView } from '../models/api-key';
import { ApiKeyRepository } from '../repositories/api-key-repository';
import { ApiKeyService } from './api-key-service';

/** Mirrors the scrypt parameters and callback usage in api-key-service.ts. */
const deriveKeyHash = (plaintext: string, salt: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, 32, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) {
        reject(err);
      } else {
        resolve(derived.toString('hex'));
      }
    });
  });
};

chai.use(sinonChai);

const makeApiKeyView = (overrides: Partial<ApiKeyView> = {}): ApiKeyView => ({
  api_key_id: 'aabbccdd-0000-0000-0000-000000000001',
  system_user_id: 1,
  name: 'My test key',
  key_prefix: 'biohub_AbCdEfGh',
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days from now
  revoked_at: null,
  last_used_at: null,
  record_end_date: null,
  create_date: '2026-01-01T00:00:00.000Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  ...overrides
});

describe('ApiKeyService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createApiKey', () => {
    it('should generate a plaintext key and return it alongside the persisted view record', async () => {
      const view = makeApiKeyView();
      sinon.stub(ApiKeyRepository.prototype, 'insertApiKey').resolves(view);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      const result = await service.createApiKey(1, 'My test key');

      expect(result.api_key).to.eql(view);
      expect(result.plaintext_key).to.be.a('string');
      expect(result.plaintext_key.startsWith('biohub_')).to.be.true;
      // Must have at least 3 underscore-separated segments
      expect(result.plaintext_key.split('_').length).to.be.at.least(3);
    });

    it('should hash the key using scrypt before persisting', async () => {
      let capturedParams: any;
      sinon.stub(ApiKeyRepository.prototype, 'insertApiKey').callsFake(async (params) => {
        capturedParams = params;
        return makeApiKeyView();
      });

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      const result = await service.createApiKey(1, 'Key');

      // Use the persisted key_prefix as salt — base64url prefix segments may contain underscores,
      // so the prefix cannot be reliably reconstructed by splitting the plaintext key.
      const expectedHash = await deriveKeyHash(result.plaintext_key, capturedParams.key_prefix);
      expect(capturedParams.key_hash).to.equal(expectedHash);
    });

    it('should not include key_hash in the returned api_key view', async () => {
      const view = makeApiKeyView();
      sinon.stub(ApiKeyRepository.prototype, 'insertApiKey').resolves(view);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      const result = await service.createApiKey(1, 'Key');

      expect((result.api_key as any).key_hash).to.be.undefined;
    });
  });

  describe('listApiKeys', () => {
    it('should return API key views for the user', async () => {
      const views = [makeApiKeyView()];
      sinon.stub(ApiKeyRepository.prototype, 'listApiKeysByUserId').resolves(views);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      const result = await service.listApiKeys(1);

      expect(result).to.eql(views);
    });
  });

  describe('revokeApiKey', () => {
    it('should call repository.revokeApiKey with correct arguments', async () => {
      const stub = sinon.stub(ApiKeyRepository.prototype, 'revokeApiKey').resolves();

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      await service.revokeApiKey('aabbccdd-0000-0000-0000-000000000001', 1);

      expect(stub).to.have.been.calledOnceWith('aabbccdd-0000-0000-0000-000000000001', 1);
    });
  });

  describe('deleteApiKey', () => {
    it('should call repository.deleteApiKey with correct arguments', async () => {
      const stub = sinon.stub(ApiKeyRepository.prototype, 'deleteApiKey').resolves();

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      await service.deleteApiKey('aabbccdd-0000-0000-0000-000000000001', 1);

      expect(stub).to.have.been.calledOnceWith('aabbccdd-0000-0000-0000-000000000001', 1);
    });
  });

  describe('verifyApiKey', () => {
    const buildValidKey = async (): Promise<{ plaintext: string; hash: string; prefix: string }> => {
      const prefix = 'biohub_TestPref';
      const secret = 'supersecretvalue32byteslong12345';
      const plaintext = `${prefix}_${secret}`;
      const hash = await deriveKeyHash(plaintext, prefix);
      return { plaintext, hash, prefix };
    };

    it('should return api_key_id and system_user_id for a valid key', async () => {
      const { plaintext, hash, prefix } = await buildValidKey();

      const record: ApiKey = {
        ...makeApiKeyView({ key_prefix: prefix }),
        key_hash: hash
      };

      sinon.stub(ApiKeyRepository.prototype, 'getApiKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      const result = await service.verifyApiKey(plaintext);

      expect(result.api_key_id).to.equal(record.api_key_id);
      expect(result.system_user_id).to.equal(record.system_user_id);
    });

    it('should verify a key when the secret segment contains underscores', async () => {
      // base64url can produce `_` in the secret; positional parsing must handle this correctly.
      const prefix = 'biohub_TestPref'; // 15 chars total — exact prefix length
      const secret = 'secret_with_underscores_inside__';
      const plaintext = `${prefix}_${secret}`;
      const hash = await deriveKeyHash(plaintext, prefix);

      const record: ApiKey = {
        ...makeApiKeyView({ key_prefix: prefix }),
        key_hash: hash
      };

      const getByPrefixStub = sinon.stub(ApiKeyRepository.prototype, 'getApiKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      const result = await service.verifyApiKey(plaintext);

      expect(getByPrefixStub).to.have.been.calledOnceWith(prefix);
      expect(result.api_key_id).to.equal(record.api_key_id);
      expect(result.system_user_id).to.equal(record.system_user_id);
    });

    it('should throw HTTP401 when the key is too short to contain both prefix and secret', async () => {
      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      try {
        // 'biohub_short' is a valid vendor prefix but the prefix segment is too short
        await service.verifyApiKey('biohub_short_secret');
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when the key does not have the biohub_ vendor prefix', async () => {
      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      try {
        await service.verifyApiKey('wrong_prefix_value');
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when no row is found for the prefix', async () => {
      sinon.stub(ApiKeyRepository.prototype, 'getApiKeyByPrefix').resolves(null);

      const { plaintext } = await buildValidKey();

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      try {
        await service.verifyApiKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when the hash does not match', async () => {
      const { plaintext, prefix } = await buildValidKey();
      const wrongHash = await deriveKeyHash('totally_different_key', prefix);

      const record: ApiKey = {
        ...makeApiKeyView({ key_prefix: prefix }),
        key_hash: wrongHash
      };

      sinon.stub(ApiKeyRepository.prototype, 'getApiKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      try {
        await service.verifyApiKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when the key is revoked', async () => {
      const { plaintext, hash, prefix } = await buildValidKey();

      const record: ApiKey = {
        ...makeApiKeyView({ key_prefix: prefix, revoked_at: '2026-01-01T00:00:00.000Z' }),
        key_hash: hash
      };

      sinon.stub(ApiKeyRepository.prototype, 'getApiKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      try {
        await service.verifyApiKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when the key is expired', async () => {
      const { plaintext, hash, prefix } = await buildValidKey();

      const record: ApiKey = {
        ...makeApiKeyView({
          key_prefix: prefix,
          expires_at: '2020-01-01T00:00:00.000Z' // in the past
        }),
        key_hash: hash
      };

      sinon.stub(ApiKeyRepository.prototype, 'getApiKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      try {
        await service.verifyApiKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });
  });

  describe('touchLastUsedAt', () => {
    it('should call repository.touchLastUsedAt', async () => {
      const stub = sinon.stub(ApiKeyRepository.prototype, 'touchLastUsedAt').resolves();

      const connection = getMockDBConnection();
      const service = new ApiKeyService(connection);

      await service.touchLastUsedAt('aabbccdd-0000-0000-0000-000000000001');

      expect(stub).to.have.been.calledOnceWith('aabbccdd-0000-0000-0000-000000000001');
    });
  });
});
