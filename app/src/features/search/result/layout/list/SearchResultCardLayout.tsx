import { Stack } from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { SearchResultCard } from './card/SearchResultCard';

interface SearchResultCardLayoutProps {
  results: SearchFeatureResultWithRelevancy[];
  cartFeatureIds: Set<number>;
  onDownload?: (result: SearchFeatureResultWithRelevancy) => void;
  onAddToCart?: (result: SearchFeatureResultWithRelevancy) => void;
  onRemoveFromCart?: (featureId: number) => void;
}

export const SearchResultCardLayout = ({
  results,
  cartFeatureIds,
  onDownload,
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
          onDownload={onDownload}
          onAddToCart={onAddToCart}
          onRemoveFromCart={onRemoveFromCart}
        />
      ))}
    </Stack>
  );
};
