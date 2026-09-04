import { expect } from 'chai';
import Sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { getKnex } from '../database/db';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { dependencies as expressionEvaluation } from './expression-evaluation';
import { SearchFeatureRepository } from './search-feature-repository';
import { codePropertyValueJson, featureReferencePropertyValueJson, taxonPropertyValueJson } from './sql-fragments';

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

describe('SearchFeatureRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('searchFeaturesByExpressionTree (wrapper relay)', () => {
    it('should call buildExpressionTreeFeatureIdsSubquery with relayed args and thread the subquery via whereIn', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery').returns(
        getKnex()('any_table').select('submission_feature_id')
      );

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
          }
        ]
      };

      await repository.searchFeaturesByExpressionTree('survey', expressionTree, undefined, 42);

      expect(subqueryStub.calledOnce).to.equal(true);
      expect(subqueryStub.getCall(0).args).to.deep.equal(['survey', expressionTree, 42]);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('"sf"."submission_feature_id" in');
      expect(sql).to.include('any_table');
    });

    it('should default systemUserId to null when omitted', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery').returns(
        getKnex()('any_table').select('submission_feature_id')
      );

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
          }
        ]
      };

      await repository.searchFeaturesByExpressionTree('survey', expressionTree);

      expect(subqueryStub.getCall(0).args[2]).to.equal(null);
    });

    it('should NOT call buildExpressionTreeFeatureIdsSubquery when expressionTree is undefined and fall back to anchor-only path', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');

      await repository.searchFeaturesByExpressionTree('telemetry', undefined, { page: 1, limit: 25 }, null);

      expect(subqueryStub.notCalled).to.equal(true);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('"ft"."name" = \'telemetry\'');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include("COALESCE(typed_properties.properties, '{}'::jsonb) as properties");
      expect(sql).to.not.include('sf.data');
      expect(sql).to.not.include('"sf"."submission_feature_id" in');
      expect(sql).to.include('order by "submission_feature_id" asc');
      expect(sql).to.include('limit 25');
    });

    it('should hydrate expression-search fields from typed property tables instead of submission_feature.data', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByExpressionTree('survey', undefined, undefined, null);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.not.include('sf.data');
      expect(sql).to.include('AS typed_properties ON true');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include('submission_feature_property_number');
      expect(sql).to.include('submission_feature_property_boolean');
      expect(sql).to.include('submission_feature_property_timestamp');
      expect(sql).to.include('submission_feature_property_geometry');
      expect(sql).to.include('submission_feature_property_code');
      expect(sql).to.include('submission_feature_property_taxon');
      expect(sql).to.include('submission_feature_property_feature');
      expect(sql).to.include("fpt.name = 'number'");
      expect(sql).to.include("fpt.name = 'taxon'");
      expect(sql).to.include(`${taxonPropertyValueJson('t')} AS value`);
      expect(sql).to.include('contributor_codeset_code');
      expect(sql).to.include('public.ST_AsGeoJSON');
      expect(sql).to.include('referenced_sf.urn');
    });

    it('should hydrate taxon-valued properties as structured values built by the shared fragment', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByExpressionTree('survey', undefined, undefined, null);

      const sql = knexSpy.getCall(0).args[0].toString();
      // The taxon branch emits the same object as the feature-detail properties read path
      expect(sql).to.include(taxonPropertyValueJson('t'));
      expect(sql).to.not.include('to_jsonb(t.itis_scientific_name)');
      // ...and hides end-dated taxa, so search and feature detail agree on which rows exist
      expect(sql).to.include('t.record_end_date IS NULL');
    });

    it('should hydrate code-valued properties as structured values with their codeset', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByExpressionTree('survey', undefined, undefined, null);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include(codePropertyValueJson('ccc', 'cs'));
      expect(sql).to.include('JOIN contributor_codeset cs');
      expect(sql).to.include('ON cs.contributor_codeset_id = ccc.contributor_codeset_id');
      expect(sql).to.not.include('to_jsonb(ccc.label)');
      // ...and hides end-dated codes, so search and feature detail agree on which rows exist
      expect(sql).to.include('ccc.record_end_date IS NULL');
    });

    it('should hydrate feature-valued properties as structured values carrying the referenced urn', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByExpressionTree('survey', undefined, undefined, null);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include(featureReferencePropertyValueJson('referenced_sf'));
      expect(sql).to.not.include('to_jsonb(referenced_sf.urn)');
    });
  });

  describe('countFeaturesByExpressionTree (wrapper relay)', () => {
    it('should layer count(*) over the subquery construction', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ count: 7 }] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery').returns(
        getKnex()('any_table').select('submission_feature_id')
      );

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
          }
        ]
      };

      const count = await repository.countFeaturesByExpressionTree('survey', expressionTree, 42);

      expect(count).to.equal(7);
      expect(subqueryStub.calledOnce).to.equal(true);
      expect(subqueryStub.getCall(0).args).to.deep.equal(['survey', expressionTree, 42]);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('count(*)::integer as count');
      expect(sql).to.include('"sf"."submission_feature_id" in');
      expect(sql).to.not.include('typed_properties');
    });
  });

  describe('hasInaccessibleSecuredFeaturesByExpressionTree', () => {
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
        }
      ]
    };

    it('should build the candidate set from the UNFILTERED expression subquery (no access filter pre-applied)', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const unfilteredStub = Sinon.stub(
        expressionEvaluation,
        'buildUnfilteredExpressionTreeFeatureIdsSubquery'
      ).returns(getKnex()('unfiltered_table').select('submission_feature_id'));
      const filteredStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');

      await repository.hasInaccessibleSecuredFeaturesByExpressionTree('telemetry', expressionTree, 42);

      // The hidden-secured check must use the unfiltered candidate set, never the access-filtered one.
      expect(unfilteredStub.calledOnce).to.equal(true);
      expect(unfilteredStub.getCall(0).args).to.deep.equal(['telemetry', expressionTree]);
      expect(filteredStub.notCalled).to.equal(true);

      const sql = knexSpy.getCall(0).args[0].toString();
      // The unfiltered subquery is the candidate source directly (it already restricts to active
      // anchor-type features), so it is selected FROM rather than re-wrapped/whereIn'd by feature type.
      expect(sql).to.include('unfiltered_table');
      expect(sql).to.not.include('"sf"."submission_feature_id" in');
      expect(sql).to.include('limit 1');
    });

    it('should check effectively-secured and not-accessible (anchor-only) for authenticated users', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ '?column?': 1 }] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const result = await repository.hasInaccessibleSecuredFeaturesByExpressionTree('telemetry', undefined, 42);

      expect(result).to.equal(true);

      const sql = knexSpy.getCall(0).args[0].toString();
      // effectively-secured probe over the matched candidate set
      expect(sql).to.include('submission_feature_closure');
      expect(sql).to.include('submission_feature_security');
      // authenticated accessibility probe, negated (isAccessibleToUser → team_member bound to the caller)
      expect(sql).to.include('NOT EXISTS');
      expect(sql).to.include('team_member');
      expect(sql).to.include('security_scope_anchor');
      // Cached anchors are revalidated against their immutable scope components before granting.
      expect(sql).to.include('urn_submission_id');
      expect(sql).to.include('anchor_sf');
      // "unfiltered" drops only the access/security filter, never validity: the candidate set still
      // requires current features (isSubmissionFeatureCurrent → record_effective_date / record_end_date / no successor).
      expect(sql).to.include('record_effective_date');
    });

    it('should check only effectively-secured for anonymous users (no accessibility probe)', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const result = await repository.hasInaccessibleSecuredFeaturesByExpressionTree('telemetry', undefined, null);

      expect(result).to.equal(false);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('submission_feature_security');
      // anonymous: every secured match is hidden, so no team-based accessibility probe is emitted
      expect(sql).to.not.include('team_member');
      expect(sql).to.not.include('security_scope_anchor');
    });

    it('should return true when the EXISTS probe yields a row and false otherwise', async () => {
      const truthyKnex = Sinon.stub().resolves({ rowCount: 1, rows: [{ '?column?': 1 }] });
      const trueRepo = new SearchFeatureRepository(getMockDBConnection({ knex: truthyKnex }));
      expect(await trueRepo.hasInaccessibleSecuredFeaturesByExpressionTree('telemetry', undefined, 42)).to.equal(true);

      const emptyKnex = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const falseRepo = new SearchFeatureRepository(getMockDBConnection({ knex: emptyKnex }));
      expect(await falseRepo.hasInaccessibleSecuredFeaturesByExpressionTree('telemetry', undefined, 42)).to.equal(
        false
      );
    });
  });
});
