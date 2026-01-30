import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiError, ApiExecuteSQLError } from '../errors/api-error';
import { Cart, CartStatus } from '../models/cart';
import { getMockDBConnection } from '../__mocks__/db';
import { CartRepository } from './cart-repository';

chai.use(sinonChai);

describe('CartRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getCartById', () => {
    it('should return a cart when found', async () => {
      const mockCart: Cart = {
        cart_id: 'cart-1',
        cart_status: CartStatus.ACTIVE,
        system_user_id: 1
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockCart]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const result = await repo.getCartById('cart-1', 1);

      expect(result).to.eql(mockCart);
    });

    it('should throw ApiExecuteSQLError when cart is not found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      try {
        await repo.getCartById('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiError).message).to.equal('Failed to get cart');
      }
    });
  });

  describe('createCart', () => {
    it('should create and return a new cart', async () => {
      const mockCart: Cart = {
        cart_id: 'cart-1',
        cart_status: CartStatus.ACTIVE,
        system_user_id: 1
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockCart]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const result = await repo.createCart(1);

      expect(result).to.eql(mockCart);
    });

    it('should throw ApiExecuteSQLError when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      try {
        await repo.createCart(1);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiError).message).to.equal('Failed to create cart');
      }
    });
  });

  describe('updateCart', () => {
    it('should update the cart status successfully', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: sinon.stub().resolves(mockQueryResponse)
      });

      const repo = new CartRepository(mockDBConnection);

      const payload = { cart_status: CartStatus.CHECKED_OUT, record_end_date: null };

      await repo.updateCart('cart-1', 1, payload);

      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });

    it('should throw ApiExecuteSQLError when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const payload = { cart_status: CartStatus.CHECKED_OUT, record_end_date: null };

      try {
        await repo.updateCart('cart-1', 1, payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiError).message).to.equal('Failed to update cart status');
      }
    });
  });

  describe('deleteCart', () => {
    it('should soft delete a cart successfully', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: sinon.stub().resolves(mockQueryResponse)
      });

      const repo = new CartRepository(mockDBConnection);

      await repo.deleteCart('cart-1', 1);

      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });
  });
});
