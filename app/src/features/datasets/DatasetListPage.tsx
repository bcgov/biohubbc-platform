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
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDownloadJSON from 'hooks/useDownloadJSON';
import { IDataset, SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import React, { useMemo, useState } from 'react';
import DatasetFuzzySearch from './components/DatasetFuzzySearch';
import DatasetSortMenu from './components/DatasetSortMenu';
import SecureDataAccessRequestDialog from './security/SecureDataAccessRequestDialog';
/**
 * Renders Datasets as cards with download and request access actions
 *
 * @returns {*}
 */
const DatasetListPage = () => {
  const biohubApi = useApi();
  const download = useDownloadJSON();

  const datasetsLoader = useDataLoader(() => biohubApi.dataset.getAllReviewedDatasets());
  datasetsLoader.load();

  // this is what the page renders / mutates
  const [openRequestAccess, setOpenRequestAccess] = useState(false);
  const [fuzzyDatasets, setFuzzyDatasets] = useState<FuseResult<IDataset>[]>([]);

  // original datasets as FuseResult format
  const originalFuzzyDatasets: FuseResult<IDataset>[] = useMemo(() => {
    const defaultFuzzyDatasets =
      datasetsLoader.data?.map((item, refIndex) => ({
        item,
        refIndex,
        matches: []
      })) ?? [];

    setFuzzyDatasets(defaultFuzzyDatasets);

    return defaultFuzzyDatasets;
  }, [datasetsLoader.data]);

  const handleDownload = (dataset: FuseResult<IDataset>) => {
    // make request here for JSON data of dataset
    // pass to dowload
    const mockDownloadData = { a: 'b' };
    download(
      mockDownloadData,
      `${dataset.item.name.toLowerCase().replace(/ /g, '-')}-${dataset.item.submission_feature_id}`
    );
  };

  const handleRequestAccess = () => {
    setOpenRequestAccess(true);
  };

  // higlights the text using the indices from fuse
  // ie: <>hello <mark>world!</mark></>
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
    <>
      <SecureDataAccessRequestDialog
        open={openRequestAccess}
        onClose={() => setOpenRequestAccess(false)}
        artifacts={[]}
        initialArtifactSelection={[]}
      />
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
              originalDatasets={datasetsLoader.data ?? []}
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
            <DatasetSortMenu
              data={fuzzyDatasets}
              handleSortedFuzzyData={(data) => {
                setFuzzyDatasets(data);
              }}
            />
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
                    <>
                      {(dataset.item.security === SECURITY_APPLIED_STATUS.SECURED ||
                        dataset.item.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
                        <Button
                          variant={'outlined'}
                          sx={{ ml: 'auto', minWidth: 150 }}
                          disableElevation
                          onClick={() => {
                            handleRequestAccess();
                          }}>
                          Request Access
                        </Button>
                      )}
                      {(dataset.item.security === SECURITY_APPLIED_STATUS.UNSECURED ||
                        dataset.item.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
                        <Button
                          variant="contained"
                          sx={{ ml: 1, minWidth: 150 }}
                          disableElevation
                          onClick={() => {
                            handleDownload(dataset);
                          }}>
                          Download
                        </Button>
                      )}
                    </>
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
    </>
  );
};

export default DatasetListPage;
