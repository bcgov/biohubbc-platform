// Integration tests for ClamAV malware scanning.
//
// Run: make test-sys
// Requires: make web && make clamav

import { Readable } from 'stream';
import { _getClamAvScanner } from '../../utils/file-utils';

// EICAR test signature - standard antivirus test string (NOT actual malware)
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe('ClamAV Malware Scanning', function () {
  this.timeout(10000);

  it('should return clean for safe content', async () => {
    const scanner = await _getClamAvScanner();
    const stream = Readable.from(Buffer.from('This is safe content.'));

    const result = await scanner.scanStream(stream);

    if (result.isInfected !== false) {
      throw new Error(`Expected isInfected=false, got ${result.isInfected}`);
    }
    if (result.viruses.length !== 0) {
      throw new Error(`Expected no viruses, got ${JSON.stringify(result.viruses)}`);
    }
  });

  it('should detect EICAR test signature as infected', async () => {
    const scanner = await _getClamAvScanner();
    const stream = Readable.from(Buffer.from(EICAR));

    const result = await scanner.scanStream(stream);

    if (result.isInfected !== true) {
      throw new Error(`Expected isInfected=true, got ${result.isInfected}`);
    }
    if (!result.viruses.includes('Eicar-Test-Signature')) {
      throw new Error(`Expected Eicar-Test-Signature, got ${JSON.stringify(result.viruses)}`);
    }
  });
});
