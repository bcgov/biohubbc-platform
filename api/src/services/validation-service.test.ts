import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDatasetSubmission } from '../repositories/submission-repository';
import { IInsertStyleSchema, IStyleModel, ValidationRepository } from '../repositories/validation-repository';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import * as validatorParser from '../utils/media/validation/validation-schema-parser';
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

  describe('validateDWCArchiveWithStyleSchema', () => {
    it('should return a false validation with error array', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      sinon
        .stub(validatorParser, 'ValidationSchemaParser')
        .returns({} as unknown as validatorParser.ValidationSchemaParser);

      const mockMediaState = { fileName: 'string', fileErrors: ['error'], isValid: false };

      const mockDWC = {
        isMediaValid: () => {
          return mockMediaState;
        }
      };

      const response = await validationService.validateDWCArchiveWithStyleSchema(
        mockDWC as unknown as DWCArchive,
        {} as unknown as IStyleModel
      );

      expect(response.validation).to.eql(false);
      expect(response.mediaState.isValid).to.eql(false);
      expect(response.mediaState.fileErrors).to.eql(['error']);
    });

    it('should return a true validation with csvState', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new ValidationService(mockDBConnection);

      sinon
        .stub(validatorParser, 'ValidationSchemaParser')
        .returns({} as unknown as validatorParser.ValidationSchemaParser);

      const mockMediaState = { fileName: 'string', fileErrors: [], isValid: true };
      const mockCsvState = [{ headerErrors: [], rowErrors: [] }];

      const mockDWC = {
        isMediaValid: () => {
          return mockMediaState;
        },
        isContentValid: () => {
          return mockCsvState;
        }
      };

      const response = await validationService.validateDWCArchiveWithStyleSchema(
        mockDWC as unknown as DWCArchive,
        {} as unknown as IStyleModel
      );

      expect(response.validation).to.eql(true);
      expect(response.mediaState.isValid).to.eql(true);
      expect(response.mediaState.fileErrors).to.eql([]);
      if (response.csvState) {
        expect(response.csvState[0].headerErrors).to.eql([]);
        expect(response.csvState[0].rowErrors).to.eql([]);
      }
    });
  });

  describe('validateDatasetSubmission', () => {
    it('should return false if the dataset is invalid', async () => {
      const mockDBConnection = getMockDBConnection();

      const getFeatureValidationPropertiesSpy = sinon.spy(
        ValidationService.prototype,
        'getFeatureValidationProperties'
      );

      const validatePropertiesStub = sinon.stub(ValidationService.prototype, 'validateProperties').returns(true);

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
      const mockObservationProperties2 = {
        count: 22,
        sex: 'female',
        geometry: {
          type: 'Feature'
          // Invalid geometry
        }
      };
      const mockDataset: IDatasetSubmission = {
        id: '123',
        type: 'dataset',
        properties: mockDatasetProperties,
        features: [
          { id: '1', type: 'observation', properties: mockObservationProperties1 },
          { id: '2', type: 'observation', properties: mockObservationProperties2 }
        ]
      };

      const validationService = new ValidationService(mockDBConnection);

      const mockDatasetValidationProperties = [
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
      ];
      const mockObservationValidationProperties = [
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'sex', display_name: '', description: '', type: 'string' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' }
      ];
      // Set cache for dataset type
      validationService.validationPropertiesCache.set('dataset', mockDatasetValidationProperties);
      // Set cache for observation type
      validationService.validationPropertiesCache.set('observation', mockObservationValidationProperties);

      const response = await validationService.validateDatasetSubmission(mockDataset);

      expect(response).to.be.true;
      expect(getFeatureValidationPropertiesSpy).to.have.been.calledWith('dataset');
      expect(getFeatureValidationPropertiesSpy).to.have.been.calledWith('observation');
      expect(validatePropertiesStub).to.have.been.calledWith(mockDatasetValidationProperties, mockDatasetProperties);
      expect(validatePropertiesStub).to.have.been.calledWith(
        mockObservationValidationProperties,
        mockObservationProperties1
      );
      expect(validatePropertiesStub).to.have.been.calledWith(
        mockObservationValidationProperties,
        mockObservationProperties2
      );
    });

    it('should return true if the dataset is valid', async () => {
      const mockDBConnection = getMockDBConnection();

      const getFeatureValidationPropertiesSpy = sinon.spy(
        ValidationService.prototype,
        'getFeatureValidationProperties'
      );

      const validatePropertiesStub = sinon.stub(ValidationService.prototype, 'validateProperties').returns(true);

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
      const mockDataset: IDatasetSubmission = {
        id: '123',
        type: 'dataset',
        properties: mockDatasetProperties,
        features: [
          { id: '1', type: 'observation', properties: mockObservationProperties1 },
          { id: '2', type: 'observation', properties: mockObservationProperties2 }
        ]
      };

      const validationService = new ValidationService(mockDBConnection);

      const mockDatasetValidationProperties = [
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
      ];
      const mockObservationValidationProperties = [
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'sex', display_name: '', description: '', type: 'string' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' }
      ];
      // Set cache for dataset type
      validationService.validationPropertiesCache.set('dataset', mockDatasetValidationProperties);
      // Set cache for observation type
      validationService.validationPropertiesCache.set('observation', mockObservationValidationProperties);

      const response = await validationService.validateDatasetSubmission(mockDataset);

      expect(response).to.be.true;
      expect(getFeatureValidationPropertiesSpy).to.have.been.calledWith('dataset');
      expect(getFeatureValidationPropertiesSpy).to.have.been.calledWith('observation');
      expect(validatePropertiesStub).to.have.been.calledWith(mockDatasetValidationProperties, mockDatasetProperties);
      expect(validatePropertiesStub).to.have.been.calledWith(
        mockObservationValidationProperties,
        mockObservationProperties1
      );
      expect(validatePropertiesStub).to.have.been.calledWith(
        mockObservationValidationProperties,
        mockObservationProperties2
      );
    });
  });

  describe('validateProperties', () => {
    it('should throw an error if data properties are missing', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        expect((error as Error).message).to.equal('Property start_date not found in data');
      }
    });

    it('should throw an error if a string property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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

    it('should throw an error if a spatial property is the wrong type', () => {
      const mockDBConnection = getMockDBConnection();

      const properties = [
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        { name: 'name', display_name: '', description: '', type: 'string' },
        { name: 'count', display_name: '', description: '', type: 'number' },
        { name: 'published', display_name: '', description: '', type: 'boolean' },
        { name: 'permit', display_name: '', description: '', type: 'object' },
        { name: 'geometry', display_name: '', description: '', type: 'spatial' },
        { name: 'start_date', display_name: '', description: '', type: 'datetime' }
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
        { name: 'name', display_name: 'Name', description: '', type: 'string' },
        { name: 'description', display_name: 'Description', description: '', type: 'string' }
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
        { name: 'name', display_name: 'Name', description: '', type: 'string' },
        { name: 'description', display_name: 'Description', description: '', type: 'string' }
      ];

      const getFeatureValidationPropertiesStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureValidationProperties')
        .resolves(mockValidationProperties);

      const featureType = 'dataset';

      const validationService = new ValidationService(mockDBConnection);

      // Set cache for non-matching type
      validationService.validationPropertiesCache.set('observation', [
        { name: 'count', display_name: 'Count', description: '', type: 'number' }
      ]);

      const properties = await validationService.getFeatureValidationProperties(featureType);

      expect(getFeatureValidationPropertiesStub).to.have.been.calledOnceWith(featureType);
      expect(properties).to.eql(mockValidationProperties);
    });

    it('should return cached properties when matching feature type is cached', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockValidationProperties = [
        { name: 'name', display_name: 'Name', description: '', type: 'string' },
        { name: 'description', display_name: 'Description', description: '', type: 'string' }
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
