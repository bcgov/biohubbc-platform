import { Knex } from 'knex';
import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { TicketArtifact } from '../models/ticket-artifact';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

export interface TicketArtifactFilters {
  search?: string;
}

/**
 * Repository for ticket attachment links.
 */
export class TicketArtifactRepository extends BaseRepository {
  /**
   * Build the base active ticket artifact query.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Knex.QueryBuilder}
   * @memberof TicketArtifactRepository
   */
  private getTicketArtifactsBaseQuery(ticketId: string, filters?: TicketArtifactFilters): Knex.QueryBuilder {
    const knex = getKnex();

    const query = knex
      .table('ticket_artifact as ta')
      .select([
        'ta.ticket_artifact_id',
        'ta.ticket_id',
        'ta.artifact_id',
        'ta.record_end_date',
        'ta.create_date',
        'a.object_key'
      ])
      .join('artifact as a', 'a.artifact_id', 'ta.artifact_id')
      .where('ta.ticket_id', ticketId)
      .whereNull('ta.record_end_date');

    return this.applyTicketArtifactFilters(query, filters);
  }

  /**
   * Apply supported ticket artifact list filters.
   *
   * @param {Knex.QueryBuilder} query - Base ticket artifact query.
   * @param {TicketArtifactFilters} [filters] - Optional filter set.
   * @returns {Knex.QueryBuilder} Filtered query.
   * @memberof TicketArtifactRepository
   */
  private applyTicketArtifactFilters(query: Knex.QueryBuilder, filters?: TicketArtifactFilters): Knex.QueryBuilder {
    const search = filters?.search?.trim();

    if (search) {
      query.where((builder) => {
        builder
          .whereILike('a.object_key', `%${search}%`)
          .orWhereRaw('ta.ticket_artifact_id::text ILIKE ?', [`%${search}%`]);
      });
    }

    return query;
  }

  /**
   * Apply pagination and supported sorting to a ticket artifact query.
   *
   * @param {Knex.QueryBuilder} query
   * @param {ApiPaginationOptions} [pagination]
   * @returns {Knex.QueryBuilder}
   * @memberof TicketArtifactRepository
   */
  private applyTicketArtifactPagination(
    query: Knex.QueryBuilder,
    pagination?: ApiPaginationOptions
  ): Knex.QueryBuilder {
    if (!pagination) {
      return query.orderBy('ta.create_date', 'asc');
    }

    if (pagination.limit) {
      query.limit(pagination.limit);
    }

    if (pagination.page && pagination.limit) {
      query.offset((pagination.page - 1) * pagination.limit);
    }

    const sortColumns: Record<string, string> = {
      ticket_artifact_id: 'ta.ticket_artifact_id',
      object_key: 'a.object_key',
      create_date: 'ta.create_date'
    };

    if (pagination.sort && pagination.order && sortColumns[pagination.sort]) {
      query.orderBy(sortColumns[pagination.sort], pagination.order);
    } else {
      query.orderBy('ta.create_date', 'asc');
    }

    return query;
  }

  /**
   * Insert active ticket attachment associations.
   *
   * @param {string} ticketId - Owning ticket UUID.
   * @param {string[]} artifactIds - Underlying artifact UUIDs to attach.
   * @returns {Promise<TicketArtifact[]>} Active ticket attachments for the requested artifacts.
   * @memberof TicketArtifactRepository
   */
  async insertTicketArtifacts(ticketId: string, artifactIds: string[]): Promise<TicketArtifact[]> {
    if (!artifactIds.length) {
      return [];
    }

    const sqlStatement = SQL`
      WITH input_artifacts AS (
        SELECT DISTINCT artifact_id
        FROM UNNEST(${artifactIds}::uuid[]) AS t(artifact_id)
      ),
      -- Keep inserted rows available to the final result.
      inserted AS (
        INSERT INTO ticket_artifact (
          ticket_id,
          artifact_id
        )
        SELECT
          ${ticketId}::uuid,
          input_artifacts.artifact_id
        FROM input_artifacts
        ON CONFLICT (ticket_id, artifact_id)
        WHERE record_end_date IS NULL
        DO NOTHING
        RETURNING ticket_artifact_id, ticket_id, artifact_id, record_end_date, create_date
      ),
      -- Include matching rows that were already active.
      active_ticket_artifacts AS (
        SELECT
          inserted.ticket_artifact_id,
          inserted.ticket_id,
          inserted.artifact_id,
          inserted.record_end_date,
          inserted.create_date
        FROM inserted

        UNION

        SELECT
          ta.ticket_artifact_id,
          ta.ticket_id,
          ta.artifact_id,
          ta.record_end_date,
          ta.create_date
        FROM ticket_artifact ta
        JOIN input_artifacts ia
          ON ia.artifact_id = ta.artifact_id
        WHERE ta.ticket_id = ${ticketId}
          AND ta.record_end_date IS NULL
      )
      SELECT
        ata.ticket_artifact_id,
        ata.ticket_id,
        ata.artifact_id,
        ata.record_end_date,
        ata.create_date,
        a.object_key
      FROM active_ticket_artifacts ata
      JOIN artifact a
        ON a.artifact_id = ata.artifact_id
      ORDER BY ata.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketArtifact);

    return response.rows;
  }

  /**
   * Find one active ticket attachment.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string} ticketArtifactId - Ticket artifact UUID.
   * @returns {Promise<TicketArtifact | null>} Active attachment row, or null when absent.
   * @memberof TicketArtifactRepository
   */
  async findTicketArtifactById(ticketId: string, ticketArtifactId: string): Promise<TicketArtifact | null> {
    const sqlStatement = SQL`
      SELECT
        ta.ticket_artifact_id,
        ta.ticket_id,
        ta.artifact_id,
        ta.record_end_date,
        ta.create_date,
        a.object_key
      FROM ticket_artifact ta
      JOIN artifact a
        ON a.artifact_id = ta.artifact_id
      WHERE ta.ticket_id = ${ticketId}
        AND ta.ticket_artifact_id = ${ticketArtifactId}
        AND ta.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, TicketArtifact);

    return response.rows[0] ?? null;
  }

  /**
   * List active ticket attachments.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @returns {Promise<TicketArtifact[]>} Active attachments ordered by creation time.
   * @memberof TicketArtifactRepository
   */
  async getTicketArtifacts(
    ticketId: string,
    filters?: TicketArtifactFilters,
    pagination?: ApiPaginationOptions
  ): Promise<TicketArtifact[]> {
    const query = this.applyTicketArtifactPagination(this.getTicketArtifactsBaseQuery(ticketId, filters), pagination);

    const response = await this.connection.knex(query, TicketArtifact);

    return response.rows;
  }

  /**
   * Count active ticket attachments.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<number>} Active ticket attachment count.
   * @memberof TicketArtifactRepository
   */
  async getTicketArtifactsCount(ticketId: string, filters?: TicketArtifactFilters): Promise<number> {
    const knex = getKnex();
    const query = knex
      .table('ticket_artifact as ta')
      .join('artifact as a', 'a.artifact_id', 'ta.artifact_id')
      .where('ta.ticket_id', ticketId)
      .whereNull('ta.record_end_date')
      .select(knex.raw('count(*)::integer as count'));

    this.applyTicketArtifactFilters(query, filters);

    const response = await this.connection.knex(query);

    return response.rows[0]?.count ?? 0;
  }
}
