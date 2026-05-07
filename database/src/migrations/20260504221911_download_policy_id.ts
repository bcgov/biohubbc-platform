import { Knex } from 'knex';

/**
 * Replaces cart_id/filters source fields on the download table with a single
 * policy_id reference. Each download is now backed by a frozen policy (one
 * statement per feature type, optional expression link), evaluated at export
 * time. The download_expression join table was a transitional surface and is
 * dropped here.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Drop the download_expression join table.
    --
    -- This table was added with the property-conditions stack and never wired
    -- into a release write path; it is being replaced by the policy-driven
    -- download flow (download.policy_id -> policy_statement ->
    -- policy_statement_expression).
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_download_expression ON download_expression;
    DROP TRIGGER IF EXISTS audit_download_expression ON download_expression;
    DROP TABLE IF EXISTS download_expression;

    --------------------------------------------------------------------------------
    -- Drop the legacy download source columns + supporting constraints.
    --
    -- cart_id and filters are superseded by policy_id. The
    -- download_feature_source_check CHECK and download_cart_fk go with them.
    --------------------------------------------------------------------------------
    ALTER TABLE download
      DROP CONSTRAINT IF EXISTS download_feature_source_check,
      DROP CONSTRAINT IF EXISTS download_cart_fk,
      DROP COLUMN IF EXISTS cart_id,
      DROP COLUMN IF EXISTS filters;
    -- (download_cart_idx is auto-dropped with cart_id.)

    --------------------------------------------------------------------------------
    -- Add download.policy_id.
    --
    -- Each download owns exactly one policy (UNIQUE) that defines its feature
    -- set. NOT NULL is safe because download is empty when this migration runs.
    -- Match the existing policy-FK pattern (team_policy, policy_statement,
    -- data_request) by omitting an explicit ON DELETE clause.
    --------------------------------------------------------------------------------
    ALTER TABLE download
      ADD COLUMN policy_id uuid NOT NULL,
      ADD CONSTRAINT download_policy_fk
        FOREIGN KEY (policy_id) REFERENCES policy(policy_id),
      ADD CONSTRAINT download_policy_unique UNIQUE (policy_id);

    CREATE INDEX idx_download_policy_id ON download(policy_id);

    COMMENT ON COLUMN download.policy_id IS 'Foreign key to the policy that defines the feature set this download exports.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Drop download.policy_id and its supporting index/constraints.
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS idx_download_policy_id;
    ALTER TABLE download
      DROP CONSTRAINT IF EXISTS download_policy_unique,
      DROP CONSTRAINT IF EXISTS download_policy_fk,
      DROP COLUMN IF EXISTS policy_id;

    --------------------------------------------------------------------------------
    -- Restore download.cart_id (FK to cart) + its supporting index and comment.
    --------------------------------------------------------------------------------
    ALTER TABLE download ADD COLUMN cart_id UUID;
    ALTER TABLE download ADD CONSTRAINT download_cart_fk
      FOREIGN KEY (cart_id) REFERENCES cart(cart_id);
    CREATE INDEX download_cart_idx ON download(cart_id);

    COMMENT ON COLUMN download.cart_id IS 'FK to cart table. Set for cart-based downloads, NULL for filter-based. Used to resolve features at pipeline time via cart_submission_feature.';

    --------------------------------------------------------------------------------
    -- Restore download.filters JSONB column + comment.
    --------------------------------------------------------------------------------
    ALTER TABLE download ADD COLUMN filters JSONB;

    COMMENT ON COLUMN download.filters IS 'Original search filters used to create this download. Null for cart-based downloads.';

    --------------------------------------------------------------------------------
    -- Restore the download_feature_source_check CHECK constraint.
    --------------------------------------------------------------------------------
    ALTER TABLE download ADD CONSTRAINT download_feature_source_check
      CHECK (cart_id IS NOT NULL OR filters IS NOT NULL);

    --------------------------------------------------------------------------------
    -- Recreate download_expression join table.
    --------------------------------------------------------------------------------
    CREATE TABLE download_expression (
      download_expression_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
      download_id uuid NOT NULL,
      expression_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT download_expression_pk PRIMARY KEY (download_expression_id),
      CONSTRAINT download_expression_fk1
        FOREIGN KEY (download_id)
        REFERENCES download(download_id)
        ON DELETE CASCADE,
      CONSTRAINT download_expression_fk2
        FOREIGN KEY (expression_id)
        REFERENCES expression(expression_id)
        ON DELETE CASCADE
    );

    --------------------------------------------------------------------------------
    -- Recreate download_expression indexes.
    --------------------------------------------------------------------------------
    CREATE UNIQUE INDEX download_expression_nuk1
      ON download_expression(download_id, expression_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_expression_idx1 ON download_expression(download_id);
    CREATE INDEX download_expression_idx2 ON download_expression(expression_id);
    CREATE INDEX download_expression_idx3
      ON download_expression(expression_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX download_expression_idx4
      ON download_expression(download_id)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- Recreate download_expression triggers.
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_download_expression
      BEFORE INSERT OR UPDATE OR DELETE ON download_expression
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_download_expression
      AFTER INSERT OR UPDATE OR DELETE ON download_expression
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Recreate download_expression comments.
    --------------------------------------------------------------------------------
    COMMENT ON TABLE download_expression IS 'Join table linking a download to a root expression. Only active root expressions (no active parent) are allowed.';
    COMMENT ON COLUMN download_expression.download_expression_id IS 'System generated UUID surrogate primary key identifier.';
    COMMENT ON COLUMN download_expression.download_id IS 'Foreign key to download.';
    COMMENT ON COLUMN download_expression.expression_id IS 'Foreign key to root expression.';
    COMMENT ON COLUMN download_expression.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_expression.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_expression.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_expression.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_expression.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_expression.revision_count IS 'Revision count used for concurrency control.';
  `);
}
