// Integration test for the submission-upload tile function — verifies that biohub.martin_upload encodes
// every spatial property of every active feature of the requested upload, and only of that upload,
// against the real database.
//
// Like martin_feature, this function is not the security boundary: access is decided when the token is
// minted (system administrators only). What it must still guarantee is that the identifiers in the
// token are honoured exactly — the upload must belong to the named submission — that "active" means
// not ended rather than published (features under review have never been published), and that a
// malformed context can never be coaxed into an error or into returning another upload's geometry.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted. martin_upload is
// SECURITY DEFINER, but it executes inside the caller's transaction, so uncommitted fixtures are
// visible to it.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import {
  addTestGeometry,
  buildWktGeometries,
  decodeGeometriesLayer,
  renderTile,
  TILE_TEST_POINT,
  useTileFunctionFixture
} from '../helpers/test-martin-tile-helpers';
import { createTestSubmission, createTestUploadWithFeatures } from '../helpers/test-submission-helpers';

/** Feature type used for the fixtures. Any type with a geometry property would do. */
const FEATURE_TYPE = 'species_observation';

const { lng: TEST_LNG, lat: TEST_LAT } = TILE_TEST_POINT;

describe('Martin upload function (integration)', function () {
  this.timeout(20000);

  const fixture = useTileFunctionFixture(FEATURE_TYPE);

  /**
   * Insert a feature into an upload directly, so the lifecycle dates are controlled by the test.
   *
   * `createTestFeature` is deliberately not used: it publishes the feature (`record_effective_date =
   * now()`) and creates a fresh upload per feature, neither of which describes an upload under review.
   * The default here is a PENDING feature — no effective date — because that is what every feature of
   * an upload under validation review looks like.
   */
  const insertFeature = async (
    submissionId: number,
    submissionUploadId: string,
    lifecycle: { effective?: boolean; ended?: boolean } = {}
  ): Promise<number> => {
    const result = await fixture.connection.sql(
      SQL`
        INSERT INTO submission_feature (
          submission_id, submission_upload_id, feature_type_id, data, data_byte_size,
          record_effective_date, record_end_date, create_user
        )
        VALUES (
          ${submissionId},
          ${submissionUploadId}::uuid,
          ${fixture.featureTypeId},
          '{"name":"upload tile test"}'::jsonb,
          600,
          ${lifecycle.effective ? 'now()' : null}::timestamptz,
          ${lifecycle.ended ? 'now()' : null}::timestamptz,
          ${fixture.connection.systemUserId()}
        )
        RETURNING submission_feature_id;
      `,
      z.object({ submission_feature_id: z.number() })
    );

    return result.rows[0].submission_feature_id;
  };

  /** Attach a geometry (as WKT) to a feature under the fixture's spatial property, returning the new row's id. */
  const addGeometry = (featureId: number, wkt: string) =>
    addTestGeometry(fixture.connection, featureId, fixture.geometryPropertyId, wkt);

  /**
   * Create a submission with one upload containing one pending feature carrying a point geometry at
   * the test location.
   */
  const createUploadWithPoint = async (
    submissionId?: number,
    lng = TEST_LNG,
    lat = TEST_LAT
  ): Promise<{ submissionId: number; uploadId: string; featureId: number; geometryId: number }> => {
    const resolvedSubmissionId = submissionId ?? (await createTestSubmission(fixture.connection));
    const uploadId = await createTestUploadWithFeatures(fixture.connection, resolvedSubmissionId, FEATURE_TYPE, []);
    const featureId = await insertFeature(resolvedSubmissionId, uploadId);
    const geometryId = await addGeometry(featureId, `POINT(${lng} ${lat})`);

    return { submissionId: resolvedSubmissionId, uploadId, featureId, geometryId };
  };

  /** Build the context string the gateway takes from the verified token. */
  const contextFor = (submissionId: number | string, uploadId: string) => `su:${submissionId}:${uploadId}`;

  /** The raw MVT bytes of the tile containing the test point. */
  const renderTileBuffer = (context: string, zoom = 12) =>
    renderTile(fixture.connection, 'martin_upload', context, { zoom });

  /** The decoded geometries layer of the tile containing the test point, asserting the tile is not empty. */
  const decodeGeometries = (context: string, zoom = 12) =>
    decodeGeometriesLayer(fixture.connection, 'martin_upload', context, zoom);

  describe('context parsing', () => {
    it('returns an empty tile when the context is missing', async () => {
      const result = await fixture.connection.sql(
        SQL`SELECT biohub.martin_upload(12, 1, 1, '{}'::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });

    it('returns an empty tile rather than an error for a malformed context', async () => {
      const uuid = '11111111-1111-4111-8111-111111111111';
      // A probing client must learn nothing from the difference between malformed and unauthorized.
      // Includes a feature-source context, which must not be honoured by this source.
      const malformed = [
        'garbage',
        'su:1',
        'su:1:',
        `su::${uuid}`,
        `su:abc:${uuid}`,
        'su:1:not-a-uuid',
        `su:${uuid}:1`,
        `su:1:${uuid}:x`,
        `sf:1:${uuid}`,
        'sf:1:1',
        `su:1:${uuid}'; SELECT 1--`
      ];

      for (const context of malformed) {
        const result = await fixture.connection.sql(
          SQL`SELECT biohub.martin_upload(12, 1, 1, ${JSON.stringify({ context })}::json) AS tile;`,
          z.object({ tile: z.any() })
        );

        expect(result.rows[0].tile, `context "${context}" should render an empty tile`).to.be.null;
      }
    });

    it('returns an empty tile when the submission id overflows integer', async () => {
      // The pattern bounds the digit count, not the magnitude, so this reaches the cast.
      const result = await fixture.connection.sql(
        SQL`SELECT biohub.martin_upload(12, 1, 1, '{"context":"su:9999999999:11111111-1111-4111-8111-111111111111"}'::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });

    it('accepts an upper case upload id', async () => {
      const { submissionId, uploadId } = await createUploadWithPoint();

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId.toUpperCase()));

      expect(geometries).to.have.length(1);
    });
  });

  describe('upload scoping', () => {
    it('encodes every feature of the requested upload', async () => {
      const { submissionId, uploadId, geometryId } = await createUploadWithPoint();
      // A second feature at the same location: only the feature id tells them apart.
      const siblingFeatureId = await insertFeature(submissionId, uploadId);
      const siblingGeometryId = await addGeometry(siblingFeatureId, `POINT(${TEST_LNG} ${TEST_LAT})`);

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometries.map((geometry) => geometry.properties.submission_feature_property_geometry_id)).to.have.members(
        [geometryId, siblingGeometryId]
      );
      expect(new Set(geometries.map((geometry) => geometry.properties.submission_feature_id)).size).to.equal(2);
    });

    it('excludes features of another upload in the same submission', async () => {
      const { submissionId, uploadId, geometryId } = await createUploadWithPoint();
      // Same submission, same location, different upload: only upload scoping can tell them apart.
      const other = await createUploadWithPoint(submissionId);

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometries.map((geometry) => geometry.properties.submission_feature_property_geometry_id)).to.eql([
        geometryId
      ]);
      expect(geometries.map((geometry) => geometry.properties.submission_feature_property_geometry_id)).to.not.include(
        other.geometryId
      );
    });

    it('returns an empty tile when the upload belongs to a different submission', async () => {
      const { uploadId } = await createUploadWithPoint();
      const otherSubmissionId = await createTestSubmission(fixture.connection);

      // The submission id is part of the signed token, so a mismatched pair is not a valid request.
      expect(await renderTileBuffer(contextFor(otherSubmissionId, uploadId))).to.be.null;
    });

    it('returns an empty tile for an unknown upload', async () => {
      const { submissionId } = await createUploadWithPoint();

      expect(await renderTileBuffer(contextFor(submissionId, '00000000-0000-4000-8000-000000000000'))).to.be.null;
    });
  });

  describe('feature lifecycle', () => {
    it('renders a pending feature that has never been published', async () => {
      // The whole point of this source: an upload under review has no published features, so a
      // published predicate would render every review map empty.
      const { submissionId, uploadId, featureId } = await createUploadWithPoint();

      const pending = await fixture.connection.sql(
        SQL`SELECT record_effective_date FROM submission_feature WHERE submission_feature_id = ${featureId};`,
        z.object({ record_effective_date: z.any() })
      );
      expect(pending.rows[0].record_effective_date, 'fixture should be pending').to.be.null;

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometries).to.have.length(1);
    });

    it('renders a published feature that has not ended', async () => {
      const { submissionId, uploadId } = await createUploadWithPoint();
      const publishedFeatureId = await insertFeature(submissionId, uploadId, { effective: true });
      await addGeometry(publishedFeatureId, `POINT(${TEST_LNG} ${TEST_LAT})`);

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometries).to.have.length(2);
    });

    it('excludes a feature ended by reconciliation', async () => {
      const { submissionId, uploadId } = await createUploadWithPoint();
      // Reconciliation retires a superseded upload's pending features with record_end_date = now().
      const endedFeatureId = await insertFeature(submissionId, uploadId, { ended: true });
      const endedGeometryId = await addGeometry(endedFeatureId, `POINT(${TEST_LNG} ${TEST_LAT})`);

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometries).to.have.length(1);
      expect(geometries.map((geometry) => geometry.properties.submission_feature_property_geometry_id)).to.not.include(
        endedGeometryId
      );
    });

    it('returns an empty tile once every feature of the upload has ended', async () => {
      const { submissionId, uploadId, featureId } = await createUploadWithPoint();

      await fixture.connection.sql(SQL`
        UPDATE submission_feature SET record_end_date = now() - interval '1 day'
        WHERE submission_feature_id = ${featureId};
      `);

      // A token minted before the upload was superseded stops producing tiles immediately.
      expect(await renderTileBuffer(contextFor(submissionId, uploadId))).to.be.null;
    });
  });

  describe('spatial properties', () => {
    it('encodes every value of a property that has several', async () => {
      const { submissionId, uploadId, featureId } = await createUploadWithPoint();
      await addGeometry(featureId, `POINT(${TEST_LNG + 0.0005} ${TEST_LAT + 0.0005})`);
      await addGeometry(featureId, `POINT(${TEST_LNG + 0.001} ${TEST_LAT + 0.001})`);

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometries).to.have.length(3);
    });

    it('carries the metadata needed to identify each spatial property and its feature', async () => {
      const { submissionId, uploadId, featureId, geometryId } = await createUploadWithPoint();

      const [geometry] = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometry.properties.submission_feature_property_geometry_id).to.equal(geometryId);
      expect(geometry.properties.submission_feature_id).to.equal(featureId);
      expect(geometry.properties.feature_type_property_id).to.equal(fixture.geometryPropertyId);
      expect(geometry.properties.property_display_name).to.be.a('string').and.not.empty;
      expect(geometry.properties.property_name).to.be.a('string').and.not.empty;
      // The MVT feature id keys each geometry, so fragments split across tiles share an identity.
      expect(geometry.id).to.equal(geometryId);
      // The id column is consumed by ST_AsMVT, never duplicated into the attributes.
      expect(geometry.properties).to.not.have.property('mvt_feature_id');
    });
  });

  describe('geometry handling', () => {
    it('encodes points, lines, polygons and multi-geometries', async () => {
      const { submissionId, uploadId, featureId } = await createUploadWithPoint();

      // Every geometry type, on top of the fixture's own point.
      const wktGeometries = buildWktGeometries();

      for (const wkt of wktGeometries) {
        await addGeometry(featureId, wkt);
      }

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      // Every geometry type survives clipping and MVT encoding.
      expect(geometries).to.have.length(wktGeometries.length + 1);
    });

    it('returns an empty tile where the upload does not reach', async () => {
      const { submissionId, uploadId } = await createUploadWithPoint();

      // Mid ocean, far from the fixture.
      expect(
        await renderTile(fixture.connection, 'martin_upload', contextFor(submissionId, uploadId), {
          lng: -179.9,
          lat: 0
        })
      ).to.be.null;
    });

    it('excludes geometry of the same upload that lies outside the requested tile', async () => {
      const { submissionId, uploadId, featureId } = await createUploadWithPoint();
      // Far enough away to fall in a different tile at z12.
      await addGeometry(featureId, `POINT(${TEST_LNG + 5} ${TEST_LAT + 3})`);

      const geometries = await decodeGeometries(contextFor(submissionId, uploadId));

      expect(geometries).to.have.length(1);
    });
  });

  describe('query plan', () => {
    it('finds the upload through its partial index rather than scanning either table', async () => {
      // The candidate set must be bounded by the upload whatever the zoom: a low zoom tile driven
      // from the geometry GIST index would scan every geometry in the province.
      const plan = await fixture.connection.sql(
        SQL`
          EXPLAIN (COSTS OFF)
          SELECT g.submission_feature_property_geometry_id
          FROM biohub.submission_feature sf
          JOIN biohub.submission_feature_property_geometry g ON g.submission_feature_id = sf.submission_feature_id
          WHERE sf.submission_upload_id = '11111111-1111-4111-8111-111111111111'::uuid
            AND sf.submission_id = 1
            AND sf.record_end_date IS NULL
            AND g.value && public.ST_Transform(public.ST_TileEnvelope(4, 2, 5), 4326);
        `,
        z.object({ 'QUERY PLAN': z.string() })
      );

      const planText = plan.rows.map((row) => row['QUERY PLAN']).join('\n');

      expect(planText).to.match(/submission_feature_idx5_active_submission_upload|submission_feature_idx9/);
      expect(planText).to.not.contain('Seq Scan on submission_feature ');
      expect(planText).to.not.contain('Seq Scan on submission_feature_property_geometry');
    });
  });
});
