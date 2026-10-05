import { URL_PARAMS } from 'constants/query-params';
import { describe, expect, it } from 'vitest';
import { toApiCursorPagination } from './pagination';

describe('toApiCursorPagination', () => {
  it('returns default cursor-pagination options when URL parameters are absent', () => {
    expect(toApiCursorPagination(new URLSearchParams())).toEqual({
      limit: 10,
      sort: undefined,
      order: undefined,
      cursor: undefined
    });
  });

  it('converts URL state while preserving the opaque cursor value', () => {
    const params = new URLSearchParams({
      [URL_PARAMS.LIMIT]: '25',
      [URL_PARAMS.SORT]: 'create_date',
      [URL_PARAMS.ORDER]: 'asc',
      [URL_PARAMS.CURSOR]: 'CaseSensitive_Cursor-123'
    });

    expect(toApiCursorPagination(params)).toEqual({
      limit: 25,
      sort: 'create_date',
      order: 'asc',
      cursor: 'CaseSensitive_Cursor-123'
    });
  });
});
