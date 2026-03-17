import useDataLoader from 'hooks/useDataLoader';
import { CartFeatureListResponse } from 'interfaces/useCartApi.interface';
import { useCallback, useEffect, useRef } from 'react';
import { isInvalidCachedCartError } from './cartContext.helpers';
import { IUseCartLifecycleParams, IUseCartLifecycleResult } from './useCartLifecycle.interface';

export const useCartLifecycle = (params: IUseCartLifecycleParams): IUseCartLifecycleResult => {
  const { cartApi, isAuthenticated, storedCartId, setStoredCartId, state, dispatch, applyLoadSuccess } = params;

  const cartApiRef = useRef(cartApi);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const applyLoadSuccessRef = useRef(applyLoadSuccess);
  const setStoredCartIdRef = useRef(setStoredCartId);

  useEffect(() => {
    cartApiRef.current = cartApi;
  }, [cartApi]);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);
  useEffect(() => {
    applyLoadSuccessRef.current = applyLoadSuccess;
  }, [applyLoadSuccess]);
  useEffect(() => {
    setStoredCartIdRef.current = setStoredCartId;
  }, [setStoredCartId]);

  const hasClaimedCurrentCart = useRef(false);
  const skipNextLoadForCartId = useRef<string | null>(null);

  useEffect(() => {
    dispatch({ type: 'SET_CART_ID', payload: storedCartId });
  }, [dispatch, storedCartId]);

  useEffect(() => {
    hasClaimedCurrentCart.current = false;
  }, [state.cartId]);

  const setCartId = useCallback(
    (nextCartId: string | null) => {
      setStoredCartId(nextCartId);
      dispatch({ type: 'SET_CART_ID', payload: nextCartId });
    },
    [dispatch, setStoredCartId]
  );

  const cartDataLoader = useDataLoader(
    async (cartId: string): Promise<CartFeatureListResponse> => {
      const response = await cartApiRef.current.getCartById(cartId);

      if (isAuthenticatedRef.current && response.cart.system_user_id === null && !hasClaimedCurrentCart.current) {
        try {
          hasClaimedCurrentCart.current = true;
          await cartApiRef.current.assignCartToCurrentUser(cartId);
        } catch (error) {
          hasClaimedCurrentCart.current = false;
          console.error('Failed to claim cart for authenticated user:', error);
        }
      }

      applyLoadSuccessRef.current(response);
      return response;
    },
    (error) => {
      if (isInvalidCachedCartError(error)) {
        setStoredCartIdRef.current(null);
        dispatch({ type: 'RESET' });
      } else {
        dispatch({ type: 'LOAD_ERROR', payload: error });
      }
    }
  );

  useEffect(() => {
    if (!state.cartId) {
      return;
    }

    if (skipNextLoadForCartId.current === state.cartId) {
      skipNextLoadForCartId.current = null;
      return;
    }

    cartDataLoader.refresh(state.cartId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, state.cartId]);

  const createCart: IUseCartLifecycleResult['createCart'] = useCallback(
    async (options) => {
      const { features = [] } = options;
      const response = await cartApiRef.current.createCart({
        features: features.map((f) => f.submission_feature_id)
      });

      hasClaimedCurrentCart.current = false;
      skipNextLoadForCartId.current = response.cart.cart_id;
      applyLoadSuccessRef.current(response);
      setStoredCartIdRef.current(response.cart.cart_id);
      dispatch({ type: 'SET_CART_ID', payload: response.cart.cart_id });
    },
    [dispatch]
  );

  return { setCartId, createCart };
};
