import { Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { makeStyles } from '@mui/styles';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { SubmissionContext } from 'contexts/submissionContext';
import { IFeature } from 'interfaces/useDatasetApi.interface';
import { useContext } from 'react';
import SubmissionHeader from './components/SubmissionHeader';

const useStyles = makeStyles((theme: Theme) => ({
  datasetTitleContainer: {
    paddingBottom: theme.spacing(5),
    background: '#f7f8fa',
    '& h1': {
      marginTop: '-4px'
    }
  },
  datasetDetailsLabel: {
    borderBottom: '1pt solid #dadada'
  },
  datasetDetailsContainer: {},
  datasetMapContainer: {
    minHeight: '400px'
  }
}));

const AdminSubmissionPage: React.FC<React.PropsWithChildren> = () => {
  const classes = useStyles();
  const submissionContext = useContext(SubmissionContext);

  const submissionDataLoader = submissionContext.submissionDataLoader;
  const submissionFeatures:
    | {
        dataset: IFeature[];
        sampleSites: IFeature[];
        animals: IFeature[];
        observations: IFeature[];
      }
    | undefined = submissionDataLoader.data?.features;

  const sampleSites = submissionFeatures?.sampleSites;
  const animals = submissionFeatures?.animals;
  const observations = submissionFeatures?.observations;

  const columns: GridColDef[] = [
    {
      field: 'submission_feature_id',
      headerName: 'ID',
      flex: 1,
      disableColumnMenu: true
    },
    {
      field: 'feature_type',
      headerName: 'Type',
      flex: 2,
      disableColumnMenu: true
    },
    {
      field: 'data',
      headerName: 'Data',
      flex: 2,
      disableColumnMenu: true,
      renderCell: (params) => {
        return <pre>{JSON.stringify(params.value, null, 2)}</pre>;
      }
    },
    {
      field: 'parent_submission_feature_id',
      headerName: 'Parent ID',
      flex: 1,
      disableColumnMenu: true
    }
  ];

  return (
    <Box>
      <SubmissionHeader />
      <Container maxWidth="xl">
        <Box py={3}>
          <Paper elevation={0}>
            <ActionToolbar
              className={classes.datasetDetailsLabel}
              label="ADMIN DATASET DETAILS"
              labelProps={{ variant: 'h4' }}
            />
            <Box display="flex">
              {sampleSites && (
                <DataGrid
                  sx={{ borderTop: '1pt solid #dadada', borderBottom: '1pt solid #dadada' }}
                  data-testid="security-reviews-data-grid"
                  getRowId={(row) => row.submission_feature_id}
                  autoHeight
                  rows={sampleSites}
                  columns={columns}
                  pageSizeOptions={[5]}
                  disableRowSelectionOnClick
                  disableColumnSelector
                  disableColumnMenu
                  sortingOrder={['asc', 'desc']}
                  initialState={{
                    sorting: { sortModel: [{ field: 'last_updated', sort: 'desc' }] },
                    pagination: {
                      paginationModel: {
                        pageSize: 5
                      }
                    }
                  }}
                />
              )}
            </Box>

            <Box display="flex">
              {animals && (
                <DataGrid
                  sx={{ borderTop: '1pt solid #dadada', borderBottom: '1pt solid #dadada' }}
                  data-testid="security-reviews-data-grid"
                  getRowId={(row) => row.submission_feature_id}
                  autoHeight
                  rows={animals}
                  columns={columns}
                  pageSizeOptions={[5]}
                  disableRowSelectionOnClick
                  disableColumnSelector
                  disableColumnMenu
                  sortingOrder={['asc', 'desc']}
                  initialState={{
                    sorting: { sortModel: [{ field: 'last_updated', sort: 'desc' }] },
                    pagination: {
                      paginationModel: {
                        pageSize: 5
                      }
                    }
                  }}
                />
              )}
            </Box>
            <Box display="flex">
              {observations && (
                <DataGrid
                  sx={{ borderTop: '1pt solid #dadada', borderBottom: '1pt solid #dadada' }}
                  data-testid="security-reviews-data-grid"
                  getRowId={(row) => row.submission_feature_id}
                  autoHeight
                  rows={observations}
                  columns={columns}
                  pageSizeOptions={[5]}
                  disableRowSelectionOnClick
                  disableColumnSelector
                  disableColumnMenu
                  sortingOrder={['asc', 'desc']}
                  initialState={{
                    sorting: { sortModel: [{ field: 'last_updated', sort: 'desc' }] },
                    pagination: {
                      paginationModel: {
                        pageSize: 5
                      }
                    }
                  }}
                />
              )}
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default AdminSubmissionPage;
