import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import ReviewedSubmissionsTable from 'features/admin/dashboard/components/ReviewedSubmissionsTable';
import UnreviewedSubmissionsTable from 'features/admin/dashboard/components/UnreviewedSubmissionsTable';
import { useState } from 'react';
import { NavLink } from 'react-router';
import PublishedSubmissionsTable from './components/PublishedSubmissionsTable';

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'complete' | 'published'>('pending');

  return (
    <>
      <PageHeader
        label="Submissions"
        buttons={
          <Button component={NavLink} to="create" variant="contained" startIcon={<Icon path={mdiPlus} size={1} />}>
            New Submission
          </Button>
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
