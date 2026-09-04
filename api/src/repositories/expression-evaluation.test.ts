import { expect } from 'chai';
import Sinon from 'sinon';
import { getKnex } from '../database/db';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { optimizeExpression } from '../utils/expression-optimization';
import { parseTimestamp } from '../utils/timestamp';
import {
  applyTaxonExpressionOperator,
  buildBroadFeatureTypeCountSubquery,
  buildBroadFeatureTypeSubquery,
  buildExpressionTreeCountFeatureIdsSubquery,
  buildExpressionTreeFeatureIdsSubquery,
  buildUnfilteredExpressionTreeFeatureIdsSubquery
} from './expression-evaluation';

const normalizedPredicate = (
  feature_property_id: number,
  feature_type_property_id: number | null,
  internal_predicate: any
) => ({
  type: 'predicate' as const,
  feature_property_id,
  feature_type_property_id,
  operator: internal_predicate.operator,
  ...(internal_predicate.value !== undefined ? { value: internal_predicate.value } : {}),
  feature_property_type_id: internal_predicate.type === 'number' ? 2 : 1,
  feature_property_type_name: internal_predicate.type === 'geometry' ? 'spatial' : internal_predicate.type,
  internal_predicate
});

const timestampPredicateSql = (operator: string, value?: string): string => {
  const parsedTimestamp = value === undefined ? undefined : parseTimestamp(value) ?? undefined;
  const expressionTree: NormalizedExpressionTree = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        ...normalizedPredicate(52, null, {
          type: 'timestamp',
          operator,
          ...(parsedTimestamp !== undefined ? { value: parsedTimestamp } : {})
        })
      }
    ]
  };

  return buildExpressionTreeFeatureIdsSubquery('species_observation', expressionTree, null).toString();
};

describe('expression-evaluation', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('buildExpressionTreeFeatureIdsSubquery', () => {
    it('should build typed property SQL that matches shared properties through feature_type_property', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(47, null, {
              type: 'number',
              operator: 'GreaterThan',
              value: 5
            })
          },
          {
            ...normalizedPredicate(46, null, {
              type: 'string',
              operator: 'Contains',
              value: 'wetland'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('survey', expressionTree, null).toString();

      expect(sql).to.include('submission_feature_property_number');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include('from "feature_type_property" as "ftp"');
      expect(sql).to.include('"ftp"."feature_property_id"');
      expect(sql).to.include('"anchor_ft"."name" = \'survey\'');
      expect(sql).to.not.include(' union ');
      expect(sql).to.not.include(' intersect ');
      expect(sql.match(/\) IS TRUE/g)).to.have.length.greaterThan(1);
      expect(sql).to.include('feature_property_id');
    });

    it('should check uncorrelated typed evidence availability before scanning anchors', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 })]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('species_observation', expressionTree, null).toString();
      const guardPosition = sql.indexOf('evidence_available_self');

      expect(guardPosition).to.be.greaterThan(-1);
      expect(guardPosition).to.be.lessThan(sql.indexOf('closure_forward'));
      expect(sql).to.match(
        /evidence_available_self\.target_submission_feature_id = p\.submission_feature_id\s+limit 1\s+\) IS TRUE/i
      );
    });

    it('should apply indexed ordering and pagination to the anchor scan', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 })]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('survey', expressionTree, null, {
        sort: 'create_date',
        order: 'desc',
        limit: 10,
        boundary: {
          direction: 'next',
          submission_feature_id: 20,
          create_date: '2026-09-01T12:00:00Z'
        }
      }).toString();

      expect(sql).to.include('("anchor_sf"."create_date", "anchor_sf"."submission_feature_id") <');
      expect(sql).to.include(
        'order by "anchor_sf"."create_date" desc, "anchor_sf"."submission_feature_id" desc limit 10'
      );
      expect(sql).to.not.include('offset');
    });

    it('should reverse the indexed traversal for a previous-page date cursor', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 })]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('survey', expressionTree, null, {
        sort: 'create_date',
        order: 'desc',
        limit: 10,
        boundary: {
          direction: 'previous',
          submission_feature_id: 20,
          create_date: '2026-09-01T12:00:00Z'
        }
      }).toString();

      expect(sql).to.include('("anchor_sf"."create_date", "anchor_sf"."submission_feature_id") >');
      expect(sql).to.include(
        'order by "anchor_sf"."create_date" asc, "anchor_sf"."submission_feature_id" asc limit 10'
      );
      expect(sql).to.not.include('offset');
    });

    it('should apply anonymous security filtering to predicate evidence', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(10, null, {
              type: 'number',
              operator: 'Exists'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('survey', expressionTree, null).toString();

      expect(sql).to.include('p.submission_feature_id');
      expect(sql).to.not.include('security_scope_anchor');
    });

    it('should apply authenticated security filtering to predicate evidence', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(10, null, {
              type: 'number',
              operator: 'Exists'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('survey', expressionTree, 42).toString();

      expect(sql).to.include('p.submission_feature_id');
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('42');
    });

    it('should also apply security filtering to projected target features (defense in depth)', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(10, null, {
              type: 'number',
              operator: 'Exists'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('survey', expressionTree, 42).toString();

      expect(sql).to.include('"anchor_sf"."submission_feature_id"');
      expect(sql).to.include('anchor_sf.submission_feature_id');
      expect(sql.match(/security_scope_anchor/g)).to.have.length.greaterThan(1);
    });

    it('should narrow predicate evidence by feature_type_property_id when provided', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(46, 123, {
              type: 'string',
              operator: 'Contains',
              value: 'wetland'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('survey', expressionTree, null).toString();

      expect(sql).to.include('"ftp"."feature_property_id" = 46');
      expect(sql).to.include('"ftp"."feature_type_property_id" = 123');
    });

    it('should project related predicate evidence to anchor feature ids through closure probes', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(99, null, {
              type: 'taxon',
              operator: 'Equals',
              value: 456
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('telemetry', expressionTree, null).toString();

      expect(sql).to.include('submission_feature_property_taxon');
      expect(sql).to.include('from "submission_feature" as "anchor_sf"');
      expect(sql).to.include('"anchor_ft"."name" = \'telemetry\'');
      expect(sql).to.include('submission_feature_closure" as "closure_forward"');
      expect(sql).to.include('closure_forward.source_submission_feature_id = anchor_sf.submission_feature_id');
      expect(sql).to.include('submission_feature_closure" as "closure_reverse"');
      expect(sql).to.include('closure_reverse.target_submission_feature_id = anchor_sf.submission_feature_id');
      expect(sql).to.include('p.submission_feature_id = anchor_sf.submission_feature_id');

      expect(sql).to.not.include('"content_edges"');
      expect(sql).to.not.include('"content_reach"');
      expect(sql).to.not.include('from "submission_feature_feature" as "sff"');
      expect(sql).to.not.include('connected_features');
      expect(sql).to.not.include('graph_edges');
      expect(sql).to.not.include('parent_submission_feature_id as');
      expect(sql).to.not.include('root_feature_id');
    });

    it('should compose nested OR expressions', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'OR',
        clauses: [
          {
            ...normalizedPredicate(46, null, {
              type: 'string',
              operator: 'Equals',
              value: 'moose'
            })
          },
          {
            ...normalizedPredicate(47, null, {
              type: 'string',
              operator: 'Equals',
              value: 'feeding'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('species_observation', expressionTree, null).toString();

      expect(sql).to.include(' or ');
      expect(sql).to.not.include(' union ');
      expect(sql).to.not.include(' intersect ');
      expect(sql).to.include('"anchor_ft"."name" = \'species_observation\'');
    });

    it('should recursively compose nested expression target sets', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(46, null, {
              type: 'string',
              operator: 'Equals',
              value: 'moose'
            })
          },
          {
            type: 'expression',
            operator: 'OR',
            clauses: [
              {
                ...normalizedPredicate(47, null, {
                  type: 'string',
                  operator: 'Equals',
                  value: 'feeding'
                })
              },
              {
                ...normalizedPredicate(47, null, {
                  type: 'string',
                  operator: 'Equals',
                  value: 'resting'
                })
              }
            ]
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('species_observation', expressionTree, null).toString();

      expect(sql).to.include(' and ');
      expect(sql).to.include(' or ');
      expect(sql).to.not.include(' intersect ');
      expect(sql).to.not.include(' union ');
      expect(sql).to.include('"anchor_ft"."name" = \'species_observation\'');
    });

    it('should use feature-level NotEquals evidence semantics for multi-value properties', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(48, null, {
              type: 'string',
              operator: 'NotEquals',
              value: 'red'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('species_observation', expressionTree, null).toString();

      expect(sql).to.include('from "submission_feature_property_string" as "p"');
      expect(sql).to.include('not exists');
      expect(sql).to.include('p_not_equals.submission_feature_id = p.submission_feature_id');
      expect(sql).to.include('"ftp_not_equals"."feature_property_id" = 48');
      expect(sql).to.include('"p_not_equals"."value" = \'red\'');
    });

    it('should apply numeric range bounds to the same property row', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              normalizedPredicate(14, null, { type: 'number', operator: 'GreaterThan', value: 7 }),
              normalizedPredicate(14, null, { type: 'number', operator: 'LessThan', value: 9 })
            ]
          },
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              normalizedPredicate(14, null, { type: 'number', operator: 'GreaterThan', value: 3 }),
              normalizedPredicate(14, null, { type: 'number', operator: 'LessThan', value: 5 })
            ]
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery(
        'species_observation',
        optimizeExpression(expressionTree),
        null
      ).toString();

      expect(sql).to.include('p.value > 7');
      expect(sql).to.include('p.value < 9');
      expect(sql).to.include('p.value > 3');
      expect(sql).to.include('p.value < 5');
    });

    it('should coalesce same-property equality predicates after mapping evidence to the anchor', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          normalizedPredicate(14, null, { type: 'number', operator: 'Equals', value: 77 }),
          normalizedPredicate(14, null, { type: 'number', operator: 'Equals', value: 100 })
        ]
      };

      const optimizedExpression = optimizeExpression(expressionTree);
      const sql = buildExpressionTreeFeatureIdsSubquery('species_observation', optimizedExpression, null).toString();

      expect(optimizedExpression).to.deep.include({ type: 'expression', operator: 'AND' });
      expect(sql).to.include('in (100, 77)');
      expect(sql).to.include('count(DISTINCT grouped_search_evidence.matched_value) = 2');
    });

    it('should compile same-property OR equalities to one IN evidence filter', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'OR',
        clauses: [
          normalizedPredicate(14, null, { type: 'number', operator: 'Equals', value: 77 }),
          normalizedPredicate(14, null, { type: 'number', operator: 'Equals', value: 100 })
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery(
        'species_observation',
        optimizeExpression(expressionTree),
        null
      ).toString();

      expect(sql).to.include('"p"."value" in (100, 77)');
    });

    it('should compile timestamp date predicates against date_value instead of the removed value column', () => {
      const sql = timestampPredicateSql('OnDate', '2026-04-24');

      expect(sql).to.include('submission_feature_property_timestamp');
      expect(sql).to.include("p.date_value = '2026-04-24'::date");
      expect(sql).to.not.include('p"."value');
      expect(sql).to.not.include('p.value');
    });

    it('should compile timestamp time predicates against time_value instead of the removed value column', () => {
      const sql = timestampPredicateSql('OnTime', '12:30');

      expect(sql).to.include('submission_feature_property_timestamp');
      expect(sql).to.include("p.time_value = '12:30'::time");
      expect(sql).to.not.include('p"."value');
      expect(sql).to.not.include('p.value');
    });

    it('should compile timestamp time-only comparisons against time_value irrespective of date_value', () => {
      const sql = timestampPredicateSql('Before', '12:30');

      expect(sql).to.include('submission_feature_property_timestamp');
      expect(sql).to.include("p.time_value < '12:30'::time");
      expect(sql).to.not.include('p.date_value <');
      expect(sql).to.not.include('p"."value');
      expect(sql).to.not.include('p.value');
    });

    it('should compile timestamp datetime comparisons from split date_value and time_value columns', () => {
      const sql = timestampPredicateSql('After', '2026-04-24T12:30');

      expect(sql).to.include('submission_feature_property_timestamp');
      expect(sql).to.include("(p.date_value + p.time_value) > ('2026-04-24'::date + '12:30'::time)");
      expect(sql).to.not.include('p"."value');
      expect(sql).to.not.include('p.value');
    });

    it('should compile timestamp Exists predicates against either split timestamp column', () => {
      const sql = timestampPredicateSql('Exists');

      expect(sql).to.include('submission_feature_property_timestamp');
      expect(sql).to.include('(p.date_value IS NOT NULL OR p.time_value IS NOT NULL)');
      expect(sql).to.not.include('p"."value');
      expect(sql).to.not.include('p.value');
    });

    it('should project predicate evidence to species_observation targets through same-type matching and closure probes', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(46, null, {
              type: 'string',
              operator: 'Equals',
              value: 'X'
            })
          }
        ]
      };

      const sql = buildExpressionTreeFeatureIdsSubquery('species_observation', expressionTree, null).toString();

      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include('"ftp"."feature_property_id"');
      expect(sql).to.include('from "submission_feature" as "anchor_sf"');
      expect(sql).to.include('submission_feature_closure" as "closure_forward"');
      expect(sql).to.include('submission_feature_closure" as "closure_reverse"');
      expect(sql).to.include('"anchor_ft"."name" = \'species_observation\'');
      expect(sql).to.not.include('"content_reach"');
      expect(sql).to.not.include('"content_edges"');
      expect(sql).to.not.include('from "submission_feature_feature" as "sff"');
      expect(sql).to.not.include('connected_features');
    });
  });

  describe('buildBroadFeatureTypeSubquery', () => {
    it('uses the type-first limited path with the security filter for an authenticated search', () => {
      const sql = buildBroadFeatureTypeSubquery('fish', 42, {
        sort: 'submission_feature_id',
        order: 'asc',
        limit: 10
      }).toString();

      expect(sql).to.include('"sf"."submission_feature_id"');
      expect(sql).to.include('from "submission_feature" as "sf"');
      expect(sql).to.not.include('inner join "feature_type" as "ft"');
      expect(sql).to.include('"sf"."feature_type_id" = (select "ft"."feature_type_id"');
      expect(sql).to.include('"ft"."name" = \'fish\'');
      expect(sql).to.include('"ft"."record_end_date" is null');
      expect(sql).to.include('SELECT true');
      expect(sql).to.include('sfc.source_submission_feature_id = sf.submission_feature_id');
      expect(sql).to.include('sfc.target_submission_feature_id = sf.submission_feature_id');
      expect(sql).to.include('LIMIT 1');
      expect(sql).to.include('IS TRUE');
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('42');
    });

    it('keeps the set-oriented closure join for an unpaginated export', () => {
      const sql = buildBroadFeatureTypeSubquery('fish', 42).toString();

      expect(sql).to.include('inner join "feature_type" as "ft"');
      expect(sql).to.include('exists');
      expect(sql).to.not.include('SELECT true');
      expect(sql).to.not.include('LIMIT 1');
    });

    it('emits the anonymous-only NOT-secured filter when systemUserId is null', () => {
      const sql = buildBroadFeatureTypeSubquery('fish', null, {
        sort: 'submission_feature_id',
        order: 'asc',
        limit: 10
      }).toString();

      expect(sql).to.include('"ft"."name" = \'fish\'');
      expect(sql).to.include('"ft"."record_end_date" is null');
      expect(sql.toLowerCase()).to.include('not exists');
      expect(sql).to.not.include('security_scope_anchor');
    });
  });

  describe('buildBroadFeatureTypeCountSubquery', () => {
    it('removes the denied set once from current features', () => {
      const sql = buildBroadFeatureTypeCountSubquery('fish', 42).toString();

      expect(sql).to.include('with "denied" as');
      expect(sql).to.include('from "submission_feature" as "sf"');
      expect(sql).to.include('sf.successor_submission_feature_id IS NULL');
      expect(sql).to.include('denied.submission_feature_id = sf.submission_feature_id');
      expect(sql).to.include(' except ');
      expect(sql).to.not.include('self_closure');
    });
  });

  describe('buildUnfilteredExpressionTreeFeatureIdsSubquery', () => {
    const expressionTree: NormalizedExpressionTree = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          ...normalizedPredicate(10, null, {
            type: 'number',
            operator: 'Exists'
          })
        }
      ]
    };

    it('emits the same expression criteria as the filtered variant', () => {
      const sql = buildUnfilteredExpressionTreeFeatureIdsSubquery('dataset', expressionTree).toString();

      expect(sql).to.include('"anchor_ft"."name" = \'dataset\'');
      expect(sql).to.include('submission_feature_property_number');
      expect(sql).to.include('p.submission_feature_id');
    });

    it('applies NO security/access filter (the candidate set before access filtering)', () => {
      const sql = buildUnfilteredExpressionTreeFeatureIdsSubquery('dataset', expressionTree).toString();

      expect(sql).to.not.include('security_scope_anchor');
      expect(sql).to.not.include('team_security_scope');
      expect(sql).to.not.include('submission_feature_security');
    });
  });

  describe('buildExpressionTreeCountFeatureIdsSubquery', () => {
    it('should aggregate coalesced AND equalities after mapping evidence to anchor IDs', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          normalizedPredicate(14, null, { type: 'number', operator: 'Equals', value: 77 }),
          normalizedPredicate(14, null, { type: 'number', operator: 'Equals', value: 100 })
        ]
      };

      const sql = buildExpressionTreeCountFeatureIdsSubquery(
        'species_observation',
        optimizeExpression(expressionTree),
        null
      ).toString();

      expect(sql).to.include('in (100, 77)');
      expect(sql).to.include('count(DISTINCT grouped_evidence.matched_value) = 2');
    });

    it('should apply numeric range bounds to the same property row', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          normalizedPredicate(14, null, { type: 'number', operator: 'GreaterThan', value: 7 }),
          normalizedPredicate(14, null, { type: 'number', operator: 'LessThan', value: 9 })
        ]
      };

      const sql = buildExpressionTreeCountFeatureIdsSubquery(
        'species_observation',
        optimizeExpression(expressionTree),
        null
      ).toString();

      expect(sql).to.include('p.value > 7 and p.value < 9');
    });

    it('checks evidence availability before evaluating matching anchor sets', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 })]
      };

      const sql = buildExpressionTreeCountFeatureIdsSubquery('survey', expressionTree, null).toString();

      expect(sql).to.include('evidence_available_self');
      expect(sql).to.match(
        /evidence_available_self\.target_submission_feature_id = p\.submission_feature_id\s+limit 1\s+\) IS TRUE/i
      );
    });

    it('maps typed evidence to the requested anchor type before combining clauses', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 }),
          normalizedPredicate(46, null, { type: 'string', operator: 'Contains', value: 'wetland' })
        ]
      };

      const sql = buildExpressionTreeCountFeatureIdsSubquery('survey', expressionTree, null).toString();

      expect(sql).to.include('submission_feature_property_number');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include('intersect');
      expect(sql).to.include('count_closure_forward');
      expect(sql).to.include('count_closure_reverse');
      expect(sql).to.include('count_anchor');
      expect(sql).to.include('survey');
      expect(sql).to.include('as "matching_anchors"');
      expect(sql).to.include('with "denied" as');
      expect(sql).to.not.include('as materialized');
      expect(sql).to.not.include('from "submission_feature" as "anchor_sf"');
    });

    it('wraps complete child sets before combining a nested expression', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 }),
              normalizedPredicate(48, null, { type: 'number', operator: 'LessThan', value: 10 })
            ]
          },
          normalizedPredicate(49, null, { type: 'number', operator: 'Equals', value: 7 })
        ]
      };

      const sql = buildExpressionTreeCountFeatureIdsSubquery('survey', expressionTree, null).toString();

      expect(sql.match(/as "count_clause_0"/g)).to.have.length(2);
      expect(sql.match(/as "count_clause_1"/g)).to.have.length(2);
      expect(sql.match(/ intersect /g)).to.have.length(2);
    });

    it('unions OR anchor sets and removes denied anchors and related evidence as sets', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'OR',
        clauses: [
          normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 }),
          normalizedPredicate(48, null, { type: 'number', operator: 'LessThan', value: 10 })
        ]
      };

      const sql = buildExpressionTreeCountFeatureIdsSubquery('survey', expressionTree, 42).toString();

      expect(sql).to.include('union');
      expect(sql).to.include('submission_feature_security');
      expect(sql).to.include('security_closure');
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('access_closure');
      expect(sql).to.include('"access_closure"."target_submission_feature_id" = "ssa"."anchor_submission_feature_id"');
      expect(sql).to.include('from "team_member" as "tm"');
      expect(sql).to.include(' except ');
      expect(sql).to.include('anchor_self');
      expect(sql).to.include('c.source_submission_feature_id = anchor_sf.submission_feature_id');
      expect(sql).to.not.include('security_closure.source_submission_feature_id = p.submission_feature_id');
    });

    it('requires closure eligibility for both anchors and related evidence', () => {
      const expressionTree: NormalizedExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [normalizedPredicate(47, null, { type: 'number', operator: 'GreaterThan', value: 5 })]
      };

      const sql = buildExpressionTreeCountFeatureIdsSubquery('survey', expressionTree, null).toString();

      expect(sql).to.include('submission_feature_security');
      expect(sql).to.include('security_closure');
      expect(sql).to.not.include('security_scope_anchor');
      expect(sql).to.include(
        '"count_direct_self" on "count_direct_self"."source_submission_feature_id" = "p"."submission_feature_id"'
      );
      expect(sql).to.include(
        '(count_direct_self.source_submission_feature_id = count_direct_self.target_submission_feature_id) IS TRUE'
      );
      expect(sql).to.include('count_anchor_self');
      expect(sql).to.include('count_evidence_self');
      expect(sql).to.include(
        'count_evidence_self.target_submission_feature_id = count_property_evidence.submission_feature_id'
      );
      expect(sql).to.match(
        /count_anchor_self\.target_submission_feature_id = count_anchor\.submission_feature_id\s+limit 1\s+\) IS TRUE/i
      );
      expect(sql).to.match(
        /count_evidence_self\.target_submission_feature_id = count_property_evidence\.submission_feature_id\s+limit 1\s+\) IS TRUE/i
      );
    });
  });

  describe('applyTaxonExpressionOperator', () => {
    type TaxonOperator = Parameters<typeof applyTaxonExpressionOperator>[2];

    // Build the taxon predicate SQL offline (getKnex() needs no live pool), mirroring how the
    // integration test constructs the query but asserting on the generated SQL rather than running it.
    const taxonOperatorSql = (operator: TaxonOperator, targetTaxonId: number): string => {
      const knex = getKnex();
      const query = knex.queryBuilder().select('t.taxon_id').from('taxon as t');
      applyTaxonExpressionOperator(query, 't.taxon_id', operator, targetTaxonId, knex);

      return query.toString();
    };

    it('walks taxon.parent_taxon_id and never parses itis_data->>parentTSN for any hierarchy operator', () => {
      for (const operator of ['ChildOf', 'ParentOf', 'DescendsFrom', 'AscendsFrom'] as TaxonOperator[]) {
        const sql = taxonOperatorSql(operator, 123);

        expect(sql, operator).to.include('parent_taxon_id');
        expect(sql, operator).to.not.include('parentTSN');
        expect(sql, operator).to.not.include('itis_data');
      }
    });

    it('ChildOf matches candidates whose immediate parent_taxon_id is the target (single hop, no recursion)', () => {
      const sql = taxonOperatorSql('ChildOf', 123);

      expect(sql).to.include('(SELECT parent_taxon_id FROM taxon WHERE taxon_id = t.taxon_id) =');
      expect(sql).to.include('123');
      expect(sql).to.not.include('WITH RECURSIVE');
    });

    it('ParentOf matches only the immediate parent via a depth-limited parent_taxon_id walk', () => {
      const sql = taxonOperatorSql('ParentOf', 123);

      expect(sql).to.include('WITH RECURSIVE ancestors');
      expect(sql).to.include('AND depth = 1');
      expect(sql).to.include('parent.record_end_date');
      // Regression guard: the depth limit must extend the existing WHERE, not open an invalid second one.
      expect(sql).to.not.match(/taxon_id = t\.taxon_id\s+where/i);
    });

    it('AscendsFrom walks all ancestors through parent_taxon_id with no depth limit', () => {
      const sql = taxonOperatorSql('AscendsFrom', 123);

      expect(sql).to.include('WITH RECURSIVE ancestors');
      expect(sql).to.not.include('depth = 1');
      expect(sql).to.include('parent.record_end_date');
    });

    it('DescendsFrom recursively walks up parent_taxon_id from the candidate to the target', () => {
      const sql = taxonOperatorSql('DescendsFrom', 123);

      expect(sql).to.include('WITH RECURSIVE ancestors');
      expect(sql).to.include('WHERE taxon_id = t.taxon_id');
      expect(sql).to.include('123');
      expect(sql).to.include('parent.record_end_date');
    });
  });
});
