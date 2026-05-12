export enum PRIORITY_FEATURE_TYPE {
  DATASET = 'dataset',
  SPECIES_OBSERVATION = 'species_observation',
  TELEMETRY = 'telemetry',
  REPORT = 'report'
}

/**
 * Feature types that surface in the landing-page Features dropdown.
 *
 * The first eight types carry an `sf.data->>'name'` and have been displayable since the
 * dropdown shipped. The remaining eight are researcher-typeable (animal aliases, marking
 * colours, capture/mortality metadata, telemetry serial numbers, habitat codes, file
 * names/titles) but carry no `name`; their rows render via a `COALESCE(name, matched_fragment)`
 * fallback in `_makeFindFeaturesQuery`.
 *
 * `file` and `report` may both surface for the same physical document — `report` is the
 * formal-output flavour of an upload, `file` is the generic attachment. Treat the duplication
 * as expected until product asks for dedup.
 *
 * Excluded with reasons:
 *   - `codeset`               — catalog upload, only an `object` property, nothing user-typeable
 *   - `species_observation`   — already canonical on the Taxa pane; would duplicate the same result
 *   - `release`               — only `comment` (free text) is searchable; not a researcher's mental query target
 *   - `sample_period`         — only `site_identifier` is searchable, and `sample_site` (in allowlist) carries the same string — pure overlap
 *   - `measurement`           — high cardinality (1000s per study) would crowd the dropdown; revisit if product wants attribute-level data discovery as a search affordance
 *   - `telemetry_frequency`   — only `frequency_unit` is searchable, and values are unit strings like "MHz" — useless labels
 *
 * `telemetry` is intentionally NOT in this list. It has no string / code / taxon properties
 * today, so allowlist membership has no functional effect. If a future schema migration adds
 * a searchable property, the reviewer of that migration owns the decision about surfacing
 * pings here.
 */
export const LANDING_PAGE_FEATURE_TYPES = [
  'block',
  'dataset',
  'habitat_feature',
  'report',
  'sample_site',
  'sample_technique',
  'stratum',
  'study_area',
  'animal',
  'capture',
  'ecological_unit',
  'file',
  'marking',
  'mortality',
  'telemetry_deployment',
  'telemetry_device'
] as const;
