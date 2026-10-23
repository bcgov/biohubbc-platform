import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { BoardTicket, BoardTicketFilters } from '../models/board';
import { BaseRepository } from './base-repository';
import { activeTicketTagsJson } from './sql-fragments';

/**
 * Repository for board_ticket table operations: which tickets are on which boards, and in which lane.
 */
export class BoardTicketRepository extends BaseRepository {
  /**
   * Get the active tickets on a board, each with its active tags and its lane, in their order within their lanes (ties:
   * oldest first).
   *
   * @param {string} boardId - Board UUID.
   * @param {BoardTicketFilters} filters - Closed tickets are excluded unless include_closed is true.
   * @returns {Promise<BoardTicket[]>} The board's tickets with their tags and lanes.
   * @memberof BoardTicketRepository
   */
  async getBoardTickets(boardId: string, filters: BoardTicketFilters): Promise<BoardTicket[]> {
    const knex = getKnex();
    const query = knex('board_ticket as bt')
      .select([
        't.ticket_id',
        't.ticket_slug',
        't.subject',
        't.description',
        't.team_id',
        't.create_date',
        't.priority',
        't.status',
        knex.raw(`${activeTicketTagsJson('t.ticket_id')} AS tags`),
        'bt.board_swimlane_id'
      ])
      .join('ticket as t', 't.ticket_id', 'bt.ticket_id')
      .where('bt.board_id', boardId)
      .whereNull('bt.record_end_date')
      .whereNull('t.record_end_date')
      .orderBy([
        { column: 'bt.sort_order', order: 'asc' },
        { column: 't.create_date', order: 'asc' },
        { column: 't.ticket_id', order: 'asc' }
      ]);

    if (!filters.include_closed) {
      query.where('t.status', 'open');
    }

    const response = await this.connection.knex(query, BoardTicket);

    return response.rows;
  }

  /**
   * Count the active tickets in a lane.
   *
   * @param {string} boardSwimlaneId - Board swimlane UUID.
   * @returns {Promise<number>} Number of tickets in the lane.
   * @memberof BoardTicketRepository
   */
  async getBoardSwimlaneTicketCount(boardSwimlaneId: string): Promise<number> {
    const knex = getKnex();
    const query = knex('board_ticket')
      .select(knex.raw('count(*)::integer as count'))
      .where('board_swimlane_id', boardSwimlaneId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    return response.rows[0]?.count ?? 0;
  }

  /**
   * Put a ticket on a board at the end of a lane, or move it to the end of that lane if it is on the board in another.
   * A ticket is on a board at most once, so this keeps its single active row; repeating it changes nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @param {string} boardSwimlaneId - The board's lane the ticket is in.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async ensureBoardTicket(boardId: string, ticketId: string, boardSwimlaneId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO board_ticket (board_id, ticket_id, board_swimlane_id, sort_order)
      SELECT ${boardId}::uuid, ${ticketId}::uuid, ${boardSwimlaneId}::uuid, COALESCE(MAX(lane_ticket.sort_order) + 1, 0)
      FROM board_ticket lane_ticket
      WHERE lane_ticket.board_swimlane_id = ${boardSwimlaneId}
        AND lane_ticket.record_end_date IS NULL
      ON CONFLICT (board_id, ticket_id) WHERE record_end_date IS NULL
      DO UPDATE SET board_swimlane_id = EXCLUDED.board_swimlane_id, sort_order = EXCLUDED.sort_order
      WHERE board_ticket.board_swimlane_id IS DISTINCT FROM EXCLUDED.board_swimlane_id;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Put a ticket on a board at the end of a lane, unless it is already on the board, where it then stays where it is.
   * Repeating it changes nothing.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @param {string} boardSwimlaneId - The board's lane a ticket not yet on the board is put in.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async insertBoardTicket(boardId: string, ticketId: string, boardSwimlaneId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO board_ticket (board_id, ticket_id, board_swimlane_id, sort_order)
      SELECT ${boardId}::uuid, ${ticketId}::uuid, ${boardSwimlaneId}::uuid, COALESCE(MAX(lane_ticket.sort_order) + 1, 0)
      FROM board_ticket lane_ticket
      WHERE lane_ticket.board_swimlane_id = ${boardSwimlaneId}
        AND lane_ticket.record_end_date IS NULL
      ON CONFLICT (board_id, ticket_id) WHERE record_end_date IS NULL
      DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Put a ticket on every board linked to any of the given tags, last in the board's default lane. Boards the ticket is
   * already on, and boards without a default lane, are skipped, so a ticket stays where it is on a board.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string[]} tagIds - Tags just applied to the ticket.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async insertBoardTicketsByTagIds(ticketId: string, tagIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO board_ticket (board_id, ticket_id, board_swimlane_id, sort_order)
      SELECT
        b.board_id,
        ${ticketId}::uuid,
        b.default_swimlane_id,
        COALESCE(
          (
            SELECT MAX(lane_ticket.sort_order) + 1
            FROM board_ticket lane_ticket
            WHERE lane_ticket.board_swimlane_id = b.default_swimlane_id
              AND lane_ticket.record_end_date IS NULL
          ),
          0
        )
      FROM board b
      WHERE b.record_end_date IS NULL
        AND b.default_swimlane_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM board_tag bt
          JOIN tag tg
            ON tg.tag_id = bt.tag_id
            AND tg.record_end_date IS NULL
          WHERE bt.board_id = b.board_id
            AND bt.tag_id = ANY(${tagIds}::uuid[])
            AND bt.record_end_date IS NULL
        )
      ON CONFLICT (board_id, ticket_id) WHERE record_end_date IS NULL
      DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Put every ticket that has a tag on a board, last in the board's default lane, oldest first. Tickets already on the
   * board stay where they are, and a board without a default lane gets none.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async insertBoardTicketsByTagId(boardId: string, tagId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO board_ticket (board_id, ticket_id, board_swimlane_id, sort_order)
      SELECT
        b.board_id,
        t.ticket_id,
        b.default_swimlane_id,
        COALESCE(
          (
            SELECT MAX(lane_ticket.sort_order)
            FROM board_ticket lane_ticket
            WHERE lane_ticket.board_swimlane_id = b.default_swimlane_id
              AND lane_ticket.record_end_date IS NULL
          ),
          -1
        ) + ROW_NUMBER() OVER (ORDER BY t.create_date ASC, t.ticket_id ASC)
      FROM board b
      JOIN ticket_tag tt
        ON tt.tag_id = ${tagId}
        AND tt.record_end_date IS NULL
      JOIN ticket t
        ON t.ticket_id = tt.ticket_id
        AND t.record_end_date IS NULL
      WHERE b.board_id = ${boardId}
        AND b.record_end_date IS NULL
        AND b.default_swimlane_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM board_ticket on_board
          WHERE on_board.board_id = b.board_id
            AND on_board.ticket_id = t.ticket_id
            AND on_board.record_end_date IS NULL
        )
      ON CONFLICT (board_id, ticket_id) WHERE record_end_date IS NULL
      DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Move a ticket to a position within its lane, renumbering the lane's tickets to 0..n-1 around it. Positions past the
   * end put it last. Tickets not in the lane are untouched.
   *
   * @param {string} boardSwimlaneId - The lane the ticket is in.
   * @param {string} ticketId - Ticket UUID.
   * @param {number} position - Zero-based position among the lane's tickets.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async updateBoardTicketPosition(boardSwimlaneId: string, ticketId: string, position: number): Promise<void> {
    const sqlStatement = SQL`
      WITH other_ticket AS (
        SELECT
          board_ticket_id,
          ROW_NUMBER() OVER (ORDER BY sort_order ASC, board_ticket_id ASC) - 1 AS lane_position
        FROM board_ticket
        WHERE board_swimlane_id = ${boardSwimlaneId}
          AND ticket_id <> ${ticketId}
          AND record_end_date IS NULL
      ),
      moved_ticket AS (
        SELECT board_ticket_id, LEAST(${position}::integer, (SELECT count(*)::integer FROM other_ticket)) AS lane_position
        FROM board_ticket
        WHERE board_swimlane_id = ${boardSwimlaneId}
          AND ticket_id = ${ticketId}
          AND record_end_date IS NULL
      ),
      ordered AS (
        SELECT
          other_ticket.board_ticket_id,
          CASE
            WHEN other_ticket.lane_position >= moved_ticket.lane_position THEN other_ticket.lane_position + 1
            ELSE other_ticket.lane_position
          END AS sort_order
        FROM other_ticket
        CROSS JOIN moved_ticket
        UNION ALL
        SELECT board_ticket_id, lane_position AS sort_order
        FROM moved_ticket
      )
      UPDATE board_ticket
      SET sort_order = ordered.sort_order
      FROM ordered
      WHERE board_ticket.board_ticket_id = ordered.board_ticket_id
        AND board_ticket.sort_order IS DISTINCT FROM ordered.sort_order;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft delete a ticket's active row on a board, if any.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async deleteBoardTicket(boardId: string, ticketId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_ticket')
      .update({ record_end_date: knex.fn.now() })
      .where('board_id', boardId)
      .where('ticket_id', ticketId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Take the tickets that have a tag off a board the tag is linked to, before the link is ended. A ticket stays on the
   * board while it has another active tag linked to the board. Nothing changes when the tag is not linked to the board.
   *
   * @param {string} boardId - Board UUID.
   * @param {string} tagId - The tag being unlinked from the board.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async deleteBoardTicketsByBoardTag(boardId: string, tagId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_ticket
      SET record_end_date = now()
      WHERE board_ticket.board_id = ${boardId}
        AND board_ticket.record_end_date IS NULL
        AND EXISTS (
          SELECT 1
          FROM board_tag removed_board_tag
          JOIN ticket_tag removed_ticket_tag
            ON removed_ticket_tag.tag_id = removed_board_tag.tag_id
            AND removed_ticket_tag.ticket_id = board_ticket.ticket_id
            AND removed_ticket_tag.record_end_date IS NULL
          WHERE removed_board_tag.board_id = board_ticket.board_id
            AND removed_board_tag.tag_id = ${tagId}
            AND removed_board_tag.record_end_date IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ticket_tag kept_ticket_tag
          JOIN tag kept_tag
            ON kept_tag.tag_id = kept_ticket_tag.tag_id
            AND kept_tag.record_end_date IS NULL
          JOIN board_tag kept_board_tag
            ON kept_board_tag.tag_id = kept_ticket_tag.tag_id
            AND kept_board_tag.board_id = board_ticket.board_id
            AND kept_board_tag.record_end_date IS NULL
          WHERE kept_ticket_tag.ticket_id = board_ticket.ticket_id
            AND kept_ticket_tag.tag_id <> ${tagId}
            AND kept_ticket_tag.record_end_date IS NULL
        );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Take the tickets that have a tag off every board the tag is linked to, before the tag's links are ended. A ticket
   * stays on a board while it has another active tag linked to that board.
   *
   * @param {string} tagId - The tag being deleted.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async deleteBoardTicketsByTagId(tagId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_ticket
      SET record_end_date = now()
      WHERE board_ticket.record_end_date IS NULL
        AND EXISTS (
          SELECT 1
          FROM board_tag removed_board_tag
          JOIN ticket_tag removed_ticket_tag
            ON removed_ticket_tag.tag_id = removed_board_tag.tag_id
            AND removed_ticket_tag.ticket_id = board_ticket.ticket_id
            AND removed_ticket_tag.record_end_date IS NULL
          WHERE removed_board_tag.board_id = board_ticket.board_id
            AND removed_board_tag.tag_id = ${tagId}
            AND removed_board_tag.record_end_date IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ticket_tag kept_ticket_tag
          JOIN tag kept_tag
            ON kept_tag.tag_id = kept_ticket_tag.tag_id
            AND kept_tag.record_end_date IS NULL
          JOIN board_tag kept_board_tag
            ON kept_board_tag.tag_id = kept_ticket_tag.tag_id
            AND kept_board_tag.board_id = board_ticket.board_id
            AND kept_board_tag.record_end_date IS NULL
          WHERE kept_ticket_tag.ticket_id = board_ticket.ticket_id
            AND kept_ticket_tag.tag_id <> ${tagId}
            AND kept_ticket_tag.record_end_date IS NULL
        );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Take the tickets that a tag rule tagged off the boards their tag is linked to, before the rule's tags are removed
   * from them. A ticket stays on a board while it has another active tag linked to that board.
   *
   * @param {string} tagRuleId - The tag rule whose tags are being removed.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async deleteBoardTicketsByTagRuleId(tagRuleId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_ticket
      SET record_end_date = now()
      WHERE board_ticket.record_end_date IS NULL
        AND EXISTS (
          SELECT 1
          FROM ticket_tag removed_ticket_tag
          JOIN board_tag removed_board_tag
            ON removed_board_tag.tag_id = removed_ticket_tag.tag_id
            AND removed_board_tag.board_id = board_ticket.board_id
            AND removed_board_tag.record_end_date IS NULL
          WHERE removed_ticket_tag.ticket_id = board_ticket.ticket_id
            AND removed_ticket_tag.tag_rule_id = ${tagRuleId}
            AND removed_ticket_tag.record_end_date IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ticket_tag kept_ticket_tag
          JOIN tag kept_tag
            ON kept_tag.tag_id = kept_ticket_tag.tag_id
            AND kept_tag.record_end_date IS NULL
          JOIN board_tag kept_board_tag
            ON kept_board_tag.tag_id = kept_ticket_tag.tag_id
            AND kept_board_tag.board_id = board_ticket.board_id
            AND kept_board_tag.record_end_date IS NULL
          WHERE kept_ticket_tag.ticket_id = board_ticket.ticket_id
            AND kept_ticket_tag.tag_rule_id IS DISTINCT FROM ${tagRuleId}
            AND kept_ticket_tag.record_end_date IS NULL
        );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Take a ticket off the boards linked to the tags it is losing, before they are removed: its active tags not in the
   * given set. The ticket stays on a board while a tag in the given set is linked to that board.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string[]} tagIds - The ticket's tags after the change. Empty takes it off every board a tag put it on.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async deleteBoardTicketsByTicketTagsNotIn(ticketId: string, tagIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE board_ticket
      SET record_end_date = now()
      WHERE board_ticket.ticket_id = ${ticketId}
        AND board_ticket.record_end_date IS NULL
        AND EXISTS (
          SELECT 1
          FROM ticket_tag removed_ticket_tag
          JOIN board_tag removed_board_tag
            ON removed_board_tag.tag_id = removed_ticket_tag.tag_id
            AND removed_board_tag.board_id = board_ticket.board_id
            AND removed_board_tag.record_end_date IS NULL
          WHERE removed_ticket_tag.ticket_id = board_ticket.ticket_id
            AND removed_ticket_tag.tag_id <> ALL(${tagIds}::uuid[])
            AND removed_ticket_tag.record_end_date IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM board_tag kept_board_tag
          JOIN tag kept_tag
            ON kept_tag.tag_id = kept_board_tag.tag_id
            AND kept_tag.record_end_date IS NULL
          WHERE kept_board_tag.board_id = board_ticket.board_id
            AND kept_board_tag.tag_id = ANY(${tagIds}::uuid[])
            AND kept_board_tag.record_end_date IS NULL
        );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft delete every active ticket row of a board.
   *
   * @param {string} boardId - Board UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async deleteBoardTicketsByBoardId(boardId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_ticket')
      .update({ record_end_date: knex.fn.now() })
      .where('board_id', boardId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Soft delete every active board row of a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @memberof BoardTicketRepository
   */
  async deleteBoardTicketsByTicketId(ticketId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('board_ticket')
      .update({ record_end_date: knex.fn.now() })
      .where('ticket_id', ticketId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }
}
