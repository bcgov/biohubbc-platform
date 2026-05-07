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
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useCartContext, useCodesContext, useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { PageTitle } from 'utils/RouteWithMeta';
import { getSearchFeatureTypeRouteConfig } from 'utils/routes';
import { buildSearchFeatureTypeLinks } from '../utils/search-feature-type-links';
import { DownloadUrlDisplay } from './components/DownloadUrlDisplay';
import { SearchResultOptions } from './content/option/SearchResultOptions';
import { SearchResultToolbar } from './content/toolbar/SearchResultToolbar';
import { SearchResultSearch } from './header/SearchResultSearch';
import { useSearchResults } from './hooks/useSearchResults';
import { ResultPageContainer } from './layout/ResultPageContainer';
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
  const { auth } = useAuthStateContext();

  const { codesDataLoader } = useCodesContext();
  const { features, pagination: cartPagination, addToCart, checkout } = useCartContext();
  const dialogContext = useDialogContext();

  const [expressionTree, setExpressionTree] = useState<ExpressionTreeExpression | null>(null);
  const [view, setView] = useState<SEARCH_RESULT_VIEW>(SEARCH_RESULT_VIEW.TABLE);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadView, setDownloadView] = useState<DOWNLOAD_SIDEBAR_VIEW>(DOWNLOAD_SIDEBAR_VIEW.CART);

  const routeConfig = getSearchFeatureTypeRouteConfig(featureType, codesDataLoader.data?.feature_type_with_properties);
  const { rows, isLoading, searchParams, setSearchParams, pagination, filters } = useSearchResults(
    routeConfig?.featureTypeName ?? '',
    !!routeConfig,
    expressionTree
  );

  const searchQuery = searchParams.get(URL_PARAMS.SEARCH_QUERY) || undefined;
  const hasSecuredResults = rows.some((row) => row.is_secured);
  const featureTypeLinks = useMemo(
    () => buildSearchFeatureTypeLinks(codesDataLoader.data?.feature_type_with_properties),
    [codesDataLoader.data?.feature_type_with_properties]
  );

  const handleExpressionApply = useCallback(
    (nextExpressionTree: ExpressionTreeExpression | null) => {
      setExpressionTree(nextExpressionTree);

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
      { label: 'Date', value: 'create_date', direction: activeSort === 'create_date' ? sortOrder : 'desc' },
      { label: 'Name', value: 'feature_type_name', direction: activeSort === 'feature_type_name' ? sortOrder : 'desc' },
      { label: 'Relevance', value: 'relevancy_score', direction: activeSort === 'relevancy_score' ? sortOrder : 'desc' }
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
   * Download all features matching the legacy filter params.
   *
   * Downloading expression results is intentionally outside this branch's scope,
   * so this preserves the pre-existing filter-based download behavior.
   */
  const handleDownloadAll = useCallback(async () => {
    try {
      setIsDownloading(true);
      const { download_url: downloadUrl } = await api.search.createDownload(filters);

      if (auth.isAuthenticated) {
        dialogContext.setSnackbar({
          snackbarMessage: 'Download started. You can track its progress in your downloads.',
          open: true
        });
      } else {
        dialogContext.setOkDialog({
          dialogTitle: 'Download Started',
          dialogText:
            'Your download is being prepared. Use this URL to check its status and get download links when ready.',
          dialogContent: <DownloadUrlDisplay url={downloadUrl} />,
          open: true,
          onClose: () => dialogContext.setOkDialog({ open: false })
        });
      }
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    } finally {
      setIsDownloading(false);
    }
  }, [filters, api.search, dialogContext, auth.isAuthenticated]);

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
                  onDownloadAll={handleDownloadAll}
                  isDownloading={isDownloading}
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
    </ResultPageContainer>
  );
};
