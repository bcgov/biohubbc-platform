import { faker } from '@faker-js/faker';
// @ts-ignore ignore error over missing geojson-random declaration (.d.ts) file
import random from 'geojson-random';
import { Knex } from 'knex';

// Disable mock data seeding by default. Set `ENABLE_MOCK_FEATURE_DATA=true` to enable.
const ENABLE_MOCK_FEATURE_SEEDING = Boolean(process.env.ENABLE_MOCK_FEATURE_SEEDING === 'true' || false);
const NUM_MOCK_FEATURE_SUBMISSIONS = Number(process.env.NUM_MOCK_FEATURE_SUBMISSIONS || 0);

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

  // Transaction so that the schema and search path is set for the SQL statements in insertRecord()
  await knex.transaction(async (trx) => {
    await trx.raw(`
      SET SCHEMA 'biohub';
      SET SEARCH_PATH = 'biohub','public';
    `);

    // Ensure there are mock taxonomy records for animals/observations to reference
    await ensureTaxonomySeed(trx);
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

  // Telemetry Deployments
  const deployments: { id: number; devices: { submission_feature_id: number; device_id: string }[] }[] = [];
  for (let i = 0; i < 5; i++) {
    const deploymentId = await insertTelemetryDeployment(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: parent_submission_feature_id1
    });
    const devices: { submission_feature_id: number; device_id: string }[] = [];
    for (let j = 0; j < 2; j++) {
      const deviceInfo = await insertTelemetryDevice(knex, {
        submission_id,
        submission_upload_id,
        parent_submission_feature_id: deploymentId
      });
      devices.push(deviceInfo);
    }
    deployments.push({ id: deploymentId, devices });
  }

  // Sample Sites and their children
  const animalIds: number[] = [];
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
    const animalResults = await Promise.all(animalPromises);
    await Promise.all(observationPromises);

    // Collect animal IDs
    animalIds.push(...animalResults);
  });

  // Telemetry
  const telemetryPromises = Array.from({ length: 100 }).map(() => {
    const randomDeployment = deployments[Math.floor(Math.random() * deployments.length)];
    return insertTelemetryRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: randomDeployment.id
    });
  });

  // Wait for all sample sites and telemetry to complete concurrently
  await Promise.all([...sampleSitePromises, ...telemetryPromises]);

  // Seed submission_feature_feature table
  for (const deployment of deployments) {
    for (const device of deployment.devices) {
      await knex.raw(`
        INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
        VALUES (${deployment.id}, ${device.submission_feature_id})
      `);
    }
  }

  // Ensure each deployment is linked to at least one animal
  for (let i = 0; i < deployments.length; i++) {
    const deployment = deployments[i];
    const animalId = animalIds[i % animalIds.length]; // Distribute animals across deployments
    await knex.raw(`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
      VALUES (${animalId}, ${deployment.id})
    `);
  }

  // Link additional animals to random deployments
  for (let i = deployments.length; i < animalIds.length; i++) {
    const animalId = animalIds[i];
    const randomDeployment = deployments[Math.floor(Math.random() * deployments.length)];
    await knex.raw(`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
      VALUES (${animalId}, ${randomDeployment.id})
    `);
  }
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
  const taxonId = await getRandomTaxonId(knex);

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'species_observation',
      data: {
        taxon_id: taxonId,
        geometry: random.point(
          1, // number of features in feature collection
          [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
        )['features'][0]['geometry'],
        count: faker.number.int({ min: 0, max: 100 }),
        // species observation-specific properties
        timestamp: faker.date.between({ from: '2020-01-01T00:00:00.000Z', to: new Date().toISOString() }).toISOString(),
        sign: faker.helpers.arrayElement(['tracks', 'scat', 'sighting', 'other'])
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

  await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id, taxon_id: taxonId })}`);

  //   await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  //   await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPoint({ submission_feature_id })}`);

  return submission_feature_id;
};

const insertAnimalRecord = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string; parent_submission_feature_id: number }
): Promise<number> => {
  const taxonId = await getRandomTaxonId(knex);
  const sexCodeId = await getContributorCodeId(knex, 'sex', faker.helpers.arrayElement(['male', 'female', 'unknown']));

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'animal',
      data: {
        species: faker.animal.type(),
        count: faker.number.int({ min: 0, max: 100 }),
        taxon_id: taxonId,
        animal_identifier: faker.lorem.word(),
        sex_code_id: sexCodeId,
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

  await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id, taxon_id: taxonId })}`);

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
      source_system
  )
  values
  (
      public.gen_random_uuid(),
      $$${faker.company.name()}$$,
      $$Description: ${faker.lorem.words({ min: 5, max: 100 })}$$,
      $$Comment: ${faker.lorem.words({ min: 5, max: 100 })}$$,
      ${securityReviewTimestamp},
      ${publishTimestamp},
      (SELECT system_user_id from "system_user" where user_identifier = 'SIMS'),
      'SIMS'
  )
  RETURNING submission_id;
`;
};

export const insertSubmissionFeature = (options: {
  submission_id: number;
  submission_upload_id: string;
  parent_submission_feature_id: number | null;
  feature_type:
    | 'dataset'
    | 'sample_site'
    | 'species_observation'
    | 'animal'
    | 'artifact'
    | 'telemetry'
    | 'telemetry_deployment'
    | 'telemetry_device'
    | 'measurement'
    | 'codeset';
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
    INSERT INTO search_string
    (
        submission_feature_id,
        feature_property_id,
        value
    )
    values
    (
        ${options.submission_feature_id},
        (select feature_property_id from feature_property where name = 'name'),
        $$${faker.lorem.words(3)}$$
    );
`;

const insertSearchNumber = (options: { submission_feature_id: number }) => `
    INSERT INTO search_number
    (
        submission_feature_id,
        feature_property_id,
        value
    )
    values
    (
        ${options.submission_feature_id},
        (select feature_property_id from feature_property where name = 'count'),
        $$${faker.number.int({ min: 0, max: 100 })}$$
    );
`;

const insertSearchStringTaxonomy = (options: { submission_feature_id: number; taxon_id?: number }) => `
  INSERT INTO search_string
  (
    submission_feature_id,
    feature_property_id,
    value
  )
  values
  (
    ${options.submission_feature_id},
    (select feature_property_id from feature_property where name = 'taxon_id'),
    $$${options.taxon_id ?? faker.number.int({ min: 10000, max: 99999 })}$$
  );
`;

const insertSearchStartDatetime = (options: { submission_feature_id: number }) => `
    INSERT INTO search_datetime
    (
        submission_feature_id,
        feature_property_id,
        value
    )
    values
    (
        ${options.submission_feature_id},
        (select feature_property_id from feature_property where name = 'start_date'),
        $$${faker.date.past().toISOString()}$$
    );
`;

const insertSearchEndDatetime = (options: { submission_feature_id: number }) => `
    INSERT INTO search_datetime
    (
        submission_feature_id,
        feature_property_id,
        value
    )
    values
    (
        ${options.submission_feature_id},
        (select feature_property_id from feature_property where name = 'end_date'),
        $$${faker.date.future().toISOString()}$$
    );
`;

const insertSpatialPolygon = (options: { submission_feature_id: number }) =>
  `
    INSERT INTO search_spatial
    (
        submission_feature_id,
        feature_property_id,
        value
    )
    values
    (
        ${options.submission_feature_id},
        (select feature_property_id from feature_property where name = 'geometry'),
        public.ST_GeomFromGeoJSON(
            '${JSON.stringify(
              random.polygon(
                1, // number of features in feature collection
                randomIntFromInterval(4, 30), // number of coordinates
                1, // degrees freedom
                [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
              )['features'][0]['geometry']
            )}'
        )
    );
`;

const insertSpatialPoint = (options: { submission_feature_id: number }) =>
  `
    INSERT INTO search_spatial
    (
        submission_feature_id,
        feature_property_id,
        value
    )
    values
    (
        ${options.submission_feature_id},
        (select feature_property_id from feature_property where name = 'geometry'),
        public.ST_GeomFromGeoJSON(
            '${JSON.stringify(
              random.point(
                1, // number of features in feature collection
                [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
              )['features'][0]['geometry']
            )}'
        )
    );
`;

const randomIntFromInterval = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

/**
 * Ensure the taxonomy table has a set of mock taxon records (itis_tsn + scientific name).
 */
const ensureTaxonomySeed = async (knex: Knex) => {
  const desiredCount = 5;

  const countRes = await knex.raw(`SELECT count(*)::int as c FROM taxon`);
  const existing = countRes.rows?.[0]?.c || 0;

  if (existing >= desiredCount) {
    return;
  }

  const toCreate = desiredCount - existing;
  const tsnSet = new Set<number>();
  while (tsnSet.size < toCreate) {
    tsnSet.add(faker.number.int({ min: 10000, max: 99999 }));
  }

  const valuesSql = Array.from(tsnSet)
    .map((tsn) => {
      const sci = faker.lorem.word().replace(/'/g, "''");
      const common = faker.animal.type().replace(/'/g, "''");
      const itisData = JSON.stringify({ source: 'mock' }).replace(/'/g, "''");
      return `(${tsn}, $$${sci}$$, $$${common}$$, $$${itisData}$$::jsonb, now(), (SELECT system_user_id from "system_user" where user_identifier = 'SIMS'))`;
    })
    .join(',\n');

  const sql = `
    INSERT INTO taxon (itis_tsn, itis_scientific_name, common_name, itis_data, itis_update_date, create_user)
    VALUES
    ${valuesSql};
  `;

  await knex.raw(sql);
};

const getRandomTaxonId = async (knex: Knex): Promise<number> => {
  const res = await knex.raw(`SELECT itis_tsn FROM taxon ORDER BY random() LIMIT 1`);
  return res.rows?.[0]?.itis_tsn ?? faker.number.int({ min: 10000, max: 99999 });
};

const getContributorCodeId = async (knex: Knex, codesetKey: string, codeKey: string): Promise<number | null> => {
  const res = await knex.raw(`
    SELECT ccc.contributor_codeset_code_id
    FROM contributor_codeset_code ccc
    JOIN contributor_codeset cc ON ccc.contributor_codeset_id = cc.contributor_codeset_id
    WHERE cc.key = '${codesetKey}' AND ccc.key = '${codeKey}' AND cc.record_end_date IS NULL AND ccc.record_end_date IS NULL
    LIMIT 1
  `);
  return res.rows?.[0]?.contributor_codeset_code_id ?? null;
};

export const insertSubmissionFeatureSecurity = async (
  knex: Knex,
  options: { submission_feature_id: number; security_rule_id: number }
): Promise<number> => {
  const res = await knex.raw(`
    INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
    VALUES (
      ${options.submission_feature_id},
      ${options.security_rule_id},
      (SELECT system_user_id from "system_user" where user_identifier = 'SIMS')
    )
    RETURNING submission_feature_security_id;
  `);

  return res.rows[0].submission_feature_security_id;
};

export const insertTelemetryDeployment = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string; parent_submission_feature_id: number }
): Promise<number> => {
  const deploymentData = {
    animal_identifier: faker.string.alphanumeric({ length: 10 }),
    device_key: faker.string.alphanumeric({ length: 8 }),
    start_date: faker.date.past().toISOString(),
    end_date: faker.date.future().toISOString()
  };

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'telemetry_deployment',
      data: deploymentData
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  return submission_feature_id;
};

export const insertTelemetryDevice = async (
  knex: Knex,
  options: {
    submission_id: number;
    submission_upload_id: string;
    parent_submission_feature_id: number;
    device_id?: string;
  }
): Promise<{ submission_feature_id: number; device_id: string }> => {
  const device_id = options.device_id || faker.string.alphanumeric({ length: 8 });
  const deviceData = {
    device_id,
    device_manufacturer: faker.company.name(),
    device_model: faker.commerce.productName(),
    description: faker.lorem.sentence(),
    serial_number: faker.string.alphanumeric({ length: 12 })
  };

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'telemetry_device',
      data: deviceData
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);

  return { submission_feature_id, device_id };
};

export const insertTelemetryRecord = async (
  knex: Knex,
  options: {
    submission_id: number;
    submission_upload_id: string;
    parent_submission_feature_id: number;
    device_id?: string;
  }
): Promise<number> => {
  const device_id = options.device_id || faker.string.alphanumeric({ length: 8 });
  const telemetryData = {
    device_id,
    latitude: faker.number.float({ min: 48.617424, max: 60.664785, multipleOf: 0.000001 }),
    longitude: faker.number.float({ min: -135.878906, max: -114.433594, multipleOf: 0.000001 }),
    timestamp: faker.date.between({ from: '2020-01-01T00:00:00.000Z', to: new Date().toISOString() }).toISOString(),
    temperature: faker.number.float({ min: -20, max: 50, multipleOf: 0.1 }),
    humidity: faker.number.float({ min: 0, max: 100, multipleOf: 0.1 }),
    dop: faker.number.float({ min: 1, max: 20, multipleOf: 0.1 }),
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
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`); // e.g., dop

  // Spatial search index
  await knex.raw(
    `${insertSpatialPoint({
      submission_feature_id
    })}`
  );

  // randomly secure some telemetry points
  if (Math.random() < 0.1) {
    const ruleRes = await knex.raw(`SELECT security_rule_id FROM security_rule ORDER BY random() LIMIT 1`);
    if (ruleRes.rows.length) {
      await insertSubmissionFeatureSecurity(knex, {
        submission_feature_id,
        security_rule_id: ruleRes.rows[0].security_rule_id
      });
    }
  }

  return submission_feature_id;
};
