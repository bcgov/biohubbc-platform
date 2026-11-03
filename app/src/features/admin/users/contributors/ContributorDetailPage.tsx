import { Alert, Box, Breadcrumbs, Link, Skeleton, Stack, Typography } from '@mui/material';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { useApi } from 'hooks/useApi';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { refreshChangedQueries } from 'utils/query-client';
import { useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { ContributorAbout } from './content/ContributorAbout';
import { ContributorCodesetPanel } from './content/ContributorCodesetPanel';
import { ContributorUserPanel } from './content/ContributorUserPanel';
import { ContributorDialog } from './dialog/ContributorDialog';

type ContributorDetailTab = 'users' | 'codesets' | 'metadata';

const CONTRIBUTOR_DETAIL_TABS: ContributorDetailTab[] = ['users', 'codesets', 'metadata'];

/**
 * Contributor details and scoped relationship administration.
 * @returns Contributor fields, actions and its relationship table.
 */
export const ContributorDetailPage = () => {
  const { contributorId } = useParams();
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  // The tab is kept in the URL so pages linked from a tab, such as a codeset, can link back to it.
  const requestedTab = CONTRIBUTOR_DETAIL_TABS.find((tab) => tab === searchParams.get('tab'));
  const activeTab = requestedTab ?? 'users';
  const handleTabChange = (value: ContributorDetailTab) => setSearchParams(value === 'users' ? {} : { tab: value });
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['administration', 'contributors', Number(contributorId)],
    queryFn: () => api.contributors.getContributor(Number(contributorId))
  });
  const contributor = query.data;

  /**
   * Refresh the contributor detail and cached lists after a metadata change.
   *
   * @returns Resolves after mounted contributor queries refresh.
   */
  const handleRefresh = () => refreshChangedQueries(queryClient, [['administration', 'contributors']]);
  const handleEdit = () => setIsEditing(true);
  const handleClose = () => setIsEditing(false);
  return (
    <>
      <AdminPageLayout
        breadcrumbs={
          <Breadcrumbs aria-label="contributor breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Link component={RouterLink} to="/admin/users" underline="hover" color="inherit">
              Users
            </Link>
            <Link component={RouterLink} to="/admin/users?tab=contributors" underline="hover" color="inherit">
              Contributors
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              {contributor?.client_id ?? `Contributor ${contributorId}`}
            </Typography>
          </Breadcrumbs>
        }
        title={contributor ? contributor.client_id : <Skeleton width={240} height={48} />}
        buttons={
          contributor &&
          !contributor.record_end_date && (
            <SecondaryButton size="small" onClick={handleEdit}>
              Edit
            </SecondaryButton>
          )
        }
        tabs={[
          { value: 'users', label: 'Users', id: 'contributor-users-tab', ariaControls: 'contributor-users-panel' },
          {
            value: 'codesets',
            label: 'Codesets',
            id: 'contributor-codesets-tab',
            ariaControls: 'contributor-codesets-panel'
          },
          {
            value: 'metadata',
            label: 'About',
            id: 'contributor-metadata-tab',
            ariaControls: 'contributor-metadata-panel'
          }
        ]}
        activeTab={activeTab}
        onTabChange={handleTabChange}>
        <Stack gap={3}>
          {Boolean(query.error) && (
            <Alert severity="error" action={<SecondaryButton onClick={handleRefresh}>Retry</SecondaryButton>}>
              Unable to load contributor. It may not exist or you may not have access.
            </Alert>
          )}
          {!contributor && !query.error && <Skeleton variant="rectangular" height={200} />}
          {contributor && (
            <>
              <Box
                role="tabpanel"
                id="contributor-users-panel"
                aria-labelledby="contributor-users-tab"
                hidden={activeTab !== 'users'}>
                <ContributorUserPanel
                  key={`${contributor.contributor_id}:${contributor.record_end_date ?? ''}`}
                  contributor={contributor}
                />
              </Box>
              {activeTab === 'codesets' && (
                <Box role="tabpanel" id="contributor-codesets-panel" aria-labelledby="contributor-codesets-tab">
                  <ContributorCodesetPanel contributor={contributor} />
                </Box>
              )}
              {activeTab === 'metadata' && (
                <Box role="tabpanel" id="contributor-metadata-panel" aria-labelledby="contributor-metadata-tab">
                  <ContributorAbout contributor={contributor} />
                </Box>
              )}
            </>
          )}
        </Stack>
      </AdminPageLayout>
      {isEditing && contributor && !contributor.record_end_date && (
        <ContributorDialog record={contributor} onClose={handleClose} onSaved={handleRefresh} />
      )}
    </>
  );
};
