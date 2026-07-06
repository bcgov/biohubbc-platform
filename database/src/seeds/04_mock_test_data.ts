import { faker } from '@faker-js/faker';
// @ts-ignore ignore error over missing geojson-random declaration (.d.ts) file
import random from 'geojson-random';
import { Knex } from 'knex';

// Disable mock data seeding by default. Set `ENABLE_MOCK_FEATURE_DATA=true` to enable.
const ENABLE_MOCK_FEATURE_SEEDING = Boolean(process.env.ENABLE_MOCK_FEATURE_SEEDING === 'true' || false);
const NUM_MOCK_FEATURE_SUBMISSIONS = Number(process.env.NUM_MOCK_FEATURE_SUBMISSIONS || 0);
const CONTRIBUTOR_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
let activeTaxonTsnsPromise: Promise<number[]> | null = null;

/**
 * Expression search query shape for performance testing.
 *
 * -- Select feature_submissions on multiple conditions (AND)
 * SELECT * FROM submission_feature WHERE submission_feature_id IN (
 *     SELECT DISTINCT t1.submission_feature_id FROM submission_feature t1
 *     WHERE EXISTS (
 *         SELECT 1 FROM submission_feature_property_string t3 WHERE t3.submission_feature_id = t1.submission_feature_id AND t3.value ILIKE '%cor%'
 *     ) AND EXISTS (
 *         SELECT 1 FROM submission_feature_property_string t4 WHERE t4.submission_feature_id = t1.submission_feature_id AND t4.value ILIKE '%arx%'
 *     ) AND EXISTS (
 *         SELECT 1 FROM submission_feature_property_number t5 WHERE t5.submission_feature_id = t1.submission_feature_id AND t5.value > 40 AND t5.value < 50
 *     ) AND EXISTS (
 *         SELECT 1 FROM submission_feature_property_timestamp t7 WHERE t7.submission_feature_id = t1.submission_feature_id AND t7.date_value > '2023-08-01'
 *     ) AND EXISTS (
 *         SELECT 1 FROM submission_feature_property_geometry t9 WHERE t9.submission_feature_id = t1.submission_feature_id AND public.ST_INTERSECTS(t9.value, public.ST_GeomFromGeoJSON('{"coordinates":[[[-128.12596524778567,50.90095573861839],[-128.6951954392062,50.75063500834236],[-127.71373499792975,49.63640480052965],[-125.38308025753057,48.53083459202276],[-123.3647465830768,48.15806226354249],[-122.94623399379441,48.36504151433127],[-123.37439502763095,49.13209156231335],[-124.66835857611437,49.81654191782255],[-126.6572708981094,50.607171392416745],[-127.89342678974776,50.9888374217299],[-128.12596524778567,50.90095573861839]]],"type":"Polygon"}'))
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
  const ecologicalUnitIds: number[] = [];
  const sampleSiteObservations: { sampleSiteId: number; observationIds: number[] }[] = [];
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
        parent_submission_feature_id: parent_submission_feature_id1
      })
    );

    // Observations - some additional species_observation rows will share a contributor observation_id.
    const observationPromises = Array.from({ length: 20 }).map(() =>
      insertObservationRecord(knex, {
        submission_id,
        submission_upload_id,
        parent_submission_feature_id: parent_submission_feature_id2
      })
    );

    // Wait for all animals and observations for this sample site
    const animalResults = await Promise.all(animalPromises);
    const observationResults = await Promise.all(observationPromises);

    // For some observations, create grouped species_observation rows with subcount fields.
    for (let i = 0; i < observationResults.length; i++) {
      // ~40% of observations get grouped subcount-style records.
      if (Math.random() < 0.4) {
        const numSubcounts = faker.number.int({ min: 1, max: 3 });
        const groupedObservationId = faker.string.uuid();

        for (let j = 0; j < numSubcounts; j++) {
          await insertSubcountRecord(knex, {
            submission_id,
            submission_upload_id,
            parent_submission_feature_id: parent_submission_feature_id2,
            observation_id: groupedObservationId
          });
        }
      }
    }

    // Collect animal IDs
    animalIds.push(...animalResults);

    // Store sample site and its observation IDs for linking
    sampleSiteObservations.push({
      sampleSiteId: parent_submission_feature_id2,
      observationIds: observationResults
    });
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

  // Create some incidental observations with no parent feature.
  const incidentalObservationPromises = Array.from({ length: 10 }).map(() =>
    insertObservationRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: null
    })
  );

  const ecologicalUnits = [
    { type: 'population_unit', value: 'telkwa' },
    { type: 'population_unit', value: 'tweedsmuir' },
    { type: 'population_unit', value: 'calendar' },
    { type: 'population_unit', value: 'maxhamish' },
    { type: 'population_unit', value: 'rainbows' },
    { type: 'population_unit', value: 'muskwa' },
    { type: 'population_unit', value: 'gataga' },
    { type: 'management_unit', value: 'region-7a' },
    { type: 'management_unit', value: 'region-7b' }
  ];

  // Create ecological units with no parent feature.
  const ecologicalUnitPromises = ecologicalUnits.map((ecologicalUnit) =>
    insertEcologicalUnitRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: null,
      type: ecologicalUnit.type,
      value: ecologicalUnit.value
    })
  );

  // Wait for all sample sites, incidental observations, ecological units, and telemetry to complete concurrently
  const ecologicalUnitResults = await Promise.all(ecologicalUnitPromises);
  ecologicalUnitIds.push(...ecologicalUnitResults);

  const incidentalObservationIds = await Promise.all(incidentalObservationPromises);
  await Promise.all([...sampleSitePromises, ...telemetryPromises]);

  // For some incidental observations, create grouped species_observation rows with subcount fields.
  for (let i = 0; i < incidentalObservationIds.length; i++) {
    // ~40% of incidental observations get grouped subcount-style records.
    if (Math.random() < 0.4) {
      const numSubcounts = faker.number.int({ min: 1, max: 4 });
      const groupedObservationId = faker.string.uuid();

      for (let j = 0; j < numSubcounts; j++) {
        await insertSubcountRecord(knex, {
          submission_id,
          submission_upload_id,
          parent_submission_feature_id: null,
          observation_id: groupedObservationId
        });
      }
    }
  }

  // Link each observation to the dataset such that one dataset can have many observations,
  // and each observation has at most one dataset link.
  const datasetObservationIds = sampleSiteObservations
    .flatMap((entry) => entry.observationIds)
    .concat(incidentalObservationIds);
  for (const observationId of datasetObservationIds) {
    await knex.raw(`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
      VALUES (${parent_submission_feature_id1}, ${observationId})
    `);
  }

  // Seed submission_feature_feature table
  for (const deployment of deployments) {
    for (const device of deployment.devices) {
      await knex.raw(`
        INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
        VALUES (${deployment.id}, ${device.submission_feature_id})
      `);
    }
  }

  // Ensure each deployment is linked to exactly one animal
  for (let i = 0; i < deployments.length; i++) {
    const deployment = deployments[i];
    const animalId = animalIds[i % animalIds.length]; // Distribute animals across deployments
    await knex.raw(`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
      VALUES (${animalId}, ${deployment.id})
    `);

    // Update deployment's animal_identifier to match the linked animal's identifier
    await knex.raw(`
      UPDATE submission_feature
      SET data = jsonb_set(data, '{animal_identifier}', (SELECT data->'animal_identifier' FROM submission_feature WHERE submission_feature_id = ${animalId}))
      WHERE submission_feature_id = ${deployment.id}
    `);
  }

  // Note: Extra animals beyond the number of deployments are not linked to any deployment

  // Link some observations to their sample sites
  for (const { sampleSiteId, observationIds } of sampleSiteObservations) {
    const linkPercentage = Math.random() * 0.4 + 0.3;
    const numToLink = Math.max(1, Math.floor(observationIds.length * linkPercentage));
    const shuffledObservations = observationIds.sort(() => Math.random() - 0.5);

    for (let i = 0; i < numToLink; i++) {
      const observationId = shuffledObservations[i];
      await knex.raw(`
        INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
        VALUES (${sampleSiteId}, ${observationId})
      `);
    }
  }

  // Link ecological units to animals. Attach the first two to the first animal so
  // the telemetry view has deterministic multi-value eco_unit seed coverage.
  for (let i = 0; i < ecologicalUnitIds.length; i++) {
    if (animalIds.length > 0) {
      const ecologicalUnitId = ecologicalUnitIds[i];
      const animalId = i < 2 ? animalIds[0] : animalIds[Math.floor(Math.random() * animalIds.length)];

      await knex.raw(`
        INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
        VALUES (${ecologicalUnitId}, ${animalId})
      `);
    }
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
  const name = `Survey ${faker.animal.type()} ${faker.commerce.department()}`;
  const description = faker.lorem.sentence({ min: 5, max: 15 });

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: null,
      feature_type: 'dataset',
      data: {
        name,
        description,
        start_date: faker.date.past().toISOString(),
        end_date: faker.date.future().toISOString(),
        // Full FeatureCollection matches the ingest contract (see
        // `feature-validation-service.ts:266` — `spatial` is `GeoJSONFeatureCollectionZodSchema`).
        geometry: random.point(
          1, // number of features in feature collection
          [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
        )
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id, property_name: 'name', value: name })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id, property_name: 'description', value: description })}`);

  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);

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
  const name = `Sample Site ${faker.lorem.words(3)}`;
  const description = faker.lorem.words({ min: 5, max: 100 });

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'sample_site',
      data: {
        name,
        description,
        // Full FeatureCollection matches the ingest contract.
        geometry: random.point(
          1, // number of features in feature collection
          [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
        )
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id, property_name: 'name', value: name })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id, property_name: 'description', value: description })}`);

  await knex.raw(`${insertSpatialPolygon({ submission_feature_id })}`);

  return submission_feature_id;
};

export const insertObservationRecord = async (
  knex: Knex,
  options: {
    submission_id: number;
    submission_upload_id: string;
    parent_submission_feature_id: number | null;
    observation_id?: string | number | null;
  }
): Promise<number> => {
  const taxonTsn = await getRandomActiveTaxonTsn(knex);
  const observationId = options.observation_id ?? faker.string.uuid();

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'species_observation',
      data: {
        observation_id: observationId,
        taxon_id: taxonTsn,
        // Full FeatureCollection matches the ingest contract.
        geometry: random.point(
          1, // number of features in feature collection
          [-135.878906, 48.617424, -114.433594, 60.664785] // bbox constraint
        )['features'][0]['geometry'],
        count: faker.number.int({ min: 1, max: 100 }),
        timestamp: faker.date.between({ from: '2020-01-01T00:00:00.000Z', to: new Date().toISOString() }).toISOString(),
        sign: faker.helpers.arrayElement(['tracks', 'scat', 'sighting', 'other']),
        life_stage: faker.number.int({ min: 1, max: 6 }),
        sex: faker.number.int({ min: 7, max: 9 })
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);

  if (taxonTsn) {
    await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id, taxonTsn })}`);
  }

  //   await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  //   await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPoint({ submission_feature_id })}`);

  // randomly secure some observation points
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

export const insertSubcountRecord = async (
  knex: Knex,
  options: {
    submission_id: number;
    submission_upload_id: string;
    parent_submission_feature_id: number | null;
    observation_id?: string | number | null;
  }
): Promise<number> => {
  const taxonTsn = await getRandomActiveTaxonTsn(knex);
  const subcountTaxonId = taxonTsn;
  const timestamp = faker.date
    .between({ from: '2020-01-01T00:00:00.000Z', to: new Date().toISOString() })
    .toISOString();

  const sign = faker.helpers.arrayElement(['tracks', 'scat', 'sighting', 'other']);
  const subcount_comment = faker.helpers.maybe(() => faker.lorem.words(3), { probability: 0.3 }) || null;

  const subcountData: { [key: string]: any } = {
    taxon_id: subcountTaxonId,
    geometry: random.point(1, [-135.878906, 48.617424, -114.433594, 60.664785])['features'][0]['geometry'],
    subcount_count: faker.number.int({ min: 1, max: 20 }),
    subcount_comment,
    timestamp,
    sign,
    life_stage: faker.number.int({ min: 1, max: 6 }),
    sex: faker.number.int({ min: 7, max: 9 })
  };

  if (typeof options.observation_id === 'number' || typeof options.observation_id === 'string') {
    subcountData.observation_id = options.observation_id;
  }

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'species_observation',
      data: subcountData
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id, property_name: 'sign', value: sign })}`);
  if (subcount_comment) {
    await knex.raw(
      `${insertSearchString({
        submission_feature_id,
        property_name: 'subcount_comment',
        value: subcount_comment
      })}`
    );
  }
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);

  if (typeof subcountTaxonId === 'number') {
    await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id, taxonTsn: subcountTaxonId })}`);
  }
  await knex.raw(`${insertSpatialPoint({ submission_feature_id })}`);

  return submission_feature_id;
};

export const insertEcologicalUnitRecord = async (
  knex: Knex,
  options: {
    submission_id: number;
    submission_upload_id: string;
    parent_submission_feature_id: number | null;
    type: string;
    value: string;
  }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'ecological_unit',
      data: {
        ecological_unit_type: options.type,
        ecological_unit_value: options.value
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  // Add search indices for the ecological unit properties
  await knex.raw(
    `${insertSearchString({ submission_feature_id, property_name: 'ecological_unit_type', value: options.type })}`
  );
  await knex.raw(
    `${insertSearchString({
      submission_feature_id,
      property_name: 'ecological_unit_value',
      value: options.value
    })}`
  );

  return submission_feature_id;
};

const insertAnimalRecord = async (
  knex: Knex,
  options: { submission_id: number; submission_upload_id: string; parent_submission_feature_id: number }
): Promise<number> => {
  const taxonTsn = await getRandomActiveTaxonTsn(knex);
  const species = faker.animal.type();

  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      submission_upload_id: options.submission_upload_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'animal',
      data: {
        species,
        count: faker.number.int({ min: 0, max: 100 }),
        taxon_id: taxonTsn,
        animal_identifier: faker.lorem.word(),
        sex: faker.number.int({ min: 7, max: 9 }),
        start_date: faker.date.past().toISOString(),
        end_date: faker.date.future().toISOString()
      }
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id, property_name: 'species', value: species })}`);

  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);
  await knex.raw(`${insertSearchNumber({ submission_feature_id })}`);

  if (taxonTsn) {
    await knex.raw(`${insertSearchStringTaxonomy({ submission_feature_id, taxonTsn })}`);
  }

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
    | 'codeset'
    | 'ecological_unit';
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

const insertSearchString = (options: { submission_feature_id: number; property_name: string; value: string }) => `
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
        LEFT($$${options.value}$$, 250),
        1
    FROM submission_feature sf
    JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
    JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id AND fpt.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fpt.name = 'string'
      AND fp.name = '${options.property_name}'
      AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_property_string existing
          WHERE existing.submission_feature_id = sf.submission_feature_id
            AND existing.feature_type_property_id = ftp.feature_type_property_id
      )
    ORDER BY ftp.feature_type_property_id
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

const insertSearchStringTaxonomy = (options: { submission_feature_id: number; taxonTsn: number }) => `
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
    JOIN taxon t
      ON t.itis_tsn = ${options.taxonTsn}
     AND t.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${options.submission_feature_id}
      AND sf.record_end_date IS NULL
      AND fp.name = 'taxon_id'
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

/**
 * Loads active ITIS TSNs for mock feature seeding.
 *
 * Use this helper before seeding any mock typed taxon property row. The seeded
 * value must be an existing public ITIS TSN so `insertSearchStringTaxonomy` can
 * resolve it to the internal `taxon.taxon_id` and write a valid
 * `submission_feature_property_taxon` row.
 *
 * The result is cached as a promise for the lifetime of this seed module. Mock
 * animal and observation inserts run concurrently, so caching the in-flight
 * lookup prevents repeated full-table taxonomy reads during a single seed run.
 *
 * @param {Knex} knex - Knex connection or transaction used by the seed.
 * @returns {Promise<number[]>} Active `taxon.itis_tsn` values available for mock taxonomy properties.
 */
const getActiveTaxonTsns = async (knex: Knex): Promise<number[]> => {
  activeTaxonTsnsPromise ??= knex('taxon')
    .select<{ itis_tsn: number }[]>('itis_tsn')
    .whereNull('record_end_date')
    .then((taxa) => taxa.map((taxon) => taxon.itis_tsn).filter((itisTsn) => Number.isFinite(itisTsn)));

  return activeTaxonTsnsPromise;
};

/**
 * Picks one active ITIS TSN for a mock feature.
 *
 * Use this when building mock feature `data` for feature types that include a
 * taxonomy property. It delegates loading and caching to `getActiveTaxonTsns`,
 * then chooses a random TSN in memory. This avoids database-side
 * `ORDER BY random()` work for every seeded feature while still distributing
 * mock records across available active taxa. If no active taxa are available,
 * return undefined so mock feature seeding can continue without taxonomy rows.
 *
 * @param {Knex} knex - Knex connection or transaction used by the seed.
 * @returns {Promise<number | undefined>} Random active `taxon.itis_tsn` value, or undefined when taxonomy is unavailable.
 */
const getRandomActiveTaxonTsn = async (knex: Knex): Promise<number | undefined> => {
  const activeTaxonTsns = await getActiveTaxonTsns(knex);

  if (activeTaxonTsns.length === 0) {
    return undefined;
  }

  return activeTaxonTsns[randomIntFromInterval(0, activeTaxonTsns.length - 1)];
};

/**
 * Seeding the taxonomy table with taxon records
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

  await knex.raw(
    `${insertSearchString({
      submission_feature_id,
      property_name: '',
      value: ''
    })}`
  );
  await knex.raw(
    `${insertSearchString({
      submission_feature_id,
      property_name: '',
      value: ''
    })}`
  );

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

  await knex.raw(
    `${insertSearchString({
      submission_feature_id,
      property_name: '',
      value: ''
    })}`
  );
  await knex.raw(
    `${insertSearchString({
      submission_feature_id,
      property_name: '',
      value: ''
    })}`
  );
  await knex.raw(
    `${insertSearchString({
      submission_feature_id,
      property_name: '',
      value: ''
    })}`
  );

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
  // Match the `feature_type_property` schema for telemetry (dop, elevation,
  // timestamp, geometry). Property names MUST align with the declarations in
  // `20251001000000_insert_feature_types.ts`. Full FeatureCollection matches
  // the ingest contract.
  const telemetryData = {
    device_id,
    latitude: faker.number.float({ min: 48.617424, max: 60.664785, multipleOf: 0.000001 }),
    longitude: faker.number.float({ min: -135.878906, max: -114.433594, multipleOf: 0.000001 }),
    elevation: faker.number.float({ min: -20, max: 3000, multipleOf: 0.1 }),
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

  // The download pipeline hydrates typed properties from the
  // `submission_feature_property_*` tables (not from the JSONB `data` column —
  // see `DownloadPipelineService.hydrateFeatureBatch`). Keep both in sync so
  // the exported Parquet/CSV contains the same values a consumer would see in
  // search. Generic helpers above (`insertSearchString`/`insertSearchNumber`)
  // are hardcoded to `name`/`count` property names, so we use inline SQL here
  // to target telemetry's specific property names.
  await knex.raw(
    `INSERT INTO submission_feature_property_number (submission_feature_id, feature_type_property_id, value, create_user)
     SELECT sf.submission_feature_id, ftp.feature_type_property_id, ?, 1
     FROM submission_feature sf
     JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
     JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
     WHERE sf.submission_feature_id = ? AND sf.record_end_date IS NULL AND fp.name = 'dop';`,
    [telemetryData.dop, submission_feature_id]
  );

  await knex.raw(
    `INSERT INTO submission_feature_property_number (submission_feature_id, feature_type_property_id, value, create_user)
     SELECT sf.submission_feature_id, ftp.feature_type_property_id, ?, 1
     FROM submission_feature sf
     JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
     JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
     WHERE sf.submission_feature_id = ? AND sf.record_end_date IS NULL AND fp.name = 'elevation';`,
    [telemetryData.elevation, submission_feature_id]
  );

  await knex.raw(
    `INSERT INTO submission_feature_property_timestamp (submission_feature_id, feature_type_property_id, date_value, time_value, create_user)
     SELECT sf.submission_feature_id, ftp.feature_type_property_id, ?::timestamptz::date, ?::timestamptz::time, 1
     FROM submission_feature sf
     JOIN feature_type_property ftp ON ftp.feature_type_id = sf.feature_type_id AND ftp.record_end_date IS NULL
     JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id AND fp.record_end_date IS NULL
     WHERE sf.submission_feature_id = ? AND sf.record_end_date IS NULL AND fp.name = 'timestamp';`,
    [telemetryData.timestamp, telemetryData.timestamp, submission_feature_id]
  );

  await knex.raw(
    `${insertSpatialPoint({
      submission_feature_id
    })}`
  );

  return submission_feature_id;
};
