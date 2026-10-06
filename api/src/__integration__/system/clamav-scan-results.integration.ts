// Integration tests for ClamAV malware scanning.
//
// Run: make test-sys
// Requires: make web && make clamav

import { expect } from 'chai';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import * as tar from 'tar-stream';
import { _getClamAvScanner } from '../../utils/file-utils';

// EICAR test signature - standard antivirus test string (NOT actual malware)
const EICAR = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;

describe('ClamAV Malware Scanning', function () {
  this.timeout(10000);

  it('should return clean for safe content', async () => {
    const scanner = await _getClamAvScanner();
    const stream = Readable.from(Buffer.from('This is safe content.'));

    const result = await scanner.scanStream(stream);

    expect(result.isInfected).to.be.false;
    expect(result.viruses).to.be.empty;
  });

  it('should detect EICAR test signature as infected', async () => {
    const scanner = await _getClamAvScanner();
    const stream = Readable.from(Buffer.from(EICAR));

    const result = await scanner.scanStream(stream);

    expect(result.isInfected).to.be.true;
    expect(result.viruses).to.include('Eicar-Test-Signature');
  });
  for (const infected of [false, true]) {
    it(`scans tar.gz contents and reports infected=${infected}`, async () => {
      const scanner = await _getClamAvScanner();
      const archive = tar.pack();
      archive.entry({ name: 'files/content.txt' }, infected ? EICAR : 'Safe archive content.');
      archive.finalize();

      const result = await scanner.scanStream(archive.pipe(createGzip()));

      expect(result.isInfected).to.equal(infected);
      if (infected) {
        expect(result.viruses).to.include('Eicar-Test-Signature');
      } else {
        expect(result.viruses).to.have.lengthOf(0);
      }
    });
  }
});

/**
 * Run against a dedicated scanner with CLAMAV_MAX_SCAN_SIZE set to the same
 * small limit on the daemon and test process. Avoid allocating production-sized
 * fixtures when this file runs against the shared development scanner.
 */
describe('ClamAV expanded archive limits', function () {
  this.timeout(10000);

  it('rejects tar.gz content exceeding the scan limit even when compressed bytes fit', async function () {
    const maxScanSize = Number(process.env.CLAMAV_MAX_SCAN_SIZE);
    if (!Number.isSafeInteger(maxScanSize) || maxScanSize < 1024 || maxScanSize > 16 * 1024 * 1024) {
      this.skip();
    }
    const archive = tar.pack();
    archive.entry({ name: 'files/large.txt' }, Buffer.alloc(maxScanSize * 2, 'a'));
    archive.finalize();
    const chunks: Buffer[] = [];
    for await (const chunk of archive.pipe(createGzip())) {
      chunks.push(chunk);
    }
    const compressed = Buffer.concat(chunks);
    expect(compressed.length).to.be.lessThan(maxScanSize);

    const scanner = await _getClamAvScanner();
    const result = await scanner.scanStream(Readable.from(compressed));

    expect(result.isInfected).to.be.true;
    expect(result.viruses.some((virus) => virus.startsWith('Heuristics.Limits.Exceeded'))).to.be.true;
  });
});
