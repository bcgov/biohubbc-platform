import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  AdministrativeContributorSystemUser,
  ContributorSystemUser,
  ContributorSystemUserFilters,
  ContributorSystemUserInput
} from '../models/contributor-system-user';
import { CountResult } from '../models/count';
import { SystemUser } from '../models/system-user';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * Contributor-system-user repository class.
 *
 * @export
 * @class ContributorSystemUserRepository
 * @extends {BaseRepository}
 */
export class ContributorSystemUserRepository extends BaseRepository {
  /**
   * Find the active contributor-system-user relationship for a system user.
   *
   * @param {number} systemUserId
   * @return {(Promise<ContributorSystemUser | null>)}
   * @memberof ContributorSystemUserRepository
   */
  async findContributorSystemUser(systemUserId: number): Promise<ContributorSystemUser | null> {
    const sql = SQL`
      SELECT contributor_system_user_id, contributor_id, system_user_id
      FROM contributor_system_user
      WHERE system_user_id = ${systemUserId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, ContributorSystemUser);

    if (response.rowCount === 0) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ContributorSystemUserRepository->findContributorSystemUser',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Create a contributor-system-user relationship.
   *
   * @param {number} contributorId
   * @param {number} systemUserId
   * @return {Promise<void>}
   * @memberof ContributorSystemUserRepository
   */
  async createContributorSystemUser(contributorId: number, systemUserId: number): Promise<void> {
    const sql = SQL`
      INSERT INTO contributor_system_user (contributor_id, system_user_id)
      VALUES (${contributorId}, ${systemUserId});
    `;

    await this.connection.sql(sql);
  }

  /**
   * List administrative contributorsystemusers, including historical rows.
   * @param filters - Domain filters.
   * @param pagination - Bounded pagination and sorting.
   * @returns Matching page of records.
   */
  async listAdministrativeContributorSystemUsers(
    filters: ContributorSystemUserFilters,
    pagination: ApiPaginationOptions
  ): Promise<AdministrativeContributorSystemUser[]> {
    const knex = getKnex();
    const query = knex('contributor_system_user as c')
      .join('contributor', 'contributor.contributor_id', 'c.contributor_id')
      .join('system_user as su', 'su.system_user_id', 'c.system_user_id')
      .select(
        'c.contributor_system_user_id',
        'c.contributor_id',
        'c.system_user_id',
        'contributor.client_id',
        'su.user_identifier',
        'su.display_name',
        'c.record_end_date'
      );
    if (filters.keyword) {
      query.where((builder) => {
        builder
          .whereILike('contributor.client_id', `%${filters.keyword}%`)
          .orWhereILike('su.user_identifier', `%${filters.keyword}%`)
          .orWhereILike('su.display_name', `%${filters.keyword}%`);
      });
    }
    if (filters.activeOnly) {
      query.whereNull('c.record_end_date');
    }
    if (filters.contributorId !== undefined) {
      query.where('c.contributor_id', filters.contributorId);
    }
    const columns: Record<string, string> = {
      contributor_system_user_id: 'c.contributor_system_user_id',
      client_id: 'contributor.client_id',
      user_identifier: 'su.user_identifier',
      record_end_date: 'c.record_end_date'
    };
    query.orderBy(columns[pagination.sort ?? ''] ?? 'c.contributor_system_user_id', pagination.order ?? 'asc');
    query
      .orderBy('c.contributor_system_user_id', 'asc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);
    const response = await this.connection.knex(query, AdministrativeContributorSystemUser);
    return response.rows;
  }

  /**
   * Count records matching the administrative filters.
   * @param filters - Domain filters.
   * @returns Total matching records.
   */
  async countAdministrativeContributorSystemUsers(filters: ContributorSystemUserFilters): Promise<number> {
    const knex = getKnex();
    const query = knex('contributor_system_user as c')
      .join('contributor', 'contributor.contributor_id', 'c.contributor_id')
      .join('system_user as su', 'su.system_user_id', 'c.system_user_id')
      .select(knex.raw('count(*)::integer as count'));
    if (filters.keyword) {
      query.where((builder) => {
        builder
          .whereILike('contributor.client_id', `%${filters.keyword}%`)
          .orWhereILike('su.user_identifier', `%${filters.keyword}%`)
          .orWhereILike('su.display_name', `%${filters.keyword}%`);
      });
    }
    if (filters.activeOnly) {
      query.whereNull('c.record_end_date');
    }
    if (filters.contributorId !== undefined) {
      query.where('c.contributor_id', filters.contributorId);
    }
    const response = await this.connection.knex(query, CountResult);
    return response.rows[0].count;
  }

  /**
   * Read and lock an administrative record for the current transaction.
   * @param id - Record identifier.
   * @returns Record, or undefined when absent.
   */
  async getAdministrativeContributorSystemUser(id: number): Promise<AdministrativeContributorSystemUser | undefined> {
    const knex = getKnex();
    const query = knex('contributor_system_user as c')
      .join('contributor', 'contributor.contributor_id', 'c.contributor_id')
      .join('system_user as su', 'su.system_user_id', 'c.system_user_id')
      .select(
        'c.contributor_system_user_id',
        'c.contributor_id',
        'c.system_user_id',
        'contributor.client_id',
        'su.user_identifier',
        'su.display_name',
        'c.record_end_date'
      )
      .where('c.contributor_system_user_id', id)
      .forUpdate('c');
    const response = await this.connection.knex(query, AdministrativeContributorSystemUser);
    return response.rows[0];
  }

  /**
   * Insert an active administrative record.
   * @param input - Fields to persist.
   * @returns Created identifier.
   */
  async insertAdministrativeContributorSystemUser(input: ContributorSystemUserInput): Promise<number> {
    const knex = getKnex();
    const query = knex('contributor_system_user')
      .insert({ contributor_id: input.contributorId, system_user_id: input.systemUserId })
      .returning('contributor_system_user_id');
    const response = await this.connection.knex(
      query,
      ContributorSystemUser.pick({ contributor_system_user_id: true })
    );
    return response.rows[0].contributor_system_user_id;
  }

  /**
   * End an active record without changing an existing end date.
   * @param id - Record identifier.
   * @returns Completion of the deletion.
   */
  async deleteAdministrativeContributorSystemUser(id: number): Promise<void> {
    const knex = getKnex();
    const query = knex('contributor_system_user')
      .where('contributor_system_user_id', id)
      .whereNull('record_end_date')
      .update({ record_end_date: knex.fn.now() });
    await this.connection.knex(query);
  }

  /**
   * End all active relationships belonging to a contributor.
   * @param contributorId - Contributor being deleted.
   * @returns Completion without materializing affected rows.
   */
  async deleteContributorSystemUsers(contributorId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('contributor_system_user')
      .where('contributor_id', contributorId)
      .whereNull('record_end_date')
      .update({ record_end_date: knex.fn.now() });
    await this.connection.knex(query);
  }

  /**
   * Lock a selected user and read its eligibility for assignment.
   * @param systemUserId - Selected user identifier.
   * @returns Whether the user exists and is active.
   */
  async lockActiveSystemUser(systemUserId: number): Promise<boolean> {
    const knex = getKnex();
    const query = knex('system_user')
      .select('system_user_id')
      .where('system_user_id', systemUserId)
      .whereNull('record_end_date')
      .forUpdate();
    const response = await this.connection.knex(query, SystemUser.pick({ system_user_id: true }));
    return response.rowCount === 1;
  }
}
