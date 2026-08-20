import {
  BuilderPredicateNode,
  ExpressionBuilderProperty
} from 'components/expression-builder/ExpressionBuilder.interface';
import { ExpressionPredicateOperator } from 'interfaces/expression.interface';

export interface ExpressionBuilderPredicateTokenProps {
  /** Predicate node to render and edit. */
  node: BuilderPredicateNode;
  /** Property metadata available to this predicate. */
  properties: ExpressionBuilderProperty[];
  /** Selected property metadata cache, independent of current option results. */
  selectedProperties: ExpressionBuilderProperty[];
  /** Requests a refresh of the parent-owned property options. */
  onPropertySearchInputChange: (keyword: string) => unknown;
  /** Updates this predicate's selected property. */
  onPropertyChange: (
    predicateId: string,
    propertyKey: string | null,
    property?: ExpressionBuilderProperty | null
  ) => unknown;
  /** Updates this predicate's operator. */
  onOperatorChange: (predicateId: string, operator: ExpressionPredicateOperator | null) => unknown;
  /** Updates this predicate's value draft. */
  onValueChange: (predicateId: string, value: unknown) => unknown;
  /** Starts dragging this predicate. */
  onDragStart: (predicateId: string) => unknown;
  /** Clears parent drop state while hovering this predicate. */
  onDragOverPredicate: () => unknown;
  /** Drops the active predicate onto this predicate. */
  onDropOnPredicate: (targetPredicateId: string) => unknown;
  /** Currently dragged predicate UI id, if any. */
  draggedPredicateId: string | null;
  /** Removes this predicate by UI id. */
  onRemove: (predicateId: string) => unknown;
  /** Renders this predicate as a non-editable policy/view surface. */
  readOnly?: boolean;
}

export interface UseExpressionBuilderPredicatePropertyParams {
  /** Predicate node whose selected property metadata should be resolved. */
  node: BuilderPredicateNode;
  /** Current property-picker options from the shared remote loader. */
  properties: ExpressionBuilderProperty[];
  /** Stable selected-property cache owned by the expression builder. */
  selectedProperties: ExpressionBuilderProperty[];
}

export interface ExpressionBuilderPredicateTokenSkeletonProps {
  /** Removes the unresolved predicate row from the parent-owned expression tree. */
  onRemove: () => unknown;
}

export interface ExpressionBuilderPredicateTokenTextProps {
  value: unknown;
  error?: boolean;
  readOnly?: boolean;
  onChange: (value: unknown) => unknown;
}

export interface ExpressionBuilderPredicateTokenBooleanProps {
  value: unknown;
  readOnly?: boolean;
  onChange: (value: boolean | undefined) => unknown;
}

export interface ExpressionBuilderPredicateTokenDateProps {
  operator: ExpressionPredicateOperator | null | undefined;
  value: unknown;
  readOnly?: boolean;
  onChange: (value: unknown) => unknown;
}

export interface ExpressionBuilderPredicateTokenTaxonProps {
  value: unknown;
  error?: boolean;
  readOnly?: boolean;
  onChange: (value: number | undefined) => unknown;
}
