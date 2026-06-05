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
  /** Search result rows rendered by the active table or list layout. */
  rows: SearchFeatureResultWithRelevancy[];
  /** Whether the result request is currently loading. */
  isLoading: boolean;
  /** Active result layout selected in the toolbar. */
  view: SEARCH_RESULT_VIEW;
  /** Opens the selected result's feature detail page. */
  onClick: (result: SearchFeatureResultWithRelevancy) => void;
}

/**
 * Chooses the active result layout and wires per-row cart actions.
 *
 * Selects the active result layout and keeps cart membership/error handling near
 * the rendered row controls. The parent owns search state and pagination.
 *
 * @param {SearchResultOptionsProps} props - Rows, loading state, selected view, and result-click callback.
 * @returns {JSX.Element} Loading, empty, table, or card result content.
 */
export const SearchResultOptions = ({ rows, isLoading, view, onClick }: SearchResultOptionsProps) => {
  const { features, addToCart, removeFromCart } = useCartContext();
  const dialogContext = useDialogContext();

  const hasResults = rows.length > 0;

  const cartFeatureIds = useMemo(() => {
    return new Set(features.map((f) => f.submission_feature_id));
  }, [features]);

  /**
   * Adds one rendered search result to the cart.
   * Add failures are reported through the global snackbar.
   *
   * @param {SearchFeatureResultWithRelevancy} result - Result row selected for cart addition.
   */
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

  /**
   * Removes one rendered search result from the cart.
   * Remove failures are reported through the global snackbar.
   *
   * @param {number} featureId - Submission feature id to remove from the cart.
   */
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
