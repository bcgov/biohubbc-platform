import { grey } from '@mui/material/colors';
import { DataGrid, type DataGridProps, type GridValidRowModel } from '@mui/x-data-grid';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import React, { useCallback } from 'react';
import StyledDataGridOverlay from './StyledDataGridOverlay';

export type ICustomDataGridProps<R extends GridValidRowModel = GridValidRowModel> = DataGridProps<R> & {
  noRowsMessage?: string;
  noRowsOverlay?: React.ReactElement;
};

/**
 * Standardized DataGrid wrapper that applies shared table styles while preserving full MUI DataGrid API support.
 *
 * @param {ICustomDataGridProps<R>} props Grid data, columns, pagination, slots, and styling options.
 * @returns {JSX.Element} Data grid with shared styling and loading and empty states.
 */
const CustomDataGrid = <R extends GridValidRowModel = GridValidRowModel>(props: ICustomDataGridProps<R>) => {
  const { sx, noRowsMessage, noRowsOverlay, slots, ...rest } = props;

  const loadingOverlay = () => <SkeletonTable />;

  const defaultNoRowsOverlay = useCallback(
    () => noRowsOverlay ?? <StyledDataGridOverlay message={noRowsMessage} />,
    [noRowsMessage, noRowsOverlay]
  );

  return (
    <DataGrid
      {...rest}
      disableColumnMenu={true}
      disableColumnResize={true}
      slots={{
        loadingOverlay,
        noRowsOverlay: defaultNoRowsOverlay,
        ...slots
      }}
      sx={[
        (theme) => {
          return {
            height: '100%',
            bgcolor: theme.palette.background.paper,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            border: 'none !important',

            '& *:focus-within': {
              outline: 'none !important'
            },

            '& .MuiDataGrid-columnHeaders': {
              bgcolor: theme.palette.background.paper,
              minHeight: 56,
              height: 56,
              maxHeight: 56
            },
            '& .MuiDataGrid-columnHeader': {
              bgcolor: theme.palette.background.paper,
              borderBottom: `1px solid ${theme.palette.divider} !important`,
              minHeight: 56,
              height: 56,
              maxHeight: 56,
              px: 2,
              alignItems: 'center'
            },
            '& .MuiDataGrid-columnHeaderTitleContainer': {
              minHeight: 56,
              height: 56,
              maxHeight: 56,
              minWidth: 72
            },
            '& .MuiDataGrid-columnHeaderTitleContainerContent': {
              justifyContent: 'flex-start',
              width: '100%',
              minWidth: 0
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              textTransform: 'uppercase',
              fontWeight: 700,
              fontSize: '0.7rem',
              color: theme.palette.text.secondary
            },
            '& .MuiDataGrid-columnSeparator': {
              display: 'none'
            },
            '& .MuiDataGrid-sortIcon, & .MuiDataGrid-iconButtonContainer .MuiSvgIcon-root': {
              color: grey[500]
            },

            '& .MuiDataGrid-cell:not(.MuiDataGrid-cellCheckbox) > *': {
              minWidth: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            },

            '& .MuiDataGrid-row': {
              bgcolor: theme.palette.background.paper,
              borderBottom: `1px solid ${theme.palette.divider}`,
              borderTop: 'none',
              borderRight: `1px solid ${theme.palette.divider}`,
              cursor: rest.onRowClick ? 'pointer' : 'default'
            },
            '& .MuiDataGrid-cell': {
              bgcolor: 'inherit',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'left',
              px: 2,
              fontSize: '0.85rem !important',
              minHeight: '0 !important',
              overflow: 'hidden'
            },

            '& .MuiDataGrid-cellContent': {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'left',
              width: '100%',
              minWidth: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            },

            '& .MuiDataGrid-cell .MuiTypography-root': {
              fontSize: '0.85rem !important',
              minWidth: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            },

            '& .MuiDataGrid-cellEmpty': {
              padding: '0 !important'
            },

            '& .MuiDataGrid-footerContainer': {
              bgcolor: theme.palette.background.paper,
              borderTop: `1px solid ${theme.palette.divider}`
            },
            '& .MuiDataGrid-virtualScroller': {
              bgcolor: theme.palette.background.paper
            },
            '& .MuiDataGrid-main': {
              overflow: 'hidden'
            },
            '& .MuiDataGrid-row:last-of-type .MuiDataGrid-cell': {
              borderBottom: 'none'
            },

            '&.MuiDataGrid-root--densityCompact .MuiDataGrid-row': {
              padding: '4px',
              minHeight: 100
            }
          };
        },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    />
  );
};

export default CustomDataGrid;
