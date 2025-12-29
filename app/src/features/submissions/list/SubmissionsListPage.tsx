import { mdiClose } from '@mdi/js';
import { Icon } from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { ActiveFilter, FilterGroupType, FilterSidebar, useSearchFilterStyles } from 'components/search-filter';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import { SearchInput } from 'features/search/container/input/SearchInput';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDownload from 'hooks/useDownload';
import { IPropertyFilter, SearchFeatureResultWithRelevance } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { pluralize as p } from 'utils/Utils';
import SecureDataAccessRequestDialog from '../page/security/SecureDataAccessRequestDialog';
import SearchResultsList from './SearchResultsList';

const MIN_SEARCH_CHARS = 3;
const SEARCHABLE_PROPERTY_TYPES = new Set(['string', 'number', 'datetime']);

const SubmissionsListPage = () => {
  const biohubApi = useApi();
  const { downloadJSON } = useDownload();
  const styles = useSearchFilterStyles();

  /** Data Loaders */
  const reviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.submissions.getPublishedSubmissions());
  const codesDataLoader = useDataLoader(() => biohubApi.codes.getAllCodeSets());
  const searchDataLoader = useDataLoader((params: { keywords?: string; propertyFilters?: IPropertyFilter[] }) => {
    return biohubApi.search.searchFeatures({
      keywords: params.keywords || '',
      propertyFilters: params.propertyFilters
    });
  });

  useEffect(() => {
    reviewedSubmissionsDataLoader.load();
    codesDataLoader.load();
  }, [reviewedSubmissionsDataLoader, codesDataLoader]);

  /** Local state */
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [openRequestAccess, setOpenRequestAccess] = useState(false);

  /** Map frontend filter type to API property type */
  const mapFilterTypeToPropertyType = (filterType: 'text' | 'datetime' | 'enum'): 'string' | 'number' | 'datetime' => {
    if (filterType === 'datetime') {
      return 'datetime';
    } else {
      return 'string'; // text and enum
    }
  };

  /** Convert ActiveFilter[] to IPropertyFilter[] for API */
  const apiFilters = useMemo<IPropertyFilter[]>(() => {
    return activeFilters.map((f) => {
      return {
        featureTypeName: f.featureType,
        propertyName: f.property,
        propertyType: mapFilterTypeToPropertyType(f.propertyType),
        value: f.value
      };
    });
  }, [activeFilters]);

  /** Trigger search API call */
  const triggerSearch = useCallback(
    (keywords?: string, filters: IPropertyFilter[] = []) => {
      const hasKeywords = keywords && keywords.length >= MIN_SEARCH_CHARS;
      const hasFilters = filters.length > 0;

      if (hasKeywords || hasFilters) {
        searchDataLoader.refresh({
          keywords: hasKeywords ? keywords : undefined,
          propertyFilters: hasFilters ? filters : undefined
        });
      }
    },
    [searchDataLoader]
  );

  /** Debounced search */
  const debouncedSearch = useMemo(() => {
    return debounce((term: string, filters: IPropertyFilter[]) => {
      setDebouncedSearchTerm(term);
      triggerSearch(term, filters);
    }, 300);
  }, [triggerSearch]);

  /** Handle search input changes */
  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const term = event.target.value;
      setSearchTerm(term);

      if (term.length >= MIN_SEARCH_CHARS || apiFilters.length > 0) {
        debouncedSearch(term, apiFilters);
      } else {
        setDebouncedSearchTerm('');
      }
    },
    [apiFilters, debouncedSearch]
  );

  // /** Clear search input */
  // const handleClearSearch = useCallback(() => {
  //   setSearchTerm('');
  //   setDebouncedSearchTerm('');
  // }, []);

  /** Map property types to filter input types */
  const getFilterType = (propertyType: string): 'text' | 'datetime' => {
    if (propertyType === 'datetime') {
      return 'datetime';
    } else {
      return 'text';
    }
  };

  /** Filter groups for sidebar */
  const filterGroups = useMemo<FilterGroupType[]>(() => {
    if (!codesDataLoader.data?.feature_type_with_properties) {
      return [];
    }

    return codesDataLoader.data.feature_type_with_properties
      .map((featureType) => {
        return {
          id: featureType.feature_type.feature_type_id,
          name: featureType.feature_type.feature_type_name,
          displayName: featureType.feature_type.feature_type_display_name,
          properties: featureType.feature_type_properties
            .filter((prop) => SEARCHABLE_PROPERTY_TYPES.has(prop.feature_property_type_name))
            .map((prop) => {
              return {
                name: prop.feature_property_name,
                displayName: prop.feature_property_display_name,
                type: getFilterType(prop.feature_property_type_name)
              };
            })
        };
      })
      .filter((group) => group.properties.length > 0)
      .sort((a, b) => {
        return a.displayName.localeCompare(b.displayName);
      });
  }, [codesDataLoader.data]);

  /** Handle filter changes from sidebar */
  const handleFiltersChange = useCallback((filters: ActiveFilter[]) => {
    return setActiveFilters(filters);
  }, []);

  /** Remove single filter pill */
  const handleRemoveFilter = useCallback((featureType: string, propertyName: string) => {
    return setActiveFilters((prev) => {
      return prev.filter((f) => !(f.featureType === featureType && f.property === propertyName));
    });
  }, []);

  /** Trigger search when filters change */
  useEffect(() => {
    const hasKeywords = debouncedSearchTerm.length >= MIN_SEARCH_CHARS;
    const hasFilters = apiFilters.length > 0;

    if (hasKeywords || hasFilters) {
      return triggerSearch(hasKeywords ? debouncedSearchTerm : undefined, apiFilters);
    }
  }, [apiFilters, debouncedSearchTerm, triggerSearch]);

  /** Determine if search mode */
  const isSearching = debouncedSearchTerm.length >= MIN_SEARCH_CHARS || apiFilters.length > 0;
  const searchResults = searchDataLoader.data || [];

  /** Download feature's submission */
  const onDownloadFeature = async (result: SearchFeatureResultWithRelevance) => {
    const data = await biohubApi.submissions.getSubmissionPublishedDownloadPackage(result.submission_id);
    const fileName = `${result.submission_name.toLowerCase().replaceAll(' ', '-')}-${result.submission_id}`;
    return downloadJSON(data, fileName);
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

      <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
        {/* Sidebar */}
        <FilterSidebar
          filterGroups={filterGroups}
          activeFilters={activeFilters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box sx={{ py: 3, px: 4, borderBottom: '1px solid #D8D8D8' }}>
            <Typography mb={1} variant="h1" sx={{ color: '#013366' }}>
              BioHub BC
            </Typography>
            <Typography color="textSecondary">
              Open access to British Columbia's terrestrial, aquatic species and habitat inventory data.
            </Typography>
          </Box>

          {/* Search and Results */}
          <Box sx={{ flex: 1, p: 4 }}>
            <Box sx={{ mb: 3 }}>
              <SearchInput
                placeholderText="Search for caribou, grizzly bear, salmon surveys..."
                value={searchTerm}
                handleChange={handleSearch}
              />

              {/* Active Filter Pills */}
              {activeFilters.length > 0 && (
                <Box sx={{ ...styles.filterPillsContainer }}>
                  {activeFilters.map((filter) => {
                    return (
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
                    );
                  })}
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
