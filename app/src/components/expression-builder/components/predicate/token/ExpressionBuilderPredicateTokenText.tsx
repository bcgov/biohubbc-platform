import CustomTextField from 'components/fields/CustomTextField';
import { hasPredicateValue } from 'utils/expression';
import { ExpressionBuilderPredicateTokenTextProps } from './ExpressionBuilderPredicateToken.interface';
import { ExpressionBuilderPredicateTokenValueControl } from './ExpressionBuilderPredicateTokenValueControl';
import { ExpressionBuilderPredicateValueClearAdornment } from './ExpressionBuilderPredicateValueClearAdornment';

/**
 * Renders the text-backed predicate value input.
 *
 * Use this for incomplete predicates, Exists predicates, strings, numbers, and
 * fallback draft values that should remain visible as editable text.
 *
 * @param {ExpressionBuilderPredicateTokenTextProps} props - Text value, validation state, and change callback.
 * @returns {JSX.Element} Text field for the predicate value.
 */
export const ExpressionBuilderPredicateTokenText = ({
  value,
  error,
  readOnly = false,
  onChange
}: ExpressionBuilderPredicateTokenTextProps) => {
  // Use before rendering text inputs so any draft value remains visible and editable.
  const getTextInputValue = (draftValue: unknown): string | number => {
    if (typeof draftValue === 'string' || typeof draftValue === 'number') {
      return draftValue;
    }

    if (typeof draftValue === 'object' && draftValue !== null) {
      return JSON.stringify(draftValue);
    }

    return '';
  };

  const textValue = getTextInputValue(value);

  return (
    <ExpressionBuilderPredicateTokenValueControl>
      <CustomTextField
        fullWidth
        size="small"
        variant="outlined"
        type="text"
        value={textValue}
        placeholder="Value"
        error={error}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value)}
        InputProps={{
          endAdornment:
            !readOnly && hasPredicateValue(textValue) ? (
              <ExpressionBuilderPredicateValueClearAdornment onClear={() => onChange('')} />
            ) : undefined
        }}
        inputProps={{
          'aria-label': 'Value'
        }}
      />
    </ExpressionBuilderPredicateTokenValueControl>
  );
};
