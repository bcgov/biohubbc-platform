import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { BlueprintsSection } from 'features/admin/configuration/section/BlueprintsSection';
import { FeaturePropertiesSection } from 'features/admin/configuration/section/FeaturePropertiesSection';
import { FeatureTypesSection } from 'features/admin/configuration/section/FeatureTypesSection';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';

/**
 * Administrative configuration page: global schema metadata through URL-addressable tabs, with only the selected
 * table mounted.
 *
 * @returns {JSX.Element} Configuration tabs and the selected section.
 */
export const AdminConfigurationPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = requestedTab === 'properties' || requestedTab === 'feature-types' ? requestedTab : 'blueprints';

  return (
    <AdminPageLayout
      title="Configuration"
      breadcrumbs={
        <Breadcrumbs aria-label="configuration breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            Configuration
          </Typography>
        </Breadcrumbs>
      }
      tabs={[
        {
          value: 'blueprints',
          label: 'Blueprints',
          id: 'configuration-blueprints',
          ariaControls: 'configuration-panel'
        },
        {
          value: 'feature-types',
          label: 'Feature Types',
          id: 'configuration-feature-types',
          ariaControls: 'configuration-panel'
        },
        {
          value: 'properties',
          label: 'Properties',
          id: 'configuration-properties',
          ariaControls: 'configuration-panel'
        }
      ]}
      activeTab={activeTab}
      onTabChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', value);
        setSearchParams(next);
      }}>
      <Box id="configuration-panel" role="tabpanel" aria-labelledby={`configuration-${activeTab}`}>
        {activeTab === 'blueprints' && <BlueprintsSection />}
        {activeTab === 'feature-types' && <FeatureTypesSection />}
        {activeTab === 'properties' && <FeaturePropertiesSection />}
      </Box>
    </AdminPageLayout>
  );
};
