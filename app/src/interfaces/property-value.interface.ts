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
 * Structured value of a code-valued submitted property, as returned by the indexed-property read paths.
 */
export type CodePropertyValue = {
  /** Machine-readable key of the codeset the code belongs to. */
  codeset_key: string;
  /** Display label of the codeset. */
  codeset_label: string;
  /** Machine-readable key of the code; with `codeset_key`, identifies the code a link targets. */
  code_key: string;
  /** Display label of the code. */
  code_label: string;
  /** Display text: the code label. */
  label: string;
};

/**
 * Structured value of a feature-valued submitted property, as returned by the indexed-property read paths.
 */
export type FeatureReferencePropertyValue = {
  /** URN of the referenced feature (`urn:<submission_id>:<feature_type_name>:<submission_feature_id>`). */
  urn: string;
  /** Display text: the referenced feature URN. */
  label: string;
};

/**
 * Reference-typed submitted property values. Every member carries a display `label` plus the stable
 * identifiers the UI links with, and is told apart by its identifier keys.
 */
export type StructuredPropertyValue = TaxonPropertyValue | CodePropertyValue | FeatureReferencePropertyValue;

/**
 * Value of an indexed submitted property: a plain string for scalar-typed properties, or a structured
 * reference value.
 */
export type SubmissionPropertyValue = string | StructuredPropertyValue;
