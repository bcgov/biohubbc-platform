import { APIError } from 'hooks/api/useAxios';
import { CartSubmissionFeature } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { CartAction, CartContextFeature, CartSnapshot, CartState } from './cartContext.interface';

export const DEFAULT_PAGINATION: ApiPaginationResponseParams = {
  total: 0,
  current_page: 1,
  last_page: 1
};

export const EMPTY_SNAPSHOT: CartSnapshot = {
  features: [],
  pagination: DEFAULT_PAGINATION
};

export const getPaginationParams = (featuresLength: number) => ({
  page: 1,
  limit: Math.max(featuresLength, 1)
});

export const isCartSubmissionFeature = (feature: CartContextFeature): feature is CartSubmissionFeature => {
  return 'cart_submission_feature_id' in feature;
};

export const getCartSubmissionFeatureIds = (features: CartContextFeature[], featureIds: number[]): string[] => {
  return features
    .filter(
      (feature): feature is CartSubmissionFeature =>
        featureIds.includes(feature.submission_feature_id) && isCartSubmissionFeature(feature)
    )
    .map((feature) => feature.cart_submission_feature_id);
};

export const makeSnapshot = (state: CartState): CartSnapshot => ({
  features: [...state.features],
  pagination: { ...state.pagination }
});

export const getUniqueFeaturesToAdd = (
  currentFeatures: CartContextFeature[],
  featuresToAdd: SearchFeatureResultWithRelevancy[]
): SearchFeatureResultWithRelevancy[] => {
  const existingFeatureIds = new Set(currentFeatures.map((feature) => feature.submission_feature_id));
  return featuresToAdd.filter((feature) => !existingFeatureIds.has(feature.submission_feature_id));
};

export const buildOptimisticAddSnapshot = (
  state: CartSnapshot,
  optimisticAdds: SearchFeatureResultWithRelevancy[]
): CartSnapshot => ({
  features: [...state.features, ...optimisticAdds],
  pagination: {
    ...state.pagination,
    total: state.pagination.total + optimisticAdds.length
  }
});

export const buildOptimisticRemoveSnapshot = (state: CartSnapshot, featureIds: number[]): CartSnapshot => {
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

export const isInvalidCachedCartError = (error: unknown): boolean => {
  const status = (error as APIError | undefined)?.status;
  return status === 401 || status === 403 || status === 404;
};

export const cartReducer = (state: CartState, action: CartAction): CartState => {
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
