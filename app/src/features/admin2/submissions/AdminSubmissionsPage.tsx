import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { AdminSubmissionsSubmissionsContent } from './content/AdminSubmissionsSubmissionsContent';
import { AdminSubmissionsUploadsContent } from './content/AdminSubmissionsUploadsContent';

/**
 * Administrative submissions page: every submission in the system, and every upload across those submissions,
 * through URL-addressable tabs. Only the selected tab's table is mounted, so only it loads.
 *
 * @returns {JSX.Element} Submissions tabs, the selected table and submission creation controls.
 */
export const AdminSubmissionsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'uploads' ? 'uploads' : 'submissions';

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
          value: 'submissions',
          label: 'Submissions',
          id: 'submissions-submissions',
          ariaControls: 'submissions-panel'
        },
        { value: 'uploads', label: 'Uploads', id: 'submissions-uploads', ariaControls: 'submissions-panel' }
      ]}
      activeTab={activeTab}
      onTabChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', value);
        setSearchParams(next);
      }}>
      <Box id="submissions-panel" role="tabpanel" aria-labelledby={`submissions-${activeTab}`}>
        {activeTab === 'submissions' && <AdminSubmissionsSubmissionsContent />}
        {activeTab === 'uploads' && <AdminSubmissionsUploadsContent />}
      </Box>
    </AdminPageLayout>
  );
};
