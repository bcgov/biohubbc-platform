import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { useCallback, useMemo, useState } from 'react';

/**
 * Applies the order a dashboard's sort menu chose to the submission list as the query currently holds it.
 *
 * The order is kept as submission ids rather than as a copy of the list, so a refetch still updates every card.
 * Submissions the chosen order has not seen keep their server order, after the ordered ones.
 *
 * @param {SubmissionRecordWithSecurityAndRootFeature[] | undefined} records The list as the query holds it.
 * @returns The list in display order, and the callback the sort menu reports a new order to.
 */
export const useSubmissionRecordOrder = (records: SubmissionRecordWithSecurityAndRootFeature[] | undefined) => {
  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);

  const orderedRecords = useMemo(() => {
    if (!records) {
      return [];
    }

    if (!orderedIds) {
      return records;
    }

    const positions = new Map(orderedIds.map((submissionId, index) => [submissionId, index]));
    const positionOf = (record: SubmissionRecordWithSecurityAndRootFeature) =>
      positions.get(record.submission_id) ?? orderedIds.length;

    return [...records].sort((a, b) => positionOf(a) - positionOf(b));
  }, [records, orderedIds]);

  const handleSortSubmissions = useCallback((sortedRecords: SubmissionRecordWithSecurityAndRootFeature[]) => {
    setOrderedIds(sortedRecords.map((record) => record.submission_id));
  }, []);

  return { orderedRecords, handleSortSubmissions };
};
