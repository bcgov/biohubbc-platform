import { APIError } from 'hooks/api/useAxios';
import { useCartContext, useDialogContext } from 'hooks/useContext';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback } from 'react';

/**
 * Provides cart state and bulk cart actions for the search result page.
 *
 * Adapts the global cart context into `DownloadSidebar` data and exposes the
 * bulk add-to-cart handler. Cart mutation errors surface through the snackbar.
 *
 * @param {SearchFeatureResultWithRelevancy[]} rows - Current search result rows to add when the bulk save action is triggered.
 * @returns Cart sidebar data and a handler for adding all current rows to the cart.
 */
export const useSearchResultCartActions = (rows: SearchFeatureResultWithRelevancy[]) => {
  const { features, pagination: cartPagination, addToCart } = useCartContext();
  const dialogContext = useDialogContext();

  /**
   * Adds every row currently rendered on the result page to the cart.
   * Cart context handles deduplication and mutation serialization.
   */
  const handleAddAllToCart = useCallback(async () => {
    try {
      await addToCart(rows);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [rows, addToCart, dialogContext]);

  return {
    cart: {
      features,
      itemCount: cartPagination?.total ?? 0
    },
    handleAddAllToCart
  };
};
