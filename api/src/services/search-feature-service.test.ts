import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { ExpressionPredicateSemanticValidator } from './expression-predicate-semantic-validator';
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
      feature_type_name: 'dataset',
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

      const result = await service.searchFeaturesByExpressionTree('dataset', undefined, undefined, 42);

      expect(repoStub).to.have.been.calledOnce;
      expect(repoStub.firstCall.args).to.deep.equal(['dataset', undefined, undefined, 42]);
      expect(result).to.equal(mockFeatures);
    });
  });

  describe('searchFeaturesByExpressionTreeWithCount', () => {
    it('returns features and count from the repository, normalizing the expression tree first', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      const tree = { type: 'leaf' } as unknown as Parameters<
        SearchFeatureService['searchFeaturesByExpressionTreeWithCount']
      >[1];
      const normalized = { normalized: true };

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      const validateStub = sinon
        .stub(ExpressionPredicateSemanticValidator.prototype, 'validateExpressionTree')
        .resolves(normalized as never);
      const searchStub = sinon
        .stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree')
        .resolves(mockFeatures);
      const countStub = sinon
        .stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTreeCount')
        .resolves(123);
      const propertiesStub = sinon
        .stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTreeProperties')
        .resolves(mockProperties);

      const result = await service.searchFeaturesByExpressionTreeWithCount('dataset', tree);

      expect(validateStub).to.have.been.calledOnceWith(tree);
      expect(searchStub).to.have.been.calledOnce;
      expect(searchStub.firstCall.args).to.deep.equal(['dataset', normalized, undefined, undefined]);
      expect(propertiesStub).to.have.been.calledOnceWith('dataset', normalized, undefined);
      expect(countStub).to.have.been.calledOnceWith('dataset', normalized, undefined);
      expect(result).to.deep.equal({ features: mockFeatures, properties: mockProperties, count: 123 });
    });
  });

  describe('getSearchFeaturesCountByExpressionTree', () => {
    it('delegates the count to the repository after validating the anchor feature type', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      const countStub = sinon
        .stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTreeCount')
        .resolves(5);

      const result = await service.getSearchFeaturesCountByExpressionTree('dataset', undefined);

      expect(countStub).to.have.been.calledOnce;
      expect(countStub.firstCall.args).to.deep.equal(['dataset', undefined, undefined]);
      expect(result).to.equal(5);
    });
  });
});
