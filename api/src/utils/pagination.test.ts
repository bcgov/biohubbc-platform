import { expect } from 'chai';
import { Request } from 'express';
import { describe, it } from 'mocha';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromBody,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from './pagination';

describe('pagination', () => {
  describe('makePaginationOptionsFromRequest', () => {
    it('should return default options if query params are missing', () => {
      const mockRequest = { query: {} } as unknown as Request;

      const result = makePaginationOptionsFromRequest(mockRequest);
      expect(result).to.eql({
        limit: 25,
        page: 1,
        sort: undefined,
        order: undefined
      });
    });

    it('should cast query params to number and strings correctly', () => {
      const mockRequest = {
        query: {
          limit: '100',
          page: '2',
          sort: 'name',
          order: 'desc'
        }
      } as unknown as Request;

      const result = makePaginationOptionsFromRequest(mockRequest);
      expect(result).to.eql({
        limit: 100,
        page: 2,
        sort: 'name',
        order: 'desc'
      });
    });
  });

  describe('makePaginationOptionsFromBody', () => {
    it('should return default options if pagination is missing in body', () => {
      const mockRequest = { body: {} } as unknown as Request;

      const result = makePaginationOptionsFromBody(mockRequest);
      expect(result).to.eql({
        limit: 25,
        page: 1,
        sort: undefined,
        order: undefined
      });
    });

    it('should cast body pagination params correctly', () => {
      const mockRequest = {
        body: {
          pagination: {
            limit: 25,
            page: 3,
            sort: 'name',
            order: 'asc'
          }
        }
      } as unknown as Request;

      const result = makePaginationOptionsFromBody(mockRequest);
      expect(result).to.eql({
        limit: 25,
        page: 3,
        sort: 'name',
        order: 'asc'
      });
    });
  });

  describe('makePaginationResponse', () => {
    it('should calculate last_page with default pagination options', () => {
      const mockPagination: ApiPaginationOptions = {
        limit: 25,
        page: 1,
        sort: undefined,
        order: undefined
      };

      const result = makePaginationResponse(101, mockPagination);
      expect(result).to.eql({
        total: 101,
        per_page: 25,
        current_page: 1,
        last_page: 5,
        sort: undefined,
        order: undefined
      });
    });

    it('should calculate last page correctly when all params are defined', () => {
      const mockPagination: ApiPaginationOptions = {
        limit: 15,
        page: 3,
        sort: 'name',
        order: 'asc'
      };

      const result = makePaginationResponse(99, mockPagination);
      expect(result).to.eql({
        total: 99,
        per_page: 15,
        current_page: 3,
        last_page: 7,
        sort: 'name',
        order: 'asc'
      });
    });

    it('should handle zero total records', () => {
      const mockPagination: ApiPaginationOptions = {
        limit: 20,
        page: 1,
        sort: 'name',
        order: 'desc'
      };

      const result = makePaginationResponse(0, mockPagination);
      expect(result).to.eql({
        total: 0,
        per_page: 20,
        current_page: 1,
        last_page: 1,
        sort: 'name',
        order: 'desc'
      });
    });
  });

  describe('ensureCompletePaginationOptions', () => {
    it('should default limit when limit is undefined', () => {
      const mockPagination: Partial<ApiPaginationOptions> = {
        limit: undefined,
        page: 1,
        sort: 'name',
        order: 'desc'
      };

      const result = ensureCompletePaginationOptions(mockPagination);
      expect(result).to.eql({
        limit: 25,
        page: 1,
        sort: 'name',
        order: 'desc'
      });
    });

    it('should default page when page is undefined', () => {
      const mockPagination: Partial<ApiPaginationOptions> = {
        limit: 15,
        page: undefined,
        sort: 'name',
        order: 'desc'
      };

      const result = ensureCompletePaginationOptions(mockPagination);
      expect(result).to.eql({
        limit: 15,
        page: 1,
        sort: 'name',
        order: 'desc'
      });
    });

    it('should return pagination if page and limit are defined', () => {
      const mockPagination: Partial<ApiPaginationOptions> = {
        limit: 15,
        page: 1,
        sort: 'name',
        order: 'desc'
      };

      const result = ensureCompletePaginationOptions(mockPagination);
      expect(result).to.eql({
        limit: 15,
        page: 1,
        sort: 'name',
        order: 'desc'
      });
    });
  });
});
