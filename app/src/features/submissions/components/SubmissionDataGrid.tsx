import { mdiLock, mdiLockOpenVariantOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Paper } from '@mui/material';
import { makeStyles } from '@mui/styles';
import { Box } from '@mui/system';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowSelectionModel,
  GridValueGetterParams
} from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { SubmissionFeatureRecordWithTypeAndSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useState } from 'react';

const useStyles = makeStyles(() => ({
  datasetDetailsLabel: {
    borderBottom: '1pt solid #dadada'
  }
}));

export interface ISubmissionDataGridProps {
  feature_type_display_name: string;
  submissionFeatures: SubmissionFeatureRecordWithTypeAndSecurity[];
}

/**
 * SubmissionDataGrid component for displaying submission data.
 *
 * @param {ISubmissionDataGridProps} props
 * @return {*}
 */
export const SubmissionDataGrid = (props: ISubmissionDataGridProps) => {
  const classes = useStyles();
  const { feature_type_display_name, submissionFeatures } = props;

  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);

  const fieldNames = submissionFeatures
    .map((feature) => Object.keys(feature.data))
    .reduce((acc, keys) => [...acc, ...keys], []);

  const uniqueFieldNames = [...new Set(fieldNames)];

  const fieldColumns = uniqueFieldNames.map((fieldName) => {
    return {
      field: fieldName,
      headerName: fieldName,
      flex: 2,
      disableColumnMenu: true,
      valueGetter: (params: GridValueGetterParams) => (params.row.data[fieldName] ? params.row.data[fieldName] : null),
      renderCell: (params: GridRenderCellParams) => {
        return <pre>{String(params.value)}</pre>;
      }
    };
  });

  const columns: GridColDef[] = [
    {
      field: 'submission_feature_security_id',
      headerName: 'Security',
      flex: 1,
      disableColumnMenu: true,
      renderCell: (params) => {
        if (params.value > 0) {
          return <Icon path={mdiLock} size={1} />;
        }
        return <Icon path={mdiLockOpenVariantOutline} size={1} />;
      }
    },
    {
      field: 'submission_feature_id',
      headerName: 'ID',
      flex: 1,
      disableColumnMenu: true
    },
    ...fieldColumns,
    {
      field: 'parent_submission_feature_id',
      headerName: 'Parent ID',
      flex: 1,
      disableColumnMenu: true
    }
  ];

  return (
    <Paper elevation={0}>
      <ActionToolbar
        className={classes.datasetDetailsLabel}
        label={`${feature_type_display_name} (${submissionFeatures.length})`}
        labelProps={{ variant: 'h4' }}
      />

      <Box display="flex" width={1}>
        <DataGrid
          sx={{ flexGrow: 1, borderTop: '1pt solid #dadada', borderBottom: '1pt solid #dadada' }}
          data-testid="submission-reviews-data-grid"
          getRowId={(row) => row.submission_feature_id}
          autoHeight
          rows={submissionFeatures}
          columns={columns}
          pageSizeOptions={[5]}
          checkboxSelection
          editMode="row"
          rowSelectionModel={rowSelectionModel}
          onRowSelectionModelChange={setRowSelectionModel}
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
        />
      </Box>
    </Paper>
  );
};

export default SubmissionDataGrid;