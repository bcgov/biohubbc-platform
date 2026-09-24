import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { BlueprintRepository } from './blueprint-repository';

chai.use(sinonChai);

describe('BlueprintRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('administrative query values', () => {
    it('returns the database date after acquiring the transaction lock', async () => {
      const sqlStub = sinon.stub().resolves({ rows: [{ current_date: '2026-09-23' }] });
      const repository = new BlueprintRepository(getMockDBConnection({ sql: sqlStub }));

      expect(await repository.lockBlueprintAdministration()).to.equal('2026-09-23');
      sinon.assert.calledOnce(sqlStub);
      expect(sqlStub.firstCall.args[0].text).to.include('pg_advisory_xact_lock');
    });

    it('returns numeric identifiers from the parent lineage', async () => {
      const sqlStub = sinon.stub().resolves({ rows: [{ blueprint_id: 2 }, { blueprint_id: 1 }] });
      const repository = new BlueprintRepository(getMockDBConnection({ sql: sqlStub }));

      expect(await repository.getBlueprintAncestorIds(2)).to.deep.equal([2, 1]);
      sinon.assert.calledOnce(sqlStub);
      expect(sqlStub.firstCall.args[0].values).to.deep.equal([2]);
    });

    it('returns no ancestor identifiers for a missing parent', async () => {
      const sqlStub = sinon.stub().resolves({ rows: [] });
      const repository = new BlueprintRepository(getMockDBConnection({ sql: sqlStub }));

      expect(await repository.getBlueprintAncestorIds(99)).to.deep.equal([]);
    });
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
      expect(sqlText).to.contain('record_effective_date <= now()');
      // Availability for a caller-provided id is gated on record_end_date and record_effective_date,
      // not the default flag.
      expect(sqlText).to.not.contain('is_default');
      expect(sqlStub.firstCall.args[0].values).to.include(7);
    });

    it('returns null when the Blueprint is not available', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new BlueprintRepository(mockDBConnection);

      const result = await repo.findActiveBlueprintById(99);

      expect(result).to.be.null;
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

      expect(result).to.be.null;
    });
  });

  describe('getAdminBlueprint', () => {
    it('returns the active blueprint', async () => {
      const knexStub = sinon.stub().resolves({ rowCount: 1, rows: [{ blueprint_id: 7 }] });
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repo.getAdminBlueprint(7);

      expect(result).to.eql({ blueprint_id: 7 });
      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"record_end_date" is null');
      expect(bindings).to.include(7);
    });

    it('throws ApiNotFoundError when no active blueprint exists for the id', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.getAdminBlueprint(99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('getAdminBlueprints', () => {
    it('returns active blueprints newest version first', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([{ blueprint_id: 2 }, { blueprint_id: 1 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repo.getAdminBlueprints();

      expect(result).to.have.length(2);
      const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"record_end_date" is null');
      expect(sql).to.include('order by "version_number" desc');
    });
  });

  describe('createBlueprintVersionFromBlueprint', () => {
    it('inherits active source metadata into a new non-default draft without writing composition', async () => {
      const queryStub = sinon.stub().resolves(mockKnexResult([{ blueprint_id: 8 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: queryStub }));
      expect(await repo.createBlueprintVersionFromBlueprint(7, { name: 'Next' })).equal(8);
      const query = queryStub.firstCall.args[0].toSQL();
      expect(query.sql).include('record_end_date IS NULL');
      expect(query.sql).include('MAX(version_number)');
      expect(query.sql).include('false, blueprint_id, NULL');
      expect(query.sql).not.include('blueprint_feature_type');
      expect(query.bindings).deep.equal(['Next', null, 7]);
    });

    it('rejects a missing or retired source', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));
      try {
        await repo.createBlueprintVersionFromBlueprint(99, {});
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('publishBlueprint', () => {
    it('publishes only an active draft', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([{}]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      await repo.publishBlueprint(8, true);

      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"record_effective_date" = CURRENT_TIMESTAMP');
      expect(sql).to.include('"record_end_date" is null');
      expect(sql).to.include('"record_effective_date" is null');
      expect(bindings).to.include(true);
      expect(bindings).to.include(8);
    });

    it('throws ApiNotFoundError when the blueprint is not an active draft', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.publishBlueprint(1, false);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('clearDefaultBlueprint', () => {
    it('clears the flag from the active default only', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      await repo.clearDefaultBlueprint();

      const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('update "blueprint" set "is_default" =');
      expect(sql).to.include('"record_end_date" is null');
      expect(sql).to.include('"is_default" =');
    });
  });
});

/**
 * Build a query result carrying the given rows.
 *
 * @param {any[]} rows - Rows the query returns.
 * @return {QueryResult<any>}
 */
function mockKnexResult(rows: any[]): QueryResult<any> {
  return { rowCount: rows.length, rows } as unknown as QueryResult<any>;
}
