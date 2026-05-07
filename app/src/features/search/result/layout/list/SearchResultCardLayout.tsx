import { Stack } from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { SearchResultCard } from './card/SearchResultCard';

interface SearchResultCardLayoutProps {
  results: SearchFeatureResultWithRelevancy[];
  cartFeatureIds: Set<number>;
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
  onAddToCart?: (result: SearchFeatureResultWithRelevancy) => void;
  onRemoveFromCart?: (featureId: number) => void;
}

export const SearchResultCardLayout = ({
  results,
  cartFeatureIds,
  onClick,
  onAddToCart,
  onRemoveFromCart
}: SearchResultCardLayoutProps) => {
  return (
    <Stack gap={2}>
      {results.map((result) => (
        <SearchResultCard
          key={result.submission_feature_id}
          result={result}
          isInCart={cartFeatureIds.has(result.submission_feature_id)}
          onClick={onClick}
          onAddToCart={onAddToCart}
          onRemoveFromCart={onRemoveFromCart}
        />
      ))}
    </Stack>
  );
};
