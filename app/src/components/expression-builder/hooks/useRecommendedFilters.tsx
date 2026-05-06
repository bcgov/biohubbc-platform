import { mapSearchPropertyToExpressionBuilderProperty } from 'utils/expression';
import {
  ExpressionBuilderProperty,
  ExpressionBuilderSearchOption
} from 'components/expression-builder/ExpressionBuilder.interface';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISearchPropertyFilters } from 'interfaces/useSearchApi.interface';
import { useCallback, useEffect, useRef, useState } from 'react';

interface RecommendedFiltersState {
  species: ExpressionBuilderSearchOption[];
  properties: ExpressionBuilderProperty[];
}

interface RecommendedFiltersInput {
  species?: string;
  properties?: {
    filters: ISearchPropertyFilters;
    pagination?: { page: number; limit: number };
  };
}

/**
 * Fetches recommended filters for the search UI.
 *
 * Use this inside `ExpressionBuilder` to load property and species suggestions
 * for the current search text. The caller owns input debouncing; stale
 * responses are ignored when a newer refresh starts.
 *
 * @returns {{ recommended: RecommendedFiltersState; handleRefresh: (input: RecommendedFiltersInput) => void }} Current recommendations and refresh callback.
 */
export const useRecommendedFilters = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const searchPropertiesRef = useRef(api.search.searchProperties);
  const searchSpeciesRef = useRef(api.taxonomy.searchSpecies);
  const setSnackbarRef = useRef(dialogContext.setSnackbar);
  const activeRefreshIdRef = useRef(0);
  const [recommended, setRecommended] = useState<RecommendedFiltersState>({
    species: [],
    properties: []
  });

  useEffect(() => {
    searchPropertiesRef.current = api.search.searchProperties;
    searchSpeciesRef.current = api.taxonomy.searchSpecies;
    setSnackbarRef.current = dialogContext.setSnackbar;
  });

  const refreshNow = useCallback(async (input: RecommendedFiltersInput, refreshId: number) => {
    const loadSpecies = async (): Promise<ExpressionBuilderSearchOption[]> => {
      if (!input.species) {
        return [];
      }

      try {
        const response = await searchSpeciesRef.current(input.species);

        return response.searchResponse.map((species) => ({
          label: species.scientificName,
          value: species.tsn
        }));
      } catch (err) {
        setSnackbarRef.current({
          open: true,
          snackbarMessage: `Failed to load species: ${(err as Error).message}`
        });

        return [];
      }
    };

    const loadProperties = async (): Promise<ExpressionBuilderProperty[]> => {
      if (!input.properties) {
        return [];
      }

      try {
        const response = await searchPropertiesRef.current(input.properties.filters, input.properties.pagination);
        const allProperties = Object.values(response.properties).flat();

        return allProperties.map(mapSearchPropertyToExpressionBuilderProperty);
      } catch (err) {
        setSnackbarRef.current({
          open: true,
          snackbarMessage: `Failed to load properties: ${(err as Error).message}`
        });

        return [];
      }
    };

    const [species, properties] = await Promise.all([loadSpecies(), loadProperties()]);

    if (refreshId === activeRefreshIdRef.current) {
      setRecommended({ species, properties });
    }
  }, []);

  const handleRefresh = useCallback(
    (input: RecommendedFiltersInput) => {
      const refreshId = ++activeRefreshIdRef.current;
      refreshNow(input, refreshId);
    },
    [refreshNow]
  );

  return {
    recommended,
    handleRefresh
  };
};
