import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- CART
    --------------------------------------------------------------------------------

    -- Lifecycle status of a cart
    CREATE TYPE cart_status AS ENUM (
      'active',       -- Cart is open and can be modified
      'checked_out',  -- Cart has been submitted for download
      'expired',      -- Cart expired without checkout
      'abandoned'     -- Cart was abandoned
    );

    CREATE TABLE cart (
      cart_id UUID DEFAULT gen_random_uuid(),
      system_user_id integer,
      cart_status cart_status NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer,
      update_date timestamptz(6),
      update_user integer,
      last_activity_date timestamptz(6) DEFAULT now() NOT NULL,
      checkout_date timestamptz(6),
      checkout_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT cart_pk PRIMARY KEY (cart_id)
    );

    CREATE INDEX cart_system_user_idx ON cart(system_user_id);
    CREATE INDEX cart_status_idx ON cart(cart_status);
    CREATE INDEX cart_system_user_status_idx ON cart(system_user_id, cart_status);

    COMMENT ON TABLE cart IS 'Represents a server-side cart for collecting submission features prior to download.';
    COMMENT ON COLUMN cart.cart_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN cart.system_user_id IS 'Identifier of the system user who owns the cart.';
    COMMENT ON COLUMN cart.cart_status IS 'Lifecycle state of the cart.';
    COMMENT ON COLUMN cart.record_end_date IS 'Timestamp after which the cart is no longer valid.';
    COMMENT ON COLUMN cart.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN cart.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN cart.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN cart.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN cart.last_activity_date IS 'The datetime of the last activity in the cart.';
    COMMENT ON COLUMN cart.checkout_date IS 'The datetime the cart was checked out.';
    COMMENT ON COLUMN cart.checkout_user IS 'The id of the user who checked out the cart.';
    COMMENT ON COLUMN cart.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- CART_SUBMISSION_FEATURE
    --------------------------------------------------------------------------------

    CREATE TABLE cart_submission_feature (
      cart_submission_feature_id UUID DEFAULT gen_random_uuid(),
      cart_id UUID NOT NULL,
      submission_feature_id integer NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT cart_submission_feature_pk PRIMARY KEY (cart_submission_feature_id),
      CONSTRAINT cart_submission_feature_cart_fk
        FOREIGN KEY (cart_id)
        REFERENCES cart(cart_id)
        ON DELETE CASCADE,
      CONSTRAINT cart_submission_feature_submission_feature_fk
        FOREIGN KEY (submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT cart_submission_feature_uq
        UNIQUE (cart_id, submission_feature_id)
    );

    CREATE INDEX cart_submission_feature_cart_idx
      ON cart_submission_feature(cart_id);

    CREATE INDEX cart_submission_feature_submission_feature_idx
      ON cart_submission_feature(submission_feature_id);

    COMMENT ON TABLE cart_submission_feature IS 'Associates submission features with a cart.';
    COMMENT ON COLUMN cart_submission_feature.cart_submission_feature_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN cart_submission_feature.cart_id IS 'Foreign key to the cart.';
    COMMENT ON COLUMN cart_submission_feature.submission_feature_id IS 'Foreign key to the submission feature.';
    COMMENT ON COLUMN cart_submission_feature.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN cart_submission_feature.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN cart_submission_feature.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN cart_submission_feature.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN cart_submission_feature.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_cart
      BEFORE INSERT OR UPDATE OR DELETE ON cart
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_cart
      AFTER INSERT OR UPDATE OR DELETE ON cart
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_cart_submission_feature
      BEFORE INSERT OR UPDATE OR DELETE ON cart_submission_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_cart_submission_feature
      AFTER INSERT OR UPDATE OR DELETE ON cart_submission_feature
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS journal_cart_submission_feature ON cart_submission_feature;
    DROP TRIGGER IF EXISTS audit_cart_submission_feature ON cart_submission_feature;
    DROP TRIGGER IF EXISTS journal_cart ON cart;
    DROP TRIGGER IF EXISTS audit_cart ON cart;

    DROP TABLE IF EXISTS cart_submission_feature;
    DROP TABLE IF EXISTS cart;

    DROP TYPE IF EXISTS cart_status;
  `);
}
