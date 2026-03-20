import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { FeatureProperty, FeatureTypeWithProperties } from '../../models/feature-type';
import { IFlattenedBlock } from '../../models/submission-feature';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { FeatureValidationService } from './feature-validation-service';
import { IValidationError, ValidationErrorType } from './feature-validation-service.interface';

chai.use(sinonChai);

describe('FeatureValidationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('validateFlatSubmissionFeatures', () => {
    // Valid feature for reuse in tests (matches real dataset schema)
    const createValidFeature = (overrides: Partial<IFlattenedBlock> = {}): IFlattenedBlock => ({
      id: '14ebb420-4cfa-4be1-99db-8122253e3106',
      type: 'dataset',
      properties: {
        name: 'Test Dataset',
        focal_species: [{ taxon_id: 1234 }],
        start_date: '2024-01-01T00:00:00Z'
      },
      content: [],
      parent: null,
      ...overrides
    });

    // Mock matches real dataset schema from database migration
    const mockFeatureTypeWithProperties: FeatureTypeWithProperties = {
      featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
      properties: [
        {
          name: 'name',
          display_name: 'Name',
          description: '',
          feature_type_property_id: 1,
      type_name: 'string',
          required_value: true,
          calculated_value: false
        },
        {
          name: 'focal_species',
          display_name: 'Focal Species',
          description: '',
          feature_type_property_id: 1,
      type_name: 'array',
          required_value: true,
          calculated_value: false
        },
        {
          name: 'start_date',
          display_name: 'Start Date',
          description: '',
          feature_type_property_id: 1,
      type_name: 'datetime',
          required_value: true,
          calculated_value: false
        },
        {
          name: 'description',
          display_name: 'Description',
          description: '',
          feature_type_property_id: 1,
      type_name: 'string',
          required_value: false,
          calculated_value: false
        }
      ]
    };

    it('returns valid=true for valid submission', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const features: IFlattenedBlock[] = [createValidFeature()];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.true;
      expect(result.errors).to.have.length(0);
    });

    it('returns valid=true for submission with parent-child relationship', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const parentId = '14ebb420-4cfa-4be1-99db-8122253e3106';
      const childId = '93541206-647a-4a00-81be-493e730ef86b';

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: parentId, content: [childId] }),
        createValidFeature({ id: childId, parent: parentId, content: [] })
      ];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.true;
      expect(result.errors).to.have.length(0);
    });

    it('returns DUPLICATE_ID error when duplicate ids exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const duplicateId = '14ebb420-4cfa-4be1-99db-8122253e3106';
      const features: IFlattenedBlock[] = [
        createValidFeature({ id: duplicateId }),
        createValidFeature({ id: duplicateId })
      ];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors).to.have.length.greaterThan(0);
      expect(result.errors.some((e: IValidationError) => e.type === ValidationErrorType.DUPLICATE_ID)).to.be.true;
      expect(
        result.errors.find((e: IValidationError) => e.type === ValidationErrorType.DUPLICATE_ID)?.featureId
      ).to.equal(duplicateId);
    });

    it('returns INVALID_FEATURE_TYPE error for unknown type', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(null);

      const features: IFlattenedBlock[] = [createValidFeature({ type: 'unknown_type' })];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors).to.have.length(1);
      expect(result.errors[0].type).to.equal(ValidationErrorType.INVALID_FEATURE_TYPE);
      expect(result.errors[0].featureType).to.equal('unknown_type');
    });

    it('returns UNRESOLVED_REFERENCE error when parent does not exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const nonexistentParent = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const features: IFlattenedBlock[] = [createValidFeature({ parent: nonexistentParent })];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors.some((e: IValidationError) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)).to.be
        .true;
      expect(
        result.errors.find((e: IValidationError) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)?.field
      ).to.equal('parent');
    });

    it('returns UNRESOLVED_REFERENCE error when content references non-existent feature', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const nonexistentChild = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const features: IFlattenedBlock[] = [createValidFeature({ content: [nonexistentChild] })];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors.some((e: IValidationError) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)).to.be
        .true;
      expect(
        result.errors.find((e: IValidationError) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)?.field
      ).to.equal('content');
    });

    it('returns SELF_REFERENCE error when feature references itself as parent', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const selfId = '14ebb420-4cfa-4be1-99db-8122253e3106';
      const features: IFlattenedBlock[] = [createValidFeature({ id: selfId, parent: selfId })];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors.some((e: IValidationError) => e.type === ValidationErrorType.SELF_REFERENCE)).to.be.true;
      expect(
        result.errors.find((e: IValidationError) => e.type === ValidationErrorType.SELF_REFERENCE)?.field
      ).to.equal('parent');
    });

    it('returns SELF_REFERENCE error when feature references itself in content', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const selfId = '14ebb420-4cfa-4be1-99db-8122253e3106';
      const features: IFlattenedBlock[] = [createValidFeature({ id: selfId, content: [selfId] })];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors.some((e: IValidationError) => e.type === ValidationErrorType.SELF_REFERENCE)).to.be.true;
      expect(
        result.errors.find((e: IValidationError) => e.type === ValidationErrorType.SELF_REFERENCE)?.field
      ).to.equal('content');
    });

    it('collects multiple errors from different features', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      // First call returns null (invalid type), second returns valid
      const getFeatureTypeStub = sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties');
      getFeatureTypeStub.onFirstCall().resolves(null);
      getFeatureTypeStub.onSecondCall().resolves(mockFeatureTypeWithProperties);

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'aaaaaaaa-1111-2222-3333-444444444444', type: 'invalid_type' }),
        createValidFeature({
          id: 'bbbbbbbb-1111-2222-3333-444444444444',
          parent: 'cccccccc-1111-2222-3333-444444444444'
        }) // nonexistent parent
      ];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(1);
      expect(result.errors.some((e: IValidationError) => e.type === ValidationErrorType.INVALID_FEATURE_TYPE)).to.be
        .true;
      expect(result.errors.some((e: IValidationError) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)).to.be
        .true;
    });

    it('skips property validation when feature type is invalid', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(null);

      // Feature with invalid type - property validation should be skipped
      const features: IFlattenedBlock[] = [
        createValidFeature({ type: 'invalid_type', properties: { unknown_prop: 'value' } })
      ];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      // Should only have the INVALID_FEATURE_TYPE error, not INVALID_PROPERTY
      expect(result.errors).to.have.length(1);
      expect(result.errors[0].type).to.equal(ValidationErrorType.INVALID_FEATURE_TYPE);
    });
  });

  describe('validateFeatureStructure', () => {
    it('returns empty array for valid feature', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const validFeature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: { name: 'Test' },
        content: [],
        parent: null
      };

      const errors = service.validateFeatureStructure(validFeature);

      expect(errors).to.have.length(0);
    });

    it('returns MISSING_FIELD error when id is missing', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature = {
        type: 'dataset',
        properties: {},
        content: [],
        parent: null
      } as unknown as IFlattenedBlock;

      const errors = service.validateFeatureStructure(feature);

      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'id')).to
        .be.true;
    });

    it('returns MISSING_FIELD error when type is missing', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        properties: {},
        content: [],
        parent: null
      } as unknown as IFlattenedBlock;

      const errors = service.validateFeatureStructure(feature);

      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'type'))
        .to.be.true;
    });

    it('returns MISSING_FIELD error when type is empty string', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: '',
        properties: {},
        content: [],
        parent: null
      };

      const errors = service.validateFeatureStructure(feature);

      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'type'))
        .to.be.true;
    });

    it('returns MISSING_FIELD error when properties is missing', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        content: [],
        parent: null
      } as unknown as IFlattenedBlock;

      const errors = service.validateFeatureStructure(feature);

      expect(
        errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'properties')
      ).to.be.true;
    });

    it('returns MISSING_FIELD error when content is missing', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {},
        parent: null
      } as unknown as IFlattenedBlock;

      const errors = service.validateFeatureStructure(feature);

      expect(
        errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'content')
      ).to.be.true;
    });

    it('returns MISSING_FIELD error when parent field is missing', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {},
        content: []
      } as unknown as IFlattenedBlock;

      const errors = service.validateFeatureStructure(feature);

      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'parent'))
        .to.be.true;
    });

    it('accepts null parent value (root feature)', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {},
        content: [],
        parent: null
      };

      const errors = service.validateFeatureStructure(feature);

      expect(errors).to.have.length(0);
    });

    it('collects multiple missing field errors', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature = {} as unknown as IFlattenedBlock;

      const errors = service.validateFeatureStructure(feature);

      expect(errors.length).to.be.greaterThanOrEqual(4);
      expect(errors.every((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD)).to.be.true;
    });
  });

  describe('validateFeaturePropertyFlat', () => {
    const mockAllowedProperties: FeatureProperty[] = [
      {
        name: 'name',
        display_name: 'Name',
        description: '',
        feature_type_property_id: 1,
      type_name: 'string',
        required_value: true,
        calculated_value: false
      },
      {
        name: 'count',
        display_name: 'Count',
        description: '',
        feature_type_property_id: 1,
      type_name: 'number',
        required_value: false,
        calculated_value: false
      },
      {
        name: 'active',
        display_name: 'Active',
        description: '',
        feature_type_property_id: 1,
      type_name: 'boolean',
        required_value: false,
        calculated_value: false
      }
    ];

    it('returns empty array for valid properties', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: { name: 'Test Dataset', count: 5 },
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors).to.have.length(0);
    });

    it('ignores unknown properties without error', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: { name: 'Test', unknown_prop: 'value' },
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors).to.have.length(0);
    });

    it('returns MISSING_REQUIRED_PROPERTY error when required property is missing', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: { count: 5 }, // missing required 'name'
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_REQUIRED_PROPERTY)).to.be.true;
      expect(
        errors.find((e: IValidationError) => e.type === ValidationErrorType.MISSING_REQUIRED_PROPERTY)?.field
      ).to.equal('name');
    });

    it('returns INVALID_PROPERTY_TYPE error when property has wrong type', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: { name: 'Test', count: 'not a number' },
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.INVALID_PROPERTY_TYPE)).to.be.true;
      expect(
        errors.find((e: IValidationError) => e.type === ValidationErrorType.INVALID_PROPERTY_TYPE)?.field
      ).to.equal('count');
    });

    it('accepts null/undefined for optional properties', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: { name: 'Test' }, // optional 'count' and 'active' not provided
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors).to.have.length(0);
    });

    it('collects multiple property errors', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {
          // missing required 'name'
          count: 'not a number', // wrong type
          unknown: 'value' // unknown property — ignored, not an error
        },
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors.length).to.be.greaterThanOrEqual(2);
      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_REQUIRED_PROPERTY)).to.be.true;
      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.INVALID_PROPERTY_TYPE)).to.be.true;
    });

    it('should skip required check for calculated properties', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const propertiesWithCalculated: FeatureProperty[] = [
        {
          name: 'name',
          display_name: 'Name',
          description: '',
          feature_type_property_id: 1,
      type_name: 'string',
          required_value: true,
          calculated_value: false
        },
        {
          name: 'filename',
          display_name: 'Filename',
          description: '',
          feature_type_property_id: 1,
      type_name: 'string',
          required_value: true,
          calculated_value: true
        }
      ];

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'artifact',
        properties: { name: 'Test' }, // filename omitted — calculated, so no error
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, propertiesWithCalculated);

      expect(errors).to.have.length(0);
    });

    it('should skip all validation for calculated properties regardless of required_value', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const propertiesWithCalculated: FeatureProperty[] = [
        {
          name: 'name',
          display_name: 'Name',
          description: '',
          feature_type_property_id: 1,
      type_name: 'string',
          required_value: true,
          calculated_value: false
        },
        {
          name: 'calculated_required',
          display_name: 'Calculated Required',
          description: '',
          feature_type_property_id: 1,
      type_name: 'string',
          required_value: true,
          calculated_value: true
        },
        {
          name: 'calculated_optional',
          display_name: 'Calculated Optional',
          description: '',
          feature_type_property_id: 1,
      type_name: 'number',
          required_value: false,
          calculated_value: true
        }
      ];

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {
          name: 'Test',
          calculated_required: 12345, // wrong type — but calculated, no error
          calculated_optional: 'not a number' // wrong type — but calculated, no error
        },
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, propertiesWithCalculated);

      expect(errors).to.have.length(0);
    });
  });

  describe('findFeatureTypeWithPropertiesCached', () => {
    it('fetches from repository when cache is empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const mockResult: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [
          {
            name: 'name',
            display_name: 'Name',
            description: '',
            feature_type_property_id: 1,
      type_name: 'string',
            required_value: true,
            calculated_value: false
          }
        ]
      };

      const getFeatureTypeStub = sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockResult);

      const result = await service.findFeatureTypeWithPropertiesCached('dataset');

      expect(getFeatureTypeStub).to.have.been.calledOnceWith('dataset');
      expect(result).to.eql(mockResult);
    });

    it('returns cached result on subsequent calls', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const mockResult: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: []
      };

      const getFeatureTypeStub = sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockResult);

      // First call
      const result1 = await service.findFeatureTypeWithPropertiesCached('dataset');
      // Second call
      const result2 = await service.findFeatureTypeWithPropertiesCached('dataset');

      expect(getFeatureTypeStub).to.have.been.calledOnce;
      expect(result1).to.eql(mockResult);
      expect(result2).to.eql(mockResult);
    });

    it('caches null result for nonexistent type', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureValidationService(mockDBConnection);

      const getFeatureTypeStub = sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(null);

      // First call
      const result1 = await service.findFeatureTypeWithPropertiesCached('nonexistent');
      // Second call
      const result2 = await service.findFeatureTypeWithPropertiesCached('nonexistent');

      expect(getFeatureTypeStub).to.have.been.calledOnce;
      expect(result1).to.be.null;
      expect(result2).to.be.null;
    });
  });
});
