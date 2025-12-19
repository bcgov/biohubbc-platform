import { mdiClose } from '@mdi/js';
import { Icon } from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import {
  ActiveFilter,
  FilterSidebar,
  FilterGroupType,
  SearchInput,
  useSearchFilterStyles
} from 'components/search-filter';
import SearchResultsList from 'features/submissions/list/SearchResultsList';
import SecureDataAccessRequestDialog from 'features/submissions/page/security/SecureDataAccessRequestDialog';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDownload from 'hooks/useDownload';
import { IPropertyFilter, ISearchFeaturesRequest, SearchFeatureResult } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { pluralize as p } from 'utils/Utils';

/** Minimum characters required before triggering search API */
const MIN_SEARCH_CHARS = 3;

/** Property types allowed in filter dropdown (must have a search_* table) */
const SEARCHABLE_PROPERTY_TYPES = new Set(['string', 'number', 'datetime']);

/**
 * Renders reviewed + published Submissions as cards with download and request access actions.
 * Supports server-side search when user enters 3+ characters.
 *
 * @returns {*}
 */
const SubmissionsListPage = () => {
  const biohubApi = useApi();
  const { downloadJSON } = useDownload();
  const styles = useSearchFilterStyles();

  // Load codes for property filter options
  const codesDataLoader = useDataLoader(() => biohubApi.codes.getAllCodeSets());
  codesDataLoader.load();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // Search API data loader
  const searchDataLoader = useDataLoader((params: ISearchFeaturesRequest) => biohubApi.search.searchFeatures(params));

  const [openRequestAccess, setOpenRequestAccess] = useState(false);

  // Map frontend filter type to API property type
  const mapFilterTypeToPropertyType = (filterType: 'text' | 'datetime' | 'enum'): 'string' | 'number' | 'datetime' => {
    if (filterType === 'datetime') {
      return 'datetime';
    }
    // 'text' and 'enum' both map to 'string' for now
    return 'string';
  };

  // Convert ActiveFilter[] to IPropertyFilter[] for API calls
  const apiFilters = useMemo(
    (): IPropertyFilter[] =>
      activeFilters.map((f) => ({
        featureTypeName: f.featureType,
        propertyName: f.property,
        propertyType: mapFilterTypeToPropertyType(f.propertyType),
        value: f.value
      })),
    [activeFilters]
  );

  /**
   * Trigger search API call with current keywords and filters.
   */
  const triggerSearch = useCallback(
    (keywords: string | undefined, filters: IPropertyFilter[]) => {
      const hasKeywords = keywords && keywords.length >= MIN_SEARCH_CHARS;
      const hasFilters = filters.length > 0;

      if (hasKeywords || hasFilters) {
        searchDataLoader.refresh({
          keywords: hasKeywords ? keywords : undefined,
          propertyFilters: hasFilters ? filters : undefined
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * Debounced function to trigger search API call.
   * Waits 300ms after last keystroke before triggering.
   */
  const debouncedSearch = useMemo(
    () =>
      debounce((term: string, filters: IPropertyFilter[]) => {
        setDebouncedSearchTerm(term);
        triggerSearch(term, filters);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * Handle search input changes.
   * Updates local state immediately and triggers debounced API search.
   */
  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const term = event.target.value;
      setSearchTerm(term);

      if (term.length >= MIN_SEARCH_CHARS || apiFilters.length > 0) {
        // Trigger server-side search
        debouncedSearch(term, apiFilters);
      } else {
        // Clear search results and show all submissions
        setDebouncedSearchTerm('');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiFilters]
  );

  /**
   * Handle clearing the search input.
   */
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  // Map property types to filter input types
  const getFilterType = (propertyType: string): 'text' | 'datetime' => {
    if (propertyType === 'datetime') {
      return 'datetime';
    }
    return 'text';
  };

  // Create filter groups organized by feature type for sidebar
  const filterGroups = useMemo((): FilterGroupType[] => {
    if (!codesDataLoader.data?.feature_type_with_properties) {
      return [];
    }

    return codesDataLoader.data.feature_type_with_properties
      .map((featureType) => ({
        id: featureType.feature_type.feature_type_id,
        name: featureType.feature_type.feature_type_name,
        displayName: featureType.feature_type.feature_type_display_name,
        properties: featureType.feature_type_properties
          .filter((prop) => SEARCHABLE_PROPERTY_TYPES.has(prop.feature_property_type_name))
          .map((prop) => ({
            name: prop.feature_property_name,
            displayName: prop.feature_property_display_name,
            type: getFilterType(prop.feature_property_type_name) as 'text' | 'number' | 'datetime'
          }))
      }))
      .filter((group) => group.properties.length > 0)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [codesDataLoader.data]);

  /**
   * Handle filter changes from sidebar.
   */
  const handleFiltersChange = useCallback((filters: ActiveFilter[]) => {
    setActiveFilters(filters);
  }, []);

  /**
   * Remove a single filter by feature type and property name (for pill X button).
   */
  const handleRemoveFilter = useCallback((featureType: string, propertyName: string) => {
    setActiveFilters((prev) => prev.filter((f) => !(f.featureType === featureType && f.property === propertyName)));
  }, []);

  // Trigger search when filters change
  useEffect(() => {
    const hasKeywords = debouncedSearchTerm.length >= MIN_SEARCH_CHARS;
    const hasFilters = apiFilters.length > 0;

    if (hasKeywords || hasFilters) {
      triggerSearch(hasKeywords ? debouncedSearchTerm : undefined, apiFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters]);

  // Determine if we're in search mode (keywords or filters)
  const isSearching = debouncedSearchTerm.length >= MIN_SEARCH_CHARS || apiFilters.length > 0;
  const searchResults = searchDataLoader.data || [];

  const onDownloadFeature = async (result: SearchFeatureResult) => {
    // Download the feature's parent submission package
    const data = await biohubApi.submissions.getSubmissionPublishedDownloadPackage(result.submission_id);
    const fileName = `${result.submission_name.toLowerCase().replaceAll(' ', '-')}-${result.submission_id}`;
    downloadJSON(data, fileName);
  };

  /**
   * Renders the appropriate content based on loading and search state.
   */
  const renderSearchContent = () => {
    if (searchDataLoader.isLoading) {
      return (
        <>
          <RecordsFoundSkeletonLoader />
          <SubmissionCardSkeletonLoader />
        </>
      );
    }

    if (isSearching) {
      return (
        <>
          <Box pb={4}>
            <Typography variant="h4" component="h2">
              {`${searchResults.length} ${p(searchResults.length, 'feature')} found`}
            </Typography>
            {searchResults.length > 0 && (
              <Typography variant="body2" color="textSecondary" mt={1}>
                Results are sorted by relevancy.
              </Typography>
            )}
          </Box>
          <SearchResultsList
            results={searchResults}
            onDownload={onDownloadFeature}
            onAccessRequest={() => setOpenRequestAccess(true)}
          />
        </>
      );
    }

    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        py={8}
        color="textSecondary">
        <Typography variant="h5" color="textSecondary" gutterBottom>
          Search to find data
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Enter keywords, add filters, or both to discover data
        </Typography>
      </Box>
    );
  };

  return (
    <>
      <SecureDataAccessRequestDialog
        open={openRequestAccess}
        onClose={() => setOpenRequestAccess(false)}
        artifacts={[]}
        initialArtifactSelection={[]}
      />
      {/* Main layout: Sidebar | Content (full height from nav header) */}
      <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
        {/* Filter Sidebar */}
        <FilterSidebar
          filterGroups={filterGroups}
          activeFilters={activeFilters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Content area: Header + Search + Results */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Page Header */}
          <Box sx={{ py: 3, px: 4, borderBottom: '1px solid #D8D8D8' }}>
            <Typography mb={1} variant="h1" sx={{ color: '#013366' }}>
              BioHub BC
            </Typography>
            <Typography color="textSecondary">
              Open access to British Columbia's terrestrial, aquatic species and habitat inventory data.
            </Typography>
          </Box>

          {/* Search + Results area */}
          <Box sx={{ flex: 1, p: 4 }}>
            {/* Search Input */}
            <Box sx={{ mb: 3 }}>
              <SearchInput
                placeholderText="Search for caribou, grizzly bear, salmon surveys..."
                value={searchTerm}
                handleChange={handleSearch}
                onClear={handleClearSearch}
              />
              {/* Active filter pills */}
              {activeFilters.length > 0 && (
                <Box sx={{ ...styles.filterPillsContainer }}>
                  {activeFilters.map((filter) => (
                    <Box key={`${filter.featureType}-${filter.property}`} sx={{ ...styles.activePill }}>
                      <span style={{ color: '#697386' }}>
                        {filter.featureTypeDisplayName}: {filter.label}
                      </span>
                      <span>{filter.value}</span>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveFilter(filter.featureType, filter.property)}
                        sx={{ ...styles.pillRemoveButton }}
                        aria-label={`Remove ${filter.featureTypeDisplayName} ${filter.label} filter`}>
                        <Icon path={mdiClose} size={0.5} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            {renderSearchContent()}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default SubmissionsListPage;
