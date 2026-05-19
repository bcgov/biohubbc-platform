import { ExpressionTree } from '../../models/expression-tree';
import { Policy } from '../../models/policy';
import { PolicyStatement } from '../../models/policy-statement';
import { PolicyStatementCondition } from '../../models/policy-statement-condition';

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
 * A policy statement with its conditions.
 */
export interface PolicyStatementWithConditions extends PolicyStatement {
  conditions: PolicyStatementCondition[];
  expression?: ExpressionTree;
}

/**
 * A policy with its statements and conditions.
 */
export interface PolicyWithStatements extends Policy {
  statements: PolicyStatementWithConditions[];
}
