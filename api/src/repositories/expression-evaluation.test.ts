import { expect } from 'chai';
import Sinon from 'sinon';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { buildBroadFeatureTypeSubquery, buildExpressionTreeFeatureIdsSubquery } from './expression-evaluation';

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

      const sql = buildExpressionTreeFeatureIdsSubquery('dataset', expressionTree, null).toString();

      expect(sql).to.include('submission_feature_property_number');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include('inner join "feature_type_property" as "ftp"');
      expect(sql).to.include('"ftp"."feature_property_id"');
      expect(sql).to.include('"ft"."name" = \'dataset\'');
      expect(sql).to.include('from (with recursive "evidence"');
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

      const sql = buildExpressionTreeFeatureIdsSubquery('dataset', expressionTree, null).toString();

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

      const sql = buildExpressionTreeFeatureIdsSubquery('dataset', expressionTree, 42).toString();

      expect(sql).to.include('p"."submission_feature_id');
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('42');
    });

    it('should also apply security filtering to projected target features (defense in depth)', () => {
      // Filtering only the predicate evidence is not enough: graph traversal can reach a secured
      // *target* feature from an unsecured evidence feature, so consumers that use the subquery
      // directly (e.g. the download pipeline cursor) would otherwise leak that target id.
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

      const sql = buildExpressionTreeFeatureIdsSubquery('dataset', expressionTree, 42).toString();

      // The target-side filter is keyed on `sf.submission_feature_id`, distinct from the
      // evidence-side filter on `p.submission_feature_id`.
      expect(sql).to.include('"sf"."submission_feature_id"');
      expect(sql).to.match(/security_scope_anchor[\s\S]*"sf"\."submission_feature_id"/);
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

      const sql = buildExpressionTreeFeatureIdsSubquery('dataset', expressionTree, null).toString();

      expect(sql).to.include('"ftp"."feature_property_id" = 46');
      expect(sql).to.include('"p"."feature_type_property_id" = 123');
    });

    it('should project related predicate evidence to anchor feature ids through bounded graph traversal', () => {
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
      expect(sql).to.include('with recursive "evidence"');
      expect(sql).to.include('"connected_features" as');
      expect(sql).to.include('as "graph_edges"');
      expect(sql).to.include('"evidence"."submission_feature_id" as "root_feature_id"');
      expect(sql).to.include('"evidence"."submission_feature_id" as "connected_feature_id"');
      expect(sql).to.include('0 as depth');
      expect(sql).to.include('from "submission_feature_feature"');
      expect(sql).to.include('inner join "submission_feature" as "source_sf"');
      expect(sql).to.include('inner join "submission_feature" as "target_sf"');
      expect(sql).to.include('"source_sf"."record_end_date" is null');
      expect(sql).to.include('"target_sf"."record_end_date" is null');
      expect(sql).to.include('"source_feature_id" as "from_feature_id"');
      expect(sql).to.include('"target_feature_id" as "to_feature_id"');
      expect(sql).to.include('"target_feature_id" as "from_feature_id"');
      expect(sql).to.include('"source_feature_id" as "to_feature_id"');
      expect(sql).to.include('"parent_submission_feature_id" as "from_feature_id"');
      expect(sql).to.include('"parent_submission_feature_id" as "to_feature_id"');
      expect(sql).to.include('"dataset_ft"."name" = \'dataset\'');
      expect(sql).to.include('"related_sf"."submission_id" = "dataset_sf"."submission_id"');
      expect(sql).to.include('"dataset_sf"."submission_feature_id" as "from_feature_id"');
      expect(sql).to.include('"dataset_sf"."submission_feature_id" as "to_feature_id"');
      expect(sql).to.include('"connected_features"."depth" < 6');
      expect(sql).to.include('NOT edges.to_feature_id = ANY(connected_features.path)');
      expect(sql).to.include('"ft"."name" = \'telemetry\'');
      expect(sql).to.include('"sf"."record_end_date" is null');
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
      expect(sql).to.include('"ft"."name" = \'species_observation\'');
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
      expect(sql).to.include('"ft"."name" = \'species_observation\'');
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

    it('should project parent dataset evidence to species observation targets through hierarchy edges', () => {
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
      expect(sql).to.include('from "submission_feature"');
      expect(sql).to.include('"parent_submission_feature_id" as "from_feature_id"');
      expect(sql).to.include('"submission_feature_id" as "from_feature_id"');
      expect(sql).to.include('"dataset_ft"."name" = \'dataset\'');
      expect(sql).to.include('"related_sf"."submission_id" = "dataset_sf"."submission_id"');
      expect(sql).to.include('"ft"."name" = \'species_observation\'');
    });
  });

  describe('buildBroadFeatureTypeSubquery', () => {
    it('emits SQL projecting submission_feature_id with the feature-type filter and security filter for an authenticated user', () => {
      const sql = buildBroadFeatureTypeSubquery('fish', 42).toString();

      expect(sql).to.include('"sf"."submission_feature_id"');
      expect(sql).to.include('from "submission_feature" as "sf"');
      expect(sql).to.include('inner join "feature_type" as "ft"');
      expect(sql).to.include('"ft"."name" = \'fish\'');
      expect(sql).to.include('"sf"."record_end_date" is null');
      expect(sql).to.include('"ft"."record_end_date" is null');
      // Authenticated path uses isAccessibleToUser → security_scope_anchor + bound user id
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('42');
    });

    it('emits the anonymous-only NOT-secured filter when systemUserId is null', () => {
      const sql = buildBroadFeatureTypeSubquery('fish', null).toString();

      expect(sql).to.include('"ft"."name" = \'fish\'');
      // Anonymous: emits NOT EXISTS (uppercase, raw SQL fragment) with no scope-anchor branch
      expect(sql.toLowerCase()).to.include('not exists');
      expect(sql).to.not.include('security_scope_anchor');
    });
  });
});
