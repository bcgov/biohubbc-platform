import { Alert, Box, Breadcrumbs, Container, Link, Skeleton, Stack, Typography } from '@mui/material';
import { SecondaryButton } from 'components/button/SecondaryButton';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ContributorAbout } from './content/ContributorAbout';
import { ContributorUserPanel } from './content/ContributorUserPanel';
import { ContributorDialog } from './dialog/ContributorDialog';

type ContributorDetailTab = 'users' | 'metadata';

/**
 * Contributor details and scoped relationship administration.
 * @returns Contributor fields, actions and its relationship table.
 */
export const ContributorDetailPage = () => {
  const { contributorId } = useParams();
  const api = useApi();
  const [activeTab, setActiveTab] = useState<ContributorDetailTab>('users');
  const [isEditing, setIsEditing] = useState(false);
  const loader = useDataLoader((id: number) => api.contributors.getContributor(id));
  useEffect(() => {
    loader.refresh(Number(contributorId));
    // The loader exposes unstable callbacks; reload only when the route identifier changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributorId]);
  const contributor = loader.data?.contributor_id === Number(contributorId) ? loader.data : undefined;
  const handleRefresh = () => loader.refresh(Number(contributorId));
  const handleEdit = () => setIsEditing(true);
  const handleClose = () => setIsEditing(false);
  return (
    <>
      <PageHeader
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
        label={contributor ? contributor.client_id : <Skeleton width={240} height={48} />}
        buttons={
          contributor &&
          !contributor.record_end_date && (
            <SecondaryButton size="small" onClick={handleEdit}>
              Edit
            </SecondaryButton>
          )
        }
        description={contributor?.description}
        descriptionDialogTitle="Contributor Description"
        tabs={
          <TabGroup<ContributorDetailTab>
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="Contributor detail sections"
            tabs={[
              { value: 'users', label: 'Users', id: 'contributor-users-tab', ariaControls: 'contributor-users-panel' },
              {
                value: 'metadata',
                label: 'Metadata',
                id: 'contributor-metadata-tab',
                ariaControls: 'contributor-metadata-panel'
              }
            ]}
          />
        }
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack gap={3}>
          {Boolean(loader.error) && (
            <Alert severity="error" action={<SecondaryButton onClick={handleRefresh}>Retry</SecondaryButton>}>
              Unable to load contributor. It may not exist or you may not have access.
            </Alert>
          )}
          {!contributor && !loader.error && <Skeleton variant="rectangular" height={200} />}
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
              {activeTab === 'metadata' && (
                <Box role="tabpanel" id="contributor-metadata-panel" aria-labelledby="contributor-metadata-tab">
                  <ContributorAbout contributor={contributor} />
                </Box>
              )}
            </>
          )}
        </Stack>
      </Container>
      {isEditing && contributor && !contributor.record_end_date && (
        <ContributorDialog record={contributor} onClose={handleClose} onSaved={handleRefresh} />
      )}
    </>
  );
};
