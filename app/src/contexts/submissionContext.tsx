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
    [number, ApiPaginationRequestOptions],
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
  const { submission_id } = useParams<{ submission_id: string }>();
  const submissionId = Number(submission_id);

  if (!submissionId) {
    throw new Error('Missing submission_id route parameter');
  }

  // Pagination and sorting state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25
  });

  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'submission_feature_id', sort: 'asc' } // default sort
  ]);

  // Convert MUI pagination + sorting to API format
  const featuresPagination: ApiPaginationRequestOptions = useMemo(() => {
    const sort = firstOrNull(sortModel);
    return {
      limit: paginationModel.pageSize,
      page: paginationModel.page + 1, // API uses 1-based indexing
      sort: sort?.field || undefined,
      order: sort?.sort || undefined
    };
  }, [paginationModel, sortModel]);

  // Data loaders
  const submissionRecordDataLoader = useDataLoader(api.submissions.getSubmissionRecordWithSecurity);

  const submissionFeaturesDataLoader = useDataLoader((submissionId: number, pagination: ApiPaginationRequestOptions) =>
    api.submissions.getSubmissionFeatures(submissionId, pagination)
  );

  const allSecurityRulesStaticListDataLoader = useDataLoader(api.security.getActiveSecurityRulesWithCategories);

  const submissionFeaturesAppliedRulesDataLoader = useDataLoader(() =>
    api.security.getAllSecurityRulesForSubmission(submissionId)
  );

  // Initial data load
  submissionRecordDataLoader.load(submissionId);
  submissionFeaturesDataLoader.load(submissionId, featuresPagination);
  allSecurityRulesStaticListDataLoader.load();

  // Reload features when pagination or sorting changes
  useEffect(() => {
    submissionFeaturesDataLoader.refresh(submissionId, featuresPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuresPagination]);

  // Refresh all data when submissionId changes
  useEffect(() => {
    submissionRecordDataLoader.refresh(submissionId);
    submissionFeaturesDataLoader.refresh(submissionId, featuresPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  // Reload applied security rules whenever features change
  useEffect(() => {
    submissionFeaturesAppliedRulesDataLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionFeaturesDataLoader.data]);

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
