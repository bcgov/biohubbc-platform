import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CodeRepository, FeatureTypeWithFeaturePropertiesCode } from '../repositories/code-repository';
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

      const mockFeatureTypePropertyCodes: FeatureTypeWithFeaturePropertiesCode[] = [
        {
          feature_type: {
            feature_type_id: 1,
            feature_type_name: 'dataset',
            feature_type_display_name: 'Dataset'
          },
          feature_type_properties: [
            {
              feature_property_id: 1,
              feature_property_name: 'name',
              feature_property_display_name: 'Name',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            }
          ]
        }
      ];

      const getFeatureTypePropertiesStub = sinon
        .stub(CodeService.prototype, 'getFeatureTypePropertyCodes')
        .resolves(mockFeatureTypePropertyCodes);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getAllCodeSets();

      expect(getFeatureTypePropertiesStub).to.have.been.calledOnce;
      expect(result).to.eql({ feature_type_with_properties: mockFeatureTypePropertyCodes });
    });
  });

  describe('getFeatureTypes', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return an array of feature types', async () => {
      const dbConnectionObj = getMockDBConnection();

      const mockFeatureTypeCode = {
        feature_type_id: 1,
        feature_type_name: 'test',
        feature_type_display_name: 'Test'
      };

      const getFeatureTypesStub = sinon
        .stub(CodeRepository.prototype, 'getFeatureTypes')
        .resolves([mockFeatureTypeCode]);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getFeatureTypes();

      expect(getFeatureTypesStub).to.have.been.called.calledOnce;
      expect(result).to.eql([mockFeatureTypeCode]);
    });
  });

  describe('getFeatureTypePropertyCodes', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return id value', async () => {
      const dbConnectionObj = getMockDBConnection();

      const expectedResult: FeatureTypeWithFeaturePropertiesCode[] = [
        {
          feature_type: {
            feature_type_id: 1,
            feature_type_name: 'dataset',
            feature_type_display_name: 'Dataset'
          },
          feature_type_properties: [
            {
              feature_property_id: 1,
              feature_property_name: 'name',
              feature_property_display_name: 'Name',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            },
            {
              feature_property_id: 2,
              feature_property_name: 'age',
              feature_property_display_name: 'Age',
              feature_property_type_id: 2,
              feature_property_type_name: 'number'
            }
          ]
        },
        {
          feature_type: {
            feature_type_id: 2,
            feature_type_name: 'artifact',
            feature_type_display_name: 'Artifact'
          },
          feature_type_properties: [
            {
              feature_property_id: 3,
              feature_property_name: 'filename',
              feature_property_display_name: 'Filename',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            }
          ]
        }
      ];

      const getFeatureTypePropertiesStub = sinon
        .stub(CodeRepository.prototype, 'getFeatureTypePropertyCodes')
        .resolves([
          {
            feature_type_id: 1,
            feature_type_name: 'dataset',
            feature_type_display_name: 'Dataset',
            feature_property_id: 1,
            feature_property_name: 'name',
            feature_property_display_name: 'Name',
            feature_property_type_id: 1,
            feature_property_type_name: 'string'
          },
          {
            feature_type_id: 1,
            feature_type_name: 'dataset',
            feature_type_display_name: 'Dataset',
            feature_property_id: 2,
            feature_property_name: 'age',
            feature_property_display_name: 'Age',
            feature_property_type_id: 2,
            feature_property_type_name: 'number'
          },
          {
            feature_type_id: 2,
            feature_type_name: 'artifact',
            feature_type_display_name: 'Artifact',
            feature_property_id: 3,
            feature_property_name: 'filename',
            feature_property_display_name: 'Filename',
            feature_property_type_id: 1,
            feature_property_type_name: 'string'
          }
        ]);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getFeatureTypePropertyCodes();

      expect(getFeatureTypePropertiesStub).to.have.been.calledOnce;
      expect(result).to.eql(expectedResult);
    });
  });
});
