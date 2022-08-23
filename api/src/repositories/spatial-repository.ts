import { Feature, FeatureCollection } from 'geojson';
import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { SYSTEM_ROLE } from '../constants/roles';
import { getKnex, getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { UserService } from '../services/user-service';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface IInsertSpatialTransform {
  name: string;
  description: string;
  notes: string;
  transform: string;
}

export interface IGetSpatialTransformRecord {
  spatial_transform_id: number;
  name: string;
  description: string | null;
  notes: string | null;
  transform: string;
}

export interface IGetSecurityTransformRecord {
  security_transform_id: number;
  name: string;
  description: string | null;
  notes: string | null;
  transform: string;
}

export interface ITransformSpatialRow {
  result_data: FeatureCollection;
}

export interface ITransformSecureRow {
  spatial_component: {
    spatial_data: FeatureCollection;
    submission_spatial_component_id: number;
  };
}

export interface ISubmissionSpatialComponent {
  submission_spatial_component_id: number;
  submission_id: number;
  spatial_component: FeatureCollection;
  geometry: null;
  geography: string;
  secured_spatial_component: FeatureCollection;
  secured_geometry: null;
  secured_geography: string;
}

export interface ISpatialComponentsSearchCriteria {
  boundary: Feature;
  type?: string[];
  species?: string[];
  datasetID?: string[];
}

export type EmptyObject = Record<string, never>;

export interface ISubmissionSpatialSearchResponseRow {
  spatial_component: {
    submission_spatial_component_id: number;
    spatial_data: FeatureCollection | EmptyObject;
  };
}

export class SpatialRepository extends BaseRepository {
  /**
   * Insert new spatial transform record
   *
   * @param {IInsertSpatialTransform} spatialTransformDetails
   * @return {*}  {Promise<{ spatial_transform_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSpatialTransform(
    spatialTransformDetails: IInsertSpatialTransform
  ): Promise<{ spatial_transform_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO spatial_transform (
        name,
        description,
        notes,
        transform
      ) VALUES (
        ${spatialTransformDetails.name},
        ${spatialTransformDetails.description},
        ${spatialTransformDetails.notes},
        ${spatialTransformDetails.transform}
      )
      RETURNING
        spatial_transform_id;
    `;

    const response = await this.connection.sql<{ spatial_transform_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert spatial transform details', [
        'SpatialRepository->insertSpatialTransform',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * get spatial transform records
   *
   * @param
   * @return {*}  {Promise<IGetSpatialTransformRecord>}
   * @memberof SpatialRepository
   */
  async getSpatialTransformRecords(): Promise<IGetSpatialTransformRecord[]> {
    const sqlStatement = SQL`
      SELECT
        spatial_transform_id,
        name,
        description,
        notes,
        transform
      FROM
        spatial_transform;
    `;

    const response = await this.connection.sql<IGetSpatialTransformRecord>(sqlStatement);

    return response.rows;
  }

  /**
   *get security transform records
   *
   * @return {*}  {Promise<IGetSecurityTransformRecord[]>}
   * @memberof SpatialRepository
   */
  async getSecurityTransformRecords(): Promise<IGetSecurityTransformRecord[]> {
    const sqlStatement = SQL`
      SELECT
        security_transform_id,
        name,
        description,
        notes,
        transform
      FROM
        security_transform;
    `;

    const response = await this.connection.sql<IGetSecurityTransformRecord>(sqlStatement);

    return response.rows;
  }

  /**
   * Insert record of transform id used for submission spatial component record
   *
   * @param {number} spatialTransformId
   * @param {number} submissionSpatialComponentId
   * @return {*}  {Promise<{ spatial_transform_submission_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSpatialTransformSubmissionRecord(
    spatialTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ spatial_transform_submission_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO spatial_transform_submission (
        spatial_transform_id,
        submission_spatial_component_id
      ) VALUES (
        ${spatialTransformId},
        ${submissionSpatialComponentId}
      )
      RETURNING
        spatial_transform_submission_id;
    `;

    const response = await this.connection.sql<{ spatial_transform_submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError(
        'Failed to insert spatial transform submission id and submission spatial component id',
        [
          'SpatialRepository->insertSpatialTransformSubmissionRecord',
          'rowCount was null or undefined, expected rowCount >= 1'
        ]
      );
    }
    return response.rows[0];
  }

  /**
   * Insert record of transform id used for submission security component record
   *
   * @param {number} securityTransformId
   * @param {number} submissionSpatialComponentId
   * @return {*}  {Promise<{ spatial_transform_submission_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSecurityTransformSubmissionRecord(
    securityTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ security_transform_submission_id: number }> {
    const sqlStatement = SQL`
        INSERT INTO security_transform_submission (
          security_transform_id,
          submission_spatial_component_id
        ) VALUES (
          ${securityTransformId},
          ${submissionSpatialComponentId}
        )
        RETURNING
          security_transform_submission_id;
      `;

    const response = await this.connection.sql<{ security_transform_submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError(
        'Failed to insert security transform submission id and submission spatial component id',
        [
          'SpatialRepository->insertSecurityTransformSubmissionRecord',
          'rowCount was null or undefined, expected rowCount = 1'
        ]
      );
    }
    return response.rows[0];
  }

  /**
   * Run Spatial Transform with transform string on submissionId
   *
   * @param {number} submissionId
   * @param {string} transform
   * @return {*}  {Promise<ITransformRow[]>}
   * @memberof SpatialRepository
   */
  async runSpatialTransformOnSubmissionId(submissionId: number, transform: string): Promise<ITransformSpatialRow[]> {
    const response = await this.connection.query(transform, [submissionId]);

    if (response.rowCount <= 0) {
      throw new ApiExecuteSQLError('Failed to run spatial transform on submission id', [
        'SpatialRepository->runSpatialTransformOnSubmissionId',
        'rowCount was null or undefined, expected rowCount >= 1'
      ]);
    }

    return response.rows;
  }

  /**
   * Run Security Transform with transform string on submissionId
   *
   * @param {number} submissionId
   * @param {string} transform
   * @return {*}  {Promise<ITransformRow[]>}
   * @memberof SpatialRepository
   */
  async runSecurityTransformOnSubmissionId(submissionId: number, transform: string): Promise<ITransformSecureRow[]> {
    const response = await this.connection.query(transform, [submissionId]);

    if (response.rowCount <= 0) {
      throw new ApiExecuteSQLError('Failed to run security transform on submission id', [
        'SpatialRepository->runSecurityTransformOnSubmissionId',
        'rowCount was null or undefined, expected rowCount >= 1'
      ]);
    }

    return response.rows;
  }

  /**
   * Insert given transformed data into Spatial Component Table
   *
   * @param {number} submissionId
   * @param {Feature[]} transformedData
   * @return {*}  {Promise<{ submission_spatial_component_id: number }>}
   * @memberof SpatialRepository
   */
  async insertSubmissionSpatialComponent(
    submissionId: number,
    transformedData: FeatureCollection
  ): Promise<{ submission_spatial_component_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_spatial_component (
        submission_id,
        spatial_component,
        geography
      ) VALUES (
        ${submissionId},
        ${JSON.stringify(transformedData)}
    `;

    if (transformedData.features && transformedData.features.length > 0) {
      const geoCollection = generateGeometryCollectionSQL(transformedData.features);

      sqlStatement.append(SQL`
        ,public.geography(
          public.ST_Force2D(
            public.ST_SetSRID(
      `);

      sqlStatement.append(geoCollection);

      sqlStatement.append(SQL`
        , 4326)))
      `);
    } else {
      sqlStatement.append(SQL`
        ,null
      `);
    }

    sqlStatement.append(SQL`
      )
      RETURNING
        submission_spatial_component_id;
    `);

    const response = await this.connection.sql<{ submission_spatial_component_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission spatial component details', [
        'SpatialRepository->insertSubmissionSpatialComponent',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Update secured spatial column with the transformed spatial data
   *
   * @param {number} submissionId
   * @param {Feature[]} transformedData
   * @return {*}  {Promise<{ submission_spatial_component_id: number }>}
   * @memberof SpatialRepository
   */
  async updateSubmissionSpatialComponentWithSecurity(
    submissionSpatialComponentId: number,
    transformedData: object
  ): Promise<{ submission_spatial_component_id: number }> {
    const sqlStatement = SQL`
        UPDATE
          submission_spatial_component
        SET
          secured_spatial_component =  ${transformedData}
        WHERE
          submission_spatial_component_id = ${submissionSpatialComponentId}
        RETURNING
          submission_spatial_component_id;
      `;

    const response = await this.connection.sql<{ submission_spatial_component_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission spatial component details', [
        'SpatialRepository->updateSubmissionSpatialComponentWithSecurity',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Query builder to find spatial component by given criteria.
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialSearchResponseRow[]>}
   * @memberof SpatialRepository
   */
  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialSearchResponseRow[]> {
    const userService = new UserService(this.connection);

    const userObject = await userService.getUserById(this.connection.systemUserId());

    if (
      [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR].some((systemRole) =>
        userObject.role_names.includes(systemRole)
      )
    ) {
      // Fetch all non-secure records that match the search criteria
      return this._findSpatialComponentsByCriteriaAsAdminUser(criteria);
    }

    // Fetch all records (non-secure and/or secure, depending on the security rules applied and any user exceptions)
    // that match the search criteria
    return this._findSpatialComponentsByCriteria(criteria);
  }

  /**
   * Query builder to find spatial component by given criteria, specifically for admin users that bypass all security
   * rules.
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialSearchResponseRow[]>}
   * @memberof SpatialRepository
   */
  async _findSpatialComponentsByCriteriaAsAdminUser(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialSearchResponseRow[]> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .with('with_filtered_spatial_component', (qb1) => {
        // Get the spatial components that match the search filters
        qb1.select().from('submission_spatial_component as ssc');

        if (criteria.type?.length) {
          this._whereTypeIn(criteria.type, qb1);
        }

        if (criteria.species?.length) {
          this._whereSpeciesIn(criteria.species, qb1);
        }

        if (criteria.datasetID?.length) {
          this._whereDatasetIDIn(criteria.datasetID, qb1);
        }

        this._whereBoundaryIntersects(criteria.boundary, 'geography', qb1);
      })
      .select(
        // Select the non-secure spatial component from the search results
        knex.raw(
          `
            jsonb_build_object(
              'submission_spatial_component_id',
                wfsc.submission_spatial_component_id,
              'spatial_data',
                wfsc.spatial_component
            ) spatial_component
          `
        )
      )
      .from(knex.raw('with_filtered_spatial_component as wfsc'));

    const response = await this.connection.knex<ISubmissionSpatialSearchResponseRow>(queryBuilder);

    return response.rows;
  }

  /**
   * Query builder to find spatial component by given criteria.
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialSearchResponseRow[]>}
   * @memberof SpatialRepository
   */
  async _findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialSearchResponseRow[]> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .with('with_filtered_spatial_component_with_security_transforms', (qb1) => {
        // Get the spatial components that match the search filters, and for each record, build the array of spatial security transforms that ran against that row
        qb1
          .select(
            knex.raw(
              'array_remove(array_agg(sts.security_transform_id), null) as spatial_component_security_transforms'
            ),
            'ssc.submission_spatial_component_id',
            'ssc.submission_id',
            'ssc.spatial_component',
            'ssc.secured_spatial_component'
          )
          .from('submission_spatial_component as ssc')
          .leftJoin(
            'security_transform_submission as sts',
            'sts.submission_spatial_component_id',
            'ssc.submission_spatial_component_id'
          )
          .groupBy('sts.submission_spatial_component_id')
          .groupBy('ssc.submission_spatial_component_id')
          .groupBy('ssc.submission_id')
          .groupBy('ssc.spatial_component')
          .groupBy('ssc.secured_spatial_component');
        if (criteria.type?.length) {
          this._whereTypeIn(criteria.type, qb1);
        }
        if (criteria.species?.length) {
          this._whereSpeciesIn(criteria.species, qb1);
        }

        if (criteria.datasetID?.length) {
          this._whereDatasetIDIn(criteria.datasetID, qb1);
        }

        this._whereBoundaryIntersects(criteria.boundary, 'geography', qb1);
      })
      .with('with_user_security_transform_exceptions', (qb6) => {
        // Build an array of the users spatial security transform exceptions
        qb6
          .select(knex.raw('array_agg(suse.security_transform_id) as user_security_transform_exceptions'))
          .from('system_user_security_exception as suse')
          .where('suse.system_user_id', this.connection.systemUserId());
      })
      .select(
        // Select either the non-secure or secure spatial component from the search results, based on whether or not the record had security transforms applied to it and whether or not the user has the necessary exceptions
        knex.raw(
          `
            jsonb_build_object(
              'submission_spatial_component_id',
                wfscwst.submission_spatial_component_id,
              'spatial_data',
                -- when: the user's security transform ids array contains all of the rows security transform ids (user has all necessary exceptions)
                -- then: return the spatial component
                -- else: return the secure spatial component if it is not null (secure, insufficient exceptions), otherwise return the spatial compnent (non-secure, no exceptions required)
                case
                  when
                    wuste.user_security_transform_exceptions @> wfscwst.spatial_component_security_transforms
                  then
                    wfscwst.spatial_component
                  else
                    coalesce(wfscwst.secured_spatial_component, wfscwst.spatial_component)
                end
            ) spatial_component
          `
        )
      )
      .from(
        knex.raw(
          'with_filtered_spatial_component_with_security_transforms as wfscwst, with_user_security_transform_exceptions as wuste'
        )
      );

    const response = await this.connection.knex<ISubmissionSpatialSearchResponseRow>(queryBuilder);

    return response.rows;
  }

  /**
   * Append where clause condition for spatial component type.
   *
   * @param {string[]} types
   * @param {Knex.QueryBuilder} qb1
   * @memberof SpatialRepository
   */
  _whereTypeIn(types: string[], qb1: Knex.QueryBuilder) {
    // Append AND where clause for types
    qb1.where((qb2) => {
      for (const type of types) {
        // Append OR clause for each item in types array
        qb2.or.where((qb3) => {
          qb3.whereRaw(`jsonb_path_exists(spatial_component,'$.features[*] \\? (@.properties.type == "${type}")')`);
        });
      }
    });
  }

  /**
   * Append where clause condition for spatial component associatedTaxa.
   *
   * @param {string[]} species
   * @param {Knex.QueryBuilder} qb1
   * @memberof SpatialRepository
   */
  _whereSpeciesIn(species: string[], qb1: Knex.QueryBuilder) {
    // Append AND where clause for species
    qb1.where((qb2) => {
      for (const singleSpecies of species) {
        // Append OR clause for each item in species array
        qb2.and.where((qb3) => {
          qb3.whereRaw(
            `jsonb_path_exists(spatial_component,'$.features[*] \\? (@.properties.dwc.associatedTaxa == "${singleSpecies}")')`
          );
        });
      }
    });
  }

  /**
   * Append where clause condition for spatial component parent dataset id.
   *
   * @param {string[]} datasetIDs
   * @param {Knex.QueryBuilder} qb1
   * @memberof SpatialRepository
   */
  _whereDatasetIDIn(datasetIDs: string[], qb1: Knex.QueryBuilder) {
    qb1.where((qb2) => {
      qb2.whereRaw(
        `submission_id in (select submission_id from submission where uuid in (${"'" + datasetIDs.join("','") + "'"}))`
      );
    });
  }

  /**
   * Append where clause condition for spatial component boundary intersect.
   *
   * @param {Feature} boundary
   * @param {string} geoColumn
   * @param {Knex.QueryBuilder} qb1
   * @memberof SpatialRepository
   */
  _whereBoundaryIntersects(boundary: Feature, geoColumn: string, qb1: Knex.QueryBuilder) {
    const sqlStatement = SQL`
      public.ST_INTERSECTS(`.append(`${geoColumn}`).append(`,
        public.geography(
          public.ST_Force2D(
            public.ST_SetSRID(
              public.ST_Force2D(
                public.ST_GeomFromGeoJSON('${JSON.stringify(boundary.geometry)}')
              ),
              4326
            )
          )
        )
      )
    `);

    qb1.where((qb2) => {
      qb2.whereRaw(sqlStatement.sql, sqlStatement.values);
    });
  }

  /**
   * Query spatial components by given submission ID
   *
   * @param {ISpatialComponentsSearchCriteria} criteria
   * @return {*}  {Promise<ISubmissionSpatialComponent[]>}
   * @memberof SpatialRepository
   */
  async findSpatialMetadataBySubmissionSpatialComponentId(
    submission_spatial_component_id: number
  ): Promise<ISubmissionSpatialComponent> {
    const queryBuilder = getKnexQueryBuilder()
      .select()
      .from('submission_spatial_component')
      .where({ submission_spatial_component_id });

    const spatialComponentResponse = await this.connection.knex<ISubmissionSpatialComponent>(queryBuilder);

    return spatialComponentResponse.rows[0];
  }

  /**
   * Deletes spatial components in a submission id before updating it with new data
   *
   * @param {number} submission_id
   * @return {*}  {Promise<{ submission_id: number }[]>}
   * @memberof SpatialRepository
   */
  async deleteSpatialComponentsBySubmissionId(submission_id: number): Promise<{ submission_id: number }[]> {
    const sqlStatement = SQL`
      DELETE FROM
        submission_spatial_component
      WHERE
        submission_id=${submission_id}
      RETURNING
        submission_id;
    ;`;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    return response.rows;
  }

  /**
   * Remove references in spatial_transform_submission table
   *
   * @param {number} submission_id
   * @return {*}  {Promise<{ submission_id: number }[]>}
   * @memberof SpatialRepository
   */
  async deleteSpatialComponentsSpatialTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    const sqlStatement = SQL`
      DELETE FROM
        spatial_transform_submission
      WHERE
        submission_spatial_component_id IN (
          SELECT
            submission_spatial_component_id
          FROM
            submission_spatial_component
          WHERE
            submission_id=${submission_id}
        )
      RETURNING
        ${submission_id};
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    return response.rows;
  }

  /**
   * Remove references in security_transform_submission table
   *
   * @param {number} submission_id
   * @return {*}  {Promise<{ submission_id: number }[]>}
   * @memberof SpatialRepository
   */
  async deleteSpatialComponentsSecurityTransformRefsBySubmissionId(
    submission_id: number
  ): Promise<{ submission_id: number }[]> {
    const sqlStatement = SQL`
      DELETE FROM
        security_transform_submission
      WHERE
        submission_spatial_component_id IN (
          SELECT
            submission_spatial_component_id
          FROM
            submission_spatial_component
          WHERE
            submission_id=${submission_id}
        )
      RETURNING
        ${submission_id};
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    return response.rows;
  }
}
