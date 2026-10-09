import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import type { ExpressionTree } from '../models/expression-tree';
import type { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { decodeSearchFeatureCursor } from '../utils/pagination';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { SearchFeatureService } from './search-feature-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

chai.use(sinonChai);

describe('SearchFeatureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('reconciliation browsing', () => {
    const scope = { submissionId: 7, submissionUploadId: 'upload', reconciliation: 'unmodified' as const };

    beforeEach(() => {
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves({ submission_id: 7 } as any);
    });

    it('preserves totals for a requested feature type page beyond the last one, including an empty outcome', async () => {
      const ownership = sinon
        .stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId')
        .resolves({ submission_id: 7 } as any);
      const list = sinon.stub(SearchFeatureRepository.prototype, 'listSubmissionUploadFeatureTypes').resolves([]);
      const count = sinon.stub(SearchFeatureRepository.prototype, 'countSubmissionUploadFeatureTypes');
      count.onFirstCall().resolves(11);
      count.onSecondCall().resolves(0);
      const uploadScope = { submissionId: 7, submissionUploadId: 'upload' };
      const filters = { reconciliation: 'unmodified' as const };
      const pagination = { page: 3, limit: 10, sort: 'count', order: 'desc' as const };
      const service = new SearchFeatureService(getMockDBConnection());

      expect(await service.listSubmissionUploadFeatureTypes(uploadScope, filters, pagination)).to.deep.equal({
        feature_types: [],
        pagination: { total: 11, per_page: 10, current_page: 3, last_page: 2, sort: 'count', order: 'desc' }
      });
      expect(ownership).to.have.been.calledWithExactly(7, 'upload');
      expect(list).to.have.been.calledOnceWithExactly(uploadScope, filters, pagination);
      expect(count).to.have.been.calledOnceWithExactly(uploadScope, filters);

      const empty = await service.listSubmissionUploadFeatureTypes(uploadScope, filters, { page: 1, limit: 10 });
      expect(empty.pagination.total).to.equal(0);
      expect(empty.pagination.last_page).to.equal(1);
    });

    it('rejects a foreign submission before reading feature types or features', async () => {
      const failure = new ApiNotFoundError('Submission upload not found');
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId').rejects(failure);
      const list = sinon.stub(SearchFeatureRepository.prototype, 'listSubmissionUploadFeatureTypes');
      const count = sinon.stub(SearchFeatureRepository.prototype, 'countSubmissionUploadFeatureTypes');
      const rows = sinon.stub(SearchFeatureRepository.prototype, 'getReconciliationFeatures');
      const service = new SearchFeatureService(getMockDBConnection());
      for (const request of [
        () =>
          service.listSubmissionUploadFeatureTypes(
            { submissionId: 8, submissionUploadId: 'upload' },
            { reconciliation: 'unmodified' },
            { page: 1, limit: 10 }
          ),
        () =>
          service.getReconciliationFeatures({ ...scope, submissionId: 8 }, 'animal', {
            limit: 2,
            sort: 'submission_feature_id',
            order: 'asc'
          })
      ]) {
        try {
          await request();
          expect.fail('Expected ownership rejection');
        } catch (error) {
          expect((error as Error).message).to.equal('Submission upload not found');
        }
      }
      expect(list).not.to.have.been.called;
      expect(count).not.to.have.been.called;
      expect(rows).not.to.have.been.called;
    });

    it('trims forward and backward lookahead and emits adjacent-page cursors', async () => {
      const rows = [1, 2, 3].map((id) => ({
        ...mockFeatures[0],
        submission_feature_id: id,
        parent_submission_feature_id: null,
        provenance: null
      }));
      sinon.stub(SearchFeatureRepository.prototype, 'getReconciliationFeatures').resolves(rows);
      sinon.stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties').resolves(mockProperties);
      const service = new SearchFeatureService(getMockDBConnection());
      const pagination = { limit: 2, sort: 'submission_feature_id', order: 'asc' as const };
      const first = await service.getReconciliationFeatures(scope, 'animal', pagination);
      expect(first.features.map((row) => row.submission_feature_id)).to.deep.equal([1, 2]);
      expect(first.properties).to.deep.equal(mockProperties);
      expect(first.pagination.previous_cursor).to.be.null;
      expect(decodeSearchFeatureCursor(first.pagination.next_cursor!).submission_feature_id).to.equal(2);
      const previous = await service.getReconciliationFeatures(scope, 'animal', {
        ...pagination,
        boundary: { direction: 'previous', submission_feature_id: 4, create_date: rows[0].create_date }
      });
      expect(previous.features.map((row) => row.submission_feature_id)).to.deep.equal([2, 3]);
      expect(decodeSearchFeatureCursor(previous.pagination.previous_cursor!).submission_feature_id).to.equal(2);
      expect(decodeSearchFeatureCursor(previous.pagination.next_cursor!).submission_feature_id).to.equal(3);
    });

    it('returns no cursors for an empty page', async () => {
      sinon.stub(SearchFeatureRepository.prototype, 'getReconciliationFeatures').resolves([]);
      sinon.stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties').resolves([]);
      const page = await new SearchFeatureService(getMockDBConnection()).getReconciliationFeatures(scope, 'animal', {
        limit: 2,
        sort: 'submission_feature_id',
        order: 'asc'
      });
      expect(page.features).to.deep.equal([]);
      expect(page.pagination.next_cursor).to.be.null;
      expect(page.pagination.previous_cursor).to.be.null;
    });
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
      feature_property_id: 31,
      feature_property_type_id: 1,
      name: 'name',
      display_name: 'Name',
      description: null,
      type_name: 'string',
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
        blueprint_feature_type_property_id: null,
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
        await service.searchFeaturesByExpressionTree('does-not-exist', null);
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

      const result = await service.searchFeaturesByExpressionTree('survey', null, undefined, {
        type: 'user',
        systemUserId: 42
      });

      expect(repoStub).to.have.been.calledOnce;
      expect(repoStub.firstCall.args).to.deep.equal([
        'survey',
        null,
        undefined,
        { type: 'user', systemUserId: 42 },
        undefined
      ]);
      expect(result).to.equal(mockFeatures);
    });
  });

  describe('admin upload search', () => {
    for (const filters of [{}, { expression: null }]) {
      it(`searches and counts the whole upload without normalizing ${JSON.stringify(filters)}`, async () => {
        const service = new SearchFeatureService(getMockDBConnection());
        const normalize = sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize');
        const search = sinon
          .stub(SearchFeatureRepository.prototype, 'searchSubmissionUploadFeatures')
          .resolves(mockFeatures);
        const count = sinon
          .stub(SearchFeatureRepository.prototype, 'countSubmissionUploadFeatures')
          .resolves(mockFeatures.length);

        const page = await service.searchSubmissionUploadFeatures(7, 'upload', filters);
        const total = await service.countSubmissionUploadFeatures(7, 'upload', filters);

        expect(normalize).not.called;
        expect(search).calledOnceWithExactly(7, 'upload', { expression: null }, sinon.match.object);
        expect(count).calledOnceWithExactly(7, 'upload', { expression: null });
        expect(page.features).deep.equal(mockFeatures);
        expect(total).equal(page.features.length);
      });
    }

    it('returns a mixed-type page scoped to both identifiers without metadata or public-access probes', async () => {
      const service = new SearchFeatureService(getMockDBConnection());
      const typeLookup = sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName');
      const normalize = sinon
        .stub(ExpressionTreeNormalizationService.prototype, 'normalize')
        .resolves(normalizedExpression);
      const search = sinon
        .stub(SearchFeatureRepository.prototype, 'searchSubmissionUploadFeatures')
        .resolves(mockFeatures);
      const metadata = sinon.stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties');
      const inaccessible = sinon.stub(
        SearchFeatureRepository.prototype,
        'hasInaccessibleSecuredFeaturesByExpressionTree'
      );
      const pagination = { limit: 10, sort: 'submission_feature_id' as const, order: 'asc' as const };
      const result = await service.searchSubmissionUploadFeatures(
        7,
        'upload',
        { expression: expressionTree },
        pagination
      );
      expect(normalize).calledOnceWithExactly(expressionTree);
      expect(search).calledOnceWithExactly(
        7,
        'upload',
        { expression: normalizedExpression },
        sinon.match({ limit: 11 })
      );
      expect(typeLookup).not.called;
      expect(metadata).not.called;
      expect(inaccessible).not.called;
      expect(result).to.have.all.keys('features', 'pagination');
      expect(result.features).deep.equal(mockFeatures);
    });

    it('counts with the same expression, scope, and administrator context', async () => {
      const service = new SearchFeatureService(getMockDBConnection());
      sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize').resolves(normalizedExpression);
      const count = sinon.stub(SearchFeatureRepository.prototype, 'countSubmissionUploadFeatures').resolves(2);
      expect(await service.countSubmissionUploadFeatures(7, 'upload', { expression: expressionTree })).equal(2);
      expect(count).calledOnceWithExactly(7, 'upload', { expression: normalizedExpression });
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
      expect(searchStub.firstCall.args).to.deep.equal([
        'survey',
        normalizedExpression,
        { limit: 26, sort: 'relevancy_score', order: 'desc', boundary: undefined },
        { type: 'anonymous' },
        undefined
      ]);
      expect(propertiesStub).to.have.been.calledOnceWith('survey');
      expect(hiddenSecuredStub).to.have.been.calledOnceWith('survey', normalizedExpression, { type: 'anonymous' });
      expect(result).to.deep.equal({
        features: mockFeatures,
        properties: mockProperties,
        has_inaccessible_secured_features: true,
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
      sinon
        .stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree')
        .resolves([...mockFeatures, { ...mockFeatures[0], submission_feature_id: 2 }]);
      sinon.stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties').resolves(mockProperties);
      sinon.stub(SearchFeatureRepository.prototype, 'hasInaccessibleSecuredFeaturesByExpressionTree').resolves(false);

      const result = await service.searchFeaturesByExpressionTreeWithMetadata(
        'survey',
        null,
        { limit: 1, sort: 'create_date', order: 'desc' },
        { type: 'anonymous' }
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
        null,
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
        { type: 'anonymous' }
      );

      expect(decodeSearchFeatureCursor(result.pagination.previous_cursor!)).to.include({
        direction: 'previous',
        submission_feature_id: 1
      });
    });
  });

  describe('directional cursor lookahead', () => {
    for (const direction of [undefined, 'next', 'previous'] as const) {
      for (const rowCount of [0, 1, 2, 3]) {
        it(`trims ${rowCount} rows for ${direction ?? 'initial'} requests at limit 2`, async () => {
          const service = new SearchFeatureService(getMockDBConnection());
          const rows = Array.from({ length: rowCount }, (_, index) => ({
            ...mockFeatures[0],
            submission_feature_id: index + 1
          }));
          sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
          const search = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByExpressionTree').resolves(rows);
          sinon.stub(SearchFeatureRepository.prototype, 'getFeatureTypeProperties').resolves([]);
          sinon
            .stub(SearchFeatureRepository.prototype, 'hasInaccessibleSecuredFeaturesByExpressionTree')
            .resolves(false);
          const boundary = direction
            ? { direction, submission_feature_id: 10, create_date: mockFeatures[0].create_date }
            : undefined;
          const result = await service.searchFeaturesByExpressionTreeWithMetadata('survey', null, {
            limit: 2,
            boundary
          });
          expect(search.firstCall.args[2]?.limit).to.equal(3);
          const expected = direction === 'previous' ? rows.slice(-2) : rows.slice(0, 2);
          expect(result.features).to.deep.equal(expected);
          expect(result.pagination.limit).to.equal(2);
          const hasNext = rowCount > 0 && (direction === 'previous' || rowCount > 2);
          const hasPrevious = rowCount > 0 && (direction === 'previous' ? rowCount > 2 : direction === 'next');
          expect(!!result.pagination.next_cursor).to.equal(hasNext);
          expect(!!result.pagination.previous_cursor).to.equal(hasPrevious);
          if (hasNext) {
            expect(decodeSearchFeatureCursor(result.pagination.next_cursor!).submission_feature_id).to.equal(
              expected.at(-1)!.submission_feature_id
            );
          }
          if (hasPrevious) {
            expect(decodeSearchFeatureCursor(result.pagination.previous_cursor!).submission_feature_id).to.equal(
              expected[0].submission_feature_id
            );
          }
        });
      }
    }
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
    expect(searchStub.firstCall.args).to.deep.equal([
      'survey',
      normalizedExpression,
      undefined,
      { type: 'anonymous' },
      undefined
    ]);
  });

  it('passes the same deduplicated range expression to result and count queries', async () => {
    const service = new SearchFeatureService(getMockDBConnection());
    const lowerBound = {
      type: 'predicate',
      feature_property_id: 14,
      blueprint_feature_type_property_id: null,
      feature_property_type_id: 5,
      feature_property_type_name: 'number',
      operator: 'GreaterThan',
      value: 7,
      internal_predicate: { type: 'number', operator: 'GreaterThan', value: 7 }
    } as const;
    const upperBound = {
      type: 'predicate',
      feature_property_id: 14,
      blueprint_feature_type_property_id: null,
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

      const result = await service.countSearchFeaturesByExpressionTree('survey', expressionTree, {
        type: 'user',
        systemUserId: 91
      });

      expect(normalizeStub).to.have.been.calledOnceWith(expressionTree);
      expect(countStub.firstCall.args).to.deep.equal([
        'survey',
        normalizedExpression,
        { type: 'user', systemUserId: 91 },
        undefined
      ]);
      expect(result).to.equal(42_000);
    });

    it('does not normalize when the expression is null', async () => {
      const service = new SearchFeatureService(getMockDBConnection());

      sinon.stub(SubmissionRepository.prototype, 'getFeatureTypeIdByName').resolves({ feature_type_id: 7 });
      const normalizeStub = sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize');
      const countStub = sinon
        .stub(SearchFeatureRepository.prototype, 'countFeaturesByExpressionTree')
        .resolves(5_000_000);

      const result = await service.countSearchFeaturesByExpressionTree('survey', null, { type: 'anonymous' });

      expect(normalizeStub).to.not.have.been.called;
      expect(countStub.firstCall.args).to.deep.equal(['survey', null, { type: 'anonymous' }, undefined]);
      expect(result).to.equal(5_000_000);
    });
  });
});
