/**
 * Fallback value if the NUM_FEATURES_BATCH_SIZE environment variable is not set.
 * This controls the number of submission features that are processed at a time. Memory usage increases with the number of features.
 */
export const DEFAULT_NUM_FEATURES_BATCH_SIZE = 5000;
