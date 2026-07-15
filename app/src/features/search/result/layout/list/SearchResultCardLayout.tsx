import { Stack } from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { SearchResultCard } from './card/SearchResultCard';

interface SearchResultCardLayoutProps {
  /** Result rows rendered as cards. */
  results: SearchFeatureResultWithRelevancy[];
  /** Opens the selected result's feature detail page. */
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
}

/**
 * Renders search results in a card list.
 *
 * List-view layout for result cards.
 *
 * @param {SearchResultCardLayoutProps} props - Results and row click callback.
 * @returns {JSX.Element} Stacked result cards.
 */
export const SearchResultCardLayout = ({ results, onClick }: SearchResultCardLayoutProps) => {
  return (
    <Stack gap={2}>
      {results.map((result) => (
        <SearchResultCard key={result.submission_feature_id} result={result} onClick={onClick} />
      ))}
    </Stack>
  );
};
