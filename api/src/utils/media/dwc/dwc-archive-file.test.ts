import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import xlsx from 'xlsx';
import { CSVWorksheet } from '../csv/csv-file';
import { ArchiveFile } from '../media-file';
import { DWCArchive } from './dwc-archive-file';
chai.use(sinonChai);

describe('dwc-archive-file', () => {
  describe('DWCArchive', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('builds DWCAchive File with empty mediaFiles', () => {
      const testFile = {
        fileName: 'file',
        mimetype: 'type',
        buffer: {} as unknown as Buffer,
        mediaFiles: []
      } as unknown as ArchiveFile;

      const dwca = new DWCArchive(testFile);

      expect(dwca.mediaValidation).eql({ fileName: 'file', fileErrors: [], isValid: true });
    });

    it('builds DWCAchive File with only metaData', () => {
      const testFile = {
        fileName: 'file',
        mimetype: 'type',
        buffer: {} as unknown as Buffer,
        mediaFiles: [{ name: 'eml' }]
      } as unknown as ArchiveFile;

      const dwca = new DWCArchive(testFile);

      expect(dwca.mediaValidation).eql({ fileName: 'file', fileErrors: [], isValid: true });
      expect(dwca.isMetaDataOnly()).eql(true);
    });

    it('initializes worksheets with one file', () => {
      const buffer = Buffer.alloc(1024 * 1024 * 10, '.');

      const testFile = {
        fileName: 'file',
        mimetype: 'type',
        buffer: {} as unknown as Buffer,
        mediaFiles: [{ name: 'event', buffer: buffer }]
      } as unknown as ArchiveFile;

      const dwca = new DWCArchive(testFile);

      const csvw = new CSVWorksheet('event', xlsx.read(buffer).Sheets['Sheet1']);

      expect(dwca.mediaValidation).eql({ fileName: 'file', fileErrors: [], isValid: true });
      expect(dwca.worksheets.event).eql(csvw);
    });
  });
});
