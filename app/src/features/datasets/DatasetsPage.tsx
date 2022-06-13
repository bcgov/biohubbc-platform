import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import { useApi } from 'hooks/useApi';
import React, { useEffect } from 'react';

const SubmissionsPage = () => {
  const [datasets, setDatasets] = React.useState<{id: string, datasetTitle: string}[]>([]);

  const biohubApi = useApi();

  useEffect(() => {
    const getSubmissions = async () => {
      const response = await biohubApi.search.listAllDatasets();

      if (!response) {
        return;
      }

      setDatasets(response.map((dataset) => ({
        id: dataset.id,
        datasetTitle: dataset.fields.datasetTitle[0]
      })));
    };

    getSubmissions();
  }, []);

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
                        <TableCell>
                          {dataset.datasetTitle}
                        </TableCell>
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

export default SubmissionsPage;
