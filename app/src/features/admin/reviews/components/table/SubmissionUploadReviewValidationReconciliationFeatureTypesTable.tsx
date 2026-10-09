import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { PAGE_SIZE_OPTIONS } from 'constants/pagination';
import { IServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { SubmissionUploadFeatureType } from 'interfaces/useAdminApi.interface';
import { useMemo } from 'react';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';

interface SubmissionUploadReviewValidationReconciliationFeatureTypesTableProps {
  featureTypes: SubmissionUploadFeatureType[];
  rowCount: number;
  grid: IServerPaginatedGridState;
  isLoading: boolean;
  hasError: boolean;
  onFeatureTypeClick: (featureTypeName: string) => void;
}

/**
 * Display one server-paginated page of the feature types found across the upload's features for one outcome in a
 * Feature types section. The grid stays mounted while loading, so another outcome only changes the rows it is given.
 * @param {SubmissionUploadReviewValidationReconciliationFeatureTypesTableProps} props Feature types, pagination and
 * request state.
 * @returns {JSX.Element} Feature type table with loading and empty states.
 */
export const SubmissionUploadReviewValidationReconciliationFeatureTypesTable = ({
  featureTypes,
  rowCount,
  grid,
  isLoading,
  hasError,
  onFeatureTypeClick
}: SubmissionUploadReviewValidationReconciliationFeatureTypesTableProps) => {
  const columns = useMemo<GridColDef<SubmissionUploadFeatureType>[]>(
    () => [
      {
        field: 'feature_type_name',
        headerName: 'Feature type',
        minWidth: 180,
        flex: 1,
        valueGetter: (value: string) => getFeatureTypeDisplayLabel(value)
      },
      { field: 'count', headerName: 'Features', type: 'number', minWidth: 120, flex: 0.5 }
    ],
    []
  );

  return (
    <PageSection id="reconciliation-feature-types" label="Feature types">
      <CustomDataGrid
        autoHeight
        rows={featureTypes}
        columns={columns}
        rowCount={rowCount}
        loading={isLoading}
        paginationMode="server"
        sortingMode="server"
        paginationModel={grid.paginationModel}
        onPaginationModelChange={grid.handlePaginationChange}
        sortModel={grid.sortModel}
        onSortModelChange={grid.handleSortChange}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        getRowId={(row) => row.feature_type_name}
        onRowClick={({ row }) => onFeatureTypeClick(row.feature_type_name)}
        noRowsMessage={hasError ? 'Unable to load feature types.' : 'No feature types found.'}
        disableRowSelectionOnClick
        disableColumnSelector
        disableColumnMenu
      />
    </PageSection>
  );
};
