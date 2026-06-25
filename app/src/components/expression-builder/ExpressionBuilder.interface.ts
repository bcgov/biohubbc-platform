import type {
  ExpressionTreeExpression,
  ExpressionTreePredicate,
  ExpressionPropertyType,
  ExpressionPredicateOperator
} from 'interfaces/expression.interface';
import { ReactNode } from 'react';

export interface BuilderExpressionNode extends Omit<ExpressionTreeExpression, 'clauses'> {
  ui_id: string;
  clauses: BuilderClauseNode[];
}

export type BuilderClauseNode = BuilderExpressionNode | BuilderPredicateNode;

export interface BuilderPredicateDraft {
  type: ExpressionPropertyType;
  operator: ExpressionPredicateOperator | null;
  value?: ExpressionTreePredicate['value'];
}

export interface ExpressionBuilderDatetimeValue {
  date_value?: string;
  time_value?: string;
}

export interface ExpressionBuilderSearchOption {
  label: string;
  value: string | number;
}

export interface BuilderPredicateNode {
  ui_id: string;
  type: 'predicate';
  feature_property_id: ExpressionTreePredicate['feature_property_id'] | null;
  feature_type_property_id: ExpressionTreePredicate['feature_type_property_id'];
  predicate: BuilderPredicateDraft | null;
}

export interface ExpressionBuilderProperty {
  feature_property_id: number;
  feature_type_property_id: ExpressionTreePredicate['feature_type_property_id'];
  label: string;
  property_name: string;
  property_display_name: string;
  predicate_type: ExpressionPropertyType;
  operators: ExpressionPredicateOperator[];
}

export interface ExpressionBuilderProps {
  value?: ExpressionTreeExpression;
  recommendedSearchTerm?: string;
  readOnly?: boolean;
  slots?: ExpressionBuilderSlots;
  onChange?: (value: ExpressionTreeExpression | null) => unknown;
  onValidationChange?: (error: string | null) => unknown;
  onApply?: (value: ExpressionTreeExpression | null) => unknown;
}

export interface ExpressionBuilderSlotProps {
  hasSuggestions: boolean;
  suggestedProperties: ExpressionBuilderProperty[];
  suggestedSpecies: ExpressionBuilderSearchOption[];
  onSuggestedPropertyClick: (property: ExpressionBuilderProperty) => unknown;
  onSuggestedSpeciesClick: (species: ExpressionBuilderSearchOption) => unknown;
  onAddCondition: () => unknown;
  onApply: () => unknown;
}

export interface ExpressionBuilderSlots {
  header?: (props: ExpressionBuilderSlotProps) => ReactNode;
  footer?: (props: ExpressionBuilderSlotProps) => ReactNode;
}

export interface BuilderValidation {
  isValid: boolean;
  errors: string[];
}

export type ExpressionBuilderDraggedClause = { type: 'predicate'; id: string } | { type: 'group'; id: string };

export type ExpressionBuilderActiveDropTarget = { type: 'root' } | { type: 'group'; id: string };
