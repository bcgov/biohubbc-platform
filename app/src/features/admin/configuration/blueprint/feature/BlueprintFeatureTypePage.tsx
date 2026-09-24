import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { isAxiosError } from 'axios';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { BlueprintSkeleton } from '../skeleton/BlueprintSkeleton';
import { BlueprintPropertiesSection } from '../section/BlueprintPropertiesSection';

/**
 * Show properties belonging to one explicit blueprint feature-type assignment.
 *
 * @returns Assignment header, breadcrumbs, and scoped Properties tab.
 */
export const BlueprintFeatureTypePage = () => {
  const params = useParams();
  const blueprintId = Number(params.blueprintId);
  const blueprintFeatureTypeId = Number(params.blueprintFeatureTypeId);
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const validIds =
    Number.isInteger(blueprintId) &&
    blueprintId > 0 &&
    Number.isInteger(blueprintFeatureTypeId) &&
    blueprintFeatureTypeId > 0;
  const blueprintQuery = useQuery({
    queryKey: ['configuration', 'blueprint', blueprintId],
    queryFn: () => api.blueprints.getBlueprint(blueprintId),
    enabled: validIds
  });
  const assignmentQuery = useQuery({
    queryKey: ['configuration', 'blueprint', blueprintId, 'type', blueprintFeatureTypeId],
    queryFn: () => api.blueprintFeatureTypes.getBlueprintFeatureType(blueprintId, blueprintFeatureTypeId),
    enabled: validIds
  });
  const error = blueprintQuery.error ?? assignmentQuery.error;
  useEffect(() => {
    if (!validIds || error) {
      setSnackbar({
        open: true,
        snackbarMessage:
          !validIds || (isAxiosError(error) && error.response?.status === 404)
            ? 'Blueprint feature type not found'
            : error!.message
      });
    }
  }, [validIds, error, setSnackbar]);
  const blueprint = blueprintQuery.data;
  const assignment = assignmentQuery.data;
  const readOnly = Boolean(
    assignment?.record_end_date ||
    blueprint?.record_end_date ||
    (blueprint?.record_effective_date && blueprint.record_effective_date <= dayjs().format('YYYY-MM-DD'))
  );
  return (
    <LoadingGuard
      isLoading={validIds && !error && (blueprintQuery.isPending || assignmentQuery.isPending)}
      isLoadingFallback={<BlueprintSkeleton tabCount={1} />}>
      <PageHeader
        label={assignment?.display_name ?? 'Feature Type'}
        description={assignment?.description ?? undefined}
        breadcrumbs={
          <Breadcrumbs aria-label="Blueprint feature type breadcrumb">
            <Link component={RouterLink} to="/admin/configuration" color="inherit" underline="hover">
              Configuration
            </Link>
            <Link component={RouterLink} to="/admin/configuration?tab=blueprints" color="inherit" underline="hover">
              Blueprints
            </Link>
            <Link
              component={RouterLink}
              to={`/admin/configuration/blueprints/${blueprintId}`}
              color="inherit"
              underline="hover">
              {blueprint?.name ?? 'Blueprint'}
            </Link>
            <Typography color="text.primary">{assignment?.display_name ?? 'Feature Type'}</Typography>
          </Breadcrumbs>
        }
        tabs={
          <Tabs value="properties" aria-label="Feature type configuration">
            <Tab
              value="properties"
              label="Properties"
              id="feature-properties-tab"
              aria-controls="feature-properties-panel"
            />
          </Tabs>
        }
      />
      <Container
        maxWidth="xl"
        sx={{ py: 4 }}
        role="tabpanel"
        id="feature-properties-panel"
        aria-labelledby="feature-properties-tab">
        {blueprint && assignment && (
          <BlueprintPropertiesSection
            key={`${blueprintId}-${blueprintFeatureTypeId}`}
            blueprintId={blueprintId}
            blueprintFeatureTypeId={blueprintFeatureTypeId}
            readOnly={readOnly}
          />
        )}
      </Container>
    </LoadingGuard>
  );
};
