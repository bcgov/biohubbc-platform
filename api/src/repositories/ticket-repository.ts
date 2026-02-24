import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateTicketRequest, TeamFilters, Ticket, TicketStatus, UpdateTicketRequest } from '../models/ticket';
import { TicketStatusHistory } from '../models/ticket-status-history';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const TICKET_COLUMNS = [
  'ticket_id',
  'ticket_slug',
  'title',
  'description',
  'team_id',
  'priority',
  'status'
] as const;

export class TicketRepository extends BaseRepository {
  /**
   * Insert a new ticket record.
   *
   * @param {(CreateTicketRequest & { team_id: string; ticket_slug: string })} ticket - Ticket payload to persist with resolved team ID and generated slug.
   * @return {Promise<Ticket>} The created ticket record.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TicketRepository
   */
  async insertTicket(ticket: CreateTicketRequest & { team_id: string; ticket_slug: string }): Promise<Ticket> {
    const knex = getKnex();
    const query = knex
      .table('ticket')
      .insert({
        title: ticket.title,
        description: ticket.description ?? null,
        team_id: ticket.team_id,
        ticket_slug: ticket.ticket_slug,
        priority: ticket.priority ?? 'MEDIUM'
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
   * List active tickets for a team with an optional status filter.
   *
   * @param {string} teamId - Team UUID filter. Pass an empty string to query all teams.
   * @param {TeamFilters} [filters] - Optional list filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Ticket[]>} Matching tickets.
   * @memberof TicketRepository
   */
  async getTicketsByTeamId(teamId: string, filters?: TeamFilters, pagination?: ApiPaginationOptions): Promise<Ticket[]> {
    const knex = getKnex();
    let query = knex.table('ticket').select(TICKET_COLUMNS).whereNull('record_end_date');

    if (teamId) {
      query = query.andWhere('team_id', teamId);
    }

    if (filters?.status) {
      query = query.andWhere('status', filters.status);
    }

    if (!pagination?.sort || !pagination?.order) {
      query = query.orderBy('create_date', 'desc');
    }

    query = this.applyPagination(query, pagination);

    const response = await this.connection.knex(query, Ticket);

    return response.rows;
  }

  /**
   * Count active tickets for a team with an optional status filter.
   *
   * @param {string} teamId - Team UUID filter. Pass an empty string to query all teams.
   * @param {TeamFilters} [filters] - Optional list filters.
   * @return {Promise<number>} Total number of matching tickets.
   * @memberof TicketRepository
   */
  async getTicketsByTeamIdCount(teamId: string, filters?: TeamFilters): Promise<number> {
    const knex = getKnex();
    let query = knex.table('ticket').whereNull('record_end_date').select(knex.raw('count(*)::integer as count'));

    if (teamId) {
      query = query.andWhere('team_id', teamId);
    }

    if (filters?.status) {
      query = query.andWhere('status', filters.status);
    }

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
        title: ticket.title,
        description: ticket.description !== undefined ? ticket.description : undefined,
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
   * Insert an immutable status history entry for a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {TicketStatus} status - Status value to record.
   * @return {Promise<TicketStatusHistory>} Created status history row.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof TicketRepository
   */
  async insertTicketStatusHistory(ticketId: string, status: TicketStatus): Promise<TicketStatusHistory> {
    const sqlStatement = SQL`
      INSERT INTO ticket_status_history (
        ticket_id,
        status
      ) VALUES (
        ${ticketId},
        ${status}
      )
      RETURNING
        ticket_status_history_id,
        ticket_id,
        status;
    `;

    const response = await this.connection.sql(sqlStatement, TicketStatusHistory);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert ticket status history', [
        'TicketRepository->insertTicketStatusHistory',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get ticket status history entries ordered newest first.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<TicketStatusHistory[]>} Status history rows.
   * @memberof TicketRepository
   */
  async getTicketStatusHistory(ticketId: string): Promise<TicketStatusHistory[]> {
    const sqlStatement = SQL`
      SELECT
        ticket_status_history_id,
        ticket_id,
        status
      FROM ticket_status_history
      WHERE ticket_id = ${ticketId}
      ORDER BY create_date DESC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketStatusHistory);

    return response.rows;
  }
}
