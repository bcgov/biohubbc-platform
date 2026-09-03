import { cleanup, fireEvent } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { CursorPagination } from 'types/pagination';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomPagination } from './CustomPagination';

const defaultCursor: CursorPagination = {
  limit: 10,
  sort: 'relevancy_score',
  order: 'desc',
  next: 'next-token',
  previous: null
};

const defaultProps = {
  cursor: defaultCursor,
  currentPage: 1,
  rowCount: 10,
  totalCount: 100,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn()
};

describe('CustomPagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the total count label', () => {
    const { getByText } = render(<CustomPagination {...defaultProps} />);

    expect(getByText('Showing 10 of 100 rows')).toBeInTheDocument();
  });

  it('renders the page size and total for a middle page', () => {
    const { getByText } = render(<CustomPagination {...defaultProps} currentPage={3} totalCount={100} />);

    expect(getByText('Showing 10 of 100 rows')).toBeInTheDocument();
  });

  it('renders "Showing 0 of 0 rows" when there are no results', () => {
    const { getByText } = render(<CustomPagination {...defaultProps} currentPage={1} rowCount={0} totalCount={0} />);

    expect(getByText('Showing 0 of 0 rows')).toBeInTheDocument();
  });

  it('renders an unknown-total state with only previous and next navigation', () => {
    const { getByRole, getByText, queryByRole } = render(
      <CustomPagination
        cursor={defaultCursor}
        currentPage={1}
        rowCount={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(getByText('Showing 10 rows')).toBeInTheDocument();
    expect(getByRole('button', { name: /go to previous page/i })).toBeDisabled();
    expect(getByRole('button', { name: /go to next page/i })).toBeEnabled();
    expect(queryByRole('button', { name: /^page \d+$/i })).not.toBeInTheDocument();
  });

  it('calls onPageChange when the next button is clicked', () => {
    const onPageChange = vi.fn();
    const { getByRole } = render(<CustomPagination {...defaultProps} totalCount={50} onPageChange={onPageChange} />);

    fireEvent.click(getByRole('button', { name: /go to next page/i }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('shows page position without rendering arbitrary page buttons', () => {
    const { getByText, queryByRole } = render(<CustomPagination {...defaultProps} currentPage={5} />);

    expect(getByText('Page 5 of 10')).toBeInTheDocument();
    expect(queryByRole('button', { name: /^page \d+$/i })).not.toBeInTheDocument();
  });

  it('calls onPageSizeChange when the page size select changes', () => {
    const onPageSizeChange = vi.fn();
    const { getByRole } = render(<CustomPagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    fireEvent.mouseDown(getByRole('combobox', { name: /rows per page/i }));
    fireEvent.click(getByRole('option', { name: /25/i }));

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('renders the page size select with the current pageSize selected', () => {
    const { getByRole } = render(<CustomPagination {...defaultProps} cursor={{ ...defaultCursor, limit: 25 }} />);

    expect(getByRole('combobox', { name: /rows per page/i })).toHaveTextContent('25');
  });

  it('disables previous/next navigation when on the only page', () => {
    const { getByRole } = render(
      <CustomPagination {...defaultProps} cursor={{ ...defaultCursor, next: null }} currentPage={1} totalCount={5} />
    );

    expect(getByRole('button', { name: /go to previous page/i })).toBeDisabled();
    expect(getByRole('button', { name: /go to next page/i })).toBeDisabled();
  });
});
