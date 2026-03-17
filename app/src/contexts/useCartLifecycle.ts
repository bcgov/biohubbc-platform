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

  useEffect(() => {
    cartApiRef.current = cartApi;
  }, [cartApi]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    applyLoadSuccessRef.current = applyLoadSuccess;
  }, [applyLoadSuccess]);

  const hasClaimedCurrentCart = useRef(false);

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

  const setCartIdRef = useRef(setCartId);

  useEffect(() => {
    setCartIdRef.current = setCartId;
  }, [setCartId]);

  const cartDataLoader = useDataLoader(async (cartId: string): Promise<CartFeatureListResponse> => {
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
  });

  const cartDataLoaderRef = useRef(cartDataLoader);

  useEffect(() => {
    cartDataLoaderRef.current = cartDataLoader;
  }, [cartDataLoader]);

  useEffect(() => {
    if (!state.cartId) {
      dispatch({ type: 'RESET' });
      return;
    }

    const refresh = async () => {
      try {
        await cartDataLoaderRef.current.refresh(state.cartId!);
      } catch (error) {
        if (isInvalidCachedCartError(error)) {
          setCartIdRef.current(null);
        }
      }
    };

    refresh();
  }, [dispatch, state.cartId]);

  const createCart: IUseCartLifecycleResult['createCart'] = useCallback(async (options) => {
    const { features = [] } = options;

    const response = await cartApiRef.current.createCart({
      features: features.map((f) => f.submission_feature_id)
    });

    hasClaimedCurrentCart.current = false;
    setCartIdRef.current(response.cart.cart_id);
    cartDataLoaderRef.current.refresh(response.cart.cart_id);
  }, []);

  return { setCartId, createCart };
};
