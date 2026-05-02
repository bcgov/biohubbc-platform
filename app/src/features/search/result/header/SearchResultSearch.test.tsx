import userEvent from '@testing-library/user-event';
import { act, fireEvent, render, screen } from 'test-helpers/test-utils';
import { SearchResultSearch } from './SearchResultSearch';

const searchPropertiesMock = vi.hoisted(() => vi.fn());
const searchSpeciesMock = vi.hoisted(() => vi.fn());
let user: ReturnType<typeof userEvent.setup>;

const setupUser = () =>
  userEvent.setup({
    advanceTimers: async (delay) => {
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(delay);
        return;
      }

      await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
    }
  });

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    search: {
      searchProperties: searchPropertiesMock
    },
    taxonomy: {
      searchSpecies: searchSpeciesMock
    }
  })
}));

const mockPropertySearchResponse = {
  properties: {
    string: [
      {
        feature_property_id: 1,
        property_name: 'species_name',
        property_display_name: 'Species name',
        feature_property_type: 'string',
        operators: ['Equals', 'NotEquals', 'Like', 'ILike', 'StartsWith', 'EndsWith', 'Contains', 'Exists'],
        relevancy_score: 1
      }
    ],
    number: [],
    boolean: [],
    datetime: [],
    taxon: [],
    spatial: [],
    code: []
  },
  pagination: {
    total: 1,
    per_page: 25,
    current_page: 1,
    last_page: 1,
    sort: undefined,
    order: undefined
  }
};

const selectOption = async (combobox: HTMLElement, optionName: string) => {
  fireEvent.mouseDown(combobox);
  await flushAsyncUpdates();
  fireEvent.click(screen.getByRole('option', { name: optionName }));
};

const flushAsyncUpdates = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const addPropertyFilter = async (optionName: string) => {
  let propertyInputs = screen.getAllByRole('combobox', { name: 'Property' }) as HTMLInputElement[];
  let searchInput = propertyInputs.find((input) => input.value === '');

  if (!searchInput) {
    await user.click(screen.getByRole('button', { name: /add filter/i }));
    propertyInputs = screen.getAllByRole('combobox', { name: 'Property' }) as HTMLInputElement[];
    searchInput = propertyInputs[propertyInputs.length - 1];
  }

  await flushAsyncUpdates();
  fireEvent.mouseDown(searchInput);
  await flushAsyncUpdates();
  fireEvent.click(screen.getByRole('option', { name: optionName }));
};

describe('SearchResultSearch', () => {
  const defaultProps = {
    onExpressionApply: vi.fn()
  };

  beforeEach(() => {
    user = setupUser();
    searchPropertiesMock.mockReset();
    searchSpeciesMock.mockReset();
    defaultProps.onExpressionApply.mockReset();
    searchPropertiesMock.mockResolvedValue(mockPropertySearchResponse);
    searchSpeciesMock.mockResolvedValue({ searchResponse: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the expression builder when the search input is focused', async () => {
    render(<SearchResultSearch {...defaultProps} searchTerm="" />);

    await user.click(screen.getByPlaceholderText('Search...'));

    expect(screen.getByTestId('expression-builder')).toBeVisible();
    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Property' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Operator' })).toBeVisible();
    expect(screen.getByLabelText('Value')).toBeEnabled();
    expect(screen.getByRole('button', { name: /add filter/i })).toBeVisible();
    expect(screen.getByTestId('filter-panel-popper-paper')).toHaveStyle({
      maxHeight: '60vh',
      overflow: 'hidden'
    });
    expect(screen.getByTestId('expression-input-surface')).toHaveStyle({
      overflowY: 'auto'
    });
  });

  it('opens the expression builder from the search action button without submitting results', async () => {
    render(<SearchResultSearch {...defaultProps} searchTerm="elk" />);

    await user.click(screen.getAllByRole('button', { name: 'Search' })[0]);

    expect(screen.getByTestId('expression-builder')).toBeVisible();
  });

  it('does not submit results when enter is pressed in the search input', async () => {
    render(<SearchResultSearch {...defaultProps} searchTerm="elk" />);

    fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Enter' });

    expect(screen.queryByTestId('expression-builder')).not.toBeInTheDocument();
  });

  it('keeps the expression builder open while selecting builder menu options', async () => {
    render(<SearchResultSearch {...defaultProps} searchTerm="" />);

    await user.click(screen.getByPlaceholderText('Search...'));
    await addPropertyFilter('Species name');
    await selectOption(screen.getByRole('combobox', { name: 'Operator' }), 'contains, case-insensitive');

    expect(screen.getByTestId('expression-builder')).toBeVisible();
    expect(screen.getByRole('button', { name: /apply/i })).toBeEnabled();
  });

  it('passes the expression tree when the builder is applied', async () => {
    const onExpressionApply = vi.fn();
    render(<SearchResultSearch {...defaultProps} searchTerm="" onExpressionApply={onExpressionApply} />);

    await user.click(screen.getByPlaceholderText('Search...'));
    await addPropertyFilter('Species name');
    await selectOption(screen.getByRole('combobox', { name: 'Operator' }), 'contains, case-insensitive');
    await user.type(screen.getByLabelText('Value'), 'wolf');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onExpressionApply).toHaveBeenCalledWith({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'ILike',
          value: 'wolf'
        }
      ]
    });
    expect(screen.getByTestId('expression-builder')).not.toBeVisible();
  });

  it('passes null when all expression filters are cleared and applied', async () => {
    const onExpressionApply = vi.fn();
    render(<SearchResultSearch {...defaultProps} searchTerm="" onExpressionApply={onExpressionApply} />);

    await user.click(screen.getByPlaceholderText('Search...'));
    await user.click(screen.getByRole('button', { name: /remove filter/i }));
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onExpressionApply).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('expression-builder')).not.toBeVisible();
  });

  it('keeps the expression builder draft mounted when the filter panel is closed', async () => {
    render(<SearchResultSearch {...defaultProps} searchTerm="" />);

    await user.click(screen.getByPlaceholderText('Search...'));
    await addPropertyFilter('Species name');
    await user.type(screen.getByLabelText('Value'), 'wolf');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByTestId('expression-builder')).not.toBeVisible();

    await user.click(screen.getByPlaceholderText('Search...'));

    expect(screen.getByRole('combobox', { name: 'Property' })).toHaveValue('Species name');
    expect(screen.getByLabelText('Value')).toHaveValue('wolf');
  });

  it('does not refresh builder recommendations when a valid expression is applied', async () => {
    vi.useFakeTimers();

    const onExpressionApply = vi.fn();

    try {
      render(<SearchResultSearch {...defaultProps} searchTerm="name" onExpressionApply={onExpressionApply} />);

      fireEvent.focus(screen.getByPlaceholderText('Search...'));

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(searchPropertiesMock).toHaveBeenCalledWith({ keyword: 'name' }, { page: 1, limit: 25 });
      await addPropertyFilter('Species name');
      await selectOption(screen.getByRole('combobox', { name: 'Operator' }), 'contains, case-insensitive');
      fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'wolf' } });

      searchPropertiesMock.mockClear();
      searchSpeciesMock.mockClear();

      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(screen.getByTestId('expression-builder')).not.toBeVisible();

      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.resolve();
      });

      expect(onExpressionApply).toHaveBeenCalledTimes(1);
      expect(searchPropertiesMock).not.toHaveBeenCalled();
      expect(searchSpeciesMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces property recommendations while the search term changes', async () => {
    vi.useFakeTimers();

    try {
      render(<SearchResultSearch {...defaultProps} searchTerm="" />);

      const searchInput = screen.getByPlaceholderText('Search...');

      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'w' } });
      fireEvent.change(searchInput, { target: { value: 'wo' } });
      fireEvent.change(searchInput, { target: { value: 'wol' } });
      fireEvent.change(searchInput, { target: { value: 'wolf' } });

      expect(searchPropertiesMock).toHaveBeenCalledTimes(1);
      expect(searchPropertiesMock).toHaveBeenCalledWith({}, { page: 1, limit: 25 });
      expect(searchSpeciesMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(299);
      });

      expect(searchPropertiesMock).toHaveBeenCalledTimes(1);
      expect(searchSpeciesMock).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(searchPropertiesMock).toHaveBeenCalledWith({ keyword: 'wolf' }, { page: 1, limit: 25 });
      expect(searchPropertiesMock).toHaveBeenCalledTimes(2);
      expect(searchSpeciesMock).toHaveBeenCalledTimes(1);
      expect(searchSpeciesMock).toHaveBeenCalledWith('wolf');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a suggested property chip from one debounced top-level search', async () => {
    vi.useFakeTimers();

    const descriptionPropertyResponse = {
      ...mockPropertySearchResponse,
      properties: {
        ...mockPropertySearchResponse.properties,
        string: [
          {
            feature_property_id: 2,
            property_name: 'description',
            property_display_name: 'Description',
            feature_property_type: 'string',
            operators: ['Equals', 'NotEquals', 'Like', 'ILike', 'StartsWith', 'EndsWith', 'Contains', 'Exists'],
            relevancy_score: 2
          }
        ]
      }
    };

    try {
      searchPropertiesMock.mockImplementation((filters: { keyword?: string }) => {
        if (filters.keyword === 'description') {
          return Promise.resolve(descriptionPropertyResponse);
        }

        return Promise.resolve(mockPropertySearchResponse);
      });

      render(<SearchResultSearch {...defaultProps} searchTerm="" />);

      const searchInput = screen.getByPlaceholderText('Search...');

      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'd' } });
      fireEvent.change(searchInput, { target: { value: 'de' } });
      fireEvent.change(searchInput, { target: { value: 'description' } });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(searchPropertiesMock.mock.calls.filter(([filters]) => filters.keyword === 'description')).toHaveLength(1);
      expect(screen.getByText('Description')).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts recommended species and property refreshes at the same debounce boundary', async () => {
    vi.useFakeTimers();

    let resolveSpecies!: (value: { searchResponse: never[] }) => void;
    const speciesResponse = new Promise<{ searchResponse: never[] }>((resolve) => {
      resolveSpecies = resolve;
    });
    searchSpeciesMock.mockImplementation(() => speciesResponse);

    try {
      render(<SearchResultSearch {...defaultProps} searchTerm="" />);

      const searchInput = screen.getByPlaceholderText('Search...');

      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'ducks' } });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(searchSpeciesMock).toHaveBeenCalledWith('ducks');
      expect(searchPropertiesMock).toHaveBeenCalledWith({ keyword: 'ducks' }, { page: 1, limit: 25 });

      await act(async () => {
        resolveSpecies({ searchResponse: [] });
        await Promise.resolve();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces from an existing top-level search value before refreshing recommendations', async () => {
    vi.useFakeTimers();

    try {
      render(<SearchResultSearch {...defaultProps} searchTerm="species" />);

      const searchInput = screen.getByPlaceholderText('Search...');

      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'species d' } });
      fireEvent.change(searchInput, { target: { value: 'species de' } });
      fireEvent.change(searchInput, { target: { value: 'description' } });

      act(() => {
        vi.advanceTimersByTime(299);
      });

      expect(searchPropertiesMock).toHaveBeenCalledTimes(1);
      expect(searchPropertiesMock).toHaveBeenCalledWith({}, { page: 1, limit: 25 });
      expect(searchPropertiesMock.mock.calls.some(([filters]) => filters.keyword === 'species')).toBe(false);
      expect(searchPropertiesMock.mock.calls.some(([filters]) => filters.keyword === 'description')).toBe(false);

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(searchPropertiesMock.mock.calls.filter(([filters]) => filters.keyword === 'description')).toHaveLength(1);
      expect(searchPropertiesMock.mock.calls.some(([filters]) => filters.keyword === 'species')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the search value', async () => {
    render(<SearchResultSearch {...defaultProps} searchTerm="Moose" />);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByPlaceholderText('Search...')).toHaveValue('');
  });
});
