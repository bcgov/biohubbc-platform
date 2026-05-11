import { ExpressionBuilder } from 'components/expression-builder/ExpressionBuilder';
import useDebouncedValue from 'hooks/useDebouncedValue';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useEffect, useState } from 'react';
import { SearchResultHeader } from './SearchResultHeader';

interface SearchResultSearchProps {
  searchTerm: string;
  expressionTree?: ExpressionTreeExpression | null;
  onExpressionApply: (expressionTree: ExpressionTreeExpression | null) => unknown;
}

/**
 * Search result header controller that wires the expression builder popover.
 *
 * Use this component on feature search result pages that submit expression-tree
 * searches. It keeps the editable search text local while the user is working in
 * the popover, passes that text to `ExpressionBuilder` for recommendations, and
 * only notifies the result page when the user applies a valid expression tree.
 *
 * @param {SearchResultSearchProps} props
 * @returns {JSX.Element} Search result header connected to the expression builder.
 */
export const SearchResultSearch = (props: SearchResultSearchProps) => {
  const { searchTerm, expressionTree, onExpressionApply } = props;
  const [value, setValue] = useState(searchTerm);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const recommendedSearchTerm = useDebouncedValue(value, 300, '');

  useEffect(() => {
    setValue(searchTerm);
  }, [searchTerm]);

  /**
   * Clears the editable search text in the header input.
   *
   * Use this as the search input clear action. It only updates local input state;
   * result data refreshes when the user applies or clears expression filters
   * through the expression builder.
   */
  const handleClear = () => {
    setValue('');
  };

  /**
   * Applies the expression builder value and closes the filter popover.
   *
   * Use this as `ExpressionBuilder.onApply`. The parent result page owns the
   * actual expression state and search refresh; this handler coordinates the
   * local popover state before forwarding the applied tree.
   *
   * @param {ExpressionTreeExpression | null} nextExpressionTree - Expression selected by the user, or `null` when filters are cleared.
   */
  const handleExpressionApply = (nextExpressionTree: ExpressionTreeExpression | null) => {
    setIsFilterPanelOpen(false);
    onExpressionApply(nextExpressionTree);
  };

  return (
    <SearchResultHeader
      searchTerm={value}
      isFilterPanelOpen={isFilterPanelOpen}
      onFilterPanelOpenChange={setIsFilterPanelOpen}
      onSearchTermChange={setValue}
      onClear={handleClear}>
      <ExpressionBuilder
        value={expressionTree ?? undefined}
        recommendedSearchTerm={recommendedSearchTerm}
        onApply={handleExpressionApply}
        onCancel={() => setIsFilterPanelOpen(false)}
      />
    </SearchResultHeader>
  );
};
