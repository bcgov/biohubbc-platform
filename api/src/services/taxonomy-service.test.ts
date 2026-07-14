import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { TaxonRecord } from '../models/taxon';
import { TaxonomyRepository } from '../repositories/taxonomy-repository';
import { DBService } from './db-service';
import { ItisService, ItisSolrSearchResponse, TSNWithHierarchy } from './itis-service';
import { TaxonomyService } from './taxonomy-service';

chai.use(sinonChai);

describe('TaxonomyService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const buildTaxonRecord = (overrides: Partial<TaxonRecord> = {}): TaxonRecord => ({
    taxon_id: 1,
    itis_tsn: 1,
    parent_itis_tsn: null,
    parent_taxon_id: null,
    bc_taxon_code: 'bc_taxon_code',
    itis_scientific_name: 'itis_scientific_name',
    rank: 'species',
    common_name: 'common_name',
    itis_data: {},
    itis_update_date: '2020-01-01',
    ...overrides
  });

  const buildItisSolrSearchResponse = (tsn: string): ItisSolrSearchResponse => ({
    commonNames: ['$commonNames'],
    kingdom: 'kingdom',
    name: 'name',
    parentTSN: 'parentTSN',
    scientificName: 'scientificName',
    tsn,
    updateDate: 'updateDate',
    usage: 'usage',
    rank: 'rank'
  });

  it('constructs', () => {
    const mockDBConnection = getMockDBConnection();

    const taxonomyService = new TaxonomyService(mockDBConnection);
    expect(taxonomyService).to.be.instanceof(TaxonomyService);
  });

  describe('getTaxonByTsnIds', () => {
    it('returns empty without querying when no TSNs are provided', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);
      const repo = sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds').resolves([]);

      const response = await taxonomyService.getTaxonByTsnIds([]);

      expect(response).to.eql([]);
      expect(repo).to.not.have.been.called;
    });

    it('if all records exist in db should return array of taxon records without ensuring hierarchy', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const repo = sinon
        .stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds')
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 1 })]);

      const ensureStub = sinon.stub(TaxonomyService.prototype, 'ensureTaxonHierarchyByTsnIds').resolves();

      const response = await taxonomyService.getTaxonByTsnIds([1]);

      expect(repo).to.be.calledOnce;
      expect(ensureStub).to.not.have.been.called;
      expect(response).to.be.eql([{ tsn: 1, commonNames: ['common_name'], scientificName: 'itis_scientific_name' }]);
    });

    it('if some records do not exist in db should ensure hierarchy then return all requested records', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const repo = sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds');
      // Initial existence check returns only taxon 1.
      repo.onFirstCall().resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 1 })]);
      // Re-read after ensuring hierarchy returns both requested taxa.
      repo
        .onSecondCall()
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 1 }), buildTaxonRecord({ taxon_id: 2, itis_tsn: 2 })]);

      const ensureStub = sinon.stub(TaxonomyService.prototype, 'ensureTaxonHierarchyByTsnIds').resolves();

      const response = await taxonomyService.getTaxonByTsnIds([1, 2]);

      expect(repo).to.be.calledTwice;
      expect(ensureStub).to.be.calledOnceWith([2]);
      expect(response).to.be.eql([
        { tsn: 1, commonNames: ['common_name'], scientificName: 'itis_scientific_name' },
        { tsn: 2, commonNames: ['common_name'], scientificName: 'itis_scientific_name' }
      ]);
    });
  });

  describe('ensureTaxonHierarchyByTsnIds', () => {
    it('does nothing when no tsn ids are provided', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const repo = sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds').resolves([]);
      const getHierarchyStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([]);

      await taxonomyService.ensureTaxonHierarchyByTsnIds([]);

      expect(repo).to.not.have.been.called;
      expect(getHierarchyStub).to.not.have.been.called;
    });

    it('does nothing when all requested taxa already exist locally with resolved hierarchy', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      sinon
        .stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds')
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 1, parent_taxon_id: 2, rank: 'species' })]);

      const getHierarchyStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([]);
      const updateParentStub = sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([1]);

      expect(getHierarchyStub).to.not.have.been.called;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('does not fetch hierarchy when an existing kingdom taxon has no parent link', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      sinon
        .stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds')
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 1, rank: 'Kingdom' })]);

      const getHierarchyStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([]);
      const updateParentStub = sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([1]);

      expect(getHierarchyStub).to.not.have.been.called;
      expect(updateParentStub).to.not.have.been.called;
    });

    it('fetches hierarchy when an existing non-kingdom taxon has no parent link', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const getTaxonByTsnIdsStub = sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds');
      getTaxonByTsnIdsStub
        .onFirstCall()
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 180542, rank: 'Species' })]);
      getTaxonByTsnIdsStub
        .onSecondCall()
        .resolves([
          buildTaxonRecord({ taxon_id: 1, itis_tsn: 180540, rank: 'kingdom' }),
          buildTaxonRecord({ taxon_id: 2, itis_tsn: 180541, parent_taxon_id: 1, rank: 'genus' }),
          buildTaxonRecord({ taxon_id: 3, itis_tsn: 180542, parent_taxon_id: null, rank: 'species' })
        ]);

      const getHierarchyStub = sinon
        .stub(ItisService.prototype, 'getHierarchyForTSNs')
        .resolves([{ tsn: 180542, hierarchy: [180540, 180541, 180542] }]);
      const searchItisByTSNStub = sinon.stub(ItisService.prototype, 'searchItisByTSN').resolves([]);
      const updateParentStub = sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([180542]);

      expect(getHierarchyStub).to.be.calledOnceWith([180542]);
      expect(searchItisByTSNStub).to.not.have.been.called;
      expect(updateParentStub).to.be.calledOnceWith([
        { itis_tsn: 180541, parent_itis_tsn: 180540 },
        { itis_tsn: 180542, parent_itis_tsn: 180541 }
      ]);
    });

    it('patches rank when an existing taxon has resolved hierarchy but missing rank', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      sinon
        .stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds')
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 180542, parent_taxon_id: 2, rank: null })]);

      const getHierarchyStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([]);
      const searchItisByTSNStub = sinon
        .stub(ItisService.prototype, 'searchItisByTSN')
        .resolves([buildItisSolrSearchResponse('180542')]);
      const patchTaxonRanksStub = sinon.stub(TaxonomyRepository.prototype, 'patchTaxonRanks').resolves();
      const updateParentStub = sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([180542]);

      expect(getHierarchyStub).to.not.have.been.called;
      expect(searchItisByTSNStub).to.be.calledOnceWith([180542]);
      expect(patchTaxonRanksStub).to.be.calledOnceWith([{ itis_tsn: 180542, rank: 'rank' }]);
      expect(updateParentStub).to.not.have.been.called;
    });

    it('fetches ITIS details once for missing lineage taxa and rank patches', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const getTaxonByTsnIdsStub = sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds');
      getTaxonByTsnIdsStub
        .onFirstCall()
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 180542, parent_taxon_id: null, rank: null })]);
      getTaxonByTsnIdsStub
        .onSecondCall()
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 180542, parent_taxon_id: null, rank: null })]);

      sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([{ tsn: 180542, hierarchy: [180540, 180542] }]);
      const searchItisByTSNStub = sinon
        .stub(ItisService.prototype, 'searchItisByTSN')
        .resolves([buildItisSolrSearchResponse('180540'), buildItisSolrSearchResponse('180542')]);
      const addItisTaxonRecordsStub = sinon.stub(TaxonomyService.prototype, 'addItisTaxonRecords').resolves([]);
      const patchTaxonRanksStub = sinon.stub(TaxonomyRepository.prototype, 'patchTaxonRanks').resolves();
      sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([180542]);

      expect(searchItisByTSNStub).to.be.calledOnce;
      expect(searchItisByTSNStub.firstCall.args[0]).to.have.members([180540, 180542]);
      expect(addItisTaxonRecordsStub).to.be.calledOnce;
      expect(addItisTaxonRecordsStub.firstCall.args[0].map((response) => Number(response.tsn))).to.eql([180540]);
      expect(patchTaxonRanksStub).to.be.calledOnceWith([{ itis_tsn: 180542, rank: 'rank' }]);
    });

    it('patches rank when hierarchy lookup returns no lineage for an incomplete existing taxon', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      sinon
        .stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds')
        .resolves([buildTaxonRecord({ taxon_id: 1, itis_tsn: 180542, parent_taxon_id: null, rank: null })]);
      sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([]);
      sinon.stub(ItisService.prototype, 'searchItisByTSN').resolves([buildItisSolrSearchResponse('180542')]);
      const patchTaxonRanksStub = sinon.stub(TaxonomyRepository.prototype, 'patchTaxonRanks').resolves();
      const updateParentStub = sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([180542]);

      expect(patchTaxonRanksStub).to.be.calledOnceWith([{ itis_tsn: 180542, rank: 'rank' }]);
      expect(updateParentStub).to.not.have.been.called;
    });

    it('dedupes requested TSNs before checking cache and calling ITIS', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const getTaxonByTsnIdsStub = sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds').resolves([]);
      const getHierarchyStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([]);
      sinon
        .stub(ItisService.prototype, 'searchItisByTSN')
        .resolves([buildItisSolrSearchResponse('1'), buildItisSolrSearchResponse('2')]);
      sinon.stub(TaxonomyService.prototype, 'addItisTaxonRecords').resolves([]);
      sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([2, 1, 2]);

      expect(getTaxonByTsnIdsStub.firstCall.args[0]).to.eql([2, 1]);
      expect(getHierarchyStub).to.have.been.calledOnceWith([2, 1]);
    });

    it('derives parent links from the ordered hierarchyTSN lineage and inserts/reuses the full lineage', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      // Both the initial existence check and the lineage existence check report nothing cached locally.
      sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds').resolves([]);

      // hierarchyTSN = ['180540$180541$180542'] -> ordered lineage [180540, 180541, 180542].
      const hierarchy: TSNWithHierarchy[] = [{ tsn: 180542, hierarchy: [180540, 180541, 180542] }];
      const getHierarchyStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves(hierarchy);

      const searchItisByTSNStub = sinon
        .stub(ItisService.prototype, 'searchItisByTSN')
        .resolves([
          buildItisSolrSearchResponse('180540'),
          buildItisSolrSearchResponse('180541'),
          buildItisSolrSearchResponse('180542')
        ]);

      const addItisTaxonRecordsStub = sinon
        .stub(TaxonomyService.prototype, 'addItisTaxonRecords')
        .resolves([buildTaxonRecord()]);

      const updateParentStub = sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([180542]);

      expect(getHierarchyStub).to.be.calledOnceWith([180542]);
      expect(searchItisByTSNStub).to.be.calledOnceWith([180540, 180541, 180542]);
      expect(addItisTaxonRecordsStub).to.be.calledOnce;

      // 180540 is the lineage root (no parent) and is omitted from the parent pairs.
      expect(updateParentStub).to.be.calledOnceWith([
        { itis_tsn: 180541, parent_itis_tsn: 180540 },
        { itis_tsn: 180542, parent_itis_tsn: 180541 }
      ]);
    });

    it('does not run taxon detail lookups for TSNs missing from ITIS hierarchy results', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds').resolves([]);
      sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([{ tsn: 2, hierarchy: [1, 2] }]);

      const searchItisByTSNStub = sinon
        .stub(ItisService.prototype, 'searchItisByTSN')
        .resolves([buildItisSolrSearchResponse('1'), buildItisSolrSearchResponse('2')]);
      sinon.stub(TaxonomyService.prototype, 'addItisTaxonRecords').resolves([]);
      sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds([2, 3]);

      expect(searchItisByTSNStub).to.have.been.calledOnceWith([1, 2]);
    });

    it('chunks large ITIS hierarchy and taxon lookup requests', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);
      sinon.stub(DBService, 'delay').resolves();
      const requestedTsnIds = Array.from({ length: 205 }, (_, index) => 1000 + index);
      const hierarchy: TSNWithHierarchy[] = requestedTsnIds.map((tsn) => ({ tsn, hierarchy: [1, tsn] }));

      sinon.stub(TaxonomyRepository.prototype, 'getTaxonByTsnIds').resolves([]);
      const getHierarchyStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs');
      getHierarchyStub.onFirstCall().resolves(hierarchy.slice(0, 100));
      getHierarchyStub.onSecondCall().resolves(hierarchy.slice(100, 200));
      getHierarchyStub.onThirdCall().resolves(hierarchy.slice(200));

      const searchItisByTSNStub = sinon
        .stub(ItisService.prototype, 'searchItisByTSN')
        .callsFake(async (tsnIds) => tsnIds.map((tsnId) => buildItisSolrSearchResponse(String(tsnId))));
      sinon.stub(TaxonomyService.prototype, 'addItisTaxonRecords').resolves([]);
      sinon.stub(TaxonomyRepository.prototype, 'updateTaxonParentLinks').resolves();

      await taxonomyService.ensureTaxonHierarchyByTsnIds(requestedTsnIds);

      expect(getHierarchyStub).to.have.callCount(3);
      expect(getHierarchyStub.firstCall.args[0]).to.have.length(100);
      expect(getHierarchyStub.secondCall.args[0]).to.have.length(100);
      expect(getHierarchyStub.thirdCall.args[0]).to.have.length(5);
      expect(searchItisByTSNStub).to.have.callCount(3);
    });
  });

  describe('addItisTaxonRecords', () => {
    it('imports taxon records in bounded batches', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);
      const itisResponses = Array.from({ length: 205 }, (_, index) => buildItisSolrSearchResponse(String(index + 1)));

      const insertTaxonRecordsStub = sinon
        .stub(TaxonomyRepository.prototype, 'insertTaxonRecords')
        .callsFake(async (records) => records.map((record) => buildTaxonRecord({ itis_tsn: record.itis_tsn })));

      const response = await taxonomyService.addItisTaxonRecords(itisResponses);

      expect(response).to.have.length(205);
      expect(insertTaxonRecordsStub).to.have.callCount(3);
      expect(insertTaxonRecordsStub.firstCall.args[0]).to.have.length(100);
      expect(insertTaxonRecordsStub.firstCall.args[0][0].rank).to.equal('rank');
      expect(insertTaxonRecordsStub.secondCall.args[0]).to.have.length(100);
      expect(insertTaxonRecordsStub.thirdCall.args[0]).to.have.length(5);
    });

    it('dedupes taxon records by TSN before bulk insert', async () => {
      const mockDBConnection = getMockDBConnection();

      const taxonomyService = new TaxonomyService(mockDBConnection);

      const insertTaxonRecordsStub = sinon
        .stub(TaxonomyRepository.prototype, 'insertTaxonRecords')
        .callsFake(async (records) => records.map((record) => buildTaxonRecord({ itis_tsn: record.itis_tsn })));

      const response = await taxonomyService.addItisTaxonRecords([
        buildItisSolrSearchResponse('1'),
        buildItisSolrSearchResponse('1'),
        buildItisSolrSearchResponse('2')
      ]);

      expect(response).to.have.length(2);
      expect(insertTaxonRecordsStub).to.have.been.calledOnce;
      expect(insertTaxonRecordsStub.firstCall.args[0].map((record) => record.itis_tsn)).to.eql([1, 2]);
    });
  });
});
