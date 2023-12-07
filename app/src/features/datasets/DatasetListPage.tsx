import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/system/Stack';
import { FuseResult, RangeTuple } from 'fuse.js';
import useDownloadJSON from 'hooks/useDownloadJSON';
import React, { useState } from 'react';
import DatasetFuzzySearch from './components/DatasetFuzzySearch';
//Note the structure for this type is likely to change once API response is known
export interface IDataset {
  submission_feature_id: number;
  name: string;
  description: string;
  submission_date: Date;
  secure: boolean;
}

//Temp placeholder dataset data
const datasetData = [
  {
    submission_feature_id: 1, // assuming this will be submission_feature_id
    name: 'Dataset A', // unknown what this value should link to
    description:
      'testfuzzy Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribou incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(),
    secure: false
  },
  {
    submission_feature_id: 2,
    name: 'Dataset Beaar',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor bee incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000),
    secure: true
  },
  {
    submission_feature_id: 3,
    name: 'Moose Datset',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor mooses incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000 * 300),
    secure: true
  },
  {
    submission_feature_id: 4,
    name: 'Caribou Datazet',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribooo incididunt ut labore et dolore magna aliqua. quack',
    submission_date: new Date(Date.now() - 86400000 * 1000),
    secure: true
  },
  {
    submission_feature_id: 5, // assuming this will be submission_feature_id
    name: 'Dataset A', // unknown what this value should link to
    description:
      'testfuzzy Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribou incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(),
    secure: false
  },
  {
    submission_feature_id: 6,
    name: 'Dataset Beaar',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor bee incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000),
    secure: true
  },
  {
    submission_feature_id: 7,
    name: 'Moose Datset',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor mooses incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000 * 300),
    secure: true
  },
  {
    submission_feature_id: 8,
    name: 'Caribou Datazet',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribooo incididunt ut labore et dolore magna aliqua. quack',
    submission_date: new Date(Date.now() - 86400000 * 1000),
    secure: true
  },
  {
    submission_feature_id: 9, // assuming this will be submission_feature_id
    name: 'Dataset A', // unknown what this value should link to
    description:
      'testfuzzy Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribou incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(),
    secure: false
  },
  {
    submission_feature_id: 10,
    name: 'Dataset Beaar',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor bee incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000),
    secure: true
  },
  {
    submission_feature_id: 11,
    name: 'Moose Datset',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor mooses incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000 * 300),
    secure: true
  },
  {
    submission_feature_id: 12,
    name: 'Caribou Datazet',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribooo incididunt ut labore et dolore magna aliqua. quack',
    submission_date: new Date(Date.now() - 86400000 * 1000),
    secure: true
  },
  {
    submission_feature_id: 13, // assuming this will be submission_feature_id
    name: 'Dataset A', // unknown what this value should link to
    description:
      'testfuzzy Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribou incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(),
    secure: false
  },
  {
    submission_feature_id: 14,
    name: 'Dataset Beaar',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor bee incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000),
    secure: true
  },
  {
    submission_feature_id: 15,
    name: 'Moose Datset',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor mooses incididunt ut labore et dolore magna aliqua.',
    submission_date: new Date(Date.now() - 86400000 * 300),
    secure: true
  },
  {
    submission_feature_id: 16,
    name: 'Caribou Datazet',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor caribooo incididunt ut labore et dolore magna aliqua. quack',
    submission_date: new Date(Date.now() - 86400000 * 1000),
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

  // For convienience and optimization. Generates the dataset as FuseResult
  const originalFuzzyDatasets = datasetData.map((item, refIndex) => ({
    item,
    refIndex,
    matches: []
  }));

  const [fuzzyDatasets, setFuzzyDatasets] = useState<FuseResult<IDataset>[]>(originalFuzzyDatasets);

  const handleDownload = (dataset: FuseResult<IDataset>) => {
    // make request here for JSON data of dataset
    // pass to dowload
    const mockDownloadData = { a: 'b' };
    download(
      mockDownloadData,
      `${dataset.item.name.toLowerCase().replace(/ /g, '-')}-${dataset.item.submission_feature_id}`
    );
    console.log('download placeholder');
  };

  const handleRequestAccess = () => {
    console.log('request access placeholder');
  };

  const highlight = (value: string, indices: readonly RangeTuple[] = [], i = 1): string | JSX.Element => {
    const pair = indices[indices.length - i];
    return !pair ? (
      value
    ) : (
      <>
        {highlight(value.substring(0, pair[0]), indices, i + 1)}
        <mark style={{ backgroundColor: '#3B99FC' }}>{value.substring(pair[0], pair[1] + 1)}</mark>
        {value.substring(pair[1] + 1)}
      </>
    );
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
          <Typography variant="h1" mb={2}>
            Datasets
          </Typography>
          <DatasetFuzzySearch
            originalDatasets={datasetData}
            originalFuzzyDatasets={originalFuzzyDatasets}
            handleFuzzyDatasets={(dataset) => {
              setFuzzyDatasets(dataset);
            }}
          />
        </Container>
      </Paper>
      <Container maxWidth="xl">
        <Box py={4} display="flex" alignItems="center" justifyContent="space-between">
          <Typography fontWeight="bold">{`${fuzzyDatasets?.length ?? 0} records found`}</Typography>
          {/*<DatasetSortMenu
            data={fuzzyDatasets}
            handleSortedData={(data: IDataset[]) => {
              setFuzzyDatasets(data);
            }}
          />*/}
        </Box>
        <Stack spacing={2} mb={2}>
          {fuzzyDatasets?.map((dataset) => (
            <Card elevation={0} key={dataset.item.submission_feature_id}>
              <CardHeader
                title={highlight(dataset.item.name, dataset?.matches?.find((match) => match.key === 'name')?.indices)}
                subheader={
                  <Typography variant="body2" color="textSecondary">
                    {dataset.item.submission_date.toDateString()}
                  </Typography>
                }
                action={
                  <Button
                    variant={dataset.item.secure ? 'outlined' : 'contained'}
                    sx={{ ml: 'auto', minWidth: 150 }}
                    disableElevation
                    onClick={() => {
                      dataset.item.secure ? handleRequestAccess() : handleDownload(dataset);
                    }}>
                    {dataset.item.secure ? 'Request Access' : 'Download'}
                  </Button>
                }
              />
              <CardContent sx={{ pt: 0, display: 'flex', alignItems: 'center' }}>
                <Typography variant="body1" color="textSecondary">
                  {highlight(
                    dataset.item.description,
                    dataset?.matches?.find((match) => match.key === 'description')?.indices
                  )}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default DatasetListPage;
