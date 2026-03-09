import {
  GridColDef,
  GridPaginationModel,
  GridRowId,
  GridRowSelectionModel,
  GridSortModel,
  GridValidRowModel
} from '@mui/x-data-grid';
import CustomDataGrid from './CustomDataGrid';

interface IServerPaginatedDataGridProps<T extends GridValidRowModel> {
  rows: T[];
  columns: GridColDef<T>[];
  getRowId: (row: T) => GridRowId;
  dataTestId: string;
  noRowsMessage: string;
  rowCount: number;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
  onRowClick?: (row: T) => void;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (model: GridRowSelectionModel) => void;
  checkboxSelection?: boolean;
  disableMultipleRowSelection?: boolean;
}

/**
 * Reusable server-side paginated data grid wrapper.
 *
 * Encapsulates common server pagination/sorting wiring for `CustomDataGrid`
 * and exposes strongly-typed row behavior.
 *
 * @template T
 * @param {IServerPaginatedDataGridProps<T>} props
 * @returns {JSX.Element}
 */
export const ServerPaginatedDataGrid = <T extends GridValidRowModel>({
  rows,
  columns,
  getRowId,
  dataTestId,
  noRowsMessage,
  rowCount,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel,
  onRowClick,
  rowSelectionModel,
  onRowSelectionModelChange,
  checkboxSelection,
  disableMultipleRowSelection
}: IServerPaginatedDataGridProps<T>) => {
  return (
    <CustomDataGrid
      data-testid={dataTestId}
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      paginationMode="server"
      paginationModel={paginationModel}
      onPaginationModelChange={setPaginationModel}
      pageSizeOptions={[10, 25, 50]}
      sortingMode="server"
      sortingOrder={['asc', 'desc']}
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      rowCount={rowCount}
      noRowsMessage={noRowsMessage}
      localeText={{ noRowsLabel: noRowsMessage }}
      disableRowSelectionOnClick
      disableColumnSelector
      checkboxSelection={checkboxSelection}
      disableMultipleRowSelection={disableMultipleRowSelection}
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={onRowSelectionModelChange}
      onRowClick={(params) => {
        onRowClick?.(params.row as T);
      }}
      sx={{
        border: 'none',
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 700,
          textTransform: 'uppercase'
        }
      }}
    />
  );
};
