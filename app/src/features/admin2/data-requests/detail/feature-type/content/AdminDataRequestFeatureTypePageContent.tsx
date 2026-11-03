import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { useApi } from 'hooks/useApi';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { AdminDataRequestFeatureTypeFeatures } from './AdminDataRequestFeatureTypeFeatures';

interface AdminDataRequestFeatureTypePageContentProps {
  dataRequestId: string;
  featureType: string;
}

/**
 * Shows one feature type of a data request in the administrative page layout, with the requested features of that
 * type in a Features tab. A feature type the request does not ask for is not found.
 *
 * @param {AdminDataRequestFeatureTypePageContentProps} props The data request and the feature type to show.
 * @returns {JSX.Element} Feature type header and the requested features.
 */
export const AdminDataRequestFeatureTypePageContent = ({
  dataRequestId,
  featureType
}: AdminDataRequestFeatureTypePageContentProps) => {
  const biohubApi = useApi();
  const title = getFeatureTypeDisplayLabel(featureType);

  const featureTypesQuery = useQuery({
    queryKey: policyQueryKeys.dataRequestFeatureTypes(dataRequestId),
    queryFn: ({ signal }) => biohubApi.dataRequest.getDataRequestFeatureTypes(dataRequestId, { signal })
  });
  const requestedFeatureType = featureTypesQuery.data?.feature_types.find(
    (requested) => requested.feature_type_name === featureType
  );

  // The API answers 400 for an id that is not a UUID and 404 for one that matches no data request.
  const errorStatus = isAxiosError(featureTypesQuery.error) ? featureTypesQuery.error.response?.status : undefined;
  const isUnknownDataRequest = errorStatus === 400 || errorStatus === 404;
  const isUnrequestedFeatureType = Boolean(featureTypesQuery.data) && !requestedFeatureType;

  if (isUnknownDataRequest || isUnrequestedFeatureType) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <AdminPageLayout
      title={title}
      breadcrumbs={
        <Breadcrumbs aria-label="data request feature type breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/data-requests" underline="hover" color="inherit">
            Data Requests
          </Link>
          <Link component={RouterLink} to={`/admin/data-requests/${dataRequestId}`} underline="hover" color="inherit">
            {dataRequestId}
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {title}
          </Typography>
        </Breadcrumbs>
      }
      tabs={[
        {
          value: 'features',
          label: 'Features',
          id: 'data-request-feature-type-features-tab',
          ariaControls: 'data-request-feature-type-features-panel'
        }
      ]}
      activeTab="features"
      onTabChange={() => {}}>
      <QueryErrorDialog error={featureTypesQuery.error} label="feature types" />
      <Box
        role="tabpanel"
        id="data-request-feature-type-features-panel"
        aria-labelledby="data-request-feature-type-features-tab">
        {requestedFeatureType ? (
          <AdminDataRequestFeatureTypeFeatures featureType={featureType} expression={requestedFeatureType.expression} />
        ) : (
          <Skeleton variant="rectangular" height={300} />
        )}
      </Box>
    </AdminPageLayout>
  );
};
