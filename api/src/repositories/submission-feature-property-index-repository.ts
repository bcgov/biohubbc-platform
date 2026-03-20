import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorCodesetCode, ContributorCodesetCodeSchema } from '../models/contributor-codeset-code';
import {
  CreateSubmissionFeaturePropertyArtifact,
  SubmissionFeaturePropertyArtifact
} from '../models/submission-feature-property-artifact';
import {
  CreateSubmissionFeaturePropertyBoolean,
  SubmissionFeaturePropertyBoolean,
  SubmissionFeaturePropertyBooleanSchema
} from '../models/submission-feature-property-boolean';
import {
  CreateSubmissionFeaturePropertyCode,
  SubmissionFeaturePropertyCode,
  SubmissionFeaturePropertyCodeSchema
} from '../models/submission-feature-property-code';
import {
  CreateSubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometry
} from '../models/submission-feature-property-geometry';
import {
  ArtifactReferenceResolution,
  ContributorCodeResolution,
  FeatureTypePropertyMetadata
} from '../models/submission-feature-property-index';
import {
  CreateSubmissionFeaturePropertyNumber,
  SubmissionFeaturePropertyNumber,
  SubmissionFeaturePropertyNumberSchema
} from '../models/submission-feature-property-number';
import {
  CreateSubmissionFeaturePropertyString,
  SubmissionFeaturePropertyString,
  SubmissionFeaturePropertyStringSchema
} from '../models/submission-feature-property-string';
import {
  CreateSubmissionFeaturePropertyTaxon,
  SubmissionFeaturePropertyTaxon,
  SubmissionFeaturePropertyTaxonSchema
} from '../models/submission-feature-property-taxon';
import {
  CreateSubmissionFeaturePropertyTimestamp,
  SubmissionFeaturePropertyTimestamp
} from '../models/submission-feature-property-timestamp';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

/**
 * Repository for canonical submission feature property indexing SQL operations.
 *
 * @export
 * @class SubmissionFeaturePropertyIndexRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeaturePropertyIndexRepository extends BaseRepository {
  /**
   * Get active feature type property metadata for provided feature types.
   *
   * @param {number[]} featureTypeIds
   * @return {Promise<FeatureTypePropertyMetadata[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getFeatureTypePropertyMetadata(featureTypeIds: number[]): Promise<FeatureTypePropertyMetadata[]> {
    if (!featureTypeIds.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('feature_type_property as ftp')
      .select([
        'ftp.feature_type_id',
        'ftp.feature_type_property_id',
        'ftp.allow_multiple',
        'fp.name as feature_property_name',
        'fpt.name as feature_property_type_name'
      ])
      .innerJoin('feature_property as fp', 'fp.feature_property_id', 'ftp.feature_property_id')
      .innerJoin('feature_property_type as fpt', 'fpt.feature_property_type_id', 'fp.feature_property_type_id')
      .whereIn('ftp.feature_type_id', featureTypeIds)
      .whereNull('ftp.record_end_date')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date');

    const response = await this.connection.knex(query, FeatureTypePropertyMetadata);

    return response.rows;
  }

  /**
   * Delete all canonical property records for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<Record<string, unknown>[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async deletePropertyRecordsBySubmissionId(submissionId: number): Promise<Record<string, unknown>[]> {
    const knex = getKnex();
    const featureIdsQuery = knex
      .select('submission_feature_id')
      .from('submission_feature')
      .where('submission_id', submissionId);

    const cteFeatureIds = knex.select('submission_feature_id').from('feature_ids');

    const query = knex
      .with('feature_ids', featureIdsQuery)
      .with('deleted_string', (qb) => {
        qb.from('submission_feature_property_string').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_number', (qb) => {
        qb.from('submission_feature_property_number').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_boolean', (qb) => {
        qb.from('submission_feature_property_boolean').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_timestamp', (qb) => {
        qb.from('submission_feature_property_timestamp').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_code', (qb) => {
        qb.from('submission_feature_property_code').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_taxon', (qb) => {
        qb.from('submission_feature_property_taxon').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_geometry', (qb) => {
        qb.from('submission_feature_property_geometry').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .select(knex.raw('1 as deleted'));

    const response = await this.connection.knex(query);
    const artifactTableCheck = await this.connection.sql(
      SQL`SELECT to_regclass('biohub.submission_feature_property_artifact') IS NOT NULL AS has_table;`,
      z.object({ has_table: z.boolean() })
    );
    const hasArtifactTable = artifactTableCheck.rows[0]?.has_table ?? false;
    if (hasArtifactTable) {
      await this.connection.knex(
        getKnex()('submission_feature_property_artifact').whereIn(
          'submission_feature_id',
          getKnex()('submission_feature').select('submission_feature_id').where('submission_id', submissionId)
        ).delete()
      );
    }

    return response.rows;
  }

  /**
   * Delete canonical property records for one upload attempt.
   *
   * @param {string} submissionUploadId
   * @return {Promise<Record<string, unknown>[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async deletePropertyRecordsBySubmissionUploadId(submissionUploadId: string): Promise<Record<string, unknown>[]> {
    const knex = getKnex();
    const featureIdsQuery = knex
      .select('submission_feature_id')
      .from('submission_feature')
      .where('submission_upload_id', submissionUploadId);

    const cteFeatureIds = knex.select('submission_feature_id').from('feature_ids');

    const query = knex
      .with('feature_ids', featureIdsQuery)
      .with('deleted_string', (qb) => {
        qb.from('submission_feature_property_string').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_number', (qb) => {
        qb.from('submission_feature_property_number').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_boolean', (qb) => {
        qb.from('submission_feature_property_boolean').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_timestamp', (qb) => {
        qb.from('submission_feature_property_timestamp').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_code', (qb) => {
        qb.from('submission_feature_property_code').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_taxon', (qb) => {
        qb.from('submission_feature_property_taxon').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .with('deleted_geometry', (qb) => {
        qb.from('submission_feature_property_geometry').whereIn('submission_feature_id', cteFeatureIds).delete();
      })
      .select(knex.raw('1 as deleted'));

    const response = await this.connection.knex(query);
    const artifactTableCheck = await this.connection.sql(
      SQL`SELECT to_regclass('biohub.submission_feature_property_artifact') IS NOT NULL AS has_table;`,
      z.object({ has_table: z.boolean() })
    );
    const hasArtifactTable = artifactTableCheck.rows[0]?.has_table ?? false;
    if (hasArtifactTable) {
      await this.connection.knex(
        getKnex()('submission_feature_property_artifact').whereIn(
          'submission_feature_id',
          getKnex()('submission_feature')
            .select('submission_feature_id')
            .where('submission_upload_id', submissionUploadId)
        ).delete()
      );
    }
    return response.rows;
  }

  /**
   * Resolve artifact references to artifact_id rows for one upload attempt.
   *
   * @param {string} submissionUploadId
   * @param {string[]} references
   * @return {Promise<ArtifactReferenceResolution[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getArtifactResolutionsBySubmissionUploadIdAndReferences(
    submissionUploadId: string,
    references: string[]
  ): Promise<ArtifactReferenceResolution[]> {
    if (!references.length) {
      return [];
    }

    const sqlStatement = SQL`
      WITH normalized_refs AS (
        SELECT DISTINCT
          refs.reference,
          CASE
            WHEN refs.reference LIKE 'files/%' THEN substr(refs.reference, 7)
            ELSE refs.reference
          END AS normalized_reference
        FROM unnest(${references}::text[]) AS refs(reference)
      )
      SELECT
        normalized_refs.reference AS artifact_reference,
        artifact.artifact_id
      FROM normalized_refs
      INNER JOIN submission_upload
        ON submission_upload.submission_upload_id = ${submissionUploadId}
      INNER JOIN upload_artifact
        ON upload_artifact.upload_id = submission_upload.upload_id
       AND upload_artifact.role = 'feature'
      INNER JOIN artifact
        ON artifact.artifact_id = upload_artifact.artifact_id
      WHERE
        artifact.object_key = normalized_refs.reference
        OR artifact.object_key = normalized_refs.normalized_reference
        OR substring(artifact.object_key FROM '[^/]+$') = normalized_refs.normalized_reference;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactReferenceResolution);
    return response.rows;
  }

  /**
   * Find contributor codeset code rows by ids.
   *
   * @param {number[]} contributorCodesetCodeIds
   * @return {Promise<ContributorCodesetCode[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async findContributorCodesetCodesByIds(contributorCodesetCodeIds: number[]): Promise<ContributorCodesetCode[]> {
    if (!contributorCodesetCodeIds.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('contributor_codeset_code')
      .select([
        'contributor_codeset_code_id',
        'contributor_codeset_id',
        'key',
        'version as external_id',
        'label',
        'description'
      ])
      .whereIn('contributor_codeset_code_id', contributorCodesetCodeIds);

    const response = await this.connection.knex(query, ContributorCodesetCodeSchema);

    return response.rows;
  }

  /**
   * Get contributor code resolution rows for a contributor and codeset keys.
   *
   * @param {number} contributorId
   * @param {string[]} contributorCodesetKeys
   * @return {Promise<ContributorCodeResolution[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getContributorCodeResolutionsByContributorIdAndCodesetKeys(
    contributorId: number,
    contributorCodesetKeys: string[]
  ): Promise<ContributorCodeResolution[]> {
    if (!contributorCodesetKeys.length) {
      return [];
    }

    const knex = getKnex();
    const codesQuery = knex('contributor_codeset_code as ccc')
      .select([
        'ccc.contributor_codeset_code_id',
        'ccs.key as contributor_codeset_key',
        'ccc.key as contributor_codeset_code_key'
      ])
      .innerJoin('contributor_codeset as ccs', 'ccs.contributor_codeset_id', 'ccc.contributor_codeset_id')
      .where('ccs.contributor_id', contributorId)
      .whereNull('ccs.record_end_date')
      .whereNull('ccc.record_end_date')
      .whereIn('ccs.key', contributorCodesetKeys);

    const response = await this.connection.knex(codesQuery, ContributorCodeResolution);

    return response.rows;
  }

  /**
   * Bulk insert string property records.
   *
   * @param {CreateSubmissionFeaturePropertyString[]} records
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertStringRecords(
    records: CreateSubmissionFeaturePropertyString[]
  ): Promise<SubmissionFeaturePropertyString[]> {
    if (!records.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .insert(records)
      .returning([
        'submission_feature_property_string_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);
    this.assertInsertedRowCount('submission_feature_property_string', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Bulk insert number property records.
   *
   * @param {CreateSubmissionFeaturePropertyNumber[]} records
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertNumberRecords(
    records: CreateSubmissionFeaturePropertyNumber[]
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    if (!records.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .insert(records)
      .returning([
        'submission_feature_property_number_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);
    this.assertInsertedRowCount('submission_feature_property_number', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Bulk insert boolean property records.
   *
   * @param {CreateSubmissionFeaturePropertyBoolean[]} records
   * @return {Promise<SubmissionFeaturePropertyBoolean[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertBooleanRecords(
    records: CreateSubmissionFeaturePropertyBoolean[]
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    if (!records.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_boolean')
      .insert(records)
      .returning([
        'submission_feature_property_boolean_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyBooleanSchema);
    this.assertInsertedRowCount('submission_feature_property_boolean', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Bulk insert timestamp property records.
   *
   * @param {CreateSubmissionFeaturePropertyTimestamp[]} records
   * @return {Promise<SubmissionFeaturePropertyTimestamp[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertTimestampRecords(
    records: CreateSubmissionFeaturePropertyTimestamp[]
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    if (!records.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp')
      .insert(records)
      .returning([
        'submission_feature_property_timestamp_id',
        'submission_feature_id',
        'feature_type_property_id',
        'date_value',
        'time_value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTimestamp);
    this.assertInsertedRowCount('submission_feature_property_timestamp', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Bulk insert artifact property records.
   *
   * @param {CreateSubmissionFeaturePropertyArtifact[]} records
   * @return {Promise<SubmissionFeaturePropertyArtifact[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertArtifactRecords(
    records: CreateSubmissionFeaturePropertyArtifact[]
  ): Promise<SubmissionFeaturePropertyArtifact[]> {
    if (!records.length) {
      return [];
    }

    const sqlStatement = SQL`
      INSERT INTO submission_feature_property_artifact (
        submission_feature_id,
        feature_type_property_id,
        artifact_id
      )
      SELECT
        staged.submission_feature_id,
        staged.feature_type_property_id,
        staged.artifact_id
      FROM unnest(
        ${records.map((record) => record.submission_feature_id)}::integer[],
        ${records.map((record) => record.feature_type_property_id)}::integer[],
        ${records.map((record) => record.artifact_id)}::uuid[]
      ) AS staged(submission_feature_id, feature_type_property_id, artifact_id)
      RETURNING
        submission_feature_property_artifact_id,
        submission_feature_id,
        feature_type_property_id,
        artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeaturePropertyArtifact);
    this.assertInsertedRowCount('submission_feature_property_artifact', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Bulk insert code property records.
   *
   * @param {CreateSubmissionFeaturePropertyCode[]} records
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertCodeRecords(records: CreateSubmissionFeaturePropertyCode[]): Promise<SubmissionFeaturePropertyCode[]> {
    if (!records.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_code')
      .insert(records)
      .returning([
        'submission_feature_property_code_id',
        'submission_feature_id',
        'feature_type_property_id',
        'contributor_codeset_code_id'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyCodeSchema);
    this.assertInsertedRowCount('submission_feature_property_code', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Bulk insert taxon property records.
   *
   * @param {CreateSubmissionFeaturePropertyTaxon[]} records
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertTaxonRecords(records: CreateSubmissionFeaturePropertyTaxon[]): Promise<SubmissionFeaturePropertyTaxon[]> {
    if (!records.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_taxon')
      .insert(records)
      .returning([
        'submission_feature_property_taxon_id',
        'submission_feature_id',
        'feature_type_property_id',
        'taxon_id'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);
    this.assertInsertedRowCount('submission_feature_property_taxon', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Bulk insert geometry property records.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry[]} records
   * @return {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async insertGeometryRecords(
    records: CreateSubmissionFeaturePropertyGeometry[]
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    if (!records.length) {
      return [];
    }

    const query = SQL`INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value) VALUES`;

    records.forEach((record, index) => {
      query.append(SQL`(${record.submission_feature_id}, ${record.feature_type_property_id},`);
      query.append(generateGeometryCollectionSQL(record.value));
      query.append(SQL`)`);
      if (index < records.length - 1) {
        query.append(SQL`,`);
      }
    });

    query.append(
      SQL` RETURNING submission_feature_property_geometry_id, submission_feature_id, feature_type_property_id, value`
    );

    const response = await this.connection.sql(query, SubmissionFeaturePropertyGeometry);
    this.assertInsertedRowCount('submission_feature_property_geometry', records.length, response.rowCount);

    return response.rows;
  }

  /**
   * Assert inserted row count matches requested row count.
   *
   * @private
   * @param {string} tableName
   * @param {number} expectedCount
   * @param {number} actualCount
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  private assertInsertedRowCount(tableName: string, expectedCount: number, actualCount: number | null): void {
    if (actualCount !== expectedCount) {
      throw new ApiExecuteSQLError(`Failed to insert ${tableName} records`, [
        'SubmissionFeaturePropertyIndexRepository->assertInsertedRowCount',
        `rowCount was ${actualCount ?? 'null'}, expected ${expectedCount}`
      ]);
    }
  }
}
