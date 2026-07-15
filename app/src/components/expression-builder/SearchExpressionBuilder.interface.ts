import { ExpressionBuilderProps, ExpressionBuilderSlotProps } from './ExpressionBuilder.interface';

/**
 * Props for the search-specific expression builder shell.
 */
export interface SearchExpressionBuilderProps extends Omit<ExpressionBuilderProps, 'slots'> {
  /**
   * Called when the user cancels changes from the search builder footer.
   */
  onCancel?: () => unknown;
}

/**
 * Context value shared by the search builder shell and its slot components.
 */
export interface SearchExpressionBuilderContextValue {
  /**
   * Called when the user cancels changes from the search builder footer.
   */
  onCancel?: () => unknown;
}

/**
 * Props received by search builder slot components from the shared expression builder.
 */
export type SearchExpressionBuilderSlotProps = ExpressionBuilderSlotProps;
