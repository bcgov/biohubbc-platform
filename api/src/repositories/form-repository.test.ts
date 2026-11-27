import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { Form } from '../models/form';
import { FormRepository } from './form-repository';

const mockForm: Form = {
  form_id: 1,
  slug: 'caribou',
  contributor_id: 3,
  team_id: '22222222-2222-2222-2222-222222222222',
  name: 'Caribou',
  description: null,
  is_public: false,
  record_end_date: null
};

describe('FormRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getForms', () => {
    it('lists active forms with their latest active version, matching the keyword on name or slug', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      await repository.getForms({ keyword: 'cari' }, { page: 2, limit: 10, sort: 'name', order: 'asc' });

      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).to.include('"f"."record_end_date" is null');
      expect(sql).to.include('LEFT JOIN LATERAL');
      expect(sql).to.include('ORDER BY version_number DESC');
      expect(sql).to.include('"f"."name" ilike');
      expect(sql).to.include('"f"."slug" ilike');
      expect(sql).to.include('order by "f"."name" asc');
      expect(bindings).to.include('%cari%');
      expect(bindings).to.include(10);
    });

    it('applies no keyword predicate without a keyword', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      await repository.getForms({}, { page: 1, limit: 10 });

      const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sql).not.to.include('ilike');
    });
  });

  describe('getFormsCount', () => {
    it('counts active forms with the list predicates', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ count: 4 }]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getFormsCount({ keyword: 'cari' });

      const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(result).to.eql({ count: 4 });
      expect(sql).to.include('count(*)');
      expect(sql).to.include('"f"."record_end_date" is null');
    });
  });

  describe('findActiveFormBySlug', () => {
    it('finds only an active form', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([mockForm]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.findActiveFormBySlug('caribou');

      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(result).to.eql(mockForm);
      expect(sql).to.include('"record_end_date" is null');
      expect(bindings).to.eql(['caribou']);
    });

    it('returns undefined when no active form uses the slug', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      expect(await repository.findActiveFormBySlug('missing')).to.be.undefined;
    });
  });

  describe('getForm', () => {
    it('reads a form, including a retired form', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([mockForm]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getForm(1);

      const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(result).to.eql(mockForm);
      expect(sql).not.to.include('record_end_date" is null');
    });
  });

  describe('insertForm', () => {
    it('inserts the slug, contributor, administration team and metadata', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([mockForm]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertForm({
        slug: 'caribou',
        contributorId: 3,
        teamId: mockForm.team_id,
        name: 'Caribou',
        description: null,
        isPublic: false
      });

      const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(result).to.eql(mockForm);
      expect(sql).to.include('insert into "form"');
      expect(bindings).to.include.members(['caribou', 3, mockForm.team_id, 'Caribou', false]);
    });
  });

  describe('updateForm', () => {
    it('updates only the mutable metadata', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([mockForm]));
      const repository = new FormRepository(getMockDBConnection({ knex: knexStub }));

      await repository.updateForm(1, { name: 'Renamed', description: 'About', isPublic: true });

      const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
      const setClause = sql.split(' where ')[0];
      expect(setClause).to.include('update "form" set');
      expect(setClause).not.to.include('"slug"');
      expect(setClause).not.to.include('"contributor_id"');
      expect(setClause).not.to.include('"team_id"');
    });
  });
});
