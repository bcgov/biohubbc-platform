import { TaxonRecord } from '../models/taxon';

/**
 * Check whether a cached taxon row needs hierarchy repair.
 *
 * A null `parent_taxon_id` usually means the row has not been linked to its immediate parent locally.
 * Kingdom rows are the temporary exception: they are treated as intentionally parentless until the taxon
 * cache has an explicit hierarchy-complete marker.
 *
 * @param {TaxonRecord} record Cached taxon row.
 * @return {*}  {boolean} True when the local parent relationship has not been resolved.
 */
export const taxonNeedsHierarchyRepair = (record: TaxonRecord): boolean =>
  record.parent_taxon_id == null && record.rank?.toLowerCase() !== 'kingdom';

/**
 * Check whether a cached taxon row needs rank repair.
 *
 * Rows created before `taxon.rank` existed can resolve to a local `taxon_id` but still lack the
 * first-class rank value. A null `rank` marks those rows for a rank fetch and patch instead of an insert.
 *
 * @param {TaxonRecord} record Cached taxon row.
 * @return {*}  {boolean} True when the first-class rank field is incomplete.
 */
export const taxonNeedsRankRepair = (record: TaxonRecord): boolean => record.rank == null;
