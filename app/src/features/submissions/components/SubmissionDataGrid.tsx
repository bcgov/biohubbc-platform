import { mdiLock, mdiLockOpenOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Divider, Paper, Toolbar } from '@mui/material';
import Typography from '@mui/material/Typography';
import { Box } from '@mui/system';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowSelectionModel,
  GridValueGetterParams
} from '@mui/x-data-grid';
import { useCodesContext } from 'hooks/useContext';
import { IFeatureTypeProperties } from 'interfaces/useCodesApi.interface';
import { SubmissionFeatureRecordWithTypeAndSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useState } from 'react';

export interface ISubmissionDataGridProps {
  feature_type_display_name: string;
  feature_type_name: string;
  submissionFeatures: SubmissionFeatureRecordWithTypeAndSecurity[];
}

/**
 * SubmissionDataGrid component for displaying submission data.
 *
 * @param {ISubmissionDataGridProps} props
 * @return {*}
 */
export const SubmissionDataGrid = (props: ISubmissionDataGridProps) => {
  const codesContext = useCodesContext();
  const { submissionFeatures, feature_type_display_name, feature_type_name } = props;

  const featureTypesWithProperties = codesContext.codesDataLoader.data?.feature_type_with_properties;

  const featureTypeWithProperties =
    featureTypesWithProperties?.find((item) => item.feature_type['name'] === feature_type_name)
      ?.feature_type_properties || [];

  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);

  const fieldColumns = featureTypeWithProperties.map((featureType: IFeatureTypeProperties) => {
    return {
      field: featureType.name,
      headerName: featureType.display_name,
      flex: 2,
      disableColumnMenu: true,
      valueGetter: (params: GridValueGetterParams) => params.row.data[featureType.name] ?? null,
      renderCell: (params: GridRenderCellParams) => {
        return <div>{String(params.value)}</div>;
      }
    };
  });

  const columns: GridColDef[] = [
    {
      field: 'submission_feature_security_id',
      headerName: 'Secure',
      flex: 0,
      disableColumnMenu: true,
      width: 100,
      renderCell: (params) => {
        if (params.value > 0) {
          return <Icon path={mdiLock} size={1} />;
        }
        return <Icon path={mdiLockOpenOutline} size={1} />;
      }
    },
    {
      field: 'submission_feature_id',
      headerName: 'ID',
      flex: 0,
      disableColumnMenu: true,
      width: 100
    },
    ...fieldColumns,
    {
      field: 'parent_submission_feature_id',
      headerName: 'Parent ID',
      flex: 0,
      align: 'right',
      headerAlign: 'right',
      width: 120,
      disableColumnMenu: true
    }
  ];

  return (
    <Paper elevation={0}>
      <Toolbar>
        <Typography component="h2" variant="h4">
          {feature_type_display_name}
          <Typography component="span" fontSize="inherit" fontWeight="inherit" color="textSecondary" sx={{ ml: 0.5 }}>
            ({submissionFeatures.length})
          </Typography>
        </Typography>
      </Toolbar>

      <Box px={3}>
        <Divider flexItem></Divider>
        <DataGrid
          data-testid="submission-reviews-data-grid"
          getRowId={(row) => row.submission_feature_id}
          autoHeight
          rows={submissionFeatures}
          columns={columns}
          pageSizeOptions={[5]}
          checkboxSelection
          editMode="row"
          rowSelectionModel={rowSelectionModel}
          onRowSelectionModelChange={(model) => {
            setRowSelectionModel(model);
          }}
          disableRowSelectionOnClick
          disableColumnSelector
          disableColumnMenu
          sortingOrder={['asc', 'desc']}
          initialState={{
            sorting: { sortModel: [{ field: 'submission_feature_id', sort: 'asc' }] },
            pagination: {
              paginationModel: {
                pageSize: 10
              }
            }
          }}
          sx={{
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'text.secondary'
            }
          }}
        />
      </Box>
    </Paper>
  );
};

export default SubmissionDataGrid;
