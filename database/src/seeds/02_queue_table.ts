import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;

export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    set schema '${DB_SCHEMA}';
    set search_path = ${DB_SCHEMA};
  `);

  for (let i = 0; i < 100; i++) {
    await knex.raw(`${insert()}`);
  }
}

const insert = () => `
    with sub as (
        insert into submission (
            source_transform_id, 
            uuid
        )
        values (
            1, 
            public.gen_random_uuid()
        )
        returning submission_id
    )
    insert into submission_job_queue (
        submission_job_queue_id, submission_id
    )
    values (
        (select nextval('submission_job_queue_seq')),
        (select submission_id from sub)
    );
`;
