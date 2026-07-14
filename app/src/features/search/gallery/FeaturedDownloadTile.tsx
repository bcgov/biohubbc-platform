import { Card, CardActionArea, Stack, Typography } from '@mui/material';
import { GalleryDownloadTile } from 'interfaces/useGalleryApi.interface';
import { useNavigate } from 'react-router';
import { formatFeatureCount } from 'utils/Utils';

interface FeaturedDownloadTileProps {
  /** Gallery download represented by this tile. */
  download: GalleryDownloadTile;
}

/**
 * A single featured-download card in the landing page's "Featured Downloads" grid. Clicking
 * anywhere on the card navigates to the download's public landing page.
 *
 * The count line is derived via `formatFeatureCount` and rendered only when it returns a
 * string: versions materialized before counting existed carry a NULL `feature_count`, and the
 * tile omits the line entirely rather than rendering a broken value.
 *
 * @param {FeaturedDownloadTileProps} props - Gallery download to display.
 * @returns {JSX.Element} Featured download tile.
 */
export const FeaturedDownloadTile = ({ download }: FeaturedDownloadTileProps) => {
  const navigate = useNavigate();
  const countLine = formatFeatureCount(download.feature_count);

  return (
    <Card variant="outlined" sx={{ height: 1 }}>
      <CardActionArea onClick={() => navigate(`/download/${download.download_id}`)} sx={{ height: 1, p: 2 }}>
        <Stack gap={1}>
          <Typography variant="h4">{download.name}</Typography>
          {download.description ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
              {download.description}
            </Typography>
          ) : null}
          {countLine ? (
            <Typography variant="body2" color="text.secondary" fontWeight={700}>
              {countLine}
            </Typography>
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
};
