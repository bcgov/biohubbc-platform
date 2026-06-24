import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { Card, CardActionArea, CardHeader, Chip, Stack, Typography } from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';

interface SearchResultCardProps {
  /** Result row represented by this card. */
  result: SearchFeatureResultWithRelevancy;
  /** Opens the selected result's feature detail page. */
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
}

/**
 * Displays a single search result in list/card mode.
 *
 * Displays one result summary with secured state and feature-type chip.
 *
 * @param {SearchResultCardProps} props - Result row and click callback.
 * @returns {JSX.Element} Search result card.
 */
export const SearchResultCard = ({ result, onClick }: SearchResultCardProps) => {
  return (
    <Card elevation={0}>
      <CardActionArea onClick={() => onClick(result)}>
        <CardHeader
          title={
            <Typography
              variant="h4"
              component="h3"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
              {result.feature_type_name}
            </Typography>
          }
          action={
            <Stack direction="row" alignItems="center" gap={0.75}>
              {result.is_secured && <Icon path={mdiLock} size={0.75} color="#d32f2f" data-testid="secured-icon" />}
              <Chip
                label={result.feature_type_name}
                size="small"
                sx={{
                  my: '-2px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}
              />
            </Stack>
          }
          sx={{
            pb: 1,
            '& .MuiCardHeader-action': {
              margin: 0
            }
          }}
        />
      </CardActionArea>
    </Card>
  );
};
