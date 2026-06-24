import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';

export const createMockSearchFeature = (
  id: number,
  featureTypeName: string,
  isSecured: boolean
): SearchFeatureResultWithRelevancy => ({
  submission_feature_id: id,
  submission_id: 100 + id,
  uuid: `feature-${id}`,
  feature_type_id: 200 + id,
  feature_type_name: featureTypeName,
  submission_name: `Submission ${id}`,
  properties: {},
  is_secured: isSecured,
  relevancy_score: 1,
  create_date: '2026-01-01T00:00:00.000Z'
});
