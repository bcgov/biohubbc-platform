import { useCallback, useEffect, useRef } from 'react';
import { isInvalidCachedCartError } from './cartContext.helpers';
import { IUseCartLifecycleParams, IUseCartLifecycleResult } from './useCartLifecycle.interface';

/**
 * Owns cart identity/lifecycle orchestration:
 * loading by cart id, stale-id recovery, anonymous cart claiming, and cart creation.
 */
export const useCartLifecycle = (params: IUseCartLifecycleParams): IUseCartLifecycleResult => {
  const { cartApi, isAuthenticated, storedCartId, setStoredCartId, state, dispatch, applyLoadSuccess } = params;

  const cartApiRef = useRef(cartApi);
  const hasClaimedCurrentCart = useRef(false);
  const skipNextLoadForCartId = useRef<string | null>(null);

  useEffect(() => {
    cartApiRef.current = cartApi;
  }, [cartApi]);

  useEffect(() => {
    dispatch({ type: 'SET_CART_ID', payload: storedCartId });
  }, [dispatch, storedCartId]);

  useEffect(() => {
    hasClaimedCurrentCart.current = false;
  }, [state.cartId]);

  /**
   * Updates both persisted cart id (session storage) and reducer state.
   */
  const setCartId = useCallback(
    (nextCartId: string | null) => {
      setStoredCartId(nextCartId);
      dispatch({ type: 'SET_CART_ID', payload: nextCartId });
    },
    [dispatch, setStoredCartId]
  );

  const clearCachedCartId = useCallback(() => {
    setCartId(null);
  }, [setCartId]);

  /**
   * Claims anonymous carts for authenticated users once per cart id.
   */
  const claimCartIfNeeded = useCallback(
    async (cartId: string, systemUserId: number | null): Promise<void> => {
      if (!isAuthenticated || systemUserId !== null || hasClaimedCurrentCart.current) {
        return;
      }

      try {
        hasClaimedCurrentCart.current = true;
        await cartApiRef.current.assignCartToCurrentUser(cartId);
      } catch (error) {
        hasClaimedCurrentCart.current = false;
        console.error('Failed to claim cart for authenticated user:', error);
      }
    },
    [isAuthenticated]
  );

  /**
   * Loads cart contents when cart id changes, with stale cart id recovery.
   */
  useEffect(() => {
    const cartId = state.cartId;

    if (!cartId) {
      dispatch({ type: 'RESET' });
      return;
    }

    if (skipNextLoadForCartId.current === cartId) {
      skipNextLoadForCartId.current = null;
      return;
    }

    let isMounted = true;

    const loadCart = async () => {
      dispatch({ type: 'LOAD_START' });

      try {
        const response = await cartApiRef.current.getCartById(cartId);

        if (!isMounted) {
          return;
        }

        applyLoadSuccess(response);
        await claimCartIfNeeded(cartId, response.cart.system_user_id);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (isInvalidCachedCartError(error)) {
          clearCachedCartId();
          return;
        }

        dispatch({ type: 'LOAD_ERROR', payload: error });
      }
    };

    loadCart();

    return () => {
      isMounted = false;
    };
  }, [applyLoadSuccess, claimCartIfNeeded, clearCachedCartId, dispatch, state.cartId]);

  /**
   * Creates a new cart, updates local cart id, and applies server payload immediately.
   */
  const createCart: IUseCartLifecycleResult['createCart'] = useCallback(
    async (options) => {
      const { features = [] } = options;

      const response = await cartApiRef.current.createCart({
        features: features.map((feature) => feature.submission_feature_id)
      });

      skipNextLoadForCartId.current = response.cart.cart_id;
      setCartId(response.cart.cart_id);
      hasClaimedCurrentCart.current = false;

      applyLoadSuccess(response);
      await claimCartIfNeeded(response.cart.cart_id, response.cart.system_user_id);
    },
    [applyLoadSuccess, claimCartIfNeeded, setCartId]
  );

  return {
    setCartId,
    createCart
  };
};
