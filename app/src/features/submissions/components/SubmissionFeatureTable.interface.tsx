import { GridPaginationModel, GridRowParams, GridSortModel, MuiEvent } from '@mui/x-data-grid';

export type SubmissionFeatureRow = {
  submission_feature_id: number;
  feature_type_name: string;
};

export interface SubmissionFeatureTableProps {
  rows: SubmissionFeatureRow[];
  rowCount: number;
  isLoading: boolean;
  onRowClick: (params: GridRowParams<SubmissionFeatureRow>, event: MuiEvent<React.MouseEvent>) => void;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  onSortModelChange: (model: GridSortModel) => void;
}