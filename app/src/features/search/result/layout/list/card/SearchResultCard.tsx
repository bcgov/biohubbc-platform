import { Button, Card, CardActions, CardContent, CardHeader, Chip, Typography } from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';

interface SearchResultCardProps {
  result: SearchFeatureResultWithRelevancy;
  onClick?: (result: SearchFeatureResultWithRelevancy) => void;
}

export const SearchResultCard = ({ result, onClick }: SearchResultCardProps) => {
  return (
    <Card elevation={0} key={result.uuid}>
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
      <CardActions sx={{ px: 2, py: 1.5 }}>
        <Button
          variant="outlined"
          onClick={() => {
            if (onClick) {
              onClick(result);
            }
          }}>
          View Details
        </Button>
      </CardActions>
    </Card>
  );
};
