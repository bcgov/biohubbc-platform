import { CircularProgress, Divider } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { SubmissionRecord } from 'interfaces/useDatasetApi.interface';
import React from 'react';

const DatasetsForReviewTable: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();

  const unreviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.dataset.getUnreviewedSubmissions());
  unreviewedSubmissionsDataLoader.load();

  const datasetList: SubmissionRecord[] = unreviewedSubmissionsDataLoader.data ?? [];
  const columns: GridColDef<SubmissionRecord>[] = [
    {
      field: 'submission_id',
      headerName: 'ID',
      flex: 1,
      disableColumnMenu: true
    },
    {
      field: 'uuid',
      headerName: 'UUID',
      flex: 1,
      disableColumnMenu: true
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      disableColumnMenu: true
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      disableColumnMenu: true
    },
    {
      field: 'create_date',
      headerName: 'Date Created',
      flex: 1,
      disableColumnMenu: true
    }
  ];

  return (
    <>
      {unreviewedSubmissionsDataLoader.isLoading && <CircularProgress className="pageProgress" size={40} />}

      {datasetList.length === 0 && !unreviewedSubmissionsDataLoader.isLoading && (
        <Box
          sx={{
            p: 3,
            m: 1,
            display: 'flex',
            flexFlow: 'column',
            alignItems: 'center',
            position: 'relative',
            border: '1pt solid #dadada',
            borderRadius: '4px'
          }}>
          <Typography
            data-testid="no-security-reviews"
            component="strong"
            color="textSecondary"
            variant="body1"
            fontWeight={'bold'}>
            No Pending Security Reviews
          </Typography>
        </Box>
      )}

      {datasetList.length > 0 && !unreviewedSubmissionsDataLoader.isLoading && (
        <DataGrid
          sx={{ borderTop: '1pt solid #dadada', borderBottom: '1pt solid #dadada', display: 'none' }}
          data-testid="security-reviews-data-grid"
          getRowId={(row) => row.submission_id}
          autoHeight
          rows={datasetList}
          columns={columns}
          pageSizeOptions={[5]}
          disableRowSelectionOnClick
          disableColumnSelector
          disableColumnMenu
          hideFooter
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

      <Stack gap={2}>
        <Card>
          <Stack component={CardContent} 
            flexDirection={{sm: 'column', md: 'row'}}
            alignItems={{sm: 'flex-start', md: 'center'}}
            gap={2}
            sx={{
              px: 3
            }}
          >
            <Stack flex="1 1 auto" gap={2}>
              <Stack flexDirection="row" alignItems="flex-start" gap={2}>
                <Stack flex="1 1 auto" gap={1.5}>
                  <Stack 
                      component="dl" 
                      flexDirection="row" 
                      alignItems="center"
                      sx={{
                        typography: 'body2',
                        whiteSpace: 'nowrap',
                        '& dd': {
                          color: 'text.secondary'
                        },
                        '& dt': {
                          color: 'text.secondary'
                        }
                      }}
                    >
                    <Stack flexDirection="row">
                      <dd hidden>Submitted on:</dd>
                      <dt>YYYY-MM-DD</dt>
                    </Stack>
                  </Stack>
                  <Typography component="h3" variant="h4"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: '2',
                      WebkitBoxOrient: 'vertical',
                      maxWidth: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Submission Title Submission Title Submission Title Submission Title Submission Title Submission Title
                  </Typography>
                </Stack>
              </Stack>

              <Typography variant="body1" color="textSecondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  mt: -0.65,
                  maxWidth: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam at porttitor sem.  Aliquam erat volutpat. Donec placerat nisl magna, et faucibus arcu condimentum sed.
              </Typography>

              <Stack 
                component="dl" 
                flexDirection={{xs: 'column', md: 'row'}} 
                alignItems={{xs: 'flex-start', md: 'center'}} 
                justifyContent="flex-start" 
                gap={{md: 3}}
                divider={<Divider orientation="vertical" flexItem />}
                sx={{
                  typography: 'body2',
                  whiteSpace: 'nowrap',
                  '& dd': {
                    color: 'text.secondary',
                    width: {xs: 60, md: 'auto'}
                  },
                  '& dt': {
                    ml: 1,
                    fontWeight: 700
                  }
                }}
              >
                <Stack flexDirection="row">
                  <dd>Type:</dd>
                  <dt>Dataset</dt>
                </Stack>
                <Stack flexDirection="row">
                  <dd>Source:</dd>
                  <dt>Species Inventory Management System</dt>
                </Stack>
              </Stack>
            </Stack>
            
            <Stack 
              minWidth={{xs: 'auto', md: 300}} 
              alignItems={{xs: 'flex-start', md: 'center'}}
              mt={{xs: 1, md: 0}}>
              <Button variant="contained" color="primary"
                sx={{
                  flex: '0 0 auto',
                  minWidth: '7rem'
                }}
              >
                Review
              </Button>
            </Stack>

          </Stack>
        </Card>
        
      </Stack>

    </>
  );
};

export default DatasetsForReviewTable;
