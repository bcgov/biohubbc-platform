import SQL, { SQLStatement } from 'sql-template-strings';
import { z } from 'zod';
import { SubmissionFeatureProperty } from '../models/feature-property';
import { SubmissionFeaturePropertyFilters } from '../models/submission-feature';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { isSubmissionFeatureActive } from './sql-fragments';

/**
 * Read repository for canonical indexed properties attached to submission features.
 *
 * This intentionally spans all typed/indexed property tables. It is not CRUD for the
 * `submission_feature` table and must not read `submission_feature.data`.
 */
export class SubmissionFeaturePropertyRepository extends BaseRepository {
  /**
   * Get paginated and sorted indexed properties for a single submission feature.
   *
   * @param {number} submissionFeatureId
   * @param {ApiPaginationOptions} pagination
   * @param {SubmissionFeaturePropertyFilters} [filters]
   * @returns {Promise<SubmissionFeatureProperty[]>}
   * @memberof SubmissionFeaturePropertyRepository
   */
  async getSubmissionFeatureProperties(
    submissionFeatureId: number,
    pagination: ApiPaginationOptions,
    filters?: SubmissionFeaturePropertyFilters
  ): Promise<SubmissionFeatureProperty[]> {
    const normalizedSearch = filters?.search?.trim().toLowerCase();
    const sqlStatement = this._getSubmissionFeaturePropertiesQuery(submissionFeatureId, normalizedSearch, pagination);
    const response = await this.connection.sql(sqlStatement, SubmissionFeatureProperty);

    return response.rows;
  }

  /**
   * Count indexed properties for a single submission feature with optional server-side search.
   *
   * @param {number} submissionFeatureId
   * @param {SubmissionFeaturePropertyFilters} [filters]
   * @returns {Promise<number>}
   * @memberof SubmissionFeaturePropertyRepository
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
   * Build the count query for `getSubmissionFeaturePropertiesCount`.
   *
   * This reuses the same active-feature and indexed-property union CTE as the list query so count
   * semantics stay aligned with the paginated result set.
   *
   * @param {number} submissionFeatureId The submission feature whose indexed properties are being counted.
   * @param {string} [normalizedSearch] Optional trimmed/lowercase search term to apply to property names and values.
   * @returns {SQLStatement} SQL statement that returns a single integer `count` row.
   * @memberof SubmissionFeaturePropertyRepository
   */
  private _getSubmissionFeaturePropertiesCountQuery(
    submissionFeatureId: number,
    normalizedSearch?: string
  ): SQLStatement {
    const sqlStatement = this._getSubmissionFeaturePropertiesBaseQuery(submissionFeatureId, normalizedSearch);
    sqlStatement.append(`
      SELECT COUNT(*)::int AS count
      FROM filtered_property_rows;
    `);

    return sqlStatement;
  }

  /**
   * Build the paginated list query for `getSubmissionFeatureProperties`.
   *
   * Sort columns are constrained to the projected read-model fields before being appended as raw SQL.
   * When no public sort is requested, the feature-type-property `sort` column drives the default order.
   * Limit and offset remain parameterized.
   *
   * @param {number} submissionFeatureId The submission feature whose indexed properties are being listed.
   * @param {string | undefined} normalizedSearch Optional trimmed/lowercase search term to apply to property names and values.
   * @param {ApiPaginationOptions} pagination Pagination and sort options from the request.
   * @returns {SQLStatement} SQL statement that returns `id`, `property`, and `value` rows.
   * @memberof SubmissionFeaturePropertyRepository
   */
  private _getSubmissionFeaturePropertiesQuery(
    submissionFeatureId: number,
    normalizedSearch: string | undefined,
    pagination: ApiPaginationOptions
  ): SQLStatement {
    const sqlStatement = this._getSubmissionFeaturePropertiesBaseQuery(submissionFeatureId, normalizedSearch);
    sqlStatement.append(`
      SELECT id, property, value
      FROM filtered_property_rows
    `);
    this.applySortingAndPagination(sqlStatement, pagination);

    return sqlStatement;
  }

  /**
   * Append sorting and pagination to the submission-feature property list query.
   *
   * Public sort requests may only target returned fields. The internal `sort`
   * column from `feature_type_property` is reserved for the default display order.
   *
   * @param {SQLStatement} sqlStatement Query being built.
   * @param {ApiPaginationOptions} pagination Pagination and sort options from the request.
   */
  private applySortingAndPagination(sqlStatement: SQLStatement, pagination: ApiPaginationOptions): void {
    const publicSortColumn =
      pagination.sort === 'id' || pagination.sort === 'property' || pagination.sort === 'value'
        ? pagination.sort
        : undefined;
    const resolvedOrder = pagination.order === 'desc' ? 'desc' : 'asc';
    const limit = pagination.limit ?? 25;
    const page = pagination.page ?? 1;
    const offset = (page - 1) * limit;
    // Reference-typed values are structured JSON, so search and sort operate on the derived
    // `value_text` label rather than the raw `value` column.
    const sortColumnExpression = publicSortColumn === 'value' ? 'value_text' : publicSortColumn;
    const primaryOrderBy = sortColumnExpression
      ? `${sortColumnExpression} ${resolvedOrder}`
      : `sort ${resolvedOrder} NULLS LAST`;

    sqlStatement.append(`ORDER BY ${primaryOrderBy}, property ASC, value_text ASC, id ASC LIMIT `);
    sqlStatement.append(SQL`${limit}`);
    sqlStatement.append(` OFFSET `);
    sqlStatement.append(SQL`${offset}`);
    sqlStatement.append(`;`);
  }

  /**
   * Build the shared active-feature and indexed-property CTEs used by the list and count queries.
   *
   * This is the only source of property values for this read path: it unions the typed/indexed property
   * tables and artifact links, filters the root feature and feature-valued references to active
   * `submission_feature` records, and intentionally does not read `submission_feature.data`.
   *
   * @param {number} submissionFeatureId The submission feature whose canonical indexed properties are being read.
   * @param {string} [normalizedSearch] Optional trimmed/lowercase search term to apply to property names and values.
   * @returns {SQLStatement} SQL statement prefix ending at the `filtered_property_rows` CTE.
   * @memberof SubmissionFeaturePropertyRepository
   */
  private _getSubmissionFeaturePropertiesBaseQuery(
    submissionFeatureId: number,
    normalizedSearch?: string
  ): SQLStatement {
    const sqlStatement = SQL``;

    sqlStatement.append(`
      WITH active_feature AS (
        SELECT sf.submission_feature_id, sf.feature_type_id
        FROM submission_feature sf
        WHERE sf.submission_feature_id = `);
    sqlStatement.append(SQL`${submissionFeatureId}`);
    sqlStatement.append(`
          AND ${isSubmissionFeatureActive('sf')}
      ),
      property_rows AS (
        SELECT
          'string:' || p.submission_feature_property_string_id::text AS id,
          fp.display_name AS property,
          to_jsonb(p.value::text) AS value,
          ftp.sort
        FROM submission_feature_property_string p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL

        UNION ALL

        SELECT
          'number:' || p.submission_feature_property_number_id::text AS id,
          fp.display_name AS property,
          to_jsonb(p.value::text) AS value,
          ftp.sort
        FROM submission_feature_property_number p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL

        UNION ALL

        SELECT
          'boolean:' || p.submission_feature_property_boolean_id::text AS id,
          fp.display_name AS property,
          to_jsonb(p.value::text) AS value,
          ftp.sort
        FROM submission_feature_property_boolean p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL

        UNION ALL

        SELECT
          'timestamp:' || p.submission_feature_property_timestamp_id::text AS id,
          fp.display_name AS property,
          to_jsonb(COALESCE(
            CASE
              WHEN p.date_value IS NOT NULL AND p.time_value IS NOT NULL
                THEN to_char(p.date_value, 'YYYY-MM-DD') || 'T' || to_char(p.time_value, 'HH24:MI:SS')
              WHEN p.date_value IS NOT NULL THEN to_char(p.date_value, 'YYYY-MM-DD')
              ELSE to_char(p.time_value, 'HH24:MI:SS')
            END,
            ''
          )) AS value,
          ftp.sort
        FROM submission_feature_property_timestamp p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL

        UNION ALL

        SELECT
          'code:' || p.submission_feature_property_code_id::text AS id,
          fp.display_name AS property,
          jsonb_build_object(
            'codeset_key', cs.key,
            'codeset_label', cs.label,
            'code_key', ccc.key,
            'code_label', ccc.label,
            'label', ccc.label
          ) AS value,
          ftp.sort
        FROM submission_feature_property_code p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL
        JOIN contributor_codeset_code ccc
          ON ccc.contributor_codeset_code_id = p.contributor_codeset_code_id
         AND ccc.record_end_date IS NULL
        JOIN contributor_codeset cs
          ON cs.contributor_codeset_id = ccc.contributor_codeset_id

        UNION ALL

        SELECT
          'taxon:' || p.submission_feature_property_taxon_id::text AS id,
          fp.display_name AS property,
          jsonb_build_object(
            'taxon_id', t.taxon_id,
            'tsn', t.itis_tsn,
            'rank', t.rank,
            'label', COALESCE(t.itis_scientific_name, t.common_name, t.bc_taxon_code, t.itis_tsn::text)
          ) AS value,
          ftp.sort
        FROM submission_feature_property_taxon p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL
        JOIN taxon t
          ON t.taxon_id = p.taxon_id
         AND t.record_end_date IS NULL

        UNION ALL

        SELECT
          'geometry:' || p.submission_feature_property_geometry_id::text AS id,
          fp.display_name AS property,
          to_jsonb(public.ST_AsGeoJSON(p.value)::text) AS value,
          ftp.sort
        FROM submission_feature_property_geometry p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL

        UNION ALL

        SELECT
          'feature:' || p.submission_feature_property_feature_id::text AS id,
          fp.display_name AS property,
          jsonb_build_object(
            'urn', referenced_sf.urn,
            'label', referenced_sf.urn
          ) AS value,
          ftp.sort
        FROM submission_feature_property_feature p
        JOIN active_feature sf ON sf.submission_feature_id = p.submission_feature_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = p.feature_type_property_id
         AND ftp.feature_type_id = sf.feature_type_id
         AND ftp.record_end_date IS NULL
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
         AND fp.record_end_date IS NULL
        JOIN submission_feature referenced_sf
          ON referenced_sf.submission_feature_id = p.referenced_submission_feature_id
         AND ${isSubmissionFeatureActive('referenced_sf')}

        UNION ALL

        SELECT
          'artifact_key:' || sfa.submission_feature_artifact_id::text AS id,
          fp.display_name AS property,
          to_jsonb(a.object_key::text) AS value,
          ftp.sort
        FROM submission_feature_artifact sfa
        JOIN active_feature sf ON sf.submission_feature_id = sfa.submission_feature_id
        JOIN artifact a
          ON a.artifact_id = sfa.artifact_id
         AND a.artifact_status = 'uploaded'
        JOIN (
          SELECT
            ftp.feature_type_id,
            MIN(ftp.feature_type_property_id) AS feature_type_property_id
          FROM feature_type_property ftp
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
           AND fp.record_end_date IS NULL
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
           AND fpt.name = 'artifact_key'
           AND fpt.record_end_date IS NULL
          WHERE ftp.record_end_date IS NULL
          GROUP BY ftp.feature_type_id
          HAVING COUNT(*) = 1
        ) artifact_ftp
          ON artifact_ftp.feature_type_id = sf.feature_type_id
        JOIN feature_type_property ftp
          ON ftp.feature_type_property_id = artifact_ftp.feature_type_property_id
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
      ),
      filtered_property_rows AS (
        SELECT id, property, value,
          COALESCE(value->>'label', value #>> '{}') AS value_text,
          sort
        FROM property_rows
    `);

    if (normalizedSearch) {
      sqlStatement.append(SQL`
        WHERE (
          LOWER(property) LIKE ${`%${normalizedSearch}%`}
          OR LOWER(COALESCE(value->>'label', value #>> '{}')) LIKE ${`%${normalizedSearch}%`}
        )
      `);
    }

    sqlStatement.append(`
      )
    `);

    return sqlStatement;
  }
}
