import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { IconButton, Stack } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { InlineSelect } from 'components/select/InlineSelect';
import { EXPRESSION_BUILDER_PREDICATE_OPERATOR_LABELS } from 'constants/expression';
import { ExpressionPredicateOperator } from 'interfaces/expression.interface';
import { useState } from 'react';
import { getExpressionBuilderPropertyKeyFromProperty, hasPredicateValue } from 'utils/expression';
import { ExpressionBuilderPropertySearch } from '../../property/search/ExpressionBuilderPropertySearch';
import { ExpressionBuilderPredicateTokenProps } from './ExpressionBuilderPredicateToken.interface';
import { ExpressionBuilderPredicateTokenSkeleton } from './ExpressionBuilderPredicateTokenSkeleton';
import { ExpressionBuilderPredicateTokenValue } from './ExpressionBuilderPredicateTokenValue';
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

  // Use on the token root to highlight valid predicate-to-predicate drop targets.
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canDropOnPredicate) {
      return;
    }

    onDragOverPredicate();
    setIsDropTarget(true);
  };

  // Use on the token root to clear drop highlighting after the pointer exits the row.
  const handleDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDropTarget(false);
  };

  // Use on the token root to commit the active predicate drop onto this predicate.
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropTarget(false);

    if (!canDropOnPredicate) {
      return;
    }

    onDropOnPredicate(node.ui_id);
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

        <ExpressionBuilderPredicateTokenValue
          property={property}
          predicate={predicate}
          missingValue={missingValue}
          readOnly={readOnly}
          onChange={(value) => onValueChange(node.ui_id, value)}
        />

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
