import { ISecurityRule, ISubmissionFeatureSecurityRecord } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { IGetSubmissionResponse } from 'interfaces/useSubmissionsApi.interface';
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

export interface ISubmissionContext {
  /**
   * The Data Loader used to load submission data
   *
   * @type {DataLoader<[submissionUUID: string], IGetSubmissionResponse, unknown>}
   * @memberof ISubmissionContext
   */
  submissionDataLoader: DataLoader<[submissionUUID: string], IGetSubmissionResponse, unknown>;

  submissionFeatureRulesDataLoader: DataLoader<[features: number[]], any[], unknown>;

  securityRulesDataLoader: DataLoader<[], ISecurityRule[], unknown>;

  /**
   * The submission UUID
   *
   * @type {string}
   * @memberof ISubmissionContext
   */
  submissionUUID: string;
}

export const SubmissionContext = React.createContext<ISubmissionContext>({
  submissionDataLoader: {} as DataLoader<[submissionUUID: string], IGetSubmissionResponse, unknown>,
  submissionFeatureRulesDataLoader: {} as DataLoader<[features: number[]], ISubmissionFeatureSecurityRecord[], unknown>,
  securityRulesDataLoader: {} as DataLoader<[], ISecurityRule[], unknown>,
  submissionUUID: ''
});

export const SubmissionContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const biohubApi = useApi();
  const submissionDataLoader = useDataLoader(biohubApi.submissions.getSubmission);
  const submissionFeatureRulesDataLoader = useDataLoader(biohubApi.security.getSecurityRulesForSubmissions);
  const securityRulesDataLoader = useDataLoader(biohubApi.security.getActiveSecurityRules);

  const urlParams: Record<string, string | number | undefined> = useParams();

  if (!urlParams['submission_uuid']) {
    throw new Error(
      "The submission UUID found in SubmissionContextProvider was invalid. Does your current React route provide an 'id' parameter?"
    );
  }

  const submissionUUID = urlParams['submission_uuid'] as string;

  submissionDataLoader.load(submissionUUID);
  securityRulesDataLoader.load();

  /**
   * Refreshes the current submission object whenever the current submission UUID changes from the currently loaded submission.
   */
  useEffect(() => {
    if (submissionUUID && submissionUUID !== submissionDataLoader.data?.submission.uuid) {
      submissionDataLoader.refresh(submissionUUID);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionUUID]);

  const surveyContext: ISubmissionContext = useMemo(() => {
    return {
      submissionDataLoader,
      submissionFeatureRulesDataLoader,
      securityRulesDataLoader,
      submissionUUID
    };
  }, [submissionDataLoader, submissionUUID]);

  return <SubmissionContext.Provider value={surveyContext}>{props.children}</SubmissionContext.Provider>;
};
