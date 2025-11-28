import { mdiLock, mdiLockOpenVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { grey } from '@mui/material/colors';
import IconButton from '@mui/material/IconButton';
import { DataGrid, GridColDef, GridPaginationModel, GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import appTheme from 'themes/appTheme';

interface FeatureRow {
  id: number;
  submission_feature_id: number;
  feature_type_display_name: string;
  feature_type_name: string;
  secured: boolean;
}

interface SecurityReviewFeaturesTableProps {
  rows: FeatureRow[];
  rowCount: number;
  selectionModel: GridRowSelectionModel;
  onSelectionChange: (model: GridRowSelectionModel) => void;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
  handleSecurityChange: (row: FeatureRow) => void;
}

const pageSizeOptions = [10, 25, 50];

export const SecurityReviewFeaturesTable = ({
  rows,
  rowCount,
  selectionModel,
  onSelectionChange,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel,
  handleSecurityChange
}: SecurityReviewFeaturesTableProps) => {
  const columns: GridColDef[] = [
    { field: 'submission_feature_id', headerName: 'ID', width: 100 },
    {
      field: 'secured',
      headerName: 'Security',
      width: 130,
      renderCell: (params) => (
        <IconButton onClick={() => handleSecurityChange(params.row)}>
          <Icon
            path={params.row.secured ? mdiLock : mdiLockOpenVariant}
            size={1}
            color={params.row.secured ? appTheme.palette.error.main : grey[500]}
          />
        </IconButton>
      ),
      sortable: false,
      filterable: false
    },
    { field: 'feature_type_display_name', headerName: 'Feature Type', flex: 1 }
  ];

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      checkboxSelection
      rowSelectionModel={selectionModel}
      onRowSelectionModelChange={onSelectionChange}
      paginationMode="server"
      paginationModel={paginationModel}
      onPaginationModelChange={setPaginationModel}
      pageSizeOptions={pageSizeOptions}
      sortingMode="server"
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      rowCount={rowCount}
    />
  );
};
