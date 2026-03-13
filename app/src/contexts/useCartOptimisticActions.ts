import { useOptimisticDataLoader } from 'hooks/useOptimisticDataLoader';
import { CartFeatureListResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback, useMemo } from 'react';
import {
  buildOptimisticAddSnapshot,
  buildOptimisticRemoveSnapshot,
  EMPTY_SNAPSHOT,
  getCartSubmissionFeatureIds,
  getPaginationParams,
  makeSnapshot
} from './cartContext.helpers';
import { CartSnapshot } from './cartContext.interface';
import { IUseCartOptimisticActionsParams, IUseCartOptimisticActionsResult } from './useCartOptimisticActions.interface';

/**
 * Encapsulates optimistic cart mutations for existing carts:
 * add features, remove features, and clear cart.
 */
export const useCartOptimisticActions = (params: IUseCartOptimisticActionsParams): IUseCartOptimisticActionsResult => {
  const { state, cartApi, applyLoadSuccess, applyOptimisticSnapshot } = params;

  /**
   * CartSnapshot is a lightweight reducer snapshot (features + pagination)
   * used as the optimistic state payload.
   */
  const cartSnapshot = useMemo(() => makeSnapshot(state), [state]);

  /**
   * DataLoader adapter backed by cart reducer dispatch.
   */
  const { refresh } = useOptimisticDataLoader<CartSnapshot>({
    data: cartSnapshot,
    setData: applyOptimisticSnapshot
  });

  /**
   * Maps optimistic feature items to the API add payload format.
   */
  const getFeaturePayload = useCallback((optimisticAdds: SearchFeatureResultWithRelevancy[]) => {
    return { features: optimisticAdds.map((feature) => feature.submission_feature_id) };
  }, []);

  /**
   * Builds optimistic config for adding features to an existing cart.
   *
   * Usage: pass the returned config directly into `refresh(...)`.
   */
  const buildAddConfig = useCallback(
    (currentState: CartSnapshot, cartId: string, optimisticAdds: SearchFeatureResultWithRelevancy[]) => {
      const optimisticState = buildOptimisticAddSnapshot(currentState, optimisticAdds);

      return {
        optimisticState,
        mutation: () =>
          cartApi.addCartFeatures(
            cartId,
            getFeaturePayload(optimisticAdds),
            getPaginationParams(optimisticState.features.length)
          ),
        onSuccess: applyLoadSuccess
      };
    },
    [applyLoadSuccess, cartApi, getFeaturePayload]
  );

  /**
   * Removes persisted cart features and returns the last API response.
   *
   * Usage: called by remove mutation config to fan out one delete per
   * `cart_submission_feature_id`, then reconcile from the final payload.
   */
  const removePersistedFeatures = useCallback(
    async (
      currentState: CartSnapshot,
      optimisticState: CartSnapshot,
      cartId: string,
      featureIds: number[]
    ): Promise<CartFeatureListResponse | undefined> => {
      const cartSubmissionFeatureIds = getCartSubmissionFeatureIds(currentState.features, featureIds);

      if (!cartSubmissionFeatureIds.length) {
        return undefined;
      }

      const pagination = getPaginationParams(Math.max(optimisticState.features.length, 1));
      const removePromises = cartSubmissionFeatureIds.map((cartSubmissionFeatureId) =>
        cartApi.removeCartFeatureById(cartId, cartSubmissionFeatureId, pagination)
      );
      const responses = await Promise.all(removePromises);
      return responses.at(-1);
    },
    [cartApi]
  );

  /**
   * Commits authoritative remove state when a remove response is available.
   */
  const onRemoveSuccess = useCallback(
    (lastResponse: CartFeatureListResponse | undefined) => {
      if (lastResponse) {
        applyLoadSuccess(lastResponse);
      }
    },
    [applyLoadSuccess]
  );

  /**
   * Builds optimistic config for removing features from an existing cart.
   *
   * Usage: pass the returned config directly into `refresh(...)`.
   */
  const buildRemoveConfig = useCallback(
    (currentState: CartSnapshot, cartId: string, featureIds: number[]) => {
      const optimisticState = buildOptimisticRemoveSnapshot(currentState, featureIds);

      return {
        optimisticState,
        mutation: () => removePersistedFeatures(currentState, optimisticState, cartId, featureIds),
        onSuccess: onRemoveSuccess
      };
    },
    [onRemoveSuccess, removePersistedFeatures]
  );

  /**
   * Optimistically appends new features, then reconciles with server response.
   */
  const addToExistingCart = useCallback(
    async (cartId: string, optimisticAdds: SearchFeatureResultWithRelevancy[]) => {
      await refresh<CartFeatureListResponse>((currentState) => buildAddConfig(currentState, cartId, optimisticAdds));
    },
    [buildAddConfig, refresh]
  );

  /**
   * Optimistically removes features, then issues one delete request
   * per persisted cart feature id.
   */
  const removeFromExistingCart = useCallback(
    async (cartId: string, featureIds: number[]) => {
      await refresh<CartFeatureListResponse | undefined>((currentState) =>
        buildRemoveConfig(currentState, cartId, featureIds)
      );
    },
    [buildRemoveConfig, refresh]
  );

  /**
   * Optimistically empties the cart and replaces state with server payload on success.
   */
  const clearExistingCart = useCallback(
    async (cartId: string) => {
      await refresh<CartFeatureListResponse>(() => ({
        optimisticState: EMPTY_SNAPSHOT,
        mutation: () => cartApi.clearCart(cartId, getPaginationParams(1)),
        onSuccess: applyLoadSuccess
      }));
    },
    [applyLoadSuccess, cartApi, refresh]
  );

  return {
    addToExistingCart,
    removeFromExistingCart,
    clearExistingCart
  };
};
