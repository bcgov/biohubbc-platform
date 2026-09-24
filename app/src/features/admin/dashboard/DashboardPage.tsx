import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import ReviewedSubmissionsTable from 'features/admin/dashboard/components/ReviewedSubmissionsTable';
import UnreviewedSubmissionsTable from 'features/admin/dashboard/components/UnreviewedSubmissionsTable';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import PublishedSubmissionsTable from './components/PublishedSubmissionsTable';

/**
 * Administrative submission dashboard with review tabs and header navigation.
 * @returns Submission lists and creation controls.
 */
const DashboardPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pending' | 'complete' | 'published'>('pending');

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="submissions breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Submissions
            </Typography>
          </Breadcrumbs>
        }
        label="Submissions"
        buttons={
          <PrimaryButton
            onClick={() => navigate('/admin/submissions/create')}
            startIcon={<Icon path={mdiPlus} size={1} />}>
            New Submission
          </PrimaryButton>
        }
        tabs={
          <Box mx={2}>
            <TabGroup
              value={activeTab}
              onChange={setActiveTab}
              ariaLabel="submission dashboard tabs"
              sx={{ mx: -2 }}
              tabs={[
                {
                  value: 'pending',
                  label: 'Pending Review',
                  id: 'submission-pending-tab',
                  ariaControls: 'submission-pending-tabpanel'
                },
                {
                  value: 'complete',
                  label: 'Completed',
                  id: 'submission-complete-tab',
                  ariaControls: 'submission-complete-tabpanel'
                },
                {
                  value: 'published',
                  label: 'Published',
                  id: 'submission-published-tab',
                  ariaControls: 'submission-published-tabpanel'
                }
              ]}
            />
          </Box>
        }
      />
      <Container
        maxWidth="xl"
        sx={{
          py: 4,
          px: 3
        }}>
        {activeTab === 'pending' && (
          <Box id="submission-pending-tabpanel" aria-labelledby="submission-pending-tab">
            <UnreviewedSubmissionsTable />
          </Box>
        )}
        {activeTab === 'complete' && (
          <Box
            hidden={activeTab !== 'complete'}
            id="submission-complete-tabpanel"
            aria-labelledby="submission-complete-tab">
            <ReviewedSubmissionsTable />
          </Box>
        )}

        {activeTab === 'published' && (
          <Box
            hidden={activeTab !== 'published'}
            id="submission-published-tabpanel"
            aria-labelledby="submission-published-tab">
            <PublishedSubmissionsTable />
          </Box>
        )}
      </Container>
    </>
  );
};

export default DashboardPage;
