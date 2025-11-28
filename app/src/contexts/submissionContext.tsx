import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { ISecurityRuleAndCategory, ISubmissionFeatureSecurityRecord } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import {
  ISubmissionFeatureForReviewResponse,
  SubmissionRecordWithSecurity
} from 'interfaces/useSubmissionsApi.interface';
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ApiPaginationRequestOptions } from 'types/misc';
import { firstOrNull } from 'utils/Utils';

export interface ISubmissionContext {
  submissionRecordDataLoader: DataLoader<[number], SubmissionRecordWithSecurity, unknown>;
  submissionFeaturesDataLoader: DataLoader<
    [ApiPaginationRequestOptions, number],
    ISubmissionFeatureForReviewResponse,
    unknown
  >;
  allSecurityRulesStaticListDataLoader: DataLoader<[], ISecurityRuleAndCategory[], unknown>;
  submissionFeaturesAppliedRulesDataLoader: DataLoader<[], ISubmissionFeatureSecurityRecord[], unknown>;
  paginationModel: GridPaginationModel;
  setPaginationModel: React.Dispatch<React.SetStateAction<GridPaginationModel>>;
  sortModel: GridSortModel;
  setSortModel: React.Dispatch<React.SetStateAction<GridSortModel>>;
  featuresPagination: ApiPaginationRequestOptions;
  submissionId: number;
}

export const SubmissionContext = React.createContext<ISubmissionContext | undefined>(undefined);

export const SubmissionContextProvider = (props: PropsWithChildren) => {
  const api = useApi();

  /** Extract submission ID */
  const urlParams = useParams<{ submission_id: string }>();
  const submissionId = Number(urlParams.submission_id);

  if (!submissionId) {
    throw new Error('Missing submission_id route param');
  }

  /** ========== Pagination + Sorting State ========== */
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25
  });

  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  /** Convert MUI pagination/sorting → API format */
  const featuresPagination: ApiPaginationRequestOptions = useMemo(() => {
    const sort = firstOrNull(sortModel);

    return {
      limit: paginationModel.pageSize,
      page: paginationModel.page + 1, // API is 1-indexed
      sort: sort?.field || undefined,
      order: sort?.sort || undefined
    };
  }, [paginationModel, sortModel]);

  /** ========== Data Loaders ========== */

  // Load submission record (unchanged)
  const submissionRecordDataLoader = useDataLoader(api.submissions.getSubmissionRecordWithSecurity);

  // NEW: paginated feature loader
  const submissionFeaturesDataLoader = useDataLoader((pagination: ApiPaginationRequestOptions, submissionId: number) =>
    api.submissions.getSubmissionFeatures(submissionId, pagination)
  );

  const allSecurityRulesStaticListDataLoader = useDataLoader(api.security.getActiveSecurityRulesWithCategories);

  const submissionFeaturesAppliedRulesDataLoader = useDataLoader(() =>
    api.security.getAllSecurityRulesForSubmission(submissionId)
  );

  /** ========== Initial Loads ========== */
  submissionRecordDataLoader.load(submissionId);
  submissionFeaturesDataLoader.load(featuresPagination, submissionId);
  allSecurityRulesStaticListDataLoader.load();

  /** Refresh features on pagination/sorting change */
  useEffect(() => {
    submissionFeaturesDataLoader.refresh(featuresPagination, submissionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuresPagination]);

  /** Refresh when submission ID changes */
  useEffect(() => {
    submissionRecordDataLoader.refresh(submissionId);
    submissionFeaturesDataLoader.refresh(featuresPagination, submissionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  /** Refresh security rules when features change */
  useEffect(() => {
    submissionFeaturesAppliedRulesDataLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionFeaturesDataLoader.data]);

  /** ========== Memoized Context Value ========== */
  const submissionContext: ISubmissionContext = useMemo(
    () => ({
      submissionRecordDataLoader,
      submissionFeaturesDataLoader,
      allSecurityRulesStaticListDataLoader,
      submissionFeaturesAppliedRulesDataLoader,
      paginationModel,
      setPaginationModel,
      sortModel,
      setSortModel,
      featuresPagination,
      submissionId
    }),
    [
      submissionRecordDataLoader,
      submissionFeaturesDataLoader,
      allSecurityRulesStaticListDataLoader,
      submissionFeaturesAppliedRulesDataLoader,
      paginationModel,
      sortModel,
      featuresPagination,
      submissionId
    ]
  );

  return <SubmissionContext.Provider value={submissionContext}>{props.children}</SubmissionContext.Provider>;
};
