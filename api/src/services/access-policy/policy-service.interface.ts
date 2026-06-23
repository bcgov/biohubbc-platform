import { Policy } from '../../models/policy';
import { PolicyExpression } from '../../models/policy-expression';
import { PolicyStatement } from '../../models/policy-statement';
import { ExpressionTree } from '../../models/expression-tree';

/**
 * Optional filters when querying policies.
 */
export interface PolicyFilters {
  /**
   * Optional policy id filter.
   */
  policyId?: string;

  /**
   * Optional policy-name search term.
   */
  search?: string;
}

/**
 * A policy expression with its hydrated expression tree.
 */
export interface PolicyExpressionWithExpression extends PolicyExpression {
  expression: ExpressionTree;
}

/**
 * A policy with its statements.
 */
export interface PolicyWithStatements extends Policy {
  statements: PolicyStatement[];
  expressions: PolicyExpressionWithExpression[];
}
