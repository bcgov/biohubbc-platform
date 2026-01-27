import { DataGrid, GridRowSelectionModel } from '@mui/x-data-grid';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useMemo } from 'react';

interface SearchResultTableLayoutProps {
  results: SearchFeatureResultWithRelevancy[];
  onRowSelectionModelChange: (rowSelectionModel: GridRowSelectionModel) => void;
}

export const SearchResultTableLayout = ({ results, onRowSelectionModelChange }: SearchResultTableLayoutProps) => {
  const columns = useMemo(() => {
    if (results.length === 0) {
      return [];
    }
    const firstRow = results[0];
    return Object.keys(firstRow).map((key) => ({
      field: key,
      headerName: key.charAt(0).toUpperCase() + key.slice(1),
      width: 150,
      sortable: true
    }));
  }, [results]);

  return (
    <DataGrid
      rows={results}
      columns={columns}
      getRowId={(row) => row.uuid}
      checkboxSelection
      onRowSelectionModelChange={onRowSelectionModelChange}
      pageSizeOptions={[5, 10, 20]}
      disableRowSelectionOnClick
      disableColumnSelector
      disableColumnMenu
      sortingOrder={['asc', 'desc']}
      initialState={{
        sorting: { sortModel: [{ field: columns[0]?.field, sort: 'asc' }] },
        pagination: { paginationModel: { pageSize: 10 } }
      }}
      sx={{
        minWidth: '100%',
        '& .MuiDataGrid-root': {
          border: 'none'
        }
      }}
    />
  );
};
