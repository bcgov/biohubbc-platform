import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { deleteCartSubmissionFeature } from '.';
import * as db from '../../../../../database/db';
import { ApiError } from '../../../../../errors/api-error';
import { HTTP500 } from '../../../../../errors/http-error';
import { CartSubmissionFeatureService } from '../../../../../services/cart-submission-feature-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';

chai.use(sinonChai);

describe('DELETE /cart/{cartId}/feature/{cartSubmissionFeatureId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw error if DB connection fails to open', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

    const requestHandler = deleteCartSubmissionFeature();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params.cartId = 'fake-cart-id';
    mockReq.params.cartSubmissionFeatureId = '123'; // Mock feature ID

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected handler to throw');
    } catch (error) {
      expect((error as HTTP500).message).to.equal('DB open failed');
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    }
  });

  it('should remove the feature from the cart and return 200', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    // Mocking the service method
    const removeSubmissionFeatureStub = sinon
      .stub(CartSubmissionFeatureService.prototype, 'removeSubmissionFeaturesFromCart')
      .resolves();

    const requestHandler = deleteCartSubmissionFeature();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params.cartId = 'fake-cart-id';
    mockReq.params.cartSubmissionFeatureId = '123'; // Mock feature ID

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.message).to.equal('Feature removed from cart successfully');
    expect(removeSubmissionFeatureStub).to.have.been.calledOnceWith('fake-cart-id', sinon.match.any, ['123']);
    expect(mockDBConnection.commit).to.have.been.calledOnce;
    expect(mockDBConnection.release).to.have.been.calledOnce;
  });

  it('should handle errors thrown by the service layer', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    sinon
      .stub(CartSubmissionFeatureService.prototype, 'removeSubmissionFeaturesFromCart')
      .rejects(new Error('Failed to remove feature'));

    const requestHandler = deleteCartSubmissionFeature();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params.cartId = 'fake-cart-id';
    mockReq.params.cartSubmissionFeatureId = '123'; // Mock feature ID

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected handler to throw');
    } catch (error) {
      expect((error as ApiError).message).to.equal('Failed to remove feature');
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    }
  });

  it('should handle database commit/rollback issues', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub().rejects(new Error('Commit failed')),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    sinon.stub(CartSubmissionFeatureService.prototype, 'removeSubmissionFeaturesFromCart').resolves();

    const requestHandler = deleteCartSubmissionFeature();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params.cartId = 'fake-cart-id';
    mockReq.params.cartSubmissionFeatureId = '123'; // Mock feature ID

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected handler to throw');
    } catch (error) {
      expect((error as ApiError).message).to.equal('Commit failed');
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    }
  });
});
