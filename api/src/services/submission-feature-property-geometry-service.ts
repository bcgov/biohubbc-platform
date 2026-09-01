import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyGeometry,
  GeometryBoundingBox,
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

  /**
   * Store a spatial property value for a submission feature.
   *
   * @param {CreateSubmissionFeaturePropertyGeometry} payload - Geometry value and the feature property it belongs to.
   * @return {*}  {Promise<SubmissionFeaturePropertyGeometry>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  createSubmissionFeaturePropertyGeometry(
    payload: CreateSubmissionFeaturePropertyGeometry
  ): Promise<SubmissionFeaturePropertyGeometry> {
    return this.submissionFeaturePropertyGeometryRepository.insertSubmissionFeaturePropertyGeometry(payload);
  }

  /**
   * Get a single stored spatial property value by its own id.
   *
   * @param {number} submissionFeaturePropertyGeometryId
   * @return {*}  {Promise<SubmissionFeaturePropertyGeometry>}
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
   * Get every stored spatial property value belonging to one submission feature.
   *
   * @param {number} submissionFeatureId
   * @return {*}  {Promise<SubmissionFeaturePropertyGeometry[]>}
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
   * Get the combined extent and count of a submission feature's published spatial properties.
   *
   * Answers whether a feature can be mapped at all, and where the map should open. The geometry
   * values themselves are deliberately not returned: they reach the browser as vector tiles from the
   * gateway, never through this API.
   *
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @return {*}  {Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  getActiveGeometryExtent(
    submissionId: number,
    submissionFeatureId: number
  ): Promise<{ bbox: GeometryBoundingBox | null; geometry_count: number }> {
    return this.submissionFeaturePropertyGeometryRepository.getActiveGeometryExtent(submissionId, submissionFeatureId);
  }

  /**
   * Get every stored spatial property value recorded against one feature type property.
   *
   * @param {number} featureTypePropertyId
   * @return {*}  {Promise<SubmissionFeaturePropertyGeometry[]>}
   * @memberof SubmissionFeaturePropertyGeometryService
   */
  getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyGeometry[]> {
    return this.submissionFeaturePropertyGeometryRepository.getSubmissionFeaturePropertyGeometryByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }
}
