import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { FeatureTypeService } from './feature-type-service';

chai.use(sinonChai);

describe('FeatureTypeService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getActiveFeatureTypeIds', () => {
    it('returns the identifiers of the active feature types among those supplied', async () => {
      const service = new FeatureTypeService(getMockDBConnection());
      const repoStub = sinon
        .stub(service.featureTypeRepository, 'getActiveFeatureTypeIds')
        .resolves([{ feature_type_id: 1 }, { feature_type_id: 3 }]);

      expect(await service.getActiveFeatureTypeIds([1, 2, 3])).to.eql([1, 3]);
      expect(repoStub).to.have.been.calledOnceWith([1, 2, 3]);
    });
  });
});
