import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Code, CreateCode } from '../models/code';
import { CodeTableRepository } from '../repositories/code-table-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { CodeTableService } from './code-table-service';

chai.use(sinonChai);

describe('CodeTableService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: Code = {
    code_id: 1,
    code_category_id: 2,
    value: 'adult',
    label: 'Adult',
    description: 'Adult life stage',
    version: 'v1'
  };

  const createPayload: CreateCode = {
    code_category_id: 2,
    value: 'adult',
    label: 'Adult',
    description: 'Adult life stage',
    version: 'v1'
  };

  it('delegates create', async () => {
    const service = new CodeTableService(getMockDBConnection());
    const stub = sinon.stub(CodeTableRepository.prototype, 'insertCode').resolves(mockRow);

    const result = await service.createCode(createPayload);

    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new CodeTableService(getMockDBConnection());
    const stub = sinon.stub(CodeTableRepository.prototype, 'getCodeById').resolves(mockRow);

    const result = await service.getCodeById(1);

    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getByCodeCategoryId', async () => {
    const service = new CodeTableService(getMockDBConnection());
    const stub = sinon.stub(CodeTableRepository.prototype, 'getCodesByCodeCategoryId').resolves([mockRow]);

    const result = await service.getCodesByCodeCategoryId(2);

    expect(stub).to.have.been.calledOnceWith(2);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new CodeTableService(getMockDBConnection());
    sinon.stub(CodeTableRepository.prototype, 'insertCode').rejects(new Error('DB error'));

    try {
      await service.createCode(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
