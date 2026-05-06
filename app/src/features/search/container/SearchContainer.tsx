import { Box, ClickAwayListener, Stack } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonHorizontalStack } from 'components/loading/SkeletonLoaders';
import { SearchInput } from 'components/search/SearchInput';
import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import { URL_PARAMS } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ISearchAllFilters, SearchResponse, SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { buildSearchFeatureTypePath } from 'utils/routes';
import { SearchListbox } from './listbox/SearchListbox';
import { SearchTabs } from './tab/SearchTabs';
import { ISearchContainerLink } from './tab/SearchTabs.interface';

const SEARCH_PREVIEW_PAGINATION: ApiPaginationRequestOptions = { limit: 3, page: 1 };
const SEARCH_DEBOUNCE_MS = 400;

interface ISearchContainerProps {
  links: ISearchContainerLink[];
  isLoading?: boolean;
}

/**
 * Search landing-page controller with debounced preview results.
 *
 * Use this component on the root search page. It owns the search input text,
 * preview-result dropdown, initial summary load, and keyboard navigation into
 * the listbox. Selecting a preview row or pressing Enter navigates to the
 * feature-type result route; the result page then takes over expression-based
 * searching.
 *
 * @param {ISearchContainerProps} props - Feature-type quick links and loading state.
 * @returns {JSX.Element} Search landing UI with tabs and preview listbox.
 */
export const SearchContainer = ({ links, isLoading = false }: ISearchContainerProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();

  const [searchValue, setSearchValue] = useState('');
  const [records, setRecords] = useState<SearchResponse | null>(null);
  const [summary, setSummary] = useState<SearchSummaryResponse | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

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

  const debouncedSearch = useMemo(
    () => debounce((value: string) => runPreviewSearch(value), SEARCH_DEBOUNCE_MS),
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

  // Key down → Enter or ArrowDown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchValue.trim()) {
        e.preventDefault();
        debouncedSearch.cancel();
        navigate(
          buildSearchFeatureTypePath(PRIORITY_FEATURE_TYPE.SPECIES_OBSERVATION, {
            [URL_PARAMS.SEARCH_QUERY]: searchValue
          })
        );
        setIsDropdownOpen(false);
      }

      // ArrowDown focuses first item in listbox
      if (e.key === 'ArrowDown' && (records || summary)) {
        e.preventDefault();
        const firstItem = document.querySelector<HTMLButtonElement>('[data-search-item]:first-of-type');
        firstItem?.focus();
      }
    },
    [debouncedSearch, navigate, searchValue, records, summary]
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
            onChange={handleChange}
            value={searchValue}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
          />

          {shouldShowDropdown && (
            <Box position="absolute" top="100%" left={0} right={0} mt={1} zIndex={9999}>
              <SearchListbox
                searchTerm={searchValue}
                records={records}
                summary={summary}
                defaultFeatureTypeName={PRIORITY_FEATURE_TYPE.SPECIES_OBSERVATION}
                isLoading={showLoading}
              />
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
