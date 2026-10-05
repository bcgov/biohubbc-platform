import { mdiLock, mdiLockOpenVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { grey } from '@mui/material/colors';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import appTheme from 'themes/appTheme';
import { FeatureRow } from './SecurityReviewFeaturesTable.interface';

interface SecurityReviewFeaturesTableProps {
  rows: FeatureRow[];
  rowCount: number;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
}

/**
 * Shows submission feature security indicators without mutation or selection actions.
 * @param {SecurityReviewFeaturesTableProps} props Feature rows and paging controls.
 * @returns {JSX.Element} Read-only feature table.
 */
export const SecurityReviewFeaturesTable = ({
  rows,
  rowCount,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel
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
        <Icon
          path={params.row.secured ? mdiLock : mdiLockOpenVariant}
          aria-label={params.row.secured ? 'Secured' : 'Unsecured'}
          size={1}
          color={params.row.secured ? appTheme.palette.error.main : grey[500]}
        />
      )
    },
    { field: 'feature_type_name', headerName: 'Feature Type', flex: 1 }
  ];

  return (
    <CustomDataGrid
      rows={rows}
      columns={columns}
      rowSelection={false}
      getRowId={(row) => row.submission_feature_id}
      paginationMode="server"
      paginationModel={paginationModel}
      onPaginationModelChange={setPaginationModel}
      pageSizeOptions={[10, 25, 50]}
      sortingMode="server"
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      rowCount={rowCount}
    />
  );
};
