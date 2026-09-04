import { getPaginationItems, range } from './pagination';

describe('pagination utils', () => {
  describe('range', () => {
    it('builds an inclusive number range', () => {
      expect(range(2, 5)).toEqual([2, 3, 4, 5]);
    });
  });

  describe('getPaginationItems', () => {
    it('returns every page when all pages fit in the compact window', () => {
      expect(getPaginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it('caps the leading page run before the ellipsis at four pages', () => {
      expect(getPaginationItems(1, 99)).toEqual([1, 2, 3, 4, 'end-ellipsis', 99]);
    });

    it('keeps the final page visible for middle page windows', () => {
      expect(getPaginationItems(5, 10)).toEqual([1, 'start-ellipsis', 3, 4, 5, 6, 'end-ellipsis', 10]);
    });
  });
});
