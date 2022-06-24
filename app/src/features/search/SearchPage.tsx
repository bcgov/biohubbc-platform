import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import React from 'react';

const SearchPage = () => {
  const biohubApi = useApi();
  const [searchQuery, setSearchQuery] = React.useState<string>('')

  const searchDataLoader = useDataLoader(() => biohubApi.search.searchSpecies(searchQuery));

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.target
    setSearchQuery(value)
    searchDataLoader.refresh();
  }

  const results: any[] =
    searchDataLoader?.data?.map((item) => ({
      id: item.id,
      datasetTitle: item.fields.datasetTitle[0]
    })) || [];

  console.log('results:', results);

  return (
    <Box my={4}>
      <Container maxWidth="xl">
        <Box mb={5} display="flex" justifyContent="space-between">
          <Typography variant="h1">Search</Typography>
        </Box>
        <Box mb={2}>
          <TextField
            label='Search Species'
            name='search-species'
            variant='filled'
            value={searchQuery}
            onChange={handleSearchChange}
            fullWidth
            // margin='normal'
          />
        </Box>
        <Box>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Search Name</TableCell>
                  </TableRow>
                </TableHead>
                {results.length > 0 ? (
                  <TableBody data-testid="search-table">
                    {results.map((result, index) => (
                      <TableRow key={`${result.id}-${index}`}>
                        <TableCell>
                          <pre>...{result.id.substring(result.id.length - 6)}</pre>
                        </TableCell>
                        <TableCell>{result.datasetTitle}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                ) : (
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body1">No Data</Typography>
                      </TableCell>
                    </TableRow>
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

export default SearchPage;
