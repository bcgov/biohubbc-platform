import { expect } from 'chai';
import Sinon from 'sinon';
import { getKnex } from '../database/db';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { parseTimestamp } from '../utils/timestamp';
import {
  applyTaxonExpressionOperator,
  buildBroadFeatureTypeSubquery,
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
  const expressionTree: NormalizedExpressionTreeExpression = {
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
      const expressionTree: NormalizedExpressionTreeExpression = {
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
      expect(sql).to.include('inner join "feature_type_property" as "ftp"');
      expect(sql).to.include('"ftp"."feature_property_id"');
      expect(sql).to.include('"anchor_ft"."name" = \'survey\'');
      expect(sql).to.include('from (with "evidence"');
      expect(sql).to.include('intersect');
      expect(sql).to.include('feature_property_id');
    });

    it('should apply anonymous security filtering to predicate evidence', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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

      expect(sql).to.include('p"."submission_feature_id');
      expect(sql).to.not.include('security_scope_anchor');
    });

    it('should apply authenticated security filtering to predicate evidence', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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

      expect(sql).to.include('p"."submission_feature_id');
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('42');
    });

    it('should also apply security filtering to projected target features (defense in depth)', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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
      expect(sql).to.match(/security_scope_anchor[\s\S]*"anchor_sf"\."submission_feature_id"/);
    });

    it('should narrow predicate evidence by feature_type_property_id when provided', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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
      expect(sql).to.include('"p"."feature_type_property_id" = 123');
    });

    it('should project related predicate evidence to anchor feature ids through closure probes', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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
      expect(sql).to.include('with "evidence" as');

      expect(sql).to.include('from "related_targets"');
      expect(sql).to.include('inner join "submission_feature" as "anchor_sf"');
      expect(sql).to.include('inner join "feature_type" as "anchor_ft"');
      expect(sql).to.include('"anchor_ft"."name" = \'telemetry\'');
      expect(sql).to.include('anchor_sf.record_effective_date <= now()');
      expect(sql).to.include('now() < anchor_sf.record_end_date');

      expect(sql).to.include('from "evidence"');
      expect(sql).to.include('inner join "submission_feature" as "evidence_sf"');
      expect(sql).to.include('inner join "feature_type" as "evidence_ft"');
      expect(sql).to.include('evidence_sf.record_effective_date <= now()');
      expect(sql).to.include('now() < evidence_sf.record_end_date');

      expect(sql).to.include('from "typed_evidence"');
      expect(sql).to.include('"typed_evidence"."feature_type_name" = \'telemetry\'');
      expect(sql).to.include('not "typed_evidence"."feature_type_name" = \'telemetry\'');

      expect(sql).to.include('inner join "submission_feature_closure" as "c_forward"');
      expect(sql).to.include('"c_forward"."target_submission_feature_id" = "typed_evidence"."submission_feature_id"');

      expect(sql).to.include('inner join "submission_feature_closure" as "c_reverse"');
      expect(sql).to.include('"c_reverse"."source_submission_feature_id" = "typed_evidence"."submission_feature_id"');

      // Regression guard: never compare every anchor candidate with every evidence row.
      expect(sql).to.not.include('evidence_sf.submission_feature_id = anchor_sf.submission_feature_id');

      expect(sql).to.not.include('"content_edges"');
      expect(sql).to.not.include('"content_reach"');
      expect(sql).to.not.include('from "submission_feature_feature" as "sff"');
      expect(sql).to.not.include('connected_features');
      expect(sql).to.not.include('graph_edges');
      expect(sql).to.not.include('parent_submission_feature_id as');
      expect(sql).to.not.include('root_feature_id');
    });

    it('should union child target sets for OR expressions', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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

      expect(sql).to.include(' union ');
      expect(sql).to.not.include(' intersect ');
      expect(sql).to.include('"anchor_ft"."name" = \'species_observation\'');
    });

    it('should recursively compose nested expression target sets', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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

      expect(sql).to.include(' intersect ');
      expect(sql).to.include(' union ');
      expect(sql).to.include('"anchor_ft"."name" = \'species_observation\'');
    });

    it('should use feature-level NotEquals evidence semantics for multi-value properties', () => {
      const expressionTree: NormalizedExpressionTreeExpression = {
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
      const expressionTree: NormalizedExpressionTreeExpression = {
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
      expect(sql).to.include('"ftp"."feature_property_id" = 46');
      expect(sql).to.include('with "evidence" as');
      expect(sql).to.include('from "related_targets"');
      expect(sql).to.include('inner join "submission_feature" as "anchor_sf"');
      expect(sql).to.include('from "evidence"');
      expect(sql).to.include('from "typed_evidence"');
      expect(sql).to.include('inner join "submission_feature_closure" as "c_forward"');
      expect(sql).to.include('inner join "submission_feature_closure" as "c_reverse"');
      expect(sql).to.include('"anchor_ft"."name" = \'species_observation\'');
      expect(sql).to.not.include('"content_reach"');
      expect(sql).to.not.include('"content_edges"');
      expect(sql).to.not.include('from "submission_feature_feature" as "sff"');
      expect(sql).to.not.include('connected_features');
    });
  });

  describe('buildBroadFeatureTypeSubquery', () => {
    it('emits SQL projecting submission_feature_id with the feature-type filter and security filter for an authenticated user', () => {
      const sql = buildBroadFeatureTypeSubquery('fish', 42).toString();

      expect(sql).to.include('"sf"."submission_feature_id"');
      expect(sql).to.include('from "submission_feature" as "sf"');
      expect(sql).to.include('inner join "feature_type" as "ft"');
      expect(sql).to.include('"ft"."name" = \'fish\'');
      expect(sql).to.include('sf.record_effective_date <= now()');
      expect(sql).to.include('now() < sf.record_end_date');
      expect(sql).to.not.include('"ft"."record_end_date" is null');
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('42');
    });

    it('emits the anonymous-only NOT-secured filter when systemUserId is null', () => {
      const sql = buildBroadFeatureTypeSubquery('fish', null).toString();

      expect(sql).to.include('"ft"."name" = \'fish\'');
      expect(sql.toLowerCase()).to.include('not exists');
      expect(sql).to.not.include('security_scope_anchor');
    });
  });

  describe('buildUnfilteredExpressionTreeFeatureIdsSubquery', () => {
    const expressionTree: NormalizedExpressionTreeExpression = {
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
      expect(sql).to.include('"p"."submission_feature_id"');
    });

    it('applies NO security/access filter (the candidate set before access filtering)', () => {
      const sql = buildUnfilteredExpressionTreeFeatureIdsSubquery('dataset', expressionTree).toString();

      expect(sql).to.not.include('security_scope_anchor');
      expect(sql).to.not.include('team_security_scope');
      expect(sql).to.not.include('submission_feature_security');
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
