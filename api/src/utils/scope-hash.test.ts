import { expect } from 'chai';
import { describe, it } from 'mocha';
import { computeScopeHash } from './scope-hash';

describe('computeScopeHash', () => {
  it('produces consistent output for the same input', () => {
    const urn = 'urn:10:telemetry:*';
    expect(computeScopeHash(urn)).to.equal(computeScopeHash(urn));
  });

  it('produces different output for different URNs', () => {
    const hash1 = computeScopeHash('urn:10:telemetry:*');
    const hash2 = computeScopeHash('urn:20:observation:*');
    expect(hash1).to.not.equal(hash2);
  });

  it('returns a 64-character hex string', () => {
    const hash = computeScopeHash('urn:10:telemetry:*');
    expect(hash).to.have.lengthOf(64);
    expect(hash).to.match(/^[0-9a-f]{64}$/);
  });

  it('returns a known SHA-256 digest for a fixture URN', () => {
    // Pinned value: catches encoding changes (hex vs base64) or algorithm swaps
    const hash = computeScopeHash('urn:*:*:*');
    expect(hash).to.equal('d5c0cf2c4d1368c178817dbbb887684c87b6235c93c47443ffaf440eaa796f1a');
  });

  it('handles empty string input', () => {
    const hash = computeScopeHash('');
    expect(hash).to.have.lengthOf(64);
    // SHA-256 of empty string is well-defined
    expect(hash).to.equal('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
