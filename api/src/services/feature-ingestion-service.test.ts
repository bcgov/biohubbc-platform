import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { FeatureProperty, FeatureTypeWithProperties } from '../models/feature-type';
import { IFlattenedBlock } from '../models/submission-feature';
import { SubmissionRepository } from '../repositories/submission-repository';
import { ValidationRepository } from '../repositories/validation-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { FeatureIngestionService } from './feature-ingestion-service';
import { IValidationError, ValidationErrorType } from './feature-ingestion-service.interface';

chai.use(sinonChai);

describe('FeatureIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  // ============================================================================
  // FLAT VALIDATION METHODS TESTS (for archive upload flow with IFlattenedBlock[])
  // ============================================================================

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
        { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
        {
          name: 'focal_species',
          display_name: 'Focal Species',
          description: '',
          type_name: 'array',
          required_value: true
        },
        {
          name: 'start_date',
          display_name: 'Start Date',
          description: '',
          type_name: 'datetime',
          required_value: true
        },
        {
          name: 'description',
          display_name: 'Description',
          description: '',
          type_name: 'string',
          required_value: false
        }
      ]
    };

    it('returns valid=true for valid submission', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const features: IFlattenedBlock[] = [createValidFeature()];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.true;
      expect(result.errors).to.have.length(0);
    });

    it('returns valid=true for submission with parent-child relationship', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
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
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
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
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties').resolves(null);

      const features: IFlattenedBlock[] = [createValidFeature({ type: 'unknown_type' })];

      const result = await service.validateFlatSubmissionFeatures(features);

      expect(result.valid).to.be.false;
      expect(result.errors).to.have.length(1);
      expect(result.errors[0].type).to.equal(ValidationErrorType.INVALID_FEATURE_TYPE);
      expect(result.errors[0].featureType).to.equal('unknown_type');
    });

    it('returns UNRESOLVED_REFERENCE error when parent does not exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
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
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
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
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
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
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
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
      const service = new FeatureIngestionService(mockDBConnection);

      // First call returns null (invalid type), second returns valid
      const getFeatureTypeStub = sinon.stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties');
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
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties').resolves(null);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

      const feature = {} as unknown as IFlattenedBlock;

      const errors = service.validateFeatureStructure(feature);

      expect(errors.length).to.be.greaterThanOrEqual(4);
      expect(errors.every((e: IValidationError) => e.type === ValidationErrorType.MISSING_FIELD)).to.be.true;
    });
  });

  describe('validateFeaturePropertyFlat', () => {
    const mockAllowedProperties: FeatureProperty[] = [
      { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
      { name: 'count', display_name: 'Count', description: '', type_name: 'number', required_value: false },
      { name: 'active', display_name: 'Active', description: '', type_name: 'boolean', required_value: false }
    ];

    it('returns empty array for valid properties', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

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

    it('returns INVALID_PROPERTY error for unknown property', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: { name: 'Test', unknown_prop: 'value' },
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.INVALID_PROPERTY)).to.be.true;
      expect(errors.find((e: IValidationError) => e.type === ValidationErrorType.INVALID_PROPERTY)?.field).to.equal(
        'unknown_prop'
      );
    });

    it('returns MISSING_REQUIRED_PROPERTY error when required property is missing', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

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
      const service = new FeatureIngestionService(mockDBConnection);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {
          // missing required 'name'
          count: 'not a number', // wrong type
          unknown: 'value' // unknown property
        },
        content: [],
        parent: null
      };

      const errors = service.validateFeaturePropertyFlat(feature, mockAllowedProperties);

      expect(errors.length).to.be.greaterThanOrEqual(3);
      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.MISSING_REQUIRED_PROPERTY)).to.be.true;
      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.INVALID_PROPERTY_TYPE)).to.be.true;
      expect(errors.some((e: IValidationError) => e.type === ValidationErrorType.INVALID_PROPERTY)).to.be.true;
    });
  });

  describe('getFeatureTypeWithPropertiesCached', () => {
    it('fetches from repository when cache is empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const mockResult: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [{ name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true }]
      };

      const getFeatureTypeStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockResult);

      const result = await service.getFeatureTypeWithPropertiesCached('dataset');

      expect(getFeatureTypeStub).to.have.been.calledOnceWith('dataset');
      expect(result).to.eql(mockResult);
    });

    it('returns cached result on subsequent calls', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const mockResult: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: []
      };

      const getFeatureTypeStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockResult);

      // First call
      const result1 = await service.getFeatureTypeWithPropertiesCached('dataset');
      // Second call
      const result2 = await service.getFeatureTypeWithPropertiesCached('dataset');

      expect(getFeatureTypeStub).to.have.been.calledOnce;
      expect(result1).to.eql(mockResult);
      expect(result2).to.eql(mockResult);
    });

    it('caches null result for nonexistent type', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const getFeatureTypeStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(null);

      // First call
      const result1 = await service.getFeatureTypeWithPropertiesCached('nonexistent');
      // Second call
      const result2 = await service.getFeatureTypeWithPropertiesCached('nonexistent');

      expect(getFeatureTypeStub).to.have.been.calledOnce;
      expect(result1).to.be.null;
      expect(result2).to.be.null;
    });
  });

  // ============================================================================
  // INGESTION METHODS TESTS (validation + insertion)
  // ============================================================================

  describe('ingestFeatures', () => {
    // Valid feature for reuse in tests (matches real dataset schema)
    const createValidFeature = (overrides: Partial<IFlattenedBlock> = {}): IFlattenedBlock => ({
      id: 'a0000000-0000-0000-0000-000000000001',
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
        { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
        {
          name: 'focal_species',
          display_name: 'Focal Species',
          description: '',
          type_name: 'array',
          required_value: true
        },
        {
          name: 'start_date',
          display_name: 'Start Date',
          description: '',
          type_name: 'datetime',
          required_value: true
        },
        {
          name: 'description',
          display_name: 'Description',
          description: '',
          type_name: 'string',
          required_value: false
        }
      ]
    };

    it('should insert valid features and return UUID to ID mapping', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const deleteStub = sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();
      const deleteRelationshipsStub = sinon
        .stub(SubmissionRepository.prototype, 'deleteSubmissionFeatureRelationships')
        .resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onFirstCall().resolves({ submission_feature_id: 100 });
      insertStub.onSecondCall().resolves({ submission_feature_id: 101 });

      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const insertRelationshipsStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRelationships')
        .resolves();

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'uuid-1', content: ['uuid-2'] }),
        createValidFeature({ id: 'uuid-2', parent: 'uuid-1', content: [] })
      ];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
      expect(result.errors).to.have.length(0);
      expect(deleteStub).to.have.been.calledOnceWith(1);
      expect(deleteRelationshipsStub).to.have.been.calledOnceWith(1);
      expect(insertStub).to.have.been.calledTwice;
      expect(updateParentStub).to.have.been.calledOnceWith(101, 100);
      expect(insertRelationshipsStub).to.have.been.calledOnceWith([
        { parent_submission_feature_id: 100, child_submission_feature_id: 101 }
      ]);
    });

    it('should return all errors when validation fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties').resolves(null);

      const features: IFlattenedBlock[] = [createValidFeature({ type: 'unknown_type' })];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.false;
      expect(result.errors).to.have.length.greaterThan(0);
    });

    it('should not insert any features when validation fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties').resolves(null);

      const deleteStub = sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures');
      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');

      const features: IFlattenedBlock[] = [createValidFeature({ type: 'invalid_type' })];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.false;
      expect(deleteStub).to.not.have.been.called;
      expect(insertStub).to.not.have.been.called;
    });

    it('should handle root features with null parent', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord')
        .resolves({ submission_feature_id: 100 });

      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent');

      const features: IFlattenedBlock[] = [createValidFeature({ id: 'uuid-root', parent: null })];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
      expect(insertStub).to.have.been.calledOnce;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('should handle nested features with parent references', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onFirstCall().resolves({ submission_feature_id: 1 });
      insertStub.onSecondCall().resolves({ submission_feature_id: 2 });
      insertStub.onThirdCall().resolves({ submission_feature_id: 3 });

      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'root', parent: null, content: ['child1'] }),
        createValidFeature({ id: 'child1', parent: 'root', content: ['grandchild'] }),
        createValidFeature({ id: 'grandchild', parent: 'child1', content: [] })
      ];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
      expect(insertStub).to.have.been.calledThrice;
      expect(updateParentStub).to.have.been.calledTwice;
      expect(updateParentStub).to.have.been.calledWith(2, 1); // child1 -> root
      expect(updateParentStub).to.have.been.calledWith(3, 2); // grandchild -> child1
    });

    it('should insert multiple features successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onFirstCall().resolves({ submission_feature_id: 500 });
      insertStub.onSecondCall().resolves({ submission_feature_id: 501 });
      insertStub.onThirdCall().resolves({ submission_feature_id: 502 });

      sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'aaa-111' }),
        createValidFeature({ id: 'bbb-222' }),
        createValidFeature({ id: 'ccc-333' })
      ];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
    });

    // ========================================================================
    // insertFlatFeatures tests (via ingestFeatures)
    // ========================================================================

    it('should pass correct arguments to insertSubmissionFeatureRecord', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord')
        .resolves({ submission_feature_id: 1 });

      sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const feature: IFlattenedBlock = {
        id: 'test-uuid-123',
        type: 'dataset',
        properties: {
          name: 'My Dataset',
          focal_species: [{ taxon_id: 1234 }],
          start_date: '2024-01-01T00:00:00Z'
        },
        content: [],
        parent: null
      };

      await service.ingestFeatures(42, [feature]);

      expect(insertStub).to.have.been.calledOnceWithExactly(
        42, // submissionId
        null, // parent (null in pass 1)
        'test-uuid-123', // feature.id
        'dataset', // feature.type
        { name: 'My Dataset', focal_species: [{ taxon_id: 1234 }], start_date: '2024-01-01T00:00:00Z' }
      );
    });

    it('should handle empty features array', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent');

      const result = await service.ingestFeatures(1, []);

      expect(result.valid).to.be.true;
      expect(insertStub).to.not.have.been.called;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('should insert multiple independent features without parent updates', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onCall(0).resolves({ submission_feature_id: 10 });
      insertStub.onCall(1).resolves({ submission_feature_id: 20 });
      insertStub.onCall(2).resolves({ submission_feature_id: 30 });

      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent');

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'feat-1', parent: null }),
        createValidFeature({ id: 'feat-2', parent: null }),
        createValidFeature({ id: 'feat-3', parent: null })
      ];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
      expect(insertStub).to.have.been.calledThrice;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('should handle deep nesting with 4 levels', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onCall(0).resolves({ submission_feature_id: 1 }); // great-grandparent
      insertStub.onCall(1).resolves({ submission_feature_id: 2 }); // grandparent
      insertStub.onCall(2).resolves({ submission_feature_id: 3 }); // parent
      insertStub.onCall(3).resolves({ submission_feature_id: 4 }); // child

      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'level-0', parent: null }),
        createValidFeature({ id: 'level-1', parent: 'level-0' }),
        createValidFeature({ id: 'level-2', parent: 'level-1' }),
        createValidFeature({ id: 'level-3', parent: 'level-2' })
      ];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
      expect(updateParentStub).to.have.been.calledThrice;
      expect(updateParentStub).to.have.been.calledWith(2, 1); // level-1 -> level-0
      expect(updateParentStub).to.have.been.calledWith(3, 2); // level-2 -> level-1
      expect(updateParentStub).to.have.been.calledWith(4, 3); // level-3 -> level-2
    });

    it('should handle sibling features with same parent', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onCall(0).resolves({ submission_feature_id: 100 }); // parent
      insertStub.onCall(1).resolves({ submission_feature_id: 201 }); // child 1
      insertStub.onCall(2).resolves({ submission_feature_id: 202 }); // child 2
      insertStub.onCall(3).resolves({ submission_feature_id: 203 }); // child 3

      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'parent', parent: null, content: ['child-1', 'child-2', 'child-3'] }),
        createValidFeature({ id: 'child-1', parent: 'parent' }),
        createValidFeature({ id: 'child-2', parent: 'parent' }),
        createValidFeature({ id: 'child-3', parent: 'parent' })
      ];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
      expect(updateParentStub).to.have.been.calledThrice;
      expect(updateParentStub).to.have.been.calledWith(201, 100); // child-1 -> parent
      expect(updateParentStub).to.have.been.calledWith(202, 100); // child-2 -> parent
      expect(updateParentStub).to.have.been.calledWith(203, 100); // child-3 -> parent
    });

    it('should preserve feature properties when inserting', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      // Mock with multiple properties (matches real dataset schema + extra optional)
      const mockFeatureTypeWithMultipleProps: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: [
          { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
          {
            name: 'focal_species',
            display_name: 'Focal Species',
            description: '',
            type_name: 'array',
            required_value: true
          },
          {
            name: 'start_date',
            display_name: 'Start Date',
            description: '',
            type_name: 'datetime',
            required_value: true
          },
          {
            name: 'description',
            display_name: 'Description',
            description: '',
            type_name: 'string',
            required_value: false
          },
          { name: 'count', display_name: 'Count', description: '', type_name: 'number', required_value: false }
        ]
      };

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithMultipleProps);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onCall(0).resolves({ submission_feature_id: 1 });
      insertStub.onCall(1).resolves({ submission_feature_id: 2 });

      sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const propsWithMultipleFields = {
        name: 'Dataset One',
        focal_species: [{ taxon_id: 1234 }],
        start_date: '2024-01-01T00:00:00Z',
        description: 'A detailed description',
        count: 42
      };

      const propsMinimal = {
        name: 'Simple',
        focal_species: [{ taxon_id: 5678 }],
        start_date: '2024-06-01T00:00:00Z'
      };

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'feat-1', properties: propsWithMultipleFields }),
        createValidFeature({ id: 'feat-2', properties: propsMinimal })
      ];

      const result = await service.ingestFeatures(1, features);

      expect(result.valid).to.be.true;
      expect(insertStub.firstCall.args[4]).to.deep.equal(propsWithMultipleFields);
      expect(insertStub.secondCall.args[4]).to.deep.equal(propsMinimal);
    });

    it('should call deleteSubmissionFeatures and deleteSubmissionFeatureRelationships before inserting', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      const callOrder: string[] = [];

      const deleteStub = sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').callsFake(async () => {
        callOrder.push('delete');
      });

      const deleteRelationshipsStub = sinon
        .stub(SubmissionRepository.prototype, 'deleteSubmissionFeatureRelationships')
        .callsFake(async () => {
          callOrder.push('deleteRelationships');
        });

      const insertStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord')
        .callsFake(async () => {
          callOrder.push('insert');
          return { submission_feature_id: 1 };
        });

      sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();
      sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRelationships').resolves();

      const features: IFlattenedBlock[] = [createValidFeature()];

      await service.ingestFeatures(1, features);

      expect(callOrder[0]).to.equal('delete');
      expect(callOrder[1]).to.equal('deleteRelationships');
      expect(callOrder[2]).to.equal('insert');
      expect(deleteStub).to.have.been.calledOnceWith(1);
      expect(deleteRelationshipsStub).to.have.been.calledOnceWith(1);
      expect(insertStub).to.have.been.calledOnce;
    });

    it('should not call insertSubmissionFeatureRelationships when all features have empty content', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();
      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatureRelationships').resolves();

      const insertStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord')
        .resolves({ submission_feature_id: 1 });

      sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const insertRelationshipsStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRelationships')
        .resolves();

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'uuid-1', content: [], parent: null }),
        createValidFeature({ id: 'uuid-2', content: [], parent: 'uuid-1' })
      ];

      await service.ingestFeatures(1, features);

      expect(insertStub).to.have.been.calledTwice;
      expect(insertRelationshipsStub).to.not.have.been.called;
    });

    it('should insert relationship rows for parent with multiple children', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();
      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatureRelationships').resolves();

      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');
      insertStub.onFirstCall().resolves({ submission_feature_id: 10 });
      insertStub.onSecondCall().resolves({ submission_feature_id: 20 });
      insertStub.onThirdCall().resolves({ submission_feature_id: 30 });
      insertStub.onCall(3).resolves({ submission_feature_id: 40 });

      sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent').resolves();

      const insertRelationshipsStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRelationships')
        .resolves();

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'parent', parent: null, content: ['child-1', 'child-2', 'child-3'] }),
        createValidFeature({ id: 'child-1', parent: 'parent', content: [] }),
        createValidFeature({ id: 'child-2', parent: 'parent', content: [] }),
        createValidFeature({ id: 'child-3', parent: 'parent', content: [] })
      ];

      await service.ingestFeatures(1, features);

      expect(insertRelationshipsStub).to.have.been.calledOnceWith([
        { parent_submission_feature_id: 10, child_submission_feature_id: 20 },
        { parent_submission_feature_id: 10, child_submission_feature_id: 30 },
        { parent_submission_feature_id: 10, child_submission_feature_id: 40 }
      ]);
    });

    it('should insert all features before updating any parent references', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const callOrder: string[] = [];

      const insertStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord')
        .callsFake(async () => {
          callOrder.push('insert');
          return { submission_feature_id: callOrder.filter((c) => c === 'insert').length };
        });

      const updateParentStub = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent')
        .callsFake(async () => {
          callOrder.push('updateParent');
        });

      const features: IFlattenedBlock[] = [
        createValidFeature({ id: 'a', parent: null }),
        createValidFeature({ id: 'b', parent: 'a' }),
        createValidFeature({ id: 'c', parent: 'b' })
      ];

      await service.ingestFeatures(1, features);

      // Verify order: all 3 inserts, then 2 parent updates
      expect(callOrder).to.deep.equal(['insert', 'insert', 'insert', 'updateParent', 'updateParent']);
      expect(insertStub).to.have.been.calledThrice;
      expect(updateParentStub).to.have.been.calledTwice;
    });
  });
});
