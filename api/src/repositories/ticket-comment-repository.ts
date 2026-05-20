import { SQL } from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { TicketComment } from '../models/ticket-comment';
import { BaseRepository } from './base-repository';

/**
 * Repository for ticket_comment table operations.
 */
export class TicketCommentRepository extends BaseRepository {
  /**
   * Insert a ticket_comment link row for an existing comment.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} commentId - Comment UUID.
   * @return {Promise<{ ticket_comment_id: string }>} Inserted link row identifier.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TicketCommentRepository
   */
  async insertTicketComment(ticketId: string, commentId: string): Promise<{ ticket_comment_id: string }> {
    const knex = getKnex();
    const query = knex('ticket_comment')
      .insert({ ticket_id: ticketId, comment_id: commentId })
      .returning(['ticket_comment_id']);

    const response = await this.connection.knex(query, z.object({ ticket_comment_id: z.string() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert ticket comment', [
        'TicketCommentRepository->insertTicketComment',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a ticket comment link row scoped to a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketCommentId - Ticket comment UUID.
   * @return {Promise<{ ticket_comment_id: string }>} Deleted ticket comment identifier.
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof TicketCommentRepository
   */
  async deleteTicketComment(ticketId: string, ticketCommentId: string): Promise<{ ticket_comment_id: string }> {
    const knex = getKnex();
    const query = knex('ticket_comment')
      .update({ record_end_date: knex.fn.now() })
      .where('ticket_id', ticketId)
      .where('ticket_comment_id', ticketCommentId)
      .whereNull('record_end_date')
      .returning(['ticket_comment_id']);

    const response = await this.connection.knex(query, z.object({ ticket_comment_id: z.string() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete ticket comment', [
        'TicketCommentRepository->deleteTicketComment',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update a comment body scoped by ticket and ticket_comment link.
   *
   * @param {string} ticketId
   * @param {string} ticketCommentId
   * @param {string} comment
   * @return {Promise<{ comment_id: string }>}
   * @memberof TicketCommentRepository
   */
  async updateTicketComment(
    ticketId: string,
    ticketCommentId: string,
    comment: string
  ): Promise<{ comment_id: string }> {
    const sqlStatement = SQL`
      UPDATE comment c
      SET comment = ${comment}
      FROM ticket_comment tc
      WHERE tc.comment_id = c.comment_id
        AND tc.ticket_id = ${ticketId}
        AND tc.ticket_comment_id = ${ticketCommentId}
        AND tc.record_end_date IS NULL
      RETURNING c.comment_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ comment_id: z.string() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update ticket comment', [
        'TicketCommentRepository->updateTicketComment',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single comment row by ticket_comment_id.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketCommentId - Ticket comment UUID.
   * @return {Promise<TicketComment>} Ticket comment row.
   * @throws {ApiExecuteSQLError} If exactly one row is not found.
   * @memberof TicketCommentRepository
   */
  async getTicketCommentById(ticketId: string, ticketCommentId: string): Promise<TicketComment> {
    const sqlStatement = SQL`
      SELECT
        tc.ticket_comment_id,
        tc.ticket_id,
        su.user_identifier,
        tc.create_date,
        c.comment,
        COALESCE(
          json_agg(
            json_build_object(
              'ticket_artifact_id', ta.ticket_artifact_id,
              'ticket_id', ta.ticket_id,
              'artifact_id', ta.artifact_id,
              'record_end_date', ta.record_end_date,
              'create_date', ta.create_date,
              'object_key', a.object_key
            )
            ORDER BY ta.create_date ASC
          ) FILTER (WHERE ta.ticket_artifact_id IS NOT NULL),
          '[]'::json
        ) AS artifacts
      FROM ticket_comment tc
      JOIN comment c
        ON c.comment_id = tc.comment_id
      JOIN "system_user" su
        ON su.system_user_id = tc.create_user
      LEFT JOIN ticket_comment_artifact tca
        ON tca.ticket_comment_id = tc.ticket_comment_id
        AND tca.record_end_date IS NULL
      LEFT JOIN ticket_artifact ta
        ON ta.ticket_artifact_id = tca.ticket_artifact_id
        AND ta.ticket_id = tc.ticket_id
        AND ta.record_end_date IS NULL
      LEFT JOIN artifact a
        ON a.artifact_id = ta.artifact_id
      WHERE tc.ticket_id = ${ticketId}
        AND tc.ticket_comment_id = ${ticketCommentId}
        AND tc.record_end_date IS NULL
      GROUP BY
        tc.ticket_comment_id,
        tc.ticket_id,
        su.user_identifier,
        tc.create_date,
        c.comment;
    `;

    const response = await this.connection.sql(sqlStatement, TicketComment);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get ticket comment', [
        'TicketCommentRepository->getTicketCommentById',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get comment history rows for a ticket ordered oldest first.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketComment[]>} Ticket comment rows.
   * @memberof TicketCommentRepository
   */
  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    const sqlStatement = SQL`
      SELECT
        tc.ticket_comment_id,
        tc.ticket_id,
        su.user_identifier,
        tc.create_date,
        c.comment,
        COALESCE(
          json_agg(
            json_build_object(
              'ticket_artifact_id', ta.ticket_artifact_id,
              'ticket_id', ta.ticket_id,
              'artifact_id', ta.artifact_id,
              'record_end_date', ta.record_end_date,
              'create_date', ta.create_date,
              'object_key', a.object_key
            )
            ORDER BY ta.create_date ASC
          ) FILTER (WHERE ta.ticket_artifact_id IS NOT NULL),
          '[]'::json
        ) AS artifacts
      FROM ticket_comment tc
      JOIN comment c
        ON c.comment_id = tc.comment_id
      JOIN "system_user" su
        ON su.system_user_id = tc.create_user
      LEFT JOIN ticket_comment_artifact tca
        ON tca.ticket_comment_id = tc.ticket_comment_id
        AND tca.record_end_date IS NULL
      LEFT JOIN ticket_artifact ta
        ON ta.ticket_artifact_id = tca.ticket_artifact_id
        AND ta.ticket_id = tc.ticket_id
        AND ta.record_end_date IS NULL
      LEFT JOIN artifact a
        ON a.artifact_id = ta.artifact_id
      WHERE tc.ticket_id = ${ticketId}
        AND tc.record_end_date IS NULL
      GROUP BY
        tc.ticket_comment_id,
        tc.ticket_id,
        su.user_identifier,
        tc.create_date,
        c.comment
      ORDER BY tc.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketComment);

    return response.rows;
  }
}
