import { mdiCheck, mdiLock, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import {
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';

interface SearchResultCardProps {
  /** Result row represented by this card. */
  result: SearchFeatureResultWithRelevancy;
  /** Whether the result is already in the cart. */
  isInCart: boolean;
  /** Opens the selected result's feature detail page. */
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
  /** Adds this result to the cart. */
  onAddToCart?: (result: SearchFeatureResultWithRelevancy) => void;
  /** Removes this result from the cart by submission feature id. */
  onRemoveFromCart?: (featureId: number) => void;
}

/**
 * Displays a single search result in list/card mode.
 *
 * Displays one result summary with secured state, feature-type chip, and the
 * cart action matching current cart membership.
 *
 * @param {SearchResultCardProps} props - Result row, cart state, and card action callbacks.
 * @returns {JSX.Element} Search result card.
 */
export const SearchResultCard = ({
  result,
  isInCart,
  onClick,
  onAddToCart,
  onRemoveFromCart
}: SearchResultCardProps) => {
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
        <CardContent sx={{ pt: 0 }}>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              maxWidth: 800,
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
            {result.feature_description}
          </Typography>
        </CardContent>
      </CardActionArea>
      <CardActions sx={{ px: 2, py: 1.5, gap: 0.5, display: 'flex', justifyContent: 'flex-end' }}>
        {isInCart ? (
          <IconButton
            size="small"
            title="Remove from Cart"
            onClick={() => {
              onRemoveFromCart?.(result.submission_feature_id);
            }}>
            <Icon path={mdiCheck} size={1} />
          </IconButton>
        ) : (
          <IconButton
            size="small"
            title="Add to Cart"
            onClick={() => {
              onAddToCart?.(result);
            }}>
            <Icon path={mdiPlus} size={1} />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
};
