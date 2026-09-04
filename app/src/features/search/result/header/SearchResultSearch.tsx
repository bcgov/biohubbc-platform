import { SearchExpressionBuilder } from 'components/expression-builder/SearchExpressionBuilder';
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
 * Keeps editable search text local while the user works in the popover, passes
 * that text to `SearchExpressionBuilder` for recommendations, and only notifies the
 * page when the user applies an expression tree.
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
   * Result data refreshes only after the expression builder applies changes.
   */
  const handleClear = () => {
    setValue('');
  };

  /**
   * Applies the expression builder value and closes the filter popover.
   * The parent result page owns expression state and search refresh.
   *
   * @param {ExpressionTreeExpression | null} expression - Expression selected by the user, or `null` when filters are cleared.
   */
  const handleExpressionApply = (expression: ExpressionTreeExpression | null) => {
    setIsFilterPanelOpen(false);
    onExpressionApply(expression);
  };

  return (
    <SearchResultHeader
      searchTerm={value}
      isFilterPanelOpen={isFilterPanelOpen}
      onFilterPanelOpenChange={setIsFilterPanelOpen}
      onSearchTermChange={setValue}
      onClear={handleClear}>
      <SearchExpressionBuilder
        value={expressionTree ?? undefined}
        recommendedSearchTerm={recommendedSearchTerm}
        onApply={handleExpressionApply}
        onCancel={() => setIsFilterPanelOpen(false)}
      />
    </SearchResultHeader>
  );
};
