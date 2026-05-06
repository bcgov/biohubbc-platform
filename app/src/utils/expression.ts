import {
  BuilderClauseNode,
  BuilderExpressionNode,
  BuilderPredicateDraft,
  BuilderPredicateNode,
  BuilderValidation,
  ExpressionBuilderProperty
} from 'components/expression-builder/ExpressionBuilder.interface';
import { MAX_EXPRESSION_BUILDER_NESTED_GROUP_DEPTH } from 'constants/expression';
import {
  ExpressionTreeExpression,
  ExpressionTreeClause,
  ExpressionLogicalOperator,
  ExpressionPredicateOperator,
  ExpressionPropertyType
} from 'interfaces/expression.interface';
import { SearchPropertyResult } from 'interfaces/useSearchApi.interface';

/**
 * Builds the canonical key for feature-property metadata.
 *
 * Use this when matching API predicates to builder properties because a
 * property identity is the pair of `feature_property_id` and nullable
 * `feature_type_property_id`.
 *
 * @param {number} featurePropertyId - Feature property identifier from the API.
 * @param {number | null} featureTypePropertyId - Feature type property identifier, or null for global properties.
 * @returns {string} Stable property key in `feature_property_id:feature_type_property_id` form.
 */
export const getExpressionBuilderPropertyKey = (
  featurePropertyId: number,
  featureTypePropertyId: number | null
): string => `${featurePropertyId}:${featureTypePropertyId ?? ''}`;

/**
 * Builds the canonical key for expression-builder property metadata.
 *
 * @param {Pick<ExpressionBuilderProperty, 'feature_property_id' | 'feature_type_property_id'>} property - Property metadata to identify.
 * @returns {string} Stable property key in `feature_property_id:feature_type_property_id` form.
 */
export const getExpressionBuilderPropertyKeyFromProperty = (
  property: Pick<ExpressionBuilderProperty, 'feature_property_id' | 'feature_type_property_id'>
): string => getExpressionBuilderPropertyKey(property.feature_property_id, property.feature_type_property_id);

/**
 * Indexes builder property metadata by canonical API identity.
 *
 * Use this during hydration to recover the predicate type for serialized API
 * predicates. Predicate type is required to rebuild editable datetime values,
 * but it is not included directly on each serialized predicate clause.
 *
 * @param {ExpressionBuilderProperty[]} properties - Loaded builder property metadata.
 * @returns {Map<string, ExpressionPropertyType>} Predicate type lookup keyed by canonical property key.
 */
const getPropertyTypeById = (properties: ExpressionBuilderProperty[]): Map<string, ExpressionPropertyType> => {
  const propertyTypes = new Map<string, ExpressionPropertyType>();

  for (const property of properties) {
    propertyTypes.set(
      getExpressionBuilderPropertyKey(property.feature_property_id, property.feature_type_property_id),
      property.predicate_type
    );
  }

  return propertyTypes;
};

/**
 * Converts an editable datetime draft into the scalar value accepted by the API.
 *
 * Date and time controls are stored separately while editing. Serialization
 * combines both values with `T`, or returns whichever single value is present.
 * Empty drafts serialize as undefined so validation can reject them before API
 * submission.
 *
 * @param {unknown} value - Editable datetime draft value from a predicate.
 * @returns {string | undefined} API datetime string, time string, date string, or undefined for an empty draft.
 */
const datetimeObjectToString = (value: unknown): string | undefined => {
  let date = '';
  let time = '';

  if (typeof value === 'object' && value !== null) {
    if ('date_value' in value && typeof value.date_value === 'string') {
      date = value.date_value.trim();
    }

    if ('time_value' in value && typeof value.time_value === 'string') {
      time = value.time_value.trim();
    }
  }

  if (date && time) {
    return `${date}T${time}`;
  }

  return date || time || undefined;
};

/**
 * Converts a serialized API datetime value into the builder's editable draft shape.
 *
 * Values containing `T` are split into date and time fields. Date-only strings
 * populate `date_value`; all other non-empty strings are treated as time values
 * so existing API values remain editable even when they are not full datetimes.
 *
 * @param {unknown} value - API predicate value to hydrate.
 * @returns {{ date_value?: string; time_value?: string } | undefined} Editable datetime draft, or undefined for empty input.
 */
const datetimeStringToObject = (value: unknown): { date_value?: string; time_value?: string } | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const trimmedValue = value.trim();
  const [date, time] = trimmedValue.split('T');

  if (date && time) {
    return { date_value: date, time_value: time };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return { date_value: trimmedValue };
  }

  return { time_value: trimmedValue };
};

/**
 * Maps a search-property API result into the property metadata shape consumed by
 * expression-builder controls.
 *
 * Use this at every boundary where `/api/search/property` results enter the
 * builder, including property autocomplete results and recommended property
 * suggestions. It preserves the API identifiers and allowed operator list, and
 * sets `feature_type_property_id` to `null` because property search results are
 * global feature-property matches.
 *
 * @param {SearchPropertyResult} property - One property result from the search-property API.
 * @returns {ExpressionBuilderProperty} Builder-ready property metadata for predicate creation.
 */
export const mapSearchPropertyToExpressionBuilderProperty = (
  property: SearchPropertyResult
): ExpressionBuilderProperty => ({
  feature_property_id: property.feature_property_id,
  feature_type_property_id: null,
  label: property.property_display_name,
  property_name: property.property_name,
  property_display_name: property.property_display_name,
  predicate_type: property.feature_property_type,
  operators: property.operators
});

/**
 * Checks whether a predicate value contains user-entered data.
 *
 * Treats empty strings, null, and undefined as empty, and recursively checks
 * object values used by datetime drafts. This helper is intentionally local to
 * validation and serialization rules; component-only completeness checks live
 * beside their component.
 *
 * @param {unknown} value - Predicate value draft to inspect.
 * @returns {boolean} True when the value contains at least one non-empty value.
 */
export const hasPredicateValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasPredicateValue);
  }

  return true;
};

/**
 * Converts an editable spatial predicate value into a GeoJSON-like object.
 *
 * Use this at validation and serialization boundaries for spatial predicates.
 * The spatial editor may hold a JSON string while the user edits; completed
 * API payloads must send the parsed object. Non-string values are returned
 * unchanged so already-parsed values can pass through without extra work.
 *
 * @param {unknown} value - Spatial predicate value from the editable draft.
 * @returns {unknown} Parsed JSON value, the original non-string value, or undefined for an empty string.
 * @throws {SyntaxError} When a non-empty string is not valid JSON.
 */
const parseSpatialValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return JSON.parse(trimmedValue);
};

/**
 * Checks whether a value has the minimum shape expected from GeoJSON.
 *
 * Use this after parsing a spatial predicate value. It intentionally performs a
 * lightweight structural check instead of full GeoJSON validation because the
 * frontend only needs to reject clearly invalid values before sending the
 * expression to the API.
 *
 * @param {unknown} value - Candidate parsed spatial predicate value.
 * @returns {value is { type: string }} True when the value is an object with a string `type` field.
 */
const isGeoJsonLikeObject = (value: unknown): value is { type: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { type?: unknown }).type === 'string';

/**
 * Creates an empty builder expression group.
 *
 * Use this when initializing root or nested expression groups. The generated UI
 * id is local to the builder and is not serialized to the backend expression
 * tree.
 *
 * @param {ExpressionLogicalOperator} [operator='AND'] - Logical operator for the new expression group.
 * @returns {BuilderExpressionNode} Empty expression group with a local UI id.
 */
export const createBuilderExpressionNode = (operator: ExpressionLogicalOperator = 'AND'): BuilderExpressionNode => ({
  ui_id: crypto.randomUUID(),
  type: 'expression',
  operator,
  clauses: []
});

/**
 * Creates the default root expression shown by an empty expression builder.
 *
 * The initial builder state must contain one empty predicate row so users can
 * immediately select a property without first adding a filter.
 *
 * @returns {BuilderExpressionNode} Root expression node with one empty predicate placeholder.
 */
export const createInitialBuilderExpressionNode = (): BuilderExpressionNode => ({
  ...createBuilderExpressionNode(),
  clauses: [createBuilderPredicateNode()]
});

/**
 * Converts an API expression tree into editable builder nodes with an existing property-type lookup.
 *
 * Use this as the recursive hydration worker so the property metadata map is
 * built once by the public entry point instead of being rebuilt for every
 * predicate clause.
 *
 * @param {ExpressionTreeExpression} expression - Backend expression tree to make editable.
 * @param {Map<string, ExpressionPropertyType>} propertyTypesById - Predicate type lookup keyed by canonical property key.
 * @returns {BuilderExpressionNode} Editable builder expression node tree.
 */
const hydrateBuilderExpressionNodeWithPropertyTypes = (
  expression: ExpressionTreeExpression,
  propertyTypesById: Map<string, ExpressionPropertyType>
): BuilderExpressionNode => ({
  ui_id: crypto.randomUUID(),
  type: 'expression',
  operator: expression.operator,
  clauses: expression.clauses.map((clause): BuilderClauseNode => {
    if (clause.type === 'expression') {
      return hydrateBuilderExpressionNodeWithPropertyTypes(clause, propertyTypesById);
    }

    const predicateType = propertyTypesById.get(
      getExpressionBuilderPropertyKey(clause.feature_property_id, clause.feature_type_property_id)
    );

    return {
      ui_id: crypto.randomUUID(),
      type: 'predicate',
      feature_property_id: clause.feature_property_id,
      feature_type_property_id: clause.feature_type_property_id,
      predicate: predicateType
        ? {
            type: predicateType,
            operator: clause.operator,
            value: predicateType === 'datetime' ? datetimeStringToObject(clause.value) : clause.value
          }
        : null
    };
  })
});

/**
 * Converts an API expression tree into editable builder nodes.
 *
 * Use this when the builder receives a controlled `ExpressionTreeExpression` value. It
 * adds local UI ids, recursively hydrates nested groups, and uses known
 * property metadata to recover predicate draft types and datetime edit objects.
 *
 * @param {ExpressionTreeExpression} expression - Backend expression tree to make editable.
 * @param {ExpressionBuilderProperty[]} [properties] - Loaded property metadata used to recover predicate types.
 * @returns {BuilderExpressionNode} Editable builder expression node tree.
 */
export const hydrateBuilderExpressionNode = (
  expression: ExpressionTreeExpression,
  properties: ExpressionBuilderProperty[] = []
): BuilderExpressionNode => hydrateBuilderExpressionNodeWithPropertyTypes(expression, getPropertyTypeById(properties));

/**
 * Creates an empty predicate placeholder row.
 *
 * Use this whenever the UI needs a blank filter row. The returned node has no
 * selected property or predicate draft, so applying the expression remains
 * invalid until the user selects a property and completes the predicate.
 *
 * @returns {BuilderPredicateNode} Empty predicate placeholder with a local UI id.
 */
export const createBuilderPredicateNode = (): BuilderPredicateNode => ({
  ui_id: crypto.randomUUID(),
  type: 'predicate',
  feature_property_id: null,
  feature_type_property_id: null,
  predicate: null
});

/**
 * Collects property identities already selected anywhere in a builder tree.
 *
 * Use this to filter recommendation chips and autocomplete options that should
 * not be offered again while the same property is already present in the draft.
 *
 * @param {BuilderExpressionNode} expression - Root or nested builder expression node to inspect.
 * @returns {Set<string>} Canonical property keys for every selected predicate in the tree.
 */
export const getUsedExpressionBuilderPropertyKeys = (expression: BuilderExpressionNode): Set<string> => {
  const keys = new Set<string>();

  const visitClause = (clause: BuilderClauseNode) => {
    if (clause.type === 'expression') {
      clause.clauses.forEach(visitClause);
      return;
    }

    if (clause.feature_property_id !== null) {
      keys.add(getExpressionBuilderPropertyKey(clause.feature_property_id, clause.feature_type_property_id));
    }
  };

  expression.clauses.forEach(visitClause);
  return keys;
};

/**
 * Chooses the initial operator for a property after it is selected.
 *
 * String filters are normally used as text search predicates, so prefer a contains-like operator over exact equality.
 * Other property types keep exact equality when available. When neither preferred operator exists, fall back to the
 * first non-Exists operator so the user can start entering a value immediately.
 * If the property only supports `Exists`, use `Exists` and omit the draft value.
 *
 * @param {ExpressionBuilderProperty} property - Property metadata from the search-property API.
 * @returns {ExpressionPredicateOperator | null} Initial editable operator, or null when the property exposes no operators.
 */
export const getDefaultOperatorForExpressionBuilderProperty = (
  property: ExpressionBuilderProperty
): ExpressionPredicateOperator | null => {
  const preferredOperators: ExpressionPredicateOperator[] =
    property.predicate_type === 'string' ? ['Contains', 'ILike', 'Equals'] : ['Equals'];

  for (const operator of preferredOperators) {
    if (property.operators.includes(operator)) {
      return operator;
    }
  }

  return property.operators.find((operator) => operator !== 'Exists') ?? property.operators[0] ?? null;
};

/**
 * Creates the initial editable predicate draft for a property.
 *
 * Use this after property selection. The default operator is selected by
 * `getDefaultOperatorForExpressionBuilderProperty`, and value-bearing
 * operators start with a type-appropriate empty value. `Exists` predicates
 * omit value because the API treats existence as the complete condition.
 *
 * @param {ExpressionBuilderProperty} property - Property metadata used to initialize the draft.
 * @returns {BuilderPredicateDraft} Editable predicate draft for the property.
 */
export const createPredicateDraft = (property: ExpressionBuilderProperty): BuilderPredicateDraft => {
  const operator = getDefaultOperatorForExpressionBuilderProperty(property);

  return {
    type: property.predicate_type,
    operator,
    value: operator && operator !== 'Exists' ? getDefaultValueForPredicateType(property.predicate_type) : undefined
  };
};

/**
 * Returns the editable default value for a predicate type.
 *
 * Use this when creating a new predicate draft. The defaults are UI edit-state
 * values, not necessarily serialized API values.
 *
 * @param {ExpressionPropertyType} type - Predicate value type from property metadata.
 * @returns {unknown} Default editable value for that predicate type.
 */
export const getDefaultValueForPredicateType = (type: ExpressionPropertyType): unknown => {
  switch (type) {
    case 'string':
      return '';
    case 'number':
    case 'taxon':
    case 'code':
      return '';
    case 'boolean':
      return undefined;
    case 'datetime':
      return { date_value: '' };
    case 'spatial':
      return undefined;
  }
};

/**
 * Updates the logical operator for a group by UI id.
 *
 * Use this from group operator controls. The function walks the nested builder
 * tree immutably and returns the original structure except for the matching
 * expression group's `AND`/`OR` operator.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} groupId - UI id of the expression group to update.
 * @param {ExpressionLogicalOperator} operator - Next logical operator for the group.
 * @returns {BuilderExpressionNode} Updated expression tree.
 */
export const setGroupOperator = (
  node: BuilderExpressionNode,
  groupId: string,
  operator: ExpressionLogicalOperator
): BuilderExpressionNode => {
  if (node.ui_id === groupId) {
    return { ...node, operator };
  }

  let changed = false;
  const clauses = node.clauses.map((clause) => {
    if (clause.type !== 'expression') {
      return clause;
    }

    const nextClause = setGroupOperator(clause, groupId, operator);
    changed ||= nextClause !== clause;
    return nextClause;
  });

  if (!changed) {
    return node;
  }

  return {
    ...node,
    clauses
  };
};

/**
 * Appends a clause to a target expression group.
 *
 * Use this when adding predicates or moving clauses into a group. The target is
 * matched by builder UI id and the tree is updated immutably.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} groupId - UI id of the expression group that receives the clause.
 * @param {BuilderClauseNode} clauseToAppend - Predicate or expression clause to append.
 * @returns {BuilderExpressionNode} Updated expression tree.
 */
export const appendClauseToGroup = (
  node: BuilderExpressionNode,
  groupId: string,
  clauseToAppend: BuilderClauseNode
): BuilderExpressionNode => {
  if (node.ui_id === groupId) {
    return { ...node, clauses: [...node.clauses, clauseToAppend] };
  }

  let changed = false;
  const clauses = node.clauses.map((clause) => {
    if (clause.type !== 'expression') {
      return clause;
    }

    const nextClause = appendClauseToGroup(clause, groupId, clauseToAppend);
    changed ||= nextClause !== clause;
    return nextClause;
  });

  if (!changed) {
    return node;
  }

  return {
    ...node,
    clauses
  };
};

/**
 * Removes a clause from any depth of the builder tree.
 *
 * Use this as the low-level removal helper when the caller wants to delete a
 * predicate or nested group by UI id without additionally normalizing empty
 * groups.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} clauseId - UI id of the predicate or expression group to remove.
 * @returns {BuilderExpressionNode} Expression tree with the matching clause removed.
 */
const removeClauseById = (node: BuilderExpressionNode, clauseId: string): BuilderExpressionNode => {
  let changed = false;
  const clauses: BuilderClauseNode[] = [];

  for (const clause of node.clauses) {
    if (clause.ui_id === clauseId) {
      changed = true;
      continue;
    }

    if (clause.type === 'expression') {
      const nextClause = removeClauseById(clause, clauseId);
      changed ||= nextClause !== clause;
      clauses.push(nextClause);
      continue;
    }

    clauses.push(clause);
  }

  if (!changed) {
    return node;
  }

  return { ...node, clauses };
};

/**
 * Removes empty nested expression groups from a builder tree.
 *
 * Use this after moves or deletes that may leave child groups without clauses.
 * The root node passed to the function is preserved even if it is empty; only
 * nested expression clauses are pruned.
 *
 * @param {BuilderExpressionNode} node - Expression node to normalize.
 * @returns {BuilderExpressionNode} Expression node with empty nested groups removed.
 */
const removeEmptyExpressionGroups = (node: BuilderExpressionNode): BuilderExpressionNode => {
  let changed = false;
  const clauses = node.clauses.flatMap((clause): BuilderClauseNode[] => {
    if (clause.type === 'predicate') {
      return [clause];
    }

    const normalizedExpression = removeEmptyExpressionGroups(clause);
    changed ||= normalizedExpression !== clause;

    if (normalizedExpression.clauses.length === 0) {
      changed = true;
      return [];
    }

    return [normalizedExpression];
  });

  if (!changed) {
    return node;
  }

  return { ...node, clauses };
};

/**
 * Removes a clause and prunes any empty groups left behind.
 *
 * Use this for normal UI remove actions so deleting the last child of a nested
 * group does not leave an empty group token in the builder.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} clauseId - UI id of the predicate or expression group to remove.
 * @returns {BuilderExpressionNode} Expression tree with the clause removed and empty groups pruned.
 */
export const removeClauseAndNormalize = (node: BuilderExpressionNode, clauseId: string): BuilderExpressionNode =>
  removeEmptyExpressionGroups(removeClauseById(node, clauseId));

/**
 * Finds a predicate node anywhere in a builder expression tree.
 *
 * Use this before drag-and-drop moves that need to preserve the exact dragged
 * predicate node while removing it from its original location.
 *
 * @param {BuilderExpressionNode} node - Root expression node to search.
 * @param {string} predicateId - UI id of the predicate to find.
 * @returns {BuilderPredicateNode | null} Matching predicate node, or null when not found.
 */
const findPredicateById = (node: BuilderExpressionNode, predicateId: string): BuilderPredicateNode | null => {
  for (const clause of node.clauses) {
    if (clause.type === 'predicate' && clause.ui_id === predicateId) {
      return clause;
    }

    if (clause.type === 'expression') {
      const nestedPredicate = findPredicateById(clause, predicateId);
      if (nestedPredicate) {
        return nestedPredicate;
      }
    }
  }

  return null;
};

/**
 * Finds an expression group anywhere in a builder expression tree.
 *
 * Use this for group drag-and-drop before moving the found group to a new
 * parent expression.
 *
 * @param {BuilderExpressionNode} node - Root expression node to search.
 * @param {string} expressionId - UI id of the expression group to find.
 * @returns {BuilderExpressionNode | null} Matching expression group, or null when not found.
 */
const findExpressionById = (node: BuilderExpressionNode, expressionId: string): BuilderExpressionNode | null => {
  if (node.ui_id === expressionId) {
    return node;
  }

  for (const clause of node.clauses) {
    if (clause.type === 'expression') {
      const nestedExpression = findExpressionById(clause, expressionId);
      if (nestedExpression) {
        return nestedExpression;
      }
    }
  }

  return null;
};

/**
 * Checks whether an expression group contains another expression group.
 *
 * Use this to prevent moving a group into one of its own descendants, which
 * would create a cyclic logical tree in the builder state.
 *
 * @param {BuilderExpressionNode} node - Expression group to inspect.
 * @param {string} expressionId - UI id of the possible descendant group.
 * @returns {boolean} True when the target expression id exists below the node.
 */
const expressionContainsExpression = (node: BuilderExpressionNode, expressionId: string): boolean =>
  node.clauses.some((clause) => {
    if (clause.type !== 'expression') {
      return false;
    }

    return clause.ui_id === expressionId || expressionContainsExpression(clause, expressionId);
  });

/**
 * Finds the nesting depth of an expression group by UI id.
 *
 * The root expression has depth 0. Each expression group nested below root adds
 * one level. Use this before drag/drop group moves that may exceed the
 * frontend-only nesting cap.
 *
 * @param {BuilderExpressionNode} node - Expression node to search.
 * @param {string} expressionId - UI id of the expression group to find.
 * @param {number} [depth=0] - Current recursive expression depth.
 * @returns {number | null} Nesting depth for the expression group, or null when not found.
 */
const getExpressionDepthById = (node: BuilderExpressionNode, expressionId: string, depth = 0): number | null => {
  if (node.ui_id === expressionId) {
    return depth;
  }

  for (const clause of node.clauses) {
    if (clause.type !== 'expression') {
      continue;
    }

    const nestedDepth = getExpressionDepthById(clause, expressionId, depth + 1);
    if (nestedDepth !== null) {
      return nestedDepth;
    }
  }

  return null;
};

/**
 * Finds the parent expression depth for a predicate by UI id.
 *
 * Use this before predicate-on-predicate grouping because that operation creates
 * a new expression group at the target predicate's parent depth plus one.
 *
 * @param {BuilderExpressionNode} node - Expression node to search.
 * @param {string} predicateId - UI id of the predicate to find.
 * @param {number} [depth=0] - Current recursive expression depth.
 * @returns {number | null} Parent expression depth for the predicate, or null when not found.
 */
const getPredicateParentExpressionDepth = (
  node: BuilderExpressionNode,
  predicateId: string,
  depth = 0
): number | null => {
  for (const clause of node.clauses) {
    if (clause.type === 'predicate') {
      if (clause.ui_id === predicateId) {
        return depth;
      }

      continue;
    }

    const nestedDepth = getPredicateParentExpressionDepth(clause, predicateId, depth + 1);
    if (nestedDepth !== null) {
      return nestedDepth;
    }
  }

  return null;
};

/**
 * Finds the deepest nested expression depth inside an expression subtree.
 *
 * The provided expression is depth 0 relative to itself. Use this when moving a
 * whole group because the group's existing descendants must fit under the
 * target group without exceeding the max nested depth.
 *
 * @param {BuilderExpressionNode} node - Expression subtree to inspect.
 * @param {number} [depth=0] - Current relative expression depth.
 * @returns {number} Deepest relative expression depth inside the subtree.
 */
const getMaxRelativeExpressionDepth = (node: BuilderExpressionNode, depth = 0): number =>
  node.clauses.reduce((maxDepth, clause) => {
    if (clause.type !== 'expression') {
      return maxDepth;
    }

    return Math.max(maxDepth, getMaxRelativeExpressionDepth(clause, depth + 1));
  }, depth);

/**
 * Replaces one predicate with a new expression group containing two predicates.
 *
 * Use this after the dragged predicate has already been removed from its source
 * location. The target predicate remains in place and becomes the first child
 * of the generated `AND` group, followed by the dragged predicate.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} targetPredicateId - UI id of the predicate receiving the drop.
 * @param {BuilderPredicateNode} draggedPredicate - Predicate node being grouped with the target.
 * @returns {BuilderExpressionNode} Updated expression tree with the target predicate replaced by a group.
 */
const replacePredicateWithGroup = (
  node: BuilderExpressionNode,
  targetPredicateId: string,
  draggedPredicate: BuilderPredicateNode
): BuilderExpressionNode => {
  let changed = false;
  const clauses = node.clauses.map((clause) => {
    if (clause.type === 'predicate' && clause.ui_id === targetPredicateId) {
      changed = true;
      const expression: BuilderExpressionNode = {
        ui_id: crypto.randomUUID(),
        type: 'expression',
        operator: 'AND',
        clauses: [clause, draggedPredicate]
      };

      return expression;
    }

    if (clause.type === 'expression') {
      const nextClause = replacePredicateWithGroup(clause, targetPredicateId, draggedPredicate);
      changed ||= nextClause !== clause;
      return nextClause;
    }

    return clause;
  });

  if (!changed) {
    return node;
  }

  return { ...node, clauses };
};

/**
 * Groups two predicate clauses into a new nested expression.
 *
 * Use this for drag-and-drop when one predicate is dropped onto another. The
 * dragged predicate is removed from its original position and paired with the
 * target predicate inside a new `AND` group at the target location.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} draggedPredicateId - UI id of the predicate being dragged.
 * @param {string} targetPredicateId - UI id of the predicate receiving the drop.
 * @returns {BuilderExpressionNode} Expression tree with the two predicates grouped.
 */
export const groupPredicateWithPredicate = (
  node: BuilderExpressionNode,
  draggedPredicateId: string,
  targetPredicateId: string
): BuilderExpressionNode => {
  if (draggedPredicateId === targetPredicateId) {
    return node;
  }

  const draggedPredicate = findPredicateById(node, draggedPredicateId);
  const targetPredicate = findPredicateById(node, targetPredicateId);
  const targetParentDepth = getPredicateParentExpressionDepth(node, targetPredicateId);

  if (
    !draggedPredicate ||
    !targetPredicate ||
    targetParentDepth === null ||
    targetParentDepth + 1 > MAX_EXPRESSION_BUILDER_NESTED_GROUP_DEPTH
  ) {
    return node;
  }

  const rootWithoutDraggedPredicate = removeClauseById(node, draggedPredicateId);
  return removeEmptyExpressionGroups(
    replacePredicateWithGroup(rootWithoutDraggedPredicate, targetPredicateId, draggedPredicate)
  );
};

/**
 * Moves a predicate into an existing expression group.
 *
 * Use this for drag-and-drop when a predicate is dropped on a group surface.
 * Empty source groups are pruned after the move.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} predicateId - UI id of the predicate being moved.
 * @param {string} targetGroupId - UI id of the expression group receiving the predicate.
 * @returns {BuilderExpressionNode} Expression tree with the predicate moved into the group.
 */
export const movePredicateToExpressionGroup = (
  node: BuilderExpressionNode,
  predicateId: string,
  targetGroupId: string
): BuilderExpressionNode => {
  const predicate = findPredicateById(node, predicateId);
  if (!predicate) {
    return node;
  }

  const rootWithoutPredicate = removeClauseById(node, predicateId);
  return removeEmptyExpressionGroups(appendClauseToGroup(rootWithoutPredicate, targetGroupId, predicate));
};

/**
 * Moves a nested expression group into another expression group.
 *
 * Use this for group drag-and-drop. The function refuses to move the root group,
 * move a group into itself, or move a group into one of its descendants.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} expressionId - UI id of the expression group being moved.
 * @param {string} targetGroupId - UI id of the expression group receiving the moved group.
 * @returns {BuilderExpressionNode} Expression tree with the group moved, or unchanged when the move is invalid.
 */
export const moveExpressionToExpressionGroup = (
  node: BuilderExpressionNode,
  expressionId: string,
  targetGroupId: string
): BuilderExpressionNode => {
  if (expressionId === node.ui_id || expressionId === targetGroupId) {
    return node;
  }

  const expression = findExpressionById(node, expressionId);
  if (!expression || expressionContainsExpression(expression, targetGroupId)) {
    return node;
  }

  const targetDepth = getExpressionDepthById(node, targetGroupId);
  if (
    targetDepth === null ||
    targetDepth + 1 + getMaxRelativeExpressionDepth(expression) > MAX_EXPRESSION_BUILDER_NESTED_GROUP_DEPTH
  ) {
    return node;
  }

  const rootWithoutExpression = removeClauseById(node, expressionId);
  return removeEmptyExpressionGroups(appendClauseToGroup(rootWithoutExpression, targetGroupId, expression));
};

/**
 * Updates a predicate node by UI id.
 *
 * Use this as the shared immutable tree update helper for property, operator,
 * and value edits. The caller supplies the predicate-specific updater while
 * this function handles recursive traversal.
 *
 * @param {BuilderExpressionNode} node - Root expression node to update.
 * @param {string} predicateId - UI id of the predicate to update.
 * @param {(predicate: BuilderPredicateNode) => BuilderPredicateNode} updater - Function that returns the updated predicate.
 * @returns {BuilderExpressionNode} Expression tree with the predicate update applied.
 */
export const updatePredicateNode = (
  node: BuilderExpressionNode,
  predicateId: string,
  updater: (predicate: BuilderPredicateNode) => BuilderPredicateNode
): BuilderExpressionNode => {
  let changed = false;
  const clauses = node.clauses.map((clause) => {
    if (clause.type === 'predicate') {
      if (clause.ui_id !== predicateId) {
        return clause;
      }

      const nextClause = updater(clause);
      changed ||= nextClause !== clause;
      return nextClause;
    }

    const nextClause = updatePredicateNode(clause, predicateId, updater);
    changed ||= nextClause !== clause;
    return nextClause;
  });

  if (!changed) {
    return node;
  }

  return { ...node, clauses };
};

/**
 * Validates that a predicate has the required selected property and draft operator.
 *
 * Use this as the first predicate validation step because later checks require
 * a concrete draft and operator. Missing property metadata is reported as an
 * error but does not prevent operator validation, so incomplete rows can show
 * all immediately actionable messages.
 *
 * @param {BuilderPredicateNode} node - Predicate node to inspect.
 * @param {string} path - Human-readable location used as the validation error prefix.
 * @returns {{ errors: string[]; draft: BuilderPredicateDraft | null }} Missing selection errors and the usable draft, if present.
 */
const validatePredicateSelection = (
  node: BuilderPredicateNode,
  path: string
): { errors: string[]; draft: BuilderPredicateDraft | null } => {
  const errors: string[] = [];

  if (node.feature_property_id === null) {
    errors.push(`${path} must have a property`);
  }

  if (!node.predicate) {
    errors.push(`${path} must have an operator`);
    return { errors, draft: null };
  }

  if (!node.predicate.operator) {
    errors.push(`${path} must have an operator`);
    return { errors, draft: null };
  }

  return { errors, draft: node.predicate };
};

/**
 * Validates `Exists` predicate value semantics.
 *
 * `Exists` is a complete condition by itself and must omit the value field in
 * the serialized API payload. This helper rejects stale draft values that may
 * remain after an operator change.
 *
 * @param {BuilderPredicateDraft} draft - Complete predicate draft whose operator is `Exists`.
 * @param {string} path - Human-readable location used as the validation error prefix.
 * @returns {string[]} Validation errors for the `Exists` draft, or an empty array when valid.
 */
const validateExistsPredicate = (draft: BuilderPredicateDraft, path: string): string[] => {
  if (!hasPredicateValue(draft.value)) {
    return [];
  }

  return [`${path} exists condition must not have a value`];
};

/**
 * Validates datetime predicate value rules for each datetime operator.
 *
 * Date and time are edited as separate fields in the builder, but each datetime
 * operator accepts a specific scalar shape during serialization. `OnDate`
 * requires only a date, `OnTime` requires only a time, and `Before`/`After`
 * require at least one temporal part.
 *
 * @param {BuilderPredicateDraft} draft - Datetime predicate draft to validate.
 * @param {string} path - Human-readable location used as the validation error prefix.
 * @returns {string[]} Datetime validation errors, or an empty array when valid.
 */
const validateDatetimePredicate = (draft: BuilderPredicateDraft, path: string): string[] => {
  const errors: string[] = [];
  const value = draft.value;
  const hasDate =
    typeof value === 'object' && value !== null && 'date_value' in value && hasPredicateValue(value.date_value);
  const hasTime =
    typeof value === 'object' && value !== null && 'time_value' in value && hasPredicateValue(value.time_value);

  if (draft.operator === 'OnDate' && (!hasDate || hasTime)) {
    errors.push(`${path} on date must have only a date value`);
  }

  if (draft.operator === 'OnTime' && (!hasTime || hasDate)) {
    errors.push(`${path} on time must have only a time value`);
  }

  if ((draft.operator === 'Before' || draft.operator === 'After') && !hasDate && !hasTime) {
    errors.push(`${path} must have a date or time value`);
  }

  return errors;
};

/**
 * Checks whether a predicate type serializes through a numeric API value.
 *
 * Number, taxon, and code drafts are edited as text for UI consistency, then
 * converted to numbers during serialization. This helper centralizes that type
 * grouping so validation and serialization rules remain easy to compare.
 *
 * @param {ExpressionPropertyType} predicateType - Editable predicate value type.
 * @returns {boolean} True when the predicate value must be finite numeric text.
 */
const isNumericPredicateType = (predicateType: ExpressionPropertyType): boolean =>
  predicateType === 'number' || predicateType === 'taxon' || predicateType === 'code';

/**
 * Validates GeoJSON-like spatial predicate drafts.
 *
 * Spatial values may be held as JSON text while editing. This helper parses the
 * value when needed and rejects malformed JSON or objects that do not contain
 * the minimal GeoJSON `type` field expected by the API.
 *
 * @param {BuilderPredicateDraft} draft - Spatial predicate draft to validate.
 * @param {string} path - Human-readable location used as the validation error prefix.
 * @returns {string[]} Spatial validation errors, or an empty array when valid.
 */
const validateSpatialPredicate = (draft: BuilderPredicateDraft, path: string): string[] => {
  try {
    if (!isGeoJsonLikeObject(parseSpatialValue(draft.value))) {
      return [`${path} must be GeoJSON`];
    }
  } catch {
    return [`${path} must be valid GeoJSON`];
  }

  return [];
};

/**
 * Validates required value and type-specific shape for non-datetime predicates.
 *
 * This helper runs after `Exists` and datetime validation have been handled.
 * It first enforces that value-bearing operators have a user-entered value,
 * then applies spatial JSON validation or numeric coercion checks where those
 * property domains require stronger value shapes.
 *
 * @param {BuilderPredicateDraft} draft - Predicate draft to validate.
 * @param {string} path - Human-readable location used as the validation error prefix.
 * @returns {string[]} Value validation errors, or an empty array when valid.
 */
const validatePredicateValue = (draft: BuilderPredicateDraft, path: string): string[] => {
  if (!hasPredicateValue(draft.value)) {
    return [`${path} must have a value`];
  }

  if (draft.type === 'spatial') {
    return validateSpatialPredicate(draft, path);
  }

  if (isNumericPredicateType(draft.type) && !Number.isFinite(Number(draft.value))) {
    return [`${path} must be a number`];
  }

  return [];
};

/**
 * Validates one predicate node and returns all user-facing validation errors.
 *
 * Checks for selected property metadata, selected operator, illegal `Exists`
 * values, operator-specific datetime requirements, and required non-empty
 * values for scalar predicates.
 *
 * @param {BuilderPredicateNode} node - Predicate node to validate.
 * @param {string} path - Human-readable location used as the validation error prefix.
 * @returns {string[]} Validation messages for the predicate, or an empty array when valid.
 */
const validatePredicate = (node: BuilderPredicateNode, path: string): string[] => {
  const { errors, draft } = validatePredicateSelection(node, path);

  if (!draft) {
    return errors;
  }

  if (draft.operator === 'Exists') {
    return [...errors, ...validateExistsPredicate(draft, path)];
  }

  if (draft.type === 'datetime') {
    return [...errors, ...validateDatetimePredicate(draft, path)];
  }

  return [...errors, ...validatePredicateValue(draft, path)];
};

/**
 * Validates an editable builder expression tree.
 *
 * Use this before emitting or serializing builder state. It returns all
 * currently known validation errors, including empty groups, incomplete
 * predicates, `Exists` value misuse, and datetime operator/value mismatches.
 *
 * @param {BuilderExpressionNode} node - Expression node to validate.
 * @param {string} [path='Group'] - Human-readable path prefix used in validation messages.
 * @returns {BuilderValidation} Validation result with all discovered errors.
 */
export const validateBuilderExpression = (node: BuilderExpressionNode, path = 'Group'): BuilderValidation => {
  const errors: string[] = [];

  if (node.clauses.length === 0) {
    errors.push(`${path} must include at least one condition or group`);
  }

  node.clauses.forEach((clause, index) => {
    const childPath = `${path} item ${index + 1}`;
    if (clause.type === 'expression') {
      errors.push(...validateBuilderExpression(clause, childPath).errors);
      return;
    }

    errors.push(...validatePredicate(clause, childPath));
  });

  return { isValid: errors.length === 0, errors };
};

/**
 * Converts an editable predicate draft value into the serialized API value.
 *
 * `Exists` predicates omit the value field, datetime drafts are converted to
 * scalar strings, and numeric-like predicate types are coerced to numbers to
 * match the search API contract.
 *
 * @param {BuilderPredicateDraft} draft - Complete predicate draft to serialize.
 * @returns {unknown} Serialized predicate value, or undefined when the value field should be omitted.
 * @throws {Error} When called for a draft without an operator.
 */
const serializePredicateValue = (draft: BuilderPredicateDraft): unknown => {
  if (!draft.operator) {
    throw new Error('Cannot serialize predicate without an operator');
  }

  if (draft.operator === 'Exists') {
    return undefined;
  }

  if (draft.type === 'datetime') {
    return datetimeObjectToString(draft.value);
  }

  if (draft.type === 'number' || draft.type === 'taxon' || draft.type === 'code') {
    return Number(draft.value);
  }

  if (draft.type === 'spatial') {
    return parseSpatialValue(draft.value);
  }

  return draft.value;
};

/**
 * Serializes a valid builder tree into the backend expression-tree shape.
 *
 * Use this only after validation passes. It strips all local UI ids, converts
 * datetime edit objects to API strings, coerces numeric/taxon/code values to
 * numbers, and omits value fields for `Exists` predicates.
 *
 * @param {BuilderExpressionNode} node - Valid builder expression tree to serialize.
 * @returns {ExpressionTreeExpression} Backend expression-tree payload.
 * @throws {Error} When the builder tree is invalid or contains an incomplete predicate.
 */
export const serializeExpressionTree = (node: BuilderExpressionNode): ExpressionTreeExpression => {
  const validation = validateBuilderExpression(node);
  if (!validation.isValid) {
    throw new Error(`Cannot serialize invalid expression builder state: ${validation.errors.join('; ')}`);
  }

  return {
    type: 'expression',
    operator: node.operator,
    clauses: node.clauses.map((clause): ExpressionTreeClause => {
      if (clause.type === 'expression') {
        return serializeExpressionTree(clause);
      }

      if (clause.feature_property_id === null || clause.predicate === null) {
        throw new Error('Cannot serialize incomplete condition');
      }

      if (!clause.predicate.operator) {
        throw new Error('Cannot serialize condition without an operator');
      }

      const value = serializePredicateValue(clause.predicate) ?? undefined;

      return {
        type: 'predicate',
        feature_property_id: clause.feature_property_id,
        feature_type_property_id: clause.feature_type_property_id,
        operator: clause.predicate.operator,
        value
      };
    })
  };
};
