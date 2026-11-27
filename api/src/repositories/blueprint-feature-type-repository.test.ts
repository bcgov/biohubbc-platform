import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { BlueprintFeatureTypePropertyRepository } from './blueprint-feature-type-property-repository';
import { BlueprintFeatureTypeRepository } from './blueprint-feature-type-repository';

chai.use(sinonChai);

describe('BlueprintFeatureTypeRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ensureBlueprintFeatureTypes', () => {
    it('upserts every membership in one statement, keeping existing active memberships', async () => {
      const rows = [{ blueprint_feature_type_id: 10, feature_type_id: 100 }];
      const sqlStub = sinon.stub().resolves(mockQueryResult(rows));
      const repository = new BlueprintFeatureTypeRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.ensureBlueprintFeatureTypes(4, [
        { featureTypeId: 100, sort: 0 },
        { featureTypeId: 101, sort: 1 }
      ]);

      const { text, values } = sqlStub.firstCall.args[0];
      expect(result).to.eql(rows);
      expect(text).to.include('ON CONFLICT (blueprint_id, feature_type_id) WHERE record_end_date IS NULL');
      expect(text).to.include('DO UPDATE SET sort = EXCLUDED.sort');
      expect(values).to.eql([4, [100, 101], [0, 1]]);
    });

    it('writes nothing for no feature types', async () => {
      const sqlStub = sinon.stub();
      const repository = new BlueprintFeatureTypeRepository(getMockDBConnection({ sql: sqlStub }));

      expect(await repository.ensureBlueprintFeatureTypes(4, [])).to.eql([]);
      expect(sqlStub).not.to.have.been.called;
    });
  });

  describe('deleteBlueprintFeatureTypesNotIn', () => {
    it('ends the active memberships of one blueprint whose feature type is not retained', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const repository = new BlueprintFeatureTypeRepository(getMockDBConnection({ sql: sqlStub }));

      await repository.deleteBlueprintFeatureTypesNotIn(4, [100], '2026-10-29');

      const { text, values } = sqlStub.firstCall.args[0];
      expect(text).to.include('WHERE blueprint_id =');
      expect(text).to.include('record_end_date IS NULL');
      expect(text).to.include('NOT (feature_type_id = ANY(');
      expect(values).to.eql(['2026-10-29', 4, [100]]);
    });

    it('scopes an empty retained list to the one blueprint', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const repository = new BlueprintFeatureTypeRepository(getMockDBConnection({ sql: sqlStub }));

      await repository.deleteBlueprintFeatureTypesNotIn(4, [], '2026-10-29');

      expect(sqlStub.firstCall.args[0].values).to.eql(['2026-10-29', 4, []]);
    });
  });
});

describe('BlueprintFeatureTypePropertyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ensureBlueprintFeatureTypeProperties', () => {
    it('upserts every property membership in one statement', async () => {
      const rows = [
        { blueprint_feature_type_property_id: 20, blueprint_feature_type_id: 10, feature_property_id: 200 }
      ];
      const sqlStub = sinon.stub().resolves(mockQueryResult(rows));
      const repository = new BlueprintFeatureTypePropertyRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.ensureBlueprintFeatureTypeProperties([
        { blueprintFeatureTypeId: 10, featurePropertyId: 200, sort: 0 }
      ]);

      const { text, values } = sqlStub.firstCall.args[0];
      expect(result).to.eql(rows);
      expect(text).to.include(
        'ON CONFLICT (blueprint_feature_type_id, feature_property_id) WHERE record_end_date IS NULL'
      );
      expect(values).to.eql([[10], [200], [0]]);
    });

    it('writes nothing for no properties', async () => {
      const sqlStub = sinon.stub();
      const repository = new BlueprintFeatureTypePropertyRepository(getMockDBConnection({ sql: sqlStub }));

      expect(await repository.ensureBlueprintFeatureTypeProperties([])).to.eql([]);
      expect(sqlStub).not.to.have.been.called;
    });
  });

  describe('deleteBlueprintFeatureTypePropertiesNotIn', () => {
    it('ends the active property memberships of one blueprint that are not retained', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const repository = new BlueprintFeatureTypePropertyRepository(getMockDBConnection({ sql: sqlStub }));

      await repository.deleteBlueprintFeatureTypePropertiesNotIn(
        4,
        [{ blueprintFeatureTypeId: 10, featurePropertyId: 200 }],
        '2026-10-29'
      );

      const { text, values } = sqlStub.firstCall.args[0];
      expect(text).to.include('bft.blueprint_id =');
      expect(text).to.include('bftp.record_end_date IS NULL');
      expect(text).to.include('NOT EXISTS');
      expect(values).to.eql(['2026-10-29', 4, [10], [200]]);
    });
  });
});
