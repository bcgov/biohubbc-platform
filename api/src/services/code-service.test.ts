import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { FeatureType, FeatureTypeWithProperties, FeatureTypeWithPropertyDefinitions } from '../models/feature-type';
import { BlueprintRepository } from '../repositories/blueprint-repository';
import { CodeRepository } from '../repositories/code-repository';
import { CodeService } from './code-service';

chai.use(sinonChai);

const surveyFeatureType: FeatureType = {
  feature_type_id: 1,
  name: 'survey',
  display_name: 'Survey',
  description: null
};

const defaultBlueprintCodes: FeatureTypeWithProperties[] = [
  {
    feature_type: surveyFeatureType,
    properties: [
      {
        blueprint_feature_type_property_id: 1,
        feature_property_id: 31,
        name: 'name',
        display_name: 'Name',
        description: 'Name',
        type_name: FEATURE_PROPERTY_TYPE.STRING,
        required_value: true,
        calculated_value: false,
        allow_multiple: false
      }
    ]
  }
];

describe('codeService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getAllCodeSets', () => {
    it('returns the default Blueprint configuration as feature_type_with_properties', async () => {
      const dbConnectionObj = getMockDBConnection();

      const forDefaultStub = sinon
        .stub(CodeService.prototype, 'getFeatureTypePropertiesForDefaultBlueprint')
        .resolves(defaultBlueprintCodes);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getAllCodeSets();

      expect(forDefaultStub).to.have.been.calledOnce;
      expect(result).to.eql({
        feature_type_with_properties: defaultBlueprintCodes
      });
    });
  });

  describe('getFeatureTypes', () => {
    it('should return an array of feature types', async () => {
      const dbConnectionObj = getMockDBConnection();

      const getFeatureTypesStub = sinon.stub(CodeRepository.prototype, 'getFeatureTypes').resolves([surveyFeatureType]);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getFeatureTypes();

      expect(getFeatureTypesStub).to.have.been.calledOnce;
      expect(result).to.eql([surveyFeatureType]);
    });
  });

  describe('getFeatureTypePropertiesForDefaultBlueprint', () => {
    it('resolves the default Blueprint and reads its assignments', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(BlueprintRepository.prototype, 'findDefaultBlueprintId').resolves(7);
      const byBlueprintStub = sinon
        .stub(CodeRepository.prototype, 'getFeatureTypePropertiesByBlueprintId')
        .resolves(defaultBlueprintCodes);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getFeatureTypePropertiesForDefaultBlueprint();

      expect(byBlueprintStub).to.have.been.calledOnceWith(7);
      expect(result).to.eql(defaultBlueprintCodes);
    });

    it('returns every feature type with no properties when no default Blueprint exists', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(BlueprintRepository.prototype, 'findDefaultBlueprintId').resolves(null);
      sinon.stub(CodeRepository.prototype, 'getFeatureTypes').resolves([surveyFeatureType]);
      const byBlueprintStub = sinon.stub(CodeRepository.prototype, 'getFeatureTypePropertiesByBlueprintId');

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getFeatureTypePropertiesForDefaultBlueprint();

      expect(byBlueprintStub).to.not.have.been.called;
      expect(result).to.eql([{ feature_type: surveyFeatureType, properties: [] }]);
    });
  });

  describe('getFeatureTypeProperties', () => {
    it('returns the Blueprint-independent property definitions', async () => {
      const dbConnectionObj = getMockDBConnection();

      const expectedResult: FeatureTypeWithPropertyDefinitions[] = [
        {
          feature_type: surveyFeatureType,
          properties: [
            {
              feature_property_id: 31,
              name: 'name',
              display_name: 'Name',
              description: 'Name',
              type_name: FEATURE_PROPERTY_TYPE.STRING,
              calculated_value: false
            },
            {
              feature_property_id: 32,
              name: 'age',
              display_name: 'Age',
              description: 'Age',
              type_name: FEATURE_PROPERTY_TYPE.NUMBER,
              calculated_value: false
            }
          ]
        }
      ];

      const unscopedStub = sinon.stub(CodeRepository.prototype, 'getFeatureTypeProperties').resolves(expectedResult);

      const codeService = new CodeService(dbConnectionObj);

      const result = await codeService.getFeatureTypeProperties();

      expect(unscopedStub).to.have.been.calledOnce;
      expect(result).to.eql(expectedResult);
    });
  });
});
