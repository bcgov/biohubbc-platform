import { useCallback, useMemo } from 'react';
import { useOptimisticDataLoader } from 'hooks/useOptimisticDataLoader';
import { CartFeatureListResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { CartSnapshot } from './cartContext.interface';
import {
  buildOptimisticAddSnapshot,
  buildOptimisticRemoveSnapshot,
  EMPTY_SNAPSHOT,
  getCartSubmissionFeatureIds,
  getPaginationParams,
  makeSnapshot
} from './cartContext.helpers';
import { IUseCartOptimisticActionsParams, IUseCartOptimisticActionsResult } from './useCartOptimisticActions.interface';

/**
 * Encapsulates optimistic cart mutations for existing carts:
 * add features, remove features, and clear cart.
 */
export const useCartOptimisticActions = (params: IUseCartOptimisticActionsParams): IUseCartOptimisticActionsResult => {
  const { state, cartApi, applyLoadSuccess, applyRollback, applyOptimisticSnapshot } = params;

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
   * Optimistically appends new features, then reconciles with server response.
   */
  const addToExistingCart = useCallback(
    async (cartId: string, optimisticAdds: SearchFeatureResultWithRelevancy[]) => {
      await refresh<CartFeatureListResponse>((currentState) => {
        const optimisticState = buildOptimisticAddSnapshot(currentState, optimisticAdds);

        return {
          optimisticState,
          mutation: () =>
            cartApi.addCartFeatures(
              cartId,
              { features: optimisticAdds.map((feature) => feature.submission_feature_id) },
              getPaginationParams(optimisticState.features.length)
            ),
          onSuccess: applyLoadSuccess,
          onRollback: ({ currentState: previousState }) => {
            applyRollback(previousState);
          }
        };
      });
    },
    [applyLoadSuccess, applyRollback, cartApi, refresh]
  );

  /**
   * Optimistically removes features, then issues one delete request
   * per persisted cart feature id.
   */
  const removeFromExistingCart = useCallback(
    async (cartId: string, featureIds: number[]) => {
      await refresh<CartFeatureListResponse | undefined>((currentState) => {
        const optimisticState = buildOptimisticRemoveSnapshot(currentState, featureIds);

        return {
          optimisticState,
          mutation: async () => {
            const cartSubmissionFeatureIds = getCartSubmissionFeatureIds(currentState.features, featureIds);

            if (!cartSubmissionFeatureIds.length) {
              return undefined;
            }

            const removePromises = cartSubmissionFeatureIds.map((cartSubmissionFeatureId) =>
              cartApi.removeCartFeatureById(
                cartId,
                cartSubmissionFeatureId,
                getPaginationParams(Math.max(optimisticState.features.length, 1))
              )
            );

            const responses = await Promise.all(removePromises);
            return responses[responses.length - 1];
          },
          onSuccess: (lastResponse) => {
            if (lastResponse) {
              applyLoadSuccess(lastResponse);
            }
          },
          onRollback: ({ currentState: previousState }) => {
            applyRollback(previousState);
          }
        };
      });
    },
    [applyLoadSuccess, applyRollback, cartApi, refresh]
  );

  /**
   * Optimistically empties the cart and replaces state with server payload on success.
   */
  const clearExistingCart = useCallback(
    async (cartId: string) => {
      await refresh<CartFeatureListResponse>((currentState) => ({
        optimisticState: EMPTY_SNAPSHOT,
        mutation: () => cartApi.clearCart(cartId, getPaginationParams(1)),
        onSuccess: applyLoadSuccess,
        onRollback: () => {
          applyRollback(currentState);
        }
      }));
    },
    [applyLoadSuccess, applyRollback, cartApi, refresh]
  );

  return {
    addToExistingCart,
    removeFromExistingCart,
    clearExistingCart
  };
};
