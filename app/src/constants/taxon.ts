/**
 * ITIS ranks (lowercased) whose names are conventionally written in scientific-name style — genus and
 * below — and are therefore italicized when a taxon label is displayed.
 */
export const ITALICIZED_TAXON_RANKS: ReadonlySet<string> = new Set([
  'genus',
  'subgenus',
  'species',
  'subspecies',
  'variety',
  'subvariety',
  'form',
  'subform'
]);
