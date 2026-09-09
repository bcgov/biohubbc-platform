export type MaterialisedViewName =
  | 'wld_telemetry_all'
  | 'wld_telemetry_public'
  | 'wld_observations_all'
  | 'wld_observations_public'
  | 'wld_incidental_all'
  | 'wld_incidental_public';

export type MaterialisedViewCommentMap = Record<string, string>;
export interface MaterialisedViewColumn {
  alias: string;
  expression: string;
}

export type SiteFilter = 'linked' | 'incidental';
