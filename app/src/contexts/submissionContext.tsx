import { ISecurityRuleAndCategory } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { IGetSubmissionResponse } from 'interfaces/useSubmissionsApi.interface';
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

export interface ISubmissionContext {
  /**
   * The Data Loader used to load submission data.
   *
   * @type {DataLoader<[submissionId: number], IGetSubmissionResponse, unknown>}
   * @memberof ISubmissionContext
   */
  submissionDataLoader: DataLoader<[submissionId: number], IGetSubmissionResponse, unknown>;
  /**
   * The Data Loader used to load security rules data.
   *
   * @type {DataLoader<[], ISecurityRule[], unknown>}
   * @memberof ISubmissionContext
   */
  securityRulesDataLoader: DataLoader<[], ISecurityRuleAndCategory[], unknown>;
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

  const submissionDataLoader = useDataLoader(api.submissions.getSubmission);
  const securityRulesDataLoader = useDataLoader(api.security.getActiveSecurityRulesAndCategories);

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
      securityRulesDataLoader,
      submissionId
    };
  }, [securityRulesDataLoader, submissionDataLoader, submissionId]);

  return <SubmissionContext.Provider value={submissionContext}>{props.children}</SubmissionContext.Provider>;
};
