import { ISecurityRuleAndCategory, ISubmissionFeatureSecurityRecord } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import {
  IGetSubmissionGroupedFeatureResponse,
  SubmissionRecordWithSecurity
} from 'interfaces/useSubmissionsApi.interface';
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

export interface ISubmissionContext {
  /**
   * The Data Loader used to load submission data.
   *
   * @type {DataLoader<[submissionId: number], SubmissionRecordWithSecurity, unknown>}
   * @memberof ISubmissionContext
   */
  submissionRecordDataLoader: DataLoader<[submissionId: number], SubmissionRecordWithSecurity, unknown>;
  /**
   * The Data Loader used to load submission features data.
   *
   * @type {DataLoader<[submissionId: number], IGetSubmissionGroupedFeatureResponse[], unknown>}
   * @memberof ISubmissionContext
   */
  submissionFeatureGroupsDataLoader: DataLoader<
    [submissionId: number],
    IGetSubmissionGroupedFeatureResponse[],
    unknown
  >;
  /**
   * The Data Loader used to load the list of all security rules that may be applied
   * to a given submission.
   *
   * @type {DataLoader<[], ISecurityRule[], unknown>}
   * @memberof ISubmissionContext
   */
  allSecurityRulesStaticListDataLoader: DataLoader<[], ISecurityRuleAndCategory[], unknown>;
  /**
   * The Data Loader used to load the list of all security rules applied to the set of
   * given submission features.
   *
   * @type {DataLoader<[features: number[]], ISubmissionFeatureSecurityRecord[], unknown>}
   * @memberof ISubmissionContext
   */
  submissionFeaturesAppliedRulesDataLoader: DataLoader<
    [features: number[]],
    ISubmissionFeatureSecurityRecord[],
    unknown
  >;
  /**
   * The submission id.
   *
   * @type {number}
   * @memberof ISubmissionContext
   */
  submissionId: number;
}

export const SubmissionContext = React.createContext<ISubmissionContext | undefined>(undefined);

export const SubmissionContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const api = useApi();

  // The static list of all security rules that could be applied to a submission feature
  const allSecurityRulesStaticListDataLoader = useDataLoader(api.security.getActiveSecurityRulesAndCategories);

  // The submission record, including security metadata
  const submissionRecordDataLoader = useDataLoader(api.submissions.getSubmissionRecordWithSecurity);

  // The list of all features for the given submission
  const submissionFeatureGroupsDataLoader = useDataLoader(api.submissions.getSubmissionFeatureGroups);

  // The list of all security rules applied to the given features
  const submissionFeaturesAppliedRulesDataLoader = useDataLoader(api.security.getSecurityRulesForSubmissionFeatures);

  const urlParams = useParams();

  const submissionId = Number(urlParams['submission_id']);

  if (!submissionId) {
    throw new Error(
      "The submission ID found in SubmissionContextProvider was invalid. Does your current React route provide a 'submission_id' parameter?"
    );
  }

  allSecurityRulesStaticListDataLoader.load();
  submissionRecordDataLoader.load(submissionId);
  submissionFeatureGroupsDataLoader.load(submissionId);

  /**
   * Refreshes the current submission object whenever the current submission id changes from the currently loaded submission.
   */
  useEffect(() => {
    if (submissionId && submissionId !== submissionRecordDataLoader.data?.submission_id) {
      submissionRecordDataLoader.refresh(submissionId);
      submissionFeatureGroupsDataLoader.refresh(submissionId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  /**
   * Refreshes the list of all applied security rules, whenever the list of submission features changes
   */
  useEffect(() => {
    if (!submissionFeatureGroupsDataLoader.data) {
      return;
    }

    const featureIds = submissionFeatureGroupsDataLoader.data.reduce(
      (acc: number[], submissionFeatureGroup: IGetSubmissionGroupedFeatureResponse) => {
        return acc.concat(submissionFeatureGroup.features.map((feature) => feature.submission_feature_id));
      },
      []
    );

    submissionFeaturesAppliedRulesDataLoader.refresh(featureIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionFeatureGroupsDataLoader.data]);

  const submissionContext: ISubmissionContext = useMemo(() => {
    return {
      submissionRecordDataLoader,
      submissionFeatureGroupsDataLoader,
      allSecurityRulesStaticListDataLoader,
      submissionFeaturesAppliedRulesDataLoader,
      submissionId
    };
  }, [
    submissionRecordDataLoader,
    submissionFeatureGroupsDataLoader,
    allSecurityRulesStaticListDataLoader,
    submissionFeaturesAppliedRulesDataLoader,
    submissionId
  ]);

  return <SubmissionContext.Provider value={submissionContext}>{props.children}</SubmissionContext.Provider>;
};
