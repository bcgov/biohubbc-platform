import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { FeatureTypeRepository } from '../repositories/feature-type-repository';
import { FeatureTypeService } from './feature-type-service';

describe('FeatureTypeService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createFeatureType', () => {
    it('stores the name trimmed and lowercased', async () => {
      const service = new FeatureTypeService(getMockDBConnection());
      const created = { feature_type_id: 30, name: 'linework', display_name: 'Linework', description: null };
      const insertStub = sinon.stub(FeatureTypeRepository.prototype, 'insertFeatureType').resolves(created);

      const result = await service.createFeatureType({ name: ' Linework ', display_name: 'Linework' });

      expect(insertStub).to.have.been.calledOnceWith({ name: 'linework', display_name: 'Linework' });
      expect(result).to.equal(created);
    });
  });
});
