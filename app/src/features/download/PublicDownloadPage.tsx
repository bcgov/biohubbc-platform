import { mdiHelpCircleOutline, mdiRefresh } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { useApi } from 'hooks/useApi';
import { APIError } from 'hooks/api/useAxios';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { PublicDownloadPageContent } from './PublicDownloadPageContent';

/**
 * Public download landing page reached from the create-download success flow.
 *
 * The download UUID in the URL path is the credential: the backend's
 * `getAuthorizedDownload` accepts either an anonymous (teamless) download for
 * any caller, or a team-owned download for a caller on that team. This page
 * therefore renders identically regardless of whether the visitor is signed in
 * — there is no `auth.isAuthenticated` branching here, by design. (Don't import
 * `useAuthStateContext` in this file; the page must be a flat surface across
 * auth states so the URL alone determines visibility.)
 *
 * 404 (no such download) and 403 (claimed by another team) are collapsed into
 * a single dead-end card. Distinguishing them would leak the existence of
 * claimed downloads to a guessing attacker. Other errors (5xx / network) are
 * not treated as dead-ends — they surface as a loading/no-data state so a
 * retry via the refresh button can recover.
 *
 * Refresh is manual (an `IconButton` in the header), not polled. The page is
 * single-use and short-lived, so a polling lifecycle is over-investment;
 * users who want the latest status click refresh.
 */
export const PublicDownloadPage = () => {
  const { downloadId } = useParams<{ downloadId: string }>();
  const api = useApi();
  const downloadDataLoader = useDataLoader((id: string) => api.download.getDownload(id));

  useEffect(() => {
    if (downloadId) {
      downloadDataLoader.load(downloadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadId]);

  const download = downloadDataLoader.data;
  const apiError = downloadDataLoader.error as APIError | undefined;
  const isDeadEnd = apiError?.status === 404 || apiError?.status === 403;

  if (isDeadEnd) {
    return <DeadEndCard />;
  }

  return (
    <LoadingGuard isLoading={downloadDataLoader.isLoading && !download} isLoadingFallback={<SkeletonPage />}>
      {download ? (
        <>
          <PageHeader
            label="Download"
            subheader={download.name}
            buttons={
              <IconButton
                title="Refresh"
                onClick={() => downloadId && downloadDataLoader.refresh(downloadId)}
                disabled={downloadDataLoader.isLoading}>
                <Icon path={mdiRefresh} size={0.8} />
              </IconButton>
            }
          />
          <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', mb: 2 }}>
              id: {download.download_id}
            </Typography>
            <PublicDownloadPageContent download={download} />
          </Container>
        </>
      ) : null}
    </LoadingGuard>
  );
};

/**
 * Single "this download is not available" card used for both 404 and 403.
 * Inlined as a sibling component because it is small and only used here —
 * a separate file would be over-investment.
 */
const DeadEndCard = () => (
  <Container maxWidth="sm">
    <Box pt={6} textAlign="center">
      <Icon path={mdiHelpCircleOutline} size={2} color="#ff5252" />
      <h1>Download not available</h1>
      <Typography>This download link is invalid or no longer accessible.</Typography>
    </Box>
  </Container>
);
