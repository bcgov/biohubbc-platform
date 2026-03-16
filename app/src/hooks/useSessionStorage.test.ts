import { act, renderHook } from 'test-helpers/test-utils';
import { useSessionStorage } from './useSessionStorage';

const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

beforeEach(() => {
  Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, writable: true });
  mockSessionStorage.clear();
  vi.clearAllMocks();
});

describe('useSessionStorage', () => {
  describe('Consistent Storage Format', () => {
    it('should store object values as JSON strings', () => {
      const { result } = renderHook(() => useSessionStorage('test-obj', { name: 'default' }));

      act(() => {
        result.current[1]({ name: 'updated' });
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'USE_SESSION_STORAGE_test-obj',
        JSON.stringify({ name: 'updated' })
      );
    });

    it('should store string values as JSON strings', () => {
      const { result } = renderHook(() => useSessionStorage('test-str', 'default'));

      act(() => {
        result.current[1]('hello');
      });

      // String should be stored as JSON ie. '"hello"' not 'hello'
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('USE_SESSION_STORAGE_test-str', JSON.stringify('hello'));
    });

    it('should store number values as JSON strings', () => {
      const { result } = renderHook(() => useSessionStorage('test-num', 0));

      act(() => {
        result.current[1](42);
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('USE_SESSION_STORAGE_test-num', JSON.stringify(42));
    });

    it('should store boolean values as JSON strings', () => {
      const { result } = renderHook(() => useSessionStorage('test-bool', false));

      act(() => {
        result.current[1](true);
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('USE_SESSION_STORAGE_test-bool', JSON.stringify(true));
    });

    it('should store array values as JSON strings', () => {
      const { result } = renderHook(() => useSessionStorage('test-arr', [] as number[]));

      act(() => {
        result.current[1]([1, 2, 3]);
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'USE_SESSION_STORAGE_test-arr',
        JSON.stringify([1, 2, 3])
      );
    });
  });

  describe('Consistent Retrieval', () => {
    it('should parse a stored JSON object on initialization', () => {
      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-obj', JSON.stringify({ name: 'stored' }));

      const { result } = renderHook(() => useSessionStorage('test-obj', { name: 'default' }));

      expect(result.current[0]).toEqual({ name: 'stored' });
    });

    it('should parse a stored JSON string on initialization', () => {
      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-str', JSON.stringify('stored'));

      const { result } = renderHook(() => useSessionStorage('test-str', 'default'));

      expect(result.current[0]).toBe('stored');
    });

    it('should parse a stored JSON number on initialization', () => {
      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-num', JSON.stringify(99));

      const { result } = renderHook(() => useSessionStorage('test-num', 0));

      expect(result.current[0]).toBe(99);
    });

    it('should parse a stored JSON boolean on initialization', () => {
      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-bool', JSON.stringify(true));

      const { result } = renderHook(() => useSessionStorage('test-bool', false));

      expect(result.current[0]).toBe(true);
    });

    it('should return initialValue when sessionStorage has no entry', () => {
      const { result } = renderHook(() => useSessionStorage('missing-key', 'initial'));

      expect(result.current[0]).toBe('initial');
    });
  });

  describe('Typed Return Value', () => {
    it('should return a tuple of [value, setter]', () => {
      const { result } = renderHook(() => useSessionStorage('test', 'initial'));

      expect(result.current).toHaveLength(2);
      expect(typeof result.current[0]).toBe('string');
      expect(typeof result.current[1]).toBe('function');
    });

    it('should update state when setter is called', () => {
      const { result } = renderHook(() => useSessionStorage('test', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
    });

    it('should return typed object values', () => {
      const initial = { count: 0, items: ['a'] };
      const { result } = renderHook(() => useSessionStorage('test', initial));

      act(() => {
        result.current[1]({ count: 5, items: ['a', 'b'] });
      });

      expect(result.current[0]).toEqual({ count: 5, items: ['a', 'b'] });
    });
  });

  describe('Fallback on Invalid Stored Values', () => {
    it('should return initialValue when stored value is invalid JSON', () => {
      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-invalid', 'not-valid-json{');

      const { result } = renderHook(() => useSessionStorage('test-invalid', 'fallback'));

      expect(result.current[0]).toBe('fallback');
    });

    it('should not emit console errors when stored value is invalid JSON', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-invalid', 'not-valid-json{');

      renderHook(() => useSessionStorage('test-invalid', 'fallback'));

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should not emit console warnings when stored value is invalid JSON', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-invalid', 'not-valid-json{');

      renderHook(() => useSessionStorage('test-invalid', 'fallback'));

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Removal of Conditional Serialization', () => {
    it('should store strings in JSON format, not as raw strings', () => {
      const { result } = renderHook(() => useSessionStorage('test-str', ''));

      act(() => {
        result.current[1]('test-value');
      });

      // JSON.stringify wraps strings in quotes: '"test-value"'
      // Raw string storage would be: 'test-value'
      const storedValue = mockSessionStorage.setItem.mock.calls[0][1];
      expect(storedValue).toBe('"test-value"');
    });

    it('should store strings and objects with the same serialization strategy', () => {
      const { result: stringResult } = renderHook(() => useSessionStorage('str-key', ''));
      const { result: objectResult } = renderHook(() => useSessionStorage('obj-key', {}));

      act(() => {
        stringResult.current[1]('value');
      });
      act(() => {
        objectResult.current[1]({ key: 'value' });
      });

      const storedString = mockSessionStorage.setItem.mock.calls[0][1];
      const storedObject = mockSessionStorage.setItem.mock.calls[1][1];

      // Both should be valid JSON
      expect(() => JSON.parse(storedString)).not.toThrow();
      expect(() => JSON.parse(storedObject)).not.toThrow();

      // Parsing the stored string should return the original value
      expect(JSON.parse(storedString)).toBe('value');
      expect(JSON.parse(storedObject)).toEqual({ key: 'value' });
    });

    it('should round-trip string values through storage and retrieval', () => {
      const { result } = renderHook(() => useSessionStorage('round-trip', ''));

      act(() => {
        result.current[1]('hello world');
      });

      // Simulate re-mounting by rendering a new hook with the same key
      const { result: result2 } = renderHook(() => useSessionStorage('round-trip', ''));

      expect(result2.current[0]).toBe('hello world');
    });

    it('should round-trip object values through storage and retrieval', () => {
      const { result } = renderHook(() => useSessionStorage('round-trip-obj', { a: 1 }));

      act(() => {
        result.current[1]({ a: 2, b: 3 });
      });

      const { result: result2 } = renderHook(() => useSessionStorage('round-trip-obj', { a: 1 }));

      expect(result2.current[0]).toEqual({ a: 2, b: 3 });
    });
  });

  describe('Edge Cases: undefined and NaN', () => {
    it('should store undefined as "undefined" which does not round-trip', () => {
      const { result } = renderHook(() => useSessionStorage<string | undefined>('test-undef', 'fallback'));

      act(() => {
        result.current[1](undefined);
      });

      // JSON.stringify(undefined) returns undefined (not a string),
      // so sessionStorage.setItem coerces it to the string "undefined"
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('USE_SESSION_STORAGE_test-undef', undefined);
    });

    it('should fall back to initialValue when retrieving a stored undefined', () => {
      // Simulate a previously stored undefined value
      mockSessionStorage.setItem('USE_SESSION_STORAGE_test-undef', 'undefined' as unknown as string);

      const { result } = renderHook(() => useSessionStorage<string | undefined>('test-undef', 'fallback'));

      // "undefined" is not valid JSON, so the hook falls back to initialValue
      expect(result.current[0]).toBe('fallback');
    });

    it('should store NaN as "null" via JSON.stringify', () => {
      const { result } = renderHook(() => useSessionStorage<number>('test-nan', 0));

      act(() => {
        result.current[1](NaN);
      });

      // JSON.stringify(NaN) produces "null"
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('USE_SESSION_STORAGE_test-nan', 'null');
    });

    it('should retrieve null instead of NaN on re-mount', () => {
      const { result } = renderHook(() => useSessionStorage<number | null>('test-nan', 0));

      act(() => {
        result.current[1](NaN as unknown as number | null);
      });

      // Re-mount: JSON.parse("null") returns null, not NaN
      const { result: result2 } = renderHook(() => useSessionStorage<number | null>('test-nan', 0));

      expect(result2.current[0]).toBeNull();
    });
  });
});
