import { expect } from 'chai';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { PredicateOperator } from '../../models/expression-predicate';
import { ExpressionTree } from '../../models/expression-tree';
import { ExpressionTreeNormalizationService } from '../../services/expression-tree-normalization-service';
import { ExpressionTreeService } from '../../services/expression-tree-service';
import { allOf, predicate } from '../helpers/test-expression-helpers';
import { createAssignedFeatureProperty, createTaxon } from '../helpers/test-feature-property-helpers';

describe('Taxon predicate round trip (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: ExpressionTreeService;
  let featurePropertyId: number;
  let taxonId: number;
  const tsn = 1900001169;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new ExpressionTreeService(connection);
    const property = await createAssignedFeatureProperty(connection, 'taxon', []);
    featurePropertyId = property.featurePropertyId;
    taxonId = await createTaxon(connection, 'Taxon round trip test', null, tsn);
    expect(taxonId).to.not.equal(tsn);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  const operators: PredicateOperator[] = ['Equals', 'ChildOf', 'ParentOf', 'DescendsFrom', 'AscendsFrom'];

  for (const operator of operators) {
    it(`preserves the TSN and internal taxon identity when reading and resubmitting ${operator}`, async () => {
      const tree = allOf(predicate(featurePropertyId, operator, tsn));
      const stored = await service.writeExpressionTree(tree);
      const readTree = await service.readExpressionTree(stored.expression_id);

      expect(readTree).to.eql(tree);

      const normalizationService = new ExpressionTreeNormalizationService(connection);
      const normalizedTree = await normalizationService.normalize(readTree);
      const clause = normalizedTree.clauses[0];
      expect(clause.type).to.equal('predicate');
      if (clause.type === 'predicate') {
        expect(clause.internal_predicate).to.eql({ type: 'taxon', operator, value: taxonId });
      }

      const resubmitted = await service.writeExpressionTree(readTree);
      expect(resubmitted.expression_id).to.equal(stored.expression_id);
    });
  }

  it('reads Exists without a taxon reference or value', async () => {
    const tree: ExpressionTree = allOf(predicate(featurePropertyId, 'Exists'));
    const stored = await service.writeExpressionTree(tree);
    const readTree = await service.readExpressionTree(stored.expression_id);

    expect(readTree).to.eql(tree);
    const resubmitted = await service.writeExpressionTree(readTree);
    expect(resubmitted.expression_id).to.equal(stored.expression_id);
  });
});
