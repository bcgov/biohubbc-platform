import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { POLICY_STATUS_COLORS, POLICY_STATUS_LABELS } from 'constants/policy';
import { useApi } from 'hooks/useApi';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { getFormattedDate } from 'utils/Utils';
import { AdminDataRequestDecisionActions } from '../header/AdminDataRequestDecisionActions';
import { AdminDataRequestFeatureTypes } from './AdminDataRequestFeatureTypes';
import { AdminDataRequestPolicy } from './AdminDataRequestPolicy';
import { AdminDataRequestPropertySection } from './AdminDataRequestPropertySection';
import { AdminDataRequestRecipients } from './AdminDataRequestRecipients';

type AdminDataRequestTab = 'details' | 'recipients' | 'policy' | 'about';

interface AdminDataRequestPageContentProps {
  dataRequestId: string;
}

/**
 * Shows one data request in the administrative page layout through URL-addressable tabs: the feature types it asks
 * for in Details, the users who receive access in Recipients, the policy that represents it in Policy, and its
 * decision, submitted date and ID in About. Only the selected tab is mounted, so only it loads.
 *
 * @param {AdminDataRequestPageContentProps} props The data request to show.
 * @returns {JSX.Element} Data request header and the selected tab.
 */
export const AdminDataRequestPageContent = ({ dataRequestId }: AdminDataRequestPageContentProps) => {
  const biohubApi = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: AdminDataRequestTab =
    requestedTab === 'recipients' || requestedTab === 'policy' || requestedTab === 'about' ? requestedTab : 'details';

  const dataRequestQuery = useQuery({
    queryKey: policyQueryKeys.dataRequest(dataRequestId),
    queryFn: ({ signal }) => biohubApi.dataRequest.getDataRequest(dataRequestId, { signal })
  });
  const dataRequest = dataRequestQuery.data;

  // The API answers 400 for an id that is not a UUID and 404 for one that matches no data request.
  const errorStatus = isAxiosError(dataRequestQuery.error) ? dataRequestQuery.error.response?.status : undefined;

  if (errorStatus === 400 || errorStatus === 404) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <AdminPageLayout
      title="Data Request"
      breadcrumbs={
        <Breadcrumbs aria-label="data request breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/data-requests" underline="hover" color="inherit">
            Data Requests
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {dataRequestId}
          </Typography>
        </Breadcrumbs>
      }
      buttons={
        dataRequest && (
          <Stack direction="row" spacing={1}>
            <AdminDataRequestDecisionActions dataRequest={dataRequest} />
            <Button
              component={RouterLink}
              to={`/admin/tickets/${dataRequest.ticket_id}`}
              size="small"
              variant="outlined"
              color="primary"
              data-testid="open-ticket-button">
              Open Ticket
            </Button>
          </Stack>
        )
      }
      tabs={[
        { value: 'details', label: 'Details', id: 'data-request-details', ariaControls: 'data-request-panel' },
        {
          value: 'recipients',
          label: 'Recipients',
          id: 'data-request-recipients',
          ariaControls: 'data-request-panel'
        },
        { value: 'policy', label: 'Policy', id: 'data-request-policy', ariaControls: 'data-request-panel' },
        { value: 'about', label: 'About', id: 'data-request-about', ariaControls: 'data-request-panel' }
      ]}
      activeTab={activeTab}
      onTabChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', value);
        setSearchParams(next);
      }}>
      <QueryErrorDialog error={dataRequestQuery.error} label="data request" />
      <Box id="data-request-panel" role="tabpanel" aria-labelledby={`data-request-${activeTab}`}>
        {dataRequestQuery.isPending && <Skeleton variant="rectangular" height={200} />}
        {dataRequest && activeTab === 'details' && (
          <Stack gap={3}>
            <AdminDataRequestPropertySection
              id="data-request-details-section"
              label="Details"
              rows={[
                { id: 'requested_by_name', property: 'Requested By', value: dataRequest.requested_by_name },
                { id: 'reason', property: 'Reason', value: dataRequest.reason }
              ]}
              hideColumnHeaders
            />
            <AdminDataRequestFeatureTypes dataRequestId={dataRequestId} policyId={dataRequest.policy_id} />
          </Stack>
        )}
        {dataRequest && activeTab === 'recipients' && <AdminDataRequestRecipients dataRequestId={dataRequestId} />}
        {dataRequest && activeTab === 'policy' && <AdminDataRequestPolicy policyId={dataRequest.policy_id} />}
        {dataRequest && activeTab === 'about' && (
          <AdminDataRequestPropertySection
            id="data-request-about"
            label="About"
            rows={[
              {
                id: 'status',
                property: 'Decision',
                value: (
                  <Chip
                    label={POLICY_STATUS_LABELS[dataRequest.status]}
                    size="small"
                    color={POLICY_STATUS_COLORS[dataRequest.status]}
                    sx={{ fontWeight: 700 }}
                  />
                )
              },
              {
                id: 'create_date',
                property: 'Submitted Date',
                value: getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, dataRequest.create_date)
              },
              { id: 'data_request_id', property: 'Data Request ID', value: dataRequest.data_request_id }
            ]}
          />
        )}
      </Box>
    </AdminPageLayout>
  );
};
