import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import FilterGroup from './FilterGroup';
import { ActiveFilter, FilterProperty } from './types';

describe('FilterGroup', () => {
  const mockOnAddFilter = vi.fn();
  const mockOnRemoveFilter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProperties: FilterProperty[] = [
    { name: 'scientific_name', displayName: 'Scientific Name', type: 'text' },
    { name: 'count', displayName: 'Count', type: 'number' },
    { name: 'start_date', displayName: 'Start Date', type: 'datetime' }
  ];

  const defaultProps = {
    id: 1,
    featureTypeName: 'animal',
    displayName: 'Animal',
    properties: mockProperties,
    activeFilters: [] as ActiveFilter[],
    onAddFilter: mockOnAddFilter,
    onRemoveFilter: mockOnRemoveFilter
  };

  it('renders the group header with display name and property count', () => {
    const { getByText } = render(<FilterGroup {...defaultProps} />);

    expect(getByText('Animal (3)')).toBeVisible();
  });

  it('renders collapsed by default', () => {
    const { queryByText } = render(<FilterGroup {...defaultProps} />);

    // Properties should not be visible when collapsed
    expect(queryByText('Scientific Name')).not.toBeVisible();
  });

  it('renders expanded when defaultExpanded is true', () => {
    const { getByText } = render(<FilterGroup {...defaultProps} defaultExpanded={true} />);

    expect(getByText('Scientific Name')).toBeVisible();
    expect(getByText('Count')).toBeVisible();
    expect(getByText('Start Date')).toBeVisible();
  });

  it('expands when header is clicked', async () => {
    const { getByText, getByRole } = render(<FilterGroup {...defaultProps} />);

    const header = getByRole('button');
    fireEvent.click(header);

    await waitFor(() => {
      expect(getByText('Scientific Name')).toBeVisible();
    });
  });

  it('collapses when expanded header is clicked', async () => {
    const { getByText, getByRole, queryByText } = render(<FilterGroup {...defaultProps} defaultExpanded={true} />);

    expect(getByText('Scientific Name')).toBeVisible();

    const header = getByRole('button');
    fireEvent.click(header);

    await waitFor(() => {
      expect(queryByText('Scientific Name')).not.toBeVisible();
    });
  });

  it('expands when Enter key is pressed on header', async () => {
    const { getByText, getByRole } = render(<FilterGroup {...defaultProps} />);

    const header = getByRole('button');
    fireEvent.keyDown(header, { key: 'Enter' });

    await waitFor(() => {
      expect(getByText('Scientific Name')).toBeVisible();
    });
  });

  it('expands when Space key is pressed on header', async () => {
    const { getByText, getByRole } = render(<FilterGroup {...defaultProps} />);

    const header = getByRole('button');
    fireEvent.keyDown(header, { key: ' ' });

    await waitFor(() => {
      expect(getByText('Scientific Name')).toBeVisible();
    });
  });

  it('shows active count when filters are active', () => {
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

    const { getByText } = render(<FilterGroup {...defaultProps} activeFilters={activeFilters} />);

    expect(getByText('1 active')).toBeVisible();
  });

  it('shows correct active count with multiple active filters', () => {
    const activeFilters: ActiveFilter[] = [
      {
        featureType: 'animal',
        featureTypeDisplayName: 'Animal',
        property: 'scientific_name',
        propertyType: 'text',
        label: 'Scientific Name',
        value: 'Ursus arctos'
      },
      {
        featureType: 'animal',
        featureTypeDisplayName: 'Animal',
        property: 'count',
        propertyType: 'text',
        label: 'Count',
        value: '5'
      }
    ];

    const { getByText } = render(<FilterGroup {...defaultProps} activeFilters={activeFilters} />);

    expect(getByText('2 active')).toBeVisible();
  });

  it('does not count active filters from other feature types', () => {
    const activeFilters: ActiveFilter[] = [
      {
        featureType: 'dataset',
        featureTypeDisplayName: 'Dataset',
        property: 'scientific_name',
        propertyType: 'text',
        label: 'Scientific Name',
        value: 'Some value'
      }
    ];

    const { queryByText } = render(<FilterGroup {...defaultProps} activeFilters={activeFilters} />);

    expect(queryByText('active')).not.toBeInTheDocument();
  });

  it('has correct aria-expanded attribute when collapsed', () => {
    const { getByRole } = render(<FilterGroup {...defaultProps} />);

    const header = getByRole('button');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('has correct aria-expanded attribute when expanded', () => {
    const { getByRole } = render(<FilterGroup {...defaultProps} defaultExpanded={true} />);

    const header = getByRole('button');
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('has correct aria-controls attribute', () => {
    const { getByRole } = render(<FilterGroup {...defaultProps} />);

    const header = getByRole('button');
    expect(header).toHaveAttribute('aria-controls', 'filter-group-content-1');
  });

  it('renders correct test id', () => {
    const { getByTestId } = render(<FilterGroup {...defaultProps} />);

    expect(getByTestId('filter-group-1')).toBeInTheDocument();
  });

  it('calls onAddFilter when a filter checkbox value is confirmed', async () => {
    const { getByText, getAllByRole, getByPlaceholderText, getByLabelText } = render(
      <FilterGroup {...defaultProps} defaultExpanded={true} />
    );

    // Find and click the checkbox for Scientific Name
    const checkboxes = getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // First checkbox is Scientific Name

    // Enter a value
    const input = getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: 'Ursus arctos' } });

    // Confirm
    const confirmButton = getByLabelText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnAddFilter).toHaveBeenCalledWith({
        featureType: 'animal',
        featureTypeDisplayName: 'Animal',
        property: 'scientific_name',
        propertyType: 'text',
        label: 'Scientific Name',
        value: 'Ursus arctos'
      });
    });
  });

  it('calls onRemoveFilter when a filter is removed', async () => {
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

    const { getAllByLabelText } = render(
      <FilterGroup {...defaultProps} activeFilters={activeFilters} defaultExpanded={true} />
    );

    const removeButtons = getAllByLabelText('Remove filter');
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockOnRemoveFilter).toHaveBeenCalledWith('animal', 'scientific_name');
    });
  });
});
