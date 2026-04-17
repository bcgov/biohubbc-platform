import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { FeatureType, FeatureTypeWithProperties } from '../models/feature-type';
import { CodeRepository } from '../repositories/code-repository';
import { CodeService } from './code-service';

chai.use(sinonChai);

describe('codeService', () => {
  describe('getAllCodeSets', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return id value', async () => {
      const dbConnectionObj = getMockDBConnection();

      const mockFeatureTypePropertyCodes: FeatureTypeWithProperties[] = [
        {
          feature_type: {
            feature_type_id: 1,
            name: 'dataset',
            display_name: 'Dataset'
          },
          properties: [
            {
              feature_type_property_id: 1,
              name: 'name',
              display_name: 'Name',
              description: 'Name',
              type_name: FEATURE_PROPERTY_TYPE.STRING,
              required_value: true,
              calculated_value: false
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
        name: 'test',
        display_name: 'Test'
      };

      const getFeatureTypesStub = sinon
        .stub(CodeRepository.prototype, 'getFeatureTypes')
        .resolves([mockFeatureTypeCode as FeatureType]);

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

      const expectedResult: FeatureTypeWithProperties[] = [
        {
          feature_type: {
            feature_type_id: 1,
            name: 'dataset',
            display_name: 'Dataset'
          },
          properties: [
            {
              feature_type_property_id: 1,
              name: 'name',
              display_name: 'Name',
              description: 'Name',
              type_name: FEATURE_PROPERTY_TYPE.STRING,
              required_value: true,
              calculated_value: false
            },
            {
              feature_type_property_id: 2,
              name: 'age',
              display_name: 'Age',
              description: 'Age',
              type_name: FEATURE_PROPERTY_TYPE.NUMBER,
              required_value: false,
              calculated_value: false
            }
          ]
        },
        {
          feature_type: {
            feature_type_id: 2,
            name: 'artifact',
            display_name: 'Artifact'
          },
          properties: [
            {
              feature_type_property_id: 3,
              name: 'filename',
              display_name: 'Filename',
              description: 'Filename',
              type_name: FEATURE_PROPERTY_TYPE.STRING,
              required_value: true,
              calculated_value: false
            }
          ]
        }
      ];

      const getFeatureTypePropertiesStub = sinon
        .stub(CodeRepository.prototype, 'getFeatureTypePropertyCodes')
        .resolves(expectedResult);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getFeatureTypePropertyCodes();

      expect(getFeatureTypePropertiesStub).to.have.been.calledOnce;
      expect(result).to.eql(expectedResult);
    });
  });
});
