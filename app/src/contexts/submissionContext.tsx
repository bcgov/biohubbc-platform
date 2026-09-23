import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import {
  ISubmissionFeatureForReviewResponse,
  SubmissionRecordWithSecurity
} from 'interfaces/useSubmissionsApi.interface';
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { firstOrNull } from 'utils/Utils';

/* ------------------------------------------------------------------ */
/* Context Interface                                                    */
/* ------------------------------------------------------------------ */

export interface ISubmissionContext {
  submissionId: number;

  submissionDataLoader: DataLoader<[number], SubmissionRecordWithSecurity, unknown>;

  featureDataLoader: DataLoader<[number, ApiPaginationRequestOptions], ISubmissionFeatureForReviewResponse, unknown>;

  paginationModel: GridPaginationModel;
  setPaginationModel: React.Dispatch<React.SetStateAction<GridPaginationModel>>;

  sortModel: GridSortModel;
  setSortModel: React.Dispatch<React.SetStateAction<GridSortModel>>;

  featuresPagination: ApiPaginationRequestOptions;
}

export const SubmissionContext = React.createContext<ISubmissionContext | undefined>(undefined);

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export const SubmissionContextProvider = ({ children }: PropsWithChildren) => {
  const api = useApi();
  const { submission_id } = useParams<{ submission_id: string }>();

  const submissionId = Number(submission_id);
  if (!submissionId) {
    throw new Error('Missing submission_id route parameter');
  }

  /* ---------------- Pagination & Sorting ---------------- */

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });

  const [sortModel, setSortModel] = useState<GridSortModel>([
    {
      field: 'submission_feature_id',
      sort: 'asc'
    }
  ]);

  const featuresPagination: ApiPaginationRequestOptions = useMemo(() => {
    const sort = firstOrNull(sortModel);
    return {
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      sort: sort?.field,
      order: sort?.sort as 'asc' | 'desc' | undefined
    };
  }, [paginationModel, sortModel]);

  /* ---------------- Data Loaders ---------------- */

  const submissionDataLoader = useDataLoader(api.submissions.getSubmissionRecordWithSecurity);

  const featureDataLoader = useDataLoader((submissionId: number, pagination: ApiPaginationRequestOptions) =>
    api.admin.getSubmissionFeatures(submissionId, pagination)
  );

  /* ---------------- Initial Load ---------------- */

  useEffect(() => {
    submissionDataLoader.load(submissionId);
    featureDataLoader.load(submissionId, featuresPagination);
  }, [submissionId, featuresPagination, submissionDataLoader, featureDataLoader]);

  /* ---------------- Feature Paging / Sorting ---------------- */

  useEffect(() => {
    featureDataLoader.refresh(submissionId, featuresPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuresPagination]);

  /* ---------------- Context Value ---------------- */

  const value: ISubmissionContext = useMemo(
    () => ({
      submissionId,

      submissionDataLoader,
      featureDataLoader,

      paginationModel,
      setPaginationModel,
      sortModel,
      setSortModel,
      featuresPagination
    }),
    [submissionId, submissionDataLoader, featureDataLoader, paginationModel, sortModel, featuresPagination]
  );

  return <SubmissionContext.Provider value={value}>{children}</SubmissionContext.Provider>;
};
