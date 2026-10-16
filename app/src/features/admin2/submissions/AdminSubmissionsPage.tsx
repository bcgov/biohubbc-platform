import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PrimaryButton } from 'components/button/PrimaryButton';
import PublishedSubmissionsTable from 'features/admin/dashboard/components/PublishedSubmissionsTable';
import ReviewedSubmissionsTable from 'features/admin/dashboard/components/ReviewedSubmissionsTable';
import UnreviewedSubmissionsTable from 'features/admin/dashboard/components/UnreviewedSubmissionsTable';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

/**
 * Administrative submissions page: submissions by review state, one tab per state, with only the selected list
 * mounted.
 *
 * @returns {JSX.Element} Submission lists and creation controls.
 */
export const AdminSubmissionsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pending' | 'complete' | 'published'>('pending');

  return (
    <AdminPageLayout
      title="Submissions"
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
      buttons={
        <PrimaryButton
          onClick={() => navigate('/admin/submissions/create')}
          startIcon={<Icon path={mdiPlus} size={1} />}>
          New Submission
        </PrimaryButton>
      }
      tabs={[
        {
          value: 'pending',
          label: 'Pending Review',
          id: 'submission-pending-tab',
          ariaControls: 'submission-tabpanel'
        },
        {
          value: 'complete',
          label: 'Completed',
          id: 'submission-complete-tab',
          ariaControls: 'submission-tabpanel'
        },
        {
          value: 'published',
          label: 'Published',
          id: 'submission-published-tab',
          ariaControls: 'submission-tabpanel'
        }
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}>
      <Box id="submission-tabpanel" role="tabpanel" aria-labelledby={`submission-${activeTab}-tab`}>
        {activeTab === 'pending' && <UnreviewedSubmissionsTable />}
        {activeTab === 'complete' && <ReviewedSubmissionsTable />}
        {activeTab === 'published' && <PublishedSubmissionsTable />}
      </Box>
    </AdminPageLayout>
  );
};
