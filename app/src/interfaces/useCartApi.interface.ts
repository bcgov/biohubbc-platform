import { ApiPaginationResponseParams } from 'types/pagination';

/**
 * Represents a cart submission feature (a feature added to a cart)
 */
export interface CartSubmissionFeature {
  cart_submission_feature_id: string;
  submission_feature_id: number;
  submission_id: number;
  feature_type_id: number;
  feature_type_name: string;
  secured: boolean;
}

/**
 * Represents a cart without features
 */
export interface Cart {
  cart_id: string;
  system_user_id: number | null;
  cart_status: 'active' | 'checked_out' | 'expired' | 'abandoned';
}

/**
 * Response from cart feature endpoints
 * (`GET/POST/DELETE /api/cart/{cartId}/feature` and
 * `DELETE /api/cart/{cartId}/feature/{cartSubmissionFeatureId}`)
 */
export interface CartFeatureListResponse {
  features: CartSubmissionFeature[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Response from cart endpoints that include cart metadata
 * (`POST /api/cart`, `GET /api/cart/{cartId}`)
 */
export interface CartWithFeaturesResponse extends CartFeatureListResponse {
  cart: Cart;
}

/**
 * Response from the cart checkout endpoint (`POST /api/cart/{cartId}/checkout`).
 */
export interface CheckoutCartResponse {
  download_id: string;
}

/**
 * Payload for updating a cart
 */
export interface UpdateCartPayload {
  system_user_id?: number | null;
  cart_status?: 'active' | 'checked_out' | 'expired' | 'abandoned';
  record_end_date?: string | null;
}
