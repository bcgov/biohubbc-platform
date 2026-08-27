import { mdiLock, mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef, GridRowParams } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { PageSection } from 'components/section/PageSection';
import { SubmissionFeatureMap } from 'features/submissions/page/features/components/map/SubmissionFeatureMap';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { IRelatedSubmissionFeature, ISubmissionFeaturePropertiesResponse } from 'interfaces/useFeaturesApi.interface';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';

interface IFeaturePropertyRow {
  id: string;
  property: string;
  value: string;
}

interface IPortalFeaturePropertiesSectionProps {
  submissionId?: string;
  submissionFeatureId?: string;
}

interface IPortalFeatureRelatedSectionProps {
  submissionId?: string;
  relatedFeatures: IRelatedSubmissionFeature[];
}

const propertiesColumns: GridColDef<IFeaturePropertyRow>[] = [
  {
    field: 'property',
    headerName: 'Property',
    flex: 0.3,
    renderCell: (params) => <span style={{ textTransform: 'capitalize' }}>{params.value}</span>
  },
  {
    field: 'value',
    headerName: 'Value',
    flex: 0.7
  }
];

const PortalFeaturePropertiesSection = ({
  submissionId,
  submissionFeatureId
}: IPortalFeaturePropertiesSectionProps) => {
  const api = useApi();

  const propertyGrid = useServerPaginatedDataGrid<IFeaturePropertyRow, ISubmissionFeaturePropertiesResponse>({
    fetcher: async (search, pagination) => {
      if (!submissionId || !submissionFeatureId) {
        return {
          properties: [],
          pagination: {
            total: 0,
            current_page: 1,
            last_page: 1,
            per_page: pagination.limit
          }
        };
      }

      return api.features.getSubmissionFeatureProperties(submissionId, submissionFeatureId, {
        search,
        ...pagination
      });
    },
    extractData: (response) => response.properties,
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'property', sort: 'asc' },
    defaultPageSize: 10
  });

  return (
    <PageSection
      id="portal-submission-feature-properties"
      label="Properties"
      headerContent={
        <Stack gap={1} direction="row" alignItems="center">
          <TextField
            size="small"
            placeholder="Search by property or value"
            value={propertyGrid.searchTerm}
            onChange={(event) => propertyGrid.handleSearch(event.target.value)}
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
        rows={propertyGrid.rows}
        columns={propertiesColumns}
        getRowId={(row) => row.id}
        loading={propertyGrid.isLoading}
        noRowsMessage="No properties"
        paginationMode="server"
        paginationModel={propertyGrid.paginationModel}
        onPaginationModelChange={propertyGrid.handlePaginationChange}
        pageSizeOptions={[10, 25, 50]}
        rowCount={propertyGrid.rowCount}
        sortingMode="server"
        sortModel={propertyGrid.sortModel}
        onSortModelChange={propertyGrid.handleSortChange}
        rowSelection={false}
      />
    </PageSection>
  );
};

const PortalFeatureRelatedSection = ({ submissionId, relatedFeatures }: IPortalFeatureRelatedSectionProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const columns: GridColDef<IRelatedSubmissionFeature>[] = [
    {
      field: 'submission_feature_id',
      headerName: 'ID',
      width: 120
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      renderCell: (params) => params.row.data?.name || params.row.feature_type_display_name
    },
    {
      field: 'feature_type_display_name',
      headerName: 'Feature Type',
      flex: 1
    }
  ];

  const handleRowClick = (params: GridRowParams<IRelatedSubmissionFeature>) => {
    if (!submissionId) {
      return;
    }

    navigate(`/portal/submission/${submissionId}/feature/${params.row.submission_feature_id}${location.search}`);
  };

  return (
    <PageSection id="portal-submission-feature-related" label="Related">
      <CustomDataGrid
        autoHeight
        rows={relatedFeatures}
        columns={columns}
        getRowId={(row) => row.submission_feature_id}
        onRowClick={handleRowClick}
        noRowsMessage="No related features"
        hideFooter
        rowSelection={false}
      />
    </PageSection>
  );
};

/**
 * Portal submission feature detail page scoped to the current user's submission.
 *
 * @returns {JSX.Element}
 */
export const PortalSubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const api = useApi();
  const { submissionId, submissionFeatureId } = useParams<{ submissionId: string; submissionFeatureId: string }>();

  const featureDataLoader = useDataLoader(
    (id, featureId) => api.features.getSubmissionFeatureById(id, featureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );

  useEffect(() => {
    if (!submissionId || !submissionFeatureId) {
      return;
    }

    featureDataLoader.refresh(submissionId, submissionFeatureId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId]);

  const { feature, relatedFeatures } = useMemo(
    () => featureDataLoader.data ?? { feature: undefined, relatedFeatures: undefined },
    [featureDataLoader.data]
  );

  return (
    <LoadingGuard
      isLoading={featureDataLoader.isLoading}
      isLoadingFallback={<SkeletonPage />}
      isLoadingFallbackDelay={300}
      hasNoData={!feature}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No data available</Typography>
        </Box>
      }>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to="/portal/submission" underline="hover" color="inherit">
              Portal
            </Link>
            <Link
              component={RouterLink}
              to={`/portal/submission/${feature?.submission_id}`}
              underline="hover"
              color="inherit">
              {feature?.submission_name}
            </Link>
            <Typography color="text.primary">{feature?.feature_type_display_name}</Typography>
          </Breadcrumbs>
        }
        label={
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              {feature?.feature_type_display_name}
            </Typography>
          </Box>
        }
        subheader={
          <Box display="flex" gap={1}>
            <Chip label={feature?.feature_type_name} size="small" />
            {feature?.secured && <Chip icon={<Icon path={mdiLock} size={0.625} />} label="Secured" size="small" />}
          </Box>
        }
      />
      <Container maxWidth="xl">
        <Stack spacing={3} py={4}>
          <PortalFeaturePropertiesSection submissionId={submissionId} submissionFeatureId={submissionFeatureId} />
          <PageSection id="portal-submission-feature-map" label="Map">
            {feature && (
              <SubmissionFeatureMap
                submissionId={feature.submission_id}
                submissionFeatureId={feature.submission_feature_id}
              />
            )}
          </PageSection>
          <PortalFeatureRelatedSection submissionId={submissionId} relatedFeatures={relatedFeatures ?? []} />
        </Stack>
      </Container>
    </LoadingGuard>
  );
};
