import { fireEvent, waitFor } from '@testing-library/react';
import { PolicyAutocompleteContext } from 'contexts/policyAutocompleteContext';
import { cleanup, render } from 'test-helpers/test-utils';
import { PolicyJsonEditor } from './PolicyJsonEditor';

// Mock Monaco Editor - it doesn't work well in jsdom
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange, onValidate, onMount }) => {
    // Simulate onMount callback with mock editor and monaco instances
    if (onMount) {
      const mockEditor = {
        onDidChangeModelContent: vi.fn(),
        getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
        getModel: vi.fn(() => ({
          getValueInRange: vi.fn(() => ''),
          getLineContent: vi.fn(() => ''),
          getValue: vi.fn(() => value || '{}')
        })),
        trigger: vi.fn()
      };
      const mockMonaco = {
        languages: {
          registerCompletionItemProvider: vi.fn(),
          CompletionItemKind: { Value: 1, Enum: 2, Property: 3 },
          json: {
            jsonDefaults: {
              setDiagnosticsOptions: vi.fn()
            }
          }
        },
        editor: {
          setModelMarkers: vi.fn()
        }
      };
      // Call onMount after render
      setTimeout(() => onMount(mockEditor, mockMonaco), 0);
    }
    return (
      <textarea
        data-testid="monaco-editor"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label="JSON Editor"
      />
    );
  }),
  OnMount: vi.fn(),
  OnValidate: vi.fn()
}));

const mockPolicyAutocompleteContext = {
  submissionsDataLoader: {
    data: [
      { submission_id: 1, name: 'Test Submission 1' },
      { submission_id: 2, name: 'Test Submission 2' }
    ],
    load: vi.fn(),
    refresh: vi.fn(),
    isLoading: false,
    isReady: true
  },
  featureTypes: [
    {
      feature_type: { feature_type_name: 'telemetry' },
      feature_type_properties: [
        { feature_property_name: 'sex', feature_property_type_name: 'string' },
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ]
    }
  ],
  submissionFeaturesCache: new Map(),
  fetchFeaturesForAutocomplete: vi.fn().mockResolvedValue(undefined)
};

const renderContainer = (value: string, onChange: (value: string) => void = vi.fn(), error?: string) => {
  return render(
    <PolicyAutocompleteContext.Provider value={mockPolicyAutocompleteContext as any}>
      <PolicyJsonEditor value={value} onChange={onChange} error={error} />
    </PolicyAutocompleteContext.Provider>
  );
};

describe('PolicyJsonEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the editor with default value', async () => {
    const { getByTestId } = renderContainer('');

    await waitFor(() => {
      expect(getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('renders with provided value', async () => {
    const testValue = JSON.stringify({ Version: '2025-12-01', Statement: [] }, null, 2);
    const { getByTestId } = renderContainer(testValue);

    await waitFor(() => {
      const editor = getByTestId('monaco-editor') as HTMLTextAreaElement;
      expect(editor.value).toBe(testValue);
    });
  });

  it('displays error message when error prop is provided', async () => {
    const { getByText } = renderContainer('{}', vi.fn(), 'Test error message');

    await waitFor(() => {
      expect(getByText('Test error message')).toBeVisible();
    });
  });

  it('calls onChange when editor content changes', async () => {
    const onChange = vi.fn();
    const { getByTestId } = renderContainer('{}', onChange);

    const editor = getByTestId('monaco-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '{"new": "value"}' } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('{"new": "value"}');
    });
  });
});
