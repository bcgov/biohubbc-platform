import { Stack } from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { SearchResultCard } from './card/SearchResultCard';

interface SearchResultCardLayoutProps {
  /** Result rows rendered as cards. */
  results: SearchFeatureResultWithRelevancy[];
  /** Submission feature ids currently present in the cart. */
  cartFeatureIds: Set<number>;
  /** Opens the selected result's feature detail page. */
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
  /** Adds the selected result to the cart. */
  onAddToCart?: (result: SearchFeatureResultWithRelevancy) => void;
  /** Removes the selected feature id from the cart. */
  onRemoveFromCart?: (featureId: number) => void;
}

/**
 * Renders search results in a card list.
 *
 * Use this layout when the result toolbar selects the list view. It receives
 * cart membership as a set from `SearchResultOptions` and passes only the row
 * actions needed by each card.
 *
 * @param {SearchResultCardLayoutProps} props - Results, cart ids, and row action callbacks.
 * @returns {JSX.Element} Stacked result cards.
 */
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
