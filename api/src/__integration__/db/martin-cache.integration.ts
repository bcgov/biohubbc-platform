// Integration test for Martin's tile cache keying — proves the trusted `context` query parameter is
// part of Martin's cache key, which is the property the whole caching design rests on: a cached tile
// must never be served to an authorization context other than the one it was rendered for.
//
// The proof is by mutation: render a tile under context A, change the underlying data, and observe
// that context A still gets the stale cached bytes (caching is real) while context B — same tile,
// different context — gets a fresh render reflecting the change (the context partitions the cache).
//
// Unlike the other suites, this one talks to the REAL Martin server over HTTP, and Martin renders
// through its own database session — so fixtures must be COMMITTED, and are torn down explicitly.
// Every id is created fresh per run, so reruns never collide with stale cache entries.
//
// Run: make test-db
// Requires: make web AND make martin (Martin must be running against the same database)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

const FEATURE_TYPE = 'species_observation';

/** A point in BC, and the z12 tile that contains it. */
const TEST_LNG = -123.36;
const TEST_LAT = 48.43;
const ZOOM = 12;

const MARTIN_URL = process.env.MARTIN_URL || `http://localhost:${process.env.MARTIN_PORT || 3000}`;

/** Slippy tile coordinates containing the test point. */
const tileX = Math.floor(((TEST_LNG + 180) / 360) * 2 ** ZOOM);
const tileY = Math.floor(
  ((1 - Math.log(Math.tan((TEST_LAT * Math.PI) / 180) + 1 / Math.cos((TEST_LAT * Math.PI) / 180)) / Math.PI) / 2) *
    2 ** ZOOM
);

describe('Martin tile cache keying (integration)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let martinAvailable = false;

  let featureId: number | null = null;
  let submissionId: number | null = null;
  const contextIds: string[] = [];

  before(async function () {
    initDBPool(defaultPoolConfig);

    // The suite needs a live Martin; without one there is nothing to prove, so skip rather than fail
    // a database-only run.
    try {
      const health = await fetch(`${MARTIN_URL}/health`);
      martinAvailable = health.ok;
    } catch {
      martinAvailable = false;
    }

    if (!martinAvailable) {
      this.skip();
    }
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    // Committed fixtures: tear down explicitly, in FK order, and commit the teardown. The upload,
    // ticket and team scaffolding the fixture helpers create is not submission-anchored and stays
    // behind as inert rows; everything the tile path can see is removed.
    try {
      if (contextIds.length) {
        await connection.sql(SQL`DELETE FROM martin_context WHERE martin_context_id = ANY(${contextIds}::uuid[]);`);
        contextIds.length = 0;
      }

      if (featureId !== null) {
        await connection.sql(
          SQL`DELETE FROM submission_feature_property_geometry WHERE submission_feature_id = ${featureId};`
        );
        await connection.sql(SQL`
          DELETE FROM submission_feature_closure
          WHERE source_submission_feature_id = ${featureId} OR target_submission_feature_id = ${featureId};
        `);
        await connection.sql(SQL`DELETE FROM submission_feature WHERE submission_feature_id = ${featureId};`);
        featureId = null;
      }

      if (submissionId !== null) {
        await connection.sql(SQL`
          DELETE FROM submission_upload_status sus
          USING submission_upload su
          WHERE su.submission_id = ${submissionId}
            AND sus.submission_upload_id = su.submission_upload_id;
        `);
        await connection.sql(SQL`DELETE FROM submission_upload WHERE submission_id = ${submissionId};`);
        await connection.sql(SQL`DELETE FROM submission WHERE submission_id = ${submissionId};`);
        submissionId = null;
      }

      await connection.commit();
    } finally {
      connection.release();
    }
  });

  /** Create and COMMIT a browse-all anonymous context, so Martin's session can resolve it. */
  const createCommittedContext = async (): Promise<string> => {
    const featureType = await connection.sql(
      SQL`SELECT feature_type_id FROM feature_type WHERE name = ${FEATURE_TYPE};`,
      z.object({ feature_type_id: z.number() })
    );

    const result = await connection.sql(
      SQL`
        INSERT INTO martin_context (
          context_hash, expression_id, feature_type_id, system_user_id, record_end_date, create_user
        ) VALUES (
          'martin-cache-integration',
          NULL,
          ${featureType.rows[0].feature_type_id},
          NULL,
          now() + make_interval(secs => 600),
          ${connection.systemUserId()}
        )
        RETURNING martin_context_id;
      `,
      z.object({ martin_context_id: z.string() })
    );

    const contextId = result.rows[0].martin_context_id;
    contextIds.push(contextId);

    return contextId;
  };

  /** Fetch a tile straight from Martin (bypassing the gateway), returning status and body bytes. */
  const fetchTile = async (contextId: string): Promise<{ status: number; bytes: Buffer }> => {
    const response = await fetch(
      `${MARTIN_URL}/search/${ZOOM}/${tileX}/${tileY}?context=${encodeURIComponent(contextId)}`,
      { headers: { 'accept-encoding': 'identity' } }
    );

    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
  };

  it('includes the context parameter in the tile cache key', async () => {
    // COMMITTED fixture: a feature with a point in the test tile, visible to anonymous callers.
    submissionId = await createTestSubmission(connection);
    featureId = await createTestFeature(connection, submissionId, FEATURE_TYPE, { name: 'martin cache test' });

    const spatial = await connection.sql(
      SQL`
        SELECT ftp.feature_type_property_id
        FROM feature_type_property ftp
        JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
        JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
        JOIN feature_type ft ON ft.feature_type_id = ftp.feature_type_id
        WHERE ft.name = ${FEATURE_TYPE} AND fpt.name = 'spatial'
        LIMIT 1;
      `,
      z.object({ feature_type_property_id: z.number() })
    );

    await connection.sql(SQL`
      INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES (
        ${featureId},
        ${spatial.rows[0].feature_type_property_id},
        public.ST_SetSRID(public.ST_MakePoint(${TEST_LNG}, ${TEST_LAT}), 4326),
        ${connection.systemUserId()}
      );
    `);
    await connection.sql(SQL`
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      VALUES (${featureId}, ${featureId}, true) ON CONFLICT DO NOTHING;
    `);

    const contextA = await createCommittedContext();
    const contextB = await createCommittedContext();

    await connection.commit();

    // Cold render under context A: the tile contains the feature.
    const first = await fetchTile(contextA);
    expect(first.status).to.equal(200);
    expect(first.bytes.length).to.be.greaterThan(0);

    // Mutate the COMMITTED data: end-date the feature, so any fresh render is now empty.
    await connection.sql(SQL`
      UPDATE submission_feature SET record_end_date = now() - make_interval(secs => 1)
      WHERE submission_feature_id = ${featureId};
    `);
    await connection.commit();

    // Context A again: Martin must serve its cached bytes — stale, identical, and NOT re-rendered.
    // (If this fails with a 204, Martin's cache is not holding tiles at all.)
    const second = await fetchTile(contextA);
    expect(second.status).to.equal(200);
    expect(second.bytes.equals(first.bytes), 'context A should be served from cache after the mutation').to.be.true;

    // Context B, same tile: a different key, so a fresh render that reflects the mutation. If the
    // cache ignored the context parameter, B would receive A's stale 200 here.
    const fresh = await fetchTile(contextB);
    expect(fresh.status, 'a different context must miss the cache and see the mutation').to.equal(204);
  });
});
