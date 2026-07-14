import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { IconButton, Stack, TextField } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { InlineSelect } from 'components/select/InlineSelect';
import { EXPRESSION_BUILDER_PREDICATE_OPERATOR_LABELS } from 'constants/expression';
import { ExpressionPredicateOperator } from 'interfaces/expression.interface';
import { useState } from 'react';
import { getExpressionBuilderPropertyKeyFromProperty, hasPredicateValue } from 'utils/expression';
import { ExpressionBuilderPropertySearch } from '../../property/search/ExpressionBuilderPropertySearch';
import {
  ExpressionBuilderPredicateDatetimeValueFieldParams,
  ExpressionBuilderPredicateTextValueInputParams,
  ExpressionBuilderPredicateTokenProps
} from './ExpressionBuilderPredicateToken.interface';
import { getTextInputValue, isDatetimeValue, updateDatetimeValue } from './ExpressionBuilderPredicateToken.utils';
import { ExpressionBuilderPredicateTokenSkeleton } from './ExpressionBuilderPredicateTokenSkeleton';
import { ExpressionBuilderPredicateValueClearAdornment } from './ExpressionBuilderPredicateValueClearAdornment';
import { useExpressionBuilderPredicateProperty } from './useExpressionBuilderPredicateProperty';

/**
 * Renders one editable predicate token within an expression group or root clause list.
 *
 * Use this only as a child of `ExpressionBuilder` or `ExpressionBuilderGroup`.
 * The component displays the property search, operator selector, value input,
 * remove control, and predicate drag/drop target state. It does not own the
 * predicate tree; every property, operator, value, remove, and drag operation is
 * reported to the parent through callbacks.
 *
 * @param {ExpressionBuilderPredicateTokenProps} props - Predicate node, property cache, and edit/drag callbacks.
 * @returns {JSX.Element} Editable predicate token UI.
 */
export const ExpressionBuilderPredicateToken = ({
  node,
  properties,
  selectedProperties,
  onPropertySearchInputChange,
  onPropertyChange,
  onOperatorChange,
  onValueChange,
  onDragStart,
  onDragOverPredicate,
  onDropOnPredicate,
  draggedPredicateId,
  onRemove,
  readOnly = false
}: ExpressionBuilderPredicateTokenProps) => {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const { property, propertyOptions } = useExpressionBuilderPredicateProperty({ node, properties, selectedProperties });
  const predicate = node.predicate;
  const hasSelectedPropertyId = typeof node.feature_property_id === 'number';
  const missingProperty = !hasSelectedPropertyId;
  const fallbackPropertyLabel = hasSelectedPropertyId ? `Property #${node.feature_property_id}` : 'Property';
  const isSelectedPropertyLabelLoading = hasSelectedPropertyId && !property && !readOnly;
  const missingOperator = !!property && !predicate?.operator;
  const missingValue =
    !!property &&
    !!predicate?.operator &&
    predicate.operator !== 'Exists' &&
    predicate.type !== 'datetime' &&
    !hasPredicateValue(predicate.value);
  const canDropOnPredicate = !readOnly && !!draggedPredicateId && draggedPredicateId !== node.ui_id;

  /**
   * Handles drag-over events for predicate-to-predicate moves.
   *
   * Use this on the token root so the row can show local drop highlighting while
   * the parent expression builder still owns the actual tree mutation.
   *
   * @param {React.DragEvent} event - Browser drag event from the token root.
   * @returns {void}
   */
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canDropOnPredicate) {
      return;
    }

    onDragOverPredicate();
    setIsDropTarget(true);
  };

  /**
   * Clears local predicate drop highlighting when the dragged item leaves the row.
   *
   * Use this on the token root. It ignores movement between child elements of
   * the same token so the drop highlight does not flicker.
   *
   * @param {React.DragEvent} event - Browser drag event from the token root.
   * @returns {void}
   */
  const handleDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDropTarget(false);
  };

  /**
   * Completes a predicate drop onto this token.
   *
   * Use this on the token root to clear local highlighting and notify the parent
   * expression builder which predicate should receive the dragged predicate.
   *
   * @param {React.DragEvent} event - Browser drop event from the token root.
   * @returns {void}
   */
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropTarget(false);

    if (!canDropOnPredicate) {
      return;
    }

    onDropOnPredicate(node.ui_id);
  };

  /**
   * Renders the text-backed predicate value input.
   *
   * Use this for incomplete predicates, Exists predicates, strings, numbers, and
   * fallback draft values that should remain visible as editable text.
   *
   * @param {ExpressionBuilderPredicateTextValueInputParams} params - Text value, validation state, and optional input mode.
   * @returns {JSX.Element} Text field for the predicate value.
   */
  const renderTextValueInput = ({ value, error, inputMode }: ExpressionBuilderPredicateTextValueInputParams) => (
    <TextField
      size="small"
      variant="outlined"
      type="text"
      value={value ?? ''}
      placeholder="Value"
      error={error}
      disabled={readOnly}
      onChange={(event) => onValueChange(node.ui_id, event.target.value)}
      InputProps={{
        endAdornment:
          !readOnly && hasPredicateValue(value) ? (
            <ExpressionBuilderPredicateValueClearAdornment onClear={() => onValueChange(node.ui_id, '')} />
          ) : undefined
      }}
      inputProps={{
        'aria-label': 'Value',
        inputMode
      }}
      sx={{
        flex: '1 1 180px',
        minWidth: 0,
        '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
          fontSize: '0.875rem',
          height: 36,
          minHeight: 36,
          padding: '0 4px 0 6px !important',
          transition: 'box-shadow 120ms ease'
        },
        '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall .MuiInputBase-input': {
          height: 24,
          lineHeight: '24px',
          padding: '8px !important'
        }
      }}
    />
  );

  /**
   * Renders the boolean predicate value selector.
   *
   * Use this when the selected property's predicate type is boolean so the draft
   * stores actual boolean values instead of user-entered strings.
   *
   * @returns {JSX.Element} Boolean value select control.
   */
  const renderBooleanValueInput = () => {
    const booleanValue = typeof predicate?.value === 'boolean' ? String(predicate.value) : '';

    return (
      <InlineSelect
        ariaLabel="Value"
        placeholder="Value"
        disabled={readOnly}
        sx={{
          flex: '1 1 180px',
          minWidth: 0,
          '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
            bgcolor: 'background.paper',
            borderRadius: 1,
            boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
            transition: 'box-shadow 120ms ease'
          }
        }}
        options={[
          { value: 'true', label: 'true' },
          { value: 'false', label: 'false' }
        ]}
        value={booleanValue}
        onChange={(value) => onValueChange(node.ui_id, value === '' ? undefined : value === 'true')}
      />
    );
  };

  /**
   * Renders a single datetime draft input.
   *
   * Use this for the date and time fields inside datetime predicates. The field
   * parameter controls which part of the datetime draft is updated.
   *
   * @param {ExpressionBuilderPredicateDatetimeValueFieldParams} params - Datetime field configuration and layout sizing.
   * @returns {JSX.Element} Native date or time text field.
   */
  const renderDatetimeValueField = ({
    field,
    type,
    value,
    error,
    ariaLabel,
    flex,
    minWidth
  }: ExpressionBuilderPredicateDatetimeValueFieldParams) => (
    <TextField
      size="small"
      variant="outlined"
      type={type}
      value={value ?? ''}
      error={error}
      disabled={readOnly}
      onChange={(event) => onValueChange(node.ui_id, updateDatetimeValue(predicate?.value, field, event.target.value))}
      InputProps={{
        endAdornment:
          !readOnly && hasPredicateValue(value) ? (
            <ExpressionBuilderPredicateValueClearAdornment
              onClear={() => onValueChange(node.ui_id, updateDatetimeValue(predicate?.value, field, ''))}
            />
          ) : undefined
      }}
      inputProps={{ 'aria-label': ariaLabel }}
      sx={{
        flex,
        minWidth,
        '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
          fontSize: '0.875rem',
          height: 36,
          minHeight: 36,
          padding: '0 4px 0 6px !important',
          transition: 'box-shadow 120ms ease'
        },
        '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall .MuiInputBase-input': {
          height: 24,
          lineHeight: '24px',
          padding: '8px 0 8px 8px !important'
        },
        '&& input[type="date"], && input[type="time"]': {
          paddingRight: '0 !important'
        },
        '&& input[type="date"]::-webkit-calendar-picker-indicator, && input[type="time"]::-webkit-calendar-picker-indicator':
          {
            cursor: 'pointer',
            margin: 0,
            padding: 0,
            position: 'absolute',
            right: 28,
            width: 24
          }
      }}
    />
  );

  /**
   * Renders the datetime predicate value controls.
   *
   * Use this when the selected property's predicate type is datetime. The
   * selected operator determines whether the row shows date, time, or both
   * fields.
   *
   * @returns {JSX.Element} Date/time field group for the predicate value.
   */
  const renderDatetimeValueInput = () => {
    const datetimeValue = isDatetimeValue(predicate?.value) ? predicate.value : {};
    const showDate =
      predicate?.operator === 'OnDate' || predicate?.operator === 'Before' || predicate?.operator === 'After';
    const showTime =
      predicate?.operator === 'OnTime' || predicate?.operator === 'Before' || predicate?.operator === 'After';
    const datetimeMissingValue =
      !hasPredicateValue(datetimeValue.date_value) && !hasPredicateValue(datetimeValue.time_value);
    const datetimeInputCount = Number(showDate) + Number(showTime);

    return (
      <Stack
        direction="row"
        gap={1}
        sx={{
          flex: datetimeInputCount > 1 ? '2 1 360px' : '1 1 180px',
          minWidth: datetimeInputCount > 1 ? 340 : 160
        }}>
        {showDate &&
          renderDatetimeValueField({
            field: 'date_value',
            type: 'date',
            value: datetimeValue.date_value,
            error: datetimeMissingValue,
            ariaLabel: 'Date',
            flex: '1 1 180px',
            minWidth: 180
          })}
        {showTime &&
          renderDatetimeValueField({
            field: 'time_value',
            type: 'time',
            value: datetimeValue.time_value,
            error: datetimeMissingValue,
            ariaLabel: 'Time',
            flex: '1 1 150px',
            minWidth: 150
          })}
      </Stack>
    );
  };

  /**
   * Renders the appropriate value editor for the current predicate row.
   *
   * Use this from the token layout after property and operator controls. It
   * dispatches to type-specific render helpers while keeping incomplete and
   * Exists predicates visually stable with an enabled text input.
   *
   * @returns {JSX.Element} Value editor for the current predicate state.
   */
  const renderValueInput = () => {
    // Keep the value field enabled even when the predicate is incomplete or the
    // operator is Exists. Exists still serializes without value, but enabled
    // fields keep the row visually stable and avoid focus traps.
    if (!property || !predicate?.operator || predicate.operator === 'Exists') {
      return renderTextValueInput({ value: getTextInputValue(predicate?.value) });
    }

    if (property.predicate_type === 'boolean') {
      return renderBooleanValueInput();
    }

    if (property.predicate_type === 'datetime') {
      return renderDatetimeValueInput();
    }

    return renderTextValueInput({
      value: getTextInputValue(predicate.value),
      error: missingValue,
      inputMode: property.predicate_type === 'number' ? 'decimal' : undefined
    });
  };

  return (
    <LoadingGuard
      isLoading={isSelectedPropertyLabelLoading}
      isLoadingFallback={<ExpressionBuilderPredicateTokenSkeleton onRemove={() => onRemove(node.ui_id)} />}>
      <Stack
        data-testid="expression-filter-token"
        data-drop-active={isDropTarget ? 'true' : 'false'}
        direction="row"
        gap={1}
        alignItems="center"
        flexWrap="nowrap"
        draggable={!readOnly}
        onDragStart={() => onDragStart(node.ui_id)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          bgcolor: 'action.hover',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          borderRadius: 1,
          flex: '1 1 520px',
          minWidth: 0,
          position: 'relative',
          px: 1,
          py: 1,
          transition: 'none',
          '&::after': {
            border: '2px solid transparent',
            borderRadius: 1,
            content: '""',
            inset: 0,
            pointerEvents: 'none',
            position: 'absolute'
          },
          '&[data-drop-active="true"]::after': {
            borderColor: 'primary.main'
          }
        }}>
        {!readOnly && (
          <DragIndicatorIcon
            fontSize="small"
            aria-label="Drag filter"
            sx={{
              color: 'text.secondary',
              cursor: 'grab',
              flexShrink: 0,
              '&:active': {
                cursor: 'grabbing'
              }
            }}
          />
        )}

        <ExpressionBuilderPropertySearch
          properties={propertyOptions}
          ariaLabel="Property"
          value={property ?? null}
          placeholder={property?.label ?? fallbackPropertyLabel}
          showSearchIcon={false}
          error={missingProperty}
          disabled={readOnly}
          sx={{
            flex: '1.25 1 220px',
            minWidth: 0,
            '&&& .MuiAutocomplete-endAdornment': {
              alignItems: 'center',
              display: 'flex',
              gap: '4px',
              justifyContent: 'flex-end',
              paddingRight: '0 !important',
              right: '4px !important',
              width: 28
            },
            '&&& .MuiAutocomplete-clearIndicator': {
              display: 'none !important'
            },
            '&&& .MuiAutocomplete-popupIndicator': {
              alignItems: 'center',
              display: 'inline-flex !important',
              height: 24,
              justifyContent: 'center',
              padding: '4px',
              width: 24,
              '& .MuiSvgIcon-root': {
                fontSize: '1rem'
              }
            },
            '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
              fontSize: '0.875rem',
              height: 36,
              minHeight: 36,
              padding: '0 36px 0 6px !important',
              transition: 'box-shadow 120ms ease'
            },
            '&& .MuiInputBase-input': {
              height: 24,
              lineHeight: '24px',
              minWidth: '0 !important',
              overflow: 'hidden',
              padding: '8px !important',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }
          }}
          onSearchInputChange={onPropertySearchInputChange}
          onSelectProperty={(property) =>
            onPropertyChange(node.ui_id, getExpressionBuilderPropertyKeyFromProperty(property), property)
          }
        />

        <InlineSelect
          ariaLabel="Operator"
          disableClearable
          disabled={readOnly}
          sx={{
            flex: '1 1 180px',
            minWidth: 0,
            '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
              transition: 'box-shadow 120ms ease'
            }
          }}
          error={missingOperator}
          value={predicate?.operator ?? 'Equals'}
          placeholder="Equals"
          options={(property?.operators ?? (['Equals'] as ExpressionPredicateOperator[])).map((operator) => ({
            value: operator,
            label: EXPRESSION_BUILDER_PREDICATE_OPERATOR_LABELS[operator] ?? operator
          }))}
          onChange={(value) => onOperatorChange(node.ui_id, value === '' ? null : value)}
        />

        {renderValueInput()}

        {!readOnly && (
          <IconButton
            aria-label="Remove filter"
            size="small"
            onClick={() => onRemove(node.ui_id)}
            color="inherit"
            sx={{ flexShrink: 0 }}>
            <Icon path={mdiTrashCanOutline} size={0.6} />
          </IconButton>
        )}
      </Stack>
    </LoadingGuard>
  );
};
