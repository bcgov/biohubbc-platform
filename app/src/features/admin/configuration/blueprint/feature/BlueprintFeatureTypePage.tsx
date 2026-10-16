import Breadcrumbs from '@mui/material/Breadcrumbs';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { isAxiosError } from 'axios';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import dayjs from 'dayjs';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
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
      <AdminPageLayout
        title={assignment?.display_name ?? 'Feature Type'}
        description={assignment?.description ?? undefined}
        breadcrumbs={
          <Breadcrumbs aria-label="Blueprint feature type breadcrumb">
            <Link component={RouterLink} to="/admin" color="inherit" underline="hover">
              Administration
            </Link>
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
        tabs={[
          {
            value: 'properties',
            label: 'Properties',
            id: 'feature-properties-tab',
            ariaControls: 'feature-properties-panel'
          }
        ]}
        activeTab="properties"
        onTabChange={() => {}}>
        <Box role="tabpanel" id="feature-properties-panel" aria-labelledby="feature-properties-tab">
          {blueprint && assignment && (
            <BlueprintPropertiesSection
              key={`${blueprintId}-${blueprintFeatureTypeId}`}
              blueprintId={blueprintId}
              blueprintFeatureTypeId={blueprintFeatureTypeId}
              readOnly={readOnly}
            />
          )}
        </Box>
      </AdminPageLayout>
    </LoadingGuard>
  );
};
