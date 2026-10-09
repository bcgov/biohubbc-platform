import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, getKnex, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { buildSubmissionUploadFeatureIdsSubquery } from '../../repositories/submission-upload-feature-search';
import { ExpressionTreeNormalizationService } from '../../services/expression-tree-normalization-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { optimizeExpression } from '../../utils/expression-optimization';
import { decodeSearchFeatureCursor } from '../../utils/pagination';
import { allOf, anyOf, predicate } from '../helpers/test-expression-helpers';
import {
  addPropertyValue,
  createAssignedFeatureProperty,
  createBlueprintFeatureTypeProperty,
  createTestUpload,
  insertPendingFeature,
  insertSubmissionFeaturePropertyFeature
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/** A node of `EXPLAIN (ANALYZE, FORMAT JSON)` output. */
type PlanNode = { [key: string]: unknown; Plans?: PlanNode[] };

/**
 * Sum the work an analyzed plan did: for every node, each execution (loop) plus the rows it produced and discarded.
 * Counting executions as well as rows captures probes that found nothing, which rows alone would miss.
 *
 * @param {PlanNode} node Plan node.
 * @returns {number} Total work across the node and its children.
 */
function sumPlanWork(node: PlanNode): number {
  const loops = Number(node['Actual Loops'] ?? 0);
  const rowsPerLoop =
    Number(node['Actual Rows'] ?? 0) +
    Number(node['Rows Removed by Filter'] ?? 0) +
    Number(node['Rows Removed by Join Filter'] ?? 0) +
    Number(node['Rows Removed by Index Recheck'] ?? 0);

  return loops * (1 + rowsPerLoop) + (node.Plans ?? []).reduce((total, child) => total + sumPlanWork(child), 0);
}

/**
 * Collect the loop counts of every CTE scan in an analyzed plan. A CTE has no index, so a CTE scan that runs more than
 * once rescans the whole CTE per outer row.
 *
 * @param {PlanNode} node Plan node.
 * @returns {number[]} Loop counts of the CTE scans in the node and its children.
 */
function collectCteScanLoops(node: PlanNode): number[] {
  const own = node['Node Type'] === 'CTE Scan' ? [Number(node['Actual Loops'])] : [];

  return [...own, ...(node.Plans ?? []).flatMap((child) => collectCteScanLoops(child))];
}

// Every fixture, including the ended feature type, is rolled back after each test.
describe('Submission upload expression evaluation (integration)', function () {
  this.timeout(60000);
  let connection: IDBConnection;
  let submissionId: number;
  let submissionUploadId: string;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    submissionId = await createTestSubmission(connection);
    submissionUploadId = await createTestUpload(connection, submissionId);
  });
  afterEach(async () => {
    await connection.rollback();
    await connection.release();
  });

  /**
   * Insert a pending feature (no effective date, so absent from published closure).
   *
   * @param {string} featureTypeName Seeded feature type.
   * @param {number | null} [parentId] Parent feature, if any.
   * @param {string} [uploadId] Owning upload; the upload under test by default.
   * @returns {Promise<number>} The new submission_feature_id.
   */
  async function insertFeature(
    featureTypeName: string,
    parentId: number | null = null,
    uploadId: string = submissionUploadId
  ): Promise<number> {
    return insertPendingFeature(connection, submissionId, uploadId, featureTypeName, parentId);
  }

  /**
   * Evaluate an expression over the upload under test.
   *
   * @param {ExpressionTree} expression Public expression tree.
   * @param {number} [scopeSubmissionId] Submission boundary; the owning submission by default.
   * @returns {Promise<number[]>} Matching feature ids, ascending.
   */
  async function evaluate(expression: ExpressionTree, scopeSubmissionId: number = submissionId): Promise<number[]> {
    const normalized = optimizeExpression(
      await new ExpressionTreeNormalizationService(connection).normalize(expression)
    );
    const { sql, bindings } = buildSubmissionUploadFeatureIdsSubquery(scopeSubmissionId, submissionUploadId, normalized)
      .toSQL()
      .toNative();
    const result = await connection.query(sql, bindings as unknown[]);
    return result.rows.map((row) => row.submission_feature_id).sort((a, b) => a - b);
  }

  it('ends walks around reference cycles and self-references, matching the other-type features on the cycle', async () => {
    const species = await createAssignedFeatureProperty(connection, 'string', ['animal', 'species_observation']);
    const animalId = await insertFeature('animal');
    const captureId = await insertFeature('capture');
    const observationId = await insertFeature('species_observation');
    await addPropertyValue(connection, 'string', animalId, species.assignments.animal, 'owl');
    await addPropertyValue(connection, 'string', observationId, species.assignments.species_observation, 'owl');
    const animalToCapture = await createBlueprintFeatureTypeProperty(connection, 'animal', 'capture');
    const captureToAnimal = await createBlueprintFeatureTypeProperty(connection, 'capture', 'animal');
    const observationToObservation = await createBlueprintFeatureTypeProperty(
      connection,
      'species_observation',
      'species_observation'
    );
    await insertSubmissionFeaturePropertyFeature(
      connection,
      animalId,
      animalToCapture.blueprintFeatureTypePropertyId,
      captureId
    );
    await insertSubmissionFeaturePropertyFeature(
      connection,
      captureId,
      captureToAnimal.blueprintFeatureTypePropertyId,
      animalId
    );
    await insertSubmissionFeaturePropertyFeature(
      connection,
      observationId,
      observationToObservation.blueprintFeatureTypePropertyId,
      observationId
    );

    expect(await evaluate(allOf(predicate(species.featurePropertyId, 'Equals', 'owl')))).to.eql([
      animalId,
      captureId,
      observationId
    ]);
  });

  it('applies NotEquals to the whole feature, so a feature holding the excluded value among others does not match', async () => {
    const colour = await createAssignedFeatureProperty(connection, 'string', ['species_observation']);
    const surveyId = await insertFeature('survey');
    const redAndBlueId = await insertFeature('species_observation', surveyId);
    const blueId = await insertFeature('species_observation', surveyId);
    await insertFeature('species_observation', surveyId);
    await addPropertyValue(connection, 'string', redAndBlueId, colour.assignments.species_observation, 'red');
    await addPropertyValue(connection, 'string', redAndBlueId, colour.assignments.species_observation, 'blue');
    await addPropertyValue(connection, 'string', blueId, colour.assignments.species_observation, 'blue');

    // The survey matches through the blue observation below it; the observation without a colour has no evidence.
    expect(await evaluate(allOf(predicate(colour.featurePropertyId, 'NotEquals', 'red')))).to.eql([surveyId, blueId]);
  });

  it('walks through features of an ended feature type without returning them', async () => {
    const region = await createAssignedFeatureProperty(connection, 'string', ['stratum']);
    const species = await createAssignedFeatureProperty(connection, 'string', ['telemetry_deployment']);
    const surveyId = await insertFeature('survey');
    const stratumId = await insertFeature('stratum', surveyId);
    const deploymentId = await insertFeature('telemetry_deployment', stratumId);
    await addPropertyValue(connection, 'string', stratumId, region.assignments.stratum, 'east');
    await addPropertyValue(connection, 'string', deploymentId, species.assignments.telemetry_deployment, 'owl');
    await connection.sql(SQL`UPDATE feature_type SET record_end_date = now() WHERE name = 'stratum'`);

    expect(await evaluate(allOf(predicate(region.featurePropertyId, 'Equals', 'east')))).to.eql([
      surveyId,
      deploymentId
    ]);
    expect(await evaluate(allOf(predicate(species.featurePropertyId, 'Equals', 'owl')))).to.eql([
      surveyId,
      deploymentId
    ]);
  });

  it('requires one value within every bound of a numeric range', async () => {
    const count = await createAssignedFeatureProperty(connection, 'number', ['species_observation']);
    const surveyId = await insertFeature('survey');
    const lowId = await insertFeature('species_observation', surveyId);
    const insideId = await insertFeature('species_observation', surveyId);
    const straddlingId = await insertFeature('species_observation', surveyId);
    await addPropertyValue(connection, 'number', lowId, count.assignments.species_observation, 3);
    await addPropertyValue(connection, 'number', insideId, count.assignments.species_observation, 7);
    await addPropertyValue(connection, 'number', straddlingId, count.assignments.species_observation, 3);
    await addPropertyValue(connection, 'number', straddlingId, count.assignments.species_observation, 12);

    expect(
      await evaluate(
        allOf(predicate(count.featurePropertyId, 'GreaterThan', 5), predicate(count.featurePropertyId, 'LessThan', 10))
      )
    ).to.eql([surveyId, insideId]);
  });

  it('matches an OR of equalities directly and through relationships', async () => {
    const species = await createAssignedFeatureProperty(connection, 'string', ['telemetry_deployment']);
    const surveyId = await insertFeature('survey');
    const owlId = await insertFeature('telemetry_deployment', surveyId);
    const owlPointId = await insertFeature('telemetry', owlId);
    const fernId = await insertFeature('telemetry_deployment', surveyId);
    const elkId = await insertFeature('telemetry_deployment', surveyId);
    await insertFeature('telemetry', elkId);
    await addPropertyValue(connection, 'string', owlId, species.assignments.telemetry_deployment, 'owl');
    await addPropertyValue(connection, 'string', fernId, species.assignments.telemetry_deployment, 'fern');
    await addPropertyValue(connection, 'string', elkId, species.assignments.telemetry_deployment, 'elk');

    expect(
      await evaluate(
        anyOf(
          predicate(species.featurePropertyId, 'Equals', 'owl'),
          predicate(species.featurePropertyId, 'Equals', 'fern')
        )
      )
    ).to.eql([surveyId, owlId, owlPointId, fernId]);
  });

  it('matches an AND of equalities from separate related features and from a mix of own and related values', async () => {
    const count = await createAssignedFeatureProperty(connection, 'number', [
      'species_observation',
      'animal',
      'capture'
    ]);
    const surveyId = await insertFeature('survey');
    const firstObservationId = await insertFeature('species_observation', surveyId);
    const secondObservationId = await insertFeature('species_observation', surveyId);
    const animalId = await insertFeature('animal');
    const captureId = await insertFeature('capture', animalId);
    await addPropertyValue(connection, 'number', firstObservationId, count.assignments.species_observation, 77);
    await addPropertyValue(connection, 'number', secondObservationId, count.assignments.species_observation, 100);
    await addPropertyValue(connection, 'number', animalId, count.assignments.animal, 77);
    await addPropertyValue(connection, 'number', captureId, count.assignments.capture, 100);

    // The survey collects 77 and 100 from two observations. The animal and capture each hold one value and reach the
    // other. Neither observation reaches the other value, because siblings are not related.
    expect(
      await evaluate(
        allOf(predicate(count.featurePropertyId, 'Equals', 77), predicate(count.featurePropertyId, 'Equals', 100))
      )
    ).to.eql([surveyId, animalId, captureId]);
  });

  it('does not relate features of the same type, but reaches other-type features beyond them', async () => {
    const species = await createAssignedFeatureProperty(connection, 'string', ['sample_site']);
    const surveyId = await insertFeature('survey');
    const outerSiteId = await insertFeature('sample_site', surveyId);
    const innerSiteId = await insertFeature('sample_site', outerSiteId);
    const observationId = await insertFeature('species_observation', innerSiteId);
    await addPropertyValue(connection, 'string', innerSiteId, species.assignments.sample_site, 'owl');

    expect(await evaluate(allOf(predicate(species.featurePropertyId, 'Equals', 'owl')))).to.eql([
      surveyId,
      innerSiteId,
      observationId
    ]);
  });

  it('ignores parents and references that leave the upload', async () => {
    const region = await createAssignedFeatureProperty(connection, 'string', ['survey']);
    const otherUploadId = await createTestUpload(connection, submissionId);
    const otherSurveyId = await insertFeature('survey', null, otherUploadId);
    const surveyId = await insertFeature('survey');
    await insertFeature('species_observation', otherSurveyId);
    const referringId = await insertFeature('species_observation');
    await addPropertyValue(connection, 'string', otherSurveyId, region.assignments.survey, 'north');
    await addPropertyValue(connection, 'string', surveyId, region.assignments.survey, 'north');
    const observationToSurvey = await createBlueprintFeatureTypeProperty(connection, 'species_observation', 'survey');
    await insertSubmissionFeaturePropertyFeature(
      connection,
      referringId,
      observationToSurvey.blueprintFeatureTypePropertyId,
      otherSurveyId
    );

    expect(await evaluate(allOf(predicate(region.featurePropertyId, 'Equals', 'north')))).to.eql([surveyId]);
  });

  it('stops walks at features outside the upload, including where the walk would lead back into it', async () => {
    const species = await createAssignedFeatureProperty(connection, 'string', ['survey', 'species_observation']);
    const otherUploadId = await createTestUpload(connection, submissionId);

    // Ancestor walks: an observation whose parent, or whose grandparent, belongs to the other upload.
    const firstSurveyId = await insertFeature('survey');
    const outsideParentId = await insertFeature('sample_site', firstSurveyId, otherUploadId);
    const firstObservationId = await insertFeature('species_observation', outsideParentId);
    const secondSurveyId = await insertFeature('survey');
    const outsideGrandparentId = await insertFeature('sample_site', secondSurveyId, otherUploadId);
    const insideParentId = await insertFeature('sample_site', outsideGrandparentId);
    const secondObservationId = await insertFeature('species_observation', insideParentId);

    // Descendant walks: a survey whose child, or whose grandchild, belongs to the other upload.
    const thirdSurveyId = await insertFeature('survey');
    const outsideChildId = await insertFeature('sample_site', thirdSurveyId, otherUploadId);
    await insertFeature('species_observation', outsideChildId);
    const fourthSurveyId = await insertFeature('survey');
    const insideChildId = await insertFeature('sample_site', fourthSurveyId);
    const outsideGrandchildId = await insertFeature('sample_site', insideChildId, otherUploadId);
    await insertFeature('species_observation', outsideGrandchildId);

    for (const observationId of [firstObservationId, secondObservationId]) {
      await addPropertyValue(connection, 'string', observationId, species.assignments.species_observation, 'owl');
    }
    for (const surveyId of [thirdSurveyId, fourthSurveyId]) {
      await addPropertyValue(connection, 'string', surveyId, species.assignments.survey, 'owl');
    }

    // Each walk ends at the first feature outside the upload, so no upload feature beyond it is reached.
    expect(await evaluate(allOf(predicate(species.featurePropertyId, 'Equals', 'owl')))).to.eql([
      firstObservationId,
      insideParentId,
      secondObservationId,
      thirdSurveyId,
      fourthSurveyId,
      insideChildId
    ]);
  });

  it('matches a value only under the predicate property, not under another property stored in the same table', async () => {
    const species = await createAssignedFeatureProperty(connection, 'string', ['species_observation']);
    const nickname = await createAssignedFeatureProperty(connection, 'string', ['species_observation']);
    const owlId = await insertFeature('species_observation');
    const nicknamedId = await insertFeature('species_observation');
    await addPropertyValue(connection, 'string', owlId, species.assignments.species_observation, 'owl');
    await addPropertyValue(connection, 'string', nicknamedId, nickname.assignments.species_observation, 'owl');

    expect(await evaluate(allOf(predicate(species.featurePropertyId, 'Equals', 'owl')))).to.eql([owlId]);
  });

  it('returns nothing when the submission does not own the upload', async () => {
    const region = await createAssignedFeatureProperty(connection, 'string', ['survey']);
    const surveyId = await insertFeature('survey');
    await addPropertyValue(connection, 'string', surveyId, region.assignments.survey, 'north');
    const otherSubmissionId = await createTestSubmission(connection);
    const expression = allOf(predicate(region.featurePropertyId, 'Equals', 'north'));

    expect(await evaluate(expression)).to.eql([surveyId]);
    expect(await evaluate(expression, otherSubmissionId)).to.eql([]);
  });

  for (const sort of ['submission_feature_id', 'create_date'] as const) {
    for (const order of ['asc', 'desc'] as const) {
      it(`pages expression matches by ${sort} ${order} without gaps in either direction, matching the count`, async () => {
        const species = await createAssignedFeatureProperty(connection, 'string', ['telemetry_deployment']);
        const surveyId = await insertFeature('survey');
        const deploymentId = await insertFeature('telemetry_deployment', surveyId);
        const pointIds = [
          await insertFeature('telemetry', deploymentId),
          await insertFeature('telemetry', deploymentId),
          await insertFeature('telemetry', deploymentId)
        ];
        await insertFeature('telemetry_deployment', surveyId);
        await addPropertyValue(connection, 'string', deploymentId, species.assignments.telemetry_deployment, 'owl');
        const filters = { expression: allOf(predicate(species.featurePropertyId, 'Equals', 'owl')) };
        const expected = [surveyId, deploymentId, ...pointIds];
        if (order === 'desc') {
          expected.reverse();
        }
        const search = new SearchFeatureService(connection);
        const options = { limit: 2, sort, order };

        let latest = await search.searchSubmissionUploadFeatures(submissionId, submissionUploadId, filters, options);
        const pages = [latest];
        while (latest.pagination.next_cursor) {
          latest = await search.searchSubmissionUploadFeatures(submissionId, submissionUploadId, filters, {
            ...options,
            boundary: decodeSearchFeatureCursor(latest.pagination.next_cursor)
          });
          pages.push(latest);
        }
        const back = await search.searchSubmissionUploadFeatures(submissionId, submissionUploadId, filters, {
          ...options,
          boundary: decodeSearchFeatureCursor(latest.pagination.previous_cursor!)
        });

        expect(pages.flatMap((page) => page.features.map((row) => row.submission_feature_id))).to.eql(expected);
        expect(back.features.map((row) => row.submission_feature_id)).to.eql(expected.slice(2, 4));
        expect(await search.countSubmissionUploadFeatures(submissionId, submissionUploadId, filters)).to.equal(5);
      });
    }
  }

  it('stores a property value only under an assignment of its own feature type', async () => {
    const region = await createAssignedFeatureProperty(connection, 'string', ['survey']);
    const observationId = await insertFeature('species_observation');
    let pgMessage = '';

    try {
      await addPropertyValue(connection, 'string', observationId, region.assignments.survey, 'north');
    } catch (error) {
      // The connection wrapper surfaces the PostgreSQL error as `errors[0]`.
      pgMessage = (error as { errors?: { message: string }[] }).errors?.[0]?.message ?? '';
    }

    expect(pgMessage).to.include('does not belong to the feature type');
  });

  /**
   * Build a telemetry-shaped upload in its own submission: one survey with a region, five deployments (two of them
   * owls) and `pointsPerDeployment` telemetry points each, one percent of them flagged.
   *
   * @param {number} pointsPerDeployment Telemetry points under each deployment.
   * @param {{ region: number; species: number; fix: number }} assignments Assignment ids by property.
   * @returns {Promise<{ submissionId: number; uploadId: string }>} The fixture's submission and upload.
   */
  async function buildTelemetryUpload(
    pointsPerDeployment: number,
    assignments: { region: number; species: number; fix: number }
  ): Promise<{ submissionId: number; uploadId: string }> {
    const fixtureSubmissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, fixtureSubmissionId);
    const survey = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, data, data_byte_size, record_effective_date)
      VALUES (${fixtureSubmissionId}, ${uploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'survey'), '{}'::jsonb, 2, NULL)
      RETURNING submission_feature_id;
    `);
    const surveyId = survey.rows[0].submission_feature_id;
    const deployments = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date)
      SELECT ${fixtureSubmissionId}, ${uploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'), ${surveyId}, '{}'::jsonb, 2, NULL
      FROM generate_series(1, 5)
      RETURNING submission_feature_id;
    `);
    const deploymentIds: number[] = deployments.rows.map((row) => row.submission_feature_id);
    const points = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date)
      SELECT ${fixtureSubmissionId}, ${uploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'), deployment_id, '{}'::jsonb, 2, NULL
      FROM unnest(${deploymentIds}::integer[]) AS deployment_id CROSS JOIN generate_series(1, ${pointsPerDeployment})
      RETURNING submission_feature_id;
    `);
    const pointIds: number[] = points.rows.map((row) => row.submission_feature_id);
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
      VALUES (${surveyId}, ${assignments.region}, 'north')
    `);
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
      SELECT deployment_id, ${assignments.species}, CASE WHEN ordinality <= 2 THEN 'owl' ELSE 'elk' END
      FROM unnest(${deploymentIds}::integer[]) WITH ORDINALITY AS deployment(deployment_id, ordinality)
    `);
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
      SELECT point_id, ${assignments.fix}, CASE WHEN ordinality % 100 = 0 THEN 'bad' ELSE 'good' END
      FROM unnest(${pointIds}::integer[]) WITH ORDINALITY AS point(point_id, ordinality)
    `);
    return { submissionId: fixtureSubmissionId, uploadId };
  }

  /**
   * Analyze the count query for an expression over one upload.
   *
   * @param {{ submissionId: number; uploadId: string }} upload Upload to evaluate.
   * @param {ExpressionTree} expression Public expression tree.
   * @returns {Promise<PlanNode>} Root node of the analyzed plan.
   */
  async function analyzeCount(
    upload: { submissionId: number; uploadId: string },
    expression: ExpressionTree
  ): Promise<PlanNode> {
    const knex = getKnex();
    const normalized = optimizeExpression(
      await new ExpressionTreeNormalizationService(connection).normalize(expression)
    );
    const matches = buildSubmissionUploadFeatureIdsSubquery(upload.submissionId, upload.uploadId, normalized);
    const { sql, bindings } = knex
      .from(matches.as('matches'))
      .select(knex.raw('count(*)::integer AS count'))
      .toSQL()
      .toNative();
    const result = await connection.query(`EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) ${sql}`, bindings as unknown[]);
    return result.rows[0]['QUERY PLAN'][0].Plan;
  }

  describe('growth', () => {
    it('grows linearly with the upload, with no CTE rescanned per feature', async () => {
      const region = await createAssignedFeatureProperty(connection, 'string', ['survey']);
      const species = await createAssignedFeatureProperty(connection, 'string', ['telemetry_deployment']);
      const fix = await createAssignedFeatureProperty(connection, 'string', ['telemetry']);
      const assignments = {
        region: region.assignments.survey,
        species: species.assignments.telemetry_deployment,
        fix: fix.assignments.telemetry
      };
      const small = await buildTelemetryUpload(100, assignments);
      const large = await buildTelemetryUpload(400, assignments);
      const scenarios = {
        'sparse deployment evidence': allOf(predicate(species.featurePropertyId, 'Equals', 'owl')),
        'survey evidence reaching every descendant': allOf(predicate(region.featurePropertyId, 'Equals', 'north')),
        'point evidence reaching its ancestors': allOf(predicate(fix.featurePropertyId, 'Equals', 'bad')),
        'intersection across feature types': allOf(
          predicate(region.featurePropertyId, 'Equals', 'north'),
          predicate(species.featurePropertyId, 'Equals', 'owl')
        )
      };

      for (const [scenario, expression] of Object.entries(scenarios)) {
        const smallPlan = await analyzeCount(small, expression);
        const largePlan = await analyzeCount(large, expression);

        // Four times the features: linear work grows about 4x, a per-feature rescan about 16x.
        expect(sumPlanWork(largePlan) / sumPlanWork(smallPlan), scenario).to.be.at.most(6);
        expect(Math.max(0, ...collectCteScanLoops(largePlan)), scenario).to.equal(1);
      }
    });
  });
});
