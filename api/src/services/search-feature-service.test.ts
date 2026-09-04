import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import type { ExpressionTree } from '../models/expression-tree';
import type { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { decodeSearchFeatureCursor } from '../utils/pagination';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { SearchFeatureService } from './search-feature-service';

chai.use(sinonChai);

describe('SearchFeatureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockFeatures = [
    {
      submission_feature_id: 1,
      submission_id: 10,
      uuid: '11111111-1111-1111-1111-111111111111',
      feature_type_id: 1,
      feature_type_name: 'survey',
      properties: {},
      submission_name: 'Submission A',
      is_secured: false,
      relevancy_score: 1,
      create_date: '2026-05-11T00:00:00.000Z'
    }
  ];
  const mockProperties = [
    {
      feature_type_property_id: 1,
      feature_property_id: 31,
      feature_property_type_id: 1,
      name: 'name',
      display_name: 'Name',
      description: null,
      type_name: 'string',
      required_value: false,
      calculated_value: false,
      allow_multiple: false
    }
  ];
  const expressionTree: ExpressionTree = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 14,
        feature_type_property_id: null,
        operator: 'Exists'
      }
    ]
  };
  const normalizedExpression: NormalizedExpressionTree = {
    ...expressionTree,
    clauses: [
      {
        ...expressionTree.clauses[0],
        feature_property_type_id: 5,
        feature_property_type_name: 'number',
        internal_predicate: { type: 'number', operator: 'Exists' }
      }
    ]
  };

  describe('searchFeaturesByExpressionTree', () => {
    it('propagates the repository error when the anchor feature type does not exist', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      const notFound = new ApiExecuteSQLError('Failed to get feature type record');
      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').rejects(notFound);
      const repoStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree');

      try {
        await service.searchFeaturesByExpressionTree('does-not-exist', undefined);
        expect.fail('Expected searchFeaturesByExpressionTree to reject');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
      expect(repoStub).to.not.have.been.called;
    });

    it('delegates to the repository when the anchor feature type validates', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      const repoStub = sinon
        .stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree')
        .resolves(mockFeatures);

      const result = await service.searchFeaturesByExpressionTree('survey', undefined, undefined, 42);

      expect(repoStub).to.have.been.calledOnce;
      expect(repoStub.firstCall.args).to.deep.equal(['survey', undefined, undefined, 42]);
      expect(result).to.equal(mockFeatures);
    });
  });

  describe('searchFeaturesByExpressionTreeWithMetadata', () => {
    it('returns features and metadata without executing a count, normalizing the expression first', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      const normalizeStub = sinon
        .stub(ExpressionTreeNormalizationService.prototype, 'normalize')
        .resolves(normalizedExpression);
      const searchStub = sinon
        .stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree')
        .resolves(mockFeatures);
      const propertiesStub = sinon
        .stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties')
        .resolves(mockProperties);
      const hiddenSecuredStub = sinon
        .stub(SearchFeatureRepository.prototype, 'hasInaccessibleSecuredFeaturesByExpressionTree')
        .resolves(true);

      const result = await service.searchFeaturesByExpressionTreeWithMetadata('survey', expressionTree);

      expect(normalizeStub).to.have.been.calledOnceWith(expressionTree);
      expect(searchStub).to.have.been.calledOnce;
      expect(searchStub.firstCall.args).to.deep.equal(['survey', normalizedExpression, undefined, undefined]);
      expect(propertiesStub).to.have.been.calledOnceWith('survey');
      expect(hiddenSecuredStub).to.have.been.calledOnceWith('survey', normalizedExpression, undefined);
      expect(result).to.deep.equal({
        features: mockFeatures,
        properties: mockProperties,
        has_more_secured_features: true,
        pagination: {
          limit: 25,
          sort: 'relevancy_score',
          order: 'desc',
          next_cursor: null,
          previous_cursor: null
        }
      });
    });

    it('returns cursors derived from the stable result ordering', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree').resolves(mockFeatures);
      sinon.stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties').resolves(mockProperties);
      sinon.stub(SearchFeatureRepository.prototype, 'hasInaccessibleSecuredFeaturesByExpressionTree').resolves(false);

      const result = await service.searchFeaturesByExpressionTreeWithMetadata(
        'survey',
        undefined,
        { limit: 1, sort: 'create_date', order: 'desc' },
        null
      );

      expect(result.pagination.previous_cursor).to.be.null;
      expect(result.pagination).to.include({ limit: 1, sort: 'create_date', order: 'desc' });
      expect(decodeSearchFeatureCursor(result.pagination.next_cursor!)).to.deep.equal({
        direction: 'next',
        submission_feature_id: 1,
        create_date: '2026-05-11T00:00:00.000Z'
      });
    });

    it('returns a previous cursor when the request includes an adjacent-page cursor', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree').resolves(mockFeatures);
      sinon.stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties').resolves(mockProperties);
      sinon.stub(SearchFeatureRepository.prototype, 'hasInaccessibleSecuredFeaturesByExpressionTree').resolves(false);

      const result = await service.searchFeaturesByExpressionTreeWithMetadata(
        'survey',
        undefined,
        {
          limit: 1,
          sort: 'create_date',
          order: 'desc',
          boundary: {
            direction: 'next',
            submission_feature_id: 10,
            create_date: '2026-05-10T00:00:00.000Z'
          }
        },
        null
      );

      expect(decodeSearchFeatureCursor(result.pagination.previous_cursor!)).to.include({
        direction: 'previous',
        submission_feature_id: 1
      });
    });
  });

  it('normalizes expression-tree searches before repository evaluation', async () => {
    const service = new SearchFeatureService(getMockDBConnection());

    sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
    const normalizeStub = sinon
      .stub(ExpressionTreeNormalizationService.prototype, 'normalize')
      .resolves(normalizedExpression);
    const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree').resolves([]);

    await service.searchFeaturesByExpressionTree('survey', expressionTree);

    expect(normalizeStub).to.have.been.calledOnceWith(expressionTree);
    expect(searchStub.firstCall.args).to.deep.equal(['survey', normalizedExpression, undefined, undefined]);
  });

  it('passes the same deduplicated range expression to result and count queries', async () => {
    const service = new SearchFeatureService(getMockDBConnection());
    const lowerBound = {
      type: 'predicate',
      feature_property_id: 14,
      feature_type_property_id: null,
      feature_property_type_id: 5,
      feature_property_type_name: 'number',
      operator: 'GreaterThan',
      value: 7,
      internal_predicate: { type: 'number', operator: 'GreaterThan', value: 7 }
    } as const;
    const upperBound = {
      type: 'predicate',
      feature_property_id: 14,
      feature_type_property_id: null,
      feature_property_type_id: 5,
      feature_property_type_name: 'number',
      operator: 'LessThan',
      value: 9,
      internal_predicate: { type: 'number', operator: 'LessThan', value: 9 }
    } as const;
    const normalizedRange: NormalizedExpressionTree = {
      type: 'expression',
      operator: 'AND',
      clauses: [upperBound, lowerBound, lowerBound]
    };
    const optimizedRange: NormalizedExpressionTree = {
      type: 'expression',
      operator: 'AND',
      clauses: [lowerBound, upperBound]
    };

    sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
    sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize').resolves(normalizedRange);
    const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree').resolves([]);
    const countStub = sinon.stub(SearchFeatureRepository.prototype, 'countFeaturesByExpressionTree').resolves(0);

    await service.searchFeaturesByExpressionTree('survey', expressionTree);
    await service.countSearchFeaturesByExpressionTree('survey', expressionTree);

    expect(searchStub.firstCall.args[1]).to.deep.equal(optimizedRange);
    expect(countStub.firstCall.args[1]).to.deep.equal(optimizedRange);
  });

  describe('countSearchFeaturesByExpressionTree', () => {
    it('normalizes the expression before requesting the count', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      const normalizeStub = sinon
        .stub(ExpressionTreeNormalizationService.prototype, 'normalize')
        .resolves(normalizedExpression);
      const countStub = sinon.stub(SearchFeatureRepository.prototype, 'countFeaturesByExpressionTree').resolves(42_000);

      const result = await service.countSearchFeaturesByExpressionTree('survey', expressionTree, 91);

      expect(normalizeStub).to.have.been.calledOnceWith(expressionTree);
      expect(countStub.firstCall.args).to.deep.equal(['survey', normalizedExpression, 91]);
      expect(result).to.equal(42_000);
    });

    it('does not normalize when the expression is omitted', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      const normalizeStub = sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize');
      const countStub = sinon
        .stub(SearchFeatureRepository.prototype, 'countFeaturesByExpressionTree')
        .resolves(5_000_000);

      const result = await service.countSearchFeaturesByExpressionTree('survey', undefined, null);

      expect(normalizeStub).to.not.have.been.called;
      expect(countStub.firstCall.args).to.deep.equal(['survey', undefined, null]);
      expect(result).to.equal(5_000_000);
    });
  });
});
