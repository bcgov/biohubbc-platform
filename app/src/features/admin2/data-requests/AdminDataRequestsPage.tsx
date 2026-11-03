import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { AdminDataRequestsPoliciesContent } from './content/AdminDataRequestsPoliciesContent';
import { AdminDataRequestsRequestsContent } from './content/AdminDataRequestsRequestsContent';

/**
 * Administrative data requests page: every data request in the system, and the policies that represent them, through
 * URL-addressable tabs. Only the selected tab's table is mounted, so only it loads.
 *
 * @returns {JSX.Element} Data requests tabs and the selected table.
 */
export const AdminDataRequestsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'policies' ? 'policies' : 'requests';

  return (
    <AdminPageLayout
      title="Data Requests"
      breadcrumbs={
        <Breadcrumbs aria-label="data requests breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            Data Requests
          </Typography>
        </Breadcrumbs>
      }
      tabs={[
        { value: 'requests', label: 'Requests', id: 'data-requests-requests', ariaControls: 'data-requests-panel' },
        { value: 'policies', label: 'Policies', id: 'data-requests-policies', ariaControls: 'data-requests-panel' }
      ]}
      activeTab={activeTab}
      onTabChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', value);
        setSearchParams(next);
      }}>
      <Box id="data-requests-panel" role="tabpanel" aria-labelledby={`data-requests-${activeTab}`}>
        {activeTab === 'requests' && <AdminDataRequestsRequestsContent />}
        {activeTab === 'policies' && <AdminDataRequestsPoliciesContent />}
      </Box>
    </AdminPageLayout>
  );
};
