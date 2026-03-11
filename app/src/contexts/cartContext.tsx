import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
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
 * Provides cart state and cart actions to descendants.
 * Coordinates lifecycle loading, optimistic mutations, and operation serialization.
 */
export const CartContextProvider = ({ children }: React.PropsWithChildren) => {
  const api = useApi();
  const authStateContext = useAuthStateContext();
  const [storedCartId, setStoredCartId] = useSessionStorage<string | null>('cart_id', null);
  // Shared cart-operation lock:
  // while one mutation/checkout is in flight, overlapping calls are dropped.
  // This prevents optimistic races across add/remove/clear/checkout.
  const { runSerialized } = useSerializedAsync();

  const [state, dispatch] = useReducer(cartReducer, {
    cartId: storedCartId,
    features: [],
    pagination: DEFAULT_PAGINATION,
    isLoading: false,
    error: undefined
  });

  /**
   * Reconciles local cart state with the latest server payload.
   */
  const applyLoadSuccess = useCallback((response: CartFeatureListResponse) => {
    dispatch({ type: 'LOAD_SUCCESS', payload: response });
  }, []);

  /**
   * Restores the previous cart snapshot after an optimistic failure.
   */
  const applyRollback = useCallback((snapshot: CartSnapshot) => {
    dispatch({ type: 'ROLLBACK', payload: snapshot });
  }, []);

  /**
   * Applies a transient optimistic cart snapshot for immediate UI feedback.
   */
  const applyOptimisticSnapshot = useCallback((snapshot: CartSnapshot) => {
    dispatch({ type: 'OPTIMISTIC_SET', payload: snapshot });
  }, []);

  const { setCartId, createCart } = useCartLifecycle({
    cartApi: api.cart,
    isAuthenticated: authStateContext.auth.isAuthenticated,
    storedCartId,
    setStoredCartId,
    state,
    dispatch,
    applyLoadSuccess
  });

  const { addToExistingCart, removeFromExistingCart, clearExistingCart } = useCartOptimisticActions({
    state,
    cartApi: api.cart,
    applyLoadSuccess,
    applyRollback,
    applyOptimisticSnapshot
  });

  /**
   * Adds features to cart with stale-cart recovery behavior.
   *
   * Creates a cart when missing; otherwise performs optimistic add to existing cart.
   */
  const addToCart = useCallback(
    async (featuresToAdd: SearchFeatureResultWithRelevancy[]): Promise<void> => {
      if (!featuresToAdd.length) {
        return;
      }

      // Serialize add flow so it cannot interleave with other cart writes.
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

  /**
   * Removes features from an existing cart using optimistic update and rollback.
   */
  const removeFromCart = useCallback(
    async (featureIds: number[]): Promise<void> => {
      if (!state.cartId || !featureIds.length) {
        return;
      }

      const cartId = state.cartId;
      // Serialize remove flow so optimistic snapshots are applied in a single sequence.
      await runSerialized(() => removeFromExistingCart(cartId, featureIds));
    },
    [removeFromExistingCart, runSerialized, state.cartId]
  );

  /**
   * Clears an existing cart using optimistic update and rollback.
   */
  const clearCart = useCallback(async (): Promise<void> => {
    if (!state.cartId) {
      return;
    }

    const cartId = state.cartId;
    // Serialize clear flow so no concurrent write can race rollback/commit.
    await runSerialized(() => clearExistingCart(cartId));
  }, [clearExistingCart, runSerialized, state.cartId]);

  /**
   * Checks out the current cart under the same operation lock as mutations.
   */
  const checkout = useCallback(async (): Promise<CheckoutCartResponse | null> => {
    if (!state.cartId) {
      return null;
    }

    const cartId = state.cartId;

    // Serialize checkout with writes to avoid clearing cart during another mutation.
    const response = await runSerialized(async () => {
      const download = await api.cart.checkoutCart(cartId);
      setCartId(null);
      return download;
    });

    return response ?? null;
  }, [api.cart, runSerialized, setCartId, state.cartId]);

  const value: ICartContext = useMemo(
    () => ({
      features: state.features,
      pagination: state.pagination,
      isLoading: state.isLoading,
      error: state.error,
      addToCart,
      removeFromCart,
      clearCart,
      checkout
    }),
    [addToCart, checkout, clearCart, removeFromCart, state.features, state.pagination, state.isLoading, state.error]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
