import { Divider, Paper, Toolbar } from '@mui/material';
import Typography from '@mui/material/Typography';
import { Box } from '@mui/system';
import { DataGrid, GridRowSelectionModel } from '@mui/x-data-grid';
import { SubmissionFeatureRecordWithTypeAndSecurity } from 'interfaces/useSubmissionsApi.interface';
import React, { useState } from 'react';
import { pluralize } from 'utils/Utils';
import useSubmissionDataGridColumns from './useSubmissionDataGridColumns';

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
  const { submissionFeatures, feature_type_display_name, feature_type_name } = props;

  const columns = useSubmissionDataGridColumns(feature_type_name);

  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);

  return (
    <Paper elevation={0}>
      <Toolbar>
        <Typography component="h2" variant="h4">
          {`${feature_type_display_name} ${pluralize(submissionFeatures.length, 'Record')}`}
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
