import { faker } from '@faker-js/faker';
// @ts-ignore ignore error over missing geojson-random declaration (.d.ts) file
import random from 'geojson-random';
import { Knex } from 'knex';

// Disable mock data seeding by default, unless manually enabled
const ENABLED = false;

/**
 * Sample query for performance testing.
 *
 * -- Select feature_submissions on multiple conditions (AND)
 * select * from submission_feature
 *   where feature_type_id = 1 and submission_feature_id in (
 *     select distinct t1.submission_feature_id
 *     FROM search_string t1
 *     WHERE EXISTS (
 *       select 1 from search_string t3 where t3.submission_feature_id = t1.submission_feature_id and t3.value like '%cor%'
 *     ) and exists (
 *       select 1 from search_string t4 where t4.submission_feature_id = t1.submission_feature_id and t4.value like '%arx%'
 *     ) and exists (
 *       select 1 from search_number t5 where t5.submission_feature_id = t1.submission_feature_id and t5.value > 40 and t5.value < 50
 *     ) and exists (
 *       select 1 from search_taxonomy t6 where t6.submission_feature_id = t1.submission_feature_id and t6.value > 50000 and t6.value < 50100
 *     ) and exists (
 *       select 1 from search_datetime t7 where t7.submission_feature_id = t1.submission_feature_id and t7.value > '2023-08-01' and t7.value < '2024-04-01' and t7.feature_property_id = (select feature_property_id from feature_property where name = 'start_date')
 *     ) and exists (
 *       select 1 from search_datetime t7 where t7.submission_feature_id = t1.submission_feature_id and t7.value > '2023-08-01' and t7.value < '2024-04-01' and t7.feature_property_id = (select feature_property_id from feature_property where name = 'end_date')
 *     ) and exists (
 *       select 1 from search_spatial t8 where t8.submission_feature_id = t1.submission_feature_id and public.ST_INTERSECTS(t8.value, public.ST_GeomFromGeoJSON('{"coordinates":[[[-128.12596524778567,50.90095573861839],[-128.6951954392062,50.75063500834236],[-127.71373499792975,49.63640480052965],[-125.38308025753057,48.53083459202276],[-123.3647465830768,48.15806226354249],[-122.94623399379441,48.36504151433127],[-123.37439502763095,49.13209156231335],[-124.66835857611437,49.81654191782255],[-126.6572708981094,50.607171392416745],[-127.89342678974776,50.9888374217299],[-128.12596524778567,50.90095573861839]]],"type":"Polygon"}'))
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
  if (!ENABLED) {
    return knex.raw(`SELECT null;`); // dummy query to appease knex
  }

  await knex.raw(`
    SET SCHEMA 'biohub';
    SET SEARCH_PATH = 'biohub','public';
  `);

  const numSubmissions = 10000; // Number of submissions (ie: surveys)

  for (let i = 0; i < numSubmissions; i++) {
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
  const submission_id = await insertSubmissionRecord(knex);

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

const insertSubmissionRecord = async (knex: Knex): Promise<number> => {
  const response = await knex.raw(`${insertSubmission()}`);
  const submission_id = response.rows[0].submission_id;

  return submission_id;
};

const insertDatasetRecord = async (knex: Knex, options: { submission_id: number }): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      parent_submission_feature_id: null,
      feature_type: 'dataset'
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

  await knex.raw(`${insertSearchTaxonomy({ submission_feature_id })}`);
  await knex.raw(`${insertSearchTaxonomy({ submission_feature_id })}`);
  await knex.raw(`${insertSearchTaxonomy({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPolygon({ submission_feature_id })}`);

  return submission_feature_id;
};

const insertSampleSiteRecord = async (
  knex: Knex,
  options: { submission_id: number; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'sample_site'
    })}`
  );
  const submission_feature_id = response.rows[0].submission_feature_id;

  await knex.raw(`${insertSearchString({ submission_feature_id })}`);
  await knex.raw(`${insertSearchString({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPolygon({ submission_feature_id })}`);

  return submission_feature_id;
};

const insertObservationRecord = async (
  knex: Knex,
  options: { submission_id: number; parent_submission_feature_id: number }
): Promise<number> => {
  const response = await knex.raw(
    `${insertSubmissionFeature({
      submission_id: options.submission_id,
      parent_submission_feature_id: options.parent_submission_feature_id,
      feature_type: 'observation'
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

  await knex.raw(`${insertSearchTaxonomy({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

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
      feature_type: 'animal'
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

  await knex.raw(`${insertSearchTaxonomy({ submission_feature_id })}`);

  await knex.raw(`${insertSearchStartDatetime({ submission_feature_id })}`);
  await knex.raw(`${insertSearchEndDatetime({ submission_feature_id })}`);

  await knex.raw(`${insertSpatialPoint({ submission_feature_id })}`);

  return submission_feature_id;
};

const insertSubmission = () => `
    INSERT INTO submission
    (
        source_transform_id,
        uuid
    )
    values
    (
        1,
        public.gen_random_uuid()
    )
    RETURNING submission_id;
`;

const insertSubmissionFeature = (options: {
  submission_id: number;
  parent_submission_feature_id: number | null;
  feature_type: 'dataset' | 'sample_site' | 'observation' | 'animal';
}) => `
    INSERT INTO submission_feature
    (
        submission_id,
        parent_submission_feature_id,
        feature_type_id,
        data,
        record_effective_date
    )
    values
    (
        ${options.submission_id},
        ${options.parent_submission_feature_id},
        (select feature_type_id from feature_type where name = '${options.feature_type}'),
        '{
          "name": "${faker.lorem.words(3)}"
        }',
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

const insertSearchTaxonomy = (options: { submission_feature_id: number }) => `
    INSERT INTO search_taxonomy
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