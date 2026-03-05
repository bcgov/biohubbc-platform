import { mdiCheck, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import {
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  Typography
} from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';

interface SearchResultCardProps {
  result: SearchFeatureResultWithRelevancy;
  isInCart: boolean;
  onClick?: (result: SearchFeatureResultWithRelevancy) => void;
  onDownload?: (result: SearchFeatureResultWithRelevancy) => void;
  onAddToCart?: (result: SearchFeatureResultWithRelevancy) => void;
  onRemoveFromCart?: (featureId: number) => void;
}

export const SearchResultCard = ({ result, isInCart, onClick, onAddToCart, onRemoveFromCart }: SearchResultCardProps) => {
  return (
    <Card elevation={0} key={result.uuid}>
      <CardActionArea onClick={() => onClick?.(result)}>
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
