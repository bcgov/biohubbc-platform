import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CodeCategory, CreateCodeCategory } from '../models/code-category';
import { CodeCategoryRepository } from '../repositories/code-category-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { CodeCategoryService } from './code-category-service';

chai.use(sinonChai);

describe('CodeCategoryService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: CodeCategory = {
    code_category_id: 1,
    contributor_id: 10,
    value: 'life_stage',
    label: 'Life stage',
    description: 'Life stage codes',
    version: 'v1'
  };

  const createPayload: CreateCodeCategory = {
    contributor_id: 10,
    value: 'life_stage',
    label: 'Life stage',
    description: 'Life stage codes',
    version: 'v1'
  };

  it('delegates create', async () => {
    const service = new CodeCategoryService(getMockDBConnection());
    const stub = sinon.stub(CodeCategoryRepository.prototype, 'insertCodeCategory').resolves(mockRow);

    const result = await service.createCodeCategory(createPayload);

    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new CodeCategoryService(getMockDBConnection());
    const stub = sinon.stub(CodeCategoryRepository.prototype, 'getCodeCategoryById').resolves(mockRow);

    const result = await service.getCodeCategoryById(1);

    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getByContributorId', async () => {
    const service = new CodeCategoryService(getMockDBConnection());
    const stub = sinon.stub(CodeCategoryRepository.prototype, 'getCodeCategoriesByContributorId').resolves([mockRow]);

    const result = await service.getCodeCategoriesByContributorId(10);

    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new CodeCategoryService(getMockDBConnection());
    sinon.stub(CodeCategoryRepository.prototype, 'insertCodeCategory').rejects(new Error('DB error'));

    try {
      await service.createCodeCategory(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
