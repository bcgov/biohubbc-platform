import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ReviewedSubmissionsTable from 'features/admin/dashboard/components/ReviewedSubmissionsTable';
import UnreviewedSubmissionsTable from 'features/admin/dashboard/components/UnreviewedSubmissionsTable';
import { useState } from 'react';

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'complete'>('pending');

  return (
    <>
      <Paper square elevation={0}>
        <Container
          maxWidth="xl"
          sx={{
            py: 4,
            pb: 0
          }}>
          <Typography variant="h2" component="h1" sx={{ml: '-2px'}}>
            Submissions
          </Typography>

          <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label="basic tabs example"
            sx={{
              mt: 1.5,
              mx: -2,
            }}
          >
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
      </Container>
    </>
  );
};

export default DashboardPage;
