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
import AdvancedSearch, { advancedSearchFiltersInitialValues, IAdvancedSearchFilters } from 'components/search-filter/AdvancedSearch';
import { Formik, FormikProps } from 'formik';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import qs from 'qs'
import React, { useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router'

const SearchPage = () => {
  const biohubApi = useApi();
  const location = useLocation();
  const searchDataLoader = useDataLoader(() => biohubApi.search.searchSpecies(searchQuery));

  const [searchQuery] = useState<string>('')

  const formikRef = useRef<FormikProps<IAdvancedSearchFilters>>(null);

  //collection of params from url location.search
  const collectFilterParams = useCallback((): IAdvancedSearchFilters => {
    if (location.search) {
      const urlParams = qs.parse(location.search.replace('?', ''));
      const values = {
        keyword: urlParams.keyword,
        project_name: urlParams.project_name,
        species: urlParams.species,
      } as IAdvancedSearchFilters;


      if (values.species === undefined) {
        values.species = [];
      }

      return values;
    }
    return advancedSearchFiltersInitialValues;
  }, [location.search]);

  const [formikValues, /*setFormikValues*/] = useState<IAdvancedSearchFilters>(collectFilterParams);
  const [filterChipValues, /*setFilterChipValues*/] = useState<IAdvancedSearchFilters>(collectFilterParams);





  const results: any[] =
    searchDataLoader?.data?.map((item) => ({
      id: item.id,
      datasetTitle: item.fields.datasetTitle[0]
    })) || [];

  console.log('results:', results);

  

  return (
    <Box my={4}>
      <Container maxWidth="xl">
        <Box mb={5}>
          <Box mb={1}>
            <Typography variant="h1">Search</Typography>
          </Box>
          <Typography variant="body1" color="textSecondary">
            BioHubBC Platform search.
          </Typography>
        </Box>
        
        <Box mb={5}>
          <Formik<IAdvancedSearchFilters>
            innerRef={formikRef}
            initialValues={formikValues}
            onSubmit={() => new Promise<void>((resolve, reject) => resolve())}
            onReset={() => null}
            enableReinitialize={true}>
              <AdvancedSearch
              
                filterChipParams={filterChipValues}
              />
          </Formik>
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
