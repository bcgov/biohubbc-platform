import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { FeatureProperty, FeatureTypeWithProperties } from '../models/feature-type';
import { IFlattenedBlock } from '../models/submission-feature';
import { ValidationRepository } from '../repositories/validation-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { FeatureIngestionService, ValidationErrorType } from './feature-ingestion-service';

chai.use(sinonChai);

describe('FeatureIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  // ============================================================================
  // FLAT VALIDATION METHODS TESTS (for archive upload flow with IFlattenedBlock[])
  // ============================================================================

  describe('validateFlatSubmissionFeatures', () => {
    // Valid feature for reuse in tests
    const createValidFeature = (overrides: Partial<IFlattenedBlock> = {}): IFlattenedBlock => ({
      id: '14ebb420-4cfa-4be1-99db-8122253e3106',
      type: 'dataset',
      properties: { name: 'Test Dataset' },
      content: [],
      parent: null,
      ...overrides
    });

    const mockFeatureTypeWithProperties: FeatureTypeWithProperties = {
      featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
      properties: [
        { name: 'name', display_name: 'Name', description: '', type_name: 'string', required_value: true },
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
      expect(result.errors.some((e) => e.type === ValidationErrorType.DUPLICATE_ID)).to.be.true;
      expect(result.errors.find((e) => e.type === ValidationErrorType.DUPLICATE_ID)?.featureId).to.equal(duplicateId);
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
      expect(result.errors.some((e) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)).to.be.true;
      expect(result.errors.find((e) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)?.field).to.equal('parent');
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
      expect(result.errors.some((e) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)).to.be.true;
      expect(result.errors.find((e) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)?.field).to.equal('content');
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
      expect(result.errors.some((e) => e.type === ValidationErrorType.SELF_REFERENCE)).to.be.true;
      expect(result.errors.find((e) => e.type === ValidationErrorType.SELF_REFERENCE)?.field).to.equal('parent');
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
      expect(result.errors.some((e) => e.type === ValidationErrorType.SELF_REFERENCE)).to.be.true;
      expect(result.errors.find((e) => e.type === ValidationErrorType.SELF_REFERENCE)?.field).to.equal('content');
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
      expect(result.errors.some((e) => e.type === ValidationErrorType.INVALID_FEATURE_TYPE)).to.be.true;
      expect(result.errors.some((e) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)).to.be.true;
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

      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'id')).to.be.true;
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

      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'type')).to.be.true;
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

      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'type')).to.be.true;
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

      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'properties')).to.be.true;
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

      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'content')).to.be.true;
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

      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_FIELD && e.field === 'parent')).to.be.true;
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
      expect(errors.every((e) => e.type === ValidationErrorType.MISSING_FIELD)).to.be.true;
    });
  });

  describe('validateFeatureType', () => {
    it('returns empty array when feature type exists', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const mockFeatureType: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: []
      };

      sinon.stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties').resolves(mockFeatureType);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {},
        content: [],
        parent: null
      };

      const errors = await service.validateFeatureType(feature);

      expect(errors).to.have.length(0);
    });

    it('returns INVALID_FEATURE_TYPE error when type does not exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties').resolves(null);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'nonexistent_type',
        properties: {},
        content: [],
        parent: null
      };

      const errors = await service.validateFeatureType(feature);

      expect(errors).to.have.length(1);
      expect(errors[0].type).to.equal(ValidationErrorType.INVALID_FEATURE_TYPE);
      expect(errors[0].featureId).to.equal(feature.id);
      expect(errors[0].featureType).to.equal('nonexistent_type');
    });

    it('uses cache for repeated type lookups', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const mockFeatureType: FeatureTypeWithProperties = {
        featureType: { feature_type_id: 1, name: 'dataset', display_name: 'Dataset' },
        properties: []
      };

      const getFeatureTypeStub = sinon
        .stub(ValidationRepository.prototype, 'getFeatureTypeWithProperties')
        .resolves(mockFeatureType);

      const feature: IFlattenedBlock = {
        id: '14ebb420-4cfa-4be1-99db-8122253e3106',
        type: 'dataset',
        properties: {},
        content: [],
        parent: null
      };

      // Call twice
      await service.validateFeatureType(feature);
      await service.validateFeatureType(feature);

      // Repository should only be called once due to caching
      expect(getFeatureTypeStub).to.have.been.calledOnce;
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

      expect(errors.some((e) => e.type === ValidationErrorType.INVALID_PROPERTY)).to.be.true;
      expect(errors.find((e) => e.type === ValidationErrorType.INVALID_PROPERTY)?.field).to.equal('unknown_prop');
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

      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_REQUIRED_PROPERTY)).to.be.true;
      expect(errors.find((e) => e.type === ValidationErrorType.MISSING_REQUIRED_PROPERTY)?.field).to.equal('name');
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

      expect(errors.some((e) => e.type === ValidationErrorType.INVALID_PROPERTY_TYPE)).to.be.true;
      expect(errors.find((e) => e.type === ValidationErrorType.INVALID_PROPERTY_TYPE)?.field).to.equal('count');
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
      expect(errors.some((e) => e.type === ValidationErrorType.MISSING_REQUIRED_PROPERTY)).to.be.true;
      expect(errors.some((e) => e.type === ValidationErrorType.INVALID_PROPERTY_TYPE)).to.be.true;
      expect(errors.some((e) => e.type === ValidationErrorType.INVALID_PROPERTY)).to.be.true;
    });
  });

  describe('validateReferences', () => {
    it('returns empty array when all references are valid', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const parentId = '14ebb420-4cfa-4be1-99db-8122253e3106';
      const childId = '93541206-647a-4a00-81be-493e730ef86b';

      const features: IFlattenedBlock[] = [
        { id: parentId, type: 'dataset', properties: {}, content: [childId], parent: null },
        { id: childId, type: 'observation', properties: {}, content: [], parent: parentId }
      ];

      const allIds = new Set(features.map((f) => f.id));
      const errors = service.validateReferences(features, allIds);

      expect(errors).to.have.length(0);
    });

    it('returns UNRESOLVED_REFERENCE error for invalid parent reference', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const features: IFlattenedBlock[] = [
        {
          id: '14ebb420-4cfa-4be1-99db-8122253e3106',
          type: 'dataset',
          properties: {},
          content: [],
          parent: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' // nonexistent
        }
      ];

      const allIds = new Set(features.map((f) => f.id));
      const errors = service.validateReferences(features, allIds);

      expect(errors).to.have.length(1);
      expect(errors[0].type).to.equal(ValidationErrorType.UNRESOLVED_REFERENCE);
      expect(errors[0].field).to.equal('parent');
    });

    it('returns UNRESOLVED_REFERENCE error for invalid content reference', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const features: IFlattenedBlock[] = [
        {
          id: '14ebb420-4cfa-4be1-99db-8122253e3106',
          type: 'dataset',
          properties: {},
          content: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'], // nonexistent
          parent: null
        }
      ];

      const allIds = new Set(features.map((f) => f.id));
      const errors = service.validateReferences(features, allIds);

      expect(errors).to.have.length(1);
      expect(errors[0].type).to.equal(ValidationErrorType.UNRESOLVED_REFERENCE);
      expect(errors[0].field).to.equal('content');
    });

    it('returns SELF_REFERENCE error when parent equals id', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const selfId = '14ebb420-4cfa-4be1-99db-8122253e3106';

      const features: IFlattenedBlock[] = [
        { id: selfId, type: 'dataset', properties: {}, content: [], parent: selfId }
      ];

      const allIds = new Set(features.map((f) => f.id));
      const errors = service.validateReferences(features, allIds);

      expect(errors).to.have.length(1);
      expect(errors[0].type).to.equal(ValidationErrorType.SELF_REFERENCE);
      expect(errors[0].field).to.equal('parent');
    });

    it('returns SELF_REFERENCE error when content contains id', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const selfId = '14ebb420-4cfa-4be1-99db-8122253e3106';

      const features: IFlattenedBlock[] = [
        { id: selfId, type: 'dataset', properties: {}, content: [selfId], parent: null }
      ];

      const allIds = new Set(features.map((f) => f.id));
      const errors = service.validateReferences(features, allIds);

      expect(errors).to.have.length(1);
      expect(errors[0].type).to.equal(ValidationErrorType.SELF_REFERENCE);
      expect(errors[0].field).to.equal('content');
    });

    it('accepts null parent (root feature)', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const features: IFlattenedBlock[] = [
        { id: '14ebb420-4cfa-4be1-99db-8122253e3106', type: 'dataset', properties: {}, content: [], parent: null }
      ];

      const allIds = new Set(features.map((f) => f.id));
      const errors = service.validateReferences(features, allIds);

      expect(errors).to.have.length(0);
    });

    it('collects multiple reference errors from multiple features', () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      const features: IFlattenedBlock[] = [
        {
          id: '14ebb420-4cfa-4be1-99db-8122253e3106',
          type: 'dataset',
          properties: {},
          content: ['aaaaaaaa-1111-2222-3333-444444444444'], // nonexistent
          parent: null
        },
        {
          id: '93541206-647a-4a00-81be-493e730ef86b',
          type: 'observation',
          properties: {},
          content: [],
          parent: 'bbbbbbbb-1111-2222-3333-444444444444' // nonexistent
        }
      ];

      const allIds = new Set(features.map((f) => f.id));
      const errors = service.validateReferences(features, allIds);

      expect(errors).to.have.length(2);
      expect(errors.every((e) => e.type === ValidationErrorType.UNRESOLVED_REFERENCE)).to.be.true;
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
});
