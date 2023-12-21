import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { IGetSubmissionFeatureResponse, SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
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
   * @type {DataLoader<[submissionId: number], IGetSubmissionFeatureResponse[], unknown>}
   * @memberof ISubmissionContext
   */
  submissionFeaturesDataLoader: DataLoader<[submissionId: number], IGetSubmissionFeatureResponse[], unknown>;
  /**
   * The Data Loader used to load security rules data.
   *
   * @type {DataLoader<[], ISecurityRule[], unknown>}
   * @memberof ISubmissionContext
   */
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
  const api = useApi();

  const submissionRecordDataLoader = useDataLoader(api.submissions.getSubmissionRecordWithSecurity);
  const submissionFeaturesDataLoader = useDataLoader(api.submissions.getSubmissionFeatures);
  const securityRulesDataLoader = useDataLoader(api.security.getActiveSecurityRules);

  const urlParams = useParams();

  const submissionId = Number(urlParams['submission_id']);

  if (!submissionId) {
    throw new Error(
      "The submission ID found in SubmissionContextProvider was invalid. Does your current React route provide a 'submission_id' parameter?"
    );
  }

  securityRulesDataLoader.load();
  submissionRecordDataLoader.load(submissionId);
  submissionFeaturesDataLoader.load(submissionId);

  /**
   * Refreshes the current submission object whenever the current submission id changes from the currently loaded submission.
   */
  useEffect(() => {
    if (submissionId && submissionId !== submissionRecordDataLoader.data?.submission_id) {
      submissionRecordDataLoader.refresh(submissionId);
      submissionFeaturesDataLoader.refresh(submissionId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const submissionContext: ISubmissionContext = useMemo(() => {
    return {
      submissionRecordDataLoader,
      submissionFeaturesDataLoader,
      securityRulesDataLoader,
      submissionId
    };
  }, [submissionRecordDataLoader, securityRulesDataLoader, submissionFeaturesDataLoader, submissionId]);

  return <SubmissionContext.Provider value={submissionContext}>{props.children}</SubmissionContext.Provider>;
};
