import { expect } from 'chai';
import { randomInt, randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { buildExpressionTreeFeatureIdsSubquery } from '../../repositories/expression-evaluation';
import { buildSubmissionUploadFeatureIdsSubquery } from '../../repositories/submission-upload-feature-search';
import { ExpressionTreeNormalizationService } from '../../services/expression-tree-normalization-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { optimizeExpression } from '../../utils/expression-optimization';
import { allOf, anyOf, predicate } from '../helpers/test-expression-helpers';
import {
  addPropertyValue,
  createAssignedFeatureProperty,
  createBlueprintFeatureTypeProperty,
  createCodesetCode,
  createTaxon,
  createTestUpload,
  insertPendingFeature,
  insertSubmissionFeaturePropertyFeature
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

/** Ids the parity expressions refer to. */
interface ParityFixture {
  properties: Record<
    'region' | 'area' | 'species' | 'active' | 'count' | 'seen' | 'location' | 'colour' | 'taxon' | 'habitat',
    number
  >;
  taxa: { familyTsn: number; genusTsn: number; speciesTsn: number };
  codes: { wetland: number; forest: number };
}

const REGION_POLYGON = {
  type: 'Polygon',
  coordinates: [
    [
      [-125, 49],
      [-120, 49],
      [-120, 52],
      [-125, 52],
      [-125, 49]
    ]
  ]
};

/**
 * Build a GeoJSON point.
 *
 * @param {number} longitude Longitude.
 * @param {number} latitude Latitude.
 * @returns {{ type: 'Point'; coordinates: number[] }} GeoJSON point.
 */
function point(longitude: number, latitude: number): { type: 'Point'; coordinates: number[] } {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

/** Expressions evaluated by both evaluators, one per operator and relationship branch. */
const PARITY_CASES: Record<string, (fixture: ParityFixture) => ExpressionTree> = {
  'string Equals, reaching the features that refer to the evidence': ({ properties }) =>
    allOf(predicate(properties.species, 'Equals', 'owl')),
  'string NotEquals, feature-level over multiple values': ({ properties }) =>
    allOf(predicate(properties.colour, 'NotEquals', 'red')),
  'string Contains': ({ properties }) => allOf(predicate(properties.colour, 'Contains', 'lu')),
  'string StartsWith': ({ properties }) => allOf(predicate(properties.region, 'StartsWith', 'no')),
  'string EndsWith': ({ properties }) => allOf(predicate(properties.region, 'EndsWith', 'rth')),
  'string Like': ({ properties }) => allOf(predicate(properties.region, 'Like', 'n%')),
  'string ILike': ({ properties }) => allOf(predicate(properties.region, 'ILike', 'NORTH')),
  'string Exists': ({ properties }) => allOf(predicate(properties.colour, 'Exists')),
  'number Equals': ({ properties }) => allOf(predicate(properties.count, 'Equals', 7)),
  'number NotEquals': ({ properties }) => allOf(predicate(properties.count, 'NotEquals', 77)),
  'number GreaterThan': ({ properties }) => allOf(predicate(properties.count, 'GreaterThan', 10)),
  'number GreaterThanOrEqual': ({ properties }) => allOf(predicate(properties.count, 'GreaterThanOrEqual', 12)),
  'number LessThan': ({ properties }) => allOf(predicate(properties.count, 'LessThan', 5)),
  'number LessThanOrEqual': ({ properties }) => allOf(predicate(properties.count, 'LessThanOrEqual', 3)),
  'boolean Equals': ({ properties }) => allOf(predicate(properties.active, 'Equals', true)),
  'timestamp OnDate': ({ properties }) => allOf(predicate(properties.seen, 'OnDate', '2024-05-01')),
  'timestamp OnTime': ({ properties }) => allOf(predicate(properties.seen, 'OnTime', '10:00:00')),
  'timestamp Before': ({ properties }) => allOf(predicate(properties.seen, 'Before', '2024-06-01')),
  'timestamp After': ({ properties }) => allOf(predicate(properties.seen, 'After', '2024-05-01T09:00:00')),
  'taxon Equals': ({ properties, taxa }) => allOf(predicate(properties.taxon, 'Equals', taxa.speciesTsn)),
  'taxon ChildOf': ({ properties, taxa }) => allOf(predicate(properties.taxon, 'ChildOf', taxa.genusTsn)),
  'taxon ParentOf': ({ properties, taxa }) => allOf(predicate(properties.taxon, 'ParentOf', taxa.speciesTsn)),
  'taxon DescendsFrom': ({ properties, taxa }) => allOf(predicate(properties.taxon, 'DescendsFrom', taxa.familyTsn)),
  'taxon AscendsFrom': ({ properties, taxa }) => allOf(predicate(properties.taxon, 'AscendsFrom', taxa.speciesTsn)),
  'code Equals, through a same-type parent and the feature it refers to': ({ properties, codes }) =>
    allOf(predicate(properties.habitat, 'Equals', codes.wetland)),
  'code NotEquals, reaching the feature the evidence refers to': ({ properties, codes }) =>
    allOf(predicate(properties.habitat, 'NotEquals', codes.wetland)),
  'geometry Intersects': ({ properties }) => allOf(predicate(properties.location, 'Intersects', REGION_POLYGON)),
  'geometry Within': ({ properties }) => allOf(predicate(properties.location, 'Within', REGION_POLYGON)),
  'geometry Contains': ({ properties }) => allOf(predicate(properties.area, 'Contains', point(-122, 50))),
  'reference cycle and parent both reaching the animal': ({ properties }) =>
    allOf(predicate(properties.count, 'Equals', 77)),
  'evidence on an ended feature type': ({ properties }) => allOf(predicate(properties.region, 'Equals', 'east')),
  'OR of equalities': ({ properties }) =>
    anyOf(predicate(properties.species, 'Equals', 'owl'), predicate(properties.species, 'Equals', 'elk')),
  'AND of equalities': ({ properties }) =>
    allOf(predicate(properties.count, 'Equals', 77), predicate(properties.count, 'Equals', 100)),
  'numeric range': ({ properties }) =>
    allOf(predicate(properties.count, 'GreaterThan', 5), predicate(properties.count, 'LessThan', 10)),
  'AND across feature types': ({ properties, taxa }) =>
    allOf(predicate(properties.region, 'Equals', 'north'), predicate(properties.taxon, 'Equals', taxa.speciesTsn)),
  'nested AND and OR across properties': ({ properties }) =>
    anyOf(
      allOf(predicate(properties.region, 'Equals', 'north'), predicate(properties.species, 'Equals', 'owl')),
      allOf(predicate(properties.colour, 'Equals', 'blue'), predicate(properties.count, 'Equals', 100))
    )
};

// The upload evaluator reads pending features through upload-local walks, and the published evaluator reads the same
// features through submission_feature_closure once they are activated. Both must select the same features. Every
// fixture, including the ended feature type, is rolled back after each test.
describe('Submission upload expression evaluation parity with published evaluation (integration)', function () {
  this.timeout(60000);
  let connection: IDBConnection;
  let submissionId: number;
  let submissionUploadId: string;
  let fixtureFeatureIds: number[];
  let fixture: ParityFixture;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    submissionId = await createTestSubmission(connection);
    submissionUploadId = await createTestUpload(connection, submissionId);
    fixture = await buildParityFixture();
  });
  afterEach(async () => {
    await connection.rollback();
    await connection.release();
  });

  /**
   * Insert a pending feature (no effective date, so absent from published closure until activated).
   *
   * @param {string} featureTypeName Seeded feature type.
   * @param {number | null} [parentId] Parent feature, if any.
   * @returns {Promise<number>} The new submission_feature_id.
   */
  async function insertFeature(featureTypeName: string, parentId: number | null = null): Promise<number> {
    const featureId = await insertPendingFeature(
      connection,
      submissionId,
      submissionUploadId,
      featureTypeName,
      parentId
    );
    fixtureFeatureIds.push(featureId);
    return featureId;
  }

  /**
   * Build the pending upload both evaluators read.
   *
   * survey (region north, area polygon)
   *   stratum (region east; its feature type is ended) > deployment (elk, inactive) > point (12, inside)
   *   deployment (owl, active) > point (3, 10:00 on 2024-05-01, inside), point (7, 2024-05-02, outside)
   *   site (forest; refers to the owl deployment)
   *     site (wetland) > observation (species taxon, counts 77 and 100, red and blue)
   *     observation (genus taxon, count 100, blue)
   *   animal (species taxon) > capture (77), with the animal and capture also referencing each other
   *
   * @returns {Promise<ParityFixture>} Ids the parity expressions refer to.
   */
  async function buildParityFixture(): Promise<ParityFixture> {
    fixtureFeatureIds = [];
    const region = await createAssignedFeatureProperty(connection, 'string', ['survey', 'stratum']);
    const area = await createAssignedFeatureProperty(connection, 'spatial', ['survey']);
    const species = await createAssignedFeatureProperty(connection, 'string', ['telemetry_deployment']);
    const active = await createAssignedFeatureProperty(connection, 'boolean', ['telemetry_deployment']);
    const count = await createAssignedFeatureProperty(connection, 'number', [
      'telemetry',
      'species_observation',
      'capture'
    ]);
    const seen = await createAssignedFeatureProperty(connection, 'datetime', ['telemetry']);
    const location = await createAssignedFeatureProperty(connection, 'spatial', ['telemetry']);
    const colour = await createAssignedFeatureProperty(connection, 'string', ['species_observation']);
    const taxon = await createAssignedFeatureProperty(connection, 'taxon', ['species_observation', 'animal']);
    const habitat = await createAssignedFeatureProperty(connection, 'code', ['sample_site']);

    const [familyTsn, genusTsn, speciesTsn] = [
      randomInt(700_000_000, 750_000_000),
      randomInt(750_000_000, 800_000_000),
      randomInt(800_000_000, 850_000_000)
    ];
    const familyId = await createTaxon(connection, `Parityidae ${randomUUID()}`, null, familyTsn, null, 'Family');
    const genusId = await createTaxon(connection, `Parityus ${randomUUID()}`, null, genusTsn, null, 'Genus');
    const speciesId = await createTaxon(
      connection,
      `Parityus testus ${randomUUID()}`,
      null,
      speciesTsn,
      null,
      'Species'
    );
    await connection.sql(SQL`UPDATE taxon SET parent_taxon_id = ${familyId} WHERE taxon_id = ${genusId}`);
    await connection.sql(SQL`UPDATE taxon SET parent_taxon_id = ${genusId} WHERE taxon_id = ${speciesId}`);
    const wetland = await createCodesetCode(connection, 'wetland', 'Wetland');
    const forest = await createCodesetCode(connection, 'forest', 'Forest');

    const surveyId = await insertFeature('survey');
    const stratumId = await insertFeature('stratum', surveyId);
    const owlDeploymentId = await insertFeature('telemetry_deployment', surveyId);
    const elkDeploymentId = await insertFeature('telemetry_deployment', stratumId);
    const firstPointId = await insertFeature('telemetry', owlDeploymentId);
    const secondPointId = await insertFeature('telemetry', owlDeploymentId);
    const thirdPointId = await insertFeature('telemetry', elkDeploymentId);
    const outerSiteId = await insertFeature('sample_site', surveyId);
    const innerSiteId = await insertFeature('sample_site', outerSiteId);
    const speciesObservationId = await insertFeature('species_observation', innerSiteId);
    const genusObservationId = await insertFeature('species_observation', outerSiteId);
    const animalId = await insertFeature('animal', surveyId);
    const captureId = await insertFeature('capture', animalId);

    await addPropertyValue(connection, 'string', surveyId, region.assignments.survey, 'north');
    await addPropertyValue(connection, 'string', stratumId, region.assignments.stratum, 'east');
    await addPropertyValue(connection, 'spatial', surveyId, area.assignments.survey, JSON.stringify(REGION_POLYGON));
    await addPropertyValue(connection, 'string', owlDeploymentId, species.assignments.telemetry_deployment, 'owl');
    await addPropertyValue(connection, 'string', elkDeploymentId, species.assignments.telemetry_deployment, 'elk');
    await addPropertyValue(connection, 'boolean', owlDeploymentId, active.assignments.telemetry_deployment, true);
    await addPropertyValue(connection, 'boolean', elkDeploymentId, active.assignments.telemetry_deployment, false);
    await addPropertyValue(connection, 'number', firstPointId, count.assignments.telemetry, 3);
    await addPropertyValue(connection, 'number', secondPointId, count.assignments.telemetry, 7);
    await addPropertyValue(connection, 'number', thirdPointId, count.assignments.telemetry, 12);
    await addPropertyValue(connection, 'datetime', firstPointId, seen.assignments.telemetry, '2024-05-01', '10:00:00');
    await addPropertyValue(connection, 'datetime', secondPointId, seen.assignments.telemetry, '2024-05-02', '08:30:00');
    await addPropertyValue(connection, 'datetime', thirdPointId, seen.assignments.telemetry, '2024-06-15', null);
    await addPropertyValue(
      connection,
      'spatial',
      firstPointId,
      location.assignments.telemetry,
      JSON.stringify(point(-122, 50))
    );
    await addPropertyValue(
      connection,
      'spatial',
      secondPointId,
      location.assignments.telemetry,
      JSON.stringify(point(-110, 60))
    );
    await addPropertyValue(
      connection,
      'spatial',
      thirdPointId,
      location.assignments.telemetry,
      JSON.stringify(point(-121, 51))
    );
    await addPropertyValue(connection, 'string', speciesObservationId, colour.assignments.species_observation, 'red');
    await addPropertyValue(connection, 'string', speciesObservationId, colour.assignments.species_observation, 'blue');
    await addPropertyValue(connection, 'string', genusObservationId, colour.assignments.species_observation, 'blue');
    await addPropertyValue(connection, 'number', speciesObservationId, count.assignments.species_observation, 77);
    await addPropertyValue(connection, 'number', speciesObservationId, count.assignments.species_observation, 100);
    await addPropertyValue(connection, 'number', genusObservationId, count.assignments.species_observation, 100);
    await addPropertyValue(connection, 'number', captureId, count.assignments.capture, 77);
    await addPropertyValue(connection, 'taxon', speciesObservationId, taxon.assignments.species_observation, speciesId);
    await addPropertyValue(connection, 'taxon', genusObservationId, taxon.assignments.species_observation, genusId);
    await addPropertyValue(connection, 'taxon', animalId, taxon.assignments.animal, speciesId);
    await addPropertyValue(connection, 'code', innerSiteId, habitat.assignments.sample_site, wetland);
    await addPropertyValue(connection, 'code', outerSiteId, habitat.assignments.sample_site, forest);

    const siteToDeployment = await createBlueprintFeatureTypeProperty(
      connection,
      'sample_site',
      'telemetry_deployment'
    );
    await insertSubmissionFeaturePropertyFeature(
      connection,
      outerSiteId,
      siteToDeployment.blueprintFeatureTypePropertyId,
      owlDeploymentId
    );
    const animalToCapture = await createBlueprintFeatureTypeProperty(connection, 'animal', 'capture');
    const captureToAnimal = await createBlueprintFeatureTypeProperty(connection, 'capture', 'animal');
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
    await connection.sql(SQL`UPDATE feature_type SET record_end_date = now() WHERE name = 'stratum'`);

    return {
      properties: {
        region: region.featurePropertyId,
        area: area.featurePropertyId,
        species: species.featurePropertyId,
        active: active.featurePropertyId,
        count: count.featurePropertyId,
        seen: seen.featurePropertyId,
        location: location.featurePropertyId,
        colour: colour.featurePropertyId,
        taxon: taxon.featurePropertyId,
        habitat: habitat.featurePropertyId
      },
      taxa: { familyTsn, genusTsn, speciesTsn },
      codes: { wetland, forest }
    };
  }

  /**
   * Run a feature id query and return its ids in ascending order.
   *
   * @param {{ toSQL: () => { toNative: () => { sql: string; bindings: readonly unknown[] } } }} query Query to run.
   * @returns {Promise<number[]>} Feature ids, ascending.
   */
  async function runIds(query: {
    toSQL: () => { toNative: () => { sql: string; bindings: readonly unknown[] } };
  }): Promise<number[]> {
    const { sql, bindings } = query.toSQL().toNative();
    const result = await connection.query(sql, bindings as unknown[]);
    return result.rows.map((row) => row.submission_feature_id).sort((a, b) => a - b);
  }

  for (const [name, buildExpression] of Object.entries(PARITY_CASES)) {
    it(`selects the same features as published evaluation: ${name}`, async () => {
      const normalized = optimizeExpression(
        await new ExpressionTreeNormalizationService(connection).normalize(buildExpression(fixture))
      );

      const pending = await runIds(
        buildSubmissionUploadFeatureIdsSubquery(submissionId, submissionUploadId, normalized)
      );

      await connection.sql(
        SQL`UPDATE submission_feature SET record_effective_date = now() WHERE submission_upload_id = ${submissionUploadId}::uuid`
      );
      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(submissionUploadId);
      const published = await runIds(
        buildExpressionTreeFeatureIdsSubquery(null, normalized, undefined).whereIn(
          'anchor_sf.submission_feature_id',
          fixtureFeatureIds
        )
      );

      expect(pending).to.eql(published);
      expect(pending).not.to.be.empty;
    });
  }
});
