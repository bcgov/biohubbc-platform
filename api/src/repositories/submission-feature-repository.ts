import SQL, { SQLStatement } from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { SubmissionFeatureProperty } from '../models/feature-property';
import { SubmissionFeaturePropertyFilters, SubmissionFeatureSignedUrlPayload } from '../models/submission-feature';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { RelatedSubmissionFeature, SubmissionFeature, SubmissionFeatureRecord } from './submission-repository';

/**
 * Repository class for submission-feature specific queries.
 *
 * @export
 * @class SubmissionFeatureRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureRepository extends BaseRepository {
  /**
   * Set record_effective_date for active features from a submission upload.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureRepository
   */
  async setRecordEffectiveDateBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        submission_feature
      SET
        record_effective_date = now()
      WHERE
        submission_upload_id = ${submissionUploadId}
      AND
        record_effective_date IS NULL
      AND
        record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Get a submission feature record by uuid.
   *
   * @param {string} submissionUuid
   * @returns {Promise<SubmissionFeatureRecord>}
   * @memberof SubmissionFeatureRepository
   */
  async getSubmissionFeatureByUuid(submissionUuid: string): Promise<SubmissionFeatureRecord> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission_feature
      WHERE
        uuid = ${submissionUuid};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission feature record', [
        'SubmissionFeatureRepository->getSubmissionFeatureByUuid',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission feature record by Id.
   *
   * @param {number} submissionFeatureId
   * @returns {Promise<SubmissionFeature>}
   * @memberof SubmissionFeatureRepository
   */
  async getSubmissionFeatureById(submissionFeatureId: number): Promise<SubmissionFeature> {
    const sqlStatement = SQL`
      SELECT
        sf.submission_feature_id,
        sf.uuid,
        sf.urn,
        sf.submission_id,
        sf.feature_type_id,
        sf.source_id,
        sf.data,
        ft.name as feature_type_name,
        ft.display_name as feature_type_display_name,
        s.name as submission_name,
        EXISTS (
          SELECT 1
          FROM submission_feature_security sfs
          WHERE sfs.submission_feature_id = sf.submission_feature_id
            AND sfs.record_end_date IS NULL
        ) AS secured
      FROM
        submission_feature sf
      JOIN
        feature_type ft ON ft.feature_type_id = sf.feature_type_id
      JOIN
        submission s ON s.submission_id = sf.submission_id
      WHERE
        sf.submission_feature_id = ${submissionFeatureId};
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeature);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission feature record', [
        'SubmissionFeatureRepository->getSubmissionFeatureById',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all related submission features with their type names.
   *
   * @param {number} submissionFeatureId
   * @returns {Promise<RelatedSubmissionFeature[]>}
   * @memberof SubmissionFeatureRepository
   */
  async getRelatedSubmissionFeatures(submissionFeatureId: number): Promise<RelatedSubmissionFeature[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT
        sf.submission_feature_id,
        ft.name as feature_type_name,
        ft.display_name as feature_type_display_name,
        sf.data
      FROM submission_feature sf
      JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
      WHERE sf.submission_feature_id IN (
        SELECT source_feature_id FROM submission_feature_feature
        WHERE target_feature_id = ${submissionFeatureId}
        UNION
        SELECT target_feature_id FROM submission_feature_feature
        WHERE source_feature_id = ${submissionFeatureId}
      );
    `;

    const response = await this.connection.sql(sqlStatement, RelatedSubmissionFeature);
    return response.rows;
  }

  /**
   * Get paginated and sorted properties for a single submission feature.
   *
   * @param {number} submissionFeatureId
   * @param {ApiPaginationOptions} pagination
   * @param {SubmissionFeaturePropertyFilters} [filters]
   * @returns {Promise<SubmissionFeatureProperty[]>}
   * @memberof SubmissionFeatureRepository
   */
  async getSubmissionFeatureProperties(
    submissionFeatureId: number,
    pagination: ApiPaginationOptions,
    filters?: SubmissionFeaturePropertyFilters
  ): Promise<SubmissionFeatureProperty[]> {
    const knex = getKnex();
    const normalizedSearch = filters?.search?.trim().toLowerCase();

    const sortColumnMap: Record<string, 'id' | 'property' | 'value'> = {
      id: 'id',
      property: 'property',
      value: 'value'
    };

    const requestedSort = pagination.sort ? sortColumnMap[pagination.sort] : undefined;
    const resolvedSort = requestedSort ?? 'property';
    const resolvedOrder = pagination.order === 'desc' ? 'desc' : 'asc';

    const queryBuilder = knex('submission_feature as sf')
      .where('sf.submission_feature_id', submissionFeatureId)
      .crossJoin(knex.raw(`LATERAL jsonb_each_text(COALESCE(sf.data, '{}'::jsonb)) AS prop(key, value)`))
      .select([
        knex.raw('prop.key AS id'),
        knex.raw(`REPLACE(prop.key, '_', ' ') AS property`),
        knex.raw('prop.value AS value')
      ]);

    if (normalizedSearch) {
      queryBuilder.andWhere(function () {
        this.whereRaw(`LOWER(REPLACE(prop.key, '_', ' ')) LIKE ?`, [`%${normalizedSearch}%`]).orWhereRaw(
          `LOWER(prop.value) LIKE ?`,
          [`%${normalizedSearch}%`]
        );
      });
    }

    this.applyPagination(queryBuilder, {
      ...pagination,
      sort: resolvedSort,
      order: resolvedOrder
    });

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureProperty);

    return response.rows;
  }

  /**
   * Count properties for a single submission feature with optional server-side search.
   *
   * @param {number} submissionFeatureId
   * @param {SubmissionFeaturePropertyFilters} [filters]
   * @returns {Promise<number>}
   * @memberof SubmissionFeatureRepository
   */
  async getSubmissionFeaturePropertiesCount(
    submissionFeatureId: number,
    filters?: SubmissionFeaturePropertyFilters
  ): Promise<number> {
    const normalizedSearch = filters?.search?.trim().toLowerCase();
    const sqlStatement = this._getSubmissionFeaturePropertiesCountQuery(submissionFeatureId, normalizedSearch);
    const response = await this.connection.sql(sqlStatement, z.object({ count: z.number() }));

    if (!response.rowCount) {
      return 0;
    }

    return response.rows[0].count;
  }

  /**
   * Retrieves submission feature (artifact) key from data column key value pair.
   * Checks submission feature is not secure.
   *
   * @async
   * @param {SubmissionFeatureSignedUrlPayload} payload
   * @returns {Promise<string>}
   * @memberof SubmissionFeatureRepository
   */
  async getSubmissionFeatureArtifactKey(payload: SubmissionFeatureSignedUrlPayload): Promise<string> {
    const sqlStatement = SQL`
    SELECT ss.value
    FROM search_string ss
    INNER JOIN feature_property fp
    ON ss.feature_property_id = fp.feature_property_id
    WHERE ss.submission_feature_id = ${payload.submissionFeatureId}
    AND NOT EXISTS (
      SELECT NULL
      FROM submission_feature_security sfs
      WHERE sfs.submission_feature_id = ss.submission_feature_id
    )
    AND ss.value = ${payload.submissionFeatureObj.value}
    AND fp.name = ${payload.submissionFeatureObj.key}
    RETURNING ss.value;`;

    const response = await this.connection.sql(sqlStatement, z.object({ value: z.string() }));

    if (response.rowCount === 0 || !response.rows[0]?.value) {
      throw new ApiExecuteSQLError('Failed to get key for signed URL', [
        `submissionFeature is secure or matching key value pair does not exist for submissionFeatureId: ${payload.submissionFeatureId}`,
        'SubmissionFeatureRepository->getSubmissionFeatureArtifactKey'
      ]);
    }

    return response.rows[0].value;
  }

  /**
   * Retrieves submission feature (artifact) key from data column key value pair. Skips security checks.
   *
   * @async
   * @param {SubmissionFeatureSignedUrlPayload} payload
   * @returns {Promise<string>}
   * @memberof SubmissionFeatureRepository
   */
  async getAdminSubmissionFeatureArtifactKey(payload: SubmissionFeatureSignedUrlPayload): Promise<string> {
    const sqlStatement = SQL`
    SELECT ss.value
    FROM search_string ss
    INNER JOIN feature_property fp
    ON ss.feature_property_id = fp.feature_property_id
    WHERE ss.submission_feature_id = ${payload.submissionFeatureId}
    AND ss.value = ${payload.submissionFeatureObj.value}
    AND fp.name = ${payload.submissionFeatureObj.key};`;

    const response = await this.connection.sql(sqlStatement, z.object({ value: z.string() }));

    if (response.rowCount === 0 || !response.rows[0]?.value) {
      throw new ApiExecuteSQLError('Failed to get key for signed URL', [
        `matching key value pair does not exist for submissionFeatureId: ${payload.submissionFeatureId}`,
        'SubmissionFeatureRepository->getAdminSubmissionFeatureArtifactKey'
      ]);
    }

    return response.rows[0].value;
  }

  /**
   * Build SQL to count submission feature properties with optional normalized search.
   *
   * @param {number} submissionFeatureId
   * @param {string} [normalizedSearch]
   * @returns {SQLStatement}
   * @memberof SubmissionFeatureRepository
   */
  private _getSubmissionFeaturePropertiesCountQuery(
    submissionFeatureId: number,
    normalizedSearch?: string
  ): SQLStatement {
    const sqlStatement = SQL`
      SELECT COUNT(*)::int AS count
      FROM submission_feature sf
      CROSS JOIN LATERAL jsonb_each_text(COALESCE(sf.data, '{}'::jsonb)) AS prop(key, value)
      WHERE sf.submission_feature_id = ${submissionFeatureId}
    `;

    if (normalizedSearch) {
      sqlStatement.append(SQL`
        AND (
          LOWER(REPLACE(prop.key, '_', ' ')) LIKE ${`%${normalizedSearch}%`}
          OR LOWER(prop.value) LIKE ${`%${normalizedSearch}%`}
        )
      `);
    }

    return sqlStatement;
  }
}
