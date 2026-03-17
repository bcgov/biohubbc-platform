import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { useSessionStorage } from 'hooks/useSessionStorage';
import { CartFeatureListResponse, CheckoutCartResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import React, { useCallback, useMemo, useReducer } from 'react';
import {
  cartReducer,
  DEFAULT_PAGINATION,
  getUniqueFeaturesToAdd,
  isInvalidCachedCartError
} from './cartContext.helpers';
import { CartSnapshot, ICartContext } from './cartContext.interface';
import { useCartLifecycle } from './useCartLifecycle';
import { useCartOptimisticActions } from './useCartOptimisticActions';

export const CartContext = React.createContext<ICartContext | undefined>(undefined);

/**
 * Provides cart state and actions to descendants.
 *
 * Coordinates three concerns:
 * - Lifecycle: loading, identity, and stale-cart recovery (useCartLifecycle)
 * - Mutations: optimistic add/remove/clear with rollback (useCartOptimisticActions)
 * - Serialization: operation lock prevents concurrent mutations racing each other
 */
export const CartContextProvider = ({ children }: React.PropsWithChildren) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const authStateContext = useAuthStateContext();
  const [storedCartId, setStoredCartId] = useSessionStorage<string | null>('cart_id', null);

  // Operation lock: while one mutation or checkout is in flight, overlapping
  // calls are dropped. Prevents optimistic races across add/remove/clear/checkout.
  const { runSerialized } = useSerializedAsync();

  const [state, dispatch] = useReducer(cartReducer, {
    cartId: storedCartId,
    features: [],
    pagination: DEFAULT_PAGINATION,
    isLoading: false,
    error: undefined
  });

  // Reconciles local state with the latest server payload.
  const applyLoadSuccess = useCallback((response: CartFeatureListResponse) => {
    dispatch({ type: 'LOAD_SUCCESS', payload: response });
  }, []);

  // Applies an optimistic snapshot for immediate UI feedback before the API responds.
  const applyOptimisticSnapshot = useCallback((snapshot: CartSnapshot) => {
    dispatch({ type: 'OPTIMISTIC_SET', payload: snapshot });
  }, []);

  const handleClaimError = (error: APIError) => {
    dialogContext.setSnackbar({ open: true, snackbarMessage: error.message });
  };

  const { createCart } = useCartLifecycle({
    cartApi: api.cart,
    isAuthenticated: authStateContext.auth.isAuthenticated,
    storedCartId,
    setStoredCartId,
    state,
    dispatch,
    applyLoadSuccess,
    handleClaimError
  });

  const { addToExistingCart, removeFromExistingCart, clearExistingCart } = useCartOptimisticActions({
    state,
    cartApi: api.cart,
    applyLoadSuccess,
    applyOptimisticSnapshot
  });

  // Creates a cart if none exists, otherwise optimistically adds new features.
  // Recovers from stale cart ids by creating a fresh cart on 4xx failures.
  const addToCart = useCallback(
    async (featuresToAdd: SearchFeatureResultWithRelevancy[]): Promise<void> => {
      if (!featuresToAdd.length) {
        return;
      }

      await runSerialized(async () => {
        let optimisticAdds: SearchFeatureResultWithRelevancy[] = [];

        try {
          if (!state.cartId) {
            await createCart({ features: featuresToAdd });
            return;
          }

          optimisticAdds = getUniqueFeaturesToAdd(state.features, featuresToAdd);
          if (!optimisticAdds.length) {
            return;
          }

          await addToExistingCart(state.cartId, optimisticAdds);
        } catch (error) {
          if (optimisticAdds.length > 0 && isInvalidCachedCartError(error)) {
            await createCart({ features: optimisticAdds });
            return;
          }

          throw error;
        }
      });
    },
    [addToExistingCart, createCart, runSerialized, state.cartId, state.features]
  );

  const removeFromCart = useCallback(
    async (featureIds: number[]): Promise<void> => {
      if (!state.cartId || !featureIds.length) {
        return;
      }

      const cartId = state.cartId;
      await runSerialized(() => removeFromExistingCart(cartId, featureIds));
    },
    [removeFromExistingCart, runSerialized, state.cartId]
  );

  const clearCart = useCallback(async (): Promise<void> => {
    if (!state.cartId) {
      return;
    }

    const cartId = state.cartId;
    await runSerialized(() => clearExistingCart(cartId));
  }, [clearExistingCart, runSerialized, state.cartId]);

  // Checks out the cart and resets all cart state on success.
  const checkout = useCallback(async (): Promise<CheckoutCartResponse | null> => {
    if (!state.cartId) {
      return null;
    }

    const cartId = state.cartId;

    const response = await runSerialized(async () => {
      const download = await api.cart.checkoutCart(cartId);
      dispatch({ type: 'RESET' });
      return download;
    });

    return response ?? null;
  }, [api.cart, runSerialized, state.cartId]);

  const value: ICartContext = useMemo(
    () => ({
      cartId: state.cartId,
      features: state.features,
      pagination: state.pagination,
      isLoading: state.isLoading,
      error: state.error,
      addToCart,
      removeFromCart,
      clearCart,
      checkout
    }),
    [
      addToCart,
      checkout,
      clearCart,
      removeFromCart,
      state.cartId,
      state.features,
      state.pagination,
      state.isLoading,
      state.error
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
