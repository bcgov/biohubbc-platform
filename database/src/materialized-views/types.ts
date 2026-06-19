export type MaterializedViewSecurityMode = 'public' | 'all' | 'secured';

export interface MaterializedViewColumn {
  alias: string;
  expression: string;
}

export type MaterializedViewCommentMap = Record<string, string>;

export interface MaterializedViewDefinition {
  schema: string;
  name: string;
  baseQuery: string;
  columns: MaterializedViewColumn[];
  securityMode: MaterializedViewSecurityMode;
  featureTableAlias: string;

  enabled?: boolean;

  postQuerySql?: string;

  comments?: MaterializedViewCommentMap;
  indexes?: MaterializedViewIndex[];
}

export interface MaterializedViewIndex {
  name?: string;
  columns: string[];
  unique?: boolean;
}

export interface MaterializedViewSecurityConfig {
  defaultExcludeAllSecured: boolean;
  securedWhitelist: string[];
}

export interface TaxonExclusionBranchConfig {
  rootScientificName: string;
  exceptDescendantScientificNames?: string[];
}

export interface MaterializedViewTaxonExclusionConfig {
  excludedBranches: TaxonExclusionBranchConfig[];
}
