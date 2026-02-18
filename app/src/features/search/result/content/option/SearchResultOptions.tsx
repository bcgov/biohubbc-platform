import { Box, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { APIError } from 'hooks/api/useAxios';
import { useCartContext, useDialogContext } from 'hooks/useContext';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback, useMemo } from 'react';
import { SearchResultCardLayout } from '../../layout/list/SearchResultCardLayout';
import { SearchResultTableLayout } from '../../layout/table/SearchResultTableLayout';
import { SEARCH_RESULT_OPTION_VIEW } from '../../SearchResultPage';

interface SearchResultOptionsProps {
  rows: SearchFeatureResultWithRelevancy[];
  isLoading: boolean;
  view: SEARCH_RESULT_OPTION_VIEW;
  onDownload?: (result: SearchFeatureResultWithRelevancy) => void;
}

export const SearchResultOptions = ({ rows, isLoading, view, onDownload }: SearchResultOptionsProps) => {
  const { features, addToCart, removeFromCart } = useCartContext();
  const dialogContext = useDialogContext();

  const hasResults = rows.length > 0;

  // Build set of feature IDs in cart for quick lookup
  const cartFeatureIds = useMemo(() => {
    return new Set(features.map((f) => f.submission_feature_id));
  }, [features]);

  const handleAddToCart = useCallback(
    async (result: SearchFeatureResultWithRelevancy) => {
      try {
        await addToCart([result]);
      } catch (error) {
        dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
      }
    },
    [addToCart, dialogContext]
  );

  const handleRemoveFromCart = useCallback(
    async (featureId: number) => {
      try {
        await removeFromCart([featureId]);
      } catch (error) {
        dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
      }
    },
    [removeFromCart, dialogContext]
  );

  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={<SkeletonList />}
      hasNoData={!hasResults}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography variant="h4" color="textSecondary">
            No results found
          </Typography>
        </Box>
      }>
      <ComponentSwitch<SEARCH_RESULT_OPTION_VIEW>
        switch={view}
        components={{
          table: (
            <SearchResultTableLayout
              results={rows}
              cartFeatureIds={cartFeatureIds}
              onDownload={onDownload}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
              onRowSelectionModelChange={() => {}}
            />
          ),
          list: (
            <SearchResultCardLayout
              results={rows}
              cartFeatureIds={cartFeatureIds}
              onDownload={onDownload}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
            />
          )
        }}
      />
    </LoadingGuard>
  );
};
