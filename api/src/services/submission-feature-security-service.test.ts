import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { SubmissionFeatureSecurityService } from './submission-feature-security-service';

describe('SubmissionFeatureSecurityService assignment-state scope', () => {
  afterEach(() => sinon.restore());

  const expression: ExpressionTree = {
    type: 'expression',
    operator: 'AND',
    clauses: [{ type: 'predicate', feature_property_id: 1, feature_type_property_id: null, operator: 'Exists' }]
  };
  const normalizedExpression: NormalizedExpressionTree = {
    type: 'expression',
    operator: 'AND',
    clauses: []
  };
  const pagination = { page: 1, limit: 10 };

  for (const submissionFeatureIds of [undefined, [], [12]]) {
    for (const filterExpression of [undefined, expression]) {
      it(`resolves IDs ${JSON.stringify(submissionFeatureIds)} and expression ${Boolean(
        filterExpression
      )} before querying`, async () => {
        const service = new SubmissionFeatureSecurityService(getMockDBConnection());
        const normalize = sinon
          .stub(service.expressionTreeNormalizationService, 'normalize')
          .resolves(normalizedExpression);
        const query = sinon
          .stub(service.submissionFeatureSecurityRepository, 'getSubmissionFeatureSecuritySelectedRules')
          .resolves({ rules: [], total: 0 });

        await service.getSubmissionFeatureSecuritySelectedRules(
          7,
          'upload',
          {
            keyword: 'sensitive',
            submissionFeatureIds,
            expression: filterExpression
          },
          pagination
        );

        const explicitIds = submissionFeatureIds?.length ? submissionFeatureIds : undefined;
        const usesExpression = !explicitIds && Boolean(filterExpression);
        if (usesExpression) {
          sinon.assert.calledOnceWithExactly(normalize, expression);
        } else {
          sinon.assert.notCalled(normalize);
        }
        let featureScope = {};
        if (explicitIds) {
          featureScope = { submissionFeatureIds: explicitIds };
        } else if (usesExpression) {
          featureScope = { expression: normalizedExpression };
        }
        sinon.assert.calledOnceWithExactly(
          query,
          7,
          'upload',
          {
            ...featureScope,
            keyword: 'sensitive'
          },
          pagination
        );
        expect(query.firstCall.args[2].submissionFeatureIds).not.to.deep.equal([]);
      });
    }
  }
  for (const method of [
    'insertSubmissionFeatureSecurity',
    'deleteSubmissionFeatureSecurityRules',
    'deleteSubmissionFeatureSecurity'
  ] as const) {
    for (const submissionFeatureIds of [undefined, [], [12]]) {
      for (const scopeExpression of [undefined, expression]) {
        it(`${method} normalizes IDs ${JSON.stringify(submissionFeatureIds)} and expression ${Boolean(
          scopeExpression
        )}`, async () => {
          const service = new SubmissionFeatureSecurityService(getMockDBConnection());
          const normalize = sinon
            .stub(service.expressionTreeNormalizationService, 'normalize')
            .resolves(normalizedExpression);
          const mutate = sinon.stub(service.submissionFeatureSecurityRepository, method).resolves();
          const input = {
            submissionId: 7,
            submissionUploadId: 'upload',
            featureScope: { submissionFeatureIds, expression: scopeExpression },
            securityRuleIds: [8],
            submissionUploadReviewId: 'review'
          };

          await service[method](input);

          let featureScope = {};
          if (submissionFeatureIds?.length) {
            featureScope = { submissionFeatureIds };
            sinon.assert.notCalled(normalize);
          } else if (scopeExpression) {
            featureScope = { expression: normalizedExpression };
            sinon.assert.calledOnceWithExactly(normalize, expression);
          } else {
            sinon.assert.notCalled(normalize);
          }
          sinon.assert.calledOnceWithExactly(mutate, { ...input, featureScope });
        });
      }
    }
  }
});
