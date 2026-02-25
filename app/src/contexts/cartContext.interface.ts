import { CartFeatureListResponse, CartSubmissionFeature, CheckoutCartResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';

/**
 * Union of cart items and staged cart items.
 */
export type CartContextFeature = CartSubmissionFeature | SearchFeatureResultWithRelevancy;

/**
 * Snapshot of cart state used for optimistic updates and rollback.
 */
export type CartSnapshot = {
  features: CartContextFeature[];
  pagination: ApiPaginationResponseParams;
};

/**
 * Internal state shape for the cart reducer.
 */
export type CartState = {
  cartId: string | null;
  features: CartContextFeature[];
  pagination: ApiPaginationResponseParams;
  isLoading: boolean;
  error?: unknown;
};

/**
 * Actions dispatched to the cart reducer.
 */
export type CartAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: CartFeatureListResponse }
  | { type: 'LOAD_ERROR'; payload: unknown }
  | { type: 'OPTIMISTIC_SET'; payload: CartSnapshot }
  | { type: 'ROLLBACK'; payload: CartSnapshot }
  | { type: 'SET_CART_ID'; payload: string | null }
  | { type: 'RESET' };

/**
 * Public interface for the CartContext.
 * Provides cart state and methods for managing cart features.
 */
export interface ICartContext {
  /**
   * The current list of features in the cart.
   *
   * This is intentionally a union of:
   * - `CartSubmissionFeature` (features already persisted in the cart backend)
   * - `SearchFeatureResultWithRelevancy` (features added optimistically from search results)
   *
   * Using a union allows optimistic updates:
   * - Features are added to the cart immediately for UI responsiveness
   * - If the API call fails, the cart state is rolled back
   */
  features: CartContextFeature[];

  /**
   * Adds one or more features to the cart.
   *
   * Behavior:
   * - If no cart exists yet, a cart is created automatically
   * - Features are added optimistically to `features` before the API call completes
   * - Duplicate features (by submission_feature_id) are ignored
   * - If the API request fails, the cart state is rolled back
   *
   * @param features Features selected from search results to be added to the cart
   */
  addToCart: (features: SearchFeatureResultWithRelevancy[]) => Promise<void>;

  /**
   * Removes one or more features from the cart by submission feature ID.
   *
   * Behavior:
   * - Updates the cart state optimistically before calling the API
   * - Maps submission feature IDs to cart-specific IDs internally
   * - If the API request fails, the cart state is rolled back
   *
   * @param featureIds Submission feature IDs to remove from the cart
   */
  removeFromCart: (featureIds: number[]) => Promise<void>;

  /**
   * Removes all features from the cart.
   *
   * Behavior:
   * - Clears the cart optimistically in the UI
   * - Calls the API to clear the cart server-side
   * - If the API request fails, the previous cart state is restored
   */
  clearCart: () => Promise<void>;

  /**
   * Checks out the cart: creates a download from all cart features,
   * then resets the cart for a fresh session.
   *
   * After checkout, the cart is cleared and a new cart will be created
   * on the next addToCart call. Errors propagate to the caller without
   * resetting the cart, so the user can retry.
   */
  checkout: () => Promise<CheckoutCartResponse | null>;

  /**
   * Pagination metadata returned by the cart API.
   *
   * Includes:
   * - total number of features in the cart
   * - current page
   * - last available page
   *
   * Used to keep the cart UI in sync with backend pagination state.
   */
  pagination: ApiPaginationResponseParams;

  /**
   * Whether the cart is currently loading data from the API.
   */
  isLoading: boolean;

  /**
   * Error from the last failed operation, if any.
   */
  error?: unknown;
}
