/**
 * Structured value of a taxon-valued submitted property, as returned by the indexed-property read
 * paths (search result rows and the feature-detail properties list).
 *
 * Declared as a type alias (not an interface) so it stays assignable to `JsonValue`.
 */
export type TaxonPropertyValue = {
  /** BioHub taxon identifier; identifies the taxon a link targets. */
  taxon_id: number;
  /** ITIS taxonomic serial number. */
  tsn: number;
  /** ITIS taxonomic rank (e.g. `Species`), when known. */
  rank: string | null;
  /** Display text: the taxon scientific name. */
  label: string;
};

/**
 * Value of an indexed submitted property: a plain string for scalar-typed properties, or a structured
 * reference value carrying a display `label` plus the stable identifiers the UI links with.
 */
export type SubmissionPropertyValue = string | TaxonPropertyValue;
