import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
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

const advancedSearchInitialValues: IAdvancedSearch = {
  keywords: ''
};

const SearchPage = () => {
  const biohubApi = useApi();
  const history = useHistory();
  const location = useLocation();
  const dialogContext = useContext(DialogContext);

  const searchDataLoader = useDataLoader((query: string) => {
    return biohubApi.search.keywordSearch(query);
  });
  const { isLoading } = searchDataLoader;

  /**
   * collection of params from url location.search
   */
  const collectFilterParams = useCallback((): IAdvancedSearch => {
    if (location.search) {
      const urlParams = qs.parse(location.search, { ignoreQueryPrefix: true });

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

  const results = (searchDataLoader.data || []).reduce((acc: any, item) => {
    return [...acc, ...item.source.project];
  }, []);

  searchDataLoader.load(formikRef.current?.values.keywords || formikValues.keywords);

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
        <Box>
          <Formik<IAdvancedSearch>
            innerRef={formikRef}
            initialValues={formikValues}
            onSubmit={handleSubmit}
            onReset={handleReset}
            enableReinitialize={true}>
            <SearchComponent />
          </Formik>
        </Box>
        <Box my={4}>
          {formikRef.current?.values.keywords && (
            <Typography variant="h2">
              {isLoading ? (
                <>Loading...</>
              ) : (
                <>
                  {`${results.length} result${results.length !== 1 && 's'}`}
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
            <Box mb={3} p={2} key={`${result.projectId}-${index}`} borderRadius={4} border={1}>
              <Typography variant="h4">{result.projectTitle}</Typography>
              <Typography variant="body1" color="textSecondary">
                {truncate(result.projectObjectives, { length: 200, separator: ' ' })}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default SearchPage;
