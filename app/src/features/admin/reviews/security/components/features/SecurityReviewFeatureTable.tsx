import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { PageSection } from 'components/section/PageSection';
import { SearchResultSearch } from 'features/search/result/header/SearchResultSearch';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ISubmissionUploadSecuritySearchFeature } from 'interfaces/useAdminApi.interface';
import { useMemo } from 'react';
import { CursorPagination } from 'types/pagination';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { SecurityClassificationIcon } from './SecurityClassificationIcon';

interface SecurityReviewFeatureTableProps {
  rows: ISubmissionUploadSecuritySearchFeature[];
  totalCount?: number;
  isLoading: boolean;
  searchTerm: string;
  expressionTree: ExpressionTreeExpression | null;
  cursor: CursorPagination;
  selectedFeatureIds: number[];
  onPageChange: (cursor: string) => void;
  onPageSizeChange: (limit: number) => void;
  onSelectionChange: (submissionFeatureIds: number[]) => void;
  onExpressionApply: (expressionTree: ExpressionTreeExpression | null) => void;
  onOpenProperties: (feature: ISubmissionUploadSecuritySearchFeature) => void;
  onOpenSecurity: (feature: ISubmissionUploadSecuritySearchFeature) => void;
}

/**
 * Renders the server-paginated upload feature grid.
 *
 * @param {SecurityReviewFeatureTableProps} props - Security review feature table properties.
 * @returns {JSX.Element} Rendered security review feature table.
 */
export const SecurityReviewFeatureTable = (props: SecurityReviewFeatureTableProps) => {
  const { onOpenSecurity, onOpenProperties, selectedFeatureIds } = props;
  const selectionModel = useMemo<GridRowSelectionModel>(
    () => ({ type: 'include', ids: new Set(selectedFeatureIds) }),
    [selectedFeatureIds]
  );
  const columns = useMemo<GridColDef<ISubmissionUploadSecuritySearchFeature>[]>(
    () => [
      { field: 'submission_feature_id', headerName: 'ID', width: 100, sortable: false },
      {
        field: 'security',
        headerName: 'Security',
        sortable: false,
        flex: 1,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }) => (
          <IconButton
            aria-label={`Open security for feature ${row.submission_feature_id}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenSecurity(row);
            }}>
            <SecurityClassificationIcon provenance={row.provenance} />
          </IconButton>
        )
      },
      {
        field: 'feature_type_name',
        headerName: 'Feature Type',
        sortable: false,
        flex: 1,
        valueGetter: (_value, row) => getFeatureTypeDisplayLabel(row.feature_type_name)
      },
      { field: 'parent_submission_feature_id', headerName: 'Parent', flex: 1, sortable: false },
      {
        field: 'actions',
        headerName: '',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: ({ row }) => (
          <Button
            color="primary"
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              onOpenProperties(row);
            }}>
            Properties
          </Button>
        )
      }
    ],
    [onOpenSecurity, onOpenProperties]
  );

  return (
    <PageSection
      id="security-review-features"
      sx={{ height: '100%', minHeight: { xs: 600, sm: 0 }, display: 'flex', flexDirection: 'column' }}
      label={
        <>
          Features{' '}
          <Typography component="span" color="text.secondary">
            ({props.totalCount ?? props.rows.length})
          </Typography>
        </>
      }>
      <Box p={2} borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
        <SearchResultSearch
          searchTerm={props.searchTerm}
          expressionTree={props.expressionTree}
          onExpressionApply={props.onExpressionApply}
        />
      </Box>
      <CustomDataGrid
        checkboxSelection
        disableRowSelectionExcludeModel
        rows={props.rows}
        columns={columns}
        loading={props.isLoading}
        getRowId={(row) => row.submission_feature_id}
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={(model: GridRowSelectionModel) =>
          props.onSelectionChange(Array.from(model.ids) as number[])
        }
        hideFooter
        noRowsMessage="No features found."
        sx={{
          flex: 1,
          minHeight: 0,
          '& .MuiDataGrid-row': { cursor: 'pointer' }
        }}
      />
      <Divider />
      <Box sx={{ px: 2, py: 1 }}>
        <CustomPagination
          cursor={props.cursor}
          rowCount={props.rows.length}
          totalCount={props.totalCount}
          onPageChange={props.onPageChange}
          onPageSizeChange={props.onPageSizeChange}
        />
      </Box>
    </PageSection>
  );
};
