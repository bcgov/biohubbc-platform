import { useApi } from 'hooks/useApi';
import { useCodesContext } from 'hooks/useContext';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import {
  IGetSubmissionGroupedFeatureResponse,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export interface IUrnEditorContext {
  /**
   * Data loader for published submissions (for URN autocomplete).
   */
  submissionsDataLoader: DataLoader<[], SubmissionRecordWithSecurityAndRootFeature[], unknown>;
  /**
   * Feature types from codes context (already loaded globally).
   */
  featureTypes: { feature_type: { feature_type_name: string } }[];
  /**
   * Cache of submission features, keyed by submission ID.
   */
  submissionFeaturesCache: Map<number, IGetSubmissionGroupedFeatureResponse[]>;
  /**
   * Fetch features for a specific submission (with caching).
   *
   * @param submissionId - The submission ID to fetch features for
   */
  fetchFeaturesForSubmission: (submissionId: number) => Promise<void>;
}

export const UrnEditorContext = React.createContext<IUrnEditorContext | undefined>(undefined);

export const UrnEditorContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const biohubApi = useApi();
  const codesContext = useCodesContext();

  // Cache for submission features, keyed by submission ID
  const [submissionFeaturesCache, setSubmissionFeaturesCache] = useState<
    Map<number, IGetSubmissionGroupedFeatureResponse[]>
  >(new Map());

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

  // Fetch features for a specific submission (with caching)
  const fetchFeaturesForSubmission = useCallback(
    async (submissionId: number): Promise<void> => {
      // Skip if already cached
      if (submissionFeaturesCache.has(submissionId)) {
        return;
      }

      try {
        const featureGroups = await biohubApi.submissions.getSubmissionFeatureGroups(submissionId);
        setSubmissionFeaturesCache((prev) => new Map(prev).set(submissionId, featureGroups));
      } catch (error) {
        console.error(`Failed to fetch features for submission ${submissionId}:`, error);
      }
    },
    [biohubApi.submissions, submissionFeaturesCache]
  );

  const urnEditorContext: IUrnEditorContext = useMemo(
    () => ({
      submissionsDataLoader,
      featureTypes,
      submissionFeaturesCache,
      fetchFeaturesForSubmission
    }),
    [submissionsDataLoader, featureTypes, submissionFeaturesCache, fetchFeaturesForSubmission]
  );

  return <UrnEditorContext.Provider value={urnEditorContext}>{props.children}</UrnEditorContext.Provider>;
};
