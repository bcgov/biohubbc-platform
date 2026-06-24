import { Policy } from '../../models/policy';
import { PolicyStatement } from '../../models/policy-statement';

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
 * A policy with its statements.
 */
export interface PolicyWithStatements extends Policy {
  statements: PolicyStatement[];
}
