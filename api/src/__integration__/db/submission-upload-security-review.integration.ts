import { expect } from 'chai';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError, ApiValidationError } from '../../errors/api-error';
import { ExpressionTree } from '../../models/expression-tree';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../../models/submission-upload-review';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { SubmissionFeatureSecurityRepository } from '../../repositories/submission-feature-security-repository';
import { SubmissionUploadSecurityRepository } from '../../repositories/submission-upload-security-repository';
import { SearchFeatureService } from '../../services/search-feature-service';
import { SecurityRuleService } from '../../services/security-rule-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { SubmissionUploadSecurityService } from '../../services/submission-upload-security-service';
import { SubmissionUploadReviewSecurityService } from '../../services/upload/submission-upload-review-security-service';
import { SubmissionUploadReviewService } from '../../services/upload/submission-upload-review-service';
import { decodeSearchFeatureCursor } from '../../utils/pagination';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

// Every fixture and mutation is rolled back, including review completion and reset.
describe('Submission upload security review (integration)', function () {
  this.timeout(20000);
  let connection: IDBConnection;
  let submissionId: number;
  let submissionUploadId: string;
  let otherUploadId: string;
  let parentId: number;
  let childId: number;
  let otherId: number;
  let reviewA: string;
  let reviewB: string;
  let securityRuleId: number;
  let secondRuleId: number;
  let service: SubmissionUploadReviewSecurityService;
  let reviewService: SubmissionUploadReviewService;
  let repository: SubmissionFeatureSecurityRepository;
  const pagination = { page: 1, limit: 50 };

  /**
   * Seed explicit historical assignments independently of the review mutation API.
   * @param {object} input Fixture feature IDs, rules, and optional historical provenance.
   * @returns {Promise<void>} Resolves after creating the fixture assignments.
   */
  async function insertSecurityFixture(input: {
    submissionId: number;
    submissionFeatureIds: number[];
    securityRuleIds: number[];
    submissionUploadReviewId?: string;
  }): Promise<void> {
    await connection.sql(SQL`INSERT INTO submission_feature_security
      (submission_feature_id, security_rule_id, submission_upload_review_id, record_effective_date)
      SELECT sf.submission_feature_id, rule_id, ${input.submissionUploadReviewId ?? null}::uuid, now()
      FROM submission_feature sf CROSS JOIN unnest(${input.securityRuleIds}::integer[]) AS rule_id
      WHERE sf.submission_id = ${input.submissionId}
        AND sf.submission_feature_id = ANY(${input.submissionFeatureIds}::integer[])
      ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING`);
  }

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionUploadReviewSecurityService(connection);
    reviewService = new SubmissionUploadReviewService(connection);
    repository = new SubmissionFeatureSecurityRepository(connection);
    submissionId = await createTestSubmission(connection);
    submissionUploadId = await createTestUpload(connection, submissionId);
    otherUploadId = await createTestUpload(connection, submissionId);
    const rules = await connection.sql(
      SQL`SELECT security_rule_id FROM security_rule WHERE record_end_date IS NULL ORDER BY security_rule_id LIMIT 2`
    );
    [securityRuleId, secondRuleId] = rules.rows.map((row) => row.security_rule_id);
    parentId = await insertFeature(submissionUploadId);
    childId = await insertFeature(submissionUploadId, parentId);
    otherId = await insertFeature(otherUploadId);
    for (const name of ['A', 'B']) {
      const review = await reviewService.insertSubmissionUploadReview(submissionId, {
        submission_upload_id: submissionUploadId,
        name,
        description: null,
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.IN_PROGRESS,
        requested_by: null
      });
      if (name === 'A') {
        reviewA = review.submission_upload_review_id;
      } else {
        reviewB = review.submission_upload_review_id;
      }
    }
  });
  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  async function insertFeature(uploadId: string, parent: number | null = null): Promise<number> {
    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date)
      VALUES (${submissionId}, ${uploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'survey' AND record_end_date IS NULL), ${parent}, '{}'::jsonb, 2, NULL)
      RETURNING submission_feature_id;
    `);
    return result.rows[0].submission_feature_id;
  }

  /** Publish only fixtures exercising the post-publication screening pathway. */
  async function publishUpload(): Promise<void> {
    await connection.sql(
      SQL`UPDATE submission_feature SET record_effective_date = now() WHERE submission_upload_id = ${submissionUploadId}::uuid`
    );
    await new SubmissionFeatureClosureService(connection).computeClosureForUpload(submissionUploadId);
  }

  /** Build pending-upload evidence also present in another upload to exercise isolation. */
  async function assignmentExpression(matches: number[] = [childId]): Promise<ExpressionTree> {
    const property = await connection.sql(SQL`
      INSERT INTO feature_property (name, display_name, feature_property_type_id)
      VALUES (gen_random_uuid()::text, 'Assignment scope', (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'))
      RETURNING feature_property_id;
    `);
    const propertyId = property.rows[0].feature_property_id;
    const typeProperty = await connection.sql(SQL`
      INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value, allow_multiple)
      VALUES ((SELECT feature_type_id FROM feature_type WHERE name = 'survey' AND record_end_date IS NULL), ${propertyId}, false, false)
      RETURNING feature_type_property_id;
    `);
    for (const id of [...matches, otherId]) {
      await connection.sql(SQL`INSERT INTO submission_feature_property_string (submission_feature_id, feature_type_property_id, value)
        VALUES (${id}, ${typeProperty.rows[0].feature_type_property_id}, 'match')`);
    }
    return {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: propertyId,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 'match'
        }
      ]
    };
  }

  for (const selected of [false, true]) {
    for (const filtered of [false, true]) {
      it(`uses selection > expression > upload for assignments (selected=${selected}, filtered=${filtered})`, async () => {
        const expression = filtered ? await assignmentExpression() : undefined;
        const ids = selected ? [parentId, otherId] : [];
        const unselectedScope = filtered ? [childId] : [parentId, childId];
        const expected = selected ? [parentId] : unselectedScope;
        await service.insertSubmissionUploadReviewSecurityRuleAssignments(
          submissionId,
          submissionUploadId,
          reviewA,
          securityRuleId,
          ids,
          expression
        );
        const assignments = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
        expect(assignments.map((row) => row.submission_feature_id)).to.have.members(expected);
        expect(assignments.every((row) => row.submission_upload_review_id === reviewA)).to.equal(true);
        await service.insertSubmissionUploadReviewSecurityRuleAssignments(
          submissionId,
          submissionUploadId,
          reviewB,
          securityRuleId,
          ids,
          expression
        );
        expect(await repository.getSubmissionFeatureSecurities([parentId, childId, otherId])).to.eql(assignments);
        await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
          submissionId,
          submissionUploadId,
          reviewA,
          securityRuleId,
          ids,
          expression
        );
        expect(await repository.getSubmissionFeatureSecurities([parentId, childId, otherId])).to.eql([]);
      });
    }
  }

  it('uses exactly the feature-search matches for removal and reset, preserving other features and rules', async () => {
    const expression = await assignmentExpression();
    const search = await new SearchFeatureService(connection).searchSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      { expression }
    );
    expect(search.features.map((row) => row.submission_feature_id)).to.eql([childId]);
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [parentId, childId, otherId],
      securityRuleIds: [securityRuleId, secondRuleId]
    });
    await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [],
      expression
    );
    expect((await repository.getSubmissionFeatureSecurities([childId])).map((row) => row.security_rule_id)).to.eql([
      secondRuleId
    ]);
    await service.deleteSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      [],
      expression
    );
    expect(await repository.getSubmissionFeatureSecurities([childId])).to.eql([]);
    expect(await repository.getSubmissionFeatureSecurities([parentId, otherId])).to.have.length(4);
    await service.deleteSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      [parentId],
      expression
    );
    expect(await repository.getSubmissionFeatureSecurities([parentId])).to.eql([]);
    expect(await repository.getSubmissionFeatureSecurities([otherId])).to.have.length(2);
  });

  for (const scope of ['selection', 'expression', 'upload'] as const) {
    for (const operation of ['remove', 'reset'] as const) {
      it(`preserves ended features during ${scope} ${operation}`, async () => {
        const expression = scope === 'expression' ? await assignmentExpression([parentId, childId]) : undefined;
        await insertSecurityFixture({
          submissionId,
          submissionFeatureIds: [parentId, childId, otherId],
          securityRuleIds: [securityRuleId]
        });
        await connection.sql(
          SQL`UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${childId}`
        );
        const ids = scope === 'selection' ? [parentId, childId, otherId] : [];
        if (operation === 'remove') {
          await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
            submissionId,
            submissionUploadId,
            reviewA,
            securityRuleId,
            ids,
            expression
          );
        } else {
          await service.deleteSubmissionUploadReviewSecurityAssignments(
            submissionId,
            submissionUploadId,
            reviewA,
            ids,
            expression
          );
        }
        const assignments = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
        expect(assignments.map((row) => row.submission_feature_id)).to.have.members([childId, otherId]);
      });
    }
    for (const lifecycle of ['expired', 'future', 'current'] as const) {
      it(`preserves current provenance and replaces obsolete event provenance for ${scope} ${lifecycle} assignments`, async () => {
        const expression = scope === 'expression' ? await assignmentExpression() : undefined;
        const event =
          await connection.sql(SQL`INSERT INTO submission_upload_security (submission_upload_id, submission_upload_review_id, status)
          VALUES (${submissionUploadId}::uuid, ${reviewB}::uuid, 'started') RETURNING submission_upload_security_id`);
        const eventId = event.rows[0].submission_upload_security_id;
        await connection.sql(SQL`INSERT INTO submission_feature_security
          (submission_feature_id, security_rule_id, submission_upload_security_id, record_effective_date, record_end_date)
          VALUES (${childId}, ${securityRuleId}, ${eventId},
            CASE WHEN ${lifecycle} = 'future' THEN now() + interval '1 day' ELSE now() - interval '2 days' END,
            CASE WHEN ${lifecycle} = 'expired' THEN now() - interval '1 day' ELSE NULL END)`);
        await service.insertSubmissionUploadReviewSecurityRuleAssignments(
          submissionId,
          submissionUploadId,
          reviewA,
          securityRuleId,
          scope === 'selection' ? [childId] : [],
          expression
        );
        const [assignment] = await repository.getSubmissionFeatureSecurities([childId]);
        expect(assignment.submission_upload_review_id).to.equal(lifecycle === 'current' ? null : reviewA);
        expect(assignment.submission_upload_security_id).to.equal(lifecycle === 'current' ? eventId : null);
      });
    }
  }

  for (const scope of ['selection', 'expression', 'upload'] as const) {
    it(`does not insert security for ended features with ${scope} scope`, async () => {
      const expression = scope === 'expression' ? await assignmentExpression([parentId, childId]) : undefined;
      await connection.sql(
        SQL`UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${childId}`
      );

      await service.insertSubmissionUploadReviewSecurityRuleAssignments(
        submissionId,
        submissionUploadId,
        reviewA,
        securityRuleId,
        scope === 'selection' ? [parentId, childId, otherId] : [],
        expression
      );

      const assignments = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
      expect(assignments.map((row) => row.submission_feature_id)).to.eql([parentId]);
    });

    for (const operation of ['remove', 'reset'] as const) {
      it(`allows ${scope} ${operation} after the assigned rule and category have ended`, async () => {
        const expression = scope === 'expression' ? await assignmentExpression([childId]) : undefined;
        await insertSecurityFixture({
          submissionId,
          submissionFeatureIds: [childId, otherId],
          securityRuleIds: [securityRuleId]
        });
        await connection.sql(
          SQL`UPDATE security_rule SET record_end_date = now() WHERE security_rule_id = ${securityRuleId}`
        );
        await connection.sql(SQL`UPDATE security_category SET record_end_date = now()
          WHERE security_category_id = (SELECT security_category_id FROM security_rule WHERE security_rule_id = ${securityRuleId})`);

        const ids = scope === 'selection' ? [childId, otherId] : [];
        if (operation === 'remove') {
          await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
            submissionId,
            submissionUploadId,
            reviewA,
            securityRuleId,
            ids,
            expression
          );
        } else {
          await service.deleteSubmissionUploadReviewSecurityAssignments(
            submissionId,
            submissionUploadId,
            reviewA,
            ids,
            expression
          );
        }
        expect(await repository.getSubmissionFeatureSecurities([childId])).to.eql([]);
        expect(await repository.getSubmissionFeatureSecurities([otherId])).to.have.length(1);
      });
    }
  }

  for (const scope of ['selection', 'upload'] as const) {
    it(`preserves current features of ended feature types for ${scope} mutations`, async () => {
      await connection.sql(SQL`UPDATE feature_type SET record_end_date = now()
        WHERE feature_type_id = (SELECT feature_type_id FROM submission_feature WHERE submission_feature_id = ${childId})`);
      const ids = scope === 'selection' ? [childId] : [];
      await service.insertSubmissionUploadReviewSecurityRuleAssignments(
        submissionId,
        submissionUploadId,
        reviewA,
        securityRuleId,
        ids
      );
      expect(await repository.getSubmissionFeatureSecurities([childId])).to.have.length(1);
      await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
        submissionId,
        submissionUploadId,
        reviewA,
        securityRuleId,
        ids
      );
      expect(await repository.getSubmissionFeatureSecurities([childId])).to.eql([]);
      await service.insertSubmissionUploadReviewSecurityRuleAssignments(
        submissionId,
        submissionUploadId,
        reviewA,
        securityRuleId,
        ids
      );
      await service.deleteSubmissionUploadReviewSecurityAssignments(submissionId, submissionUploadId, reviewA, ids);
      expect(await repository.getSubmissionFeatureSecurities([childId])).to.eql([]);
    });
  }

  it('never broadens zero expression matches into whole-upload mutation or applied state', async () => {
    const expression = await assignmentExpression([]);
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [],
      expression
    );
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId, otherId])).to.eql([]);
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [parentId, childId, otherId],
      securityRuleIds: [securityRuleId]
    });
    const before = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
    await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [],
      expression
    );
    await service.deleteSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      [],
      expression
    );
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId, otherId])).to.eql(before);
    const state = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { expression },
      pagination
    );
    expect(state.rules.every((row) => !row.applied)).to.equal(true);
  });

  it('calculates direct applied state over expression matches or an overriding selection', async () => {
    const secondMatch = await insertFeature(submissionUploadId);
    const expression = await assignmentExpression([childId, secondMatch]);
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [childId],
      securityRuleIds: [securityRuleId]
    });
    const partial = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { expression },
      pagination
    );
    expect(partial.rules.find((row) => row.security_rule_id === securityRuleId)?.applied).to.equal(false);
    const selected = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { expression, submissionFeatureIds: [childId] },
      pagination
    );
    expect(selected.rules.find((row) => row.security_rule_id === securityRuleId)?.applied).to.equal(true);
    const disjointExpression = await assignmentExpression([secondMatch]);
    const outsideExpression = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { expression: disjointExpression, submissionFeatureIds: [childId] },
      pagination
    );
    expect(outsideExpression.rules.find((row) => row.security_rule_id === securityRuleId)?.applied).to.equal(true);
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [secondMatch],
      securityRuleIds: [securityRuleId]
    });
    const complete = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { expression, submissionFeatureIds: [] },
      pagination
    );
    expect(complete.rules.find((row) => row.security_rule_id === securityRuleId)?.applied).to.equal(true);
    expect(await repository.getSubmissionFeatureSecurities([parentId])).to.eql([]);
  });

  it('shows direct and inherited security for pending upload features without closure rows', async () => {
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [parentId]
    );
    const direct = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      parentId,
      pagination
    );
    const inherited = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      childId,
      pagination
    );
    expect(direct.rules[0]).to.include({ security_rule_id: securityRuleId, provenance: 'direct' });
    expect(inherited.rules[0]).to.include({ security_rule_id: securityRuleId, provenance: 'inherited' });
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [childId]
    );
    const both = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      childId,
      pagination
    );
    expect(both.rules[0]).to.include({ security_rule_id: securityRuleId, provenance: 'direct' });
  });

  it('uses the upload hierarchy even when published closure contains different ancestry', async () => {
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [otherId],
      securityRuleIds: [securityRuleId]
    });
    await connection.sql(SQL`INSERT INTO submission_feature_closure
      (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      VALUES (${childId}, ${otherId}, true)`);
    const details = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      childId,
      pagination
    );
    expect(details.rules).to.eql([]);
  });

  it('keeps pending ancestry traversal inside the upload and terminates on cycles', async () => {
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [otherId],
      securityRuleIds: [securityRuleId]
    });
    await connection.sql(
      SQL`UPDATE submission_feature SET parent_submission_feature_id = ${otherId} WHERE submission_feature_id = ${parentId}`
    );
    const outside = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      childId,
      pagination
    );
    expect(outside.rules).to.eql([]);
    await connection.sql(
      SQL`UPDATE submission_feature SET parent_submission_feature_id = ${childId} WHERE submission_feature_id = ${parentId}`
    );
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      secondRuleId,
      [parentId]
    );
    const cycleRules = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      childId,
      pagination
    );
    expect(cycleRules.rules).to.have.length(1);
    expect(cycleRules.rules[0]).to.include({
      security_rule_id: secondRuleId,
      provenance: 'inherited'
    });
  });

  it('does not insert or reactivate assignments for a soft-deleted rule', async () => {
    const rule = await connection.sql(SQL`INSERT INTO security_rule (name, description, security_category_id)
      SELECT 'Deleted assignment regression', 'Rollback-only test', security_category_id FROM security_rule WHERE security_rule_id = ${securityRuleId}
      RETURNING security_rule_id`);
    const deletedId = rule.rows[0].security_rule_id;
    await connection.sql(SQL`INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, record_effective_date, record_end_date)
      VALUES (${parentId}, ${deletedId}, now() - interval '2 days', now() - interval '1 day')`);
    const ruleService = new SecurityRuleService(connection);
    await ruleService.deleteSecurityRule(deletedId);
    for (const featureIds of [[parentId, childId], []]) {
      let error: unknown;
      try {
        await service.insertSubmissionUploadReviewSecurityRuleAssignments(
          submissionId,
          submissionUploadId,
          reviewA,
          deletedId,
          featureIds
        );
      } catch (error_) {
        error = error_;
      }
      expect(error).to.be.instanceOf(ApiValidationError);
    }
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
    // Old assignments must respect catalog and feature-rule lifecycle filtering.
    await connection.sql(
      SQL`UPDATE submission_feature_security SET record_end_date = NULL WHERE submission_feature_id = ${parentId} AND security_rule_id = ${deletedId}`
    );
    const catalog = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      {},
      pagination
    );
    const details = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      parentId,
      pagination
    );
    expect(catalog.rules.some((rule) => rule.security_rule_id === deletedId)).to.equal(false);
    expect(details.rules).to.eql([]);
  });

  it('paginates applied rules before alphabetically earlier unapplied rules for the selected features', async () => {
    await connection.sql(SQL`
      UPDATE security_rule SET name = CASE security_rule_id
        WHEN ${securityRuleId} THEN 'ordering-check Z applied'
        ELSE 'ordering-check A unapplied' END
      WHERE security_rule_id IN (${securityRuleId}, ${secondRuleId});
    `);
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [parentId, childId]
    );
    const first = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { keyword: 'ordering-check', submissionFeatureIds: [parentId, childId] },
      { page: 1, limit: 1, sort: 'applied', order: 'desc' }
    );
    const second = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { keyword: 'ordering-check', submissionFeatureIds: [parentId, childId] },
      { page: 2, limit: 1, sort: 'applied', order: 'desc' }
    );
    expect(first.rules.map((rule) => rule.security_rule_id)).to.eql([securityRuleId]);
    expect(first.rules[0].applied).to.equal(true);
    expect(second.rules.map((rule) => rule.security_rule_id)).to.eql([secondRuleId]);
    expect(second.rules[0].applied).to.equal(false);
    expect(first.pagination.total).to.equal(2);
  });

  it('enforces upload scope, multiple rules, idempotency, and cross-review provenance', async () => {
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      []
    );
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewB,
      securityRuleId,
      [parentId, otherId]
    );
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewB,
      secondRuleId,
      [parentId]
    );
    const assignments = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
    expect(assignments).to.have.length(3);
    expect(
      assignments.filter((row) => row.security_rule_id === securityRuleId).map((row) => row.submission_upload_review_id)
    ).to.eql([reviewA, reviewA]);
    expect(assignments.some((row) => row.submission_feature_id === otherId)).to.equal(false);
    const result = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewB,
      {},
      pagination
    );
    expect(result.rules.find((row) => row.security_rule_id === securityRuleId)?.applied).to.equal(true);
    await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewB,
      securityRuleId,
      []
    );
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.have.length(1);
  });

  it('reports only full direct coverage as applied and keeps every operation inside the reviewed upload', async () => {
    const foreignRules = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewA,
      otherId,
      pagination
    );
    expect(foreignRules.rules).deep.equal([]);
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [otherId],
      securityRuleIds: [securityRuleId]
    });
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [parentId, otherId]
    );
    const partial = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { submissionFeatureIds: [parentId, childId] },
      pagination
    );
    expect(partial.rules.find((rule) => rule.security_rule_id === securityRuleId)?.applied).to.equal(false);
    expect(partial.rules.every((rule) => !('provenance' in rule))).to.equal(true);
    const foreignOnly = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { submissionFeatureIds: [otherId] },
      pagination
    );
    expect(foreignOnly.rules.every((rule) => !rule.applied)).to.equal(true);
    const single = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      { submissionFeatureIds: [parentId] },
      pagination
    );
    expect(single.rules.find((rule) => rule.security_rule_id === securityRuleId)?.applied).to.equal(true);

    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewB,
      securityRuleId,
      []
    );
    const before = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewB,
      securityRuleId,
      []
    );
    const after = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
    expect(after).to.deep.equal(before);
    expect(after.find((row) => row.submission_feature_id === parentId)?.submission_upload_review_id).to.equal(reviewA);
    expect(after.find((row) => row.submission_feature_id === childId)?.submission_upload_review_id).to.equal(reviewB);
    const all = await service.getSubmissionUploadReviewSecurityAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      {},
      pagination
    );
    expect(all.rules.find((rule) => rule.security_rule_id === securityRuleId)?.applied).to.equal(true);

    for (let attempt = 0; attempt < 2; attempt++) {
      await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
        submissionId,
        submissionUploadId,
        reviewA,
        securityRuleId,
        [childId, otherId]
      );
    }
    expect(await repository.getSubmissionFeatureSecurities([childId])).to.have.length(0);
    expect(await repository.getSubmissionFeatureSecurities([parentId, otherId])).to.have.length(2);
    for (let attempt = 0; attempt < 2; attempt++) {
      await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
        submissionId,
        submissionUploadId,
        reviewA,
        securityRuleId,
        []
      );
      await service.deleteSubmissionUploadReviewSecurityAssignments(submissionId, submissionUploadId, reviewA, []);
    }
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.have.length(0);
    expect(await repository.getSubmissionFeatureSecurities([otherId])).to.have.length(1);
  });

  it('counts inherited coverage once and reset leaves other uploads unchanged', async () => {
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [otherId],
      securityRuleIds: [securityRuleId]
    });
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [parentId]
    );
    const rules = await service.getSubmissionUploadReviewFeatureSecurityRules(
      submissionId,
      submissionUploadId,
      reviewB,
      childId,
      pagination
    );
    expect(rules.rules[0].provenance).to.equal('inherited');
    const otherSubmissionId = await createTestSubmission(connection);
    expect(
      await repository.deleteSubmissionFeatureSecurity({
        submissionId: otherSubmissionId,
        submissionUploadId: submissionUploadId,
        featureScope: {}
      })
    ).to.equal(undefined);
    expect(await repository.getSubmissionFeatureSecurities([parentId])).to.have.length(1);
    await service.deleteSubmissionUploadReviewSecurityAssignments(submissionId, submissionUploadId, reviewB);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
    expect(await repository.getSubmissionFeatureSecurities([otherId])).to.have.length(1);
  });

  it('deduplicates repeated rule IDs when inserting and reactivating assignments', async () => {
    const input = {
      submissionId,
      submissionUploadId,
      featureScope: { submissionFeatureIds: [childId, childId] },
      securityRuleIds: [securityRuleId, securityRuleId],
      submissionUploadReviewId: reviewA
    };
    const domain = service.submissionFeatureSecurityService;
    await domain.insertSubmissionFeatureSecurity(input);
    expect(await repository.getSubmissionFeatureSecurities([childId])).to.have.length(1);

    await connection.sql(SQL`UPDATE submission_feature_security SET record_end_date = now() - interval '1 day'
      WHERE submission_feature_id = ${childId} AND security_rule_id = ${securityRuleId}`);
    await domain.insertSubmissionFeatureSecurity({ ...input, submissionUploadReviewId: reviewB });
    const assignments = await repository.getSubmissionFeatureSecurities([childId]);
    expect(assignments).to.have.length(1);
    expect(assignments[0].submission_upload_review_id).to.equal(reviewB);
  });

  it('keeps empty review rule lists as no-ops', async () => {
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [parentId, childId, otherId],
      securityRuleIds: [securityRuleId]
    });
    const before = await repository.getSubmissionFeatureSecurities([parentId, childId, otherId]);
    for (const featureScope of [
      {},
      { submissionFeatureIds: [parentId] },
      { expression: await assignmentExpression() }
    ]) {
      const domain = service.submissionFeatureSecurityService;
      await domain.insertSubmissionFeatureSecurity({
        submissionId,
        submissionUploadId,
        featureScope,
        securityRuleIds: [],
        submissionUploadReviewId: reviewA
      });
      await domain.deleteSubmissionFeatureSecurityRules({
        submissionId,
        submissionUploadId,
        featureScope,
        securityRuleIds: []
      });
      expect(await repository.getSubmissionFeatureSecurities([parentId, childId, otherId])).to.eql(before);
    }
  });

  it('resets only selected upload features, with an empty selection resetting the whole upload', async () => {
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [parentId, childId, otherId],
      securityRuleIds: [securityRuleId, secondRuleId]
    });
    await service.deleteSubmissionUploadReviewSecurityAssignments(submissionId, submissionUploadId, reviewA, [
      childId,
      otherId
    ]);
    expect(await repository.getSubmissionFeatureSecurities([childId])).to.eql([]);
    expect(await repository.getSubmissionFeatureSecurities([parentId])).to.have.length(2);
    expect(await repository.getSubmissionFeatureSecurities([otherId])).to.have.length(2);

    await service.deleteSubmissionUploadReviewSecurityAssignments(submissionId, submissionUploadId, reviewA, []);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
    expect(await repository.getSubmissionFeatureSecurities([otherId])).to.have.length(2);
  });

  it('allows apply, remove, and reset on completed reviews while retaining ownership validation', async () => {
    await reviewService.updateSubmissionUploadReview(submissionId, submissionUploadId, reviewA, {
      status: SubmissionUploadReviewStatus.COMPLETED
    });
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      []
    );
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.have.length(2);
    await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [childId]
    );
    expect(await repository.getSubmissionFeatureSecurities([childId])).to.have.length(0);
    expect(await repository.getSubmissionFeatureSecurities([parentId])).to.have.length(1);
    await service.deleteSubmissionUploadReviewSecurityAssignments(submissionId, submissionUploadId, reviewA);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.have.length(0);
    const review = await reviewService.getSubmissionUploadReview(submissionId, submissionUploadId, reviewA);
    expect(review.status).to.equal(SubmissionUploadReviewStatus.COMPLETED);
    let rejected = false;
    try {
      await service.insertSubmissionUploadReviewSecurityRuleAssignments(
        submissionId,
        otherUploadId,
        reviewA,
        securityRuleId,
        []
      );
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(true);
  });

  it('rejects non-security review reads and reset without deleting assignments', async () => {
    const validationReview = await reviewService.insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: 'Validation review',
      description: null,
      scope: SubmissionUploadReviewScope.VALIDATION,
      status: SubmissionUploadReviewStatus.IN_PROGRESS,
      requested_by: null
    });
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [parentId],
      securityRuleIds: [securityRuleId]
    });
    for (const operation of [
      () =>
        service.getSubmissionUploadReviewFeatureSecurityRules(
          submissionId,
          submissionUploadId,
          validationReview.submission_upload_review_id,
          parentId,
          pagination
        ),
      () =>
        service.deleteSubmissionUploadReviewSecurityAssignments(
          submissionId,
          submissionUploadId,
          validationReview.submission_upload_review_id
        )
    ]) {
      let caught: unknown;
      try {
        await operation();
      } catch (error) {
        caught = error;
      }
      expect(caught).to.be.instanceOf(ApiValidationError);
    }
    expect(await repository.getSubmissionFeatureSecurities([parentId])).to.have.length(1);
  });

  it('creates distinct completed reviews and linked events without changing assignments', async () => {
    await publishUpload();
    const screening = new SubmissionUploadSecurityService(connection);
    await insertSecurityFixture({
      submissionId,
      submissionFeatureIds: [parentId],
      securityRuleIds: [securityRuleId],
      submissionUploadReviewId: reviewA
    });
    const first = await repository.getSubmissionFeatureSecurities([parentId, childId]);
    await screening.screenSubmissionUpload(submissionUploadId, submissionId, null);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.deep.equal(first);
    await screening.screenSubmissionUpload(submissionUploadId, submissionId, null);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.deep.equal(first);
    const events = await connection.sql(SQL`
      SELECT e.submission_upload_review_id, e.status AS event_status, e.metadata,
        r.submission_upload_id, r.scope, r.status, r.name, r.description, r.requested_by
      FROM submission_upload_security e JOIN submission_upload_review r USING (submission_upload_review_id)
      WHERE e.submission_upload_id = ${submissionUploadId}::uuid ORDER BY e.submission_upload_security_id
    `);
    expect(events.rows).to.have.length(2);
    expect(new Set(events.rows.map((row) => row.submission_upload_review_id)).size).to.equal(2);
    for (const event of events.rows) {
      expect(event).to.include({
        submission_upload_id: submissionUploadId,
        scope: 'security',
        status: 'completed',
        event_status: 'completed',
        name: 'Automatic security screening',
        description: null,
        requested_by: connection.systemUserId()
      });
    }
    expect(events.rows.map((row) => row.metadata.insertedCount)).to.eql([0, 0]);
    for (const assignment of first) {
      expect(assignment).to.include({
        submission_upload_review_id: reviewA,
        submission_upload_security_id: null
      });
    }
  });

  it('completes an automatic review and event without fetching or applying rules', async () => {
    await publishUpload();
    const screening = new SubmissionUploadSecurityService(connection);
    const getRules = sinon
      .stub(SecurityRuleService.prototype, 'getScreenableSecurityRules')
      .rejects(new Error('Rule fetching is deferred'));
    await screening.screenSubmissionUpload(submissionUploadId, submissionId, null);
    const events = await connection.sql(SQL`
      SELECT e.status, e.metadata, r.status AS review_status FROM submission_upload_security e
      JOIN submission_upload_review r USING (submission_upload_review_id)
      WHERE e.submission_upload_id = ${submissionUploadId}::uuid
    `);
    expect(events.rows).to.eql([
      { status: 'completed', review_status: 'completed', metadata: { ruleCount: 0, insertedCount: 0 } }
    ]);
    sinon.assert.notCalled(getRules);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
  });

  it('records an exhausted screening attempt with a blocked review and no assignments', async () => {
    const screening = new SubmissionUploadSecurityService(connection);
    await screening.recordSubmissionUploadSecurityFailure(submissionUploadId, submissionId, null);
    const events = await connection.sql(SQL`
      SELECT e.status, r.status AS review_status, r.scope, r.requested_by FROM submission_upload_security e
      JOIN submission_upload_review r USING (submission_upload_review_id)
      WHERE e.submission_upload_id = ${submissionUploadId}::uuid
    `);
    expect(events.rows).to.eql([
      { status: 'failed', review_status: 'blocked', scope: 'security', requested_by: connection.systemUserId() }
    ]);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
  });

  it('rolls back the automatic review and event after completion fails', async () => {
    await publishUpload();
    const screening = new SubmissionUploadSecurityService(connection);
    const failure = new Error('Review completion failed');
    sinon.stub(SubmissionUploadReviewService.prototype, 'updateSubmissionUploadReview').rejects(failure);
    await connection.sql(SQL`SAVEPOINT screening_attempt`);
    let caught: unknown;
    try {
      await screening.screenSubmissionUpload(submissionUploadId, submissionId, null);
    } catch (error) {
      caught = error;
    }
    expect(caught).to.equal(failure);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
    await connection.sql(SQL`ROLLBACK TO SAVEPOINT screening_attempt`);
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
    const events = await connection.sql(
      SQL`SELECT * FROM submission_upload_security WHERE submission_upload_id = ${submissionUploadId}::uuid`
    );
    expect(events.rows).to.eql([]);
    const reviews = await connection.sql(
      SQL`SELECT * FROM submission_upload_review WHERE submission_upload_id = ${submissionUploadId}::uuid AND name = 'Automatic security screening'`
    );
    expect(reviews.rows).to.eql([]);
  });

  it('reactivates legacy assignments with review provenance and clears obsolete event attribution', async () => {
    await publishUpload();
    const event =
      await connection.sql(SQL`INSERT INTO submission_upload_security (submission_upload_id, submission_upload_review_id, status)
      VALUES (${submissionUploadId}::uuid, ${reviewB}::uuid, 'completed') RETURNING submission_upload_security_id`);
    await connection.sql(SQL`INSERT INTO submission_feature_security
      (submission_feature_id, security_rule_id, submission_upload_security_id, record_effective_date, record_end_date)
      VALUES (${parentId}, ${securityRuleId}, ${event.rows[0].submission_upload_security_id}, now() - interval '2 days', now() - interval '1 day')`);
    await repository.insertSubmissionFeatureSecurity({
      submissionId: submissionId,
      submissionUploadId: submissionUploadId,
      featureScope: { submissionFeatureIds: [parentId, childId] },
      securityRuleIds: [securityRuleId],
      submissionUploadReviewId: reviewA
    });
    const assignments = await repository.getSubmissionFeatureSecurities([parentId, childId]);
    expect(assignments).to.have.length(2);
    for (const assignment of assignments) {
      expect(assignment).to.include({
        submission_upload_review_id: reviewA,
        submission_upload_security_id: null,
        record_end_date: null
      });
    }
  });

  it('requires a review for every event and rejects sharing a review between events', async () => {
    const events = new SubmissionUploadSecurityRepository(connection);
    await events.insertSubmissionUploadSecurity(submissionUploadId, null, reviewA);
    await events.insertSubmissionUploadSecurity(submissionUploadId, null, reviewB);
    for (const [reviewId, expectedMessage] of [
      [null, 'violates not-null constraint'],
      [reviewA, 'submission_upload_security_review_uk']
    ] as const) {
      await connection.sql(SQL`SAVEPOINT invalid_event_review`);
      let caught: unknown;
      try {
        await connection.sql(SQL`INSERT INTO submission_upload_security (submission_upload_id, submission_upload_review_id)
          VALUES (${submissionUploadId}::uuid, ${reviewId}::uuid)`);
      } catch (error_) {
        caught = error_;
      }
      await connection.sql(SQL`ROLLBACK TO SAVEPOINT invalid_event_review`);
      expect(caught).to.be.instanceOf(ApiExecuteSQLError);
      expect((caught as ApiExecuteSQLError).errors[0])
        .to.have.property('message')
        .that.includes(expectedMessage);
    }
    const rows = await connection.sql(
      SQL`SELECT submission_upload_review_id FROM submission_upload_security WHERE submission_upload_id = ${submissionUploadId}::uuid`
    );
    expect(rows.rows.map((row) => row.submission_upload_review_id)).to.have.members([reviewA, reviewB]);
  });

  it('copies review provenance and expiry to a successor without creating a review', async () => {
    await publishUpload();
    await repository.insertSubmissionFeatureSecurity({
      submissionId: submissionId,
      submissionUploadId: submissionUploadId,
      featureScope: { submissionFeatureIds: [parentId, childId] },
      securityRuleIds: [securityRuleId],
      submissionUploadReviewId: reviewA
    });
    await connection.sql(SQL`UPDATE submission_feature_security SET record_end_date = now() + interval '1 day'
      WHERE submission_feature_id = ${parentId} AND security_rule_id = ${securityRuleId}`);
    await connection.sql(
      SQL`UPDATE submission_feature SET source_id = 'automatic-review-copy' WHERE submission_feature_id = ${parentId}`
    );
    await connection.sql(SQL`UPDATE submission_feature SET source_id = 'automatic-review-copy', reconciliation = 'modified', record_effective_date = NULL
      WHERE submission_feature_id = ${otherId}`);
    const original =
      await connection.sql(SQL`SELECT submission_upload_review_id, record_end_date FROM submission_feature_security
      WHERE submission_feature_id = ${parentId} AND security_rule_id = ${securityRuleId}`);
    await repository.copySubmissionFeatureSecurityToSuccessors(otherUploadId, submissionUploadId);
    const copied = await repository.getSubmissionFeatureSecurities([otherId]);
    expect(copied).to.have.length(1);
    expect(copied[0].submission_upload_review_id).to.equal(reviewA);
    expect(new Date(copied[0].record_end_date!).getTime()).to.equal(
      new Date(original.rows[0].record_end_date).getTime()
    );
    const reviews = await connection.sql(
      SQL`SELECT * FROM submission_upload_review WHERE submission_upload_id = ${otherUploadId}::uuid`
    );
    expect(reviews.rows).to.eql([]);
  });

  it('updates pending-upload search security immediately without publishing closure', async () => {
    const search = new SearchFeatureService(connection);
    const pageOptions = { limit: 10, sort: 'submission_feature_id' as const, order: 'asc' as const };
    const states: Array<[number[], number[], Array<string | null>]> = [
      [[], [], [null, null]],
      [[parentId], [], ['direct', 'inherited']],
      [[childId], [], ['direct', 'direct']],
      [[], [childId], ['direct', 'inherited']],
      [[], [parentId], [null, null]]
    ];
    for (const [insertIds, deleteIds, expected] of states) {
      if (insertIds.length) {
        await service.insertSubmissionUploadReviewSecurityRuleAssignments(
          submissionId,
          submissionUploadId,
          reviewA,
          securityRuleId,
          insertIds
        );
      }
      if (deleteIds.length) {
        await service.deleteSubmissionUploadReviewSecurityRuleAssignments(
          submissionId,
          submissionUploadId,
          reviewA,
          securityRuleId,
          deleteIds
        );
      }
      const result = await search.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {}, pageOptions);
      expect(result.features.map((row) => row.submission_feature_id)).to.eql([parentId, childId]);
      expect(result.features.map((row) => row.provenance)).to.eql(expected);
      expect(result.features.map((row) => row.is_secured)).to.eql(expected.map(Boolean));
      expect(result.features.every((row) => Object.keys(row.properties).length === 0)).to.equal(true);
    }
    const published = await new SearchFeatureRepository(connection).searchFeaturesByExpressionTree(
      'survey',
      null,
      pageOptions,
      { type: 'unrestricted' },
      { submissionUploadIds: [submissionUploadId] }
    );
    expect(published).to.eql([]);
    const closure = await connection.sql(
      SQL`SELECT * FROM submission_feature_closure WHERE source_submission_feature_id IN (${parentId}, ${childId})`
    );
    expect(closure.rows).to.eql([]);
  });

  it('does not inherit review search security across upload boundaries or ended parents', async () => {
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [parentId]
    );
    await connection.sql(
      SQL`UPDATE submission_feature SET parent_submission_feature_id = ${parentId} WHERE submission_feature_id = ${otherId}`
    );
    const search = new SearchFeatureService(connection);
    const external = await search.searchSubmissionUploadFeatures(submissionId, otherUploadId, {});
    expect(external.features[0]).to.include({ is_secured: false, provenance: null });
    await connection.sql(
      SQL`UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${parentId}`
    );
    const result = await search.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {});
    expect(result.features).to.have.length(1);
    expect(result.features[0]).to.include({
      submission_feature_id: childId,
      is_secured: false,
      provenance: null
    });
  });

  it('searches mixed-type unpublished upload features with matching counts and stable cursors, including secured features', async () => {
    await connection.sql(SQL`UPDATE submission_feature SET feature_type_id = (
      SELECT feature_type_id FROM feature_type WHERE name <> 'survey' AND record_end_date IS NULL LIMIT 1
    ) WHERE submission_feature_id = ${childId}`);

    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [parentId]
    );
    const searchFeatureService = new SearchFeatureService(connection);
    const first = await searchFeatureService.searchSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      {},
      {
        limit: 1,
        sort: 'submission_feature_id',
        order: 'asc'
      }
    );
    expect(first.features[0]).to.include({
      submission_feature_id: parentId,
      parent_submission_feature_id: null,
      provenance: 'direct',
      is_secured: true
    });
    const second = await searchFeatureService.searchSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      {},
      {
        limit: 1,
        sort: 'submission_feature_id',
        order: 'asc',
        boundary: decodeSearchFeatureCursor(first.pagination.next_cursor!)
      }
    );
    expect(first).to.have.all.keys('features', 'pagination');
    expect(second.features[0].feature_type_id).not.equal(first.features[0].feature_type_id);
    expect(second.features[0]).to.include({
      submission_feature_id: childId,
      parent_submission_feature_id: parentId,
      provenance: 'inherited',
      is_secured: true
    });
    const previous = await searchFeatureService.searchSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      {},
      {
        limit: 1,
        sort: 'submission_feature_id',
        order: 'asc',
        boundary: decodeSearchFeatureCursor(second.pagination.previous_cursor!)
      }
    );
    expect(previous.features[0].submission_feature_id).to.equal(parentId);
    expect(await searchFeatureService.countSubmissionUploadFeatures(submissionId, submissionUploadId, {})).to.equal(2);
  });
  it('matches published mixed-edge expression reach without inheriting security through references', async () => {
    const featureType = await connection.sql(
      SQL`SELECT feature_type_id, name FROM feature_type WHERE name <> 'survey' AND record_end_date IS NULL LIMIT 1`
    );
    await connection.sql(
      SQL`UPDATE submission_feature SET feature_type_id = ${featureType.rows[0].feature_type_id} WHERE submission_feature_id = ${childId}`
    );
    const evidenceId = await insertFeature(submissionUploadId);
    const bridgeId = await insertFeature(submissionUploadId, evidenceId);
    const properties = await connection.sql(SQL`
      INSERT INTO feature_property (name, display_name, feature_property_type_id)
      SELECT gen_random_uuid()::text, 'Review relationship test', feature_property_type_id
      FROM feature_property_type WHERE name IN ('string', 'feature')
      RETURNING feature_property_id, feature_property_type_id
    `);
    const mappings = await connection.sql(SQL`
      INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value, allow_multiple)
      SELECT (SELECT feature_type_id FROM feature_type WHERE name = 'survey' AND record_end_date IS NULL), feature_property_id, false, false
      FROM feature_property WHERE feature_property_id = ANY(${properties.rows.map(
        (row) => row.feature_property_id
      )}::integer[])
      RETURNING feature_type_property_id, feature_property_id
    `);
    const typedMappings = await connection.sql(SQL`
      SELECT ftp.feature_type_property_id, ftp.feature_property_id, fpt.name
      FROM feature_type_property ftp JOIN feature_property fp USING (feature_property_id)
      JOIN feature_property_type fpt USING (feature_property_type_id)
      WHERE ftp.feature_type_property_id = ANY(${mappings.rows.map((row) => row.feature_type_property_id)}::integer[])
    `);
    const stringProperty = typedMappings.rows.find((row) => row.name === 'string')!;
    const referenceProperty = typedMappings.rows.find((row) => row.name === 'feature')!;
    await connection.sql(SQL`INSERT INTO submission_feature_property_string (submission_feature_id, feature_type_property_id, value)
      VALUES (${evidenceId}, ${stringProperty.feature_type_property_id}, 'match')`);
    await connection.sql(SQL`INSERT INTO submission_feature_property_feature (submission_feature_id, feature_type_property_id, referenced_submission_feature_id)
      VALUES (${parentId}, ${referenceProperty.feature_type_property_id}, ${bridgeId})`);
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [evidenceId]
    );
    const expression = {
      type: 'expression' as const,
      operator: 'AND' as const,
      clauses: [
        {
          type: 'predicate' as const,
          feature_property_id: stringProperty.feature_property_id,
          feature_type_property_id: null,
          operator: 'Equals' as const,
          value: 'match'
        }
      ]
    };
    const search = new SearchFeatureService(connection);
    const pending = await search.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {
      expression: expression
    });
    const pendingChild = pending.features.find((row) => row.submission_feature_id === childId);
    expect(pendingChild).to.include({ is_secured: false, provenance: null });
    const closureBefore = await connection.sql(
      SQL`SELECT * FROM submission_feature_closure WHERE source_submission_feature_id = ${childId}`
    );
    expect(closureBefore.rows).to.eql([]);

    await publishUpload();
    const published = await search.searchFeaturesByExpressionTree(
      featureType.rows[0].name,
      expression,
      undefined,
      { type: 'unrestricted' },
      { submissionUploadIds: [submissionUploadId] }
    );
    expect(published.map((row) => row.submission_feature_id)).to.eql([childId]);
    const reach = await connection.sql(
      SQL`SELECT is_ancestor FROM submission_feature_closure WHERE source_submission_feature_id = ${childId} AND target_submission_feature_id = ${evidenceId}`
    );
    expect(reach.rows).to.eql([{ is_ancestor: false }]);
  });

  it('applies the same expression and upload filters to results and counts', async () => {
    const property = await connection.sql(SQL`
      INSERT INTO feature_property (name, display_name, feature_property_type_id)
      VALUES (gen_random_uuid()::text, 'Security test value', (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'))
      RETURNING feature_property_id;
    `);
    const featurePropertyId = property.rows[0].feature_property_id;
    const typeProperty = await connection.sql(SQL`
      INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value, allow_multiple)
      VALUES ((SELECT feature_type_id FROM feature_type WHERE name = 'survey' AND record_end_date IS NULL), ${featurePropertyId}, false, false)
      RETURNING feature_type_property_id;
    `);
    for (const id of [parentId, otherId]) {
      await connection.sql(SQL`INSERT INTO submission_feature_property_string (submission_feature_id, feature_type_property_id, value)
        VALUES (${id}, ${typeProperty.rows[0].feature_type_property_id}, 'match')`);
    }
    const expression = {
      type: 'expression' as const,
      operator: 'AND' as const,
      clauses: [
        {
          type: 'predicate' as const,
          feature_property_id: featurePropertyId,
          feature_type_property_id: null,
          operator: 'Equals' as const,
          value: 'match'
        }
      ]
    };
    const searchFeatureService = new SearchFeatureService(connection);
    const result = await searchFeatureService.searchSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      { expression },
      { limit: 10, sort: 'submission_feature_id', order: 'asc' }
    );
    expect(result.features.map((row) => row.submission_feature_id)).to.eql([parentId]);
    expect(
      await searchFeatureService.countSubmissionUploadFeatures(submissionId, submissionUploadId, {
        expression: expression
      })
    ).to.equal(1);
    await connection.sql(SQL`UPDATE submission_feature SET feature_type_id = (
      SELECT feature_type_id FROM feature_type WHERE name <> 'survey' AND record_end_date IS NULL LIMIT 1
    ) WHERE submission_feature_id = ${childId}`);
    // Administrative evidence must remain visible even when directly secured.
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [parentId]
    );
    const related = await searchFeatureService.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {
      expression: expression
    });
    expect(related.features.map((row) => row.submission_feature_id).sort((a, b) => a - b)).to.eql(
      [parentId, childId].sort((a, b) => a - b)
    );
    expect(
      await searchFeatureService.countSubmissionUploadFeatures(submissionId, submissionUploadId, {
        expression: expression
      })
    ).to.equal(2);

    await connection.sql(
      SQL`UPDATE feature_type_property SET allow_multiple = true WHERE feature_type_property_id = ${typeProperty.rows[0].feature_type_property_id}`
    );
    await connection.sql(SQL`INSERT INTO submission_feature_property_string (submission_feature_id, feature_type_property_id, value)
      VALUES (${parentId}, ${typeProperty.rows[0].feature_type_property_id}, 'second')`);
    const multiValueExpression = {
      ...expression,
      clauses: [...expression.clauses, { ...expression.clauses[0], value: 'second' }]
    };
    const multiValue = await searchFeatureService.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {
      expression: multiValueExpression
    });
    expect(multiValue.features.map((row) => row.submission_feature_id)).to.have.members([parentId, childId]);
    const nestedExpression = {
      ...expression,
      clauses: [
        multiValueExpression,
        {
          type: 'expression' as const,
          operator: 'OR' as const,
          clauses: [
            { ...expression.clauses[0], value: 'absent' },
            { ...expression.clauses[0], operator: 'Contains' as const, value: 'mat' }
          ]
        }
      ]
    };
    const nested = await searchFeatureService.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {
      expression: nestedExpression
    });
    expect(nested.features.map((row) => row.submission_feature_id)).to.have.members([parentId, childId]);
    expect(
      await searchFeatureService.countSubmissionUploadFeatures(submissionId, submissionUploadId, {
        expression: nestedExpression
      })
    ).to.equal(2);

    // Cross-upload property evidence cannot satisfy an upload-local expression.
    await connection.sql(
      SQL`UPDATE submission_feature SET parent_submission_feature_id = ${otherId} WHERE submission_feature_id = ${childId}`
    );
    const isolated = await searchFeatureService.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {
      expression: expression
    });
    expect(isolated.features.map((row) => row.submission_feature_id)).to.eql([parentId]);
    expect(
      await searchFeatureService.countSubmissionUploadFeatures(submissionId, submissionUploadId, {
        expression: expression
      })
    ).to.equal(1);
  });
  it('returns no results, count, or inaccessible-security indicator for mismatched submission/upload filters', async () => {
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      []
    );
    const otherSubmissionId = await createTestSubmission(connection);
    const filters = { submissionIds: [otherSubmissionId], submissionUploadIds: [submissionUploadId] };
    const searchFeatureService = new SearchFeatureService(connection);
    const result = await searchFeatureService.searchSubmissionUploadFeatures(
      otherSubmissionId,
      submissionUploadId,
      {},
      { limit: 10, sort: 'submission_feature_id', order: 'asc' }
    );
    expect(result.features).to.eql([]);
    expect(result).not.to.have.property('has_inaccessible_secured_features');
    expect(result).not.to.have.property('properties');
    expect(
      await searchFeatureService.countSubmissionUploadFeatures(otherSubmissionId, submissionUploadId, {})
    ).to.equal(0);
    const searchFeatureRepository = new SearchFeatureRepository(connection);
    expect(
      await searchFeatureRepository.hasInaccessibleSecuredFeaturesByExpressionTree(
        'survey',
        null,
        { type: 'anonymous' },
        filters
      )
    ).to.equal(false);
  });
  for (const sort of ['submission_feature_id', 'create_date'] as const) {
    for (const order of ['asc', 'desc'] as const) {
      it(`paginates ${sort} ${order} without gaps in either direction`, async () => {
        const third = await insertFeature(submissionUploadId);
        const expected = [parentId, childId, third];
        if (order === 'desc') {
          expected.reverse();
        }
        const search = new SearchFeatureService(connection);
        const options = { limit: 1, sort, order };
        const first = await search.searchSubmissionUploadFeatures(submissionId, submissionUploadId, {}, options);
        const second = await search.searchSubmissionUploadFeatures(
          submissionId,
          submissionUploadId,
          {},
          {
            ...options,
            boundary: decodeSearchFeatureCursor(first.pagination.next_cursor!)
          }
        );
        const last = await search.searchSubmissionUploadFeatures(
          submissionId,
          submissionUploadId,
          {},
          {
            ...options,
            boundary: decodeSearchFeatureCursor(second.pagination.next_cursor!)
          }
        );
        expect(
          [...first.features, ...second.features, ...last.features].map((row) => row.submission_feature_id)
        ).to.eql(expected);
        expect(last.pagination.next_cursor).to.equal(null);
        const previous = await search.searchSubmissionUploadFeatures(
          submissionId,
          submissionUploadId,
          {},
          {
            ...options,
            boundary: decodeSearchFeatureCursor(last.pagination.previous_cursor!)
          }
        );
        const start = await search.searchSubmissionUploadFeatures(
          submissionId,
          submissionUploadId,
          {},
          {
            ...options,
            boundary: decodeSearchFeatureCursor(previous.pagination.previous_cursor!)
          }
        );
        expect(previous.features[0].submission_feature_id).to.equal(expected[1]);
        expect(start.features[0].submission_feature_id).to.equal(expected[0]);
        expect(start.pagination.previous_cursor).to.equal(null);
      });
    }
  }

  it('allows manual assignments when rule and category descriptions are null', async () => {
    await connection.sql(
      SQL`UPDATE security_rule SET description = NULL, is_active = false WHERE security_rule_id = ${securityRuleId}`
    );
    await connection.sql(
      SQL`UPDATE security_category SET description = NULL WHERE security_category_id = (SELECT security_category_id FROM security_rule WHERE security_rule_id = ${securityRuleId})`
    );
    await service.insertSubmissionUploadReviewSecurityRuleAssignments(
      submissionId,
      submissionUploadId,
      reviewA,
      securityRuleId,
      [childId]
    );
    const assignments = await repository.getSubmissionFeatureSecurities([childId]);
    expect(assignments).to.have.length(1);
    expect(assignments[0]).to.include({ security_rule_id: securityRuleId, submission_upload_review_id: reviewA });
  });

  it('rejects missing or ended rules and ended categories for every assignment scope', async () => {
    await connection.sql(
      SQL`UPDATE security_category SET record_end_date = now() WHERE security_category_id = (SELECT security_category_id FROM security_rule WHERE security_rule_id = ${securityRuleId})`
    );
    await connection.sql(
      SQL`UPDATE security_rule SET record_end_date = now() WHERE security_rule_id = ${secondRuleId}`
    );
    const expression = await assignmentExpression();
    for (const ruleId of [securityRuleId, secondRuleId, 2147483647]) {
      for (const scope of ['selection', 'expression', 'upload'] as const) {
        const featureIds = scope === 'selection' ? [parentId] : [];
        let error: unknown;
        try {
          await service.insertSubmissionUploadReviewSecurityRuleAssignments(
            submissionId,
            submissionUploadId,
            reviewA,
            ruleId,
            featureIds,
            scope === 'expression' ? expression : undefined
          );
        } catch (error_) {
          error = error_;
        }
        expect(error).to.be.instanceOf(ApiValidationError);
      }
    }
    expect(await repository.getSubmissionFeatureSecurities([parentId, childId])).to.eql([]);
  });
});
