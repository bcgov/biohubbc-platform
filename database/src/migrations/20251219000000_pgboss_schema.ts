import { Knex } from 'knex';

/**
 * Migration to create pgboss schema for the job queue system.
 *
 * This migration creates all pg-boss infrastructure as the postgres admin user,
 * then transfers ownership to biohub_api. This avoids granting CREATE ON DATABASE
 * to the application user, following the principle of least privilege.
 *
 * The SQL is generated from PgBoss.getConstructionPlans('pgboss') - pg-boss v11 (schema version 26).
 * When upgrading pg-boss, regenerate this SQL with:
 *   node -e "const PgBoss = require('pg-boss'); console.log(PgBoss.getConstructionPlans('pgboss'));"
 *
 * See: https://timgit.github.io/pg-boss/#/install
 */

export async function up(knex: Knex): Promise<void> {
  // Create pgboss schema and all infrastructure
  // Generated from: PgBoss.getConstructionPlans('pgboss') - v11
  await knex.raw(`
    CREATE SCHEMA IF NOT EXISTS pgboss;

    CREATE TYPE pgboss.job_state AS ENUM (
      'created',
      'retry',
      'active',
      'completed',
      'cancelled',
      'failed'
    );

    CREATE TABLE pgboss.version (
      version int primary key,
      cron_on timestamp with time zone
    );

    CREATE TABLE pgboss.queue (
      name text NOT NULL,
      policy text NOT NULL,
      retry_limit int NOT NULL,
      retry_delay int NOT NULL,
      retry_backoff bool NOT NULL,
      retry_delay_max int,
      expire_seconds int NOT NULL,
      retention_seconds int NOT NULL,
      deletion_seconds int NOT NULL,
      dead_letter text REFERENCES pgboss.queue (name) CHECK (dead_letter IS DISTINCT FROM name),
      partition bool NOT NULL,
      table_name text NOT NULL,
      deferred_count int NOT NULL default 0,
      queued_count int NOT NULL default 0,
      warning_queued int NOT NULL default 0,
      active_count int NOT NULL default 0,
      total_count int NOT NULL default 0,
      singletons_active text[],
      monitor_on timestamp with time zone,
      maintain_on timestamp with time zone,
      created_on timestamp with time zone not null default now(),
      updated_on timestamp with time zone not null default now(),
      PRIMARY KEY (name)
    );

    CREATE TABLE pgboss.schedule (
      name text REFERENCES pgboss.queue ON DELETE CASCADE,
      key text not null DEFAULT '',
      cron text not null,
      timezone text,
      data jsonb,
      options jsonb,
      created_on timestamp with time zone not null default now(),
      updated_on timestamp with time zone not null default now(),
      PRIMARY KEY (name, key)
    );

    CREATE TABLE pgboss.subscription (
      event text not null,
      name text not null REFERENCES pgboss.queue ON DELETE CASCADE,
      created_on timestamp with time zone not null default now(),
      updated_on timestamp with time zone not null default now(),
      PRIMARY KEY(event, name)
    );

    CREATE TABLE pgboss.job (
      id uuid not null default gen_random_uuid(),
      name text not null,
      priority integer not null default(0),
      data jsonb,
      state pgboss.job_state not null default 'created',
      retry_limit integer not null default 2,
      retry_count integer not null default 0,
      retry_delay integer not null default 0,
      retry_backoff boolean not null default false,
      retry_delay_max integer,
      expire_seconds int not null default 900,
      deletion_seconds int not null default 604800,
      singleton_key text,
      singleton_on timestamp without time zone,
      start_after timestamp with time zone not null default now(),
      created_on timestamp with time zone not null default now(),
      started_on timestamp with time zone,
      completed_on timestamp with time zone,
      keep_until timestamp with time zone NOT NULL default now() + interval '1209600',
      output jsonb,
      dead_letter text,
      policy text
    ) PARTITION BY LIST (name);

    ALTER TABLE pgboss.job ADD PRIMARY KEY (name, id);

    CREATE TABLE pgboss.job_common (LIKE pgboss.job INCLUDING GENERATED INCLUDING DEFAULTS);
    ALTER TABLE pgboss.job_common ADD PRIMARY KEY (name, id);
    ALTER TABLE pgboss.job_common ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
    ALTER TABLE pgboss.job_common ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
    CREATE UNIQUE INDEX job_i1 ON pgboss.job_common (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short';
    CREATE UNIQUE INDEX job_i2 ON pgboss.job_common (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton';
    CREATE UNIQUE INDEX job_i3 ON pgboss.job_common (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately';
    CREATE UNIQUE INDEX job_i6 ON pgboss.job_common (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive';
    CREATE UNIQUE INDEX job_i4 ON pgboss.job_common (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL;
    CREATE INDEX job_i5 ON pgboss.job_common (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active';

    ALTER TABLE pgboss.job ATTACH PARTITION pgboss.job_common DEFAULT;

    CREATE FUNCTION pgboss.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO pgboss.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE pgboss.%I (LIKE pgboss.job INCLUDING DEFAULTS)', tablename);

      EXECUTE format('ALTER TABLE pgboss.%1$I ADD PRIMARY KEY (name, id)', tablename);
      EXECUTE format('ALTER TABLE pgboss.%1$I ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED', tablename);
      EXECUTE format('ALTER TABLE pgboss.%1$I ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED', tablename);

      EXECUTE format('CREATE INDEX %1$s_i5 ON pgboss.%1$I (name, start_after) INCLUDE (priority, created_on, id) WHERE state < ''active''', tablename);
      EXECUTE format('CREATE UNIQUE INDEX %1$s_i4 ON pgboss.%1$I (name, singleton_on, COALESCE(singleton_key, '''')) WHERE state <> ''cancelled'' AND singleton_on IS NOT NULL', tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i1 ON pgboss.%1$I (name, COALESCE(singleton_key, '''')) WHERE state = ''created'' AND policy = ''short''', tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i2 ON pgboss.%1$I (name, COALESCE(singleton_key, '''')) WHERE state = ''active'' AND policy = ''singleton''', tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i3 ON pgboss.%1$I (name, state, COALESCE(singleton_key, '''')) WHERE state <= ''active'' AND policy = ''stately''', tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i6 ON pgboss.%1$I (name, COALESCE(singleton_key, '''')) WHERE state <= ''active'' AND policy = ''exclusive''', tablename);
      END IF;

      EXECUTE format('ALTER TABLE pgboss.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE pgboss.job ATTACH PARTITION pgboss.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;

    CREATE FUNCTION pgboss.delete_queue(queue_name text)
    RETURNS VOID AS
    $$
    DECLARE
      v_table varchar;
      v_partition bool;
    BEGIN
      SELECT table_name, partition
      FROM pgboss.queue
      WHERE name = queue_name
      INTO v_table, v_partition;

      IF v_partition THEN
        EXECUTE format('DROP TABLE IF EXISTS pgboss.%I', v_table);
      ELSE
        EXECUTE format('DELETE FROM pgboss.%I WHERE name = %L', v_table, queue_name);
      END IF;

      DELETE FROM pgboss.queue WHERE name = queue_name;
    END;
    $$
    LANGUAGE plpgsql;

    -- pg-boss schema version 26 (v11)
    INSERT INTO pgboss.version(version) VALUES ('26');

    -- Transfer ownership of schema and all objects to biohub_api
    ALTER SCHEMA pgboss OWNER TO biohub_api;
    ALTER TABLE pgboss.version OWNER TO biohub_api;
    ALTER TABLE pgboss.queue OWNER TO biohub_api;
    ALTER TABLE pgboss.schedule OWNER TO biohub_api;
    ALTER TABLE pgboss.subscription OWNER TO biohub_api;
    ALTER TABLE pgboss.job OWNER TO biohub_api;
    ALTER TABLE pgboss.job_common OWNER TO biohub_api;
    ALTER FUNCTION pgboss.create_queue(text, jsonb) OWNER TO biohub_api;
    ALTER FUNCTION pgboss.delete_queue(text) OWNER TO biohub_api;
    ALTER TYPE pgboss.job_state OWNER TO biohub_api;

    -- Grant full privileges
    GRANT ALL ON SCHEMA pgboss TO biohub_api;
    GRANT ALL ON ALL TABLES IN SCHEMA pgboss TO biohub_api;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA pgboss TO biohub_api;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA pgboss TO biohub_api;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP SCHEMA IF EXISTS pgboss CASCADE;
  `);
}
