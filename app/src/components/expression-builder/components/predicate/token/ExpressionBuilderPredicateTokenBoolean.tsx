import { InlineSelect } from 'components/select/InlineSelect';
import { ExpressionBuilderPredicateTokenBooleanProps } from './ExpressionBuilderPredicateToken.interface';
import { ExpressionBuilderPredicateTokenValueControl } from './ExpressionBuilderPredicateTokenValueControl';

/**
 * Renders the boolean predicate value selector.
 *
 * Use this when the selected property's predicate type is boolean so the draft
 * stores actual boolean values instead of user-entered strings.
 *
 * @param {ExpressionBuilderPredicateTokenBooleanProps} props - Boolean value, read-only state, and change callback.
 * @returns {JSX.Element} Boolean value select control.
 */
export const ExpressionBuilderPredicateTokenBoolean = ({
  value,
  readOnly = false,
  onChange
}: ExpressionBuilderPredicateTokenBooleanProps) => {
  const booleanValue = typeof value === 'boolean' ? String(value) : '';

  // Use when the inline select changes so predicate state stores booleans, not strings.
  const handleValueChange = (nextValue: string) => {
    onChange(nextValue === '' ? undefined : nextValue === 'true');
  };

  return (
    <ExpressionBuilderPredicateTokenValueControl variant="select">
      <InlineSelect
        ariaLabel="Value"
        placeholder="Value"
        disabled={readOnly}
        options={[
          { value: 'true', label: 'true' },
          { value: 'false', label: 'false' }
        ]}
        value={booleanValue}
        onChange={handleValueChange}
      />
    </ExpressionBuilderPredicateTokenValueControl>
  );
};
