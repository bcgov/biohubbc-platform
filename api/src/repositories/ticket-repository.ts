import { Knex } from 'knex';
import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTicketPayload, Ticket, TicketFilters, TicketSlug, UpdateTicketRequest } from '../models/ticket';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const TICKET_COLUMNS = [
  'ticket_id',
  'ticket_slug',
  'subject',
  'description',
  'team_id',
  'create_date',
  'priority',
  'status'
] as const;

export class TicketRepository extends BaseRepository {
  /**
   * Apply ticket filters to a base ticket query.
   *
   * @param {Knex.QueryBuilder} query
   * @param {TicketFilters} [filters]
   * @return {Knex.QueryBuilder}
   * @memberof TicketRepository
   */
  applyFilters(query: Knex.QueryBuilder, filters?: TicketFilters): Knex.QueryBuilder {
    if (filters?.team_id) {
      query = query.andWhere('team_id', filters.team_id);
    }

    if (filters?.status) {
      query = query.andWhere('status', filters.status);
    }

    return query;
  }

  /**
   * Generate the next unique ticket slug for the current UTC day in DDDNNNNN format.
   *
   * Uses a transaction-scoped advisory lock plus existing ticket rows to guarantee uniqueness without retries.
   *
   * @return {Promise<string>} Next ticket slug.
   * @throws {ApiExecuteSQLError} If slug generation fails.
   * @memberof TicketRepository
   */
  async getNextTicketSlug(): Promise<string> {
    const sqlStatement = SQL`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext('ticket_slug_generation'))
      ),
      day_context AS (
        SELECT TO_CHAR((now() AT TIME ZONE 'UTC')::date, 'DDD') AS day_of_year
      ),
      latest AS (
        SELECT
          COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) AS last_value
        FROM ticket, day_context, advisory_lock
        WHERE ticket_slug LIKE day_context.day_of_year || '%'
      ),
      next_value AS (
        SELECT
          day_context.day_of_year,
          latest.last_value + 1 AS next_sequence
        FROM day_context, latest
      )
      SELECT
        day_of_year || LPAD(next_sequence::text, 5, '0') AS ticket_slug
      FROM next_value;
    `;

    const response = await this.connection.sql(sqlStatement, TicketSlug);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to generate ticket slug', [
        'TicketRepository->getNextTicketSlug',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0].ticket_slug;
  }

  /**
   * Insert a new ticket record.
   *
   * @param {CreateTicketPayload} ticket - Ticket payload to persist with resolved team ID and generated slug.
   * @return {Promise<Ticket>} The created ticket record.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TicketRepository
   */
  async insertTicket(ticket: CreateTicketPayload): Promise<Ticket> {
    const knex = getKnex();
    const query = knex
      .table('ticket')
      .insert({
        subject: ticket.subject,
        description: ticket.description ?? null,
        team_id: ticket.team_id,
        ticket_slug: ticket.ticket_slug,
        priority: ticket.priority
      })
      .returning(TICKET_COLUMNS);

    const response = await this.connection.knex(query, Ticket);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert ticket record', [
        'TicketRepository->insertTicket',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single active ticket by UUID.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<Ticket>} Matching ticket record.
   * @throws {ApiExecuteSQLError} If exactly one active ticket is not found.
   * @memberof TicketRepository
   */
  async getTicketById(ticketId: string): Promise<Ticket> {
    const knex = getKnex();
    const query = knex.table('ticket').select(TICKET_COLUMNS).where('ticket_id', ticketId).whereNull('record_end_date');

    const response = await this.connection.knex(query, Ticket);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get ticket record', [
        'TicketRepository->getTicketById',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * List active tickets with optional filters.
   *
   * @param {TicketFilters} [filters] - Optional list filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Ticket[]>} Matching tickets.
   * @memberof TicketRepository
   */
  async getTickets(filters?: TicketFilters, pagination?: ApiPaginationOptions): Promise<Ticket[]> {
    const knex = getKnex();
    let query = knex.table('ticket').select(TICKET_COLUMNS).whereNull('record_end_date');
    query = this.applyFilters(query, filters);
    query = this.applyPagination(query, pagination);

    const response = await this.connection.knex(query, Ticket);

    return response.rows;
  }

  /**
   * Count active tickets with optional filters.
   *
   * @param {TicketFilters} [filters] - Optional list filters.
   * @return {Promise<number>} Total number of matching tickets.
   * @memberof TicketRepository
   */
  async getTicketsCount(filters?: TicketFilters): Promise<number> {
    const knex = getKnex();
    let query = knex.table('ticket').whereNull('record_end_date').select(knex.raw('count(*)::integer as count'));
    query = this.applyFilters(query, filters);

    const response = await this.connection.knex(query);

    return response.rows[0]?.count ?? 0;
  }

  /**
   * Update editable fields for a ticket, including status when provided.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {UpdateTicketRequest} ticket - Partial update payload.
   * @return {Promise<Ticket>} Updated ticket record.
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof TicketRepository
   */
  async updateTicket(ticketId: string, ticket: UpdateTicketRequest): Promise<Ticket> {
    const knex = getKnex();
    const query = knex
      .table('ticket')
      .update({
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status
      })
      .where('ticket_id', ticketId)
      .whereNull('record_end_date')
      .returning(TICKET_COLUMNS);

    const response = await this.connection.knex(query, Ticket);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update ticket record', [
        'TicketRepository->updateTicket',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete an active ticket by UUID.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<Ticket>} Deleted ticket record.
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof TicketRepository
   */
  async deleteTicket(ticketId: string): Promise<Ticket> {
    const knex = getKnex();
    const query = knex
      .table('ticket')
      .update({ record_end_date: knex.fn.now() })
      .where('ticket_id', ticketId)
      .whereNull('record_end_date')
      .returning(TICKET_COLUMNS);

    const response = await this.connection.knex(query, Ticket);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete ticket record', [
        'TicketRepository->deleteTicket',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
}
