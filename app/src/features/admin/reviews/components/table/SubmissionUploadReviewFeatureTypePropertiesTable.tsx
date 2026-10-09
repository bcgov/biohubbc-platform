import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import { PAGE_SIZE_OPTIONS } from 'constants/pagination';
import { PageSection } from 'components/section/PageSection';
import { IFeatureProperty } from 'interfaces/useFeaturePropertiesApi.interface';

interface SubmissionUploadReviewFeatureTypePropertiesTableProps {
  properties: IFeatureProperty[];
  isLoading: boolean;
  hasError: boolean;
}

const COLUMNS: GridColDef<IFeatureProperty>[] = [
  { field: 'display_name', headerName: 'Property', minWidth: 180, flex: 1 }
];

/**
 * Display each observed property definition once in a read-only Properties section.
 * @param {SubmissionUploadReviewFeatureTypePropertiesTableProps} props Definitions and request state.
 * @returns {JSX.Element} Property definition table with loading and empty states.
 */
export const SubmissionUploadReviewFeatureTypePropertiesTable = ({
  properties,
  isLoading,
  hasError
}: SubmissionUploadReviewFeatureTypePropertiesTableProps) => (
  <PageSection id="feature-type-properties" label="Properties">
    <LoadingGuard isLoading={isLoading} isLoadingFallback={<SkeletonTable />}>
      <CustomDataGrid
        autoHeight
        rows={properties}
        columns={COLUMNS}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        getRowId={(row) => row.feature_property_id}
        noRowsMessage={hasError ? 'Unable to load properties.' : 'No properties found.'}
        disableRowSelectionOnClick
        disableColumnSelector
        disableColumnMenu
      />
    </LoadingGuard>
  </PageSection>
);
