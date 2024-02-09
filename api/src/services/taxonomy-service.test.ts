import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TaxonomyRepository } from '../repositories/taxonomy-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ItisService, ItisSolrSearchResponse } from './itis-service';
import { TaxonomyService } from './taxonomy-service';

chai.use(sinonChai);

describe('TaxonomyService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const getItisSolrSearchResponse: ItisSolrSearchResponse[] = [
    {
      commonNames: ['$commonName'],
      kingdom: 'kingdom',
      name: 'name',
      parentTSN: 'parentTSN',
      scientificName: 'scientificName',
      tsn: 'tsn',
      updateDate: 'updateDate',
      usage: 'usage'
    }
  ];

  it('constructs', () => {
    const mockDBConnection = getMockDBConnection();

    const taxonomyService = new TaxonomyService(mockDBConnection);
    expect(taxonomyService).to.be.instanceof(TaxonomyService);
  });

  describe('getTaxonByTsnIds', () => {
    it('if all records exist in db should return array of taxon records', async () => {
      const getTaxonRecord = [
        {
          taxon_id: 1,
          itis_tsn: 1,
          bc_taxon_code: 'bc_taxon_code',
          itis_scientific_name: 'itis_scientific_name',
          common_name: 'common_name',
          itis_data: {},
          record_effective_date: 'record_effective_date',
          record_end_date: 'record_end_date',
          create_date: 'create_date',
          create_user: 1,
          update_date: 'update_date',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const repo = sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds').resolves(getTaxonRecord);

      const response = await taxonomyService.getTaxonByTsnIds([1]);

      expect(repo).to.be.calledTwice;
      expect(response).to.be.eql([{ tsn: 1, commonName: 'common_name', scientificName: 'itis_scientific_name' }]);
    });

    it('if some records do not exist in db should return array of taxon records', async () => {
      const getTaxonRecord = [
        {
          taxon_id: 1,
          itis_tsn: 1,
          bc_taxon_code: 'bc_taxon_code',
          itis_scientific_name: 'itis_scientific_name',
          common_name: 'common_name',
          itis_data: {},
          record_effective_date: 'record_effective_date',
          record_end_date: 'record_end_date',
          create_date: 'create_date',
          create_user: 1,
          update_date: 'update_date',
          update_user: 1,
          revision_count: 1
        },
        {
          taxon_id: 2,
          itis_tsn: 2,
          bc_taxon_code: 'bc_taxon_code',
          itis_scientific_name: 'itis_scientific_name',
          common_name: 'common_name',
          itis_data: {},
          record_effective_date: 'record_effective_date',
          record_end_date: 'record_end_date',
          create_date: 'create_date',
          create_user: 1,
          update_date: 'update_date',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const getTaxonByTsnIdsStub = sinon
        .stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds')
        .onCall(0)
        .resolves([getTaxonRecord[0]])
        .onCall(1)
        .resolves([...getTaxonRecord]);

      const searchItisByTSNStub = sinon
        .stub(ItisService.prototype, 'searchItisByTSN')
        .resolves(getItisSolrSearchResponse);

      const addItisTaxonRecordStub = sinon.stub(TaxonomyService.prototype, 'addItisTaxonRecord').resolves();

      const response = await taxonomyService.getTaxonByTsnIds([1, 2]);

      expect(getTaxonByTsnIdsStub).to.be.calledTwice;
      expect(searchItisByTSNStub).to.be.calledOnce;
      expect(addItisTaxonRecordStub).to.be.calledOnce;
      expect(response).to.be.eql([
        { tsn: 1, commonName: 'common_name', scientificName: 'itis_scientific_name' },
        { tsn: 2, commonName: 'common_name', scientificName: 'itis_scientific_name' }
      ]);
    });
  });

  describe('addItisTaxonRecord', () => {
    it('should add a new taxon record', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const addItisTaxonRecordStub = sinon.stub(TaxonomyRepository.prototype, 'addItisTaxonRecord').resolves();

      await taxonomyService.addItisTaxonRecord(getItisSolrSearchResponse[0]);

      expect(addItisTaxonRecordStub).to.be.calledOnce;
    });
  });

  describe('deleteTaxonRecord', () => {
    it('should delete a taxon record', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const deleteTaxonRecordStub = sinon.stub(TaxonomyRepository.prototype, 'deleteTaxonRecord').resolves();

      await taxonomyService.deleteTaxonRecord(1);

      expect(deleteTaxonRecordStub).to.be.calledOnce;
    });
  });
});
