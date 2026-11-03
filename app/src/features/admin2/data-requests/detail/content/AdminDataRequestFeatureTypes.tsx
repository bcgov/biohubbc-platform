import { mdiCheckCircle, mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { useQueries, useQuery } from '@tanstack/react-query';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import StyledDataGridOverlay from 'components/data-grid/StyledDataGridOverlay';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { searchQueryKeys } from 'utils/query-keys/search-query-keys';

interface AdminDataRequestFeatureTypeRow {
  featureType: string;
  label: string;
  /** Number of features of this type matching the request, or undefined while it is still being counted. */
  featureCount: number | undefined;
}

const columns: GridColDef<AdminDataRequestFeatureTypeRow>[] = [
  { field: 'label', headerName: 'Feature Type', flex: 1 },
  {
    field: 'hasFeatures',
    headerName: 'Data',
    flex: 1,
    sortable: false,
    align: 'center',
    headerAlign: 'center',
    renderCell: (params) => {
      if (params.row.featureCount === undefined) {
        return <Skeleton variant="circular" width={20} height={20} />;
      }

      if (params.row.featureCount > 0) {
        return (
          <Box display="flex" color="success.main">
            <Icon path={mdiCheckCircle} size={1} title="Has data" />
          </Box>
        );
      }

      return <Icon path={mdiClose} size={1} color="inherit" title="No data" />;
    }
  }
];

interface AdminDataRequestFeatureTypesProps {
  dataRequestId: string;
  /** The policy that represents the data request, where its requested feature types are managed. */
  policyId: string;
}

/**
 * Details tab of the administrative data request page: a checklist of the unique feature types the data request asks
 * for, one row each, checked when at least one feature of that type matches the request. A request can ask for
 * feature types the system holds no data for. Each row opens the feature type's own page, which lists the requested
 * features of that type.
 *
 * When the request names no feature type, the empty table offers a link to its policy, where they are managed.
 *
 * @param {AdminDataRequestFeatureTypesProps} props The data request and its policy.
 * @returns {JSX.Element} Requested feature types table.
 */
export const AdminDataRequestFeatureTypes = ({ dataRequestId, policyId }: AdminDataRequestFeatureTypesProps) => {
  const biohubApi = useApi();
  const navigate = useNavigate();

  const featureTypesQuery = useQuery({
    queryKey: policyQueryKeys.dataRequestFeatureTypes(dataRequestId),
    queryFn: ({ signal }) => biohubApi.dataRequest.getDataRequestFeatureTypes(dataRequestId, { signal })
  });
  const featureTypes = featureTypesQuery.data?.feature_types ?? [];

  // The same count the feature type's own page shows, so opening a feature type reuses it.
  const countQueries = useQueries({
    queries: featureTypes.map((featureType) => ({
      queryKey: searchQueryKeys.featureCount(featureType.feature_type_name, undefined, featureType.expression),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        biohubApi.search.countFeatures(featureType.feature_type_name, featureType.expression, { signal })
    }))
  });

  const rows: AdminDataRequestFeatureTypeRow[] = featureTypes.map((featureType, index) => ({
    featureType: featureType.feature_type_name,
    label: getFeatureTypeDisplayLabel(featureType.feature_type_name),
    featureCount: countQueries[index]?.data?.total
  }));

  /**
   * Opens the page of one requested feature type.
   *
   * @param {string} featureType The feature type to open.
   * @returns {void}
   */
  const handleFeatureTypeClick = (featureType: string) => {
    navigate(`/admin/data-requests/${dataRequestId}/feature-types/${encodeURIComponent(featureType)}`);
  };

  return (
    <>
      <QueryErrorDialog error={featureTypesQuery.error} label="feature types" />
      <PageSection
        id="data-request-feature-types"
        label={
          <>
            Requested Features{' '}
            {featureTypesQuery.data && (
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({rows.length})
              </Typography>
            )}
          </>
        }>
        <CustomDataGrid
          data-testid="data-request-feature-types-table"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.featureType}
          loading={featureTypesQuery.isPending}
          noRowsOverlay={
            <StyledDataGridOverlay
              message="No data has been requested yet"
              action={
                <Button component={RouterLink} to={`/admin/policy/${policyId}`} variant="text" size="small">
                  Manage Policy
                </Button>
              }
            />
          }
          onRowClick={({ row }) => handleFeatureTypeClick(row.featureType)}
          onCellKeyDown={({ row }, event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.defaultMuiPrevented = true;
              handleFeatureTypeClick(row.featureType);
            }
          }}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          disableRowSelectionOnClick
          disableColumnSelector
          hideFooter
          autoHeight
        />
      </PageSection>
    </>
  );
};
