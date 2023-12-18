import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { IGetSubmissionResponse } from 'interfaces/useSubmissionsApi.interface';
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

export interface ISubmissionContext {
  /**
   * The Data Loader used to load submission data
   *
   * @type {DataLoader<[submissionId: number], IGetSubmissionResponse, unknown>}
   * @memberof ISubmissionContext
   */
  submissionDataLoader: DataLoader<[submissionId: number], IGetSubmissionResponse, unknown>;

  submissionFeatureRulesDataLoader: DataLoader<[features: number[]], any[], unknown>;

  securityRulesDataLoader: DataLoader<[], ISecurityRule[], unknown>;

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
  const biohubApi = useApi();

  const submissionDataLoader = useDataLoader(biohubApi.submissions.getSubmission);
  const submissionFeatureRulesDataLoader = useDataLoader(biohubApi.security.getSecurityRulesForSubmissions);
  const securityRulesDataLoader = useDataLoader(biohubApi.security.getActiveSecurityRules);

  const urlParams = useParams();

  const submissionId = Number(urlParams['submission_id']);

  if (!submissionId) {
    throw new Error(
      "The submission ID found in SubmissionContextProvider was invalid. Does your current React route provide a 'submission_id' parameter?"
    );
  }

  securityRulesDataLoader.load();
  submissionDataLoader.load(submissionId);

  /**
   * Refreshes the current submission object whenever the current submission id changes from the currently loaded submission.
   */
  useEffect(() => {
    if (submissionId && submissionId !== submissionDataLoader.data?.submission.submission_id) {
      submissionDataLoader.refresh(submissionId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const submissionContext: ISubmissionContext = useMemo(() => {
    return {
      submissionDataLoader,
      submissionFeatureRulesDataLoader,
      securityRulesDataLoader,
      submissionId
    };
  }, [submissionDataLoader, submissionId]);

  return <SubmissionContext.Provider value={submissionContext}>{props.children}</SubmissionContext.Provider>;
};
