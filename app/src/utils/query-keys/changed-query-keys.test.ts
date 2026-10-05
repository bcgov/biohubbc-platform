import { createTestQueryClient } from 'test-helpers/query-client';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from './changed-query-keys';
import { downloadQueryKeys } from './download-query-keys';
import { searchQueryKeys } from './search-query-keys';
import { submissionQueryKeys } from './submission-query-keys';
import { ticketQueryKeys } from './ticket-query-keys';

describe('changedQueryKeys', () => {
  it.each([
    ['team membership', changedQueryKeys.teamMembership],
    ['team', changedQueryKeys.team],
    ['team assignment', changedQueryKeys.teamPolicy],
    ['policy', changedQueryKeys.policy],
    ['policy detail', changedQueryKeys.policyListings],
    ['user roles', changedQueryKeys.systemUser],
    ['security reason', changedQueryKeys.securityReason]
  ] as const)(
    'discards permission-sensitive reads after a %s change without dropping search metadata',
    async (_label, keys) => {
      const client = createTestQueryClient();
      const reads = [
        searchQueryKeys.featureCount('observation', undefined, null),
        searchQueryKeys.featureResults('observation', undefined, null, { limit: 10 }),
        submissionQueryKeys.featureDetail(1, 2),
        submissionQueryKeys.featureProperties(1, 2, { page: 1, limit: 10 }),
        downloadQueryKeys.detail('download'),
        ticketQueryKeys.detail('user', 'ticket')
      ];
      for (const key of reads) {
        client.setQueryData(key, 'old access');
      }
      const metadata = searchQueryKeys.propertyOptions('', []);
      client.setQueryData(metadata, 'property definitions');

      await refreshChangedQueries(client, keys());

      for (const key of reads) {
        expect(client.getQueryData(key)).toBeUndefined();
      }
      expect(client.getQueryData(metadata)).toBe('property definitions');
      client.clear();
    }
  );

  it('discards keyword results and summaries as well as feature searches after upload approval', async () => {
    const client = createTestQueryClient();
    const reads = [
      searchQueryKeys.keywordRecords('bear', { page: 1, limit: 10 }),
      searchQueryKeys.keywordSummary('bear'),
      searchQueryKeys.keywordSummary(''),
      searchQueryKeys.featureCount('observation', undefined, null)
    ];
    for (const key of reads) {
      client.setQueryData(key, 'before publication');
    }
    await refreshChangedQueries(client, changedQueryKeys.uploadDecision('ticket'));
    for (const key of reads) {
      expect(client.getQueryData(key)).toBeUndefined();
    }
    client.clear();
  });
});
