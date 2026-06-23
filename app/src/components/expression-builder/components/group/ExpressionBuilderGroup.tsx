import Icon from '@mdi/react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, IconButton, Stack } from '@mui/material';
import {
  BuilderClauseNode,
  BuilderExpressionNode,
  ExpressionBuilderProperty
} from 'components/expression-builder/ExpressionBuilder.interface';
import { InlineSelect } from 'components/select/InlineSelect';
import { ExpressionLogicalOperator, ExpressionPredicateOperator } from 'interfaces/expression.interface';
import { ExpressionBuilderPredicateToken } from '../predicate/token/ExpressionBuilderPredicateToken';
import { mdiTrashCanOutline } from '@mdi/js';

interface ExpressionBuilderGroupProps {
  /** Recursive expression group node to render. */
  node: BuilderExpressionNode;
  /** Property metadata available to predicate children. */
  properties: ExpressionBuilderProperty[];
  /** Selected property metadata cache, independent of current option results. */
  selectedProperties: ExpressionBuilderProperty[];
  /** Removes a predicate or nested group by UI id. */
  onRemoveClause: (clauseId: string) => unknown;
  /** Requests a refresh of the parent-owned property options. */
  onPropertySearchInputChange: (keyword: string) => unknown;
  /** Updates this group's logical operator. */
  onGroupOperatorChange: (groupId: string, operator: ExpressionLogicalOperator) => unknown;
  /** Updates the selected property for a child predicate. */
  onPredicatePropertyChange: (
    predicateId: string,
    propertyKey: string | null,
    property?: ExpressionBuilderProperty | null
  ) => unknown;
  /** Updates the selected operator for a child predicate. */
  onPredicateOperatorChange: (predicateId: string, operator: ExpressionPredicateOperator | null) => unknown;
  /** Updates the value draft for a child predicate. */
  onPredicateValueChange: (predicateId: string, value: unknown) => unknown;
  /** Starts dragging a child predicate. */
  onPredicateDragStart: (predicateId: string) => unknown;
  /** Clears group-level drop state while hovering a predicate. */
  onPredicateDragOver: () => unknown;
  /** Drops the active predicate onto another predicate. */
  onPredicateDropOnPredicate: (targetPredicateId: string) => unknown;
  /** Starts dragging this or a nested expression group. */
  onGroupDragStart: (groupId: string) => unknown;
  /** Currently dragged predicate UI id, if any. */
  draggedPredicateId: string | null;
  /** Currently dragged group UI id, if any. */
  draggedGroupId: string | null;
  /** Group UI id currently showing a drop target, if any. */
  activeDropGroupId: string | null;
  /** Marks a group as the active drop target. */
  onGroupDragEnter: (groupId: string) => unknown;
  /** Clears the active group drop target. */
  onGroupDragLeave: () => unknown;
  /** Drops the active predicate or group onto a group. */
  onDropOnGroup: (groupId: string) => unknown;
  /** Renders the group as a non-editable policy/view surface. */
  readOnly?: boolean;
}

/**
 * Renders a nested expression group and its child clauses.
 *
 * Use this only inside `ExpressionBuilder`. The parent builder owns expression
 * state and passes callbacks for all edits, while this component handles the
 * recursive group layout, group operator control, group removal, and group-level
 * drag/drop affordances. Nested expression groups render another
 * `ExpressionBuilderGroup`; predicate clauses render `ExpressionBuilderPredicateToken`.
 *
 * @param {ExpressionBuilderGroupProps} props - Group node, available properties, and edit/drag callbacks.
 * @returns {JSX.Element} Recursive expression group UI.
 */
export const ExpressionBuilderGroup = ({
  node,
  properties,
  selectedProperties,
  onRemoveClause,
  onPropertySearchInputChange,
  onGroupOperatorChange,
  onPredicatePropertyChange,
  onPredicateOperatorChange,
  onPredicateValueChange,
  onPredicateDragStart,
  onPredicateDragOver,
  onPredicateDropOnPredicate,
  onGroupDragStart,
  draggedPredicateId,
  draggedGroupId,
  activeDropGroupId,
  onGroupDragEnter,
  onGroupDragLeave,
  onDropOnGroup,
  readOnly = false
}: ExpressionBuilderGroupProps) => {
  const isDropTarget = activeDropGroupId === node.ui_id;
  const canDropIntoGroup = !readOnly && (!!draggedPredicateId || (!!draggedGroupId && draggedGroupId !== node.ui_id));

  // Groups are recursive: every child expression renders another group and
  // every predicate renders a token. The parent builder still owns all state, so
  // this recursion is purely a rendering and event-routing concern.
  const renderClause = (clause: BuilderClauseNode) => {
    if (clause.type === 'expression') {
      return (
        <ExpressionBuilderGroup
          key={clause.ui_id}
          node={clause}
          properties={properties}
          selectedProperties={selectedProperties}
          onRemoveClause={onRemoveClause}
          onPropertySearchInputChange={onPropertySearchInputChange}
          onGroupOperatorChange={onGroupOperatorChange}
          onPredicatePropertyChange={onPredicatePropertyChange}
          onPredicateOperatorChange={onPredicateOperatorChange}
          onPredicateValueChange={onPredicateValueChange}
          onPredicateDragStart={onPredicateDragStart}
          onPredicateDragOver={onPredicateDragOver}
          onPredicateDropOnPredicate={onPredicateDropOnPredicate}
          onGroupDragStart={onGroupDragStart}
          draggedPredicateId={draggedPredicateId}
          draggedGroupId={draggedGroupId}
          activeDropGroupId={activeDropGroupId}
          onGroupDragEnter={onGroupDragEnter}
          onGroupDragLeave={onGroupDragLeave}
          onDropOnGroup={onDropOnGroup}
          readOnly={readOnly}
        />
      );
    }

    return (
      <ExpressionBuilderPredicateToken
        key={clause.ui_id}
        node={clause}
        properties={properties}
        selectedProperties={selectedProperties}
        onPropertySearchInputChange={onPropertySearchInputChange}
        onPropertyChange={onPredicatePropertyChange}
        onOperatorChange={onPredicateOperatorChange}
        onValueChange={onPredicateValueChange}
        onDragStart={onPredicateDragStart}
        onDragOverPredicate={onPredicateDragOver}
        onDropOnPredicate={onPredicateDropOnPredicate}
        draggedPredicateId={draggedPredicateId}
        onRemove={onRemoveClause}
        readOnly={readOnly}
      />
    );
  };

  return (
    <Stack
      data-testid="expression-group-token"
      data-drop-active={isDropTarget ? 'true' : 'false'}
      gap={1.5}
      onDragOver={(event) => {
        if (!canDropIntoGroup) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onGroupDragEnter(node.ui_id);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        event.stopPropagation();
        onGroupDragLeave();
      }}
      onDrop={(event) => {
        if (!canDropIntoGroup) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onDropOnGroup(node.ui_id);
      }}
      sx={{
        alignSelf: 'stretch',
        borderRadius: 1,
        bgcolor: isDropTarget ? 'action.selected' : 'action.hover',
        flex: '0 1 auto',
        maxWidth: '100%',
        p: 1.5,
        position: 'relative',
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
        },
        transition: 'none'
      }}>
      <Stack direction="row" alignItems="center" gap={1}>
        {!readOnly && (
          <Box
            draggable
            aria-label="Drag group"
            onDragStart={(event) => {
              event.stopPropagation();
              onGroupDragStart(node.ui_id);
            }}
            sx={{
              alignItems: 'center',
              color: 'text.secondary',
              cursor: 'grab',
              display: 'inline-flex',
              '&:active': {
                cursor: 'grabbing'
              }
            }}>
            <DragIndicatorIcon fontSize="small" />
          </Box>
        )}
        <InlineSelect
          ariaLabel="Group match mode"
          disableClearable
          disabled={readOnly}
          sx={{
            '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              height: 30,
              minHeight: 30,
              minWidth: 88,
              paddingLeft: '4px !important'
            },
            '&& .MuiOutlinedInput-root .MuiAutocomplete-input.MuiInputBase-input': {
              height: 18,
              lineHeight: '18px',
              padding: '6px !important'
            },
            '&&& .MuiAutocomplete-endAdornment': {
              right: '2px !important',
              width: 20
            },
            '&&& .MuiAutocomplete-popupIndicator': {
              height: 20,
              padding: '2px',
              width: 20
            },
            '&& .MuiSelect-select': {
              fontWeight: 700
            },
            '&& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'transparent'
            },
            '&& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'transparent'
            },
            '&& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main'
            }
          }}
          value={node.operator}
          options={[
            { value: 'AND', label: 'And' },
            { value: 'OR', label: 'Or' }
          ]}
          onChange={(value) => {
            if (value !== '') {
              onGroupOperatorChange(node.ui_id, value);
            }
          }}
        />
        {!readOnly && (
          <IconButton aria-label="Remove group" size="small" onClick={() => onRemoveClause(node.ui_id)} color="inherit">
            <Icon path={mdiTrashCanOutline} size={0.6} />
          </IconButton>
        )}
      </Stack>

      {node.clauses.length > 0 && (
        <Stack
          gap={1}
          sx={{
            pl: 2,
            '& > [data-testid="expression-filter-token"]': {
              flex: '0 0 auto'
            }
          }}>
          {node.clauses.map(renderClause)}
        </Stack>
      )}
    </Stack>
  );
};
