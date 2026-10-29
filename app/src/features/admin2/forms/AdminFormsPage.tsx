import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AdminFormsFormsContent } from './content/AdminFormsFormsContent';

/**
 * Administrative forms page: every active form in the system, and the entry point for creating a form.
 *
 * @returns {JSX.Element} Forms tab and its table.
 */
export const AdminFormsPage = () => {
  const navigate = useNavigate();

  return (
    <AdminPageLayout
      title="Forms"
      breadcrumbs={
        <Breadcrumbs aria-label="forms breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            Forms
          </Typography>
        </Breadcrumbs>
      }
      buttons={
        <Button
          variant="contained"
          color="primary"
          startIcon={<Icon path={mdiPlus} size={0.8} />}
          onClick={() => navigate('/admin/forms/create')}>
          Create Form
        </Button>
      }
      tabs={[{ value: 'forms', label: 'Forms', id: 'forms-forms', ariaControls: 'forms-panel' }]}
      activeTab="forms"
      onTabChange={() => undefined}>
      <Box id="forms-panel" role="tabpanel" aria-labelledby="forms-forms">
        <AdminFormsFormsContent />
      </Box>
    </AdminPageLayout>
  );
};
