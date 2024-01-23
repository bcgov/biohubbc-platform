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

  await knex.raw(`
    SET SCHEMA 'biohub';
    SET SEARCH_PATH = 'biohub','public';
  `);

  for (let i = 0; i < NUM_MOCK_FEATURE_SUBMISSIONS; i++) {
    await insertRecord(knex);
  }
}

/**
 * Insert a single submission record, a single dataset record, and 50 observation records.
 *
 * @param {Knex} knex
 */
const insertRecord = async (knex: Knex) => {
  // Submission (1)
  const isReviewed = Math.random() > 0.5; // Mark half of submissions as reviewed
  const isPublished = isReviewed && Math.random() > 0.5; // Mark half of reviewed submissions as published
  const submission_id = await insertSubmissionRecord(knex, isReviewed, isPublished);

  // Dataset (1)
  const parent_submission_feature_id1 = await insertDatasetRecord(knex, { submission_id });

  // Sample Sites (10)
  for (let i = 0; i < 10; i++) {
    const parent_submission_feature_id2 = await insertSampleSiteRecord(knex, {
      submission_id,
      parent_submission_feature_id: parent_submission_feature_id1
    });

    // Animals (2 per sample site)
    for (let i = 0; i < 2; i++) {
      await insertAnimalRecord(knex, { submission_id, parent_submission_feature_id: parent_submission_feature_id2 });
    }

    // Observations (20 per sample site)
    for (let i = 0; i < 20; i++) {
      await insertObservationRecord(knex, {
        submission_id,
        parent_submission_feature_id: parent_submission_feature_id2
      });
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

export const insertDatasetRecord = async (knex: Knex, options: { submission_id: number }): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      parent_submission_feature_id: null,
      feature_type: 'dataset',
      data: {
        name: `Survey ${faker.animal.type()} ${faker.commerce.department()}}`,
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

export const insertSampleSiteRecord = async (
  knex: Knex,
  options: { submission_id: number; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
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
  options: { submission_id: number; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'observation',
      data: {
        taxonomy: faker.number.int({ min: 10000, max: 99999 }),
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
  options: { submission_id: number; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'animal',
      data: {
        species: faker.animal.type(),
        count: faker.number.int({ min: 0, max: 100 }),
        taxonomy: faker.number.int({ min: 10000, max: 99999 }),
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
      (SELECT system_user_id from system_user where user_identifier = 'SIMS'),
      'SIMS'
  )
  RETURNING submission_id;
`;
};

export const insertSubmissionFeature = (options: {
  submission_id: number;
  parent_submission_feature_id: number | null;
  feature_type: 'dataset' | 'sample_site' | 'observation' | 'animal' | 'artifact';
  data: { [key: string]: any };
}) => `
    INSERT INTO submission_feature
    (
        submission_id,
        parent_submission_feature_id,
        feature_type_id,
        source_id,
        data,
        record_effective_date
    )
    values
    (
        ${options.submission_id},
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

const insertSearchStringTaxonomy = (options: { submission_feature_id: number }) => `
    INSERT INTO search_string
    (
        submission_feature_id,
        feature_property_id,
        value
    )
    values
    (
        ${options.submission_feature_id},
        (select feature_property_id from feature_property where name = 'taxonomy'),
        $$${faker.number.int({ min: 10000, max: 99999 })}$$
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
