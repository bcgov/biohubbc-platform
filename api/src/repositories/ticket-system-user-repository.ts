import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateTicketSystemUser,
  TicketSystemUser,
  TicketSystemUserWithUser,
  UpdateTicketSystemUserStatus
} from '../models/ticket-system-user';
import { BaseRepository } from './base-repository';

const TICKET_SYSTEM_USER_COLUMNS = ['ticket_system_user_id', 'ticket_id', 'system_user_id', 'status'] as const;

export class TicketSystemUserRepository extends BaseRepository {
  async insertTicketSystemUser(ticketSystemUser: CreateTicketSystemUser): Promise<TicketSystemUser> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .insert({
        ticket_id: ticketSystemUser.ticket_id,
        system_user_id: ticketSystemUser.system_user_id,
        status: ticketSystemUser.status
      })
      .returning(TICKET_SYSTEM_USER_COLUMNS);

    const response = await this.connection.knex(query, TicketSystemUser);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert ticket system user', [
        'TicketSystemUserRepository->insertTicketSystemUser',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  async getActiveTicketSystemUserByTicketAndSystemUser(
    ticketId: string,
    systemUserId: number
  ): Promise<TicketSystemUser | null> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .select(TICKET_SYSTEM_USER_COLUMNS)
      .where('ticket_id', ticketId)
      .andWhere('system_user_id', systemUserId)
      .whereNull('record_end_date')
      .first();

    const response = await this.connection.knex(query, TicketSystemUser);

    return response.rows[0] ?? null;
  }

  async getActiveTicketSystemUserById(ticketId: string, ticketSystemUserId: string): Promise<TicketSystemUser | null> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .select(TICKET_SYSTEM_USER_COLUMNS)
      .where('ticket_id', ticketId)
      .andWhere('ticket_system_user_id', ticketSystemUserId)
      .whereNull('record_end_date')
      .first();

    const response = await this.connection.knex(query, TicketSystemUser);

    return response.rows[0] ?? null;
  }

  async updateTicketSystemUserStatus(
    ticketId: string,
    ticketSystemUserId: string,
    update: UpdateTicketSystemUserStatus
  ): Promise<TicketSystemUser> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .update({
        status: update.status
      })
      .where('ticket_id', ticketId)
      .andWhere('ticket_system_user_id', ticketSystemUserId)
      .whereNull('record_end_date')
      .returning(TICKET_SYSTEM_USER_COLUMNS);

    const response = await this.connection.knex(query, TicketSystemUser);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update ticket system user', [
        'TicketSystemUserRepository->updateTicketSystemUserStatus',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  async softDeleteTicketSystemUser(ticketId: string, ticketSystemUserId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('ticket_id', ticketId)
      .andWhere('ticket_system_user_id', ticketSystemUserId)
      .whereNull('record_end_date')
      .returning(['ticket_system_user_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete ticket system user', [
        'TicketSystemUserRepository->softDeleteTicketSystemUser',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }

  async getActiveTicketSystemUsersByTicketId(ticketId: string): Promise<TicketSystemUserWithUser[]> {
    const knex = getKnex();
    const query = knex
      .table('ticket_system_user as tsu')
      .select([
        'tsu.ticket_system_user_id',
        'tsu.ticket_id',
        'tsu.system_user_id',
        'tsu.status',
        knex.raw(
          `json_build_object(
            'system_user_id', su.system_user_id,
            'display_name', su.display_name,
            'user_identifier', su.user_identifier,
            'email', su.email
          ) as system_user`
        )
      ])
      .innerJoin('system_user as su', 'su.system_user_id', 'tsu.system_user_id')
      .where('tsu.ticket_id', ticketId)
      .whereNull('tsu.record_end_date')
      .orderByRaw('COALESCE(su.display_name, su.user_identifier) ASC');

    const response = await this.connection.knex(query, TicketSystemUserWithUser);

    return response.rows;
  }
}
