import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { FormVersionFeatureTypePropertyRepository } from './form-version-feature-type-property-repository';
import { FormVersionFeatureTypeRepository } from './form-version-feature-type-repository';

chai.use(sinonChai);

describe('FormVersionFeatureTypeRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('reads the active feature types of the version blueprint, defaulting their presentation', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypeRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getFormSections(2);

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"bft"."blueprint_id" = "fv"."blueprint_id"');
    expect(sql).to.include('left join "form_version_feature_type"');
    expect(sql).to.include('COALESCE(c.label, ft.display_name)');
    expect(sql).to.include('"bft"."record_end_date" is null');
    expect(bindings).to.eql([2]);
  });

  it('replaces presentation by deleting it for one version', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypeRepository(getMockDBConnection({ knex: knexStub }));

    await repository.deleteFormSections(2);

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('delete from "form_version_feature_type"');
    expect(bindings).to.eql([2]);
  });

  it('inserts every section in one statement', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypeRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.insertFormSections([
      {
        formVersionId: 2,
        blueprintFeatureTypeId: 10,
        label: 'Observation',
        description: null,
        requiredValue: true,
        allowMultiple: false
      },
      {
        formVersionId: 2,
        blueprintFeatureTypeId: 11,
        label: 'Animal',
        description: 'About',
        requiredValue: false,
        allowMultiple: true
      }
    ]);

    expect(sqlStub).to.have.been.calledOnce;
    expect(sqlStub.firstCall.args[0].text).to.include('unnest');
    expect(sqlStub.firstCall.args[0].values).to.eql([
      [2, 2],
      [10, 11],
      ['Observation', 'Animal'],
      [null, 'About'],
      [true, false],
      [false, true]
    ]);
  });

  it('inserts nothing for no sections', async () => {
    const sqlStub = sinon.stub();
    const repository = new FormVersionFeatureTypeRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.insertFormSections([]);

    expect(sqlStub).not.to.have.been.called;
  });

  it('copies presentation onto a revision by matching feature types between blueprints', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypeRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.copyFormSections(5, 2);

    const { text, values } = sqlStub.firstCall.args[0];
    expect(text).to.include('target_bft.feature_type_id = source_bft.feature_type_id');
    expect(text).to.include('target_bft.record_end_date IS NULL');
    expect(values).to.eql([2, 5]);
  });
});

describe('FormVersionFeatureTypePropertyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('reads the active property assignments of the version blueprint with their codesets', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypePropertyRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getFormFields(2);

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"c"."contributor_codeset_id"');
    expect(sql).to.include('COALESCE(c.label, fp.display_name)');
    expect(sql).to.include('"bftp"."record_end_date" is null');
    expect(sql).to.include('"bft"."record_end_date" is null');
  });

  it('inserts every field, including its codeset, in one statement', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypePropertyRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.insertFormFields([
      {
        formVersionId: 2,
        blueprintFeatureTypePropertyId: 20,
        label: 'Count',
        description: null,
        contributorCodesetId: null
      },
      {
        formVersionId: 2,
        blueprintFeatureTypePropertyId: 21,
        label: 'Sex',
        description: null,
        contributorCodesetId: 50
      }
    ]);

    expect(sqlStub.firstCall.args[0].values).to.eql([
      [2, 2],
      [20, 21],
      ['Count', 'Sex'],
      [null, null],
      [null, 50]
    ]);
  });

  it('inserts nothing for no fields', async () => {
    const sqlStub = sinon.stub();
    const repository = new FormVersionFeatureTypePropertyRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.insertFormFields([]);

    expect(sqlStub).not.to.have.been.called;
  });

  it('deletes the field presentation of one version', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypePropertyRepository(getMockDBConnection({ knex: knexStub }));

    await repository.deleteFormFields(2);

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('delete from "form_version_feature_type_property"');
    expect(bindings).to.eql([2]);
  });

  it('copies field presentation by matching feature type and property between blueprints', async () => {
    const sqlStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionFeatureTypePropertyRepository(getMockDBConnection({ sql: sqlStub }));

    await repository.copyFormFields(5, 2);

    const { text, values } = sqlStub.firstCall.args[0];
    expect(text).to.include('target_bftp.feature_property_id = source_bftp.feature_property_id');
    expect(text).to.include('c.contributor_codeset_id');
    expect(values).to.eql([2, 5]);
  });
});
