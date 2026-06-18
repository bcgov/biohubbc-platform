import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { IconButton, Stack, TextField } from '@mui/material';
import {
  BuilderPredicateNode,
  ExpressionBuilderProperty
} from 'components/expression-builder/ExpressionBuilder.interface';
import { InlineSelect } from 'components/select/InlineSelect';
import { EXPRESSION_BUILDER_PREDICATE_OPERATOR_LABELS } from 'constants/expression';
import { ExpressionPredicateOperator } from 'interfaces/expression.interface';
import { useState } from 'react';
import { getExpressionBuilderPropertyKeyFromProperty, hasPredicateValue } from 'utils/expression';
import { ExpressionBuilderPropertySearch } from '../../property/search/ExpressionBuilderPropertySearch';
import { getTextInputValue, isDatetimeValue, updateDatetimeValue } from './ExpressionBuilderPredicateToken.utils';
import { ExpressionBuilderPredicateValueClearAdornment } from './ExpressionBuilderPredicateValueClearAdornment';
import { useExpressionBuilderPredicateProperty } from './useExpressionBuilderPredicateProperty';

interface ExpressionBuilderPredicateTokenProps {
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
}

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
  onRemove
}: ExpressionBuilderPredicateTokenProps) => {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const { property, propertyOptions } = useExpressionBuilderPredicateProperty({ node, properties, selectedProperties });
  const predicate = node.predicate;
  const missingProperty = node.feature_property_id === null;
  const missingOperator = !!property && !predicate?.operator;
  const missingValue =
    !!property &&
    !!predicate?.operator &&
    predicate.operator !== 'Exists' &&
    predicate.type !== 'datetime' &&
    !hasPredicateValue(predicate.value);
  const canDropOnPredicate = !!draggedPredicateId && draggedPredicateId !== node.ui_id;

  // Predicate drop highlighting is local to the token. The parent builder owns
  // the actual tree mutation when a drop is completed.
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canDropOnPredicate) {
      return;
    }

    onDragOverPredicate();
    setIsDropTarget(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDropTarget(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropTarget(false);

    if (!canDropOnPredicate) {
      return;
    }

    onDropOnPredicate(node.ui_id);
  };

  const renderValueInput = () => {
    // Keep the value field enabled even when the predicate is incomplete or the
    // operator is Exists. Exists still serializes without value, but enabled
    // fields keep the row visually stable and avoid focus traps.
    if (!property || !predicate?.operator || predicate.operator === 'Exists') {
      const value = getTextInputValue(predicate?.value);

      return (
        <TextField
          size="small"
          variant="outlined"
          value={value ?? ''}
          placeholder="Value"
          onChange={(event) => onValueChange(node.ui_id, event.target.value)}
          InputProps={{
            endAdornment: hasPredicateValue(value) ? (
              <ExpressionBuilderPredicateValueClearAdornment onClear={() => onValueChange(node.ui_id, '')} />
            ) : undefined
          }}
          inputProps={{ 'aria-label': 'Value' }}
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
    }

    if (property.predicate_type === 'boolean') {
      // Boolean predicates use a select so users choose an actual boolean value
      // instead of typing strings that would need coercion.
      const hasBooleanValue = typeof predicate.value === 'boolean';
      const booleanValue = hasBooleanValue ? String(predicate.value) : '';

      return (
        <InlineSelect
          ariaLabel="Value"
          placeholder="Value"
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
    }

    if (property.predicate_type === 'datetime') {
      // The public API accepts datetime predicates as scalar strings. The token
      // keeps date/time inputs separate for editing, then serialization converts
      // the draft back to the API string form.
      const datetimeValue = isDatetimeValue(predicate.value) ? predicate.value : {};
      const showDate =
        predicate.operator === 'OnDate' || predicate.operator === 'Before' || predicate.operator === 'After';
      const showTime =
        predicate.operator === 'OnTime' || predicate.operator === 'Before' || predicate.operator === 'After';
      const datetimeMissingValue =
        !hasPredicateValue(datetimeValue.date_value) && !hasPredicateValue(datetimeValue.time_value);
      const datetimeInputCount = Number(showDate) + Number(showTime);

      return (
        <Stack
          direction="row"
          gap={1}
          sx={{
            flex: datetimeInputCount > 1 ? '2 1 360px' : '1 1 180px',
            minWidth: datetimeInputCount > 1 ? 320 : 160
          }}>
          {showDate && (
            <TextField
              size="small"
              variant="outlined"
              type="date"
              value={datetimeValue.date_value ?? ''}
              error={datetimeMissingValue}
              onChange={(event) =>
                onValueChange(node.ui_id, updateDatetimeValue(predicate.value, 'date_value', event.target.value))
              }
              InputProps={{
                endAdornment: hasPredicateValue(datetimeValue.date_value) ? (
                  <ExpressionBuilderPredicateValueClearAdornment
                    onClear={() => onValueChange(node.ui_id, updateDatetimeValue(predicate.value, 'date_value', ''))}
                  />
                ) : undefined
              }}
              inputProps={{ 'aria-label': 'Date' }}
              sx={{
                flex: '1 0 156px',
                minWidth: 156,
                '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
                  fontSize: '0.875rem',
                  height: 36,
                  minHeight: 36,
                  padding: '0 56px 0 6px !important',
                  transition: 'box-shadow 120ms ease'
                },
                '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall .MuiInputBase-input': {
                  height: 24,
                  lineHeight: '24px',
                  padding: '8px !important'
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
          )}
          {showTime && (
            <TextField
              size="small"
              variant="outlined"
              type="time"
              value={datetimeValue.time_value ?? ''}
              error={datetimeMissingValue}
              onChange={(event) =>
                onValueChange(node.ui_id, updateDatetimeValue(predicate.value, 'time_value', event.target.value))
              }
              InputProps={{
                endAdornment: hasPredicateValue(datetimeValue.time_value) ? (
                  <ExpressionBuilderPredicateValueClearAdornment
                    onClear={() => onValueChange(node.ui_id, updateDatetimeValue(predicate.value, 'time_value', ''))}
                  />
                ) : undefined
              }}
              inputProps={{ 'aria-label': 'Time' }}
              sx={{
                flex: '1 0 132px',
                minWidth: 132,
                '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
                  fontSize: '0.875rem',
                  height: 36,
                  minHeight: 36,
                  padding: '0 56px 0 6px !important',
                  transition: 'box-shadow 120ms ease'
                },
                '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall .MuiInputBase-input': {
                  height: 24,
                  lineHeight: '24px',
                  padding: '8px !important'
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
          )}
        </Stack>
      );
    }

    const value = getTextInputValue(predicate.value);

    return (
      <TextField
        size="small"
        variant="outlined"
        type="text"
        value={value ?? ''}
        placeholder="Value"
        error={missingValue}
        onChange={(event) => onValueChange(node.ui_id, event.target.value)}
        InputProps={{
          endAdornment: hasPredicateValue(value) ? (
            <ExpressionBuilderPredicateValueClearAdornment onClear={() => onValueChange(node.ui_id, '')} />
          ) : undefined
        }}
        inputProps={{
          'aria-label': 'Value',
          inputMode: property.predicate_type === 'number' ? 'decimal' : undefined
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
  };

  return (
    <Stack
      data-testid="expression-filter-token"
      data-drop-active={isDropTarget ? 'true' : 'false'}
      direction="row"
      gap={1}
      alignItems="center"
      flexWrap="nowrap"
      draggable
      onDragStart={() => onDragStart(node.ui_id)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        bgcolor: 'action.hover',
        boxShadow: isDropTarget
          ? (theme) => `0 0 0 2px ${theme.palette.primary.main}`
          : '0 1px 2px rgba(0, 0, 0, 0.04)',
        borderRadius: 1,
        flex: '1 1 520px',
        minWidth: 0,
        px: 1,
        py: 1,
        transition: 'none'
      }}>
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

      <ExpressionBuilderPropertySearch
        properties={propertyOptions}
        ariaLabel="Property"
        value={property ?? null}
        placeholder={property?.label ?? 'Property'}
        showSearchIcon={false}
        error={missingProperty}
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

      <IconButton
        aria-label="Remove filter"
        size="small"
        onClick={() => onRemove(node.ui_id)}
        color="inherit"
        sx={{ flexShrink: 0 }}>
        <Icon path={mdiTrashCanOutline} size={0.6} />
      </IconButton>
    </Stack>
  );
};
