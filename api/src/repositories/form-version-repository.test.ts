import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { FormVersion } from '../models/form';
import { FormVersionRepository } from './form-version-repository';

const mockFormVersion: FormVersion = {
  form_version_id: 2,
  form_id: 1,
  blueprint_id: 4,
  version_number: 1,
  record_effective_date: null,
  record_end_date: null
};

describe('FormVersionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('scopes a version read to its form', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormVersion]));
    const repository = new FormVersionRepository(getMockDBConnection({ knex: knexStub }));

    const result = await repository.getFormVersion(1, 2);

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(result).to.eql(mockFormVersion);
    expect(sql).to.include('"form_id" =');
    expect(sql).to.include('"form_version_id" =');
    expect(bindings).to.eql([1, 2]);
  });

  it('reads the active published version: effective and not retired', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormVersionRepository(getMockDBConnection({ knex: knexStub }));

    expect(await repository.getPublishedFormVersion(1)).to.be.undefined;

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"record_effective_date" is not null');
    expect(sql).to.include('"record_end_date" is null');
  });

  it('reads the active draft: not effective and not retired', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormVersion]));
    const repository = new FormVersionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getDraftFormVersion(1);

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"record_effective_date" is null');
    expect(sql).to.include('"record_end_date" is null');
  });

  it('inserts a draft joined to its blueprint with the next version number of its form', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormVersion]));
    const repository = new FormVersionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.insertFormVersion(1, 4);

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('COALESCE(MAX(version_number), 0) + 1');
    expect(bindings).to.include.members([1, 4]);
  });

  it('publishes only an active draft', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
    const repository = new FormVersionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.publishFormVersion(2);

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"record_effective_date" is null');
    expect(sql).to.include('"record_end_date" is null');
  });

  it('throws when there is no active draft to publish', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
    const repository = new FormVersionRepository(getMockDBConnection({ knex: knexStub }));

    try {
      await repository.publishFormVersion(2);
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceof(ApiNotFoundError);
    }
  });

  it('retires only an active published version', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
    const repository = new FormVersionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.retireFormVersion(5);

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"record_effective_date" is not null');
    expect(sql).to.include('"record_end_date" is null');
  });
});
