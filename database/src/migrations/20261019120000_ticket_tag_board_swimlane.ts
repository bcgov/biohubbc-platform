import type { Knex } from 'knex';

/**
 * Adds admin-only ticket organization: tags, boards, and board swimlanes.
 *
 * - tag: label applied to tickets by system administrators.
 * - ticket_tag: links tickets to tags.
 * - board: named view of tickets. Board membership is computed at query time from board_tag (any match).
 * - board_tag: tags that place tickets on a board.
 * - board_swimlane: board-owned lane, ordered by sort_order, optionally hidden for everyone.
 * - board_swimlane_tag: board tags that place a board ticket into a lane (any match; highest sort_order wins). Lanes
 *   reference board_tag, so a lane can only use tags already on its board.
 *
 * Uniqueness applies to active rows only so deleted names and links can be recreated.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- TAG
    --------------------------------------------------------------------------------

    CREATE TABLE tag (
      tag_id uuid DEFAULT gen_random_uuid() NOT NULL,
      name varchar(50) NOT NULL,
      description varchar(250) NULL,
      color varchar(7) NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT tag_pk PRIMARY KEY (tag_id),
      CONSTRAINT tag_color_chk CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
    );

    CREATE UNIQUE INDEX tag_nuk1
      ON tag(lower(name))
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE tag IS 'Admin-only label applied to tickets. Tags drive board membership and swimlane placement.';
    COMMENT ON COLUMN tag.tag_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN tag.name IS 'Display name of the tag. Unique (case-insensitive) among active tags.';
    COMMENT ON COLUMN tag.description IS 'Optional description of what the tag means.';
    COMMENT ON COLUMN tag.color IS 'Display color as a hex string (#RRGGBB).';
    COMMENT ON COLUMN tag.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN tag.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN tag.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN tag.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN tag.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN tag.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TICKET TAG
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_tag (
      ticket_tag_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      tag_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_tag_pk PRIMARY KEY (ticket_tag_id),
      CONSTRAINT ticket_tag_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_tag_tag_fk FOREIGN KEY (tag_id) REFERENCES tag(tag_id)
    );

    CREATE UNIQUE INDEX ticket_tag_nuk1
      ON ticket_tag(ticket_id, tag_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_tag_tag_ticket_idx
      ON ticket_tag(tag_id, ticket_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_tag_ticket_idx
      ON ticket_tag(ticket_id);

    COMMENT ON TABLE ticket_tag IS 'Links tickets to admin-only tags. Soft-deleted rows provide tag added/removed history for the admin ticket timeline.';
    COMMENT ON COLUMN ticket_tag.ticket_tag_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_tag.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN ticket_tag.tag_id IS 'Foreign key to the tag.';
    COMMENT ON COLUMN ticket_tag.record_end_date IS 'Timestamp for soft delete (tag removed from ticket); null when record is active.';
    COMMENT ON COLUMN ticket_tag.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_tag.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_tag.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_tag.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_tag.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- BOARD
    --------------------------------------------------------------------------------

    CREATE TABLE board (
      board_id uuid DEFAULT gen_random_uuid() NOT NULL,
      name varchar(100) NOT NULL,
      description varchar(500) NULL,
      color varchar(7) NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT board_pk PRIMARY KEY (board_id),
      CONSTRAINT board_color_chk CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
    );

    CREATE UNIQUE INDEX board_nuk1
      ON board(lower(name))
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE board IS 'Admin-only named view of tickets. A ticket is on a board when it has any of the board tags; membership is computed at query time.';
    COMMENT ON COLUMN board.board_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN board.name IS 'Display name of the board. Unique (case-insensitive) among active boards.';
    COMMENT ON COLUMN board.description IS 'Optional description of the board.';
    COMMENT ON COLUMN board.color IS 'Display color as a hex string (#RRGGBB).';
    COMMENT ON COLUMN board.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN board.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN board.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN board.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN board.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN board.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- BOARD TAG
    --------------------------------------------------------------------------------

    CREATE TABLE board_tag (
      board_tag_id uuid DEFAULT gen_random_uuid() NOT NULL,
      board_id uuid NOT NULL,
      tag_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT board_tag_pk PRIMARY KEY (board_tag_id),
      CONSTRAINT board_tag_board_fk FOREIGN KEY (board_id) REFERENCES board(board_id),
      CONSTRAINT board_tag_tag_fk FOREIGN KEY (tag_id) REFERENCES tag(tag_id)
    );

    CREATE UNIQUE INDEX board_tag_nuk1
      ON board_tag(board_id, tag_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE board_tag IS 'Tags that determine which tickets appear on a board (any match).';
    COMMENT ON COLUMN board_tag.board_tag_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN board_tag.board_id IS 'Foreign key to the board.';
    COMMENT ON COLUMN board_tag.tag_id IS 'Foreign key to the tag.';
    COMMENT ON COLUMN board_tag.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN board_tag.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN board_tag.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN board_tag.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN board_tag.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN board_tag.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- BOARD SWIMLANE
    --------------------------------------------------------------------------------

    CREATE TABLE board_swimlane (
      board_swimlane_id uuid DEFAULT gen_random_uuid() NOT NULL,
      board_id uuid NOT NULL,
      name varchar(100) NOT NULL,
      description varchar(250) NULL,
      color varchar(7) NULL,
      sort_order integer NOT NULL,
      is_visible boolean DEFAULT true NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT board_swimlane_pk PRIMARY KEY (board_swimlane_id),
      CONSTRAINT board_swimlane_board_fk FOREIGN KEY (board_id) REFERENCES board(board_id),
      CONSTRAINT board_swimlane_color_chk CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
    );

    CREATE UNIQUE INDEX board_swimlane_nuk1
      ON board_swimlane(board_id, lower(name))
      WHERE record_end_date IS NULL;
    CREATE INDEX board_swimlane_board_sort_idx
      ON board_swimlane(board_id, sort_order)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE board_swimlane IS 'Lane owned by a board. Board tickets are placed into the matching lane with the highest sort_order.';
    COMMENT ON COLUMN board_swimlane.board_swimlane_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN board_swimlane.board_id IS 'Foreign key to the owning board.';
    COMMENT ON COLUMN board_swimlane.name IS 'Display name of the lane. Unique (case-insensitive) among active lanes of the board.';
    COMMENT ON COLUMN board_swimlane.description IS 'Optional description of the lane.';
    COMMENT ON COLUMN board_swimlane.color IS 'Optional display color as a hex string (#RRGGBB).';
    COMMENT ON COLUMN board_swimlane.sort_order IS 'Left-to-right display order (ties broken by board_swimlane_id). Not unique, so reordering stays simple.';
    COMMENT ON COLUMN board_swimlane.is_visible IS 'Whether the lane is shown on the board. Global for the board, not per user.';
    COMMENT ON COLUMN board_swimlane.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN board_swimlane.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN board_swimlane.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN board_swimlane.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN board_swimlane.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN board_swimlane.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- BOARD SWIMLANE TAG
    --------------------------------------------------------------------------------

    CREATE TABLE board_swimlane_tag (
      board_swimlane_tag_id uuid DEFAULT gen_random_uuid() NOT NULL,
      board_swimlane_id uuid NOT NULL,
      board_tag_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT board_swimlane_tag_pk PRIMARY KEY (board_swimlane_tag_id),
      CONSTRAINT board_swimlane_tag_board_swimlane_fk FOREIGN KEY (board_swimlane_id) REFERENCES board_swimlane(board_swimlane_id),
      CONSTRAINT board_swimlane_tag_board_tag_fk FOREIGN KEY (board_tag_id) REFERENCES board_tag(board_tag_id)
    );

    CREATE UNIQUE INDEX board_swimlane_tag_nuk1
      ON board_swimlane_tag(board_swimlane_id, board_tag_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX board_swimlane_tag_board_tag_idx
      ON board_swimlane_tag(board_tag_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE board_swimlane_tag IS 'Board tags that place board tickets into a lane (any match). Lanes can only use tags already on their board, so lane tags never add tickets to the board.';
    COMMENT ON COLUMN board_swimlane_tag.board_swimlane_tag_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN board_swimlane_tag.board_swimlane_id IS 'Foreign key to the board swimlane.';
    COMMENT ON COLUMN board_swimlane_tag.board_tag_id IS 'Foreign key to the board tag. Must belong to the same board as the swimlane.';
    COMMENT ON COLUMN board_swimlane_tag.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN board_swimlane_tag.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN board_swimlane_tag.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN board_swimlane_tag.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN board_swimlane_tag.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN board_swimlane_tag.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_tag
      BEFORE INSERT OR UPDATE OR DELETE ON tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_tag
      AFTER INSERT OR UPDATE OR DELETE ON tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_tag
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_tag
      AFTER INSERT OR UPDATE OR DELETE ON ticket_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_board
      BEFORE INSERT OR UPDATE OR DELETE ON board
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_board
      AFTER INSERT OR UPDATE OR DELETE ON board
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_board_tag
      BEFORE INSERT OR UPDATE OR DELETE ON board_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_board_tag
      AFTER INSERT OR UPDATE OR DELETE ON board_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_board_swimlane
      BEFORE INSERT OR UPDATE OR DELETE ON board_swimlane
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_board_swimlane
      AFTER INSERT OR UPDATE OR DELETE ON board_swimlane
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_board_swimlane_tag
      BEFORE INSERT OR UPDATE OR DELETE ON board_swimlane_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_board_swimlane_tag
      AFTER INSERT OR UPDATE OR DELETE ON board_swimlane_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS board_swimlane_tag;
    DROP TABLE IF EXISTS board_swimlane;
    DROP TABLE IF EXISTS board_tag;
    DROP TABLE IF EXISTS board;
    DROP TABLE IF EXISTS ticket_tag;
    DROP TABLE IF EXISTS tag;
  `);
}
