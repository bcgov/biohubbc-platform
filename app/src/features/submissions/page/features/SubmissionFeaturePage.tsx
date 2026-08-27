import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionFeatureDetailContent } from './components/SubmissionFeatureDetailContent';

export const SubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const biohubApi = useApi();

  const params = useParams<{ submissionId: string; submissionFeatureId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);

  const featureDataLoader = useDataLoader(
    (submissionId, submissionFeatureId) =>
      biohubApi.features.getSubmissionFeatureById(submissionId, submissionFeatureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );
  useEffect(() => {
    if (submissionId === null || submissionFeatureId === null) {
      return;
    }

    featureDataLoader.refresh(submissionId, submissionFeatureId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId]);

  const { feature, relatedFeatures } = useMemo(
    () => featureDataLoader.data ?? { feature: undefined, relatedFeatures: undefined },
    [featureDataLoader.data]
  );
  const isLoading = featureDataLoader.isLoading;

  if (submissionId === null || submissionFeatureId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <SubmissionFeatureDetailContent
      isLoading={isLoading}
      feature={feature}
      relatedFeatures={relatedFeatures ?? []}
      submissionId={submissionId}
      submissionFeatureId={submissionFeatureId}
      rootBreadcrumbLabel="Search"
      rootBreadcrumbTo={`/search/${location.search}`}
      submissionDetailBasePath="/submission"
      featureRouteBasePath="/submission"
      queryString={location.search}
    />
  );
};
