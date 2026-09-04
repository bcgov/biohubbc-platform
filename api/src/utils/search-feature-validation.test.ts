import { expect } from 'chai';
import { HTTP400 } from '../errors/http-error';
import type { ExpressionTree } from '../models/expression-tree';
import { validateSearchExpressionTree, validateSearchFeatureType } from './search-feature-validation';

describe('search feature validation', () => {
  describe('validateSearchFeatureType', () => {
    it('should trim and lowercase a feature type', () => {
      expect(validateSearchFeatureType(' Species_Observation ')).to.equal('species_observation');
    });

    it('should reject an empty feature type', () => {
      expect(() => validateSearchFeatureType('   ')).to.throw(HTTP400, 'Feature type is required');
    });
  });

  describe('validateSearchExpressionTree', () => {
    it('should return undefined when the expression is omitted', () => {
      expect(validateSearchExpressionTree(undefined)).to.be.undefined;
    });

    it('should return a valid expression tree', () => {
      const expression: ExpressionTree = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Exists'
          }
        ]
      };

      expect(validateSearchExpressionTree(expression)).to.eql(expression);
    });

    it('should reject a supplied invalid expression', () => {
      expect(() => validateSearchExpressionTree(null)).to.throw(HTTP400, 'Invalid expression tree');
    });
  });
});
