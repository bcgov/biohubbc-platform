import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { IFeaturePropertyRow } from 'interfaces/useFeaturesApi.interface';
import { useMemo } from 'react';
import { formatSubmissionPropertyValue } from 'utils/search-result-utils';
import { type SubmissionPropertyValuePathResolvers } from 'utils/routes.interface';
import { PropertyValueDisplay } from './PropertyValueDisplay';

interface SubmissionFeaturePropertiesSectionProps {
  submissionId: number;
  pathResolvers: SubmissionPropertyValuePathResolvers;
  rows: IFeaturePropertyRow[];
  rowCount: number;
  isLoading: boolean;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
  searchTerm: string;
  onSearch: (term: string) => void;
}

/**
 * Server-paginated properties section for a submission feature.
 *
 * Renders caller-provided submission feature property rows with search, sorting, pagination, and linked reference values.
 *
 * @param {SubmissionFeaturePropertiesSectionProps} props - Component props.
 * @returns {JSX.Element} Submission feature properties section.
 */
export const SubmissionFeaturePropertiesSection = ({
  submissionId,
  pathResolvers,
  rows,
  rowCount,
  isLoading,
  paginationModel,
  setPaginationModel,
  sortModel,
  setSortModel,
  searchTerm,
  onSearch
}: SubmissionFeaturePropertiesSectionProps) => {
  const columns = useMemo<GridColDef<IFeaturePropertyRow>[]>(
    () => [
      {
        field: 'property',
        headerName: 'Property',
        flex: 0.3,
        renderCell: (params) => <span style={{ textTransform: 'capitalize' }}>{params.value}</span>
      },
      {
        field: 'value',
        headerName: 'Value',
        flex: 0.7,
        renderCell: (params) => (
          <Typography
            variant="body2"
            noWrap
            title={formatSubmissionPropertyValue(params.row.value)}
            sx={{ width: '100%' }}>
            <PropertyValueDisplay value={params.row.value} submissionId={submissionId} pathResolvers={pathResolvers} />
          </Typography>
        )
      }
    ],
    [submissionId, pathResolvers]
  );

  return (
    <PageSection
      id="submission-feature-properties"
      label="Properties"
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder="Search by property or value"
            value={searchTerm}
            onChange={(event) => onSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon path={mdiMagnify} size={0.875} />
                  </InputAdornment>
                )
              }
            }}
            sx={{ width: 250 }}
          />
        </Stack>
      }>
      <CustomDataGrid
        autoHeight
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        loading={isLoading}
        noRowsMessage="No properties"
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        rowCount={rowCount}
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        rowSelection={false}
      />
    </PageSection>
  );
};
