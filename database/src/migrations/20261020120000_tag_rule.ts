import type { Knex } from 'knex';

/**
 * Adds tag rules: an expression that automatically applies a tag to tickets.
 *
 * - tag_rule: one tag and one expression. A submission upload ticket matches when a feature of its upload matches the
 *   expression. A data request ticket matches when the request's expression refers to a property, or a taxon
 *   (including descendants), that the rule's expression also refers to. A background job evaluates a ticket's rules
 *   when a data request is linked to it, and when its submission upload finishes processing. Rules only add tags, and
 *   never a tag the ticket has ever had: a rule-applied tag is an ordinary tag, and once removed it stays removed.
 * - ticket_tag.tag_rule_id: the rule that applied the tag. NULL for tags applied manually.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- TAG RULE
    --------------------------------------------------------------------------------

    CREATE TABLE tag_rule (
      tag_rule_id uuid DEFAULT gen_random_uuid() NOT NULL,
      tag_id uuid NOT NULL,
      name varchar(100) NOT NULL,
      description varchar(500) NULL,
      is_enabled boolean DEFAULT true NOT NULL,
      expression_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT tag_rule_pk PRIMARY KEY (tag_rule_id),
      CONSTRAINT tag_rule_tag_fk FOREIGN KEY (tag_id) REFERENCES tag(tag_id),
      CONSTRAINT tag_rule_expression_fk FOREIGN KEY (expression_id) REFERENCES expression(expression_id)
    );

    CREATE UNIQUE INDEX tag_rule_nuk1
      ON tag_rule(lower(name))
      WHERE record_end_date IS NULL;
    CREATE INDEX tag_rule_tag_idx
      ON tag_rule(tag_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE tag_rule IS 'Admin-defined rule that automatically applies a tag to tickets whose submission upload features match its expression, or whose data request expression refers to the same properties or taxa.';
    COMMENT ON COLUMN tag_rule.tag_rule_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN tag_rule.tag_id IS 'Foreign key to the tag the rule applies.';
    COMMENT ON COLUMN tag_rule.name IS 'Display name of the rule. Unique (case-insensitive) among active rules.';
    COMMENT ON COLUMN tag_rule.description IS 'Optional description of the rule.';
    COMMENT ON COLUMN tag_rule.is_enabled IS 'Disabled rules are not evaluated; tags already applied are unaffected.';
    COMMENT ON COLUMN tag_rule.expression_id IS 'Expression a feature of the ticket''s submission upload must match, or whose properties and taxa the ticket''s data request expression must refer to.';
    COMMENT ON COLUMN tag_rule.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN tag_rule.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN tag_rule.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN tag_rule.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN tag_rule.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN tag_rule.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_tag_rule
      BEFORE INSERT OR UPDATE OR DELETE ON tag_rule
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_tag_rule
      AFTER INSERT OR UPDATE OR DELETE ON tag_rule
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- TICKET TAG: rule provenance
    --------------------------------------------------------------------------------

    ALTER TABLE ticket_tag ADD COLUMN tag_rule_id uuid NULL;
    ALTER TABLE ticket_tag
      ADD CONSTRAINT ticket_tag_tag_rule_fk FOREIGN KEY (tag_rule_id) REFERENCES tag_rule(tag_rule_id);

    COMMENT ON COLUMN ticket_tag.tag_rule_id IS 'The tag rule that applied the tag; null when applied manually. Provenance only: rules never apply a tag a ticket has ever had, so a removed tag stays removed when the ticket is re-evaluated.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE ticket_tag DROP CONSTRAINT IF EXISTS ticket_tag_tag_rule_fk;
    ALTER TABLE ticket_tag DROP COLUMN IF EXISTS tag_rule_id;

    DROP TABLE IF EXISTS tag_rule;
  `);
}
