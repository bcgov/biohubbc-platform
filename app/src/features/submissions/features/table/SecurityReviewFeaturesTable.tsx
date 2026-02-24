import { mdiLock, mdiLockOpenVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { grey } from '@mui/material/colors';
import IconButton from '@mui/material/IconButton';
import {
  GridColDef,
  GridPaginationModel,
  GridRowParams,
  GridRowSelectionModel,
  GridSortModel,
  MuiEvent
} from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import appTheme from 'themes/appTheme';
import { FeatureRow } from './SecurityReviewFeaturesTable.interface';

interface SecurityReviewFeaturesTableProps {
  rows: FeatureRow[];
  rowCount: number;
  onSelectionChange: (model: GridRowSelectionModel) => void;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
  onRowSecurityClick: (row: FeatureRow) => void;
  onRowClick?: (params: GridRowParams, event: MuiEvent<React.MouseEvent>) => void;
}

export const SecurityReviewFeaturesTable = ({
  rows,
  rowCount,
  onSelectionChange,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel,
  onRowSecurityClick,
  onRowClick
}: SecurityReviewFeaturesTableProps) => {
  const columns: GridColDef[] = [
    { field: 'submission_feature_id', headerName: 'ID', width: 100 },
    {
      field: 'secured',
      headerName: 'Security',
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onRowSecurityClick(params.row);
          }}>
          <Icon
            path={params.row.secured ? mdiLock : mdiLockOpenVariant}
            size={1}
            color={params.row.secured ? appTheme.palette.error.main : grey[500]}
          />
        </IconButton>
      )
    },
    { field: 'feature_type_name', headerName: 'Feature Type', flex: 1 }
  ];

  return (
    <CustomDataGrid
      rows={rows}
      columns={columns}
      checkboxSelection
      getRowId={(row) => row.submission_feature_id}
      onRowSelectionModelChange={onSelectionChange}
      paginationMode="server"
      paginationModel={paginationModel}
      onPaginationModelChange={setPaginationModel}
      pageSizeOptions={[10, 25, 50]}
      sortingMode="server"
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      rowCount={rowCount}
      onRowClick={onRowClick}
    />
  );
};
