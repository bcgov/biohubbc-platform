import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ExpressionBuilderProperty,
  ExpressionBuilderSearchOption
} from 'components/expression-builder/ExpressionBuilder.interface';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useEffect, useMemo } from 'react';
import { mapSearchPropertyToExpressionBuilderProperty } from 'utils/expression';
import { searchQueryKeys } from 'utils/query-keys/search-query-keys';

interface RecommendedFiltersState {
  species: ExpressionBuilderSearchOption[];
  properties: ExpressionBuilderProperty[];
}

/**
 * Loads the property and species suggestions for the expression builder's search text.
 *
 * Both are keyed on the text, so a newer text supersedes an older one. The previous suggestions stay on screen while
 * the next load, and while the text is empty. A failed part is reported and shown as empty; the other part is
 * unaffected.
 *
 * @param {string} keyword The trimmed, debounced search text; empty loads nothing.
 * @param {boolean} enabled Whether the builder is on screen.
 * @returns {{ recommended: RecommendedFiltersState }} The current suggestions.
 */
export const useRecommendedFilters = (keyword: string, enabled: boolean) => {
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const canSearch = enabled && keyword.length > 0;

  const speciesQuery = useQuery({
    queryKey: searchQueryKeys.recommendedSpecies(keyword),
    queryFn: ({ signal }) => api.taxonomy.searchSpecies(keyword, undefined, { signal }),
    enabled: canSearch,
    placeholderData: keepPreviousData
  });
  const propertiesQuery = useQuery({
    queryKey: searchQueryKeys.recommendedProperties(keyword),
    queryFn: ({ signal }) => api.search.searchProperties({ keyword }, { page: 1, limit: 25 }, { signal }),
    enabled: canSearch,
    placeholderData: keepPreviousData
  });

  const { error: speciesError } = speciesQuery;
  useEffect(() => {
    if (speciesError) {
      setSnackbar({ open: true, snackbarMessage: `Failed to load species: ${speciesError.message}` });
    }
  }, [setSnackbar, speciesError]);

  const { error: propertiesError } = propertiesQuery;
  useEffect(() => {
    if (propertiesError) {
      setSnackbar({ open: true, snackbarMessage: `Failed to load properties: ${propertiesError.message}` });
    }
  }, [propertiesError, setSnackbar]);

  const recommended = useMemo<RecommendedFiltersState>(
    () => ({
      species:
        speciesQuery.data?.searchResponse.map((species) => ({ label: species.scientificName, value: species.tsn })) ??
        [],
      properties: Object.values(propertiesQuery.data?.properties ?? {})
        .flat()
        .map(mapSearchPropertyToExpressionBuilderProperty)
    }),
    [propertiesQuery.data, speciesQuery.data]
  );

  return { recommended };
};
