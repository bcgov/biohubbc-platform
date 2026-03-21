import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyTaxon,
  SubmissionFeaturePropertyTaxon
} from '../models/submission-feature-property-taxon';
import { SubmissionFeaturePropertyTaxonRepository } from '../repositories/submission-feature-property-taxon-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyTaxonService extends DBService {
  submissionFeaturePropertyTaxonRepository: SubmissionFeaturePropertyTaxonRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyTaxonRepository = new SubmissionFeaturePropertyTaxonRepository(connection);
  }

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

  getSubmissionFeaturePropertyTaxonById(
    submissionFeaturePropertyTaxonId: number
  ): Promise<SubmissionFeaturePropertyTaxon> {
    return this.submissionFeaturePropertyTaxonRepository.getSubmissionFeaturePropertyTaxonById(
      submissionFeaturePropertyTaxonId
    );
  }

  getSubmissionFeaturePropertyTaxonBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    return this.submissionFeaturePropertyTaxonRepository.getSubmissionFeaturePropertyTaxonBySubmissionFeatureId(
      submissionFeatureId
    );
  }

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
