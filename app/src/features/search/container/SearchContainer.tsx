import { mdiArrowRight } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Button, ClickAwayListener, Stack } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonHorizontalStack } from 'components/loading/SkeletonLoaders';
import { SearchInput } from 'components/search/SearchInput';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ISearchAllFilters, SearchResponse, SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
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

  const dialogContext = useDialogContext();
  const [searchValue, setSearchValue] = useState('');
  const [records, setRecords] = useState<SearchResponse | null>(null);
  const [summary, setSummary] = useState<SearchSummaryResponse | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const recordsLoader = useDataLoader((params: ISearchAllFilters, pagination?: ApiPaginationRequestOptions) =>
    api.search.searchAll(params, pagination)
  );
  const summaryLoader = useDataLoader((params: ISearchAllFilters) => api.search.searchSummary(params));

  // Load initial summary on mount using empty search string to match everything
  useEffect(() => {
    const loadInitialSummary = async () => {
      const summaryData = await summaryLoader.load({ keyword: '' });
      if (summaryData) {
        setSummary(summaryData);
      }
    };
    loadInitialSummary();
  }, [summaryLoader, dialogContext]);

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounce(async (value: string) => {
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
      }, SEARCH_DEBOUNCE_MS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [SEARCH_PREVIEW_PAGINATION]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchValue(e.target.value);
      debouncedSearch(e.target.value);
    },
    [setSearchValue, debouncedSearch]
  );

  const handleFocus = useCallback(() => setIsDropdownOpen(true), [setIsDropdownOpen]);
  const handleClickAway = useCallback(() => setIsDropdownOpen(false), [setIsDropdownOpen]);

  const shouldShowDropdown = isDropdownOpen && (records || summary);
  const showLoading = !records && !summary && recordsLoader.isLoading && summaryLoader.isLoading;

  return (
    <Stack gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <ClickAwayListener onClickAway={handleClickAway}>
          <Box width="100%" position="relative">
            <SearchInput
              placeholder="Enter names, keywords, or relevant terms"
              handleChange={handleChange}
              value={searchValue}
              onFocus={handleFocus}
            />
            {shouldShowDropdown && (
              <Box position="absolute" top="100%" left={0} right={0} mt={1} zIndex={9999}>
                <SearchListbox searchTerm={searchValue} records={records} summary={summary} isLoading={showLoading} />
              </Box>
            )}
          </Box>
        </ClickAwayListener>

        <Button variant="contained" sx={{ height: 56, fontWeight: 700 }} aria-label="Search">
          <Icon path={mdiArrowRight} size={1} />
        </Button>
      </Stack>

      <LoadingGuard isLoading={isLoading} isLoadingFallback={<SkeletonHorizontalStack height={30} width={60} />}>
        <SearchTabs links={links} />
      </LoadingGuard>
    </Stack>
  );
};
