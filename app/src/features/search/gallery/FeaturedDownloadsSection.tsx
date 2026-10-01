import { Grid, Pagination, Stack, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useApi } from 'hooks/useApi';
import { useState } from 'react';
import { galleryQueryKeys } from 'utils/query-keys/gallery-query-keys';
import { FeaturedDownloadTile } from './FeaturedDownloadTile';

/**
 * Slug of the curated landing-page gallery. The gallery is addressed by slug — never by id —
 * because gallery ids differ per environment while the slug is the stable handle.
 */
const HOME_GALLERY_SLUG = 'home';

const TILES_PER_PAGE = 9;

/**
 * "Featured Downloads" grid rendered on the landing (search) page: a paged grid of tiles for
 * the curated home gallery, each linking to that download's public landing page.
 *
 * Fails closed: the landing page is the app's front door — any fetch error (including a 404
 * for a private or missing gallery), a pending first load, or an empty result renders nothing.
 * Never an empty shell, a loading skeleton, or an error state.
 */
export const FeaturedDownloadsSection = () => {
  const api = useApi();
  const [page, setPage] = useState(1);

  const pagination = { page, limit: TILES_PER_PAGE };
  const galleryQuery = useQuery({
    queryKey: galleryQueryKeys.downloads(HOME_GALLERY_SLUG, pagination),
    queryFn: ({ signal }) => api.gallery.getGalleryDownloadsBySlug(HOME_GALLERY_SLUG, pagination, { signal }),
    placeholderData: keepPreviousData
  });

  const downloads = galleryQuery.data?.downloads ?? [];
  const lastPage = galleryQuery.data?.pagination.last_page ?? 0;

  // Fail closed (see component JSDoc): error, pending first load, and empty result all render
  // nothing. `hasNoData` with no `hasNoDataFallback` makes LoadingGuard render nothing in each case.
  return (
    <LoadingGuard hasNoData={Boolean(galleryQuery.error) || downloads.length === 0}>
      <Stack gap={2} mt={5}>
        <Typography variant="h3">Featured Downloads</Typography>
        <Grid container spacing={3}>
          {downloads.map((download) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={download.download_id}>
              <FeaturedDownloadTile download={download} />
            </Grid>
          ))}
        </Grid>
        {lastPage > 1 ? (
          <Stack alignItems="center">
            <Pagination count={lastPage} page={page} onChange={(_, newPage) => setPage(newPage)} shape="rounded" />
          </Stack>
        ) : null}
      </Stack>
    </LoadingGuard>
  );
};
