import { mdiEyeOffOutline, mdiEyeOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { DialogContext } from 'contexts/dialogContext';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IAdvancedSearch } from 'interfaces/useSearchApi.interface';
import { truncate } from 'lodash';
import qs from 'qs';
import { useCallback, useContext, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router';
import SearchComponent from './SearchComponent';

const useStyles = makeStyles((theme: Theme) => ({
  searchResultTitle: {
    fontSize: '1.125rem'
  },
  datasetResultContainer: {
    display: 'flex',
    flexDirection: 'column'
  },
  datasetTitle: {
    fontSize: '1.25rem'
  },
  datasetAbstract: {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    maxWidth: '92ch'
  },
  bodyContainer: {
    paddingTop: theme.spacing(5),
    paddingBottom: theme.spacing(5)
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

  const parseResult = () => {
    const newList: any[] = [];

    searchDataLoader.data &&
      searchDataLoader.data.forEach((dataset) => {
        const datasetId = dataset.id;

        const project = dataset.source['eml:eml'].dataset.project;

        const parsedItem = { ...project, datasetId: datasetId, observationCount: dataset.observation_count };

        newList.push(parsedItem);
      });

    return newList;
  };

  const results = parseResult();

  searchDataLoader.load(formikRef.current?.values.keywords || formikValues.keywords);

  return (
    <Box>
      <Paper
        square
        elevation={0}
        sx={{
          py: 7
        }}>
        <Container maxWidth="xl">
          <Typography
            variant="h1"
            sx={{
              mt: -2,
              mb: 4
            }}>
            Find BioHub Datasets
          </Typography>
          <Formik<IAdvancedSearch>
            innerRef={formikRef}
            initialValues={formikValues}
            onSubmit={handleSubmit}
            onReset={handleReset}
            enableReinitialize={true}>
            <SearchComponent />
          </Formik>
        </Container>
      </Paper>
      <Container maxWidth="xl">
        <Box mt={6} mb={4}>
          {formikRef.current?.values.keywords && (
            <Typography variant="h2" className={classes.searchResultTitle}>
              {searchDataLoader.isLoading ? (
                <>Loading...</>
              ) : (
                <>
                  Found {`${results.length} result${results.length !== 1 ? 's' : ''}`}
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
              <Box p={3} component={Card} className={classes.datasetResultContainer}>
                <Box mb={2}>
                  <Box mb={2}>
                    <Link
                      className={classes.datasetTitle}
                      color="primary"
                      aria-current="page"
                      variant="h3"
                      href={`datasets/${result.datasetId}/details`}>
                      {result.title}
                    </Link>
                  </Box>
                  <Typography className={classes.datasetAbstract} variant="body1" color="textSecondary">
                    {truncate(result.abstract.section[0].para, { length: 200, separator: ' ' })}
                  </Typography>
                </Box>
                <Divider></Divider>
                <Box mt={2}>
                  <Typography component="span" variant="subtitle2" color="textSecondary">
                    <Box display="flex" alignItems="center">
                      {result.observationCount === 0 ? (
                        <Icon path={mdiEyeOffOutline} size={1} />
                      ) : (
                        <Icon path={mdiEyeOutline} size={1} />
                      )}
                      <Box ml={1} component="strong">
                        {result.observationCount} observations
                      </Box>
                    </Box>
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default SearchPage;
