import { JSONPath } from 'jsonpath-plus';
import { z } from 'zod';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  ISourceTransformModel,
  ISubmissionJobQueueRecord,
  ISubmissionMetadataRecord,
  ISubmissionModel,
  ISubmissionModelWithStatus,
  ISubmissionObservationRecord,
  ISubmissionRecord,
  ISubmissionRecordWithSpatial,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE,
  DatasetsToReview
} from '../repositories/submission-repository';
import { EMLFile } from '../utils/media/eml/eml-file';
import { DBService } from './db-service';

export const RelatedDataset = z.object({
  datasetId: z.string(),
  title: z.string(),
  url: z.string()
});

export type RelatedDataset = z.infer<typeof RelatedDataset>;

export class SubmissionService extends DBService {
  submissionRepository: SubmissionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
  }

  /**
   * Insert a new submission record.
   *
   * @param {ISubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecord(submissionData: ISubmissionRecord): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecord(submissionData);
  }

  /**
   * Insert a new submission record, returning the record having the matching UUID if it already exists
   *
   * @param {ISubmissionModel} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecordWithPotentialConflict(
    submissionData: ISubmissionModel
  ): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecordWithPotentialConflict(submissionData);
  }

  /**
   * Update the `eml_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {EMLFile} file
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataEMLSource(
    submissionId: number,
    submissionMetadataId: number,
    file: EMLFile
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.updateSubmissionMetadataEMLSource(submissionId, submissionMetadataId, file);
  }

  /**
   * Update the `eml_json_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {ISubmissionRecord['eml_json_source']} EMLJSONSource
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordEMLJSONSource(
    submissionId: number,
    submissionMetadataId: number,
    EMLJSONSource: ISubmissionMetadataRecord['eml_json_source']
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.updateSubmissionMetadataEMLJSONSource(
      submissionId,
      submissionMetadataId,
      EMLJSONSource
    );
  }

  /**
   * Get submission record by id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionModel> {
    return this.submissionRepository.getSubmissionRecordBySubmissionId(submissionId);
  }

  /**
   * Get submission record by uuid.
   *
   * @param {number} uuid
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number } | null> {
    return this.submissionRepository.getSubmissionIdByUUID(uuid);
  }

  /**
   * Set record_end_date of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataRecordEndDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataRecordEndDate(submissionId);
  }

  /**
   * Set record_effective_timestamp of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataRecordEffectiveDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataRecordEffectiveDate(submissionId);
  }

  /**
   * Update end time stamp for submission observation record
   *
   * @param {number} submissionId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionService
   */
  async updateSubmissionObservationRecordEndDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionObservationRecordEndDate(submissionId);
  }

  /**
   * Get source transform record by its associated source system user id.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionService
   */
  async getSourceTransformRecordBySystemUserId(systemUserId: number, version?: string): Promise<ISourceTransformModel> {
    return this.submissionRepository.getSourceTransformRecordBySystemUserId(systemUserId, version);
  }

  /**
   * Get json representation of eml source from submission.
   *
   * @param {number} submissionId
   * @param {string} transform
   * @return {string}
   * @memberof SubmissionService
   */
  async getSubmissionMetadataJson(submissionId: number, transform: string): Promise<string> {
    return this.submissionRepository.getSubmissionMetadataJson(submissionId, transform);
  }

  /**
   * Get source transform record by its associated source transform id.
   *
   * @param {number} sourceTransformId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionService
   */
  async getSourceTransformRecordBySourceTransformId(sourceTransformId: number): Promise<ISourceTransformModel> {
    return this.submissionRepository.getSourceTransformRecordBySourceTransformId(sourceTransformId);
  }

  /**
   * Get json representation of eml source from submission by datasetId.
   *
   * @param {string} datasetId
   * @return {Promise<Record<string, unknown>>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordEMLJSONByDatasetId(datasetId: string): Promise<Record<string, unknown>> {
    const response = await this.submissionRepository.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get dataset', [
        'SubmissionRepository->getSubmissionRecordEMLJSONByDatasetId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].eml_json_source;
  }

  /**
   * Find json representation of eml source from submission by datasetId. May return null if `datasetId` does not match
   * any existing records.
   *
   * @param {string} datasetId
   * @return {Record<string, unknown> | null}
   * @memberof SubmissionService
   */
  async findSubmissionRecordEMLJSONByDatasetId(datasetId: string): Promise<Record<string, unknown> | null> {
    const response = await this.submissionRepository.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (response.rowCount !== 1) {
      return null;
    }

    return response.rows[0].eml_json_source;
  }

  /**
   * Insert a submission status record.
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @return {*}  {Promise<{
   *     submission_status_id: number;
   *     submission_status_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionStatus(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE
  ): Promise<{
    submission_status_id: number;
    submission_status_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionStatus(submissionId, submissionStatusType);
  }

  /**
   * Insert a submission message record.
   *
   * @param {number} submissionStatusId
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @return {*}  {Promise<{
   *     submission_message_id: number;
   *     submission_message_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionMessage(
    submissionStatusId: number,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{
    submission_message_id: number;
    submission_message_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionMessage(
      submissionStatusId,
      submissionMessageType,
      submissionMessage
    );
  }

  /**
   * List all submissions
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModelWithStatus>}
   * @memberof SubmissionService
   */
  async listSubmissionRecords(): Promise<ISubmissionModelWithStatus[]> {
    return this.submissionRepository.listSubmissionRecords();
  }

  /**
   * Inserts both the status and message of a submission
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @param {string} submissionMessage
   * @return {*}  {Promise<{
   *     submission_status_id: number;
   *     submission_message_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionStatusAndMessage(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{
    submission_status_id: number;
    submission_message_id: number;
  }> {
    const submission_status_id = (
      await this.submissionRepository.insertSubmissionStatus(submissionId, submissionStatusType)
    ).submission_status_id;

    const submission_message_id = (
      await this.submissionRepository.insertSubmissionMessage(
        submission_status_id,
        submissionMessageType,
        submissionMessage
      )
    ).submission_message_id;

    return {
      submission_status_id,
      submission_message_id
    };
  }

  /**
   * Retrieves an array of submission records with spatial count by dataset id.
   *
   * @param {string[]} datasetIds
   * @return {*}  {(Promise<(ISubmissionRecordWithSpatial | null)[]>)}
   * @memberof SubmissionService
   */
  async findSubmissionRecordsWithSpatialCount(datasetIds: string[]): Promise<(ISubmissionRecordWithSpatial | null)[]> {
    return Promise.all(datasetIds.map(async (datasetId) => this.findSubmissionRecordWithSpatialCount(datasetId)));
  }

  /**
   * Retrieves a submission record with spatial count by dataset id.
   *
   * @param {string} datasetId
   * @return {*}  {(Promise<ISubmissionRecordWithSpatial | null>)}
   * @memberof SubmissionService
   */
  async findSubmissionRecordWithSpatialCount(datasetId: string): Promise<ISubmissionRecordWithSpatial | null> {
    const [submissionEMLJSON, spatialComponentCounts] = await Promise.all([
      this.findSubmissionRecordEMLJSONByDatasetId(datasetId),
      this.submissionRepository.getSpatialComponentCountByDatasetId(datasetId)
    ]);

    if (!submissionEMLJSON) {
      return null;
    }

    return {
      id: datasetId,
      source: submissionEMLJSON,
      observation_count: spatialComponentCounts.find((countItem) => countItem.spatial_type === 'Occurrence')?.count || 0
    };
  }

  /**
   *  Fetch row of submission job queue by submission Id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionJobQueueRecord>}
   * @memberof SubmissionService
   */
  async getSubmissionJobQueue(submissionId: number): Promise<ISubmissionJobQueueRecord> {
    return this.submissionRepository.getSubmissionJobQueue(submissionId);
  }

  /**
   * Insert a new metadata record
   *
   * @param {ISubmissionMetadataRecord} submissonMetadata
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionMetadataRecord(
    submissonMetadata: ISubmissionMetadataRecord
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.insertSubmissionMetadataRecord(submissonMetadata);
  }

  /**
   * Insert a new Observation Record
   *
   * @param {ISubmissionObservationRecord} submissonObservation
   * @return {*}  {Promise<{ submission_observation_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionObservationRecord(
    submissonObservation: ISubmissionObservationRecord
  ): Promise<{ submission_observation_id: number }> {
    return this.submissionRepository.insertSubmissionObservationRecord(submissonObservation);
  }

  /**
   * Retrieves an array of datasets related to the given dataset.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<RelatedDataset[]>}
   * @memberof SubmissionService
   */
  async findRelatedDatasetsByDatasetId(datasetId: string): Promise<RelatedDataset[]> {
    const emlJson = await this.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (!emlJson) {
      return [];
    }

    const result = JSONPath({
      path: '$..eml:eml..relatedProject',
      json: emlJson,
      resultType: 'all'
    });

    if (!result.length) {
      return [];
    }

    return result[0].value.map((relatedProject: any) => {
      return {
        datasetId: relatedProject['@_id'],
        title: relatedProject['title'],
        url: [relatedProject['@_system'], relatedProject['@_id']].join('/')
      };
    });
  }

  /**
   * Fetches a count of artifacts that require security review for 'PROJECT' datasets
   * This function will 'roll' all artifact counts for a single parent project. 
   * 
   * @param {string} keys An array of tags to refine the dataset
   * @returns {*} {Promise<DatasetsToReview[]>}
   * @memberof SubmissionService
   */
  async getDatasetsForReview(keys: string[]): Promise<DatasetsToReview[]> {
    const data = await this.submissionRepository.getDatasetsForReview();

    // collect file counts into dictionary
    const file_count = {};
    data.forEach(item => file_count[item.dataset_id] = item.artifacts_to_review);

    // combine artifact counts for all related projects
    data.map(item => {
      item.related_projects.forEach(id => {
        item.artifacts_to_review += file_count[id]
      })

      return item;
    });
    
    // only return '' to the front end to so it appears that all artifacts are 'rolled' into single parent project
    // this filter should eventually but it was difficult to 'roll' these counts up under a parent dataset
    return data.filter(item => keys.includes(item.dataset_type.toUpperCase()));
  }
  /**
   * 
   * @param submissionId 
   * @param submitterSystem 
   * @param datasetSearch 
   * @returns 
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataWithSearchKeys(submissionId: number, submitterSystem: string, datasetSearch: any): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataWithSearchKeys(submissionId, submitterSystem, datasetSearch);
  }
}
