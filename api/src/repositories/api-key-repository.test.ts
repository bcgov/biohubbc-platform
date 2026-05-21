import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiKeyView } from '../models/api-key';
import { ApiKeyRepository, IInsertApiKeyParams } from './api-key-repository';

chai.use(sinonChai);

const makeApiKeyView = (overrides: Partial<ApiKeyView> = {}): ApiKeyView => ({
  api_key_id: 'aabbccdd-0000-0000-0000-000000000001',
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

describe('ApiKeyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertApiKey', () => {
    it('should insert a new API key and return the view record', async () => {
      const view = makeApiKeyView();
      const mockResponse = { rowCount: 1, rows: [view] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new ApiKeyRepository(mockDBConnection);

      const params: IInsertApiKeyParams = {
        system_user_id: 1,
        name: 'My test key',
        key_prefix: 'biohub_AbCdEfGh',
        key_hash: 'abc123hashvalue',
        expires_at: '2027-01-01T00:00:00.000Z'
      };

      const result = await repo.insertApiKey(params);

      expect(result).to.eql(view);
    });
  });

  describe('getApiKeyByPrefix', () => {
    it('should return the full API key record when found', async () => {
      const row = { ...makeApiKeyView(), key_hash: 'abc123hashvalue' };
      const mockResponse = { rowCount: 1, rows: [row] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new ApiKeyRepository(mockDBConnection);

      const result = await repo.getApiKeyByPrefix('biohub_AbCdEfGh');

      expect(result).to.eql(row);
    });

    it('should return null when no active key matches the prefix', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new ApiKeyRepository(mockDBConnection);

      const result = await repo.getApiKeyByPrefix('biohub_NoMatch11');

      expect(result).to.be.null;
    });
  });

  describe('getApiKeyById', () => {
    it('should return the API key view when found', async () => {
      const view = makeApiKeyView();
      const mockResponse = { rowCount: 1, rows: [view] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new ApiKeyRepository(mockDBConnection);

      const result = await repo.getApiKeyById(view.api_key_id);

      expect(result).to.eql(view);
    });

    it('should return null when no key matches the id', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new ApiKeyRepository(mockDBConnection);

      const result = await repo.getApiKeyById('nonexistent-uuid');

      expect(result).to.be.null;
    });
  });

  describe('listApiKeysByUserId', () => {
    it('should return an array of API key views for the user', async () => {
      const rows = [
        makeApiKeyView(),
        makeApiKeyView({ api_key_id: 'aabbccdd-0000-0000-0000-000000000002', name: 'Second key' })
      ];
      const mockResponse = { rowCount: 2, rows } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new ApiKeyRepository(mockDBConnection);

      const result = await repo.listApiKeysByUserId(1);

      expect(result).to.eql(rows);
    });

    it('should return an empty array when the user has no keys', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });
      const repo = new ApiKeyRepository(mockDBConnection);

      const result = await repo.listApiKeysByUserId(99);

      expect(result).to.eql([]);
    });
  });

  describe('revokeApiKey', () => {
    it('should call sql without throwing', async () => {
      const mockResponse = { rowCount: 1, rows: [] } as unknown as QueryResult<any>;
      const sqlSpy = sinon.stub().resolves(mockResponse);

      const mockDBConnection = getMockDBConnection({ sql: sqlSpy });
      const repo = new ApiKeyRepository(mockDBConnection);

      await repo.revokeApiKey('aabbccdd-0000-0000-0000-000000000001', 1);

      expect(sqlSpy).to.have.been.calledOnce;
    });
  });

  describe('deleteApiKey', () => {
    it('should call sql without throwing', async () => {
      const mockResponse = { rowCount: 1, rows: [] } as unknown as QueryResult<any>;
      const sqlSpy = sinon.stub().resolves(mockResponse);

      const mockDBConnection = getMockDBConnection({ sql: sqlSpy });
      const repo = new ApiKeyRepository(mockDBConnection);

      await repo.deleteApiKey('aabbccdd-0000-0000-0000-000000000001', 1);

      expect(sqlSpy).to.have.been.calledOnce;
    });
  });

  describe('touchLastUsedAt', () => {
    it('should call sql without throwing', async () => {
      const mockResponse = { rowCount: 1, rows: [] } as unknown as QueryResult<any>;
      const sqlSpy = sinon.stub().resolves(mockResponse);

      const mockDBConnection = getMockDBConnection({ sql: sqlSpy });
      const repo = new ApiKeyRepository(mockDBConnection);

      await repo.touchLastUsedAt('aabbccdd-0000-0000-0000-000000000001');

      expect(sqlSpy).to.have.been.calledOnce;
    });
  });
});
