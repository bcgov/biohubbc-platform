import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ISubmissionFeature } from '../repositories/submission-repository';
import {
  FeatureProperties,
  IInsertStyleSchema,
  IStyleModel,
  ValidationRepository
} from '../repositories/validation-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ValidationService } from './validation-service';

chai.use(sinonChai);

describe('ValidationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertStyleSchema', () => {
    it('should return style_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      const repo = sinon.stub(ValidationRepository.prototype, 'insertStyleSchema').resolves({ style_id: 1 });

      const response = await validationService.insertStyleSchema({} as unknown as IInsertStyleSchema);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ style_id: 1 });
    });
  });

  describe('getStyleSchemaByStyleId', () => {
    it('should return style row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      const repo = sinon
        .stub(ValidationRepository.prototype, 'getStyleSchemaByStyleId')
        .resolves({ style_id: 1 } as unknown as IStyleModel);

      const response = await validationService.getStyleSchemaByStyleId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ style_id: 1 });
    });
  });

  describe('validateSubmissionFeatures', () => {
    it('should return false if the dataset is invalid', async () => {
      const mockDBConnection = getMockDBConnection();

      const validateSubmissionFeatureStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeature')
        .throws(new Error('validation error'));

      const mockDatasetProperties = {
        name: 'dataset name',
        start_date: '2023-12-22'
      };

      const mockObservationProperties1 = {
        count: 11,
        sex: 'male',
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        }
      };
      const mockObservationSubmissionFeature1 = {
        id: '1',
        type: 'observation',
        properties: mockObservationProperties1,
        child_features: []
      };

      const mockObservationProperties2 = {
        count: 22,
        sex: 'female',
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        }
      };
      const mockObservationSubmissionFeature2 = {
        id: '2',
        type: 'observation',
        properties: mockObservationProperties2,
        child_features: []
      };

      const mockDatasetSubmissionFeature = {
        id: '123',
        type: 'dataset',
        properties: mockDatasetProperties,
        child_features: [mockObservationSubmissionFeature1, mockObservationSubmissionFeature2]
      };

      const mockSubmissionFeatures: ISubmissionFeature[] = [mockDatasetSubmissionFeature];

      const validationService = new ValidationService(mockDBConnection);

      const response = await validationService.validateSubmissionFeatures(mockSubmissionFeatures);

      expect(validateSubmissionFeatureStub).to.have.been.calledWith(mockDatasetSubmissionFeature);
      expect(response).to.be.false;
    });

    it('should return true if the dataset is valid', async () => {
      const mockDBConnection = getMockDBConnection();

      const validateSubmissionFeatureStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeature')
        .resolves(true);

      const mockDatasetProperties = {
        name: 'dataset name',
        start_date: '2023-12-22'
      };

      const mockObservationProperties1 = {
        count: 11,
        sex: 'male',
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        }
      };
      const mockObservationSubmissionFeature1 = {
        id: '1',
        type: 'observation',
        properties: mockObservationProperties1,
        child_features: []
      };

      const mockObservationProperties2 = {
        count: 22,
        sex: 'female',
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        }
      };
      const mockObservationSubmissionFeature2 = {
        id: '2',
        type: 'observation',
        properties: mockObservationProperties2,
        child_features: []
      };

      const mockDatasetSubmissionFeature = {
        id: '123',
        type: 'dataset',
        properties: mockDatasetProperties,
        child_features: [mockObservationSubmissionFeature1, mockObservationSubmissionFeature2]
      };

      const mockSubmissionFeatures: ISubmissionFeature[] = [mockDatasetSubmissionFeature];

      const validationService = new ValidationService(mockDBConnection);

      const response = await validationService.validateSubmissionFeatures(mockSubmissionFeatures);

      expect(validateSubmissionFeatureStub).to.have.been.calledWith(mockDatasetSubmissionFeature);
      expect(validateSubmissionFeatureStub).to.have.been.calledWith(mockObservationSubmissionFeature1);
      expect(validateSubmissionFeatureStub).to.have.been.calledWith(mockObservationSubmissionFeature2);
      expect(response).to.be.true;
    });
  });

  describe('validateSubmissionFeature', () => {
    it('fetches validation properties and calls validate', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockFeatureProperties: FeatureProperties[] = [
        {
          name: 'field1',
          display_name: 'Field 1',
          description: 'A Field 1',
          type_name: 'string',
          required_value: true
        }
      ];

      const getFeatureValidationPropertiesStub = sinon
        .stub(ValidationService.prototype, 'getFeatureValidationProperties')
        .resolves(mockFeatureProperties);

      const validatePropertiesStub = sinon.stub(ValidationService.prototype, 'validateProperties').returns(true);

      const mockSubmissionProperties = {};
      const mockSubmissionFeature = {
        id: '1',
        type: 'feature type',
        properties: mockSubmissionProperties,
        child_features: [
          { id: '2', type: 'child feature type', properties: {}, child_features: [] },
          { id: '3', type: 'child feature type', properties: {}, child_features: [] }
        ]
      };

      const validationService = new ValidationService(mockDBConnection);

      const result = await validationService.validateSubmissionFeature(mockSubmissionFeature);

      expect(result).to.be.true;
      expect(getFeatureValidationPropertiesStub).to.have.been.calledOnceWith('feature type');
      expect(validatePropertiesStub).to.have.been.calledOnceWith(mockFeatureProperties, mockSubmissionProperties);
    });
  });

  describe('validateProperties', () => {
    it('should throw an error if data properties are missing', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: true,
        permit: {},
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        }
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property start_date is required but is null or undefined');
      }
    });

    it('should throw an error if a string property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 123456,
        count: 1,
        published: true,
        permit: {},
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: '2023-11-22'
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property name is not of type string');
      }
    });

    it('should throw an error if a number property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 'one',
        published: true,
        permit: {},
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: '2023-11-22'
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property count is not of type number');
      }
    });

    it('should throw an error if a boolean property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: 'true',
        permit: {},
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: '2023-11-22'
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property published is not of type boolean');
      }
    });

    it('should throw an error if a object property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: true,
        permit: [],
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: '2023-11-22'
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property permit is not of type object');
      }
    });

    it('should throw an error if an array property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'tags', display_name: '', description: '', type_name: 'array', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: true,
        tags: 'not an array',
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: '2023-11-22'
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property tags is not of type array');
      }
    });

    it('should validate arrays correctly and accept valid arrays', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'tags', display_name: '', description: '', type_name: 'array', required_value: true }
      ];

      const dataProperties = {
        tags: ['tag1', 'tag2', 'tag3']
      };

      const validationService = new ValidationService(mockDBConnection);

      const response = validationService.validateProperties(properties, dataProperties);

      expect(response).to.be.true;
    });

    it('should throw an error if a spatial property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: true,
        permit: {},
        geometry: 'geometry',
        start_date: '2023-11-22'
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property geometry is not of type spatial');
      }
    });

    it('should throw an error if a datetime property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: true,
        permit: {},
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: {}
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property start_date is not of type datetime');
      }
    });

    it('should throw an error if a datetime property is not a valid date', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: true,
        permit: {},
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: 'not a valid date'
      };

      const validationService = new ValidationService(mockDBConnection);

      try {
        validationService.validateProperties(properties, dataProperties);
      } catch (error) {
        expect((error as Error).message).to.equal('Property start_date is not a valid date');
      }
    });

    it('should return true if the data properties are valid', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type_name: 'string', required_value: true },
        { name: 'count', display_name: '', description: '', type_name: 'number', required_value: true },
        { name: 'published', display_name: '', description: '', type_name: 'boolean', required_value: true },
        { name: 'permit', display_name: '', description: '', type_name: 'object', required_value: true },
        { name: 'tags', display_name: '', description: '', type_name: 'array', required_value: true },
        { name: 'geometry', display_name: '', description: '', type_name: 'spatial', required_value: true },
        { name: 'start_date', display_name: '', description: '', type_name: 'datetime', required_value: true }
      ];

      const dataProperties = {
        name: 'project name',
        count: 1,
        published: true,
        permit: {},
        tags: ['tag1', 'tag2'],
        geometry: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: [-125.44339737241725, 49.36887682703687],
                type: 'Point'
              }
            }
          ]
        },
        start_date: '2023-11-22'
      };

      const validationService = new ValidationService(mockDBConnection);

      const response = validationService.validateProperties(properties, dataProperties);

      expect(response).to.be.true;
    });
  });

  describe('getFeatureValidationProperties', () => {
    it('should fetch properties when cache is empty', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockValidationProperties = [
        { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
        { name: 'description', display_name: 'Description', description: '', type_name: 'string', required_value: true }
      ];

      const getFeatureValidationPropertiesStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureValidationProperties')
        .resolves(mockValidationProperties);

      const featureType = 'dataset';

      const validationService = new ValidationService(mockDBConnection);

      const properties = await validationService.getFeatureValidationProperties(featureType);

      expect(getFeatureValidationPropertiesStub).to.have.been.calledOnceWith(featureType);
      expect(properties).to.eql(mockValidationProperties);
    });

    it('should fetch properties when no matching feature type is cached', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockValidationProperties = [
        { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
        { name: 'description', display_name: 'Description', description: '', type_name: 'string', required_value: true }
      ];

      const getFeatureValidationPropertiesStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureValidationProperties')
        .resolves(mockValidationProperties);

      const featureType = 'dataset';

      const validationService = new ValidationService(mockDBConnection);

      // Set cache for non-matching type
      validationService.validationPropertiesCache.set('observation', [
        { name: 'count', display_name: 'Count', description: '', type_name: 'number', required_value: true }
      ]);

      const properties = await validationService.getFeatureValidationProperties(featureType);

      expect(getFeatureValidationPropertiesStub).to.have.been.calledOnceWith(featureType);
      expect(properties).to.eql(mockValidationProperties);
    });

    it('should return cached properties when matching feature type is cached', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockValidationProperties = [
        { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
        { name: 'description', display_name: 'Description', description: '', type_name: 'string', required_value: true }
      ];

      const getFeatureValidationPropertiesStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureValidationProperties')
        .rejects(new Error('test error'));

      const featureType = 'dataset';

      const validationService = new ValidationService(mockDBConnection);

      // Set cache
      validationService.validationPropertiesCache.set(featureType, mockValidationProperties);

      const properties = await validationService.getFeatureValidationProperties(featureType);

      expect(getFeatureValidationPropertiesStub).not.to.have.been.called;
      expect(properties).to.eql(mockValidationProperties);
    });
  });
});
