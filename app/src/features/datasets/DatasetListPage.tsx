import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/system/Stack';
import useDownloadJSON from 'hooks/useDownloadJSON';
import React, { useState } from 'react';
import DatasetSortMenu from './components/DatasetSortMenu';

//Note the structure for this type is likely to change once API response is known
export interface IDataset {
  submission_id: number;
  submission_title: string;
  submission_message: string;
  submission_date: Date;
  secure: boolean;
}

//Temp placeholder dataset data
const datasetData = [
  {
    submission_id: 1, // assuming this will be submission_id
    submission_title: 'Dataset Title A', // unknown what this value should link to
    submission_message:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(),
    secure: false
  },
  {
    submission_id: 2,
    submission_title: 'Dataset Title B',
    submission_message:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000),
    secure: true
  }
];

/**
 * Renders Datasets as cards with download and request access actions
 *
 * @returns {*}
 */
const DatasetListPage = () => {
  const download = useDownloadJSON();

  // Note: this will be populated by API once wired up
  const [datasets, setDatasets] = useState<IDataset[]>(datasetData);

  const handleDownload = (dataset: IDataset) => {
    // make request here for JSON data of dataset
    // pass to dowload
    const mockDownloadData = { a: 'b' };
    download(mockDownloadData, `${dataset.submission_title.toLowerCase().replace(/ /g, '-')}-${dataset.submission_id}`);
    console.log('download placeholder');
  };

  const handleRequestAccess = () => {
    console.log('request access placeholder');
  };

  return (
    <Box>
      <Paper
        square
        elevation={0}
        sx={{
          py: 4
        }}>
        <Container maxWidth="xl">
          <Typography variant="h1">Datasets</Typography>
        </Container>
      </Paper>
      <Container maxWidth="xl">
        <Box py={4} display="flex" alignItems="center" justifyContent="space-between">
          {datasets.length > 0 ? <Typography fontWeight="bold">{`${datasets.length} records found`}</Typography> : null}
          <DatasetSortMenu
            data={datasets}
            handleSortedData={(data: IDataset[]) => {
              setDatasets(data);
            }}
          />
        </Box>
        <Stack spacing={2} mb={2}>
          {datasets.map((dataset) => (
            <Card elevation={0} key={dataset.submission_id}>
              <CardHeader
                title={dataset.submission_title}
                subheader={
                  <Typography variant="body2" color="textSecondary">
                    {dataset.submission_date.toDateString()}
                  </Typography>
                }
                action={
                  <Button
                    variant={dataset.secure ? 'outlined' : 'contained'}
                    sx={{ ml: 'auto', minWidth: 150 }}
                    disableElevation
                    onClick={() => {
                      dataset.secure ? handleRequestAccess() : handleDownload(dataset);
                    }}>
                    {dataset.secure ? 'Request Access' : 'Download'}
                  </Button>
                }
              />
              <CardContent sx={{ pt: 0, display: 'flex', alignItems: 'center' }}>
                <Typography variant="body1" color="textSecondary">
                  {dataset.submission_message}
                </Typography>
                {/* <Button
                  href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataset.data))}`}
                  download="filename.json">
                  Download Json
                </Button> */}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default DatasetListPage;
