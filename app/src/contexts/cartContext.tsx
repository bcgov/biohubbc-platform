import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useSessionStorage } from 'hooks/useSessionStorage';
import { CartSubmissionFeature, CheckoutCartResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { ApiPaginationResponseParams } from 'types/pagination';
import { CartAction, CartContextFeature, CartSnapshot, CartState, ICartContext } from './cartContext.interface';

/**
 * Default pagination state used when the cart is empty or not yet loaded.
 *
 * This represents an empty cart with:
 * - total: 0 (no features in the cart)
 * - current_page: 1 (always start at page 1)
 * - last_page: 1 (only one page exists when empty)
 *
 * Used to initialize the cart state and reset pagination after clearing the cart.
 */
const DEFAULT_PAGINATION: ApiPaginationResponseParams = {
  total: 0,
  current_page: 1,
  last_page: 1
};

/**
 * Empty cart snapshot used for optimistic clearing operations.
 *
 * When the user clears their cart, we immediately update the UI to show
 * an empty cart (optimistic update) before the API call completes.
 *
 * If the API call fails, we can roll back to the previous snapshot.
 * This constant represents the target state after a successful clear operation.
 */
const EMPTY_SNAPSHOT: CartSnapshot = {
  features: [],
  pagination: DEFAULT_PAGINATION
};

/**
 * Generates pagination parameters for API requests based on the current cart size.
 *
 * Strategy: Always request page 1 with a limit that matches the current number
 * of features in the cart. This ensures we get all features in a single response,
 * keeping the local state in sync with the server.
 *
 * @param featuresLength - The current number of features in the cart
 * @returns Pagination params with page=1 and limit=featuresLength (minimum 1)
 *
 * Example:
 * - Cart has 5 features → { page: 1, limit: 5 }
 * - Cart is empty → { page: 1, limit: 1 }
 */
const getPaginationParams = (featuresLength: number) => ({
  page: 1,
  limit: Math.max(featuresLength, 1)
});

/**
 * Type guard to determine if a feature is a persisted CartSubmissionFeature.
 *
 * The cart contains a union of two types:
 * - CartSubmissionFeature: Features that have been saved to the backend (have cart_submission_feature_id)
 * - SearchFeatureResultWithRelevancy: Features added optimistically (no cart_submission_feature_id yet)
 *
 * This guard checks for the presence of cart_submission_feature_id to differentiate between them.
 *
 * @param feature - The feature to check
 * @returns true if the feature is a CartSubmissionFeature, false otherwise
 */
const isCartSubmissionFeature = (feature: CartContextFeature): feature is CartSubmissionFeature => {
  return 'cart_submission_feature_id' in feature;
};

/**
 * Extracts cart-specific IDs for features that need to be removed from the backend.
 *
 * When removing features, we need to use their cart_submission_feature_id (the backend ID)
 * rather than their submission_feature_id (the feature's general ID).
 *
 * This function:
 * 1. Filters features by the provided submission_feature_ids
 * 2. Only includes features that are persisted (have cart_submission_feature_id)
 * 3. Maps to an array of cart_submission_feature_ids for API deletion calls
 *
 * Optimistically added features (not yet persisted) are ignored since they don't
 * exist in the backend yet and don't need API deletion.
 *
 * @param features - All features currently in the cart
 * @param featureIds - Submission feature IDs to remove
 * @returns Array of cart_submission_feature_ids to delete via API
 */
const getCartSubmissionFeatureIds = (features: CartContextFeature[], featureIds: number[]): string[] => {
  return features
    .filter(
      (feature): feature is CartSubmissionFeature =>
        featureIds.includes(feature.submission_feature_id) && isCartSubmissionFeature(feature)
    )
    .map((feature) => feature.cart_submission_feature_id);
};

/**
 * Reducer function that manages cart state transitions.
 *
 * Handles all state updates in a predictable, centralized way.
 *
 * Actions:
 * - LOAD_START: Sets loading state before API calls
 * - LOAD_SUCCESS: Updates cart with data from successful API response
 * - LOAD_ERROR: Stores error from failed API call
 * - OPTIMISTIC_SET: Immediately updates UI before API call completes
 * - ROLLBACK: Reverts to previous state when API call fails
 * - SET_CART_ID: Updates the cart ID (from storage or after creation)
 * - RESET: Clears all cart data (when no cart ID exists)
 *
 * @param state - Current cart state
 * @param action - Action to perform
 * @returns New cart state after applying the action
 */
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'LOAD_START':
      return {
        ...state,
        isLoading: true,
        error: undefined
      };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        isLoading: false,
        error: undefined,
        features: action.payload.features,
        pagination: action.payload.pagination
      };
    case 'LOAD_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };
    case 'OPTIMISTIC_SET':
      return {
        ...state,
        features: action.payload.features,
        pagination: action.payload.pagination,
        error: undefined
      };
    case 'ROLLBACK':
      return {
        ...state,
        features: action.payload.features,
        pagination: action.payload.pagination
      };
    case 'SET_CART_ID':
      return {
        ...state,
        cartId: action.payload
      };
    case 'RESET':
      return {
        ...state,
        features: [],
        pagination: DEFAULT_PAGINATION,
        isLoading: false,
        error: undefined
      };
    default:
      return state;
  }
};

/**
 * Creates a deep copy snapshot of the current cart state for rollback purposes.
 *
 * Used in optimistic updates to preserve the previous state before making changes.
 * If an API call fails, we can restore this snapshot to revert the optimistic update.
 *
 * Deep copies are created to prevent reference issues:
 * - features array is spread into a new array
 * - pagination object is spread into a new object
 *
 * @param state - Current cart state
 * @returns Snapshot containing copies of features and pagination
 */
const makeSnapshot = (state: CartState): CartSnapshot => ({
  features: [...state.features],
  pagination: { ...state.pagination }
});

/**
 * Returns true when an API error indicates the current cart can no longer be used.
 */
const isCartAccessError = (error: unknown): boolean => {
  const status = (error as APIError)?.status;
  return status === 401 || status === 403 || status === 404;
};

/**
 * Returns true when an API error indicates the cached cart ID is no longer valid.
 *
 * This handles stale session cart IDs that can happen after cart deletion,
 * checkout, expiry, or backend cleanup.
 */
const isInvalidCachedCartError = (error: unknown): boolean => {
  const status = (error as APIError | undefined)?.status;
  return status === 401 || status === 403 || status === 404;
};

/**
 * Filters out features already present in cart state.
 */
const getUniqueFeaturesToAdd = (
  currentFeatures: CartContextFeature[],
  featuresToAdd: SearchFeatureResultWithRelevancy[]
): SearchFeatureResultWithRelevancy[] => {
  const existingFeatureIds = new Set(currentFeatures.map((feature) => feature.submission_feature_id));
  return featuresToAdd.filter((feature) => !existingFeatureIds.has(feature.submission_feature_id));
};

/**
 * Builds optimistic cart state payload for add operations.
 */
const buildOptimisticAddSnapshot = (
  state: CartState,
  optimisticAdds: SearchFeatureResultWithRelevancy[]
): CartSnapshot => {
  return {
    features: [...state.features, ...optimisticAdds],
    pagination: {
      ...state.pagination,
      total: state.pagination.total + optimisticAdds.length
    }
  };
};

/**
 * Builds optimistic cart state payload for remove operations.
 */
const buildOptimisticRemoveSnapshot = (state: CartState, featureIds: number[]): CartSnapshot => {
  const nextFeatures = state.features.filter((feature) => !featureIds.includes(feature.submission_feature_id));
  const removedCount = state.features.length - nextFeatures.length;

  return {
    features: nextFeatures,
    pagination: {
      ...state.pagination,
      total: Math.max(0, state.pagination.total - removedCount)
    }
  };
};

export const CartContext = React.createContext<ICartContext | undefined>(undefined);

export const CartContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const api = useApi();
  const authStateContext = useAuthStateContext();
  const [storedCartId, setStoredCartId] = useSessionStorage<string | null>('cart_id', null);

  // Ref to prevent concurrent operations from creating race conditions.
  // This lock ensures that only one cart operation (add/remove/clear) can
  // execute at a time, preventing state corruption from rapid user interactions.
  const operationInProgress = useRef(false);

  const [state, dispatch] = useReducer(cartReducer, {
    cartId: storedCartId,
    features: [],
    pagination: DEFAULT_PAGINATION,
    isLoading: false,
    error: undefined
  });

  // Ref to store the cart API instance to avoid stale closures in callbacks.
  // Using a ref ensures that async operations always use the latest API instance
  // even if the api.cart object is recreated during the component lifecycle.
  const cartApiRef = useRef(api.cart);

  // Tracks whether we've attempted to claim the current cart.
  // Prevents duplicate claim attempts during the same session.
  const hasClaimedCurrentCart = useRef(false);
  // When we already have cart data (e.g. createCart response),
  // skip the immediate follow-up load to avoid a redundant getCartById call.
  const skipNextLoadForCartId = useRef<string | null>(null);

  useEffect(() => {
    cartApiRef.current = api.cart;
  }, [api.cart]);

  useEffect(() => {
    dispatch({ type: 'SET_CART_ID', payload: storedCartId });
  }, [storedCartId]);

  /**
   * Effect: Reset claim flag when cart changes
   *
   * When the user gets a new cart (different ID), we should allow
   * claiming that new cart even if we've claimed a previous one.
   */
  useEffect(() => {
    hasClaimedCurrentCart.current = false;
  }, [state.cartId]);

  /**
   * Clears the cached cart ID from session storage and local state.
   *
   * This is used when a persisted cart ID no longer resolves to an accessible cart.
   */
  const clearCachedCartId = useCallback(() => {
    setStoredCartId(null);
    dispatch({ type: 'SET_CART_ID', payload: null });
  }, [setStoredCartId]);

  /**
   * Claims the cart for authenticated users when the cart is currently unowned.
   */
  const claimCartIfNeeded = useCallback(
    async (cartId: string, systemUserId: number | null): Promise<void> => {
      if (!authStateContext.auth.isAuthenticated || systemUserId !== null || hasClaimedCurrentCart.current) {
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
    [authStateContext.auth.isAuthenticated]
  );

  // Effect: Load cart data when cartId changes
  // This runs whenever a cart ID is set (from session storage or after creation).
  // If no cart ID exists, it resets the cart state to empty.
  // Includes cleanup to prevent state updates after unmount.
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

        dispatch({ type: 'LOAD_SUCCESS', payload: response });

        // Claim anonymous carts for authenticated users after a successful load.
        // Keeping this in the load-success path avoids claim/load request races.
        // Only claim carts that are currently unowned.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimCartIfNeeded, state.cartId]);

  /**
   * Updates the cart ID in both session storage and local state.
   *
   * This is called after creating a new cart to persist the cart ID
   * so it survives page refreshes within the same session.
   *
   * @param nextCartId - The new cart ID to store (or null to clear)
   */
  const setCartId = useCallback(
    (nextCartId: string | null) => {
      setStoredCartId(nextCartId);
      dispatch({ type: 'SET_CART_ID', payload: nextCartId });
    },
    [setStoredCartId]
  );

  /**
   * Internal method to create a new cart with optional initial features.
   *
   * Used when:
   * 1. User adds to cart for the first time (pass features to add)
   * 2. An addToCart request fails with 401/403/404 (pass features to retry with)
   *
   * Creates the cart and adds features in a single API call.
   *
   * @param options - Cart creation options
   * @param options.features - Optional feature IDs to add to the new cart
   */
  const _createCart = useCallback(
    async (options: { features?: SearchFeatureResultWithRelevancy[] }): Promise<void> => {
      const { features = [] } = options;

      try {
        const response = await cartApiRef.current.createCart({
          features: features.map((feature) => feature.submission_feature_id)
        });

        skipNextLoadForCartId.current = response.cart.cart_id;
        setCartId(response.cart.cart_id);
        hasClaimedCurrentCart.current = false;

        // Update state with the response from cart creation
        dispatch({ type: 'LOAD_SUCCESS', payload: response });
        await claimCartIfNeeded(response.cart.cart_id, response.cart.system_user_id);
      } finally {
        operationInProgress.current = false;
      }
    },
    [claimCartIfNeeded, setCartId]
  );

  // Adds features with optimistic updates and rollback on failure.
  const addToCart = useCallback(
    async (featuresToAdd: SearchFeatureResultWithRelevancy[]): Promise<void> => {
      if (!featuresToAdd.length || operationInProgress.current) {
        return;
      }

      operationInProgress.current = true;
      let previousSnapshot: CartSnapshot | undefined;
      let optimisticAdds: SearchFeatureResultWithRelevancy[] = [];

      try {
        if (!state.cartId) {
          await _createCart({ features: featuresToAdd });
          return;
        }

        optimisticAdds = getUniqueFeaturesToAdd(state.features, featuresToAdd);
        if (!optimisticAdds.length) {
          return;
        }

        previousSnapshot = makeSnapshot(state);
        const optimisticSnapshot = buildOptimisticAddSnapshot(state, optimisticAdds);
        dispatch({ type: 'OPTIMISTIC_SET', payload: optimisticSnapshot });
        const response = await cartApiRef.current.addCartFeatures(
          state.cartId,
          { features: optimisticAdds.map((feature) => feature.submission_feature_id) },
          getPaginationParams(optimisticSnapshot.features.length)
        );

        dispatch({ type: 'LOAD_SUCCESS', payload: response });
      } catch (error) {
        if (previousSnapshot) {
          dispatch({ type: 'ROLLBACK', payload: previousSnapshot });
        }

        if (previousSnapshot && optimisticAdds.length > 0 && isCartAccessError(error)) {
          operationInProgress.current = false;
          await _createCart({ features: optimisticAdds });
          return;
        }

        throw error;
      } finally {
        operationInProgress.current = false;
      }
    },
    [_createCart, state]
  );

  // Removes features with optimistic updates and rollback on failure.
  const removeFromCart = useCallback(
    async (featureIds: number[]): Promise<void> => {
      if (!state.cartId || !featureIds.length || operationInProgress.current) {
        return;
      }

      const cartId = state.cartId;
      operationInProgress.current = true;
      let previousSnapshot: CartSnapshot | undefined;

      try {
        previousSnapshot = makeSnapshot(state);
        const optimisticSnapshot = buildOptimisticRemoveSnapshot(state, featureIds);
        dispatch({ type: 'OPTIMISTIC_SET', payload: optimisticSnapshot });

        const cartSubmissionFeatureIds = getCartSubmissionFeatureIds(state.features, featureIds);

        if (!cartSubmissionFeatureIds.length) {
          return;
        }

        // Make removals in parallel for better performance
        const removePromises = cartSubmissionFeatureIds.map((cartSubmissionFeatureId) => {
          return cartApiRef.current.removeCartFeatureById(
            cartId,
            cartSubmissionFeatureId,
            getPaginationParams(Math.max(optimisticSnapshot.features.length, 1))
          );
        });

        const responses = await Promise.all(removePromises);

        // Use the last response to update state
        const lastResponse = responses[responses.length - 1];
        if (lastResponse) {
          dispatch({ type: 'LOAD_SUCCESS', payload: lastResponse });
        }
      } catch (error) {
        if (previousSnapshot) {
          dispatch({ type: 'ROLLBACK', payload: previousSnapshot });
        }
        throw error;
      } finally {
        operationInProgress.current = false;
      }
    },
    [state]
  );

  // Clears the cart with optimistic updates and rollback on failure.
  const clearCart = useCallback(async (): Promise<void> => {
    if (!state.cartId || operationInProgress.current) {
      return;
    }

    operationInProgress.current = true;

    const snapshot = makeSnapshot(state);

    dispatch({ type: 'OPTIMISTIC_SET', payload: EMPTY_SNAPSHOT });

    try {
      const response = await cartApiRef.current.clearCart(state.cartId, getPaginationParams(1));
      dispatch({ type: 'LOAD_SUCCESS', payload: response });
    } catch (error) {
      dispatch({ type: 'ROLLBACK', payload: snapshot });
      throw error;
    } finally {
      operationInProgress.current = false;
    }
  }, [state]);

  /**
   * Checks out the cart: creates a download from all cart features,
   * then resets the cart for a fresh session.
   *
   * Checkout creates a download in `pending` status without triggering processing.
   * Download processing is a separate concern handled by the pipeline.
   * After checkout, the cart ID is cleared from session storage and state is reset,
   * so the next addToCart call creates a fresh cart.
   */
  const checkout = useCallback(async (): Promise<CheckoutCartResponse | null> => {
    if (!state.cartId || operationInProgress.current) {
      return null;
    }

    operationInProgress.current = true;

    try {
      const download = await cartApiRef.current.checkoutCart(state.cartId);

      // Clear cart ID from session storage and reset state.
      // setCartId(null) triggers the existing useEffect that dispatches RESET.
      setCartId(null);

      return download;
    } finally {
      operationInProgress.current = false;
    }
  }, [state.cartId, setCartId]);

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
