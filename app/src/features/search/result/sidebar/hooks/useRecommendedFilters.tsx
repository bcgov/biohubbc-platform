import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISearchPropertyFilters } from 'interfaces/useSearchApi.interface';
import { useCallback, useRef, useState } from 'react';
import { SidebarOption } from '../section/option/SearchSidebarOption';

/**
 * Recommended filters state
 */
export interface RecommendedFiltersState {
  species: SidebarOption[];
  feature_types: SidebarOption[];
  properties: SidebarOption[];
}

/**
 * Input for recommended filters hook
 */
export interface RecommendedFiltersInput {
  species?: string;
  feature_types?: {
    filters?: { feature_type?: string };
    allFeatureTypes: string[];
  };
  properties?: {
    filters: ISearchPropertyFilters;
    pagination?: { page: number; limit: number };
  };
}

/**
 * OmitListed recommended items tracking (per session)
 */
export interface OmitListedRecommendedState {
  species: Set<string | number>;
  feature_types: Set<string | number>;
  properties: Set<string | number>;
}

/**
 * Custom hook to fetch recommended filters for sidebar.
 *
 * - Features are derived locally from `allFeatureTypes`.
 * - Species and properties are fetched from the API.
 * - Results are cached in-memory for fast re-rendering.
 * - Cache updates atomically to avoid flickering (10 records -> 5 records, not 10 -> 0 -> 5)
 */
export const useRecommendedFilters = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isLoading, setIsLoading] = useState(false);

  const cacheRef = useRef<RecommendedFiltersState>({
    species: [],
    feature_types: [],
    properties: []
  });

  const handleRefresh = useCallback(
    async (input: RecommendedFiltersInput): Promise<void> => {
      setIsLoading(true);

      try {
        // Build new data without clearing cache
        const newData: RecommendedFiltersState = {
          species: [],
          feature_types: [],
          properties: []
        };

        // Features: local computation from all available types
        newData.feature_types = (input.feature_types?.allFeatureTypes ?? []).map((ft) => ({
          label: ft,
          value: ft
        }));

        // Species: API fetch
        if (input.species) {
          try {
            const res = await api.taxonomy.searchSpecies(input.species);
            newData.species = res.searchResponse.map((s) => ({
              label: s.scientificName,
              value: s.tsn
            }));
          } catch (err) {
            dialogContext.setSnackbar({
              open: true,
              snackbarMessage: `Failed to load species: ${(err as Error).message}`
            });
          }
        }

        // Properties: API fetch
        if (input.properties) {
          try {
            const res = await api.search.searchProperties(input.properties.filters);
            const allProps = [...(res.properties.string ?? []), ...(res.properties.number ?? [])];
            newData.properties = allProps.map((p) => ({
              label: p.property_name,
              value: p.feature_property_id
            }));
          } catch (err) {
            dialogContext.setSnackbar({
              open: true,
              snackbarMessage: `Failed to load properties: ${(err as Error).message}`
            });
          }
        }

        // Update cache atomically once all data is ready
        cacheRef.current = newData;
      } catch (error) {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: (error as Error).message
        });
      } finally {
        setIsLoading(false);
      }
    },
    [api, dialogContext]
  );

  return {
    recommended: cacheRef.current,
    isLoading,
    handleRefresh
  };
};
