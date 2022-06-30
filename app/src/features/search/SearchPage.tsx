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
// import AdvancedSearch, { advancedSearchFiltersInitialValues, IAdvancedSearchFilters } from 'components/search-filter/AdvancedSearch';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import qs from 'qs'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router'
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';

import { DialogContext } from 'contexts/dialogContext';
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import SearchComponent from './SearchComponent';

const advancedSearchInitialValues: IAdvancedSearch = {
  keywords: ''
}

const SearchPage = () => {
  // const classes = useStyles();
  const biohubApi = useApi();
  const history = useHistory();
  const location = useLocation();
  const dialogContext = useContext(DialogContext);
  const searchDataLoader = useDataLoader(() => biohubApi.search.searchSpecies(searchQuery));

  const [searchQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true);
  
  //collection of params from url location.search
  const collectFilterParams = useCallback((): IAdvancedSearch => {
    if (location.search) {
      const urlParams = qs.parse(location.search.replace('?', ''));

      return { keywords: urlParams.keywords } as IAdvancedSearch
    }
    return advancedSearchInitialValues;
  }, [location.search]);

  const [formikValues, setFormikValues] = useState<IAdvancedSearch>(collectFilterParams);
  const formikRef = useRef<FormikProps<IAdvancedSearch>>(null);

  //Search Params
  useEffect(() => {
    const getParams = async () => {
      const params = await collectFilterParams();
      setFormikValues(params);
    };

    if (isLoading) {
      setIsLoading(false);
      getParams();
    }
  }, [isLoading, location.search, formikValues, collectFilterParams]);

  /**
   * Determines if the search parameters are empty
   */
  const isDefaultState = (): boolean => {
    return JSON.stringify(!formikRef?.current || formikRef.current.values) === JSON.stringify(advancedSearchInitialValues)
  }

  /**
   * Updates URL search params to reflect formikRef values
   */
  const updateSearchParams = () => {
    const urlParams = qs.stringify(formikRef.current?.values);
    history.push({
      search: `?${urlParams}`
    });
  };

  const handleResetSearchParams = () => {
    history.push({
      search: ``
    });
  };

  const handleReset = async () => {
    // const projectsResponse = null // await restorationTrackerApi.project.getProjectsList();
    // setProjects(projectsResponse);
    setFormikValues(advancedSearchInitialValues);
    handleResetSearchParams();
  };

  const handleSubmit = async () => {
    if (!formikRef?.current) {
      return;
    }

    //empty Filters
    if (isDefaultState()) {
      return;
    }

    try {
      /*
      const response = null // await restorationTrackerApi.project.getProjectsList(formikRef.current.values);

      if (!response) {
        return;
      }
      */

      updateSearchParams();
    } catch (error) {
      const apiError = error as APIError;
      showFilterErrorDialog({
        dialogTitle: 'Error Filtering Projects',
        dialogError: apiError?.message,
        dialogErrorDetails: apiError?.errors
      });
    }
  };

  const showFilterErrorDialog = (textDialogProps?: Partial<IErrorDialogProps>) => {
    dialogContext.setErrorDialog({
      onClose: () => {
        dialogContext.setErrorDialog({ open: false });
      },
      onOk: () => {
        dialogContext.setErrorDialog({ open: false });
      },
      ...textDialogProps,
      open: true
    });
  };

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
          <Formik<IAdvancedSearch>
            innerRef={formikRef}
            initialValues={formikValues}
            onSubmit={handleSubmit}
            onReset={handleReset}
            enableReinitialize={true}>
              <SearchComponent />
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
