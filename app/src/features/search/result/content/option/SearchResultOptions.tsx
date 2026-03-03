import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { APIError } from 'hooks/api/useAxios';
import { useCartContext, useDialogContext } from 'hooks/useContext';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchResultCardLayout } from '../../layout/list/SearchResultCardLayout';
import { SearchResultTableLayout } from '../../layout/table/SearchResultTableLayout';
import { SEARCH_RESULT_OPTION_VIEW } from '../../SearchResultPage';
import { hasSecureResults } from 'utils/search-result-options';

interface SearchResultOptionsProps {
  rows: SearchFeatureResultWithRelevancy[];
  isLoading: boolean;
  view: SEARCH_RESULT_OPTION_VIEW;
  onDownload?: (result: SearchFeatureResultWithRelevancy) => void;
}

export const SearchResultOptions = ({ rows, isLoading, view, onDownload }: SearchResultOptionsProps) => {
  const { features, addToCart, removeFromCart } = useCartContext();
  const dialogContext = useDialogContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const hasResults = rows.length > 0;
  const hasSecuredResults = hasSecureResults(rows);

  const cartFeatureIds = useMemo(() => {
    return new Set(features.map((f) => f.submission_feature_id));
  }, [features]);

  const handleAddToCart = useCallback(
    async (result: SearchFeatureResultWithRelevancy) => {
      try {
        await addToCart([result]);
      } catch (error) {
        dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
      }
    },
    [addToCart, dialogContext]
  );

  const handleRemoveFromCart = useCallback(
    async (featureId: number) => {
      try {
        await removeFromCart([featureId]);
      } catch (error) {
        dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
      }
    },
    [removeFromCart, dialogContext]
  );

  const handleRequestAccess = useCallback(() => {
    navigate(`/search/request-access?${searchParams.toString()}`);
  }, [navigate, searchParams]);

  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={<SkeletonList />}
      hasNoData={!hasResults}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography variant="h4" color="textSecondary">
            No results found
          </Typography>
        </Box>
      }>
      <>
        {hasSecuredResults && (
          <Alert
            severity="info"
            icon={<Icon path={mdiLock} size={0.875} />}
            action={
              <Button color="inherit" size="small" onClick={handleRequestAccess}>
                Request Access
              </Button>
            }
            sx={{ mx: 2, mt: 2 }}>
            Some records in these results are secured. You can request access to view and download them.
          </Alert>
        )}
        <ComponentSwitch<SEARCH_RESULT_OPTION_VIEW>
          switch={view}
          components={{
            table: (
              <SearchResultTableLayout
                results={rows}
                cartFeatureIds={cartFeatureIds}
                onDownload={onDownload}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                onRowSelectionModelChange={() => { }}
              />
            ),
            list: (
              <SearchResultCardLayout
                results={rows}
                cartFeatureIds={cartFeatureIds}
                onDownload={onDownload}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
              />
            )
          }}
        />
      </>
    </LoadingGuard>
  );
};
