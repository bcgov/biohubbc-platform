import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Button, Stack } from '@mui/material';
import { GridCellParams } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useMemo } from 'react';

interface SearchResultTableLayoutProps {
  /** Result rows rendered in the data grid. */
  results: SearchFeatureResultWithRelevancy[];
  /** Submission feature ids currently present in the cart. */
  cartFeatureIds: Set<number>;
  /** Opens the selected result's feature detail page. */
  onClick?: (result: SearchFeatureResultWithRelevancy) => void;
  /** Adds the selected result to the cart. */
  onAddToCart?: (result: SearchFeatureResultWithRelevancy) => void;
  /** Removes the selected feature id from the cart. */
  onRemoveFromCart?: (featureId: number) => void;
}

/**
 * Renders search results in the table view.
 *
 * Use this layout when the result toolbar selects the table view. It derives
 * the grid columns from the current rows and cart state, then forwards row and
 * action clicks to callbacks supplied by `SearchResultOptions`.
 *
 * @param {SearchResultTableLayoutProps} props - Results, cart ids, and optional row action callbacks.
 * @returns {JSX.Element} Search result data grid.
 */
export const SearchResultTableLayout = ({
  results,
  cartFeatureIds,
  onClick,
  onAddToCart,
  onRemoveFromCart
}: SearchResultTableLayoutProps) => {
  const columns = useMemo(() => {
    if (results.length === 0) {
      return [];
    }

    return [
      {
        field: 'is_secured',
        headerName: '',
        width: 50,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params: GridCellParams) => {
          if (!params.value) {
            return null;
          }
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', color: 'error.main', flexShrink: 0 }}>
              <Icon path={mdiLock} size={0.75} />
            </Box>
          );
        }
      },
      {
        field: 'feature_type_name',
        headerName: 'Feature Type',
        width: 150,
        sortable: true
      },
      {
        field: 'submission_name',
        headerName: 'Submission',
        width: 150,
        sortable: true
      },
      {
        field: 'feature_description',
        headerName: 'Description',
        width: 250,
        sortable: true
      },
      {
        field: 'relevancy_score',
        headerName: 'Relevance',
        width: 120,
        sortable: true
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 220,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          const result = params.row as SearchFeatureResultWithRelevancy;
          const isInCart = cartFeatureIds.has(result.submission_feature_id);

          return (
            <Stack direction="row" gap={1} height="100%" alignItems="center">
              <Button
                size="small"
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  onClick?.(result);
                }}>
                View
              </Button>
              {isInCart ? (
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFromCart?.(result.submission_feature_id);
                  }}>
                  Remove
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddToCart?.(result);
                  }}>
                  Add
                </Button>
              )}
            </Stack>
          );
        }
      }
    ];
  }, [results, cartFeatureIds, onClick, onAddToCart, onRemoveFromCart]);

  return (
    <CustomDataGrid
      rows={results}
      columns={columns}
      getRowId={(row) => row.uuid}
      onRowClick={(params) => {
        onClick?.(params.row as SearchFeatureResultWithRelevancy);
      }}
      pageSizeOptions={[5, 10, 20]}
      disableRowSelectionOnClick
      disableColumnSelector
      disableColumnMenu
      hideFooter
      sortingOrder={['asc', 'desc']}
      initialState={{
        sorting: { sortModel: [{ field: 'relevancy_score', sort: 'desc' }] },
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
