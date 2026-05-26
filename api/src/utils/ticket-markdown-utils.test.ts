import { expect } from 'chai';
import { getTicketArtifactIdsFromMarkdown } from './ticket-markdown-utils';

describe('ticket-markdown-utils', () => {
  describe('getTicketArtifactIdsFromMarkdown', () => {
    it('extracts unique ticket artifact ids from markdown links and images', () => {
      const result = getTicketArtifactIdsFromMarkdown(
        [
          '[file](/artifact/55555555-5555-4555-8555-555555555555)',
          '![image](/artifact/66666666-6666-4666-8666-666666666666)',
          '[duplicate](/artifact/55555555-5555-4555-8555-555555555555)'
        ].join(' ')
      );

      expect(result).to.eql(['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666']);
    });

    it('ignores non-artifact and malformed markdown links', () => {
      const result = getTicketArtifactIdsFromMarkdown(
        '[external](https://example.com) [bad](/artifact/not-a-uuid) /artifact/55555555-5555-4555-8555-555555555555'
      );

      expect(result).to.eql([]);
    });

    it('handles repeated opening brackets without scanning markdown label text', () => {
      const result = getTicketArtifactIdsFromMarkdown(
        `${'['.repeat(1000)}](/artifact/55555555-5555-4555-8555-555555555555)`
      );

      expect(result).to.eql(['55555555-5555-4555-8555-555555555555']);
    });
  });
});
