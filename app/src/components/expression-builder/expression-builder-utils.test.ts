import { BuilderExpressionNode, BuilderPredicateNode, ExpressionBuilderProperty } from './ExpressionBuilder.interface';
import {
  createBuilderExpressionNode,
  createInitialBuilderExpressionNode,
  createPredicateDraft,
  getDefaultOperatorForExpressionBuilderProperty,
  getExpressionBuilderPropertyKey,
  getExpressionBuilderPropertyKeyFromProperty,
  getUsedExpressionBuilderPropertyKeys,
  groupPredicateWithPredicate,
  mapSearchPropertyToExpressionBuilderProperty,
  moveExpressionToExpressionGroup,
  movePredicateToExpressionGroup,
  removeClauseAndNormalize,
  serializeExpressionTree,
  validateBuilderExpression
} from 'utils/expression';

const properties: ExpressionBuilderProperty[] = [
  {
    feature_property_id: 1,
    feature_type_property_id: null,
    label: 'Species name',
    property_name: 'species_name',
    property_display_name: 'Species name',
    predicate_type: 'string',
    operators: ['ILike', 'Exists']
  },
  {
    feature_property_id: 2,
    feature_type_property_id: null,
    label: 'Observed at',
    property_name: 'observed_at',
    property_display_name: 'Observed at',
    predicate_type: 'datetime',
    operators: ['Before', 'OnDate', 'OnTime', 'Exists']
  }
];

const condition = (overrides: Partial<BuilderPredicateNode>): BuilderPredicateNode => ({
  ui_id: crypto.randomUUID(),
  type: 'predicate',
  feature_property_id: properties[0].feature_property_id,
  feature_type_property_id: properties[0].feature_type_property_id,
  predicate: {
    type: 'string',
    operator: 'ILike',
    value: 'wolf'
  },
  ...overrides
});

const nestedGroup = (
  depth: number,
  maxDepth: number,
  clauses?: BuilderExpressionNode['clauses']
): BuilderExpressionNode => ({
  ui_id: `group-depth-${depth}`,
  type: 'expression',
  operator: 'AND',
  clauses:
    depth === maxDepth
      ? (clauses ?? [condition({ ui_id: `predicate-depth-${depth}` })])
      : [nestedGroup(depth + 1, maxDepth, clauses)]
});

describe('expression-builder-utils', () => {
  it('builds stable property keys from ids and property metadata', () => {
    expect(getExpressionBuilderPropertyKey(7, null)).toBe('7:');
    expect(getExpressionBuilderPropertyKey(7, 12)).toBe('7:12');
    expect(getExpressionBuilderPropertyKeyFromProperty({ feature_property_id: 7, feature_type_property_id: 12 })).toBe(
      '7:12'
    );
  });

  it('validates empty groups as invalid', () => {
    const root = createBuilderExpressionNode();

    const validation = validateBuilderExpression(root);

    expect(validation.isValid).toBe(false);
    expect(validation.errors[0]).toContain('must include at least one');
  });

  it('creates the initial builder expression with one empty predicate row', () => {
    const root = createInitialBuilderExpressionNode();

    expect(root.clauses).toHaveLength(1);
    expect(root.clauses[0]).toMatchObject({
      type: 'predicate',
      feature_property_id: null,
      feature_type_property_id: null,
      predicate: null
    });
  });

  it('defaults string predicates to contains-like operators instead of exact equality', () => {
    const property: ExpressionBuilderProperty = {
      ...properties[0],
      operators: ['Equals', 'NotEquals', 'Like', 'ILike', 'StartsWith', 'EndsWith', 'Contains', 'Exists']
    };

    expect(getDefaultOperatorForExpressionBuilderProperty(property)).toBe('Contains');
    expect(createPredicateDraft(property)).toEqual({
      type: 'string',
      operator: 'Contains',
      value: ''
    });
  });

  it('falls back to ILike for string predicates when Contains is unavailable', () => {
    expect(getDefaultOperatorForExpressionBuilderProperty(properties[0])).toBe('ILike');
    expect(createPredicateDraft(properties[0])).toMatchObject({
      type: 'string',
      operator: 'ILike'
    });
  });

  it('defaults to Exists without a value when Exists is the only supported operator', () => {
    const property: ExpressionBuilderProperty = {
      ...properties[0],
      operators: ['Exists']
    };

    expect(getDefaultOperatorForExpressionBuilderProperty(property)).toBe('Exists');
    expect(createPredicateDraft(property)).toEqual({
      type: 'string',
      operator: 'Exists',
      value: undefined
    });
  });

  it('defaults boolean predicate values to unset so the user must choose true or false', () => {
    const property: ExpressionBuilderProperty = {
      feature_property_id: 3,
      feature_type_property_id: null,
      label: 'Is sensitive',
      property_name: 'is_sensitive',
      property_display_name: 'Is sensitive',
      predicate_type: 'boolean',
      operators: ['Equals', 'Exists']
    };
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          feature_property_id: property.feature_property_id,
          feature_type_property_id: property.feature_type_property_id,
          predicate: createPredicateDraft(property)
        })
      ]
    };

    expect(createPredicateDraft(property)).toEqual({
      type: 'boolean',
      operator: 'Equals',
      value: undefined
    });
    expect(validateBuilderExpression(root).isValid).toBe(false);
  });

  it('collects selected property keys from nested expression trees', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          feature_property_id: 1,
          feature_type_property_id: null
        }),
        {
          ui_id: 'group',
          type: 'expression',
          operator: 'OR',
          clauses: [
            condition({
              feature_property_id: 2,
              feature_type_property_id: 9
            })
          ]
        }
      ]
    };

    expect(getUsedExpressionBuilderPropertyKeys(root)).toEqual(new Set(['1:', '2:9']));
  });

  it('serializes a valid nested tree without ui_id fields and preserves clause order', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          ui_id: 'first',
          feature_property_id: 1,
          feature_type_property_id: null,
          predicate: { type: 'string', operator: 'ILike', value: 'wolf' }
        }),
        {
          ui_id: 'group',
          type: 'expression',
          operator: 'OR',
          clauses: [
            condition({
              ui_id: 'second',
              feature_property_id: 1,
              feature_type_property_id: null,
              predicate: { type: 'string', operator: 'Exists' }
            })
          ]
        }
      ]
    };

    const serialized = serializeExpressionTree(root);

    expect(JSON.stringify(serialized)).not.toContain('ui_id');
    expect(serialized).toEqual({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'ILike',
          value: 'wolf'
        },
        {
          type: 'expression',
          operator: 'OR',
          clauses: [
            {
              type: 'predicate',
              feature_property_id: 1,
              feature_type_property_id: null,
              operator: 'Exists'
            }
          ]
        }
      ]
    });
  });

  it('rejects Exists predicates that keep a draft value', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          predicate: { type: 'string', operator: 'Exists', value: 'wolf' }
        })
      ]
    };

    expect(validateBuilderExpression(root).isValid).toBe(false);
    expect(() => serializeExpressionTree(root)).toThrow('Cannot serialize invalid expression builder state');
  });

  it('validates datetime operator-specific value rules', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          feature_property_id: 2,
          feature_type_property_id: null,
          predicate: { type: 'datetime', operator: 'OnDate', value: { date_value: '2026-04-24' } }
        }),
        condition({
          feature_property_id: 2,
          feature_type_property_id: null,
          predicate: { type: 'datetime', operator: 'Before', value: { time_value: '12:30' } }
        })
      ]
    };

    expect(validateBuilderExpression(root).isValid).toBe(true);
    expect(serializeExpressionTree(root).clauses).toEqual([
      {
        type: 'predicate',
        feature_property_id: 2,
        feature_type_property_id: null,
        operator: 'OnDate',
        value: '2026-04-24'
      },
      {
        type: 'predicate',
        feature_property_id: 2,
        feature_type_property_id: null,
        operator: 'Before',
        value: '12:30'
      }
    ]);
  });

  it('rejects invalid datetime drafts', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          feature_property_id: 2,
          feature_type_property_id: null,
          predicate: { type: 'datetime', operator: 'OnDate', value: { time_value: '12:30' } }
        })
      ]
    };

    expect(validateBuilderExpression(root).isValid).toBe(false);
  });

  it('maps API datetime search properties into editable datetime builder properties', () => {
    expect(
      mapSearchPropertyToExpressionBuilderProperty({
        feature_property_id: 2,
        property_name: 'observed_at',
        property_display_name: 'Observed at',
        feature_property_type: 'datetime',
        operators: ['Before', 'OnDate', 'OnTime'],
        relevancy_score: 0.9
      })
    ).toMatchObject({
      feature_property_id: 2,
      predicate_type: 'datetime',
      operators: ['Before', 'OnDate', 'OnTime']
    });
  });

  it('maps API spatial search properties into editable spatial builder properties', () => {
    expect(
      mapSearchPropertyToExpressionBuilderProperty({
        feature_property_id: 3,
        property_name: 'spatial',
        property_display_name: 'Spatial',
        feature_property_type: 'spatial',
        operators: ['Intersects', 'Within'],
        relevancy_score: 0.8
      })
    ).toMatchObject({
      feature_property_id: 3,
      predicate_type: 'spatial',
      operators: ['Intersects', 'Within']
    });
  });

  it('serializes spatial GeoJSON text as a GeoJSON object', () => {
    const geojson = '{"type":"Point","coordinates":[-123.1,49.2]}';
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          feature_property_id: 3,
          feature_type_property_id: null,
          predicate: { type: 'spatial', operator: 'Intersects', value: geojson }
        })
      ]
    };

    expect(validateBuilderExpression(root).isValid).toBe(true);
    expect(serializeExpressionTree(root).clauses[0]).toEqual({
      type: 'predicate',
      feature_property_id: 3,
      feature_type_property_id: null,
      operator: 'Intersects',
      value: {
        type: 'Point',
        coordinates: [-123.1, 49.2]
      }
    });
  });

  it('rejects invalid spatial GeoJSON text', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({
          feature_property_id: 3,
          feature_type_property_id: null,
          predicate: { type: 'spatial', operator: 'Intersects', value: '{"coordinates":[]}' }
        })
      ]
    };

    expect(validateBuilderExpression(root).isValid).toBe(false);
    expect(() => serializeExpressionTree(root)).toThrow('Cannot serialize invalid expression builder state');
  });

  it('groups a dragged predicate with the target predicate at the target position', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } }),
        condition({ ui_id: 'second', predicate: { type: 'string', operator: 'ILike', value: 'wolf' } }),
        condition({ ui_id: 'third', predicate: { type: 'string', operator: 'ILike', value: 'elk' } })
      ]
    };

    const updated = groupPredicateWithPredicate(root, 'third', 'first');

    expect(updated.clauses).toHaveLength(2);
    expect(updated.clauses[0]).toMatchObject({
      type: 'expression',
      operator: 'AND',
      clauses: [
        { type: 'predicate', ui_id: 'first' },
        { type: 'predicate', ui_id: 'third' }
      ]
    });
    expect(updated.clauses[1]).toMatchObject({ type: 'predicate', ui_id: 'second' });
  });

  it('moves a dragged predicate into an existing expression group', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'group',
          type: 'expression',
          operator: 'AND',
          clauses: [condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } })]
        },
        condition({ ui_id: 'second', predicate: { type: 'string', operator: 'ILike', value: 'wolf' } })
      ]
    };

    const updated = movePredicateToExpressionGroup(root, 'second', 'group');

    expect(updated.clauses).toHaveLength(1);
    expect(updated.clauses[0]).toMatchObject({
      type: 'expression',
      ui_id: 'group',
      clauses: [
        { type: 'predicate', ui_id: 'first' },
        { type: 'predicate', ui_id: 'second' }
      ]
    });
  });

  it('moves a dragged predicate out to the root expression group', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'group',
          type: 'expression',
          operator: 'AND',
          clauses: [
            condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } }),
            condition({ ui_id: 'second', predicate: { type: 'string', operator: 'ILike', value: 'wolf' } })
          ]
        }
      ]
    };

    const updated = movePredicateToExpressionGroup(root, 'second', 'root');

    expect(updated.clauses).toHaveLength(2);
    expect(updated.clauses[0]).toMatchObject({
      type: 'expression',
      ui_id: 'group',
      clauses: [{ type: 'predicate', ui_id: 'first' }]
    });
    expect(updated.clauses[1]).toMatchObject({ type: 'predicate', ui_id: 'second' });
  });

  it('removes a group when moving its last predicate out to the root expression group', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'group',
          type: 'expression',
          operator: 'AND',
          clauses: [condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } })]
        }
      ]
    };

    const updated = movePredicateToExpressionGroup(root, 'first', 'root');

    expect(updated.clauses).toHaveLength(1);
    expect(updated.clauses[0]).toMatchObject({ type: 'predicate', ui_id: 'first' });
  });

  it('keeps a group when moving a predicate leaves that group with one child', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'group',
          type: 'expression',
          operator: 'AND',
          clauses: [
            condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } }),
            condition({ ui_id: 'second', predicate: { type: 'string', operator: 'ILike', value: 'wolf' } })
          ]
        },
        condition({ ui_id: 'third', predicate: { type: 'string', operator: 'ILike', value: 'elk' } })
      ]
    };

    const updated = movePredicateToExpressionGroup(root, 'second', 'root');

    expect(updated.clauses).toHaveLength(3);
    expect(updated.clauses).toMatchObject([
      { type: 'expression', ui_id: 'group', clauses: [{ type: 'predicate', ui_id: 'first' }] },
      { type: 'predicate', ui_id: 'third' },
      { type: 'predicate', ui_id: 'second' }
    ]);
  });

  it('keeps a group when removing a child leaves that group with one child', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'group',
          type: 'expression',
          operator: 'AND',
          clauses: [
            condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } }),
            condition({ ui_id: 'second', predicate: { type: 'string', operator: 'ILike', value: 'wolf' } })
          ]
        }
      ]
    };

    const updated = removeClauseAndNormalize(root, 'second');

    expect(updated.clauses).toHaveLength(1);
    expect(updated.clauses[0]).toMatchObject({
      type: 'expression',
      ui_id: 'group',
      clauses: [{ type: 'predicate', ui_id: 'first' }]
    });
  });

  it('moves a dragged expression group into another expression group', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'source-group',
          type: 'expression',
          operator: 'AND',
          clauses: [condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } })]
        },
        {
          ui_id: 'target-group',
          type: 'expression',
          operator: 'OR',
          clauses: [condition({ ui_id: 'second', predicate: { type: 'string', operator: 'ILike', value: 'wolf' } })]
        }
      ]
    };

    const updated = moveExpressionToExpressionGroup(root, 'source-group', 'target-group');

    expect(updated.clauses).toHaveLength(1);
    expect(updated.clauses[0]).toMatchObject({
      type: 'expression',
      ui_id: 'target-group',
      clauses: [
        { type: 'predicate', ui_id: 'second' },
        { type: 'expression', ui_id: 'source-group' }
      ]
    });
  });

  it('does not move a group into one of its descendants', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'source-group',
          type: 'expression',
          operator: 'AND',
          clauses: [
            {
              ui_id: 'nested-group',
              type: 'expression',
              operator: 'AND',
              clauses: [condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } })]
            }
          ]
        }
      ]
    };

    expect(moveExpressionToExpressionGroup(root, 'source-group', 'nested-group')).toBe(root);
  });

  it('does not move a group past the max nested depth', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ui_id: 'source-group',
          type: 'expression',
          operator: 'AND',
          clauses: [condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } })]
        },
        nestedGroup(1, 15)
      ]
    };

    expect(moveExpressionToExpressionGroup(root, 'source-group', 'group-depth-15')).toBe(root);
  });

  it('does not create a predicate group past the max nested depth', () => {
    const root: BuilderExpressionNode = {
      ui_id: 'root',
      type: 'expression',
      operator: 'AND',
      clauses: [
        nestedGroup(1, 15, [
          condition({ ui_id: 'first', predicate: { type: 'string', operator: 'Exists' } }),
          condition({ ui_id: 'second', predicate: { type: 'string', operator: 'ILike', value: 'wolf' } })
        ])
      ]
    };

    expect(groupPredicateWithPredicate(root, 'second', 'first')).toBe(root);
  });
});
