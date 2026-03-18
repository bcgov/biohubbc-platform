import { APIError } from 'hooks/api/useAxios';
import useDataLoader from 'hooks/useDataLoader';
import { CartFeatureListResponse } from 'interfaces/useCartApi.interface';
import { useCallback, useEffect, useRef } from 'react';
import { isInvalidCachedCartError } from './cartContext.helpers';
import { IUseCartLifecycleParams, IUseCartLifecycleResult } from './useCartLifecycle.interface';

/**
 * Manages cart identity and loading lifecycle.
 *
 * Responsibilities:
 * - Treats persisted cart id (session storage) as the cart identity source
 * - Loads cart contents when the cart id changes
 * - Claims anonymous carts for authenticated users
 * - Creates new carts and seeds state without a redundant fetch
 * - Recovers from stale/invalid cached cart ids
 */
export const useCartLifecycle = (params: IUseCartLifecycleParams): IUseCartLifecycleResult => {
  const { cartApi, isAuthenticated, cartId, setStoredCartId, dispatch, applyLoadSuccess, handleClaimError } = params;

  // Tracks whether we've already claimed the current cart for the authenticated user.
  // Reset whenever the active cart id changes.
  const hasClaimedCurrentCart = useRef(false);

  // When set, the load effect skips one fetch for this cart id.
  // Used after createCart to avoid re-fetching a cart we just created.
  const skipNextLoadForCartId = useRef<string | null>(null);

  useEffect(() => {
    hasClaimedCurrentCart.current = false;
  }, [cartId]);

  // Fetches cart contents by id and applies the server response to the reducer.
  // Claims anonymous carts for authenticated users as a side effect.
  // Errors are handled via onError: stale ids clear storage and reset state;
  // other errors are stored in the reducer for consumers to surface.
  const cartDataLoader = useDataLoader(
    async (cartId: string): Promise<CartFeatureListResponse> => {
      const response = await cartApi.getCartById(cartId);

      if (isAuthenticated && response.cart.system_user_id === null && !hasClaimedCurrentCart.current) {
        try {
          hasClaimedCurrentCart.current = true;
          await cartApi.assignCartToCurrentUser(cartId);
        } catch (error) {
          hasClaimedCurrentCart.current = false;
          handleClaimError(error as APIError);
        }
      }

      applyLoadSuccess(response);
      return response;
    },
    (error) => {
      if (isInvalidCachedCartError(error)) {
        // Stale or invalid cart id — clear storage and reset to empty cart state.
        setStoredCartId(null);
        dispatch({ type: 'RESET' });
      } else {
        dispatch({ type: 'LOAD_ERROR', payload: error });
      }
    }
  );

  // Refresh cart contents whenever the active cart id changes.
  // Resets state when there is no cart id (e.g. after checkout).
  // Skips the fetch if createCart already seeded the state for this id.
  useEffect(() => {
    if (!cartId) {
      dispatch({ type: 'RESET' });
      return;
    }

    if (skipNextLoadForCartId.current === cartId) {
      skipNextLoadForCartId.current = null;
      return;
    }

    cartDataLoader.refresh(cartId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId, dispatch]);

  // Creates a new cart and immediately seeds state from the response.
  // Sets skipNextLoadForCartId so the load effect above does not issue
  // a redundant fetch when session storage updates with the new cart id.
  const createCart: IUseCartLifecycleResult['createCart'] = useCallback(
    async (options) => {
      const { features = [] } = options;

      const response = await cartApi.createCart({
        features: features.map((f) => f.submission_feature_id)
      });

      skipNextLoadForCartId.current = response.cart.cart_id;
      applyLoadSuccess(response);
      setStoredCartId(response.cart.cart_id);
    },
    [cartApi, applyLoadSuccess, setStoredCartId]
  );

  return { createCart };
};
