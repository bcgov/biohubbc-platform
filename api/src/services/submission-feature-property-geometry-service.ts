import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometry
} from '../models/submission-feature-property-geometry';
import { SubmissionFeaturePropertyGeometryRepository } from '../repositories/submission-feature-property-geometry-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyGeometryService extends DBService {
  submissionFeaturePropertyGeometryRepository: SubmissionFeaturePropertyGeometryRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyGeometryService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyGeometryRepository = new SubmissionFeaturePropertyGeometryRepository(connection);
  }

  /**
   * Create a submission_feature_property_geometry row.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry} payload
   * @return {Promise<SubmissionFeaturePropertyGeometry>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  createSubmissionFeaturePropertyGeometry(
    payload: CreateSubmissionFeaturePropertyGeometry
  ): Promise<SubmissionFeaturePropertyGeometry> {
    return this.submissionFeaturePropertyGeometryRepository.insertSubmissionFeaturePropertyGeometry(payload);
  }

  /**
   * Create submission_feature_property_geometry rows in bulk.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry[]} payloads
   * @return {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  createSubmissionFeaturePropertyGeometries(
    payloads: CreateSubmissionFeaturePropertyGeometry[]
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    return this.submissionFeaturePropertyGeometryRepository.insertSubmissionFeaturePropertyGeometries(payloads);
  }

  /**
   * Get a submission_feature_property_geometry row by id.
   *
   * @param {number} submissionFeaturePropertyGeometryId
   * @return {Promise<SubmissionFeaturePropertyGeometry>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  getSubmissionFeaturePropertyGeometryById(
    submissionFeaturePropertyGeometryId: number
  ): Promise<SubmissionFeaturePropertyGeometry> {
    return this.submissionFeaturePropertyGeometryRepository.getSubmissionFeaturePropertyGeometryById(
      submissionFeaturePropertyGeometryId
    );
  }

  /**
   * Get submission_feature_property_geometry rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  getSubmissionFeaturePropertyGeometryBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    return this.submissionFeaturePropertyGeometryRepository.getSubmissionFeaturePropertyGeometryBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_geometry rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    return this.submissionFeaturePropertyGeometryRepository.getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Delete submission_feature_property_geometry rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  deleteSubmissionFeaturePropertyGeometriesBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeaturePropertyGeometryRepository.deleteSubmissionFeaturePropertyGeometriesBySubmissionId(
      submissionId
    );
  }

  /**
   * Delete submission_feature_property_geometry rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  deleteSubmissionFeaturePropertyGeometriesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeaturePropertyGeometryRepository.deleteSubmissionFeaturePropertyGeometriesBySubmissionUploadId(
      submissionUploadId
    );
  }
}
