import { Stack } from '@mui/material';
import CustomTextField from 'components/fields/CustomTextField';
import { ExpressionBuilderDatetimeValue } from 'components/expression-builder/ExpressionBuilder.interface';
import { hasPredicateValue } from 'utils/expression';
import { ExpressionBuilderPredicateTokenDateProps } from './ExpressionBuilderPredicateToken.interface';
import { ExpressionBuilderPredicateTokenValueControl } from './ExpressionBuilderPredicateTokenValueControl';
import { ExpressionBuilderPredicateValueClearAdornment } from './ExpressionBuilderPredicateValueClearAdornment';

/**
 * Renders the datetime predicate value controls.
 *
 * Use this when the selected property's predicate type is datetime. The
 * selected operator determines whether the row shows date, time, or both
 * fields.
 *
 * @param {ExpressionBuilderPredicateTokenDateProps} props - Datetime operator, draft value, and change callback.
 * @returns {JSX.Element} Date/time field group for the predicate value.
 */
export const ExpressionBuilderPredicateTokenDate = ({
  operator,
  value,
  readOnly = false,
  onChange
}: ExpressionBuilderPredicateTokenDateProps) => {
  // Use before reading date/time fields from the predicate draft.
  const isDatetimeValue = (draftValue: unknown): draftValue is ExpressionBuilderDatetimeValue =>
    typeof draftValue === 'object' &&
    draftValue !== null &&
    ('date_value' in draftValue || 'time_value' in draftValue) &&
    (!('date_value' in draftValue) ||
      typeof draftValue.date_value === 'string' ||
      draftValue.date_value === undefined) &&
    (!('time_value' in draftValue) || typeof draftValue.time_value === 'string' || draftValue.time_value === undefined);

  // Use when one datetime input changes so the draft only stores populated fields.
  const updateDatetimeValue = (
    draftValue: unknown,
    field: keyof ExpressionBuilderDatetimeValue,
    nextValue: string
  ): ExpressionBuilderDatetimeValue => {
    const currentValue = isDatetimeValue(draftValue) ? draftValue : {};
    const nextDatetimeValue = { ...currentValue };

    if (nextValue) {
      nextDatetimeValue[field] = nextValue;
    } else {
      delete nextDatetimeValue[field];
    }

    return nextDatetimeValue;
  };

  const datetimeValue = isDatetimeValue(value) ? value : {};
  const showDate = operator === 'OnDate' || operator === 'Before' || operator === 'After';
  const showTime = operator === 'OnTime' || operator === 'Before' || operator === 'After';
  const datetimeMissingValue =
    !hasPredicateValue(datetimeValue.date_value) && !hasPredicateValue(datetimeValue.time_value);

  // Use to render each native date/time field with shared compact token styling.
  const renderDatetimeField = ({
    field,
    type,
    fieldValue,
    ariaLabel
  }: {
    field: keyof ExpressionBuilderDatetimeValue;
    type: 'date' | 'time';
    fieldValue: string | undefined;
    ariaLabel: string;
  }) => (
    <ExpressionBuilderPredicateTokenValueControl variant={type}>
      <CustomTextField
        fullWidth
        size="small"
        variant="outlined"
        type={type}
        value={fieldValue ?? ''}
        error={datetimeMissingValue}
        disabled={readOnly}
        onChange={(event) => onChange(updateDatetimeValue(value, field, event.target.value))}
        InputProps={{
          endAdornment:
            !readOnly && hasPredicateValue(fieldValue) ? (
              <ExpressionBuilderPredicateValueClearAdornment
                onClear={() => onChange(updateDatetimeValue(value, field, ''))}
              />
            ) : undefined
        }}
        inputProps={{ 'aria-label': ariaLabel }}
      />
    </ExpressionBuilderPredicateTokenValueControl>
  );

  return (
    <Stack
      direction="row"
      gap={1}
      sx={{
        flex: Number(showDate) + Number(showTime) > 1 ? '2 1 360px' : '1 1 180px',
        minWidth: Number(showDate) + Number(showTime) > 1 ? 340 : 160
      }}>
      {showDate &&
        renderDatetimeField({
          field: 'date_value',
          type: 'date',
          fieldValue: datetimeValue.date_value,
          ariaLabel: 'Date'
        })}
      {showTime &&
        renderDatetimeField({
          field: 'time_value',
          type: 'time',
          fieldValue: datetimeValue.time_value,
          ariaLabel: 'Time'
        })}
    </Stack>
  );
};
