import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
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
    it('copies the source blueprint into a new draft version in one statement', async () => {
      const sqlStub = sinon.stub().resolves(mockKnexResult([{ blueprint_id: 8 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repo.createBlueprintVersionFromBlueprint(7, { name: 'Next' });

      expect(result).to.equal(8);
      expect(sqlStub).to.have.been.calledOnce;

      const sqlText = sqlStub.firstCall.args[0].text as string;
      const values = sqlStub.firstCall.args[0].values;

      // Only an active source can be copied.
      expect(sqlText).to.match(/source_blueprint AS \([\s\S]*record_end_date IS NULL/);
      expect(values).to.include(7);

      // The new version is an unpublished, non-default child of the source, and never reuses a
      // version number, including one issued to a retired blueprint.
      expect(sqlText).to.include('parent_blueprint_id');
      expect(sqlText).to.include('(SELECT COALESCE(MAX(version_number), 0) + 1 FROM blueprint)');
      expect(sqlText).to.match(/false,\s+sb\.blueprint_id,\s+NULL/);

      // Omitted overrides inherit from the source.
      expect(sqlText).to.include('sb.name)');
      expect(sqlText).to.include('sb.description)');
      expect(values).to.include('Next');
      expect(values).to.include(null);

      // Feature types and assignments are inserted as new rows, active ones only.
      expect(sqlText).to.include('INSERT INTO blueprint_feature_type (');
      expect(sqlText).to.include('INSERT INTO blueprint_feature_type_property (');
      expect(sqlText).to.include('source_bft.record_end_date IS NULL');
      expect(sqlText).to.include('source_bftp.record_end_date IS NULL');

      // New feature types are mapped back to the source rows by feature type.
      expect(sqlText).to.include('source_bft.feature_type_id = new_bft.feature_type_id');

      // The owned property and its configuration are carried onto the copy; the assignment identifier is
      // never copied, so the new rows receive their own.
      expect(sqlText).to.include('source_bftp.feature_property_id');
      expect(sqlText).to.match(
        /INSERT INTO blueprint_feature_type_property \(\s*blueprint_feature_type_id,\s*feature_property_id,\s*required_value,\s*allow_multiple,\s*sort\s*\)/
      );

      // Allowed reference targets follow their assignment onto the copy.
      expect(sqlText).to.include('INSERT INTO feature_type_property_feature (');
      expect(sqlText).to.include(
        'ftpf.blueprint_feature_type_property_id = source_bftp.blueprint_feature_type_property_id'
      );
    });

    it('throws ApiNotFoundError when no active source blueprint exists', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ sql: async () => mockKnexResult([]) }));

      try {
        await repo.createBlueprintVersionFromBlueprint(99, {});
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
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

  describe('blueprint feature types', () => {
    it('findActiveBlueprintFeatureType returns null when the feature type is not included', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      expect(await repo.findActiveBlueprintFeatureType(7, 10)).to.be.null;
    });

    it('insertBlueprintFeatureType returns the new id', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([{ blueprint_feature_type_id: 5 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repo.insertBlueprintFeatureType({ blueprint_id: 7, feature_type_id: 10 });

      expect(result).to.equal(5);
    });

    it('insertBlueprintFeatureType throws ApiExecuteSQLError when no row is inserted', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.insertBlueprintFeatureType({ blueprint_id: 7, feature_type_id: 10 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('getAdminBlueprintFeatureType scopes the lookup to the parent blueprint', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([{ blueprint_feature_type_id: 5 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      await repo.getAdminBlueprintFeatureType(5, 7);

      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"bft"."record_end_date" is null');
      expect(sql).to.include('"bft"."blueprint_feature_type_id" =');
      expect(sql).to.include('"bft"."blueprint_id" =');
      expect(bindings).to.eql([5, 7]);
    });

    it('getAdminBlueprintFeatureType throws ApiNotFoundError outside the parent blueprint', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.getAdminBlueprintFeatureType(5, 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('updateBlueprintFeatureType throws ApiNotFoundError when scoped update affects no rows', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.updateBlueprintFeatureType(5, 99, { sort: 1 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('deleteBlueprintFeatureType soft deletes and throws ApiNotFoundError when no row is affected', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repo.deleteBlueprintFeatureType(5, 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('update "blueprint_feature_type" set "record_end_date" = CURRENT_TIMESTAMP');
    });
  });

  describe('blueprint feature type properties', () => {
    it('findActiveBlueprintFeatureTypeProperty matches on the owned feature property', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([{ blueprint_feature_type_property_id: 3 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repo.findActiveBlueprintFeatureTypeProperty(5, 20);

      expect(result).to.eql({ blueprint_feature_type_property_id: 3 });
      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"record_end_date" is null');
      expect(sql).to.include('"feature_property_id" =');
      expect(bindings).to.include.members([5, 20]);
    });

    it('insertBlueprintFeatureTypeProperty stores the assignment and defaults the flags', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([{ blueprint_feature_type_property_id: 3 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repo.insertBlueprintFeatureTypeProperty({
        blueprint_feature_type_id: 5,
        feature_property_id: 20
      });

      expect(result).to.equal(3);
      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"feature_property_id"');
      expect(bindings).to.include.members([5, 20, false]);
    });

    it('getAdminBlueprintFeatureTypeProperty joins the property through the owned reference', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([{ blueprint_feature_type_property_id: 3 }]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      await repo.getAdminBlueprintFeatureTypeProperty(3, 5);

      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"fp"."feature_property_id" = "bftp"."feature_property_id"');
      expect(sql).to.not.include('"feature_type_property" as');
      expect(sql).to.include('"bftp"."blueprint_feature_type_id" =');
      expect(bindings).to.eql([3, 5]);
    });

    it('getAdminBlueprintFeatureTypeProperty throws ApiNotFoundError outside the parent feature type', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.getAdminBlueprintFeatureTypeProperty(3, 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('getAdminBlueprintFeatureTypePropertiesCount returns the count', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([{ count: 12 }]) }));

      expect(await repo.getAdminBlueprintFeatureTypePropertiesCount(5)).to.equal(12);
    });

    it('updateBlueprintFeatureTypeProperty throws ApiNotFoundError when scoped update affects no rows', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.updateBlueprintFeatureTypeProperty(3, 99, { required_value: true });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('deleteBlueprintFeatureTypeProperty throws ApiNotFoundError when scoped delete affects no rows', async () => {
      const repo = new BlueprintRepository(getMockDBConnection({ knex: async () => mockKnexResult([]) }));

      try {
        await repo.deleteBlueprintFeatureTypeProperty(3, 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId retires only active assignments', async () => {
      const knexStub = sinon.stub().resolves(mockKnexResult([]));
      const repo = new BlueprintRepository(getMockDBConnection({ knex: knexStub }));

      await repo.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(5);

      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('update "blueprint_feature_type_property" set "record_end_date" = CURRENT_TIMESTAMP');
      expect(sql).to.include('"record_end_date" is null');
      expect(bindings).to.eql([5]);
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
