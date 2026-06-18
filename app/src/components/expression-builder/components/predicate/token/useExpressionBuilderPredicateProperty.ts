import {
  BuilderPredicateNode,
  ExpressionBuilderProperty
} from 'components/expression-builder/ExpressionBuilder.interface';
import { useEffect, useState } from 'react';
import { getExpressionBuilderPropertyKeyFromProperty } from 'utils/expression';

interface UseExpressionBuilderPredicatePropertyParams {
  /** Predicate node whose selected property metadata should be resolved. */
  node: BuilderPredicateNode;
  /** Current property-picker options from the shared remote loader. */
  properties: ExpressionBuilderProperty[];
  /** Stable selected-property cache owned by the expression builder. */
  selectedProperties: ExpressionBuilderProperty[];
}

/**
 * Resolves and caches selected property metadata for a predicate row.
 *
 * Use this hook from predicate token components that render a remote-backed
 * property autocomplete. It prefers the builder-level selected-property cache,
 * falls back to the current remote options, and finally reuses the row-local
 * cache so the selected label and operator metadata remain visible when another
 * row refreshes the shared option list.
 *
 * The returned `propertyOptions` should be passed to the row autocomplete
 * instead of the raw shared options so the selected value is always present in
 * the option list.
 *
 * @param {UseExpressionBuilderPredicatePropertyParams} params - Predicate node, shared property options, and builder selected-property cache.
 * @returns {{ property: ExpressionBuilderProperty | null; propertyOptions: ExpressionBuilderProperty[] }} Resolved selected property and row-specific autocomplete options.
 */
export const useExpressionBuilderPredicateProperty = ({
  node,
  properties,
  selectedProperties
}: UseExpressionBuilderPredicatePropertyParams) => {
  const [cachedSelectedProperty, setCachedSelectedProperty] = useState<ExpressionBuilderProperty | null>(null);

  /**
   * Checks whether candidate metadata matches the property currently selected by this predicate row.
   *
   * Use this before reusing cached row metadata. Predicate nodes only store the
   * selected property identifiers, so this guard prevents the row from showing
   * stale labels or operators after the user changes or clears the selected
   * property.
   *
   * @param {ExpressionBuilderProperty | null} property - Candidate property metadata.
   * @returns {property is ExpressionBuilderProperty} True when the metadata belongs to this predicate row.
   */
  const isSelectedProperty = (property: ExpressionBuilderProperty | null): property is ExpressionBuilderProperty =>
    node.feature_property_id !== null &&
    property?.feature_property_id === node.feature_property_id &&
    property.feature_type_property_id === node.feature_type_property_id;

  /**
   * Finds metadata for the property selected by this predicate row.
   *
   * Use this to resolve row metadata from a candidate collection such as the
   * parent selected-property cache or the current remote autocomplete results.
   *
   * @param {ExpressionBuilderProperty[]} candidateProperties - Candidate property metadata.
   * @returns {ExpressionBuilderProperty | null} Matching property metadata, or null when unavailable.
   */
  const findSelectedProperty = (candidateProperties: ExpressionBuilderProperty[]) =>
    candidateProperties.find(isSelectedProperty) ?? null;

  /**
   * Builds row-specific property autocomplete options.
   *
   * Use this before rendering the property picker so the selected property
   * remains available to MUI Autocomplete even when shared remote results are
   * replaced by another row's search. If the selected property is already
   * present, the shared options array is returned unchanged.
   *
   * @param {ExpressionBuilderProperty | null} selectedProperty - Property selected by this row.
   * @returns {ExpressionBuilderProperty[]} Options with the selected property included.
   */
  const getPropertyOptions = (selectedProperty: ExpressionBuilderProperty | null) => {
    if (!selectedProperty) {
      return properties;
    }

    const selectedPropertyKey = getExpressionBuilderPropertyKeyFromProperty(selectedProperty);

    return properties.some((property) => getExpressionBuilderPropertyKeyFromProperty(property) === selectedPropertyKey)
      ? properties
      : [selectedProperty, ...properties];
  };

  const property =
    findSelectedProperty(selectedProperties) ??
    findSelectedProperty(properties) ??
    (isSelectedProperty(cachedSelectedProperty) ? cachedSelectedProperty : null);

  const propertyOptions = getPropertyOptions(property);

  useEffect(() => {
    setCachedSelectedProperty(property);
  }, [property]);

  return {
    property,
    propertyOptions
  };
};
