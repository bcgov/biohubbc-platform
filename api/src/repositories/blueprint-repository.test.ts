import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { BlueprintRepository } from './blueprint-repository';

chai.use(sinonChai);

describe('BlueprintRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findActiveBlueprintById', () => {
    it('returns the blueprint_id when the Blueprint is available (record_end_date IS NULL)', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ blueprint_id: 7 }] } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new BlueprintRepository(mockDBConnection);

      const result = await repo.findActiveBlueprintById(7);

      expect(result).to.equal(7);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.contain('FROM');
      expect(sqlText).to.contain('blueprint');
      expect(sqlText).to.contain('record_end_date IS NULL');
      // Availability for a caller-provided id is gated only on record_end_date, not the default flag.
      expect(sqlText).to.not.contain('is_default');
      expect(sqlStub.firstCall.args[0].values).to.include(7);
    });

    it('returns null when the Blueprint is not available', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new BlueprintRepository(mockDBConnection);

      const result = await repo.findActiveBlueprintById(99);

      expect(result).to.equal(null);
    });
  });

  describe('findDefaultBlueprintId', () => {
    it('returns the active default blueprint_id', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ blueprint_id: 1 }] } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new BlueprintRepository(mockDBConnection);

      const result = await repo.findDefaultBlueprintId();

      expect(result).to.equal(1);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.contain('is_default = true');
      expect(sqlText).to.contain('record_end_date IS NULL');
    });

    it('returns null when no active default Blueprint exists', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new BlueprintRepository(mockDBConnection);

      const result = await repo.findDefaultBlueprintId();

      expect(result).to.equal(null);
    });
  });
});
