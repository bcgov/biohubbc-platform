import { Box, ClickAwayListener, Stack } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonHorizontalStack } from 'components/loading/SkeletonLoaders';
import { SearchInput } from 'components/search/SearchInput';
import { URL_PARAMS } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ISearchAllFilters, SearchResponse, SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { buildSearchQuery } from 'utils/search';
import { SearchListbox } from './listbox/SearchListbox';
import { SearchTabs } from './tab/SearchTabs';
import { ISearchContainerLink } from './tab/SearchTabs.interface';

const SEARCH_PREVIEW_PAGINATION: ApiPaginationRequestOptions = { limit: 3, page: 1 };
const SEARCH_DEBOUNCE_MS = 400;

interface ISearchContainerProps {
  links: ISearchContainerLink[];
  isLoading?: boolean;
}

export const SearchContainer = ({ links, isLoading = false }: ISearchContainerProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();

  const [searchValue, setSearchValue] = useState('');
  const [records, setRecords] = useState<SearchResponse | null>(null);
  const [summary, setSummary] = useState<SearchSummaryResponse | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const recordsLoader = useDataLoader((params: ISearchAllFilters, pagination?: ApiPaginationRequestOptions) =>
    api.search.searchAll(params, pagination)
  );
  const summaryLoader = useDataLoader((params: ISearchAllFilters) => api.search.searchSummary(params));

  // Load initial summary (empty query = match everything)
  useEffect(() => {
    const loadInitialSummary = async () => {
      const summaryData = await summaryLoader.load({ keyword: '' });
      if (summaryData) {
        setSummary(summaryData);
      }
    };
    loadInitialSummary();
  }, [summaryLoader, dialogContext]);

  // Preview search (used only for dropdown)
  const runPreviewSearch = useCallback(
    async (value: string) => {
      const params: ISearchAllFilters = { keyword: value };

      const [recordsData, summaryData] = await Promise.all([
        recordsLoader.refresh(params, SEARCH_PREVIEW_PAGINATION),
        summaryLoader.refresh(params)
      ]);

      if (recordsData) {
        setRecords(recordsData);
      }
      if (summaryData) {
        setSummary(summaryData);
      }
    },
    [recordsLoader, summaryLoader]
  );

  // Debounced preview search
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        runPreviewSearch(value);
      }, SEARCH_DEBOUNCE_MS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Input change → debounced preview search
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Enter key → navigate to list page
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchValue.trim()) {
        e.preventDefault();
        debouncedSearch.cancel();

        navigate(
          buildSearchQuery('list', {
            [URL_PARAMS.SEARCH_QUERY]: searchValue
          })
        );

        setIsDropdownOpen(false);
      }
    },
    [debouncedSearch, navigate, searchValue]
  );

  const handleFocus = useCallback(() => setIsDropdownOpen(true), []);
  const handleClickAway = useCallback(() => setIsDropdownOpen(false), []);

  const shouldShowDropdown = isDropdownOpen && (records || summary);
  const showLoading = !records && !summary && recordsLoader.isLoading && summaryLoader.isLoading;

  return (
    <Stack gap={2}>
      <ClickAwayListener onClickAway={handleClickAway}>
        <Box width="100%" position="relative">
          <SearchInput
            placeholder="Enter names, keywords, or relevant terms"
            handleChange={handleChange}
            value={searchValue}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
          />

          {shouldShowDropdown && (
            <Box position="absolute" top="100%" left={0} right={0} mt={1} zIndex={9999}>
              <SearchListbox searchTerm={searchValue} records={records} summary={summary} isLoading={showLoading} />
            </Box>
          )}
        </Box>
      </ClickAwayListener>

      <LoadingGuard isLoading={isLoading} isLoadingFallback={<SkeletonHorizontalStack height={30} width={60} />}>
        <SearchTabs links={links} />
      </LoadingGuard>
    </Stack>
  );
};
