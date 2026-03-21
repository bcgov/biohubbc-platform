import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyGeometry,
  SubmissionFeaturePropertyGeometry
} from '../models/submission-feature-property-geometry';
import { SubmissionFeaturePropertyGeometryRepository } from '../repositories/submission-feature-property-geometry-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyGeometryService extends DBService {
  submissionFeaturePropertyGeometryRepository: SubmissionFeaturePropertyGeometryRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyGeometryRepository = new SubmissionFeaturePropertyGeometryRepository(connection);
  }

  createSubmissionFeaturePropertyGeometry(
    payload: CreateSubmissionFeaturePropertyGeometry
  ): Promise<SubmissionFeaturePropertyGeometry> {
    return this.submissionFeaturePropertyGeometryRepository.insertSubmissionFeaturePropertyGeometry(payload);
  }

  getSubmissionFeaturePropertyGeometryById(
    submissionFeaturePropertyGeometryId: number
  ): Promise<SubmissionFeaturePropertyGeometry> {
    return this.submissionFeaturePropertyGeometryRepository.getSubmissionFeaturePropertyGeometryById(
      submissionFeaturePropertyGeometryId
    );
  }

  getSubmissionFeaturePropertyGeometryBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    return this.submissionFeaturePropertyGeometryRepository.getSubmissionFeaturePropertyGeometryBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    return this.submissionFeaturePropertyGeometryRepository.getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }
}
