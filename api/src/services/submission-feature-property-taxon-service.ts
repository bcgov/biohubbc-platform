import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyTaxon,
  SubmissionFeaturePropertyTaxon
} from '../models/submission-feature-property-taxon';
import { SubmissionFeaturePropertyTaxonRepository } from '../repositories/submission-feature-property-taxon-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyTaxonService extends DBService {
  submissionFeaturePropertyTaxonRepository: SubmissionFeaturePropertyTaxonRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyTaxonService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyTaxonRepository = new SubmissionFeaturePropertyTaxonRepository(connection);
  }

  /**
   * Create a submission_feature_property_taxon row.
   *
   * @param {CreateSubmissionFeaturePropertyTaxon} payload
   * @return {Promise<SubmissionFeaturePropertyTaxon>}
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  createSubmissionFeaturePropertyTaxon(
    payload: CreateSubmissionFeaturePropertyTaxon
  ): Promise<SubmissionFeaturePropertyTaxon> {
    return this.submissionFeaturePropertyTaxonRepository.insertSubmissionFeaturePropertyTaxon(payload);
  }

  /**
   * Create submission_feature_property_taxon rows in bulk.
   *
   * @param {CreateSubmissionFeaturePropertyTaxon[]} payloads
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  createSubmissionFeaturePropertyTaxons(
    payloads: CreateSubmissionFeaturePropertyTaxon[]
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    return this.submissionFeaturePropertyTaxonRepository.insertSubmissionFeaturePropertyTaxons(payloads);
  }

  /**
   * Get a submission_feature_property_taxon row by id.
   *
   * @param {number} submissionFeaturePropertyTaxonId
   * @return {Promise<SubmissionFeaturePropertyTaxon>}
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  getSubmissionFeaturePropertyTaxonById(
    submissionFeaturePropertyTaxonId: number
  ): Promise<SubmissionFeaturePropertyTaxon> {
    return this.submissionFeaturePropertyTaxonRepository.getSubmissionFeaturePropertyTaxonById(
      submissionFeaturePropertyTaxonId
    );
  }

  /**
   * Get submission_feature_property_taxon rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  getSubmissionFeaturePropertyTaxonBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    return this.submissionFeaturePropertyTaxonRepository.getSubmissionFeaturePropertyTaxonBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_taxon rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  getSubmissionFeaturePropertyTaxonByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    return this.submissionFeaturePropertyTaxonRepository.getSubmissionFeaturePropertyTaxonByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Delete submission_feature_property_taxon rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  deleteSubmissionFeaturePropertyTaxonsBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeaturePropertyTaxonRepository.deleteSubmissionFeaturePropertyTaxonsBySubmissionId(
      submissionId
    );
  }

  /**
   * Delete submission_feature_property_taxon rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyTaxonService
   */
  deleteSubmissionFeaturePropertyTaxonsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeaturePropertyTaxonRepository.deleteSubmissionFeaturePropertyTaxonsBySubmissionUploadId(
      submissionUploadId
    );
  }
}
