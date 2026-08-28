import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Stack } from '@mui/material';
import { useDialogContext } from 'hooks/useContext';
import {
  ExpressionLogicalOperator,
  ExpressionPredicateOperator,
  ExpressionPropertyType
} from 'interfaces/expression.interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appendClauseToGroup,
  createBuilderPredicateNode,
  createInitialBuilderExpressionNode,
  createPredicateDraft,
  getDefaultValueForPredicateType,
  getExpressionBuilderPropertyKeyFromProperty,
  getUsedExpressionBuilderPropertyKeys,
  groupPredicateWithPredicate,
  hasPredicateValue,
  hydrateBuilderExpressionNode,
  moveExpressionToExpressionGroup,
  movePredicateToExpressionGroup,
  removeClauseAndNormalize,
  serializeExpressionTree,
  setGroupOperator,
  updatePredicateNode,
  validateBuilderExpression
} from 'utils/expression';
import { ExpressionBuilderGroup } from './components/group/ExpressionBuilderGroup';
import { ExpressionBuilderPredicateToken } from './components/predicate/token/ExpressionBuilderPredicateToken';
import {
  BuilderClauseNode,
  BuilderExpressionNode,
  BuilderPredicateNode,
  ExpressionBuilderActiveDropTarget,
  ExpressionBuilderDraggedClause,
  ExpressionBuilderProperty,
  ExpressionBuilderProps
} from './ExpressionBuilder.interface';
import { useExpressionBuilderProperties } from './hooks/useExpressionBuilderProperties';

/**
 * Visual expression-tree editor for feature search predicates.
 *
 * Use this component where users need to build or edit the expression tree sent
 * to the search API. The builder keeps draft state local and emits a valid
 * API-ready expression tree through `onApply`.
 *
 * @param {ExpressionBuilderProps} props - Search expression builder inputs and callbacks.
 * @returns {JSX.Element} Interactive expression builder UI.
 */
export const ExpressionBuilder = ({
  value,
  recommendedSearchTerm,
  readOnly = false,
  slots,
  onChange,
  onValidationChange,
  onApply
}: ExpressionBuilderProps) => {
  const dialogContext = useDialogContext();
  const [rootNode, setRootNode] = useState<BuilderExpressionNode>(() =>
    value ? hydrateBuilderExpressionNode(value) : createInitialBuilderExpressionNode()
  );
  const [draggedClause, setDraggedClause] = useState<ExpressionBuilderDraggedClause | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<ExpressionBuilderActiveDropTarget | null>(null);
  const knownPropertiesRef = useRef<ExpressionBuilderProperty[]>([]);
  const draggedPredicateId = draggedClause?.type === 'predicate' ? draggedClause.id : null;
  const draggedGroupId = draggedClause?.type === 'group' ? draggedClause.id : null;
  const activeDropGroupId = activeDropTarget?.type === 'group' ? activeDropTarget.id : null;
  const isRootDropTarget = activeDropTarget?.type === 'root';

  // Reuse the first empty root predicate row when a suggestion is selected.
  const insertRootClause = useCallback(
    (expression: BuilderExpressionNode, clauseToInsert: BuilderClauseNode): BuilderExpressionNode => {
      const emptyPredicateIndex = expression.clauses.findIndex(
        (clause) => clause.type === 'predicate' && clause.feature_property_id === null
      );

      if (emptyPredicateIndex < 0) {
        return appendClauseToGroup(expression, expression.ui_id, clauseToInsert);
      }

      return {
        ...expression,
        clauses: expression.clauses.map((clause, index) => (index === emptyPredicateIndex ? clauseToInsert : clause))
      };
    },
    []
  );

  const createPropertyPredicateNode = useCallback(
    (property: ExpressionBuilderProperty): BuilderClauseNode => ({
      ui_id: crypto.randomUUID(),
      type: 'predicate',
      feature_property_id: property.feature_property_id,
      feature_type_property_id: property.feature_type_property_id,
      predicate: createPredicateDraft(property)
    }),
    []
  );

  // Invalid drafts remain editable in the UI, but only valid trees can be
  // applied or emitted to parent components.
  const validation = useMemo(() => validateBuilderExpression(rootNode), [rootNode]);

  const usedPropertyKeys = useMemo(() => getUsedExpressionBuilderPropertyKeys(rootNode), [rootNode]);
  const {
    propertyOptions,
    selectedProperties,
    knownProperties,
    suggestedProperties,
    suggestedSpecies,
    speciesPredicateProperty,
    handlePropertySelected,
    loadSpeciesPredicateProperty,
    refreshPropertyOptions
  } = useExpressionBuilderProperties(recommendedSearchTerm, usedPropertyKeys, !readOnly);
  const hasSuggestions = !readOnly && (suggestedProperties.length > 0 || suggestedSpecies.length > 0);

  const hasStartedExpressionDraft = useCallback((clause: BuilderClauseNode): boolean => {
    if (clause.type === 'expression') {
      return clause.clauses.some((childClause) => hasStartedExpressionDraft(childClause));
    }

    return clause.feature_property_id !== null;
  }, []);

  const getPredicateProperty = useCallback(
    (predicate: BuilderPredicateNode): ExpressionBuilderProperty | null => {
      if (predicate.feature_property_id === null) {
        return null;
      }

      return (
        knownProperties.find(
          (item) =>
            item.feature_property_id === predicate.feature_property_id &&
            item.feature_type_property_id === predicate.feature_type_property_id
        ) ?? null
      );
    },
    [knownProperties]
  );

  // Use when only the operator changes so compatible value-taking operators keep the current draft value.
  const getValueForOperator = useCallback(
    (
      operator: ExpressionPredicateOperator | null,
      predicateType: ExpressionBuilderProperty['predicate_type'],
      currentValue?: unknown
    ) => {
      if (operator === 'Exists' || operator === null) {
        return undefined;
      }

      if (hasPredicateValue(currentValue)) {
        return currentValue;
      }

      return getDefaultValueForPredicateType(predicateType);
    },
    []
  );

  // Use when a property changes to preserve only values that can be safely edited by the new predicate type.
  const getValueForPropertyType = useCallback(
    (value: unknown, currentType: ExpressionPropertyType, nextType: ExpressionPropertyType): unknown => {
      if (!hasPredicateValue(value)) {
        return undefined;
      }

      if (currentType === nextType) {
        return value;
      }

      if (nextType === 'string' && (typeof value === 'string' || typeof value === 'number')) {
        return String(value);
      }

      if ((nextType === 'number' || nextType === 'code') && (typeof value === 'string' || typeof value === 'number')) {
        return String(value);
      }

      if (nextType === 'taxon') {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }

        if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
          return Number(value);
        }
      }

      if (nextType === 'boolean' && typeof value === 'boolean') {
        return value;
      }

      return undefined;
    },
    []
  );

  const updatePredicateOperator = useCallback(
    (predicate: BuilderPredicateNode, operator: ExpressionPredicateOperator | null): BuilderPredicateNode => {
      const property = getPredicateProperty(predicate);
      const predicateType = property?.predicate_type ?? predicate.predicate?.type ?? 'string';

      if (!predicate.predicate) {
        return {
          ...predicate,
          predicate: {
            type: predicateType,
            operator,
            value: getValueForOperator(operator, predicateType)
          }
        };
      }

      return {
        ...predicate,
        predicate: {
          ...predicate.predicate,
          operator,
          value: getValueForOperator(operator, predicate.predicate.type, predicate.predicate.value)
        }
      };
    },
    [getPredicateProperty, getValueForOperator]
  );

  useEffect(() => {
    knownPropertiesRef.current = knownProperties;
  }, [knownProperties]);

  // Keep controlled value hydration independent from async property metadata
  // updates. Predicates can temporarily lack metadata until later searches load it.
  useEffect(() => {
    if (value === undefined) {
      return;
    }

    setRootNode(
      value ? hydrateBuilderExpressionNode(value, knownPropertiesRef.current) : createInitialBuilderExpressionNode()
    );
  }, [value]);

  useEffect(() => {
    if (!onChange && !onValidationChange) {
      return;
    }

    const hasStartedDraft = rootNode.clauses.some((clause) => hasStartedExpressionDraft(clause));

    if (!hasStartedDraft) {
      onValidationChange?.(null);
      onChange?.(null);
      return;
    }

    if (!validation.isValid) {
      onValidationChange?.('Policy expression is invalid');
      return;
    }

    onValidationChange?.(null);
    onChange?.(serializeExpressionTree(rootNode));
  }, [hasStartedExpressionDraft, onChange, onValidationChange, rootNode, validation.isValid]);

  // Apply is the only public emission path. Incomplete drafts stay local and
  // report their first validation error instead of producing an API tree.
  const handleApply = useCallback(() => {
    if (rootNode.clauses.length === 0) {
      onApply?.(null);
      return;
    }

    if (!validation.isValid) {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Search filters are invalid'
      });
      return;
    }

    onApply?.(serializeExpressionTree(rootNode));
  }, [dialogContext, onApply, rootNode, validation.isValid]);

  // The add button always appends a fresh empty predicate at the root level so
  // users can build top-level filters without entering a nested group.
  const handleAddCondition = useCallback(() => {
    setRootNode((current) => appendClauseToGroup(current, current.ui_id, createBuilderPredicateNode()));
  }, []);

  // Species recommendation chips become Equals predicates on the taxon_id property whose value is the species TSN.
  // The taxon property is reused from recommendations or loaded once on demand.
  const handleSuggestedSpeciesClick = useCallback(
    async (species: { label: string; value: string | number }) => {
      const property = speciesPredicateProperty ?? (await loadSpeciesPredicateProperty());

      if (!property?.operators.includes('Equals')) {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: `Failed to find property for ${species.label}`
        });
        return;
      }

      handlePropertySelected(property);
      setRootNode((current) =>
        insertRootClause(current, {
          ui_id: crypto.randomUUID(),
          type: 'predicate',
          feature_property_id: property.feature_property_id,
          feature_type_property_id: property.feature_type_property_id,
          predicate: {
            type: property.predicate_type,
            operator: 'Equals',
            value: Number(species.value)
          }
        })
      );
    },
    [dialogContext, handlePropertySelected, insertRootClause, loadSpeciesPredicateProperty, speciesPredicateProperty]
  );

  // Property recommendation chips insert a ready-to-edit predicate and cache
  // the property metadata for labels, operators, and value input rendering.
  const handleSuggestedPropertyClick = useCallback(
    (property: ExpressionBuilderProperty) => {
      handlePropertySelected(property);
      setRootNode((current) => insertRootClause(current, createPropertyPredicateNode(property)));
    },
    [createPropertyPredicateNode, handlePropertySelected, insertRootClause]
  );

  // Removing a clause delegates normalization to the tree utilities so empty
  // groups are pruned consistently after predicate or group removal.
  const handleRemoveClause = useCallback((clauseId: string) => {
    setRootNode((current) => removeClauseAndNormalize(current, clauseId));
  }, []);

  // Drag state stores only the moved clause identity. Tree edits happen when a
  // compatible drop target receives the active predicate or group.
  const handlePredicateDragStart = useCallback((predicateId: string) => {
    setDraggedClause({ type: 'predicate', id: predicateId });
    setActiveDropTarget(null);
  }, []);

  // Group dragging uses the same active drag state as predicate dragging so the
  // drop handlers can share target highlighting and cleanup behavior.
  const handleGroupDragStart = useCallback((groupId: string) => {
    setDraggedClause({ type: 'group', id: groupId });
    setActiveDropTarget(null);
  }, []);

  // Predicate-on-predicate drops create a new nested expression group at the
  // target predicate position.
  const handleDropOnPredicate = useCallback(
    (targetPredicateId: string) => {
      if (!draggedPredicateId) {
        return;
      }

      setRootNode((current) => groupPredicateWithPredicate(current, draggedPredicateId, targetPredicateId));
      setDraggedClause(null);
      setActiveDropTarget(null);
    },
    [draggedPredicateId]
  );

  // Groups accept either a predicate or another expression group. Tree utility
  // functions handle normalization and invalid self/descendant moves.
  const handleDropOnGroup = useCallback(
    (targetGroupId: string) => {
      if (!draggedClause) {
        return;
      }

      setRootNode((current) => {
        if (draggedClause.type === 'predicate') {
          return movePredicateToExpressionGroup(current, draggedClause.id, targetGroupId);
        }

        return moveExpressionToExpressionGroup(current, draggedClause.id, targetGroupId);
      });
      setDraggedClause(null);
      setActiveDropTarget(null);
    },
    [draggedClause]
  );

  // Dropping anywhere in the popper outside a more specific target moves the
  // dragged predicate or group back to the root expression group.
  const handleDropOnRoot = useCallback(() => {
    if (!draggedClause) {
      return;
    }

    setRootNode((current) => {
      if (draggedClause.type === 'predicate') {
        return movePredicateToExpressionGroup(current, draggedClause.id, current.ui_id);
      }

      return moveExpressionToExpressionGroup(current, draggedClause.id, current.ui_id);
    });
    setDraggedClause(null);
    setActiveDropTarget(null);
  }, [draggedClause]);

  // Root drag-over is active for either clause type so dropping anywhere in the
  // builder can ungroup predicates or move nested groups back to the root.
  const handleRootDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!draggedClause) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setActiveDropTarget({ type: 'root' });
    },
    [draggedClause]
  );

  // Leaving the root surface clears the visual root drop target unless the
  // pointer is still inside a child element of the same surface.
  const handleRootDragLeave = useCallback((event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setActiveDropTarget(null);
  }, []);

  // Root drops call the root move helper after preventing the browser's default
  // drag behavior from opening or navigating to dragged content.
  const handleRootDrop = useCallback(
    (event: React.DragEvent) => {
      if (!draggedClause) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleDropOnRoot();
    },
    [draggedClause, handleDropOnRoot]
  );

  // Group operator changes are local draft edits and do not serialize until the
  // user applies the complete expression tree.
  const handleGroupOperatorChange = useCallback((groupId: string, operator: ExpressionLogicalOperator) => {
    setRootNode((current) => setGroupOperator(current, groupId, operator));
  }, []);

  // Property changes reset the predicate draft because valid operators and
  // value shape are determined by the selected property's API metadata.
  const handlePropertyChange = useCallback(
    (predicateId: string, propertyKey: string | null, selectedProperty?: ExpressionBuilderProperty | null) => {
      if (selectedProperty) {
        handlePropertySelected(selectedProperty);
      }

      const property =
        propertyKey === null
          ? null
          : (selectedProperty ??
            knownProperties.find((item) => getExpressionBuilderPropertyKeyFromProperty(item) === propertyKey));

      setRootNode((current) =>
        updatePredicateNode(current, predicateId, (predicate) => {
          const defaultDraft = property ? createPredicateDraft(property) : null;
          const currentDraft = predicate.predicate;
          const operator =
            property && currentDraft?.operator && property.operators.includes(currentDraft.operator)
              ? currentDraft.operator
              : (defaultDraft?.operator ?? currentDraft?.operator ?? null);
          const hasCurrentValue = currentDraft && Object.hasOwn(currentDraft, 'value');
          let value = defaultDraft?.value;
          if (operator === 'Exists') {
            value = undefined;
          } else if (property && hasCurrentValue) {
            const typedValue = getValueForPropertyType(currentDraft.value, currentDraft.type, property.predicate_type);
            value = typedValue ?? defaultDraft?.value;
          }

          return {
            ...predicate,
            feature_property_id: property?.feature_property_id ?? null,
            feature_type_property_id: property?.feature_type_property_id ?? null,
            predicate: {
              type: property?.predicate_type ?? currentDraft?.type ?? 'string',
              operator,
              value
            }
          };
        })
      );
    },
    [getValueForPropertyType, handlePropertySelected, knownProperties]
  );

  // Operator changes keep compatible draft values. Exists intentionally clears
  // value because the API requires Exists predicates to omit that field.
  const handleOperatorChange = useCallback(
    (predicateId: string, operator: ExpressionPredicateOperator | null) => {
      setRootNode((current) =>
        updatePredicateNode(current, predicateId, (predicate) => updatePredicateOperator(predicate, operator))
      );
    },
    [updatePredicateOperator]
  );

  // Value changes only update the selected predicate draft. Validation and
  // datetime conversion happen later during apply/serialization.
  const handleValueChange = useCallback((predicateId: string, value: unknown) => {
    setRootNode((current) =>
      updatePredicateNode(current, predicateId, (predicate) => {
        if (!predicate.predicate) {
          return {
            ...predicate,
            predicate: {
              type: 'string',
              operator: 'Equals',
              value
            }
          };
        }

        return {
          ...predicate,
          predicate: {
            ...predicate.predicate,
            value
          }
        };
      })
    );
  }, []);

  // Predicate drag-over clears group/root highlighting so the token itself can
  // show the active predicate drop state.
  const handlePredicateDragOver = useCallback(() => {
    setActiveDropTarget(null);
  }, []);

  // Group drag-enter drives the visual highlight for the group that will
  // receive the currently dragged predicate or group.
  const handleGroupDragEnter = useCallback((groupId: string) => {
    setActiveDropTarget({ type: 'group', id: groupId });
  }, []);

  // Group drag-leave removes the active group highlight. The root drop surface
  // can still become active separately for predicate ungrouping.
  const handleGroupDragLeave = useCallback(() => {
    setActiveDropTarget(null);
  }, []);

  // Root-level render wiring passes shared draft and drag/drop handlers into
  // either nested groups or predicate tokens.
  const renderRootClause = useCallback(
    (clause: BuilderClauseNode) => {
      if (clause.type === 'expression') {
        return (
          <ExpressionBuilderGroup
            key={clause.ui_id}
            node={clause}
            properties={propertyOptions}
            selectedProperties={selectedProperties}
            onRemoveClause={handleRemoveClause}
            onPropertySearchInputChange={refreshPropertyOptions}
            onGroupOperatorChange={handleGroupOperatorChange}
            onPredicatePropertyChange={handlePropertyChange}
            onPredicateOperatorChange={handleOperatorChange}
            onPredicateValueChange={handleValueChange}
            onPredicateDragStart={handlePredicateDragStart}
            onPredicateDragOver={handlePredicateDragOver}
            onPredicateDropOnPredicate={handleDropOnPredicate}
            onGroupDragStart={handleGroupDragStart}
            draggedPredicateId={draggedPredicateId}
            draggedGroupId={draggedGroupId}
            activeDropGroupId={activeDropGroupId}
            onGroupDragEnter={handleGroupDragEnter}
            onGroupDragLeave={handleGroupDragLeave}
            onDropOnGroup={handleDropOnGroup}
            readOnly={readOnly}
          />
        );
      }

      return (
        <ExpressionBuilderPredicateToken
          key={clause.ui_id}
          node={clause}
          properties={propertyOptions}
          selectedProperties={selectedProperties}
          onPropertySearchInputChange={refreshPropertyOptions}
          onPropertyChange={handlePropertyChange}
          onOperatorChange={handleOperatorChange}
          onValueChange={handleValueChange}
          onDragStart={handlePredicateDragStart}
          onDragOverPredicate={handlePredicateDragOver}
          onDropOnPredicate={handleDropOnPredicate}
          draggedPredicateId={draggedPredicateId}
          onRemove={handleRemoveClause}
          readOnly={readOnly}
        />
      );
    },
    [
      activeDropGroupId,
      propertyOptions,
      selectedProperties,
      draggedGroupId,
      draggedPredicateId,
      handleDropOnGroup,
      handleDropOnPredicate,
      handleGroupDragEnter,
      handleGroupDragLeave,
      handleGroupDragStart,
      handleGroupOperatorChange,
      handleOperatorChange,
      handlePredicateDragOver,
      handlePredicateDragStart,
      handlePropertyChange,
      readOnly,
      refreshPropertyOptions,
      handleRemoveClause,
      handleValueChange
    ]
  );

  const slotProps = useMemo(
    () => ({
      hasSuggestions,
      suggestedProperties,
      suggestedSpecies,
      onSuggestedPropertyClick: handleSuggestedPropertyClick,
      onSuggestedSpeciesClick: handleSuggestedSpeciesClick,
      onAddCondition: handleAddCondition,
      onApply: handleApply
    }),
    [
      handleAddCondition,
      handleApply,
      handleSuggestedPropertyClick,
      handleSuggestedSpeciesClick,
      hasSuggestions,
      suggestedProperties,
      suggestedSpecies
    ]
  );

  return (
    <Box
      data-testid="expression-builder"
      data-root-drop-active={isRootDropTarget ? 'true' : 'false'}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
      sx={{
        display: 'flex',
        flex: '1 1 auto',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
        transition: 'none',
        '&::after': {
          border: '2px solid transparent',
          borderRadius: 1,
          content: '""',
          inset: 0,
          pointerEvents: 'none',
          position: 'absolute'
        },
        '&[data-root-drop-active="true"]::after': {
          borderColor: 'primary.main'
        }
      }}>
      <Box
        data-testid="expression-input-surface"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto'
        }}>
        {slots?.header?.(slotProps)}

        <Stack
          data-testid="expression-clause-stack"
          data-drop-active={isRootDropTarget ? 'true' : 'false'}
          gap={0.5}
          sx={{
            borderRadius: 1,
            transition: 'none',
            '& > [data-testid="expression-filter-token"]': {
              flex: '0 0 auto'
            }
          }}>
          {rootNode.clauses.map(renderRootClause)}
        </Stack>

        {!readOnly && (
          <Stack direction="row">
            <Button
              variant="text"
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={handleAddCondition}
              sx={{ alignSelf: 'flex-start', mt: 0.5, textTransform: 'none' }}>
              Add Filter
            </Button>
          </Stack>
        )}
      </Box>

      {!readOnly && slots?.footer?.(slotProps)}
    </Box>
  );
};
