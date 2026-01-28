import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { ApiError, ApiExecuteSQLError } from '../errors/api-error';
import { Cart, CartStatus } from '../models/cart';
import { getMockDBConnection } from '../__mocks__/db';
import { CartRepository } from './cart-repository';

chai.use(sinonChai);

describe('CartRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('findCartById', () => {
    it('returns a cart when found', async () => {
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

      const result = await repo.findCartById('cart-1', 1);

      expect(result).to.eql(mockCart);
    });

    it('returns null when cart is not found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const result = await repo.findCartById('non-existent-cart', 1);

      expect(result).to.be.null;
    });
  });

  describe('getCartById', () => {
    it('returns a cart when found', async () => {
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

    it('throws ApiExecuteSQLError when cart not found', async () => {
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
    it('creates and returns a cart', async () => {
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

    it('throws ApiExecuteSQLError when rowCount !== 1', async () => {
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

  describe('updateCartStatus', () => {
    it('updates cart status successfully', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: Sinon.stub().resolves(mockQueryResponse)
      });

      const repo = new CartRepository(mockDBConnection);

      await repo.updateCartStatus('cart-1', CartStatus.CHECKED_OUT, 1);

      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });

    it('throws ApiExecuteSQLError when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      try {
        await repo.updateCartStatus('cart-1', CartStatus.CHECKED_OUT, 1);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect((err as ApiError).message).to.equal('Failed to update cart status');
      }
    });
  });

  describe('clearCart', () => {
    it('calls knex to delete submission features', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: Sinon.stub().resolves({ rowCount: 2 })
      });

      const repo = new CartRepository(mockDBConnection);

      await repo.clearCart('cart-1', 1);

      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });
  });

  describe('deleteCart', () => {
    it('calls knex to soft delete a cart', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: Sinon.stub().resolves({ rowCount: 1 })
      });

      const repo = new CartRepository(mockDBConnection);

      await repo.deleteCart('cart-1', 1);

      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });
  });
});
