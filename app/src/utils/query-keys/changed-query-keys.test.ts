import { createTestQueryClient } from 'test-helpers/query-client';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from './changed-query-keys';
import { downloadQueryKeys } from './download-query-keys';
import { searchQueryKeys } from './search-query-keys';
import { submissionQueryKeys } from './submission-query-keys';
import { tagQueryKeys } from './tag-query-keys';
import { ticketQueryKeys } from './ticket-query-keys';

describe('changedQueryKeys', () => {
  it.each([
    ['team membership', changedQueryKeys.teamMembership],
    ['team', changedQueryKeys.team],
    ['team assignment', changedQueryKeys.teamPolicy],
    ['policy', changedQueryKeys.policy],
    ['policy detail', changedQueryKeys.policyListings],
    ['user roles', changedQueryKeys.systemUser],
    ['security rule', changedQueryKeys.securityRule]
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

  it('discards keyword summaries as well as feature searches after upload approval', async () => {
    const client = createTestQueryClient();
    const reads = [
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

  it("refreshes only the changed tag's rules after a rule is created or enabled, and ticket tags after an edit or delete", async () => {
    const client = createTestQueryClient();
    const page = { page: 1, limit: 10 };
    const changedRules = tagQueryKeys.ruleList('tag-1', page);
    const changedRule = tagQueryKeys.ruleDetail('tag-1', 'rule-1');
    const otherRules = tagQueryKeys.ruleList('tag-2', page);
    const ticketTags = ticketQueryKeys.tags('ticket-1');
    const reads = [changedRules, changedRule, otherRules, ticketTags];
    const seed = () => reads.forEach((key) => client.setQueryData(key, 'old'));

    seed();
    await refreshChangedQueries(client, changedQueryKeys.tagRule('tag-1'));

    expect(client.getQueryData(changedRules)).toBeUndefined();
    expect(client.getQueryData(changedRule)).toBeUndefined();
    expect(client.getQueryData(otherRules)).toBe('old');
    expect(client.getQueryData(ticketTags)).toBe('old');

    seed();
    await refreshChangedQueries(client, changedQueryKeys.tagRuleApplied('tag-1'));

    expect(client.getQueryData(changedRules)).toBeUndefined();
    expect(client.getQueryData(otherRules)).toBe('old');
    expect(client.getQueryData(ticketTags)).toBeUndefined();
    client.clear();
  });
});
