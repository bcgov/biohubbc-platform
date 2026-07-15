import { Grid, Pagination, Stack, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useState } from 'react';
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

  const galleryDataLoader = useDataLoader((pageToLoad: number) =>
    api.gallery.getGalleryDownloadsBySlug(HOME_GALLERY_SLUG, { page: pageToLoad, limit: TILES_PER_PAGE })
  );

  // Fetches the current page; `galleryDataLoader.refresh` is an unstable ref, so it's omitted
  // from the deps — the effect re-runs only when `page` changes (first render fetches page 1).
  useEffect(() => {
    galleryDataLoader.refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const downloads = galleryDataLoader.data?.downloads ?? [];
  const lastPage = galleryDataLoader.data?.pagination.last_page ?? 0;

  // Fail closed (see component JSDoc): error, pending first load, and empty result all render
  // nothing. `hasNoData` with no `hasNoDataFallback` makes LoadingGuard render nothing in each case.
  return (
    <LoadingGuard hasNoData={Boolean(galleryDataLoader.error) || downloads.length === 0}>
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
