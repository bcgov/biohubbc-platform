import chai, { expect } from 'chai';
import { describe } from 'mocha';
import * as crypto from 'node:crypto';
import { promisify } from 'node:util';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { HTTP401 } from '../errors/http-error';
import { AccessKey, AccessKeyView } from '../models/access-key';
import { AccessKeyRepository } from '../repositories/access-key-repository';
import { AccessKeyService } from './access-key-service';

const scrypt = promisify(crypto.scrypt);
const deriveKeyHash = async (plaintext: string, salt: string): Promise<string> => {
  const derived = (await scrypt(plaintext, salt, 32, { N: 16384, r: 8, p: 1 })) as Buffer;
  return derived.toString('hex');
};

chai.use(sinonChai);

const makeAccessKeyView = (overrides: Partial<AccessKeyView> = {}): AccessKeyView => ({
  access_key_id: 'aabbccdd-0000-0000-0000-000000000001',
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

describe('AccessKeyService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createAccessKey', () => {
    it('should generate a plaintext key and return it alongside the persisted view record', async () => {
      const view = makeAccessKeyView();
      sinon.stub(AccessKeyRepository.prototype, 'insertAccessKey').resolves(view);

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      const result = await service.createAccessKey(1, 'My test key');

      expect(result.access_key).to.eql(view);
      expect(result.plaintext_key).to.be.a('string');
      expect(result.plaintext_key.startsWith('biohub_')).to.be.true;
      // Must have at least 3 underscore-separated segments
      expect(result.plaintext_key.split('_').length).to.be.at.least(3);
    });

    it('should hash the key using scrypt before persisting', async () => {
      let capturedParams: any;
      sinon.stub(AccessKeyRepository.prototype, 'insertAccessKey').callsFake(async (params) => {
        capturedParams = params;
        return makeAccessKeyView();
      });

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      const result = await service.createAccessKey(1, 'Key');

      // Derive the expected hash using the same algorithm: scrypt(plaintext, key_prefix, ...)
      const keyPrefix = result.plaintext_key.split('_').slice(0, 2).join('_');
      const expectedHash = await deriveKeyHash(result.plaintext_key, keyPrefix);
      expect(capturedParams.key_hash).to.equal(expectedHash);
    });

    it('should not include key_hash in the returned access_key view', async () => {
      const view = makeAccessKeyView();
      sinon.stub(AccessKeyRepository.prototype, 'insertAccessKey').resolves(view);

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      const result = await service.createAccessKey(1, 'Key');

      expect((result.access_key as any).key_hash).to.be.undefined;
    });
  });

  describe('listAccessKeys', () => {
    it('should return access key views for the user', async () => {
      const views = [makeAccessKeyView()];
      sinon.stub(AccessKeyRepository.prototype, 'listAccessKeysByUserId').resolves(views);

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      const result = await service.listAccessKeys(1);

      expect(result).to.eql(views);
    });
  });

  describe('revokeAccessKey', () => {
    it('should call repository.revokeAccessKey with correct arguments', async () => {
      const stub = sinon.stub(AccessKeyRepository.prototype, 'revokeAccessKey').resolves();

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      await service.revokeAccessKey('aabbccdd-0000-0000-0000-000000000001', 1);

      expect(stub).to.have.been.calledOnceWith('aabbccdd-0000-0000-0000-000000000001', 1);
    });
  });

  describe('verifyAccessKey', () => {
    const buildValidKey = async (): Promise<{ plaintext: string; hash: string; prefix: string }> => {
      const prefix = 'biohub_TestPref';
      const secret = 'supersecretvalue32byteslong12345';
      const plaintext = `${prefix}_${secret}`;
      const hash = await deriveKeyHash(plaintext, prefix);
      return { plaintext, hash, prefix };
    };

    it('should return access_key_id and system_user_id for a valid key', async () => {
      const { plaintext, hash, prefix } = await buildValidKey();

      const record: AccessKey = {
        ...makeAccessKeyView({ key_prefix: prefix }),
        key_hash: hash
      };

      sinon.stub(AccessKeyRepository.prototype, 'getAccessKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      const result = await service.verifyAccessKey(plaintext);

      expect(result.access_key_id).to.equal(record.access_key_id);
      expect(result.system_user_id).to.equal(record.system_user_id);
    });

    it('should throw HTTP401 when the key does not have the biohub_ vendor prefix', async () => {
      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      try {
        await service.verifyAccessKey('wrong_prefix_value');
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when no row is found for the prefix', async () => {
      sinon.stub(AccessKeyRepository.prototype, 'getAccessKeyByPrefix').resolves(null);

      const { plaintext } = await buildValidKey();

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      try {
        await service.verifyAccessKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when the hash does not match', async () => {
      const { plaintext, prefix } = await buildValidKey();
      const wrongHash = await deriveKeyHash('totally_different_key', prefix);

      const record: AccessKey = {
        ...makeAccessKeyView({ key_prefix: prefix }),
        key_hash: wrongHash
      };

      sinon.stub(AccessKeyRepository.prototype, 'getAccessKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      try {
        await service.verifyAccessKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when the key is revoked', async () => {
      const { plaintext, hash, prefix } = await buildValidKey();

      const record: AccessKey = {
        ...makeAccessKeyView({ key_prefix: prefix, revoked_at: '2026-01-01T00:00:00.000Z' }),
        key_hash: hash
      };

      sinon.stub(AccessKeyRepository.prototype, 'getAccessKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      try {
        await service.verifyAccessKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });

    it('should throw HTTP401 when the key is expired', async () => {
      const { plaintext, hash, prefix } = await buildValidKey();

      const record: AccessKey = {
        ...makeAccessKeyView({
          key_prefix: prefix,
          expires_at: '2020-01-01T00:00:00.000Z' // in the past
        }),
        key_hash: hash
      };

      sinon.stub(AccessKeyRepository.prototype, 'getAccessKeyByPrefix').resolves(record);

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      try {
        await service.verifyAccessKey(plaintext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
      }
    });
  });

  describe('touchLastUsedAt', () => {
    it('should call repository.touchLastUsedAt', async () => {
      const stub = sinon.stub(AccessKeyRepository.prototype, 'touchLastUsedAt').resolves();

      const connection = getMockDBConnection();
      const service = new AccessKeyService(connection);

      await service.touchLastUsedAt('aabbccdd-0000-0000-0000-000000000001');

      expect(stub).to.have.been.calledOnceWith('aabbccdd-0000-0000-0000-000000000001');
    });
  });
});
