import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ReviewedSubmissionsTable from 'features/admin/dashboard/components/ReviewedSubmissionsTable';
import UnreviewedSubmissionsTable from 'features/admin/dashboard/components/UnreviewedSubmissionsTable';
import { useState } from 'react';
import { NavLink } from 'react-router';
import PublishedSubmissionsTable from './components/PublishedSubmissionsTable';
import QuarantinedSubmissionsTable from './quarantine/QuarantinedSubmissionsTable';

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'complete' | 'published' | 'quarantined'>('pending');

  return (
    <>
      <Paper square elevation={0}>
        <Container
          maxWidth="xl"
          sx={{
            py: 4,
            pb: 0
          }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              Submissions
            </Typography>
            <Button component={NavLink} to="create" variant="contained" startIcon={<Icon path={mdiPlus} size={1} />}>
              New Submission
            </Button>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            aria-label="basic tabs example"
            sx={{
              mt: 1.5,
              mx: -2
            }}>
            <Tab
              value="quarantined"
              label="Quarantined"
              id="submission-quarantined-tab"
              aria-controls="submission-quarantined-tabpanel"
            />
            <Tab
              value="pending"
              label="Pending Review"
              id="submission-pending-tab"
              aria-controls="submission-pending-tabpanel"
            />
            <Tab
              value="complete"
              label="Completed"
              id="submission-complete-tab"
              aria-controls="submission-complete-tabpanel"
            />
            <Tab
              value="published"
              label="Published"
              id="submission-published-tab"
              aria-controls="submission-published-tabpanel"
            />
          </Tabs>
        </Container>
      </Paper>
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

        {activeTab === 'quarantined' && (
          <Box
            hidden={activeTab !== 'quarantined'}
            id="submission-quarantined-tabpanel"
            aria-labelledby="submission-quarantined-tab">
            <QuarantinedSubmissionsTable />
          </Box>
        )}
      </Container>
    </>
  );
};

export default DashboardPage;
