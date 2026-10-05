import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { act, renderHook } from 'test-helpers/test-utils';
import { useSubmissionRecordOrder } from './useSubmissionRecordOrder';

/**
 * Builds a dashboard submission record carrying only what ordering reads.
 *
 * @param {number} submissionId The submission id.
 * @param {string} name The submission name, to tell a refetched record from the original.
 * @returns {SubmissionRecordWithSecurityAndRootFeature} The record.
 */
const makeRecord = (submissionId: number, name = `Submission ${submissionId}`) =>
  ({ submission_id: submissionId, name }) as SubmissionRecordWithSecurityAndRootFeature;

describe('useSubmissionRecordOrder', () => {
  it('returns an empty list before the query has data', () => {
    const { result } = renderHook(() => useSubmissionRecordOrder(undefined));

    expect(result.current.orderedRecords).to.be.empty;
  });

  it('returns the query data as it is until the sort menu chooses an order', () => {
    const records = [makeRecord(1), makeRecord(2)];

    const { result } = renderHook(() => useSubmissionRecordOrder(records));

    expect(result.current.orderedRecords).toBe(records);
  });

  it('keeps the chosen order across a refetch, showing the refetched records', () => {
    const { result, rerender } = renderHook(({ records }) => useSubmissionRecordOrder(records), {
      initialProps: { records: [makeRecord(1), makeRecord(2), makeRecord(3)] }
    });

    act(() => result.current.handleSortSubmissions([makeRecord(3), makeRecord(1), makeRecord(2)]));

    rerender({ records: [makeRecord(1, 'Renamed'), makeRecord(4), makeRecord(2), makeRecord(3)] });

    expect(result.current.orderedRecords.map((record) => [record.submission_id, record.name])).toEqual([
      [3, 'Submission 3'],
      [1, 'Renamed'],
      [2, 'Submission 2'],
      [4, 'Submission 4']
    ]);
  });
});
