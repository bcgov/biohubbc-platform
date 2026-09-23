import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { useSearchParams } from 'react-router-dom';
import { FeatureTypesSection } from './section/FeatureTypesSection';
import { FeaturePropertiesSection } from './section/FeaturePropertiesSection';
import { BlueprintsSection } from './section/BlueprintsSection';

/**
 * Manage global schema metadata through URL-addressable administrative tabs.
 * @returns Configuration page with only the selected table mounted.
 */
export const ConfigurationPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = requestedTab === 'properties' || requestedTab === 'feature-types' ? requestedTab : 'blueprints';
  return (
    <>
      <PageHeader
        label="Configuration"
        breadcrumbs={
          <Breadcrumbs aria-label="Configuration breadcrumb">
            <Typography color="text.primary">Configuration</Typography>
          </Breadcrumbs>
        }
        tabs={
          <Tabs
            value={tab}
            aria-label="Configuration"
            onChange={(_event, value: string) => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', value);
              setSearchParams(next);
            }}>
            <Tab
              value="blueprints"
              label="Blueprints"
              id="configuration-blueprints"
              aria-controls="configuration-panel"
            />
            <Tab
              value="feature-types"
              label="Feature Types"
              id="configuration-feature-types"
              aria-controls="configuration-panel"
            />
            <Tab
              value="properties"
              label="Properties"
              id="configuration-properties"
              aria-controls="configuration-panel"
            />
          </Tabs>
        }
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box id="configuration-panel" role="tabpanel" aria-labelledby={`configuration-${tab}`}>
          {tab === 'feature-types' && <FeatureTypesSection />}
          {tab === 'properties' && <FeaturePropertiesSection />}
          {tab === 'blueprints' && <BlueprintsSection />}
        </Box>
      </Container>
    </>
  );
};
