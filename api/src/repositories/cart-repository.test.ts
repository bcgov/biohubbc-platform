import chai, { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiNotFoundError } from '../errors/api-error';
import { Cart, CartStatus, UpdateCart } from '../models/cart';
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
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const result = await repo.getCartById('cart-1');

      expect(result).to.eql(mockCart);
    });

    it('should throw error when cart is not found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      try {
        await repo.getCartById('cart-1');
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect((err as ApiNotFoundError).message).to.equal('Cart not found');
      }
    });
  });

  describe('findCartById', () => {
    it('should return a cart when found', async () => {
      const mockCart: Cart = {
        cart_id: 'cart-1',
        cart_status: CartStatus.ABANDONED,
        system_user_id: 1
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockCart]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const result = await repo.findCartById('cart-1');

      expect(result).to.eql(mockCart);
    });

    it('should return null if cart does not exist', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const result = await repo.findCartById('cart-1');

      expect(result).to.be.null;
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
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const result = await repo.createCart(1);

      expect(result).to.eql(mockCart);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      try {
        await repo.createCart(1);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to create cart');
      }
    });
  });

  describe('updateCart', () => {
    it('should update the cart status successfully', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const payload: UpdateCart = { cart_status: CartStatus.CHECKED_OUT };

      await repo.updateCart('cart-1', payload);

      expect(true).to.be.true;
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      const payload: UpdateCart = { cart_status: CartStatus.CHECKED_OUT };

      try {
        await repo.updateCart('cart-1', payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to update cart');
      }
    });
  });

  describe('deleteCart', () => {
    it('should soft delete a cart successfully', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartRepository(mockDBConnection);

      await repo.deleteCart('cart-1');

      expect(true).to.be.true;
    });
  });
});
