/**
 * Optional filters when querying team-policy assignments.
 */
export interface TeamPolicyFilters {
  /**
   * Optional list of policy ids to filter by.
   */
  policyIds?: string[];

  /**
   * Optional search term applied to team or policy name.
   */
  search?: string;
}
