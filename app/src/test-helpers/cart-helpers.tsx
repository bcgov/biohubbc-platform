import { CartContextFeature, CartSnapshot, CartState } from 'contexts/cartContext.interface';
import { CartSubmissionFeature, CartWithFeaturesResponse } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { vi } from 'vitest';

// Default empty cart state
export const EmptyCartState: CartState = {
  features: [],
  pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 },
  isLoading: false,
  error: undefined
};

// Default cart state with features
export const CartWithFeaturesState: CartState = {
  features: [
    {
      cart_submission_feature_id: '1',
      submission_feature_id: 1,
      submission_id: 101,
      feature_type_id: 1001,
      feature_type_name: 'Test Feature 1',
      secured: false
    },
    {
      cart_submission_feature_id: '2',
      submission_feature_id: 2,
      submission_id: 102,
      feature_type_id: 1002,
      feature_type_name: 'Test Feature 2',
      secured: true
    }
  ],
  pagination: { total: 2, current_page: 1, last_page: 1, per_page: 10 },
  isLoading: false,
  error: undefined
};

// Helper to create CartState from base state
export const createMockCartState = (base: CartState): CartState => ({
  features: base.features ?? [],
  pagination: base.pagination ?? { total: 0, current_page: 1, last_page: 1, per_page: 10 },
  isLoading: base.isLoading ?? false,
  error: base.error ?? undefined
});

// Helper to create a mock CartSubmissionFeature
export const createMockFeature = (
  cart_submission_feature_id: string,
  submission_feature_id: number,
  submission_id: number,
  feature_type_id: number,
  feature_type_name: string,
  secured: boolean = false
): CartSubmissionFeature => ({
  cart_submission_feature_id,
  submission_feature_id,
  submission_id,
  feature_type_id,
  feature_type_name,
  secured
});

// Helper to create a CartSnapshot (for optimistic updates)
export const createCartSnapshot = (
  features: CartContextFeature[],
  pagination: ApiPaginationResponseParams
): CartSnapshot => ({
  features,
  pagination
});

// Helper to create a mock SearchFeatureResultWithRelevancy
export const createMockSearchFeature = (
  submission_feature_id: number,
  feature_type_name: string,
  secured: boolean = false
): SearchFeatureResultWithRelevancy => ({
  submission_feature_id,
  submission_id: 123,
  uuid: 'uuid-' + submission_feature_id,
  feature_type_id: 456,
  feature_type_name,
  feature_name: 'Mock Feature Name',
  feature_description: 'This is a mocked feature description',
  submission_name: 'Mock Submission Name',
  is_secured: secured,
  relevancy_score: 95,
  create_date: '2026-05-01T12:00:00.000Z'
});

// Helper to create a mock CartWithFeaturesResponse
export const createMockCartFeaturesResponse = (
  cart_id: string,
  features: CartSubmissionFeature[],
  pagination: ApiPaginationResponseParams
): CartWithFeaturesResponse => ({
  cart: { cart_id, system_user_id: null, cart_status: 'active', record_end_date: null },
  features,
  pagination
});

// Helper to create a mock CartContext with actions (for dispatch mock)
export const createMockCartContext = () => ({
  addToCart: vi.fn(),
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn()
});

// Convert CartSubmissionFeature to SearchFeatureResultWithRelevancy
export const convertToSearchFeatureResult = (cartFeature: CartSubmissionFeature): SearchFeatureResultWithRelevancy => ({
  submission_feature_id: cartFeature.submission_feature_id,
  submission_id: cartFeature.submission_id,
  uuid: `uuid-${cartFeature.submission_feature_id}`,
  feature_type_id: cartFeature.feature_type_id,
  feature_type_name: cartFeature.feature_type_name,
  feature_name: `Feature for ${cartFeature.feature_type_name}`,
  feature_description: `Description for ${cartFeature.feature_type_name}`,
  submission_name: `Submission for ${cartFeature.submission_id}`,
  is_secured: cartFeature.secured,
  relevancy_score: 100,
  create_date: '2026-05-01T12:00:00.000Z'
});
