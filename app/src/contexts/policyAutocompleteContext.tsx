import { useApi } from 'hooks/useApi';
import { useCodesContext, useDialogContext } from 'hooks/useContext';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { FeatureTypeWithProperties } from 'interfaces/useCodesApi.interface';
import {
  ISubmissionFeatureForReview,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';
import React, { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Context object that stores information for policy editor autocomplete.
 *
 * @export
 * @interface IPolicyAutocompleteContext
 */
export interface IPolicyAutocompleteContext {
  /**
   * Data loader for published submissions (for policy autocomplete).
   *
   * @type {DataLoader<[], SubmissionRecordWithSecurityAndRootFeature[], unknown>}
   * @memberof IPolicyAutocompleteContext
   */
  submissionsDataLoader: DataLoader<[], SubmissionRecordWithSecurityAndRootFeature[], unknown>;
  /**
   * Feature types from codes context (already loaded globally).
   *
   * @type {FeatureTypeWithProperties[]}
   * @memberof IPolicyAutocompleteContext
   */
  featureTypes: FeatureTypeWithProperties[];
  /**
   * Cache of submission features for autocomplete, keyed by submission ID.
   *
   * @type {Map<number, ISubmissionFeatureForReview[]>}
   * @memberof IPolicyAutocompleteContext
   */
  submissionFeaturesCache: Map<number, ISubmissionFeatureForReview[]>;
  /**
   * Fetch features for a specific submission to populate autocomplete options.
   *
   * @param {number} submissionId - The submission ID to fetch features for autocomplete
   * @memberof IPolicyAutocompleteContext
   */
  fetchFeaturesForAutocomplete: (submissionId: number) => Promise<void>;
}

/**
 * React context for policy editor autocomplete data.
 * Provides submissions, feature types, and cached features to child components.
 */
export const PolicyAutocompleteContext = React.createContext<IPolicyAutocompleteContext | undefined>(undefined);

/**
 * Context provider for policy editor autocomplete functionality.
 *
 * Provides:
 * - Published submissions data for submission ID autocomplete
 * - Feature types from global codes context for feature type autocomplete
 * - Cached submission features for feature ID autocomplete
 * - Function to fetch and cache features on-demand
 *
 * Loads submissions automatically on mount. Features are loaded lazily
 * when requested via fetchFeaturesForAutocomplete.
 *
 * @param {React.PropsWithChildren} props - Component props with children
 * @returns {React.ReactElement} Context provider wrapping children
 */
export const PolicyAutocompleteContextProvider = (props: PropsWithChildren) => {
  const biohubApi = useApi();
  const codesContext = useCodesContext();
  const dialogContext = useDialogContext();

  // Cache for submission features, keyed by submission ID
  const [submissionFeaturesCache, setSubmissionFeaturesCache] = useState<Map<number, ISubmissionFeatureForReview[]>>(
    new Map()
  );

  // Data loader for published submissions
  const submissionsDataLoader = useDataLoader(biohubApi.submissions.getPublishedSubmissionsForAdmins);

  // Load submissions on mount
  useEffect(() => {
    submissionsDataLoader.load();
  }, [submissionsDataLoader]);

  // Feature types from codes context (already loaded globally)
  const featureTypes = useMemo(
    () => codesContext.codesDataLoader.data?.feature_type_with_properties || [],
    [codesContext.codesDataLoader.data?.feature_type_with_properties]
  );

  // Fetch features for a specific submission to populate autocomplete (with caching)
  const fetchFeaturesForAutocomplete = useCallback(
    async (submissionId: number): Promise<void> => {
      // Skip if already cached
      if (submissionFeaturesCache.has(submissionId)) {
        return;
      }

      try {
        const featureGroups = await biohubApi.submissions.getSubmissionFeatures(submissionId);
        setSubmissionFeaturesCache((prev) => new Map(prev).set(submissionId, featureGroups.features));
      } catch {
        dialogContext.setSnackbar({
          snackbarMessage: `Failed to fetch features for submission ${submissionId}`,
          open: true
        });
      }
    },
    [biohubApi.submissions, dialogContext, submissionFeaturesCache]
  );

  const policyAutocompleteContext: IPolicyAutocompleteContext = useMemo(
    () => ({
      submissionsDataLoader,
      featureTypes,
      submissionFeaturesCache,
      fetchFeaturesForAutocomplete
    }),
    [submissionsDataLoader, featureTypes, submissionFeaturesCache, fetchFeaturesForAutocomplete]
  );

  return (
    <PolicyAutocompleteContext.Provider value={policyAutocompleteContext}>
      {props.children}
    </PolicyAutocompleteContext.Provider>
  );
};
