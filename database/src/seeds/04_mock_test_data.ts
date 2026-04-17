import { faker } from '@faker-js/faker';
// @ts-ignore ignore error over missing geojson-random declaration (.d.ts) file
import random from 'geojson-random';
import { Knex } from 'knex';

// Disable mock data seeding by default. Set `ENABLE_MOCK_FEATURE_DATA=true` to enable.
const ENABLE_MOCK_FEATURE_SEEDING = Boolean(process.env.ENABLE_MOCK_FEATURE_SEEDING === 'true' || false);
const NUM_MOCK_FEATURE_SUBMISSIONS = Number(process.env.NUM_MOCK_FEATURE_SUBMISSIONS || 0);
const CONTRIBUTOR_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;

/**
 * Search query for performance testing.
 *
 * -- Select feature_submissions on multiple conditions (AND)
 * SELECT * FROM submission_feature WHERE submission_feature_id IN (
 *     SELECT DISTINCT t1.submission_feature_id FROM submission_feature t1
 *     WHERE EXISTS (
 *         SELECT 1 FROM search_string t3 WHERE t3.submission_feature_id = t1.submission_feature_id AND t3.value LIKE '%cor%'
 *     ) AND EXISTS (
 *         SELECT 1 FROM search_string t4 WHERE t4.submission_feature_id = t1.submission_feature_id AND t4.value LIKE '%arx%'
 *     ) AND EXISTS (
 *         SELECT 1 FROM search_number t5 WHERE t5.submission_feature_id = t1.submission_feature_id AND t5.feature_property_id = (SELECT feature_property_id FROM feature_property fp WHERE fp.name = 'count') AND t5.value > 40 AND t5.value < 50
 *     ) AND EXISTS (
 *         SELECT 1 FROM search_datetime t7 WHERE t7.submission_feature_id = t1.submission_feature_id AND t7.value > '2023-08-01' AND t7.value < '2024-04-01' AND t7.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'start_date')
 *     ) AND EXISTS (
 *         SELECT 1 FROM search_datetime t8 WHERE t8.submission_feature_id = t1.submission_feature_id AND t8.value > '2023-08-01' AND t8.value < '2024-04-01' AND t8.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'end_date')
 *     ) AND EXISTS (
 *         SELECT 1 FROM search_spatial t9 WHERE t9.submission_feature_id = t1.submission_feature_id AND public.ST_INTERSECTS(t9.value, public.ST_GeomFromGeoJSON('{"coordinates":[[[-128.12596524778567,50.90095573861839],[-128.6951954392062,50.75063500834236],[-127.71373499792975,49.63640480052965],[-125.38308025753057,48.53083459202276],[-123.3647465830768,48.15806226354249],[-122.94623399379441,48.36504151433127],[-123.37439502763095,49.13209156231335],[-124.66835857611437,49.81654191782255],[-126.6572708981094,50.607171392416745],[-127.89342678974776,50.9888374217299],[-128.12596524778567,50.90095573861839]]],"type":"Polygon"}'))
 *     )
 * );
 */

/**
 * Inserts mock submission/feature data, geared towards performance testing.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  if (!ENABLE_MOCK_FEATURE_SEEDING) {
    return knex.raw(`SELECT null;`); // dummy query to appease knex
  }

  if (!CONTRIBUTOR_CLIENT_ID) {
    throw new Error('KEYCLOAK_CLIENT_ID is required to seed mock submission data');
  }

  // Transaction so that the schema and search path is set for the SQL statements in insertRecord()
  await knex.transaction(async (trx) => {
    await trx.raw(`
      SET SCHEMA 'biohub';
      SET SEARCH_PATH = 'biohub','public';
    `);

    for (let i = 0; i < NUM_MOCK_FEATURE_SUBMISSIONS; i++) {
      await insertRecord(trx); // pass the transaction instead of knex
    }
  });
}

/**
 * Insert a single submission record, a single dataset record, and related records.
 *
 * @param {Knex} knex
 */
const insertRecord = async (knex: Knex) => {
  // Submission
  const isReviewed = Math.random() > 0.5;
  const isPublished = isReviewed && Math.random() > 0.5;
  const submission_id = await insertSubmissionRecord(knex, isReviewed, isPublished);

  const upload_id = await insertUploadRecord(knex);
  const submission_upload_id = await insertSubmissionUploadRecord(knex, submission_id, upload_id);

  // Dataset
  const parent_submission_feature_id1 = await insertDatasetRecord(knex, { submission_id, submission_upload_id });

  // Sample Sites and their children
  const sampleSitePromises = Array.from({ length: 10 }).map(async () => {
    const parent_submission_feature_id2 = await insertSampleSiteRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: parent_submission_feature_id1
    });

    // Animals
    const animalPromises = Array.from({ length: 2 }).map(() =>
      insertAnimalRecord(knex, {
        submission_id,
        submission_upload_id,
        parent_submission_feature_id: parent_submission_feature_id2
      })
    );

    // Observations
    const observationPromises = Array.from({ length: 20 }).map(() =>
      insertObservationRecord(knex, {
        submission_id,
        submission_upload_id,
        parent_submission_feature_id: parent_submission_feature_id2
      })
    );

    // Wait for all animals and observations for this sample site
    await Promise.all([...animalPromises, ...observationPromises]);
  });

  // Telemetry
  const telemetryPromises = Array.from({ length: 100 }).map(() =>
    insertTelemetryRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: parent_submission_feature_id1
    })
  );

  // Wait for all sample sites and telemetry to complete concurrently
  await Promise.all([...sampleSitePromises, ...telemetryPromises]);
};

export const insertSubmissionRecord = async (
  knex: Knex,
  includeSecurityReview = false,
  includePublishTimestamp = false
): Promise<number> => {
  const response = await knex.raw(`${insertSubmission(includeSecurityReview, includePublishTimestamp)}`);
  const submission_id = response.rows[0].submission_id;

  return submission_id;
};

export const insertDatasetRecord = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: null,
      feature_type: 'dataset',
      data: {
        name: `Survey ${faker.animal.type()} ${faker.commerce.department()}`,
        description: faker.lorem.sentence({ min: 5, max: 15 }),
        start_date: faker.date.past().toISOString(),
        end_date: faker.date.future().toISOString(),
        geometry: random.point(
          1, // number of features in feature collection
          [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
        )['features'][0]['geometry']
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);

  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);

  //   await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id })}`);
  //   await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id })}`);
  //   await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPolygon({ submission_feature_id })}`);

  return submission_feature_id;
};

export const insertUploadRecord = async (knex: Knex): Promise<string> => {
  const [{ upload_id }] = await knex('upload')
    .insert({
      upload_status: 'completed',
      create_user: 1,
      record_end_date: new Date()
    })
    .returning('upload_id');

  return upload_id;
};

export const insertSubmissionUploadRecord = async (
  knex: Knex,
  submission_id: number,
  upload_id: string
): Promise<string> => {
  const ticket_id = await ensureTicketForSubmissionUpload(knex, { submission_id, upload_id });

  const [{ submission_upload_id }] = await knex('submission_upload')
    .insert({
      submission_id,
      upload_id,
      create_user: 1,
      ticket_id
    })
    .returning('submission_upload_id');

  return submission_upload_id;
};

const ensureTicketForSubmissionUpload = async (
  knex: Knex,
  input: { submission_id: number; upload_id: string }
): Promise<string> => {
  // Use an existing system_user for create_user to satisfy NOT NULL constraints.
  const createUserRow = await knex('system_user').whereNull('record_end_date').select('system_user_id').first();
  const create_user = createUserRow?.system_user_id ?? 1;

  // Keep a stable team across seed runs so we only need one FK target.
  const teamName = 'Seed Submission Upload Team';
  const team = await knex('team').where({ name: teamName }).whereNull('record_end_date').first();
  const team_id =
    team?.team_id ??
    (
      await knex('team')
        .insert({
          name: teamName,
          description: 'Auto-generated team for submission_upload seed tickets.',
          create_user
        })
        .returning(['team_id'])
    )[0].team_id;

  // Make subject unique per upload UUID so rerunning seeds can reuse the same ticket.
  const subject = `Submission Upload - ${input.upload_id}`;
  const existing = await knex('ticket').where({ subject }).whereNull('record_end_date').first();
  if (existing?.ticket_id) {
    return existing.ticket_id;
  }

  const ticket_slug = await generateUniqueTicketSlug(knex);

  const [created] = await knex('ticket')
    .insert({
      ticket_slug,
      subject,
      description: null,
      team_id,
      priority: 'medium',
      status: 'open',
      create_user
    })
    .returning(['ticket_id']);

  const ticket_id = created.ticket_id as string;

  await knex('ticket_status').insert({
    ticket_id,
    status: 'open',
    create_user
  });

  return ticket_id;
};

/**
 * Generate an unused DDDNNNNN ticket slug for the current UTC day.
 * (DDD = day-of-year, NNNNN = per-day sequence)
 */
const generateUniqueTicketSlug = async (knex: Knex): Promise<string> => {
  const now = new Date();
  const utcYearStart = Date.UTC(now.getUTCFullYear(), 0, 0);
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayOfYear = Math.floor((utcToday - utcYearStart) / (1000 * 60 * 60 * 24));
  const dayPrefix = dayOfYear.toString().padStart(3, '0');

  const row = await knex('ticket')
    .whereRaw('ticket_slug LIKE ?', [`${dayPrefix}%`])
    .select(knex.raw('COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) as last_value'))
    .first();

  const lastValueRaw = row?.last_value;
  const nextSequenceInit = lastValueRaw === undefined || lastValueRaw === null ? -1 : Number(lastValueRaw);
  let nextSequence = Number.isNaN(nextSequenceInit) ? -1 : nextSequenceInit;
  // Ensure uniqueness even if another process inserted the candidate.
  while (nextSequence < 100000) {
    nextSequence += 1;
    const candidate = `${dayPrefix}${nextSequence.toString().padStart(5, '0')}`;
    const exists = await knex('ticket').where({ ticket_slug: candidate }).whereNull('record_end_date').first();
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique ticket_slug for seed data');
};

export const insertSampleSiteRecord = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'sample_site',
      data: {
        name: `Sample Site ${faker.lorem.words(3)}`,
        description: faker.lorem.words({ min: 5, max: 100 }),
        geometry: random.point(
          1, // number of features in feature collection
          [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
        )['features'][0]['geometry']
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPolygon({ submission_feature_id })}`);

  return submission_feature_id;
};

export const insertObservationRecord = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'species_observation',
      data: {
        taxon_id: faker.number.int({ min: 10000, max: 99999 }),
        geometry: random.point(
          1, // number of features in feature collection
          [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
        )['features'][0]['geometry'],
        count: faker.number.int({ min: 0, max: 100 })
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);

  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id })}`);

  //   await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  //   await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPoint({ submission_feature_id })}`);

  return submission_feature_id;
};

const insertAnimalRecord = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'animal',
      data: {
        species: faker.animal.type(),
        count: faker.number.int({ min: 0, max: 100 }),
        taxon_id: faker.number.int({ min: 10000, max: 99999 }),
        start_date: faker.date.past().toISOString(),
        end_date: faker.date.future().toISOString()
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);

  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPoint({ submission_feature_id })}`);

  return submission_feature_id;
};

export const insertSubmission = (includeSecurityReviewTimestamp: boolean, includePublishTimestamp: boolean) => {
  const securityReviewTimestamp = includeSecurityReviewTimestamp ? `$$${faker.date.past().toISOString()}$$` : null;
  // Only generate a non-null publish timestamp if the security timestamp is non-null (to confirm to database constraints)
  const publishTimestamp =
    includePublishTimestamp && !!securityReviewTimestamp ? `$$${faker.date.past().toISOString()}$$` : null;

  return `
  INSERT INTO submission
  (
      uuid,
      name,
      description,
      comment,
      security_review_timestamp,
      publish_timestamp,
      system_user_id,
      contributor_id
  )
  values
  (
      public.gen_random_uuid(),
      $$${faker.company.name()}$$,
      $$Description: ${faker.lorem.words({ min: 5, max: 100 })}$$,
      $$Comment: ${faker.lorem.words({ min: 5, max: 100 })}$$,
      ${securityReviewTimestamp},
      ${publishTimestamp},
      (
        SELECT csu.system_user_id
        FROM contributor_system_user csu
        JOIN contributor c ON c.contributor_id = csu.contributor_id
        WHERE LOWER(c.client_id) = LOWER('${CONTRIBUTOR_CLIENT_ID}')
          AND c.record_end_date IS NULL
          AND csu.record_end_date IS NULL
        LIMIT 1
      ),
      (
        SELECT contributor_id
        FROM contributor
        WHERE LOWER(client_id) = LOWER('${CONTRIBUTOR_CLIENT_ID}')
          AND record_end_date IS NULL
        LIMIT 1
      )
  )
  RETURNING submission_id;
`;
};

export const insertSubmissionFeature = (options: {
  submission_id: number;
  submission_upload_id: string;
  parent_submission_feature_id: number | null;
  feature_type: 'dataset' | 'sample_site' | 'species_observation' | 'animal' | 'artifact' | 'telemetry';
  data: { [key: string]: any };
}) => `
    INSERT INTO submission_feature
    (
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        feature_type_id,
        source_id,
        data,
        record_effective_date
    )
    values
    (
        ${options.submission_id},
        '${options.submission_upload_id}',
        ${options.parent_submission_feature_id},
        (select feature_type_id from feature_type where name = '${options.feature_type}'),
        public.gen_random_uuid(),
        ${options.data ? `$$${JSON.stringify(options.data)}$$` : null},
        now()
    )
    RETURNING submission_feature_id;
`;

const insertSearchString = (options: { submission_feature_id: number }) => `
    INSERT INTO submission_feature_property_string
    (
        submission_feature_id,
        feature_type_property_id,
        value,
        create_user
    )
    SELECT
        sf.submission_feature_id,
        ftp.feature_type_property_id,
        $$${faker.lorem.words(3)}$$,
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'name'
    LIMIT 1;
`;

const insertSearchNumber = (options: { submission_feature_id: number }) => `
    INSERT INTO submission_feature_property_number
    (
        submission_feature_id,
        feature_type_property_id,
        value,
        create_user
    )
    SELECT
        sf.submission_feature_id,
        ftp.feature_type_property_id,
        ${faker.number.int({ min: 0, max: 100 })},
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'count'
    LIMIT 1;
`;

const insertSearchStringTaxonomy = (options: { submission_feature_id: number }) => `
    INSERT INTO submission_feature_property_taxon
    (
        submission_feature_id,
        feature_type_property_id,
        taxon_id,
        create_user
    )
    SELECT
        sf.submission_feature_id,
        ftp.feature_type_property_id,
        t.taxon_id,
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    JOIN taxon t ON TRUE
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'taxon_id'
    ORDER BY random()
    LIMIT 1;
`;

const insertSearchStartDatetime = (options: { submission_feature_id: number }) => {
  const timestamp = faker.date.past().toISOString();

  return `
    INSERT INTO submission_feature_property_timestamp
    (
        submission_feature_id,
        feature_type_property_id,
        date_value,
        time_value,
        create_user
    )
    SELECT
        sf.submission_feature_id,
        ftp.feature_type_property_id,
        $$${timestamp}$$::timestamptz::date,
        $$${timestamp}$$::timestamptz::time,
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'start_date'
    LIMIT 1;
`;
};

const insertSearchEndDatetime = (options: { submission_feature_id: number }) => {
  const timestamp = faker.date.future().toISOString();

  return `
    INSERT INTO submission_feature_property_timestamp
    (
        submission_feature_id,
        feature_type_property_id,
        date_value,
        time_value,
        create_user
    )
    SELECT
        sf.submission_feature_id,
        ftp.feature_type_property_id,
        $$${timestamp}$$::timestamptz::date,
        $$${timestamp}$$::timestamptz::time,
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'end_date'
    LIMIT 1;
`;
};

const insertSpatialPolygon = (options: { submission_feature_id: number }) =>
  `
    INSERT INTO submission_feature_property_geometry
    (
        submission_feature_id,
        feature_type_property_id,
        value,
        create_user
    )
    SELECT
        sf.submission_feature_id,
        ftp.feature_type_property_id,
        public.ST_GeomFromGeoJSON(
            '${JSON.stringify(
              random.polygon(
                1, // number of features in feature collection
                randomIntFromInterval(4, 30), // number of coordinates
                1, // degrees freedom
                [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
              )['features'][0]['geometry']
            )}'
        ),
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'geometry'
    LIMIT 1;
`;

const insertSpatialPoint = (options: { submission_feature_id: number }) =>
  `
    INSERT INTO submission_feature_property_geometry
    (
        submission_feature_id,
        feature_type_property_id,
        value,
        create_user
    )
    SELECT
        sf.submission_feature_id,
        ftp.feature_type_property_id,
        public.ST_GeomFromGeoJSON(
            '${JSON.stringify(
              random.point(
                1, // number of features in feature collection
                [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
              )['features'][0]['geometry']
            )}'
        ),
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'geometry'
    LIMIT 1;
`;

const randomIntFromInterval = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const insertTelemetryRecord = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string; parent_submission_feature_id: number }
): Promise<number> => {
  const telemetryData = {
    device_id: faker.string.alphanumeric({ length: 8 }),
    latitude: faker.number.float({ min: 48.617424, max: 60.664785, multipleOf: 0.000001 }),
    longitude: faker.number.float({ min: -135.878906, max: -114.433594, multipleOf: 0.000001 }),
    timestamp: faker.date.recent().toISOString(),
    temperature: faker.number.float({ min: -20, max: 50, multipleOf: 0.1 }),
    humidity: faker.number.float({ min: 0, max: 100, multipleOf: 0.1 }),
    status: faker.helpers.arrayElement(['active', 'idle', 'error'])
  };

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'telemetry',
      data: telemetryData
    })}`
  );

  const submission_feature_id = response.rows[0].submission_feature_id;

  // Add search indices
  await knex.raw(`${insertSearchString({ submission_feature_id })}`); // e.g., status
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`); // e.g., temperature
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`); // e.g., humidity

  // Spatial search index
  await knex.raw(
    `${insertSpatialPoint({
      submission_feature_id
    })}`
  );

  return submission_feature_id;
};
