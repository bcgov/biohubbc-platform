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

  getSubmissionFeaturePropertyTaxonByBlueprintFeatureTypePropertyId(
    blueprintFeatureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    return this.submissionFeaturePropertyTaxonRepository.getSubmissionFeaturePropertyTaxonByBlueprintFeatureTypePropertyId(
      blueprintFeatureTypePropertyId
    );
  }
}
