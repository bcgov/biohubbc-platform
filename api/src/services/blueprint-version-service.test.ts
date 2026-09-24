import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { Blueprint } from '../models/blueprint';
import { BlueprintVersionService } from './blueprint-version-service';

const blueprint: Blueprint = {
  blueprint_id: 2,
  name: 'Next',
  description: null,
  version_number: 2,
  is_default: false,
  parent_blueprint_id: 1,
  record_effective_date: null,
  record_end_date: null
};

describe('BlueprintVersionService', () => {
  let service: BlueprintVersionService;
  let create: sinon.SinonStub;
  let createVersion: sinon.SinonStub;
  let copyTypes: sinon.SinonStub;
  let copyProperties: sinon.SinonStub;
  let copyTargets: sinon.SinonStub;

  beforeEach(() => {
    service = new BlueprintVersionService(getMockDBConnection());
    create = sinon.stub(service.blueprintService, 'createBlueprint').resolves(blueprint);
    createVersion = sinon.stub(service.blueprintService, 'createBlueprintVersionMetadata').resolves(blueprint);
    copyTypes = sinon.stub(service.blueprintFeatureTypeService, 'copyBlueprintFeatureTypes').resolves();
    copyProperties = sinon
      .stub(service.blueprintFeatureTypePropertyService, 'copyBlueprintFeatureTypeProperties')
      .resolves();
    copyTargets = sinon.stub(service.featureTypePropertyFeatureService, 'copyBlueprintReferenceTargets').resolves();
  });
  afterEach(() => sinon.restore());

  it('creates independent memberships and reference targets after the locked metadata creation', async () => {
    const data = { name: 'Next', parentBlueprintId: 1 };
    expect(await service.createBlueprint(data)).deep.equal(blueprint);
    sinon.assert.calledWithExactly(create, data);
    sinon.assert.callOrder(create, copyTypes, copyProperties, copyTargets);
    for (const copy of [copyTypes, copyProperties, copyTargets]) {
      sinon.assert.calledOnceWithExactly(copy, 1, 2);
    }
  });

  it('leaves composition empty without a parent', async () => {
    await service.createBlueprint({ name: 'Empty' });
    sinon.assert.notCalled(copyTypes);
    sinon.assert.notCalled(copyProperties);
    sinon.assert.notCalled(copyTargets);
  });

  it('uses the same copy workflow for a version after inheriting its metadata', async () => {
    expect(await service.createBlueprintVersion(1, { description: 'Changed' })).deep.equal(blueprint);
    sinon.assert.calledWithExactly(createVersion, 1, { description: 'Changed' });
    sinon.assert.notCalled(create);
    sinon.assert.callOrder(createVersion, copyTypes, copyProperties, copyTargets);
    for (const copy of [copyTypes, copyProperties, copyTargets]) {
      sinon.assert.calledOnceWithExactly(copy, 1, 2);
    }
  });

  it('does not copy assignments if metadata creation rejects a missing source', async () => {
    const failure = new Error('Source not found');
    createVersion.rejects(failure);
    try {
      await service.createBlueprintVersion(99, {});
      expect.fail('Expected missing source');
    } catch (error) {
      expect(error).equal(failure);
    }
    sinon.assert.notCalled(copyTypes);
    sinon.assert.notCalled(copyProperties);
    sinon.assert.notCalled(copyTargets);
  });

  it('propagates copy failures to the endpoint-owned rollback without copying subsequent domains', async () => {
    const failure = new Error('Copy failed');
    copyProperties.rejects(failure);
    try {
      await service.createBlueprint({ name: 'Next', parentBlueprintId: 1 });
      expect.fail('Expected copy failure');
    } catch (error) {
      expect(error).equal(failure);
    }
    sinon.assert.calledOnce(copyTypes);
    sinon.assert.notCalled(copyTargets);
  });
});
