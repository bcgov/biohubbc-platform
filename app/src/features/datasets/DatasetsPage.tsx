import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import React from 'react';

const DatasetsPage = () => {
  const biohubApi = useApi();

  const datasetsDataLoader = useDataLoader(() => biohubApi.dataset.listAllDatasets());

  datasetsDataLoader.load();

  const datasets =
    datasetsDataLoader?.data?.map((item) => ({
      id: item.id,
      datasetTitle: item.fields.datasetTitle[0]
    })) || [];

  return (
    <Box my={4}>
      <Container maxWidth="xl">
        <Box mb={5} display="flex" justifyContent="space-between">
          <Typography variant="h1">Datasets</Typography>
        </Box>
        <Box>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Dataset Name</TableCell>
                  </TableRow>
                </TableHead>
                {datasets ? (
                  <TableBody data-testid="datasets-table">
                    {datasets.map((dataset, index) => (
                      <TableRow key={`${dataset.id}-${index}`}>
                        <TableCell>
                          <pre>...{dataset.id.substring(dataset.id.length - 6)}</pre>
                        </TableCell>
                        <TableCell>{dataset.datasetTitle}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                ) : (
                  <TableBody>
                    <TableCell>
                      <Typography variant="body1">No Data</Typography>
                    </TableCell>
                  </TableBody>
                )}
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default DatasetsPage;
