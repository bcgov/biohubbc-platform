import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { AccessKeyView } from '../models/access-key';
import { AccessKeyRepository, IInsertAccessKeyParams } from './access-key-repository';

chai.use(sinonChai);

const makeAccessKeyView = (overrides: Partial<AccessKeyView> = {}): AccessKeyView => ({
  access_key_id: 'aabbccdd-0000-0000-0000-000000000001',
  system_user_id: 1,
  name: 'My test key',
  key_prefix: 'biohub_AbCdEfGh',
  expires_at: '2027-01-01T00:00:00.000Z',
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

describe('AccessKeyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertAccessKey', () => {
    it('should insert a new access key and return the view record', async () => {
      const view = makeAccessKeyView();
      const mockResponse = { rowCount: 1, rows: [view] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new AccessKeyRepository(mockDBConnection);

      const params: IInsertAccessKeyParams = {
        system_user_id: 1,
        name: 'My test key',
        key_prefix: 'biohub_AbCdEfGh',
        key_hash: 'abc123hashvalue',
        expires_at: '2027-01-01T00:00:00.000Z'
      };

      const result = await repo.insertAccessKey(params);

      expect(result).to.eql(view);
    });
  });

  describe('getAccessKeyByPrefix', () => {
    it('should return the full access key record when found', async () => {
      const row = { ...makeAccessKeyView(), key_hash: 'abc123hashvalue' };
      const mockResponse = { rowCount: 1, rows: [row] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new AccessKeyRepository(mockDBConnection);

      const result = await repo.getAccessKeyByPrefix('biohub_AbCdEfGh');

      expect(result).to.eql(row);
    });

    it('should return null when no active key matches the prefix', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new AccessKeyRepository(mockDBConnection);

      const result = await repo.getAccessKeyByPrefix('biohub_NoMatch11');

      expect(result).to.be.null;
    });
  });

  describe('getAccessKeyById', () => {
    it('should return the access key view when found', async () => {
      const view = makeAccessKeyView();
      const mockResponse = { rowCount: 1, rows: [view] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new AccessKeyRepository(mockDBConnection);

      const result = await repo.getAccessKeyById(view.access_key_id);

      expect(result).to.eql(view);
    });

    it('should return null when no key matches the id', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new AccessKeyRepository(mockDBConnection);

      const result = await repo.getAccessKeyById('nonexistent-uuid');

      expect(result).to.be.null;
    });
  });

  describe('listAccessKeysByUserId', () => {
    it('should return an array of access key views for the user', async () => {
      const rows = [
        makeAccessKeyView(),
        makeAccessKeyView({ access_key_id: 'aabbccdd-0000-0000-0000-000000000002', name: 'Second key' })
      ];
      const mockResponse = { rowCount: 2, rows } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new AccessKeyRepository(mockDBConnection);

      const result = await repo.listAccessKeysByUserId(1);

      expect(result).to.eql(rows);
    });

    it('should return an empty array when the user has no keys', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new AccessKeyRepository(mockDBConnection);

      const result = await repo.listAccessKeysByUserId(99);

      expect(result).to.eql([]);
    });
  });

  describe('revokeAccessKey', () => {
    it('should call sql without throwing', async () => {
      const mockResponse = { rowCount: 1, rows: [] } as unknown as QueryResult<any>;
      const sqlSpy = sinon.stub().resolves(mockResponse);

      const mockDBConnection = getMockDBConnection({ sql: sqlSpy });
      const repo = new AccessKeyRepository(mockDBConnection);

      await repo.revokeAccessKey('aabbccdd-0000-0000-0000-000000000001', 1);

      expect(sqlSpy).to.have.been.calledOnce;
    });
  });

  describe('touchLastUsedAt', () => {
    it('should call sql without throwing', async () => {
      const mockResponse = { rowCount: 1, rows: [] } as unknown as QueryResult<any>;
      const sqlSpy = sinon.stub().resolves(mockResponse);

      const mockDBConnection = getMockDBConnection({ sql: sqlSpy });
      const repo = new AccessKeyRepository(mockDBConnection);

      await repo.touchLastUsedAt('aabbccdd-0000-0000-0000-000000000001');

      expect(sqlSpy).to.have.been.calledOnce;
    });
  });
});
