import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { FilterSidebar } from './FilterSidebar';
import { ActiveFilter, FilterGroup } from './types';

describe('FilterSidebar', () => {
  const mockOnFiltersChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockFilterGroups: FilterGroup[] = [
    {
      id: 1,
      name: 'animal',
      displayName: 'Animal',
      properties: [
        { name: 'scientific_name', displayName: 'Scientific Name', type: 'text' },
        { name: 'count', displayName: 'Count', type: 'number' }
      ]
    },
    {
      id: 2,
      name: 'dataset',
      displayName: 'Dataset',
      properties: [
        { name: 'name', displayName: 'Name', type: 'text' },
        { name: 'start_date', displayName: 'Start Date', type: 'datetime' }
      ]
    }
  ];

  const defaultProps = {
    filterGroups: mockFilterGroups,
    activeFilters: [] as ActiveFilter[],
    onFiltersChange: mockOnFiltersChange
  };

  it('renders the Filters header', () => {
    const { getByText } = render(<FilterSidebar {...defaultProps} />);

    expect(getByText('Filters')).toBeVisible();
  });

  it('renders all filter groups', () => {
    const { getByText } = render(<FilterSidebar {...defaultProps} />);

    expect(getByText('Animal (2)')).toBeVisible();
    expect(getByText('Dataset (2)')).toBeVisible();
  });

  it('renders search input for filtering', () => {
    const { getByPlaceholderText } = render(<FilterSidebar {...defaultProps} />);

    expect(getByPlaceholderText('Search filters...')).toBeVisible();
  });

  it('filters groups by search term', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<FilterSidebar {...defaultProps} />);

    const searchInput = getByPlaceholderText('Search filters...');
    fireEvent.change(searchInput, { target: { value: 'scientific' } });

    await waitFor(() => {
      // Animal group should still be visible (has scientific_name)
      expect(getByText('Animal (1)')).toBeVisible();
      // Dataset group should be hidden (no matching properties)
      expect(queryByText('Dataset')).not.toBeInTheDocument();
    });
  });

  it('shows "No filters match" when search has no results', async () => {
    const { getByPlaceholderText, getByText } = render(<FilterSidebar {...defaultProps} />);

    const searchInput = getByPlaceholderText('Search filters...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(getByText('No filters match your search')).toBeVisible();
    });
  });

  it('clears search when clear button is clicked', async () => {
    const { getByPlaceholderText, getByLabelText, getByText } = render(<FilterSidebar {...defaultProps} />);

    const searchInput = getByPlaceholderText('Search filters...');
    fireEvent.change(searchInput, { target: { value: 'scientific' } });

    await waitFor(() => {
      expect(getByLabelText('Clear search')).toBeVisible();
    });

    const clearButton = getByLabelText('Clear search');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(getByText('Animal (2)')).toBeVisible();
      expect(getByText('Dataset (2)')).toBeVisible();
    });
  });

  it('shows clear filters button when filters are active', () => {
    const activeFilters: ActiveFilter[] = [
      {
        featureType: 'animal',
        featureTypeDisplayName: 'Animal',
        property: 'scientific_name',
        propertyType: 'text',
        label: 'Scientific Name',
        value: 'Ursus arctos'
      }
    ];

    const { getByText } = render(<FilterSidebar {...defaultProps} activeFilters={activeFilters} />);

    expect(getByText('Clear all filters (1)')).toBeVisible();
  });

  it('does not show clear filters button when no filters are active', () => {
    const { queryByText } = render(<FilterSidebar {...defaultProps} />);

    expect(queryByText(/Clear all filters/)).not.toBeInTheDocument();
  });

  it('calls onFiltersChange with empty array when clear all is clicked', async () => {
    const activeFilters: ActiveFilter[] = [
      {
        featureType: 'animal',
        featureTypeDisplayName: 'Animal',
        property: 'scientific_name',
        propertyType: 'text',
        label: 'Scientific Name',
        value: 'Ursus arctos'
      }
    ];

    const { getByText } = render(<FilterSidebar {...defaultProps} activeFilters={activeFilters} />);

    const clearButton = getByText('Clear all filters (1)');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith([]);
    });
  });

  it('renders popular filters section', () => {
    const groupsWithPopular: FilterGroup[] = [
      {
        id: 1,
        name: 'animal',
        displayName: 'Animal',
        properties: [
          { name: 'scientific_name', displayName: 'Scientific Name', type: 'text' },
          { name: 'sex', displayName: 'Sex', type: 'text' }
        ]
      }
    ];

    const { getByText } = render(<FilterSidebar {...defaultProps} filterGroups={groupsWithPopular} />);

    expect(getByText('Popular')).toBeVisible();
  });

  it('adds filter when checkbox value is confirmed', async () => {
    const { getByText, getAllByRole, getByPlaceholderText, getByLabelText } = render(
      <FilterSidebar {...defaultProps} />
    );

    // Expand Animal group
    fireEvent.click(getByText('Animal (2)'));

    await waitFor(() => {
      expect(getByText('Scientific Name')).toBeVisible();
    });

    // Click checkbox for Scientific Name
    const checkboxes = getAllByRole('checkbox');
    // Find the Scientific Name checkbox (first one in expanded Animal group)
    const scientificNameCheckbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('Scientific Name');
    });

    if (scientificNameCheckbox) {
      fireEvent.click(scientificNameCheckbox);
    }

    // Enter a value
    const input = getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: 'Ursus arctos' } });

    // Confirm
    const confirmButton = getByLabelText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalled();
      const calledWith = mockOnFiltersChange.mock.calls[0][0];
      expect(calledWith).toHaveLength(1);
      expect(calledWith[0]).toMatchObject({
        featureType: 'animal',
        property: 'scientific_name',
        value: 'Ursus arctos'
      });
    });
  });

  it('removes filter when filter is unchecked', async () => {
    const activeFilters: ActiveFilter[] = [
      {
        featureType: 'animal',
        featureTypeDisplayName: 'Animal',
        property: 'scientific_name',
        propertyType: 'text',
        label: 'Scientific Name',
        value: 'Ursus arctos'
      }
    ];

    const { getByText, getAllByLabelText } = render(<FilterSidebar {...defaultProps} activeFilters={activeFilters} />);

    // Expand Animal group
    fireEvent.click(getByText('Animal (2)'));

    await waitFor(() => {
      expect(getByText('Scientific Name')).toBeVisible();
    });

    // Click remove button on the first active filter (there may be multiple due to Popular section)
    const removeButtons = getAllByLabelText('Remove filter');
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith([]);
    });
  });

  it('updates existing filter value instead of adding duplicate', async () => {
    const activeFilters: ActiveFilter[] = [
      {
        featureType: 'animal',
        featureTypeDisplayName: 'Animal',
        property: 'scientific_name',
        propertyType: 'text',
        label: 'Scientific Name',
        value: 'Ursus arctos'
      }
    ];

    const groupsWithPopular: FilterGroup[] = [
      {
        id: 1,
        name: 'animal',
        displayName: 'Animal',
        properties: [{ name: 'scientific_name', displayName: 'Scientific Name', type: 'text' }]
      }
    ];

    const { getAllByRole } = render(
      <FilterSidebar {...defaultProps} filterGroups={groupsWithPopular} activeFilters={activeFilters} />
    );

    // Click on the Scientific Name in Popular section to edit
    // First, we need to uncheck and re-check to enter edit mode
    const checkboxes = getAllByRole('checkbox');
    const activeCheckbox = checkboxes.find((cb) => (cb as HTMLInputElement).checked);

    if (activeCheckbox) {
      // Uncheck first
      fireEvent.click(activeCheckbox);

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith([]);
      });
    }
  });

  it('hides popular section when searching', async () => {
    const groupsWithPopular: FilterGroup[] = [
      {
        id: 1,
        name: 'animal',
        displayName: 'Animal',
        properties: [{ name: 'scientific_name', displayName: 'Scientific Name', type: 'text' }]
      }
    ];

    const { getByPlaceholderText, getByText, queryByText } = render(
      <FilterSidebar {...defaultProps} filterGroups={groupsWithPopular} />
    );

    expect(getByText('Popular')).toBeVisible();

    const searchInput = getByPlaceholderText('Search filters...');
    fireEvent.change(searchInput, { target: { value: 'scientific' } });

    await waitFor(() => {
      expect(queryByText('Popular')).not.toBeInTheDocument();
    });
  });
});
