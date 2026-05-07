import { Box, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { SEARCH_RESULT_VIEW } from 'constants/search';
import { APIError } from 'hooks/api/useAxios';
import { useCartContext, useDialogContext } from 'hooks/useContext';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback, useMemo } from 'react';
import { SearchResultCardLayout } from '../../layout/list/SearchResultCardLayout';
import { SearchResultTableLayout } from '../../layout/table/SearchResultTableLayout';

interface SearchResultOptionsProps {
  rows: SearchFeatureResultWithRelevancy[];
  isLoading: boolean;
  view: SEARCH_RESULT_VIEW;
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
}

export const SearchResultOptions = ({ rows, isLoading, view, onClick }: SearchResultOptionsProps) => {
  const { features, addToCart, removeFromCart } = useCartContext();
  const dialogContext = useDialogContext();

  const hasResults = rows.length > 0;

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
          <Typography variant="body2" color="text.secondary">
            No results found
          </Typography>
        </Box>
      }>
      <ComponentSwitch<SEARCH_RESULT_VIEW>
        switch={view}
        components={{
          [SEARCH_RESULT_VIEW.TABLE]: (
            <SearchResultTableLayout
              results={rows}
              cartFeatureIds={cartFeatureIds}
              onClick={onClick}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
            />
          ),
          [SEARCH_RESULT_VIEW.LIST]: (
            <SearchResultCardLayout
              results={rows}
              cartFeatureIds={cartFeatureIds}
              onClick={onClick}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
            />
          )
        }}
      />
    </LoadingGuard>
  );
};
