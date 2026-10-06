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

  it('renders "Showing 0 of 0 rows" when there are no results', () => {
    const { getByText } = render(<CustomPagination {...defaultProps} rowCount={0} totalCount={0} />);

    expect(getByText('Showing 0 of 0 rows')).toBeInTheDocument();
  });

  it('renders an unknown-total state with only previous and next navigation', () => {
    const { getByRole, getByText, queryByRole } = render(
      <CustomPagination cursor={defaultCursor} rowCount={10} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
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

    expect(onPageChange).toHaveBeenCalledWith('next-token');
  });

  it('uses the previous cursor and displays no page number', () => {
    const onPageChange = vi.fn();
    const { getByRole, queryByText } = render(
      <CustomPagination
        {...defaultProps}
        cursor={{ ...defaultCursor, previous: 'Previous_Token' }}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(getByRole('button', { name: /go to previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith('Previous_Token');
    expect(queryByText(/^Page /)).not.toBeInTheDocument();
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

  it('updates each arrow from cursor availability and prevents disabled navigation', () => {
    const onPageChange = vi.fn();
    const { getByRole, rerender } = render(<CustomPagination {...defaultProps} onPageChange={onPageChange} />);

    for (const [previous, next] of [
      [null, 'next'],
      ['previous', 'next'],
      ['previous', null],
      [null, null]
    ]) {
      rerender(
        <CustomPagination {...defaultProps} cursor={{ ...defaultCursor, previous, next }} onPageChange={onPageChange} />
      );
      for (const [direction, token] of [
        ['previous', previous],
        ['next', next]
      ]) {
        const button = getByRole('button', { name: `Go to ${direction} page` });
        onPageChange.mockClear();
        if (token) {
          expect(button).toBeEnabled();
          fireEvent.click(button);
          expect(onPageChange).toHaveBeenCalledWith(token);
        } else {
          expect(button).toBeDisabled();
          fireEvent.click(button);
          expect(onPageChange).not.toHaveBeenCalled();
        }
      }
    }
  });
});
