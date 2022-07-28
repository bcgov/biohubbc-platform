import { Theme } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import Container from '@material-ui/core/Container';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/styles';
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { DialogContext } from 'contexts/dialogContext';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';
import { truncate } from 'lodash';
import qs from 'qs';
import React, { useCallback, useContext, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router';
import SearchComponent from './SearchComponent';

const useStyles = makeStyles((theme: Theme) => ({
  datasetAbstract: {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    maxWidth: '92ch'
  }
}));

const advancedSearchInitialValues: IAdvancedSearch = {
  keywords: ''
};

const SearchPage = () => {
  const classes = useStyles();
  const biohubApi = useApi();
  const history = useHistory();
  const location = useLocation();
  const dialogContext = useContext(DialogContext);

  const searchDataLoader = useDataLoader((query: string) => {
    return biohubApi.search.keywordSearch(query);
  });

  /**
   * collection of params from url location.search
   */
  const collectFilterParams = useCallback((): IAdvancedSearch => {
    if (location.search) {
      const urlParams = qs.parse(location.search.replace('?', ''));

      return { keywords: urlParams.keywords } as IAdvancedSearch;
    }
    return advancedSearchInitialValues;
  }, [location.search]);

  const [formikValues, setFormikValues] = useState<IAdvancedSearch>(collectFilterParams);
  const formikRef = useRef<FormikProps<IAdvancedSearch>>(null);

  /**
   * Determines if the search parameters are empty
   */
  const isDefaultState = (): boolean => {
    return (
      JSON.stringify(!formikRef?.current || formikRef.current.values) === JSON.stringify(advancedSearchInitialValues)
    );
  };

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
    setFormikValues(advancedSearchInitialValues);
    handleResetSearchParams();
  };

  const handleSubmit = async () => {
    if (!formikRef?.current) {
      return;
    }

    // empty Filters
    if (isDefaultState()) {
      return;
    }

    try {
      searchDataLoader.refresh(formikRef.current?.values.keywords);

      updateSearchParams();
    } catch (error) {
      const apiError = error as APIError;
      showFilterErrorDialog({
        dialogTitle: 'Error Searching Datasets',
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

  function appendProjectsWithDatasetId(searchLoader: { data: any }) {
    let newList: any[] = [];

    searchLoader.data &&
      searchLoader.data.forEach((dataset: any) => {
        const datasetId = dataset.id;

        const projectList = dataset.source.project;

        projectList &&
          projectList.forEach((item: any) => {
            const appendedItem = { ...item, datasetId: datasetId };

            newList.push(appendedItem);
          });
      });

    return newList;
  }

  const results = appendProjectsWithDatasetId(searchDataLoader);

  searchDataLoader.load(formikRef.current?.values.keywords || formikValues.keywords);

  return (
    <Box py={5}>
      <Container maxWidth="xl">
        <Box mb={5}>
          <Typography variant="h1">Find BioHub Datasets</Typography>
        </Box>
        <Formik<IAdvancedSearch>
          innerRef={formikRef}
          initialValues={formikValues}
          onSubmit={handleSubmit}
          onReset={handleReset}
          enableReinitialize={true}>
          <SearchComponent />
        </Formik>
        <Box mt={6} mb={3}>
          {formikRef.current?.values.keywords && (
            <Typography variant="h3">
              {searchDataLoader.isLoading ? (
                <>Loading...</>
              ) : (
                <>
                  Found {`${results.length} result${results.length !== 1 && 's'}`}
                  <Typography
                    variant="inherit"
                    component="span"
                    color="textSecondary">{` for '${formikRef.current?.values.keywords}'`}</Typography>
                </>
              )}
            </Typography>
          )}
        </Box>
        <Box>
          {results.map((result: any, index: number) => (
            <Box mb={2} key={`${result.projectId}-${index}`}>
              <Card>
                <Box p={3}>
                  <Box mb={2}>
                    <Link
                      color="primary"
                      aria-current="page"
                      variant="h4"
                      href={`datasets/${result.datasetId}/details`}
                    // onClick={() => history.push(`datasets/${result.datasetId}/details`)}
                    >
                      {result.projectTitle}
                    </Link>
                  </Box>
                  <Typography className={classes.datasetAbstract} variant="body1" color="textSecondary">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                    {truncate(result.projectObjectives, { length: 200, separator: ' ' })}
                  </Typography>
                </Box>
              </Card>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default SearchPage;
