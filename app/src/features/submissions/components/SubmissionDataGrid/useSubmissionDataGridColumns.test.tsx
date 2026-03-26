import { renderHook, waitFor } from '@testing-library/react';
import { CodesContext, ICodesContext } from 'contexts/codesContext';
import { PropsWithChildren } from 'react';
import useSubmissionDataGridColumns from './useSubmissionDataGridColumns';

// Mock CodesContext Provider
const mockFeatureTypes = [
  {
    feature_type: { name: 'test' },
    properties: [
      {
        name: 'mock_property',
        display_name: 'Mock Property',
        type_name: 'text'
      }
    ]
  }
];

const MockCodesContextProvider = ({ children }: PropsWithChildren) => {
  const mockContextValue = {
    codesDataLoader: {
      data: {
        feature_type_with_properties: mockFeatureTypes
      }
    }
  } as ICodesContext;

  return <CodesContext.Provider value={mockContextValue}>{children}</CodesContext.Provider>;
};

// Combined Wrapper
const wrapper = ({ children }: PropsWithChildren) => <MockCodesContextProvider>{children}</MockCodesContextProvider>;

describe('useSubmissionDataGridColumns', () => {
  it('returns columns for a known feature type', async () => {
    const { result } = renderHook(() => useSubmissionDataGridColumns('test'), { wrapper });

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(0);
      expect(result.current.map((col) => col.field)).toContain('mock_property');
    });
  });
});
