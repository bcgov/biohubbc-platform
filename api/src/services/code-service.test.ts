import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CodeRepository, IAllCodeSets } from '../repositories/code-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { CodeService } from './code-service';

chai.use(sinonChai);

describe('codeService', () => {
  describe('getAllCodeSets', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return id value', async () => {
      const dbConnectionObj = getMockDBConnection();
      const codeService = new CodeService(dbConnectionObj);

      const data = {
        feature_type: { id: 1, name: 'test' },
        feature_type_properties: [{ id: 1, name: 'test', display_name: 'display', type: 'type' }]
      } as unknown as IAllCodeSets['feature_type_with_properties'];

      const getFeatureTypePropertiesStub = sinon.stub(CodeService.prototype, 'getFeatureTypeProperties').resolves(data);

      const result = await codeService.getAllCodeSets();

      expect(result).to.eql({ feature_type_with_properties: data });
      expect(getFeatureTypePropertiesStub).to.have.been.calledOnce;
    });
  });

  describe('getFeatureTypeProperties', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return id value', async () => {
      const dbConnectionObj = getMockDBConnection();
      const codeService = new CodeService(dbConnectionObj);

      const returnData = {
        feature_type: { id: 1, name: 'test' },
        feature_type_properties: [{ id: 1, name: 'test', display_name: 'display', type: 'type' }]
      } as unknown as IAllCodeSets['feature_type_with_properties'];

      const getFeatureTypesStub = sinon
        .stub(CodeRepository.prototype, 'getFeatureTypes')
        .resolves([{ id: 1, name: 'test' }]);

      const getFeatureTypePropertiesStub = sinon
        .stub(CodeRepository.prototype, 'getFeatureTypeProperties')
        .resolves([{ id: 1, name: 'test', display_name: 'display', type: 'type' }]);

      const result = await codeService.getFeatureTypeProperties();

      expect(result).to.eql([returnData]);
      expect(getFeatureTypePropertiesStub).to.have.been.calledOnce;
      expect(getFeatureTypesStub).to.have.been.calledOnce;
    });
  });
});
