import { act, renderHook } from '@testing-library/react-hooks';
import { FuseResult } from 'fuse.js';
import useFuzzySearch from './useFuzzySearch';

const item = { a: 'zzz', b: 'hello world' };
const mockDataArray = [item];

const mockFuzzyData: FuseResult<any>[] = [
  {
    item,
    matches: [],
    refIndex: 0
  }
];

const mockOptions = { minMatchCharLength: 5 };

describe('useFuzzySearch', () => {
  describe('mounting conditions', () => {
    const { result } = renderHook(() => useFuzzySearch(mockDataArray, {}));

    it('should mount with empty search string', () => {
      expect(result.current.searchValue).toBe('');
    });

    it('should mount with fuzzyData array in FuseResult structure', () => {
      expect(result.current.fuzzyData).toStrictEqual(mockFuzzyData);
    });
  });
  describe('handleFuzzyData', () => {
    it('should set fuzzyData with new array', () => {
      const { result } = renderHook(() => useFuzzySearch(mockDataArray, {}));
      act(() => result.current.handleFuzzyData([{ item: { a: 'test', b: 'test' }, matches: [], refIndex: 0 }]));
      expect(result.current.fuzzyData[0].item.a).toBe('test');
    });
  });

  describe('handleSearch', () => {
    it('should set searchValue', () => {
      const { result } = renderHook(() => useFuzzySearch(mockDataArray, {}));
      act(() => result.current.handleSearch({ target: { value: 'test' } } as any));
      expect(result.current.searchValue).toBe('test');
    });

    it('should setFuzzyData to default when no search value provided', () => {
      const { result } = renderHook(() => useFuzzySearch(mockDataArray, {}));
      act(() => result.current.handleSearch({ target: { value: '' } } as any));
      expect(result.current.searchValue).toBe('');
      expect(result.current.fuzzyData).toStrictEqual(mockFuzzyData);
    });

    it('should setFuzzyData to default when no search value provided', () => {
      const { result } = renderHook(() => useFuzzySearch(mockDataArray, {}));
      act(() => result.current.handleSearch({ target: { value: '' } } as any));
      expect(result.current.searchValue).toBe('');
      expect(result.current.fuzzyData).toStrictEqual(mockFuzzyData);
    });

    it('should setFuzzyData to default when character count is less than minMatchCharLength', () => {
      const { result } = renderHook(() => useFuzzySearch(mockDataArray, mockOptions));
      act(() => result.current.handleSearch({ target: { value: 'searchKeyword' } } as any));
      expect(result.current.searchValue).toBe('searchKeyword');
      expect(result.current.fuzzyData).toStrictEqual(mockFuzzyData);
    });
  });
  describe('highlight', () => {
    const { result } = renderHook(() => useFuzzySearch(mockDataArray, { highlightColour: '#ffff' }));
    it('should return formatted html if highlight indices provided', () => {
      act(() => {
        const jsx = result.current.highlight('abc', [[0, 1]]);
        const shouldEqual = (
          <>
            <mark style={{ backgroundColor: '#ffff' }}>ab</mark>c
          </>
        );
        expect(jsx.toString()).toEqual(shouldEqual.toString());
      });
    });

    it('should return string value if no indices', () => {
      act(() => {
        const jsx = result.current.highlight('abc', []);
        expect(jsx.toString()).toEqual('abc');
      });
    });

    it('should highlight whole string', () => {
      act(() => {
        const jsx = result.current.highlight('abc', [
          [0, 1],
          [2, 2]
        ]);
        const shouldEqual = (
          <>
            <mark style={{ backgroundColor: '#ffff' }}>abc</mark>
          </>
        );
        expect(jsx.toString()).toEqual(shouldEqual.toString());
      });
    });
  });
});
