import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { IFlattenedBlock } from '../../models/submission-feature';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { FeatureIngestionService } from './feature-ingestion-service';

chai.use(sinonChai);

describe('FeatureIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

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
        {
          name: 'name',
          display_name: 'Name',
          description: '',
          type_name: 'string',
          allow_multiple: false,
          required_value: true,
          calculated_value: false
        },
        {
          name: 'focal_species',
          display_name: 'Focal Species',
          description: '',
          type_name: 'object',
          allow_multiple: true,
          required_value: true,
          calculated_value: false
        },
        {
          name: 'start_date',
          display_name: 'Start Date',
          description: '',
          type_name: 'datetime',
          allow_multiple: false,
          required_value: true,
          calculated_value: false
        },
        {
          name: 'description',
          display_name: 'Description',
          description: '',
          type_name: 'string',
          allow_multiple: false,
          required_value: false,
          calculated_value: false
        }
      ]
    };

    it('should insert valid features and return UUID to ID mapping', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      const result = await service.ingestFeatures(1, 'some-uuid', features);

      expect(result.valid).to.be.true;
      expect(result.errors).to.have.length(0);
      expect(deleteStub).to.have.been.calledOnceWith(1);
      expect(deleteRelationshipsStub).to.have.been.calledOnceWith(1);
      expect(insertStub).to.have.been.calledTwice;
      expect(updateParentStub).to.have.been.calledOnceWith(101, 100);
      expect(insertRelationshipsStub).to.have.been.calledOnceWith([{ source_feature_id: 100, target_feature_id: 101 }]);
    });

    it('should return all errors when validation fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(null);

      const features: IFlattenedBlock[] = [createValidFeature({ type: 'unknown_type' })];

      const result = await service.ingestFeatures(1, 'some-uuid', features);

      expect(result.valid).to.be.false;
      expect(result.errors).to.have.length.greaterThan(0);
    });

    it('should not insert any features when validation fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon.stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties').resolves(null);

      const deleteStub = sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures');
      const insertStub = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord');

      const features: IFlattenedBlock[] = [createValidFeature({ type: 'invalid_type' })];

      const result = await service.ingestFeatures(1, 'some-uuid', features);

      expect(result.valid).to.be.false;
      expect(deleteStub).to.not.have.been.called;
      expect(insertStub).to.not.have.been.called;
    });

    it('should handle root features with null parent', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
        .resolves(mockFeatureTypeWithProperties);

      sinon.stub(SubmissionRepository.prototype, 'deleteSubmissionFeatures').resolves();

      const insertStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord')
        .resolves({ submission_feature_id: 100 });

      const updateParentStub = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionFeatureParent');

      const features: IFlattenedBlock[] = [createValidFeature({ id: 'uuid-root', parent: null })];

      const result = await service.ingestFeatures(1, 'some-uuid', features);

      expect(result.valid).to.be.true;
      expect(insertStub).to.have.been.calledOnce;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('should handle nested features with parent references', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      const result = await service.ingestFeatures(1, 'some-uuid', features);

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
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      const result = await service.ingestFeatures(1, 'some-uuid', features);

      expect(result.valid).to.be.true;
    });

    // ========================================================================
    // insertFlatFeatures tests (via ingestFeatures)
    // ========================================================================

    it('should pass correct arguments to insertSubmissionFeatureRecord', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      await service.ingestFeatures(42, 'some-uuid', [feature]);

      expect(insertStub).to.have.been.calledOnceWithExactly(
        42, // submissionId
        'some-uuid', // uploadId
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

      const result = await service.ingestFeatures(1, 'some-uuid', []);

      expect(result.valid).to.be.true;
      expect(insertStub).to.not.have.been.called;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('should insert multiple independent features without parent updates', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      const result = await service.ingestFeatures(1, 'some-uuid', features);

      expect(result.valid).to.be.true;
      expect(insertStub).to.have.been.calledThrice;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('should handle deep nesting with 4 levels', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      const result = await service.ingestFeatures(1, 'some-uuid', features);

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
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      const result = await service.ingestFeatures(1, 'some-uuid', features);

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
          {
            name: 'name',
            display_name: 'Name',
            description: '',
            type_name: 'string',
            allow_multiple: false,
            required_value: true,
            calculated_value: false
          },
          {
            name: 'focal_species',
            display_name: 'Focal Species',
            description: '',
            type_name: 'object',
            allow_multiple: true,
            required_value: true,
            calculated_value: false
          },
          {
            name: 'start_date',
            display_name: 'Start Date',
            description: '',
            type_name: 'datetime',
            allow_multiple: false,
            required_value: true,
            calculated_value: false
          },
          {
            name: 'description',
            display_name: 'Description',
            description: '',
            type_name: 'string',
            allow_multiple: false,
            required_value: false,
            calculated_value: false
          },
          {
            name: 'count',
            display_name: 'Count',
            description: '',
            type_name: 'number',
            allow_multiple: false,
            required_value: false,
            calculated_value: false
          }
        ]
      };

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      const result = await service.ingestFeatures(1, 'some-uuid', features);

      expect(result.valid).to.be.true;
      expect(insertStub.firstCall.args[5]).to.deep.equal(propsWithMultipleFields);
      expect(insertStub.secondCall.args[5]).to.deep.equal(propsMinimal);
    });

    it('should call deleteSubmissionFeatures and deleteSubmissionFeatureRelationships before inserting', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      await service.ingestFeatures(1, 'some-uuid', features);

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
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      await service.ingestFeatures(1, 'some-uuid', features);

      expect(insertStub).to.have.been.calledTwice;
      expect(insertRelationshipsStub).to.not.have.been.called;
    });

    it('should insert relationship rows for parent with multiple children', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      await service.ingestFeatures(1, 'some-uuid', features);

      expect(insertRelationshipsStub).to.have.been.calledOnceWith([
        { source_feature_id: 10, target_feature_id: 20 },
        { source_feature_id: 10, target_feature_id: 30 },
        { source_feature_id: 10, target_feature_id: 40 }
      ]);
    });

    it('should insert all features before updating any parent references', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new FeatureIngestionService(mockDBConnection);

      sinon
        .stub(IngestionRepository.prototype, 'findFeatureTypeWithProperties')
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

      await service.ingestFeatures(1, 'some-uuid', features);

      // Verify order: all 3 inserts, then 2 parent updates
      expect(callOrder).to.deep.equal(['insert', 'insert', 'insert', 'updateParent', 'updateParent']);
      expect(insertStub).to.have.been.calledThrice;
      expect(updateParentStub).to.have.been.calledTwice;
    });
  });
});
