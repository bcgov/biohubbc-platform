import type { Knex } from 'knex';

/**
 * Makes board membership and lane placement explicit, independent of tags.
 *
 * - board_ticket: a ticket on a board, in exactly one of the board's lanes. A ticket can be on many boards, once per
 *   board. The lane is enforced to belong to the same board by a composite foreign key.
 * - board_tag now means: applying the tag to a ticket puts the ticket on the board, in the board's default lane. It no
 *   longer decides which tickets a board shows; board_ticket does.
 * - board_swimlane_tag is dropped: tags no longer decide lanes.
 *
 * - board.default_swimlane_id: the lane tickets created on or added to the board go in. Boards start with a 'To Do'
 *   lane as their default. Existing boards without lanes get a 'To Do' lane here, and each existing board's default is
 *   its first lane. The default lane must belong to the same board, by a composite foreign key.
 *
 * Backfill: the membership computed from tags until now is stored. A ticket with any active board tag joins the board,
 * in the active lane with the highest sort_order whose tags it has, or else the board's first lane. Within each lane,
 * tickets are ordered oldest first by their sort_order.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- BOARD TICKET
    --------------------------------------------------------------------------------

    ALTER TABLE board_swimlane ADD CONSTRAINT board_swimlane_board_uk1 UNIQUE (board_id, board_swimlane_id);

    ALTER TABLE board ADD COLUMN default_swimlane_id uuid NULL;
    ALTER TABLE board ADD CONSTRAINT board_default_swimlane_fk FOREIGN KEY (board_id, default_swimlane_id)
      REFERENCES board_swimlane(board_id, board_swimlane_id);

    COMMENT ON COLUMN board.default_swimlane_id IS 'The lane tickets created on or added to the board go in. Must belong to the board.';

    CREATE TABLE board_ticket (
      board_ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
      board_id uuid NOT NULL,
      ticket_id uuid NOT NULL,
      board_swimlane_id uuid NOT NULL,
      sort_order integer NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT board_ticket_pk PRIMARY KEY (board_ticket_id),
      CONSTRAINT board_ticket_board_fk FOREIGN KEY (board_id) REFERENCES board(board_id),
      CONSTRAINT board_ticket_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT board_ticket_board_swimlane_fk FOREIGN KEY (board_id, board_swimlane_id)
        REFERENCES board_swimlane(board_id, board_swimlane_id)
    );

    CREATE UNIQUE INDEX board_ticket_nuk1
      ON board_ticket(board_id, ticket_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX board_ticket_board_swimlane_sort_idx
      ON board_ticket(board_swimlane_id, sort_order)
      WHERE record_end_date IS NULL;
    CREATE INDEX board_ticket_ticket_idx
      ON board_ticket(ticket_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE board_ticket IS 'A ticket on a board, in exactly one of the board''s lanes. A ticket is on a board at most once.';
    COMMENT ON COLUMN board_ticket.board_ticket_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN board_ticket.board_id IS 'Foreign key to the board.';
    COMMENT ON COLUMN board_ticket.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN board_ticket.board_swimlane_id IS 'The lane the ticket is in. Must belong to the same board.';
    COMMENT ON COLUMN board_ticket.sort_order IS 'Top-to-bottom order of the ticket within its lane (ties broken by board_ticket_id). Not unique, so moving stays simple.';
    COMMENT ON COLUMN board_ticket.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN board_ticket.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN board_ticket.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN board_ticket.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN board_ticket.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN board_ticket.revision_count IS 'Revision count used for concurrency control.';

    COMMENT ON TABLE board_swimlane IS 'Lane owned by a board. Every ticket on the board is in exactly one of its lanes.';

    CREATE TRIGGER audit_board_ticket
      BEFORE INSERT OR UPDATE OR DELETE ON board_ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_board_ticket
      AFTER INSERT OR UPDATE OR DELETE ON board_ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- BACKFILL FROM TAG-DERIVED MEMBERSHIP
    --------------------------------------------------------------------------------

    CREATE TEMPORARY TABLE board_member ON COMMIT DROP AS
      SELECT DISTINCT bt.board_id, tt.ticket_id
      FROM board_tag bt
      JOIN board b
        ON b.board_id = bt.board_id
        AND b.record_end_date IS NULL
      JOIN tag tg
        ON tg.tag_id = bt.tag_id
        AND tg.record_end_date IS NULL
      JOIN ticket_tag tt
        ON tt.tag_id = bt.tag_id
        AND tt.record_end_date IS NULL
      JOIN ticket t
        ON t.ticket_id = tt.ticket_id
        AND t.record_end_date IS NULL
      WHERE bt.record_end_date IS NULL;

    -- Every board has a lane, so every board ticket has one to go in.
    INSERT INTO board_swimlane (board_id, name, sort_order)
    SELECT b.board_id, 'To Do', 0
    FROM board b
    WHERE b.record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM board_swimlane bs
        WHERE bs.board_id = b.board_id
          AND bs.record_end_date IS NULL
      );

    UPDATE board b
    SET default_swimlane_id = (
      SELECT bs.board_swimlane_id
      FROM board_swimlane bs
      WHERE bs.board_id = b.board_id
        AND bs.record_end_date IS NULL
      ORDER BY bs.sort_order ASC, bs.board_swimlane_id ASC
      LIMIT 1
    )
    WHERE b.record_end_date IS NULL;

    -- Within each lane, tickets are ordered oldest first.
    INSERT INTO board_ticket (board_id, ticket_id, board_swimlane_id, sort_order)
    SELECT
      placed.board_id,
      placed.ticket_id,
      placed.board_swimlane_id,
      ROW_NUMBER() OVER (PARTITION BY placed.board_swimlane_id ORDER BY t.create_date ASC, t.ticket_id ASC) - 1
    FROM (
      SELECT
        bm.board_id,
        bm.ticket_id,
        COALESCE(
        (
          SELECT bs.board_swimlane_id
          FROM ticket_tag tt
          JOIN tag tg
            ON tg.tag_id = tt.tag_id
            AND tg.record_end_date IS NULL
          JOIN board_tag bt
            ON bt.tag_id = tt.tag_id
            AND bt.board_id = bm.board_id
            AND bt.record_end_date IS NULL
          JOIN board_swimlane_tag bst
            ON bst.board_tag_id = bt.board_tag_id
            AND bst.record_end_date IS NULL
          JOIN board_swimlane bs
            ON bs.board_swimlane_id = bst.board_swimlane_id
            AND bs.board_id = bm.board_id
            AND bs.record_end_date IS NULL
          WHERE tt.ticket_id = bm.ticket_id
            AND tt.record_end_date IS NULL
          ORDER BY bs.sort_order DESC, bs.board_swimlane_id DESC
          LIMIT 1
        ),
        (
          SELECT bs.board_swimlane_id
          FROM board_swimlane bs
          WHERE bs.board_id = bm.board_id
            AND bs.record_end_date IS NULL
          ORDER BY bs.sort_order ASC, bs.board_swimlane_id ASC
          LIMIT 1
        )
      ) AS board_swimlane_id
      FROM board_member bm
    ) placed
    JOIN ticket t
      ON t.ticket_id = placed.ticket_id;

    --------------------------------------------------------------------------------
    -- DROP TAG-DERIVED MEMBERSHIP
    --------------------------------------------------------------------------------

    DROP TABLE board_swimlane_tag;

    COMMENT ON TABLE board_tag IS 'Tags that put tickets on a board: applying one to a ticket adds the ticket to the board''s default lane.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

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

    CREATE TRIGGER audit_board_swimlane_tag
      BEFORE INSERT OR UPDATE OR DELETE ON board_swimlane_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_board_swimlane_tag
      AFTER INSERT OR UPDATE OR DELETE ON board_swimlane_tag
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    COMMENT ON TABLE board_tag IS 'Tags that determine which tickets appear on a board (any match).';

    DROP TABLE IF EXISTS board_ticket;
    ALTER TABLE board DROP CONSTRAINT IF EXISTS board_default_swimlane_fk;
    ALTER TABLE board DROP COLUMN IF EXISTS default_swimlane_id;
    ALTER TABLE board_swimlane DROP CONSTRAINT IF EXISTS board_swimlane_board_uk1;
  `);
}
