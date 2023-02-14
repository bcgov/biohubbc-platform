import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import xlsx from 'xlsx';
import { CSVWorksheet } from '../csv/csv-file';
import { EMLFile } from '../eml/eml-file';
import { ArchiveFile, MediaFile } from '../media-file';
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

    it('initializes every worksheet', async () => {
      const buffer = Buffer.alloc(1024 * 1024 * 10, '.');

      const testFile = {
        fileName: 'file',
        mimetype: 'type',
        buffer: {} as unknown as Buffer,
        mediaFiles: [
          { name: 'event', buffer: buffer },
          { name: 'occurrence', buffer: buffer },
          { name: 'measurementorfact', buffer: buffer },
          { name: 'resourcerelationship', buffer: buffer },
          { name: 'taxon', buffer: buffer },
          { name: 'location', buffer: buffer },
          { name: 'record', buffer: buffer },
          { name: 'eml', buffer: buffer }
        ]
      } as unknown as ArchiveFile;

      const dwca = new DWCArchive(testFile);

      expect(dwca.mediaValidation).eql({ fileName: 'file', fileErrors: [], isValid: true });
      expect(dwca.worksheets.event).eql(new CSVWorksheet('event', xlsx.read(buffer).Sheets['Sheet1']));
      expect(dwca.worksheets.occurrence).eql(new CSVWorksheet('occurrence', xlsx.read(buffer).Sheets['Sheet1']));
      expect(dwca.worksheets.measurementorfact).eql(
        new CSVWorksheet('measurementorfact', xlsx.read(buffer).Sheets['Sheet1'])
      );
      expect(dwca.worksheets.resourcerelationship).eql(
        new CSVWorksheet('resourcerelationship', xlsx.read(buffer).Sheets['Sheet1'])
      );
      expect(dwca.worksheets.taxon).eql(new CSVWorksheet('taxon', xlsx.read(buffer).Sheets['Sheet1']));
      expect(dwca.worksheets.location).eql(new CSVWorksheet('location', xlsx.read(buffer).Sheets['Sheet1']));
      expect(dwca.worksheets.record).eql(new CSVWorksheet('record', xlsx.read(buffer).Sheets['Sheet1']));
      expect(dwca.eml).eql(new EMLFile({ name: 'eml', buffer: buffer } as unknown as MediaFile));
    });
  });
});
