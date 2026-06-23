import userEvent from '@testing-library/user-event';
import { SearchPropertyResponse } from 'interfaces/useSearchApi.interface';
import { act, fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { SearchExpressionBuilder as ExpressionBuilder } from './SearchExpressionBuilder';

const searchPropertiesMock = vi.hoisted(() => vi.fn());
const searchSpeciesMock = vi.hoisted(() => vi.fn());
const setSnackbarMock = vi.hoisted(() => vi.fn());
let user: ReturnType<typeof userEvent.setup>;
const expressionBuilderInteractionTimeout = 20000;

vi.setConfig({ testTimeout: expressionBuilderInteractionTimeout });

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

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({
    setSnackbar: setSnackbarMock
  })
}));

const emptySearchPropertyResponse: SearchPropertyResponse = {
  properties: {
    string: [],
    number: [],
    boolean: [],
    datetime: [],
    taxon: [],
    spatial: [],
    code: []
  },
  pagination: {
    total: 0,
    per_page: 25,
    current_page: 1,
    last_page: 1,
    sort: undefined,
    order: undefined
  }
};

const defaultSearchPropertyResponse: SearchPropertyResponse = {
  properties: {
    string: [
      {
        feature_property_id: 1,
        property_name: 'species_name',
        property_display_name: 'Species name',
        feature_property_type: 'string',
        operators: ['Equals', 'ILike', 'Exists'],
        relevancy_score: 5
      }
    ],
    number: [
      {
        feature_property_id: 2,
        property_name: 'elevation',
        property_display_name: 'Elevation',
        feature_property_type: 'number',
        operators: ['GreaterThan', 'Exists'],
        relevancy_score: 4
      }
    ],
    boolean: [],
    datetime: [],
    taxon: [],
    spatial: [],
    code: []
  },
  pagination: {
    total: 2,
    per_page: 25,
    current_page: 1,
    last_page: 1,
    sort: undefined,
    order: undefined
  }
};

const flushAsyncUpdates = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const openCombobox = async (combobox: HTMLElement) => {
  await waitFor(() => {
    fireEvent.mouseDown(combobox);
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });

    expect(screen.getByRole('listbox')).toBeVisible();
  });

  return screen.getByRole('listbox');
};

const selectOption = async (combobox: HTMLElement, optionName: string) => {
  const listbox = await openCombobox(combobox);
  fireEvent.click(await within(listbox).findByRole('option', { name: optionName }));

  await waitFor(() => expect(combobox).toHaveValue(optionName));
};

const addPropertyFilter = async (optionName: string) => {
  searchPropertiesMock.mockResolvedValue(defaultSearchPropertyResponse);

  let propertyInputs = screen.getAllByRole('combobox', { name: 'Property' }) as HTMLInputElement[];
  let searchInput = propertyInputs.find((input) => input.value === '');

  if (!searchInput) {
    await user.click(screen.getByRole('button', { name: /add filter/i }));
    propertyInputs = screen.getAllByRole('combobox', { name: 'Property' }) as HTMLInputElement[];
    searchInput = propertyInputs[propertyInputs.length - 1];
  }

  await flushAsyncUpdates();
  fireEvent.change(searchInput, { target: { value: '' } });
  const listbox = await openCombobox(searchInput);
  fireEvent.click(await within(listbox).findByRole('option', { name: optionName }));

  await waitFor(() => expect(searchInput).toHaveValue(optionName));
};

describe('ExpressionBuilder', () => {
  beforeEach(() => {
    user = setupUser();
    searchPropertiesMock.mockReset();
    searchSpeciesMock.mockReset();
    setSnackbarMock.mockReset();
    searchPropertiesMock.mockResolvedValue(defaultSearchPropertyResponse);
    searchSpeciesMock.mockResolvedValue({ searchResponse: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies one valid condition as a serialized expression tree', async () => {
    const onApply = vi.fn();
    render(<ExpressionBuilder onApply={onApply} />);

    expect(screen.queryByRole('button', { name: /remove group/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /root match mode/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply/i })).toBeEnabled();

    await addPropertyFilter('Species name');

    const operatorSelect = screen.getByRole('combobox', { name: 'Operator' });
    expect(screen.getByLabelText('Value')).toHaveAttribute('placeholder', 'Value');
    await selectOption(operatorSelect, 'contains, case-insensitive');
    await user.type(screen.getByLabelText('Value'), 'wolf');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({
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
  });

  it('adds an incomplete filter row from the add filter button', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add filter/i }));

    const propertyInputs = screen.getAllByRole('combobox', { name: 'Property' });
    const operatorInputs = screen.getAllByRole('combobox', { name: 'Operator' });
    const valueInputs = screen.getAllByLabelText('Value');

    expect(propertyInputs).toHaveLength(2);
    expect(propertyInputs[1]).toBeVisible();
    expect(operatorInputs[1]).toBeEnabled();
    expect(operatorInputs[1]).toHaveValue('equals');
    expect(valueInputs[1]).toBeEnabled();
    expect(screen.getByRole('button', { name: /apply/i })).toBeEnabled();
  });

  it('keeps an empty predicate invalid until a property is selected', async () => {
    const onApply = vi.fn();
    render(<ExpressionBuilder onApply={onApply} />);

    expect(screen.getByLabelText('Value')).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).not.toHaveBeenCalled();
    expect(setSnackbarMock).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Search filters are invalid'
    });
  });

  it('applies a null expression after all filters are removed', async () => {
    const onApply = vi.fn();
    render(<ExpressionBuilder onApply={onApply} />);

    await user.click(screen.getByRole('button', { name: /remove filter/i }));
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith(null);
    expect(setSnackbarMock).not.toHaveBeenCalled();
  });

  it('preserves a value typed before selecting a property', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await user.type(screen.getByLabelText('Value'), 'wolf');
    await addPropertyFilter('Species name');

    expect(screen.getByLabelText('Value')).toHaveValue('wolf');
  });

  it('validates invalid numeric text instead of blocking value input', async () => {
    const onApply = vi.fn();
    searchPropertiesMock.mockResolvedValue({
      ...emptySearchPropertyResponse,
      properties: {
        ...emptySearchPropertyResponse.properties,
        number: [
          {
            feature_property_id: 3,
            property_name: 'count',
            property_display_name: 'Count',
            feature_property_type: 'number',
            operators: ['Equals'],
            relevancy_score: 1
          }
        ]
      }
    });
    render(<ExpressionBuilder onApply={onApply} />);

    await user.type(screen.getByLabelText('Value'), 'wolf');
    const propertyInput = screen.getByRole('combobox', { name: 'Property' });
    await user.click(propertyInput);
    fireEvent.change(propertyInput, { target: { value: 'Count' } });
    await user.click(await screen.findByRole('option', { name: 'Count' }));
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.getByLabelText('Value')).toHaveValue('wolf');
    expect(onApply).not.toHaveBeenCalled();
    expect(setSnackbarMock).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Search filters are invalid'
    });
  });

  it('shows a validation snackbar when applying an invalid expression', async () => {
    const onApply = vi.fn();
    render(<ExpressionBuilder onApply={onApply} />);

    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).not.toHaveBeenCalled();
    expect(setSnackbarMock).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Search filters are invalid'
    });
  });

  it('hides the suggested section when there are no suggestions', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await waitFor(() => expect(searchPropertiesMock).toHaveBeenCalled());
    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeVisible();
  });

  it('adds a species equals predicate from a suggested species chip', async () => {
    const onApply = vi.fn();

    searchSpeciesMock.mockResolvedValue({
      searchResponse: [{ scientificName: 'Alces alces', tsn: 180703, commonNames: ['moose'] }]
    });
    searchPropertiesMock.mockResolvedValue({
      properties: {
        string: [],
        number: [],
        boolean: [],
        datetime: [],
        taxon: [
          {
            feature_property_id: 3,
            property_name: 'taxon_id',
            property_display_name: 'Taxonomic identifier',
            feature_property_type: 'taxon',
            operators: ['Equals', 'ParentOf', 'ChildOf', 'DescendsFrom', 'AscendsFrom', 'Exists'],
            relevancy_score: 5
          }
        ],
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
    });

    render(<ExpressionBuilder recommendedSearchTerm="Moose" onApply={onApply} />);

    await waitFor(() => expect(searchSpeciesMock).toHaveBeenLastCalledWith('Moose'));
    expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'Moose' }, { page: 1, limit: 25 });

    await user.click(await screen.findByText('Alces alces'));
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 3,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 180703
        }
      ]
    });
  });

  it('sets a suggested species chip as taxon_id equals TSN without an extra property search when taxon_id is already loaded', async () => {
    const onApply = vi.fn();

    searchSpeciesMock.mockResolvedValue({
      searchResponse: [{ scientificName: 'Alces alces', tsn: 180703, commonNames: ['moose'] }]
    });
    searchPropertiesMock.mockResolvedValue({
      properties: {
        string: [],
        number: [],
        boolean: [],
        datetime: [],
        taxon: [
          {
            feature_property_id: 7,
            property_name: 'taxon_id',
            property_display_name: 'Taxonomic identifier',
            feature_property_type: 'taxon',
            operators: ['Equals', 'ParentOf', 'ChildOf', 'DescendsFrom', 'AscendsFrom', 'Exists'],
            relevancy_score: 5
          }
        ],
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
    });

    render(<ExpressionBuilder recommendedSearchTerm="Moose" onApply={onApply} />);

    await screen.findByText('Alces alces');
    expect(searchPropertiesMock).toHaveBeenCalledTimes(2);
    expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'Moose' }, { page: 1, limit: 25 });

    await user.click(await screen.findByText('Alces alces'));

    expect(searchPropertiesMock).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 7,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 180703
        }
      ]
    });
  });

  it('loads taxon_id on species chip click when recommended properties do not include it', async () => {
    const onApply = vi.fn();

    searchSpeciesMock.mockResolvedValue({
      searchResponse: [{ scientificName: 'Alces alces', tsn: 180703, commonNames: ['moose'] }]
    });
    searchPropertiesMock.mockResolvedValueOnce(defaultSearchPropertyResponse);
    searchPropertiesMock.mockResolvedValueOnce(defaultSearchPropertyResponse);
    searchPropertiesMock.mockResolvedValueOnce({
      properties: {
        string: [],
        number: [],
        boolean: [],
        datetime: [],
        taxon: [
          {
            feature_property_id: 7,
            property_name: 'taxon_id',
            property_display_name: 'Taxonomic identifier',
            feature_property_type: 'taxon',
            operators: ['Equals', 'ParentOf', 'ChildOf', 'DescendsFrom', 'AscendsFrom', 'Exists'],
            relevancy_score: 5
          }
        ],
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
    });

    render(<ExpressionBuilder recommendedSearchTerm="Moose" onApply={onApply} />);

    await screen.findByText('Alces alces');
    expect(searchPropertiesMock).toHaveBeenCalledTimes(2);
    expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'Moose' }, { page: 1, limit: 25 });

    await user.click(screen.getByText('Alces alces'));
    await waitFor(() =>
      expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'taxon_id' }, { page: 1, limit: 25 })
    );
    expect(searchPropertiesMock).toHaveBeenCalledTimes(3);

    await user.click(screen.getByText('Alces alces'));

    expect(searchPropertiesMock).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 7,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 180703
        },
        {
          type: 'predicate',
          feature_property_id: 7,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 180703
        }
      ]
    });
  });

  it('shows a snackbar when a suggested species has no taxon_id property', async () => {
    searchSpeciesMock.mockResolvedValue({
      searchResponse: [{ scientificName: 'Alces alces', tsn: 180703, commonNames: ['moose'] }]
    });
    searchPropertiesMock.mockResolvedValue(emptySearchPropertyResponse);

    render(<ExpressionBuilder recommendedSearchTerm="Moose" onApply={vi.fn()} />);

    await screen.findByText('Alces alces');
    expect(searchPropertiesMock).toHaveBeenCalledTimes(2);
    expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'Moose' }, { page: 1, limit: 25 });

    await user.click(screen.getByText('Alces alces'));

    await waitFor(() =>
      expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'taxon_id' }, { page: 1, limit: 25 })
    );
    expect(setSnackbarMock).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Failed to find property for Alces alces'
    });
  });

  it('adds an editable predicate token from a suggested property chip', async () => {
    searchPropertiesMock.mockResolvedValue({
      properties: {
        string: [],
        number: [],
        boolean: [],
        datetime: [],
        taxon: [
          {
            feature_property_id: 3,
            property_name: 'species',
            property_display_name: 'Species',
            feature_property_type: 'taxon',
            operators: ['Equals', 'ParentOf', 'ChildOf', 'DescendsFrom', 'AscendsFrom', 'Exists'],
            relevancy_score: 5
          }
        ],
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
    });

    render(<ExpressionBuilder recommendedSearchTerm="species" onApply={vi.fn()} />);

    await waitFor(() =>
      expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'species' }, { page: 1, limit: 25 })
    );

    await user.click(await screen.findByText('Species'));

    expect(screen.getByRole('combobox', { name: 'Property' })).toHaveValue('Species');
    expect(screen.getByRole('combobox', { name: 'Operator' })).toHaveValue('equals');
    expect(screen.getByLabelText('Value')).toHaveValue('');
    expect(screen.getByLabelText('Value')).toHaveAttribute('placeholder', 'Value');
    expect(screen.getByRole('button', { name: /apply/i })).toBeEnabled();
  });

  it('does not suggest properties already present in the predicate tree', async () => {
    searchPropertiesMock.mockResolvedValue({
      properties: {
        string: [
          {
            feature_property_id: 1,
            property_name: 'species_name',
            property_display_name: 'Species name',
            feature_property_type: 'string',
            operators: ['Equals', 'ILike', 'Exists'],
            relevancy_score: 5
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
    });

    render(<ExpressionBuilder recommendedSearchTerm="species" onApply={vi.fn()} />);

    await waitFor(() =>
      expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'species' }, { page: 1, limit: 25 })
    );

    await user.click(await screen.findByText('Species name'));

    expect(screen.getByRole('combobox', { name: 'Property' })).toHaveValue('Species name');
    expect(screen.queryByText('Species name')).not.toBeInTheDocument();
  });

  it('refreshes suggested filters when the recommended search term changes', async () => {
    searchSpeciesMock.mockResolvedValue({
      searchResponse: [{ scientificName: 'Alces alces', tsn: 180703, commonNames: ['moose'] }]
    });

    const { rerender } = render(<ExpressionBuilder recommendedSearchTerm="M" onApply={vi.fn()} />);

    rerender(<ExpressionBuilder recommendedSearchTerm="Mo" onApply={vi.fn()} />);
    rerender(<ExpressionBuilder recommendedSearchTerm="Moose" onApply={vi.fn()} />);

    await waitFor(() => expect(searchSpeciesMock).toHaveBeenLastCalledWith('Moose'));

    expect(searchSpeciesMock).toHaveBeenCalledWith('M');
    expect(searchSpeciesMock).toHaveBeenCalledWith('Mo');
    expect(searchSpeciesMock).toHaveBeenCalledWith('Moose');
    expect(searchPropertiesMock).toHaveBeenCalledWith({}, { page: 1, limit: 25 });
    expect(searchPropertiesMock).toHaveBeenCalledWith({ keyword: 'Moose' }, { page: 1, limit: 25 });
  });

  it('keeps latest suggested property chips when an older recommendation response finishes later', async () => {
    vi.useFakeTimers();

    const createDeferred = <T,>() => {
      let resolve!: (value: T) => unknown;
      const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
      });

      return { promise, resolve };
    };
    const emptyPropertyResponse: SearchPropertyResponse = {
      properties: {
        string: [],
        number: [],
        boolean: [],
        datetime: [],
        taxon: [],
        spatial: [],
        code: []
      },
      pagination: {
        total: 0,
        per_page: 25,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    };
    const caribouProperties = createDeferred<typeof emptyPropertyResponse>();
    const descriptionProperties = createDeferred<typeof emptyPropertyResponse>();

    try {
      searchSpeciesMock.mockResolvedValue({ searchResponse: [] });
      searchPropertiesMock.mockImplementation((filters: { keyword?: string }) => {
        if (filters.keyword === 'caribou') {
          return caribouProperties.promise;
        }

        if (filters.keyword === 'description') {
          return descriptionProperties.promise;
        }

        return Promise.resolve(emptyPropertyResponse);
      });

      const { rerender } = render(<ExpressionBuilder recommendedSearchTerm="caribou" onApply={vi.fn()} />);

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
      });

      rerender(<ExpressionBuilder recommendedSearchTerm="description" onApply={vi.fn()} />);

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        descriptionProperties.resolve({
          properties: {
            ...emptyPropertyResponse.properties,
            string: [
              {
                feature_property_id: 46,
                property_name: 'description',
                property_display_name: 'Description',
                feature_property_type: 'string',
                operators: ['Equals', 'NotEquals', 'Like', 'ILike', 'StartsWith', 'EndsWith', 'Contains', 'Exists'],
                relevancy_score: 2
              }
            ]
          },
          pagination: {
            ...emptyPropertyResponse.pagination,
            total: 1
          }
        });
        await Promise.resolve();
      });

      expect(screen.getByText('Description')).toBeVisible();

      await act(async () => {
        caribouProperties.resolve(emptyPropertyResponse);
        await Promise.resolve();
      });

      expect(screen.getByText('Description')).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it('searches properties through the property search API', async () => {
    vi.useFakeTimers();

    searchPropertiesMock.mockResolvedValue({
      properties: {
        string: [
          {
            feature_property_id: 9,
            property_name: 'habitat_name',
            property_display_name: 'Habitat name',
            feature_property_type: 'string',
            operators: ['Equals', 'ILike', 'Exists'],
            relevancy_score: 2
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
    });

    try {
      render(<ExpressionBuilder onApply={vi.fn()} />);

      const searchInput = screen.getAllByRole('combobox', { name: 'Property' })[0];
      fireEvent.change(searchInput, { target: { value: 'habitat' } });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'habitat' }, { page: 1, limit: 25 });
      expect(searchPropertiesMock.mock.calls.filter(([filters]) => filters.keyword === 'habitat')).toHaveLength(1);

      vi.useRealTimers();
      const listbox = await openCombobox(searchInput);
      fireEvent.click(within(listbox).getByRole('option', { name: 'Habitat name' }));

      expect(screen.getAllByRole('combobox', { name: 'Property' })[0]).toHaveValue('Habitat name');
    } finally {
      vi.useRealTimers();
    }
  });

  it(
    'shares property options across tokens and preserves selected labels after options refresh',
    async () => {
      const initialProperties: SearchPropertyResponse = {
        properties: {
          string: [
            {
              feature_property_id: 11,
              property_name: 'description',
              property_display_name: 'Description',
              feature_property_type: 'string',
              operators: ['Equals', 'ILike', 'Exists'],
              relevancy_score: 5
            },
            {
              feature_property_id: 12,
              property_name: 'species_name',
              property_display_name: 'Species name',
              feature_property_type: 'string',
              operators: ['Equals', 'ILike', 'Exists'],
              relevancy_score: 4
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
          total: 2,
          per_page: 25,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      };
      const habitatProperties: SearchPropertyResponse = {
        properties: {
          string: [
            {
              feature_property_id: 13,
              property_name: 'habitat_name',
              property_display_name: 'Habitat name',
              feature_property_type: 'string',
              operators: ['Equals', 'ILike', 'Exists'],
              relevancy_score: 3
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

      searchPropertiesMock.mockResolvedValueOnce(initialProperties).mockResolvedValueOnce(habitatProperties);

      render(<ExpressionBuilder onApply={vi.fn()} />);

      await waitFor(() => expect(searchPropertiesMock).toHaveBeenCalledWith({}, { page: 1, limit: 25 }));

      let propertyInputs = screen.getAllByRole('combobox', { name: 'Property' });
      let listbox = await openCombobox(propertyInputs[0]);
      expect(within(listbox).getByRole('option', { name: 'Description' })).toBeVisible();
      expect(within(listbox).getByRole('option', { name: 'Species name' })).toBeVisible();
      fireEvent.click(within(listbox).getByRole('option', { name: 'Description' }));

      await user.click(screen.getByRole('button', { name: /add filter/i }));

      propertyInputs = screen.getAllByRole('combobox', { name: 'Property' });
      listbox = await openCombobox(propertyInputs[1]);
      expect(within(listbox).getByRole('option', { name: 'Description' })).toBeVisible();
      expect(within(listbox).getByRole('option', { name: 'Species name' })).toBeVisible();

      fireEvent.change(propertyInputs[1], { target: { value: 'habitat' } });
      await waitFor(() =>
        expect(searchPropertiesMock).toHaveBeenLastCalledWith({ keyword: 'habitat' }, { page: 1, limit: 25 })
      );
      await waitFor(() => expect(propertyInputs[0]).toHaveValue('Description'));
      listbox = await openCombobox(propertyInputs[1]);
      fireEvent.click(within(listbox).getByRole('option', { name: 'Habitat name' }));

      propertyInputs = screen.getAllByRole('combobox', { name: 'Property' });
      expect(propertyInputs[0]).toHaveValue('Description');
      expect(propertyInputs[1]).toHaveValue('Habitat name');
    },
    expressionBuilderInteractionTimeout
  );

  it('keeps the value field enabled but omits the value when Exists is selected', async () => {
    const onApply = vi.fn();
    render(<ExpressionBuilder onApply={onApply} />);

    await addPropertyFilter('Species name');

    const operatorSelect = screen.getByRole('combobox', { name: 'Operator' });
    await selectOption(operatorSelect, 'exists');

    expect(screen.getByLabelText('Value')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'Exists'
        }
      ]
    });
  });

  it('keeps complete filters editable with dropdown controls', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await addPropertyFilter('Species name');

    const operatorSelect = screen.getByRole('combobox', { name: 'Operator' });
    await selectOption(operatorSelect, 'contains, case-insensitive');
    await user.type(screen.getByLabelText('Value'), 'wolf');

    expect(screen.getByRole('combobox', { name: 'Property' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Operator' })).toBeVisible();
    expect(screen.getByLabelText('Value')).toHaveValue('wolf');
  });

  it('clears only the predicate value from the value input clear button', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await addPropertyFilter('Species name');
    await user.type(screen.getByLabelText('Value'), 'wolf');
    await user.click(screen.getByRole('button', { name: 'Clear value' }));

    expect(screen.getByRole('combobox', { name: 'Property' })).toHaveValue('Species name');
    expect(screen.getByRole('combobox', { name: 'Operator' })).toHaveValue('contains, case-insensitive');
    expect(screen.getByLabelText('Value')).toHaveValue('');
  });

  it(
    'groups filters by dragging one predicate onto another predicate',
    async () => {
      render(<ExpressionBuilder onApply={vi.fn()} />);

      expect(screen.queryByRole('button', { name: 'Group' })).not.toBeInTheDocument();

      await addPropertyFilter('Species name');
      await addPropertyFilter('Elevation');

      const tokens = screen.getAllByTestId('expression-filter-token');
      fireEvent.dragStart(tokens[1]);
      fireEvent.dragOver(tokens[0]);

      expect(tokens[0]).toHaveAttribute('data-drop-active', 'true');

      fireEvent.drop(tokens[0]);

      expect(screen.getByRole('button', { name: /apply/i })).toBeEnabled();
      expect(screen.getByRole('combobox', { name: /group match mode/i })).toBeVisible();
      expect(screen.queryByPlaceholderText('Search properties to add to this group...')).not.toBeInTheDocument();
    },
    expressionBuilderInteractionTimeout
  );

  it(
    'highlights the group that will receive a dragged predicate',
    async () => {
      render(<ExpressionBuilder onApply={vi.fn()} />);

      await addPropertyFilter('Species name');
      await addPropertyFilter('Elevation');

      const initialTokens = screen.getAllByTestId('expression-filter-token');
      fireEvent.dragStart(initialTokens[1]);
      fireEvent.drop(initialTokens[0]);

      await addPropertyFilter('Species name');

      const group = screen.getByTestId('expression-group-token');
      const tokens = screen.getAllByTestId('expression-filter-token');
      const rootToken = tokens[tokens.length - 1];

      expect(group).toHaveAttribute('data-drop-active', 'false');

      fireEvent.dragStart(rootToken);
      fireEvent.dragOver(group);

      expect(group).toHaveAttribute('data-drop-active', 'true');

      fireEvent.drop(group);

      expect(group).toHaveAttribute('data-drop-active', 'false');
      expect(group.querySelectorAll('[data-testid="expression-filter-token"]')).toHaveLength(3);
    },
    expressionBuilderInteractionTimeout
  );

  it(
    'moves a top-level group into another group by dragging the group handle',
    async () => {
      render(<ExpressionBuilder onApply={vi.fn()} />);

      await addPropertyFilter('Species name');
      await addPropertyFilter('Elevation');

      let tokens = screen.getAllByTestId('expression-filter-token');
      fireEvent.dragStart(tokens[1]);
      fireEvent.drop(tokens[0]);

      await addPropertyFilter('Species name');
      await addPropertyFilter('Elevation');

      tokens = screen.getAllByTestId('expression-filter-token');
      fireEvent.dragStart(tokens[tokens.length - 1]);
      fireEvent.drop(tokens[tokens.length - 2]);

      let groups = screen.getAllByTestId('expression-group-token');
      expect(groups).toHaveLength(2);

      const groupHandles = screen.getAllByLabelText('Drag group');
      fireEvent.dragStart(groupHandles[0]);
      fireEvent.dragOver(groups[1]);

      expect(groups[1]).toHaveAttribute('data-drop-active', 'true');

      fireEvent.drop(groups[1]);

      groups = screen.getAllByTestId('expression-group-token');
      expect(groups).toHaveLength(2);
      expect(groups.some((group) => group.querySelector('[data-testid="expression-group-token"]'))).toBe(true);
    },
    expressionBuilderInteractionTimeout
  );

  it('moves a grouped predicate out to the root surface when dropped outside a group', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await addPropertyFilter('Species name');
    await addPropertyFilter('Elevation');

    const initialTokens = screen.getAllByTestId('expression-filter-token');
    fireEvent.dragStart(initialTokens[1]);
    fireEvent.drop(initialTokens[0]);

    const surface = screen.getByTestId('expression-input-surface');
    const clauseStack = screen.getByTestId('expression-clause-stack');
    const group = screen.getByTestId('expression-group-token');
    const groupedToken = group.querySelector('[data-testid="expression-filter-token"]');

    expect(groupedToken).not.toBeNull();
    expect(group.querySelectorAll('[data-testid="expression-filter-token"]')).toHaveLength(2);

    fireEvent.dragStart(groupedToken as Element);
    fireEvent.dragOver(surface);

    expect(surface).toBeVisible();
    expect(screen.getByTestId('expression-builder')).toHaveAttribute('data-root-drop-active', 'true');
    expect(clauseStack).toHaveAttribute('data-drop-active', 'true');
    expect(clauseStack).not.toContainElement(screen.getByRole('button', { name: /add filter/i }));

    fireEvent.drop(surface);

    expect(screen.getByTestId('expression-group-token')).toBeVisible();
    expect(screen.getAllByTestId('expression-filter-token')).toHaveLength(2);
  });

  it('moves a grouped predicate to the root when dropped anywhere in the builder popper', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await addPropertyFilter('Species name');
    await addPropertyFilter('Elevation');

    const initialTokens = screen.getAllByTestId('expression-filter-token');
    fireEvent.dragStart(initialTokens[1]);
    fireEvent.drop(initialTokens[0]);

    const builder = screen.getByTestId('expression-builder');
    const clauseStack = screen.getByTestId('expression-clause-stack');
    const group = screen.getByTestId('expression-group-token');
    const groupedToken = group.querySelector('[data-testid="expression-filter-token"]');

    expect(groupedToken).not.toBeNull();

    fireEvent.dragStart(groupedToken as Element);
    fireEvent.dragOver(builder);

    expect(builder).toHaveAttribute('data-root-drop-active', 'true');
    expect(clauseStack).toHaveAttribute('data-drop-active', 'true');

    fireEvent.drop(builder);

    expect(screen.getByTestId('expression-group-token')).toBeVisible();
    expect(screen.getAllByTestId('expression-filter-token')).toHaveLength(2);
  });

  it(
    'moves a nested group to the root when dropped anywhere in the builder popper',
    async () => {
      render(<ExpressionBuilder onApply={vi.fn()} />);

      await addPropertyFilter('Species name');
      await addPropertyFilter('Elevation');

      let tokens = screen.getAllByTestId('expression-filter-token');
      fireEvent.dragStart(tokens[1]);
      fireEvent.drop(tokens[0]);

      await addPropertyFilter('Species name');
      await addPropertyFilter('Elevation');

      tokens = screen.getAllByTestId('expression-filter-token');
      fireEvent.dragStart(tokens[tokens.length - 1]);
      fireEvent.drop(tokens[tokens.length - 2]);

      let groups = screen.getAllByTestId('expression-group-token');
      const groupHandles = screen.getAllByLabelText('Drag group');

      fireEvent.dragStart(groupHandles[0]);
      fireEvent.drop(groups[1]);

      groups = screen.getAllByTestId('expression-group-token');
      expect(groups.some((group) => group.querySelector('[data-testid="expression-group-token"]'))).toBe(true);

      const builder = screen.getByTestId('expression-builder');
      const clauseStack = screen.getByTestId('expression-clause-stack');
      fireEvent.dragStart(screen.getAllByLabelText('Drag group')[1]);
      fireEvent.dragOver(builder);

      expect(builder).toHaveAttribute('data-root-drop-active', 'true');
      expect(clauseStack).toHaveAttribute('data-drop-active', 'true');

      fireEvent.drop(builder);

      groups = screen.getAllByTestId('expression-group-token');
      expect(groups).toHaveLength(2);
      expect(groups.some((group) => group.querySelector('[data-testid="expression-group-token"]'))).toBe(false);
    },
    expressionBuilderInteractionTimeout
  );

  it('keeps a group when removing a predicate leaves that group with one child', async () => {
    render(<ExpressionBuilder onApply={vi.fn()} />);

    await addPropertyFilter('Species name');
    await addPropertyFilter('Elevation');

    const initialTokens = screen.getAllByTestId('expression-filter-token');
    fireEvent.dragStart(initialTokens[1]);
    fireEvent.drop(initialTokens[0]);

    const group = screen.getByTestId('expression-group-token');
    const removeFilterButton = group.querySelector('[aria-label="Remove filter"]');
    expect(removeFilterButton).not.toBeNull();
    await user.click(removeFilterButton as Element);

    expect(screen.getByTestId('expression-group-token')).toBeVisible();
    expect(screen.getAllByTestId('expression-filter-token')).toHaveLength(1);
  });
});
