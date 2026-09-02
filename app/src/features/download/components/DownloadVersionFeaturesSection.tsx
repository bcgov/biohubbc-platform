import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { PageSection } from 'components/section/PageSection';

/**
 * Renders the placeholder section for the future browser-side Parquet feature reader.
 *
 * @return {JSX.Element} The Features section with its current no-data fallback.
 */
export const DownloadVersionFeaturesSection = () => (
  <PageSection id="download-version-features" label="Features">
    <LoadingGuard hasNoData hasNoDataFallback={<Typography sx={{ p: 2 }}>Failed to load rows</Typography>} />
  </PageSection>
);
