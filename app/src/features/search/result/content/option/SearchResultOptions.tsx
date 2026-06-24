import { Box, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { SEARCH_RESULT_VIEW } from 'constants/search';
import { FeatureTypeProperty } from 'interfaces/useCodesApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { SearchResultCardLayout } from '../../layout/list/SearchResultCardLayout';
import { SearchResultTableLayout } from '../../layout/table/SearchResultTableLayout';

interface SearchResultOptionsProps {
  /** Search result rows rendered by the active table or list layout. */
  rows: SearchFeatureResultWithRelevancy[];
  /** Feature type property metadata used by the table layout. */
  featureTypeProperties: FeatureTypeProperty[];
  /** Whether the result request is currently loading. */
  isLoading: boolean;
  /** Active result layout selected in the toolbar. */
  view: SEARCH_RESULT_VIEW;
  /** Opens the selected result's feature detail page. */
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
}

/**
 * Chooses the active result layout.
 *
 * Selects the active result layout. The parent owns search state and pagination.
 *
 * @param {SearchResultOptionsProps} props - Rows, loading state, selected view, and result-click callback.
 * @returns {JSX.Element} Loading, empty, table, or card result content.
 */
export const SearchResultOptions = ({
  rows,
  featureTypeProperties,
  isLoading,
  view,
  onClick
}: SearchResultOptionsProps) => {
  const hasResults = rows.length > 0;

  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={<SkeletonList />}
      hasNoData={!hasResults}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography variant="body2" color="text.secondary">
            No results found
          </Typography>
        </Box>
      }>
      <ComponentSwitch<SEARCH_RESULT_VIEW>
        switch={view}
        components={{
          [SEARCH_RESULT_VIEW.TABLE]: (
            <SearchResultTableLayout results={rows} featureTypeProperties={featureTypeProperties} onClick={onClick} />
          ),
          [SEARCH_RESULT_VIEW.LIST]: <SearchResultCardLayout results={rows} onClick={onClick} />
        }}
      />
    </LoadingGuard>
  );
};
