import { Alert, Box, Breadcrumbs, Link, Skeleton, Stack, Typography } from '@mui/material';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { useApi } from 'hooks/useApi';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { refreshChangedQueries } from 'utils/query-client';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ContributorCodesetCodePanel } from './content/ContributorCodesetCodePanel';

/**
 * Read-only page of one of a contributor's codesets, listing its codes.
 *
 * @returns Codeset header and its codes.
 */
export const ContributorCodesetDetailPage = () => {
  const { contributorId, contributorCodesetId } = useParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const contributorQuery = useQuery({
    queryKey: ['administration', 'contributors', Number(contributorId)],
    queryFn: () => api.contributors.getContributor(Number(contributorId))
  });
  const codesetQueryKey = [
    'administration',
    'contributors',
    Number(contributorId),
    'codeset',
    Number(contributorCodesetId)
  ];
  const codesetQuery = useQuery({
    queryKey: codesetQueryKey,
    queryFn: () => api.contributors.getContributorCodeset(Number(contributorId), Number(contributorCodesetId))
  });
  const contributor = contributorQuery.data;
  const codeset = codesetQuery.data;

  /**
   * Refresh the codeset after a failed load.
   *
   * @returns Resolves after the mounted codeset query refreshes.
   */
  const handleRefresh = () => refreshChangedQueries(queryClient, [codesetQueryKey]);
  return (
    <AdminPageLayout
      breadcrumbs={
        <Breadcrumbs aria-label="codeset breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/users" underline="hover" color="inherit">
            Users
          </Link>
          <Link component={RouterLink} to="/admin/users?tab=contributors" underline="hover" color="inherit">
            Contributors
          </Link>
          <Link
            component={RouterLink}
            to={`/admin/users/contributor/${contributorId}?tab=codesets`}
            underline="hover"
            color="inherit">
            {contributor?.client_id ?? `Contributor ${contributorId}`}
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {codeset?.label ?? `Codeset ${contributorCodesetId}`}
          </Typography>
        </Breadcrumbs>
      }
      title={codeset ? codeset.label : <Skeleton width={240} height={48} />}
      description={codeset?.description}
      descriptionDialogTitle="Codeset description"
      tabs={[{ value: 'codes', label: 'Codes', id: 'codeset-codes-tab', ariaControls: 'codeset-codes-panel' }]}
      activeTab="codes"
      onTabChange={() => {}}>
      <Stack gap={3}>
        {Boolean(codesetQuery.error) && (
          <Alert severity="error" action={<SecondaryButton onClick={handleRefresh}>Retry</SecondaryButton>}>
            Unable to load codeset. It may not exist for this contributor.
          </Alert>
        )}
        {!codeset && !codesetQuery.error && <Skeleton variant="rectangular" height={200} />}
        {codeset && (
          <Box role="tabpanel" id="codeset-codes-panel" aria-labelledby="codeset-codes-tab">
            <ContributorCodesetCodePanel codeset={codeset} />
          </Box>
        )}
      </Stack>
    </AdminPageLayout>
  );
};
