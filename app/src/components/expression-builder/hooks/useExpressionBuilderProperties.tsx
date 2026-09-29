import {
  ExpressionBuilderProperty,
  ExpressionBuilderSearchOption
} from 'components/expression-builder/ExpressionBuilder.interface';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EXPRESSION_BUILDER_MAX_SUGGESTIONS_PER_CATEGORY,
  EXPRESSION_BUILDER_PROPERTY_HYDRATION_MAX_PAGES,
  EXPRESSION_BUILDER_PROPERTY_SEARCH_LIMIT
} from 'constants/expression';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import {
  getExpressionBuilderPropertyKeyFromProperty,
  mapSearchPropertyToExpressionBuilderProperty
} from 'utils/expression';
import { searchQueryKeys } from 'utils/query-keys/search-query-keys';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecommendedFilters } from './useRecommendedFilters';

interface UseExpressionBuilderPropertiesResult {
  propertyOptions: ExpressionBuilderProperty[];
  selectedProperties: ExpressionBuilderProperty[];
  knownProperties: ExpressionBuilderProperty[];
  suggestedProperties: ExpressionBuilderProperty[];
  suggestedSpecies: ExpressionBuilderSearchOption[];
  speciesPredicateProperty: ExpressionBuilderProperty | null;
  handlePropertySelected: (property: ExpressionBuilderProperty) => void;
  loadSpeciesPredicateProperty: () => Promise<ExpressionBuilderProperty | null>;
  refreshPropertyOptions: (keyword?: string) => void;
}

/**
 * Coordinates the property metadata used by the expression builder.
 *
 * The builder needs property definitions from several places: the current
 * property autocomplete results, properties already selected into the draft
 * expression, and recommended properties returned for the debounced top-level
 * search text. This hook merges those sources into `knownProperties` so child
 * controls can keep rendering labels/operators for predicates even after the
 * autocomplete list changes.
 *
 * The hook also owns property-option loading for picker inputs, the recommended
 * filters for the builder popper, and the cached `taxon_id` lookup used when a
 * species suggestion chip is converted into a predicate. Each is a query keyed on
 * its search text, so a newer text supersedes an older one. The parent is
 * expected to pass a debounced `recommendedSearchTerm`.
 *
 * @param {string | undefined} recommendedSearchTerm Debounced top-level search text used to refresh suggested properties and species.
 * @param {Set<string>} usedPropertyKeys Canonical property keys already present in the draft expression, used to hide duplicate suggestion chips.
 * @param {boolean} [enabled=true] Whether the builder is on screen; while false, nothing is loaded.
 * @returns {UseExpressionBuilderPropertiesResult} Property options, known property metadata, suggestion lists, and handlers used by the expression builder.
 */
export const useExpressionBuilderProperties = (
  recommendedSearchTerm: string | undefined,
  usedPropertyKeys: Set<string>,
  enabled = true
): UseExpressionBuilderPropertiesResult => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const [selectedPropertiesByKey, setSelectedPropertiesByKey] = useState<Map<string, ExpressionBuilderProperty>>(
    () => new Map()
  );
  // The trimmed keyword the property pickers show options for; empty loads the default options.
  const [propertyKeyword, setPropertyKeyword] = useState('');
  const { recommended } = useRecommendedFilters(recommendedSearchTerm?.trim() ?? '', enabled);

  // With no keyword, the options are paged until they include every property the draft uses whose definition is
  // not already held from a selection or a recommendation. The options themselves are not counted: they are what
  // this search produces.
  const hydratedPropertyKeys = useMemo(() => {
    if (propertyKeyword) {
      return [];
    }
    const heldPropertyKeys = new Set([
      ...selectedPropertiesByKey.keys(),
      ...recommended.properties.map(getExpressionBuilderPropertyKeyFromProperty)
    ]);
    return Array.from(usedPropertyKeys)
      .filter((key) => !heldPropertyKeys.has(key))
      .sort((a, b) => a.localeCompare(b));
  }, [propertyKeyword, recommended.properties, selectedPropertiesByKey, usedPropertyKeys]);

  const propertyOptionsQuery = useQuery({
    queryKey: searchQueryKeys.propertyOptions(propertyKeyword, hydratedPropertyKeys),
    queryFn: async ({ signal }) => {
      const collectedPropertiesByKey = new Map<string, ExpressionBuilderProperty>();
      let page = 1;
      let lastPage = 1;

      do {
        const response = await api.search.searchProperties(
          propertyKeyword ? { keyword: propertyKeyword } : {},
          { page, limit: EXPRESSION_BUILDER_PROPERTY_SEARCH_LIMIT },
          { signal }
        );

        Object.values(response.properties)
          .flat()
          .map(mapSearchPropertyToExpressionBuilderProperty)
          .forEach((property) => {
            collectedPropertiesByKey.set(getExpressionBuilderPropertyKeyFromProperty(property), property);
          });

        lastPage = response.pagination.last_page;
        page += 1;
      } while (
        hydratedPropertyKeys.some((key) => !collectedPropertiesByKey.has(key)) &&
        page <= lastPage &&
        page <= EXPRESSION_BUILDER_PROPERTY_HYDRATION_MAX_PAGES
      );

      return Array.from(collectedPropertiesByKey.values());
    },
    enabled,
    placeholderData: keepPreviousData
  });
  const propertyOptions = useMemo(() => propertyOptionsQuery.data ?? [], [propertyOptionsQuery.data]);

  const { error: propertyOptionsError } = propertyOptionsQuery;
  useEffect(() => {
    if (propertyOptionsError) {
      setSnackbar({ open: true, snackbarMessage: `Failed to load properties: ${propertyOptionsError.message}` });
    }
  }, [propertyOptionsError, setSnackbar]);

  /**
   * Finds the expression-builder property that represents species predicates.
   *
   * Species suggestion chips insert a taxon predicate, so only a `taxon_id`
   * property whose normalized builder type is `taxon` is usable here. A backend
   * response that groups `taxon_id` as `number` is intentionally ignored because
   * that shape cannot supply the taxon operators/value handling required by the
   * expression builder.
   *
   * @param {ExpressionBuilderProperty[]} properties Candidate properties from the builder's local metadata caches.
   * @returns {ExpressionBuilderProperty | null} The taxon predicate property when available, otherwise null.
   */
  const findSpeciesPredicateProperty = useCallback(
    (properties: ExpressionBuilderProperty[]): ExpressionBuilderProperty | null =>
      properties.find((property) => property.predicate_type === 'taxon' && property.property_name === 'taxon_id') ??
      null,
    []
  );

  /**
   * Adds a property definition to the selected-property cache.
   *
   * Predicate rows only store the selected property id/name. Caching the full
   * property definition when a property is chosen lets the builder preserve
   * display names and operator metadata after the autocomplete results or
   * recommendation results have moved on to a different search term.
   *
   * @param {ExpressionBuilderProperty} property Property selected through a picker, suggestion chip, or cached species lookup.
   */
  const handlePropertySelected = useCallback((property: ExpressionBuilderProperty) => {
    setSelectedPropertiesByKey((current) => {
      const next = new Map(current);
      next.set(getExpressionBuilderPropertyKeyFromProperty(property), property);
      return next;
    });
  }, []);

  const selectedProperties = useMemo(() => Array.from(selectedPropertiesByKey.values()), [selectedPropertiesByKey]);
  const knownProperties = useMemo(
    () =>
      Array.from(
        new Map(
          [...selectedProperties, ...propertyOptions, ...recommended.properties].map((property) => [
            getExpressionBuilderPropertyKeyFromProperty(property),
            property
          ])
        ).values()
      ),
    [propertyOptions, recommended.properties, selectedProperties]
  );
  const speciesPredicateProperty = useMemo(
    () => findSpeciesPredicateProperty(knownProperties),
    [findSpeciesPredicateProperty, knownProperties]
  );
  const suggestedProperties = useMemo(
    () =>
      recommended.properties
        .filter((property) => !usedPropertyKeys.has(getExpressionBuilderPropertyKeyFromProperty(property)))
        .slice(0, EXPRESSION_BUILDER_MAX_SUGGESTIONS_PER_CATEGORY),
    [recommended.properties, usedPropertyKeys]
  );
  const suggestedSpecies = useMemo(
    () => recommended.species.slice(0, EXPRESSION_BUILDER_MAX_SUGGESTIONS_PER_CATEGORY),
    [recommended.species]
  );

  const debouncedSetPropertyKeyword = useDebounce(setPropertyKeyword, 300);

  /**
   * Sets the keyword property pickers show options for.
   *
   * Child predicate tokens call this as the property search text changes. A keyword applies once typing settles, so
   * the property search endpoint does not receive one request per character; clearing the text applies at once.
   *
   * @param {string} keyword Raw property search text from a picker input.
   */
  const refreshPropertyOptions = useCallback(
    (keyword = '') => {
      const normalizedKeyword = keyword.trim();

      if (!normalizedKeyword) {
        debouncedSetPropertyKeyword.cancel();
        setPropertyKeyword('');
        return;
      }

      debouncedSetPropertyKeyword(normalizedKeyword);
    },
    [debouncedSetPropertyKeyword]
  );

  /**
   * Loads the normalized `taxon_id` property used to convert species suggestion chips into predicates.
   *
   * The normal property option or recommendation searches may already include
   * the `taxon_id` property; when they do, this returns the cached property
   * without making another API call. Otherwise it looks the property up once per
   * session, found or not, since property definitions change only with a
   * deployment. A property found through that lookup is added to the
   * selected-property cache so the inserted predicate can continue rendering even
   * if option and recommendation lists later change.
   *
   * @returns {Promise<ExpressionBuilderProperty | null>} The cached or loaded taxon predicate property, or null when unavailable.
   */
  const loadSpeciesPredicateProperty = useCallback(async (): Promise<ExpressionBuilderProperty | null> => {
    if (!enabled) {
      return null;
    }

    const existingProperty = findSpeciesPredicateProperty(knownProperties);

    if (existingProperty) {
      return existingProperty;
    }

    try {
      const property = await queryClient.fetchQuery({
        queryKey: searchQueryKeys.speciesPredicateProperty(),
        queryFn: async ({ signal }) => {
          const response = await api.search.searchProperties(
            { keyword: 'taxon_id' },
            { page: 1, limit: 25 },
            { signal }
          );

          return findSpeciesPredicateProperty(
            Object.values(response.properties).flat().map(mapSearchPropertyToExpressionBuilderProperty)
          );
        },
        staleTime: Infinity
      });

      if (property) {
        handlePropertySelected(property);
      }

      return property;
    } catch (error) {
      setSnackbar({ open: true, snackbarMessage: `Failed to load taxon property: ${(error as Error).message}` });
      return null;
    }
  }, [
    api.search,
    enabled,
    findSpeciesPredicateProperty,
    handlePropertySelected,
    knownProperties,
    queryClient,
    setSnackbar
  ]);

  return {
    propertyOptions,
    selectedProperties,
    knownProperties,
    suggestedProperties,
    suggestedSpecies,
    speciesPredicateProperty,
    handlePropertySelected,
    loadSpeciesPredicateProperty,
    refreshPropertyOptions
  };
};
