import { Box, ClickAwayListener, Stack } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonHorizontalStack } from 'components/loading/SkeletonLoaders';
import { SearchInput } from 'components/search/SearchInput';
import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import { URL_PARAMS } from 'constants/query-params';
import { SEARCH_PREVIEW_DEBOUNCE_MS, SEARCH_PREVIEW_PAGINATION } from 'constants/search';
import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { searchQueryKeys } from 'utils/query-keys/search-query-keys';
import { buildSearchFeatureTypePath } from 'utils/routes';
import { SearchListbox } from './listbox/SearchListbox';
import { SearchTabs } from './tab/SearchTabs';
import { ISearchContainerLink } from './tab/SearchTabs.interface';

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

  const [searchValue, setSearchValue] = useState('');
  // The keyword the preview shows; null until the user first types, when only the summary of everything is shown.
  const [previewKeyword, setPreviewKeyword] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const recordsQuery = useQuery({
    queryKey: searchQueryKeys.keywordRecords(previewKeyword ?? '', SEARCH_PREVIEW_PAGINATION),
    queryFn: ({ signal }) =>
      api.search.searchAll({ keyword: previewKeyword ?? '' }, SEARCH_PREVIEW_PAGINATION, { signal }),
    enabled: previewKeyword !== null,
    placeholderData: keepPreviousData
  });
  const summaryQuery = useQuery({
    queryKey: searchQueryKeys.keywordSummary(previewKeyword ?? ''),
    queryFn: ({ signal }) => api.search.searchSummary({ keyword: previewKeyword ?? '' }, { signal }),
    placeholderData: keepPreviousData
  });
  const records = recordsQuery.data ?? null;
  const summary = summaryQuery.data ?? null;

  const debouncedSearch = useDebounce(setPreviewKeyword, SEARCH_PREVIEW_DEBOUNCE_MS);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

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
  const showLoading = !records && !summary && recordsQuery.isFetching && summaryQuery.isFetching;

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
