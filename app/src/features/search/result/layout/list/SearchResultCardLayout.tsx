import { Stack } from '@mui/material';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { SearchResultCard } from './card/SearchResultCard';

interface SearchResultCardLayoutProps {
  results: SearchFeatureResultWithRelevancy[];
  onClick?: (result: SearchFeatureResultWithRelevancy) => void;
}

export const SearchResultCardLayout = ({ results, onClick }: SearchResultCardLayoutProps) => {
  return (
    <Stack gap={2}>
      {results.map((result) => (
        <SearchResultCard key={result.submission_feature_id} result={result} onClick={onClick} />
      ))}
    </Stack>
  );
};
