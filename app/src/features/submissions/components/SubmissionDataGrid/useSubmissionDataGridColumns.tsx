import { mdiLock, mdiLockOpenOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Stack, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { GridColDef, GridRenderCellParams, GridValueGetterParams } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import { useCodesContext } from 'hooks/useContext';
import useDownload from 'hooks/useDownload';
import { IFeatureTypeProperties } from 'interfaces/useCodesApi.interface';

/**
 * Hook to generate columns for SubmissionDataGrid
 *
 * @param {string} featureTypeName - current feature type
 * @returns {GridColDef[]}
 */
const useSubmissionDataGridColumns = (featureTypeName: string): GridColDef[] => {
  const api = useApi();
  const codesContext = useCodesContext();
  const { downloadSignedUrl } = useDownload();

  const featureTypesWithProperties = codesContext.codesDataLoader.data?.feature_type_with_properties;

  const featureTypeWithProperties =
    featureTypesWithProperties?.find((item) => item.feature_type['name'] === featureTypeName)
      ?.feature_type_properties ?? [];

  const fieldColumns = featureTypeWithProperties.map((featureType: IFeatureTypeProperties) => {
    if (featureType.type === 's3_key') {
      return {
        field: featureType.name,
        headerName: '',
        flex: 1,
        disableColumnMenu: true,
        disableReorder: true,
        hideSortIcons: true,
        valueGetter: (params: GridValueGetterParams) => params.row.data[featureType.name] ?? null,
        renderCell: (params: GridRenderCellParams) => {
          const download = async () => {
            const signedUrlPromise = api.submissions.getSubmissionFeatureSignedUrl({
              submissionId: params.row.submission_id,
              submissionFeatureId: params.row.submission_feature_id,
              submissionFeatureKey: featureType.type,
              submissionFeatureValue: params.value
            });
            await downloadSignedUrl(signedUrlPromise);
          };
          return (
            <Button variant="outlined" size="small" onClick={download}>
              Download
            </Button>
          );
        }
      };
    }
    return {
      field: featureType.name,
      headerName: featureType.display_name,
      flex: 1,
      disableColumnMenu: true,
      valueGetter: (params: GridValueGetterParams) => params.row.data[featureType.name] ?? null,
      renderCell: (params: GridRenderCellParams) => (
        <Box
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
          {String(params.value)}
        </Box>
      )
    };
  });

  const columns: GridColDef[] = [
    {
      field: 'submission_feature_security_ids',
      headerName: 'Security',
      flex: 0,
      disableColumnMenu: true,
      width: 160,
      renderCell: (params) => {
        if (params.value.length > 0) {
          return (
            <Stack flexDirection="row" alignItems="center" gap={1} color="error.main">
              <Icon path={mdiLock} size={0.75} />
              <Typography variant="body2" component="span" fontWeight={700} textTransform="uppercase">
                Secured
              </Typography>
            </Stack>
          );
        }
        return (
          <Stack flexDirection="row" alignItems="center" gap={1} color="error.main">
            <Icon path={mdiLockOpenOutline} size={0.75} />
            <Typography variant="body2" component="span" fontWeight={700} textTransform="uppercase">
              Unsecured
            </Typography>
          </Stack>
        );
      }
    },
    {
      field: 'submission_feature_id',
      headerName: 'ID',
      flex: 0,
      disableColumnMenu: true,
      width: 100
    },
    {
      field: 'parent_submission_feature_id',
      headerName: 'Parent ID',
      flex: 0,
      disableColumnMenu: true,
      width: 120
    },
    ...fieldColumns
  ];

  return columns;
};

export default useSubmissionDataGridColumns;
