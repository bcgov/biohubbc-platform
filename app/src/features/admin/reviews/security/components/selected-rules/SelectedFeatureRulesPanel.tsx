import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { SearchInput } from 'components/search/SearchInput';
import { PageSection } from 'components/section/PageSection';
import { ISubmissionUploadReviewSelectedFeatureRule } from 'interfaces/useAdminApi.interface';

interface SelectedFeatureRulesPanelProps {
  rows: ISubmissionUploadReviewSelectedFeatureRule[];
  rowCount: number;
  isLoading: boolean;
  error: unknown;
  searchTerm: string;
  paginationModel: GridPaginationModel;
  onSearch: (value: string) => void;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  onChangeRule: (rule: ISubmissionUploadReviewSelectedFeatureRule) => void;
  onReset: () => void;
  onRetry: () => void;
}

/**
 * Renders rule states and direct actions for the current feature scope.
 *
 * @param {SelectedFeatureRulesPanelProps} props - Selected-feature rules panel properties.
 * @returns {JSX.Element} Rendered selected-feature rules panel.
 */
export const SelectedFeatureRulesPanel = (props: SelectedFeatureRulesPanelProps) => {
  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'category_name', headerName: 'Category', flex: 1 },
    {
      field: 'actions',
      headerName: '',
      sortable: false,
      width: 110,
      renderCell: ({ row }) => {
        const isApplied = row.applied;
        const label = isApplied ? 'Applied' : 'Apply';
        return (
          <Button
            size="small"
            variant={isApplied ? 'contained' : 'outlined'}
            color={isApplied ? 'success' : 'primary'}
            onClick={() => props.onChangeRule(row)}>
            {label}
          </Button>
        );
      }
    }
  ];
  return (
    <PageSection
      id="selected-feature-rules"
      label="Security Rules"
      headerContent={
        <Button size="small" color="primary" variant="text" onClick={props.onReset}>
          Reset
        </Button>
      }>
      <Box p={2} borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
        <SearchInput
          size="small"
          placeholder="Search rules..."
          inputProps={{ 'aria-label': 'Search rules' }}
          value={props.searchTerm}
          onChange={(event) => props.onSearch(event.target.value)}
          onClear={() => props.onSearch('')}
        />
      </Box>
      {props.error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={props.onRetry}>
              Try Again
            </Button>
          }>
          {(props.error as Error).message}
        </Alert>
      ) : null}
      <CustomDataGrid
        rowSelection={false}
        autoHeight
        rows={props.rows}
        columns={columns}
        getRowId={(row) => row.security_rule_id}
        loading={props.isLoading}
        rowCount={props.rowCount}
        paginationMode="server"
        paginationModel={props.paginationModel}
        onPaginationModelChange={props.onPaginationModelChange}
        pageSizeOptions={[10, 25, 50]}
        sortingMode="server"
        noRowsMessage="No security rules found."
      />
    </PageSection>
  );
};
