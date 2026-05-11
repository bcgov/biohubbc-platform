import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { AlertTitle, Box, Container, Divider, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import { PageHeader } from 'components/header/PageHeader';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { PageSection } from 'components/section/PageSection';
import { TabGroup } from 'components/tabs/TabGroup';
import { ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { DOWNLOAD_SIDEBAR_VIEW } from 'constants/download';
import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useCartContext, useCodesContext, useDialogContext } from 'hooks/useContext';
import useIsMounted from 'hooks/useIsMounted';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { PageTitle } from 'utils/RouteWithMeta';
import { getSearchFeatureTypeRouteConfig } from 'utils/routes';
import { buildSearchFeatureTypeLinks } from '../utils/search-feature-type-links';
import { SearchResultOptions } from './content/option/SearchResultOptions';
import { SearchResultToolbar } from './content/toolbar/SearchResultToolbar';
import { SearchResultSearch } from './header/SearchResultSearch';
import { useSearchResults } from './hooks/useSearchResults';
import { ResultPageContainer } from './layout/ResultPageContainer';
import { CreateDownloadDialog } from './sidebar/download/CreateDownloadDialog';
import { ICreateDownloadFormValues } from './sidebar/download/CreateDownloadForm';
import { DownloadSidebar } from './sidebar/download/DownloadSidebar';

/**
 * Feature search results page for expression-based searching.
 *
 * Use this route component for `/search/:featureType` result pages. It parses
 * the feature type from the URL, keeps the applied expression tree in local
 * state, and coordinates result pagination, sorting, view mode, cart actions,
 * and download sidebar state.
 *
 * @returns {JSX.Element} Feature search result page.
 */
export const SearchResultPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { featureType } = useParams<{ featureType: string }>();
  const api = useApi();

  const { codesDataLoader } = useCodesContext();
  const { features, pagination: cartPagination, addToCart, checkout } = useCartContext();
  const dialogContext = useDialogContext();

  const [expressionTree, setExpressionTree] = useState<ExpressionTreeExpression | null>(null);
  const [expressionApplyRevision, setExpressionApplyRevision] = useState(0);
  const [view, setView] = useState<SEARCH_RESULT_VIEW>(SEARCH_RESULT_VIEW.TABLE);
  const [downloadView, setDownloadView] = useState<DOWNLOAD_SIDEBAR_VIEW>(DOWNLOAD_SIDEBAR_VIEW.CART);
  const [isCreateDownloadDialogOpen, setIsCreateDownloadDialogOpen] = useState(false);
  const [isSubmittingDownload, setIsSubmittingDownload] = useState(false);
  const { runSerialized } = useSerializedAsync();
  // Suppress post-await state updates if the user navigates away mid-submit; otherwise the global
  // dialog/snackbar context fires on the next page.
  const isMounted = useIsMounted();

  const routeConfig = getSearchFeatureTypeRouteConfig(featureType, codesDataLoader.data?.feature_type_with_properties);
  const { rows, isLoading, searchParams, setSearchParams, pagination } = useSearchResults(
    routeConfig?.featureTypeName ?? '',
    !!routeConfig,
    expressionTree,
    expressionApplyRevision
  );

  const searchQuery = searchParams.get(URL_PARAMS.SEARCH_QUERY) || undefined;
  const hasSecuredResults = rows.some((row) => row.is_secured);
  const featureTypeLinks = useMemo(
    () => buildSearchFeatureTypeLinks(codesDataLoader.data?.feature_type_with_properties),
    [codesDataLoader.data?.feature_type_with_properties]
  );
  const featureTypes = useMemo(() => {
    const types = codesDataLoader.data?.feature_type_with_properties ?? [];

    return {
      options: types.map((type) => ({
        label: type.feature_type.name,
        value: type.feature_type.name
      }))
    };
  }, [codesDataLoader.data]);

  // React Router reuses this component across `/search/:featureType` segments. Keep the applied
  // expression when switching tabs so the next feature search uses the same expression payload,
  // but close any in-progress download dialog because its defaults are tied to the previous route.
  useEffect(() => {
    setIsCreateDownloadDialogOpen(false);
  }, [featureType]);

  const handleExpressionApply = useCallback(
    (nextExpressionTree: ExpressionTreeExpression | null) => {
      setExpressionTree(nextExpressionTree);
      setExpressionApplyRevision((current) => current + 1);

      const nextParams: Partial<Record<UrlParamKey, string>> = {
        [URL_PARAMS.PAGE]: '1'
      };

      if (nextExpressionTree === null) {
        nextParams[URL_PARAMS.SORT] = '';
        nextParams[URL_PARAMS.ORDER] = '';
      }

      setSearchParams(nextParams);
    },
    [setSearchParams]
  );

  const activeSort = pagination?.sort ?? 'relevancy_score';
  const sortOrder = pagination?.order ?? 'desc';

  const sortOptions = useMemo(
    () => [
      { label: 'Relevance', value: 'relevancy_score', direction: activeSort === 'relevancy_score' ? sortOrder : 'desc' },
      { label: 'Date', value: 'create_date', direction: activeSort === 'create_date' ? sortOrder : 'desc' }
    ],
    [activeSort, sortOrder]
  );

  const handleSortChange = useCallback(
    (sort: string, direction: 'asc' | 'desc') => {
      setSearchParams({ [URL_PARAMS.SORT]: sort, [URL_PARAMS.ORDER]: direction }, true);
    },
    [setSearchParams]
  );

  const handleAddAllToCart = useCallback(async () => {
    try {
      await addToCart(rows);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [rows, addToCart, dialogContext]);

  /**
   * Resolve the toolbar `Create Download` click. Authenticated users with at least one matching
   * feature open the create-download dialog. Zero-result searches see an OkDialog instead — sparing
   * them from filling in metadata for an empty download.
   *
   * Pagination undefined or a refresh in flight means results are still loading. The button is
   * also disabled in that window, but guard the handler too — without it, a click would either
   * coerce undefined → 0 and surface the "nothing to download" dialog before results arrived, or
   * open the dialog against a stale `pagination.total` from the previous query.
   */
  const handleOpenCreateDownload = useCallback(() => {
    if (isLoading || pagination === undefined) {
      return;
    }

    if (pagination.total === 0) {
      dialogContext.setOkDialog({
        open: true,
        dialogTitle: 'Create Download',
        dialogText: 'There are no features matching your current search to download.',
        onClose: () => dialogContext.setOkDialog({ open: false })
      });
      return;
    }

    setIsCreateDownloadDialogOpen(true);
  }, [isLoading, pagination, dialogContext]);

  /**
   * Submit handler for the create-download dialog. Posts the form values plus the page-level
   * expression tree as a single `CreateDownloadRequest`, then switches the right sidebar to the
   * Downloads view so the user can watch the new job progress.
   *
   * `expression` is forwarded as the literal page state. The expression-builder popover already
   * strips builder-only `ui_id` fields at apply time, so the page state is wire-clean by
   * construction; a second sanitizer here would duplicate the contract guarantee. The key must
   * be present (the backend uses `.nullable()`, not `.optional()`); when no expression is
   * applied, the page state is `null` and is sent as `null`.
   */
  const handleCreateDownload = useCallback(
    (values: ICreateDownloadFormValues) =>
      runSerialized(async () => {
        setIsSubmittingDownload(true);
        try {
          await api.download.createDownload({
            name: values.name,
            description: values.description,
            featureTypes: values.featureTypes,
            expression: expressionTree
          });
          if (!isMounted()) {
            return;
          }
          setIsCreateDownloadDialogOpen(false);
          setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'Download created. Track its progress in the Downloads sidebar.'
          });
        } catch (error) {
          if (!isMounted()) {
            return;
          }
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: (error as APIError).message
          });
        } finally {
          if (isMounted()) {
            setIsSubmittingDownload(false);
          }
        }
      }),
    [api.download, dialogContext, expressionTree, runSerialized, isMounted]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setSearchParams({ [URL_PARAMS.PAGE]: String(page) });
    },
    [setSearchParams]
  );

  const handlePageSizeChange = useCallback(
    (limit: number) => {
      setSearchParams({ [URL_PARAMS.LIMIT]: String(limit), [URL_PARAMS.PAGE]: '1' });
    },
    [setSearchParams]
  );

  const handleCheckout = useCallback(async () => {
    try {
      await checkout();
      setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [checkout, dialogContext]);

  const handleResultClick = useCallback(
    (result: SearchFeatureResultWithRelevancy) => {
      navigate(`/submission/${result.submission_id}/feature/${result.submission_feature_id}${location.search}`);
    },
    [location.search, navigate]
  );

  const handleFeatureTypeTabChange = useCallback(
    (nextFeatureTypeName: string) => {
      const nextLink = featureTypeLinks.find((link) => link.value === nextFeatureTypeName);

      if (nextLink) {
        const nextSearchParams = new URLSearchParams(location.search);
        nextSearchParams.delete(URL_PARAMS.FEATURE_TYPE);
        nextSearchParams.delete(URL_PARAMS.PAGE);
        const nextSearch = nextSearchParams.toString();
        navigate(nextSearch ? `${nextLink.to}?${nextSearch}` : nextLink.to);
      }
    },
    [featureTypeLinks, location.search, navigate]
  );

  if (!codesDataLoader.isReady) {
    return null;
  }

  if (!routeConfig) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <ResultPageContainer
      rightSidebarTitle={downloadView === DOWNLOAD_SIDEBAR_VIEW.CART ? 'Cart' : 'Downloads'}
      rightSidebar={
        <DownloadSidebar
          cart={{ features, itemCount: cartPagination?.total ?? 0 }}
          activeView={downloadView}
          onViewChange={setDownloadView}
          onDownload={handleCheckout}
        />
      }>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <PageHeader
          maxWidth="md"
          subheader={
            <SearchResultSearch
              searchTerm={searchQuery ?? ''}
              expressionTree={expressionTree}
              onExpressionApply={handleExpressionApply}
            />
          }
          tabs={
            featureTypeLinks.length > 0 ? (
              <TabGroup
                value={routeConfig.featureTypeName}
                onChange={handleFeatureTypeTabChange}
                ariaLabel="Search feature types"
                tabs={featureTypeLinks}
              />
            ) : undefined
          }
        />

        {hasSecuredResults && (
          <Container maxWidth="md" sx={{ pt: 2 }}>
            <AlertBanner
              variant="standard"
              icon={<Icon path={mdiLock} size={0.75} style={{ marginTop: '1px' }} />}
              action={
                <Button color="inherit" size="small" onClick={() => navigate('/portal/ticket')}>
                  Request Access
                </Button>
              }>
              <AlertTitle sx={{ mb: 0 }}>Sensitive results are hidden</AlertTitle>
              <Typography fontSize="0.8rem">
                Some data are secured under the Species and Ecosystems Data & Information Security Policy.
              </Typography>
            </AlertBanner>
          </Container>
        )}

        <Container maxWidth="md" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, py: 2 }}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              '& > .MuiPaper-root': {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0
              }
            }}>
            <PageSection
              id="search-results"
              label="Results"
              headerContent={
                <ToggleButtons
                  views={SEARCH_RESULT_VIEW_OPTIONS}
                  activeView={view}
                  onViewChange={setView}
                  orientation="horizontal"
                />
              }>
              <Box sx={{ px: 2, py: 1 }}>
                <SearchResultToolbar
                  sortOptions={sortOptions}
                  activeSort={activeSort}
                  onSortChange={handleSortChange}
                  onAddAllToCart={handleAddAllToCart}
                  onCreateDownloadClick={handleOpenCreateDownload}
                  isCreateDownloadDisabled={isSubmittingDownload || isLoading || pagination === undefined}
                />
              </Box>

              <Divider />

              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <SearchResultOptions rows={rows} isLoading={isLoading} view={view} onClick={handleResultClick} />
              </Box>

              <Divider />

              <Box sx={{ px: 2, py: 1 }}>
                <CustomPagination
                  currentPage={pagination?.current_page ?? 1}
                  pageSize={pagination?.per_page ?? 10}
                  totalCount={pagination?.total ?? 0}
                  lastPage={pagination?.last_page ?? 1}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </Box>
            </PageSection>
          </Box>
        </Container>
        <PageTitle title={`Search Results - ${routeConfig.title}`} description={`List of ${routeConfig.title}`} />
      </Box>
      <CreateDownloadDialog
        open={isCreateDownloadDialogOpen}
        isSubmitting={isSubmittingDownload}
        defaultName={`${routeConfig.title} download`}
        defaultFeatureType={routeConfig.featureTypeName}
        featureTypeOptions={featureTypes.options}
        onCancel={() => setIsCreateDownloadDialogOpen(false)}
        onSave={handleCreateDownload}
      />
    </ResultPageContainer>
  );
};
