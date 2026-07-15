import { ExpressionBuilderDatetimeValue } from 'components/expression-builder/ExpressionBuilder.interface';

/**
 * Checks whether a predicate draft value can be edited by the datetime controls.
 *
 * Use this before reading `date_value` or `time_value` from predicate state. The
 * expression builder stores datetime edits as a draft object while the user is
 * editing, but serialized expressions still use scalar values.
 *
 * @param {unknown} value - Predicate draft value from builder state.
 * @returns {value is ExpressionBuilderDatetimeValue} True when the value has the editable datetime draft shape.
 */
export const isDatetimeValue = (value: unknown): value is ExpressionBuilderDatetimeValue =>
  typeof value === 'object' &&
  value !== null &&
  ('date_value' in value || 'time_value' in value) &&
  (!('date_value' in value) || typeof value.date_value === 'string' || value.date_value === undefined) &&
  (!('time_value' in value) || typeof value.time_value === 'string' || value.time_value === undefined);

/**
 * Applies a date or time input change to a datetime predicate draft.
 *
 * Use this from the datetime value fields whenever one control changes. Empty
 * input values remove that field from the draft so validation treats a fully
 * cleared datetime value the same as a missing value.
 *
 * @param {unknown} value - Current predicate value from builder state.
 * @param {keyof ExpressionBuilderDatetimeValue} field - Datetime draft field being changed.
 * @param {string} nextValue - Next input value for the changed field.
 * @returns {ExpressionBuilderDatetimeValue} Updated datetime draft value.
 */
export const updateDatetimeValue = (
  value: unknown,
  field: keyof ExpressionBuilderDatetimeValue,
  nextValue: string
): ExpressionBuilderDatetimeValue => {
  const currentValue = isDatetimeValue(value) ? value : {};
  const nextDatetimeValue = { ...currentValue };

  if (nextValue) {
    nextDatetimeValue[field] = nextValue;
  } else {
    delete nextDatetimeValue[field];
  }

  return nextDatetimeValue;
};

/**
 * Converts any predicate draft value into a value safe for a text field.
 *
 * Use this for fallback string/number inputs where predicate state may contain
 * strings, numbers, objects from previous operator types, or no value at all.
 * Objects are stringified so unexpected draft values remain visible and
 * editable instead of disappearing from the input.
 *
 * @param {unknown} value - Predicate draft value to render.
 * @returns {string | number} Text-field-compatible value.
 */
export const getTextInputValue = (value: unknown): string | number => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return '';
};
