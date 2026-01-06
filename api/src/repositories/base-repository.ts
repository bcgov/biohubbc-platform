import { Knex } from 'knex';
import { IDBConnection } from '../database/db';
import { ApiPaginationOptions } from '../zod-schema/pagination';

/**
 * Base class for repositories.
 *
 * @export
 * @class BaseRepository
 */
export class BaseRepository {
  connection: IDBConnection;

  constructor(connection: IDBConnection) {
    this.connection = connection;
  }

  /**
   * Apply pagination + sorting to a Knex query.
   *
   * @param {Knex.QueryBuilder} query
   * @param {ApiPaginationOptions} pagination
   * @memberof SubmissionRepository
   */
  applyPagination(query: Knex.QueryBuilder, pagination?: ApiPaginationOptions) {
    if (!pagination) {
      return query;
    }

    if (pagination.limit) {
      query.limit(pagination.limit);
    }

    if (pagination.page && pagination.limit) {
      query.offset((pagination.page - 1) * pagination.limit);
    }

    if (pagination.sort && pagination.order) {
      query.orderBy(pagination.sort, pagination.order);
    }

    return query;
  }
}
