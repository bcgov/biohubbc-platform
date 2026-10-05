import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree, ExpressionTreePredicate } from '../../models/expression-tree';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../../models/submission-upload-review';
import { SecurityRuleRepository } from '../../repositories/security-rule-repository';
import { ExpressionTreeService } from '../../services/expression-tree-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { SubmissionUploadSecurityService } from '../../services/submission-upload-security-service';
import { SubmissionUploadReviewService } from '../../services/upload/submission-upload-review-service';
import {
  createAssignedFeatureProperty,
  createBlueprintFeatureTypeProperty,
  createTestUpload,
  insertSubmissionFeaturePropertyFeature
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/**
 * Build a string equality predicate.
 *
 * @param {number} featurePropertyId Property the predicate reads.
 * @param {string} value Value the property must equal.
 * @returns {ExpressionTreePredicate} Expression predicate.
 */
function equals(featurePropertyId: number, value: string): ExpressionTreePredicate {
  return {
    type: 'predicate',
    feature_property_id: featurePropertyId,
    blueprint_feature_type_property_id: null,
    operator: 'Equals',
    value
  };
}

/**
 * Wrap predicates in an AND expression.
 *
 * @param {ExpressionTreePredicate[]} predicates Predicates every match must satisfy.
 * @returns {ExpressionTree} Expression tree.
 */
function allOf(...predicates: ExpressionTreePredicate[]): ExpressionTree {
  return { type: 'expression', operator: 'AND', clauses: predicates };
}

// Screening evaluates pending (unapproved) upload features. Every fixture, including the seeded rules this suite
// deactivates so that only its own rules are screened, is rolled back after each test.
describe('Submission upload security screening (integration)', function () {
  this.timeout(20000);
  let connection: IDBConnection;
  let submissionId: number;
  let submissionUploadId: string;
  let otherUploadId: string;
  let securityCategoryId: number;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    submissionId = await createTestSubmission(connection);
    submissionUploadId = await createTestUpload(connection, submissionId);
    otherUploadId = await createTestUpload(connection, submissionId);
    await connection.sql(SQL`UPDATE security_rule SET is_active = false WHERE is_active`);
    const category = await connection.sql(SQL`
      SELECT security_category_id FROM security_category WHERE record_end_date IS NULL
      ORDER BY security_category_id LIMIT 1
    `);
    securityCategoryId = category.rows[0].security_category_id;
  });
  afterEach(async () => {
    await connection.rollback();
    await connection.release();
  });

  /**
   * Insert a pending feature (no effective date, so absent from published closure).
   *
   * @param {string} uploadId Upload that owns the feature.
   * @param {string} featureTypeName Seeded feature type.
   * @param {number | null} [parentId] Parent feature, if any.
   * @returns {Promise<number>} The new submission_feature_id.
   */
  async function insertFeature(uploadId: string, featureTypeName: string, parentId: number | null = null) {
    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date)
      VALUES (${submissionId}, ${uploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} AND record_end_date IS NULL), ${parentId}, '{}'::jsonb, 2, NULL)
      RETURNING submission_feature_id;
    `);
    return result.rows[0].submission_feature_id as number;
  }

  /**
   * Create a string property assigned to one feature type.
   *
   * @param {string} featureTypeName Feature type the property is assigned to.
   * @returns {Promise<{ featurePropertyId: number; assignmentId: number }>} Property and assignment ids.
   */
  async function createStringProperty(featureTypeName: string) {
    const { featurePropertyId, assignments } = await createAssignedFeatureProperty(connection, 'string', [
      featureTypeName
    ]);
    return { featurePropertyId, assignmentId: assignments[featureTypeName] };
  }

  /**
   * Index a string value for a feature.
   *
   * @param {number} featureId Feature carrying the value.
   * @param {number} assignmentId Assignment the value is stored under.
   * @param {string} value Stored value.
   * @returns {Promise<void>}
   */
  async function addValue(featureId: number, assignmentId: number, value: string) {
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
      VALUES (${featureId}, ${assignmentId}, ${value})
    `);
  }

  /**
   * Create a security rule linked to each given expression.
   *
   * @param {ExpressionTree[]} expressions Expressions linked to the rule; empty for a rule with none.
   * @param {boolean} [isActive=true] Whether the rule takes part in screening.
   * @returns {Promise<number>} The new security_rule_id.
   */
  async function createRule(expressions: ExpressionTree[], isActive = true) {
    const rule = await new SecurityRuleRepository(connection).insertSecurityRule({
      name: `Screening test ${randomUUID()}`,
      description: 'Screening test rule',
      security_category_id: securityCategoryId,
      is_active: isActive
    });
    for (const expression of expressions) {
      const { expression_id } = await new ExpressionTreeService(connection).writeExpressionTree(expression);
      await connection.sql(SQL`
        INSERT INTO security_rule_expression (security_rule_id, expression_id)
        VALUES (${rule.security_rule_id}, ${expression_id}::uuid)
      `);
    }
    return rule.security_rule_id;
  }

  /**
   * Screen the upload under test.
   *
   * @returns {Promise<void>}
   */
  async function screen() {
    await new SubmissionUploadSecurityService(connection).screenSubmissionUpload(
      submissionUploadId,
      submissionId,
      null
    );
  }

  /**
   * Read every assignment on the submission's features, current or not.
   *
   * @returns {Promise<Record<string, unknown>[]>} Assignment rows ordered by feature and rule.
   */
  async function getAssignments() {
    const result = await connection.sql(SQL`
      SELECT sfs.submission_feature_id, sfs.security_rule_id, sfs.submission_upload_security_id,
        sfs.submission_upload_review_id, sfs.record_end_date IS NULL AS current
      FROM submission_feature_security sfs JOIN submission_feature sf USING (submission_feature_id)
      WHERE sf.submission_id = ${submissionId}
      ORDER BY sfs.submission_feature_id, sfs.security_rule_id
    `);
    return result.rows;
  }

  /**
   * Read the screening events recorded for the upload under test.
   *
   * @returns {Promise<Record<string, unknown>[]>} Events ordered by creation.
   */
  async function getEvents() {
    const result = await connection.sql(SQL`
      SELECT submission_upload_security_id, status, metadata FROM submission_upload_security
      WHERE submission_upload_id = ${submissionUploadId}::uuid ORDER BY submission_upload_security_id
    `);
    return result.rows;
  }

  it('assigns matching pending features of the screened upload only, without writing published closure', async () => {
    const property = await createStringProperty('survey');
    const matchId = await insertFeature(submissionUploadId, 'survey');
    const otherValueId = await insertFeature(submissionUploadId, 'survey');
    const otherUploadMatchId = await insertFeature(otherUploadId, 'survey');
    await addValue(matchId, property.assignmentId, 'sensitive');
    await addValue(otherValueId, property.assignmentId, 'ordinary');
    await addValue(otherUploadMatchId, property.assignmentId, 'sensitive');
    const ruleId = await createRule([allOf(equals(property.featurePropertyId, 'sensitive'))]);

    await screen();

    const [event] = await getEvents();
    expect(event).to.eql({
      submission_upload_security_id: event.submission_upload_security_id,
      status: 'completed',
      metadata: { evaluatedRuleCount: 1, skippedRuleCount: 0, matchedFeatureCount: 1, insertedAssignmentCount: 1 }
    });
    expect(await getAssignments()).to.eql([
      {
        submission_feature_id: matchId,
        security_rule_id: ruleId,
        submission_upload_security_id: event.submission_upload_security_id,
        submission_upload_review_id: null,
        current: true
      }
    ]);
    const closure = await connection.sql(SQL`
      SELECT count(*)::integer AS count FROM submission_feature_closure c
      JOIN submission_feature sf ON sf.submission_feature_id = c.source_submission_feature_id
      WHERE sf.submission_id = ${submissionId}
    `);
    expect(closure.rows).to.eql([{ count: 0 }]);
  });

  it('follows parent and feature-reference relationships exactly as the review search does', async () => {
    const region = await createStringProperty('survey');
    const species = await createStringProperty('species_observation');
    const reference = await createBlueprintFeatureTypeProperty(connection, 'survey', 'species_observation');
    const northSurveyId = await insertFeature(submissionUploadId, 'survey');
    const owlId = await insertFeature(submissionUploadId, 'species_observation', northSurveyId);
    const elkId = await insertFeature(submissionUploadId, 'species_observation', northSurveyId);
    const southSurveyId = await insertFeature(submissionUploadId, 'survey');
    const unrelatedSouthSurveyId = await insertFeature(submissionUploadId, 'survey');
    await addValue(northSurveyId, region.assignmentId, 'north');
    await addValue(southSurveyId, region.assignmentId, 'south');
    await addValue(unrelatedSouthSurveyId, region.assignmentId, 'south');
    await addValue(owlId, species.assignmentId, 'owl');
    await addValue(elkId, species.assignmentId, 'elk');
    await insertSubmissionFeaturePropertyFeature(
      connection,
      southSurveyId,
      reference.blueprintFeatureTypePropertyId,
      owlId
    );
    const expression: ExpressionTree = {
      type: 'expression',
      operator: 'OR',
      clauses: [
        allOf(equals(region.featurePropertyId, 'north'), equals(species.featurePropertyId, 'owl')),
        allOf(equals(region.featurePropertyId, 'south'), equals(species.featurePropertyId, 'owl'))
      ]
    };
    await createRule([expression]);

    await screen();

    // The north survey matches through its child's species, the owl through its parent's region, and the south
    // survey through the owl it references. The elk and the unrelated south survey reach no owl evidence.
    const assigned = (await getAssignments()).map((row) => row.submission_feature_id);
    expect(assigned).to.eql([northSurveyId, owlId, southSurveyId]);
    const search = await new SearchFeatureService(connection).searchSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      { expression }
    );
    expect(search.features.map((feature) => feature.submission_feature_id).sort((a, b) => a - b)).to.eql(assigned);
    const [event] = await getEvents();
    expect(event.metadata).to.eql({
      evaluatedRuleCount: 1,
      skippedRuleCount: 0,
      matchedFeatureCount: 3,
      insertedAssignmentCount: 3
    });
  });

  it('evaluates active rules with a current expression and skips rules without one', async () => {
    const property = await createStringProperty('survey');
    const featureId = await insertFeature(submissionUploadId, 'survey');
    await addValue(featureId, property.assignmentId, 'sensitive');
    const matching = allOf(equals(property.featurePropertyId, 'sensitive'));
    const activeRuleId = await createRule([matching]);
    await createRule([]);
    await createRule([matching], false);
    const endedRuleId = await createRule([matching]);
    await connection.sql(SQL`UPDATE security_rule SET record_end_date = now() WHERE security_rule_id = ${endedRuleId}`);
    const endedLinkRuleId = await createRule([matching]);
    await connection.sql(
      SQL`UPDATE security_rule_expression SET record_end_date = now() WHERE security_rule_id = ${endedLinkRuleId}`
    );

    await screen();

    expect((await getAssignments()).map((row) => row.security_rule_id)).to.eql([activeRuleId]);
    const [event] = await getEvents();
    expect(event.metadata).to.eql({
      evaluatedRuleCount: 1,
      skippedRuleCount: 2,
      matchedFeatureCount: 1,
      insertedAssignmentCount: 1
    });
  });

  it('counts a feature once however many rules match it', async () => {
    const property = await createStringProperty('survey');
    const firstId = await insertFeature(submissionUploadId, 'survey');
    const secondId = await insertFeature(submissionUploadId, 'survey');
    await addValue(firstId, property.assignmentId, 'sensitive');
    await addValue(secondId, property.assignmentId, 'sensitive');
    const matching = allOf(equals(property.featurePropertyId, 'sensitive'));
    const firstRuleId = await createRule([matching]);
    const secondRuleId = await createRule([matching]);

    await screen();

    expect((await getAssignments()).map((row) => [row.submission_feature_id, row.security_rule_id])).to.eql([
      [firstId, firstRuleId],
      [firstId, secondRuleId],
      [secondId, firstRuleId],
      [secondId, secondRuleId]
    ]);
    const [event] = await getEvents();
    expect(event.metadata).to.eql({
      evaluatedRuleCount: 2,
      skippedRuleCount: 0,
      matchedFeatureCount: 2,
      insertedAssignmentCount: 4
    });
  });

  it('assigns a rule to features matching any of its current expressions', async () => {
    const property = await createStringProperty('survey');
    const firstId = await insertFeature(submissionUploadId, 'survey');
    const secondId = await insertFeature(submissionUploadId, 'survey');
    const thirdId = await insertFeature(submissionUploadId, 'survey');
    await addValue(firstId, property.assignmentId, 'first');
    await addValue(secondId, property.assignmentId, 'second');
    await addValue(thirdId, property.assignmentId, 'third');
    await createRule([
      allOf(equals(property.featurePropertyId, 'first')),
      allOf(equals(property.featurePropertyId, 'second'))
    ]);

    await screen();

    expect((await getAssignments()).map((row) => row.submission_feature_id)).to.eql([firstId, secondId]);
  });

  it('keeps current assignments and their provenance, and reactivates ended ones, across repeated screening', async () => {
    const property = await createStringProperty('survey');
    const reviewedId = await insertFeature(submissionUploadId, 'survey');
    const expiredId = await insertFeature(submissionUploadId, 'survey');
    const newId = await insertFeature(submissionUploadId, 'survey');
    for (const featureId of [reviewedId, expiredId, newId]) {
      await addValue(featureId, property.assignmentId, 'sensitive');
    }
    const ruleId = await createRule([allOf(equals(property.featurePropertyId, 'sensitive'))]);
    const review = await new SubmissionUploadReviewService(connection).insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: 'Manual review',
      description: null,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.IN_PROGRESS,
      requested_by: null
    });
    await connection.sql(SQL`
      INSERT INTO submission_feature_security
        (submission_feature_id, security_rule_id, submission_upload_review_id, record_effective_date, record_end_date)
      VALUES
        (${reviewedId}, ${ruleId}, ${review.submission_upload_review_id}::uuid, now(), NULL),
        (${expiredId}, ${ruleId}, ${review.submission_upload_review_id}::uuid, now() - interval '2 days', now() - interval '1 day')
    `);

    await screen();
    await screen();

    const [first, second] = await getEvents();
    expect([first.metadata, second.metadata]).to.eql([
      { evaluatedRuleCount: 1, skippedRuleCount: 0, matchedFeatureCount: 3, insertedAssignmentCount: 2 },
      { evaluatedRuleCount: 1, skippedRuleCount: 0, matchedFeatureCount: 3, insertedAssignmentCount: 0 }
    ]);
    expect(await getAssignments()).to.eql([
      {
        submission_feature_id: reviewedId,
        security_rule_id: ruleId,
        submission_upload_security_id: null,
        submission_upload_review_id: review.submission_upload_review_id,
        current: true
      },
      {
        submission_feature_id: expiredId,
        security_rule_id: ruleId,
        submission_upload_security_id: first.submission_upload_security_id,
        submission_upload_review_id: null,
        current: true
      },
      {
        submission_feature_id: newId,
        security_rule_id: ruleId,
        submission_upload_security_id: first.submission_upload_security_id,
        submission_upload_review_id: null,
        current: true
      }
    ]);
  });

  it('counts secured features as evidence, since screening applies no access filtering', async () => {
    const species = await createStringProperty('species_observation');
    const surveyId = await insertFeature(submissionUploadId, 'survey');
    const owlId = await insertFeature(submissionUploadId, 'species_observation', surveyId);
    await addValue(owlId, species.assignmentId, 'owl');
    const securedByRuleId = await createRule([]);
    await connection.sql(SQL`
      INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, record_effective_date)
      VALUES (${owlId}, ${securedByRuleId}, now())
    `);
    const ruleId = await createRule([allOf(equals(species.featurePropertyId, 'owl'))]);

    await screen();

    expect(
      (await getAssignments()).filter((row) => row.security_rule_id === ruleId).map((row) => row.submission_feature_id)
    ).to.eql([surveyId, owlId]);
  });
});
