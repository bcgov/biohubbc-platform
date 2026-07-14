import {
  ExpressionBuilderProperty,
  ExpressionBuilderSearchOption
} from 'components/expression-builder/ExpressionBuilder.interface';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import useDataLoader from 'hooks/useDataLoader';
import {
  getExpressionBuilderPropertyKeyFromProperty,
  mapSearchPropertyToExpressionBuilderProperty
} from 'utils/expression';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecommendedFilters } from './useRecommendedFilters';

const MAX_NUMBER_SEARCH_SUGGESTIONS_PER_CATEGORY = 6;
const PROPERTY_SEARCH_DEFAULT_LIMIT = 25;
const PROPERTY_SEARCH_HYDRATION_MAX_PAGES = 20;

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
 * The hook also owns property-option loading for picker inputs, recommended
 * filter refreshes for the builder popper, and the cached `taxon_id` lookup used
 * when a species suggestion chip is converted into a predicate. The parent is
 * expected to pass a debounced `recommendedSearchTerm`; this hook tracks the last
 * submitted term so re-renders and recommendation responses do not trigger
 * duplicate refresh calls.
 *
 * @param {string | undefined} recommendedSearchTerm Debounced top-level search text used to refresh suggested properties and species.
 * @param {Set<string>} usedPropertyKeys Canonical property keys already present in the draft expression, used to hide duplicate suggestion chips.
 * @returns {UseExpressionBuilderPropertiesResult} Property options, known property metadata, suggestion lists, and handlers used by the expression builder.
 */
export const useExpressionBuilderProperties = (
  recommendedSearchTerm: string | undefined,
  usedPropertyKeys: Set<string>,
  enabled = true
): UseExpressionBuilderPropertiesResult => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const searchPropertiesRef = useRef(api.search.searchProperties);
  const setSnackbarRef = useRef(dialogContext.setSnackbar);
  const [propertyOptions, setPropertyOptions] = useState<ExpressionBuilderProperty[]>([]);
  const [selectedPropertiesByKey, setSelectedPropertiesByKey] = useState<Map<string, ExpressionBuilderProperty>>(
    () => new Map()
  );
  const lastRecommendedSearchTermRef = useRef<string | null>(null);
  const activePropertyOptionsLookupIdRef = useRef(0);
  const usedPropertyKeysRef = useRef(usedPropertyKeys);
  const { recommended, handleRefresh: refreshRecommendedFilters } = useRecommendedFilters();

  useEffect(() => {
    searchPropertiesRef.current = api.search.searchProperties;
    setSnackbarRef.current = dialogContext.setSnackbar;
  });

  useEffect(() => {
    usedPropertyKeysRef.current = usedPropertyKeys;
  }, [usedPropertyKeys]);

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
        .slice(0, MAX_NUMBER_SEARCH_SUGGESTIONS_PER_CATEGORY),
    [recommended.properties, usedPropertyKeys]
  );
  const suggestedSpecies = useMemo(
    () => recommended.species.slice(0, MAX_NUMBER_SEARCH_SUGGESTIONS_PER_CATEGORY),
    [recommended.species]
  );

  /**
   * Lazily resolves the species predicate property when a species chip is used.
   *
   * This loader is deliberately separate from recommendation refreshes. The
   * builder can show species suggestions without immediately requiring the
   * `taxon_id` property; the fallback property lookup only runs if the user
   * clicks a species chip and the existing local metadata caches do not already
   * contain the normalized `taxon` property. `useDataLoader.load()` caches both
   * found and missing results for the mounted popper, so repeated clicks do not
   * repeat the same property-search request.
   */
  const speciesPredicatePropertyLoader = useDataLoader(
    async () => {
      if (!enabled) {
        return null;
      }

      const response = await searchPropertiesRef.current({ keyword: 'taxon_id' }, { page: 1, limit: 25 });

      return findSpeciesPredicateProperty(
        Object.values(response.properties).flat().map(mapSearchPropertyToExpressionBuilderProperty)
      );
    },
    (error) => {
      setSnackbarRef.current({
        open: true,
        snackbarMessage: `Failed to load taxon property: ${(error as Error).message}`
      });
    }
  );

  /**
   * Loads property-picker options for a specific search term.
   *
   * Each call receives the lookup id that was current when the request was
   * started. Responses whose id no longer matches
   * `activePropertyOptionsLookupIdRef` are ignored so slower, older property
   * searches cannot overwrite the latest picker options or show stale error
   * snackbars after the user has typed a newer term.
   *
   * @param {string} keyword Trimmed keyword used to filter property-search results.
   * @param {number} lookupId Monotonic request id used to discard stale responses.
   */
  const loadPropertyOptions = useCallback(
    async (keyword: string, lookupId: number) => {
      if (!enabled) {
        return;
      }

      try {
        const usedPropertyKeysSnapshot = usedPropertyKeysRef.current;
        const shouldHydrateMissingUsedProperties = keyword.length === 0 && usedPropertyKeysSnapshot.size > 0;
        const collectedPropertiesByKey = new Map<string, ExpressionBuilderProperty>();
        let page = 1;
        let lastPage = 1;
        let pagesFetched = 0;

        do {
          const response = await searchPropertiesRef.current(keyword ? { keyword } : {}, {
            page,
            limit: PROPERTY_SEARCH_DEFAULT_LIMIT
          });
          const mappedProperties = Object.values(response.properties)
            .flat()
            .map(mapSearchPropertyToExpressionBuilderProperty);

          mappedProperties.forEach((property) => {
            collectedPropertiesByKey.set(getExpressionBuilderPropertyKeyFromProperty(property), property);
          });

          pagesFetched += 1;
          lastPage = response.pagination.last_page;
          page += 1;

          if (!shouldHydrateMissingUsedProperties) {
            break;
          }

          const missingUsedPropertyCount = Array.from(usedPropertyKeysSnapshot).filter(
            (key) => !collectedPropertiesByKey.has(key)
          ).length;

          if (missingUsedPropertyCount === 0) {
            break;
          }
        } while (page <= lastPage && pagesFetched < PROPERTY_SEARCH_HYDRATION_MAX_PAGES);

        const nextProperties = Array.from(collectedPropertiesByKey.values());

        if (lookupId === activePropertyOptionsLookupIdRef.current) {
          setPropertyOptions(nextProperties);
        }
      } catch (error) {
        if (lookupId === activePropertyOptionsLookupIdRef.current) {
          setSnackbarRef.current({
            open: true,
            snackbarMessage: `Failed to load properties: ${(error as Error).message}`
          });
        }
      }
    },
    [enabled]
  );

  /**
   * Debounced wrapper around property-picker option loading.
   *
   * Picker inputs can fire on each keystroke. Debouncing keeps the property
   * search endpoint from receiving one request per character while preserving the
   * latest lookup id so stale responses are still filtered by `loadPropertyOptions`.
   */
  const debouncedLoadPropertyOptions = useDebounce(async (keyword: string, lookupId: number) => {
    await loadPropertyOptions(keyword, lookupId);
  }, 300);

  /**
   * Schedules a property-option refresh for autocomplete controls.
   *
   * Child predicate tokens call this when the property search text changes. The
   * handler normalizes whitespace, advances the active lookup id, and delegates
   * to the debounced loader so only the latest settled input updates
   * `propertyOptions`.
   *
   * @param {string} keyword Raw property search text from a picker input.
   */
  const refreshPropertyOptions = useCallback(
    (keyword = '') => {
      if (!enabled) {
        return;
      }

      const lookupId = ++activePropertyOptionsLookupIdRef.current;
      debouncedLoadPropertyOptions(keyword.trim(), lookupId);
    },
    [debouncedLoadPropertyOptions, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const lookupId = ++activePropertyOptionsLookupIdRef.current;
    const loadInitialPropertyOptions = async () => {
      await loadPropertyOptions('', lookupId);
    };

    loadInitialPropertyOptions();

    return () => debouncedLoadPropertyOptions.cancel();
  }, [debouncedLoadPropertyOptions, enabled, loadPropertyOptions]);

  // Recommendation requests are keyed by the debounced search term from the parent.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const keyword = recommendedSearchTerm?.trim();

    if (!keyword) {
      lastRecommendedSearchTermRef.current = null;
      return;
    }

    if (keyword === lastRecommendedSearchTermRef.current) {
      return;
    }

    lastRecommendedSearchTermRef.current = keyword;

    refreshRecommendedFilters({
      species: keyword,
      properties: {
        filters: { keyword },
        pagination: { page: 1, limit: 25 }
      }
    });
  }, [enabled, recommendedSearchTerm, refreshRecommendedFilters]);

  /**
   * Loads the normalized `taxon_id` property used to convert species suggestion chips into predicates.
   *
   * The normal property option or recommendation searches may already include
   * the `taxon_id` property; when they do, this returns the cached property
   * without making another API call. Otherwise, it uses the lazy
   * `speciesPredicatePropertyLoader`, whose `useDataLoader.load()` cache ensures
   * the fallback lookup is performed at most once for the mounted builder popper.
   * A property found through the fallback path is added to the selected-property
   * cache so the inserted predicate can continue rendering even if option and
   * recommendation lists later change.
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

    const property = await speciesPredicatePropertyLoader.load();

    if (property) {
      handlePropertySelected(property);
    }

    return property ?? null;
  }, [enabled, findSpeciesPredicateProperty, handlePropertySelected, knownProperties, speciesPredicatePropertyLoader]);

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
