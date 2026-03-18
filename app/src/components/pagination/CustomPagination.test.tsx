import { cleanup, fireEvent } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomPagination } from './CustomPagination';

const defaultProps = {
  currentPage: 1,
  pageSize: 10,
  totalCount: 100,
  lastPage: 10,
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

    expect(getByText('1–10 of 100')).toBeInTheDocument();
  });

  it('renders correct range label for a middle page', () => {
    const { getByText } = render(
      <CustomPagination {...defaultProps} currentPage={3} pageSize={10} totalCount={100} lastPage={10} />
    );

    expect(getByText('21–30 of 100')).toBeInTheDocument();
  });

  it('renders "0–0 of 0" when there are no results', () => {
    const { getByText } = render(
      <CustomPagination {...defaultProps} currentPage={1} pageSize={10} totalCount={0} lastPage={1} />
    );

    expect(getByText('0–0 of 0')).toBeInTheDocument();
  });

  it('calls onPageChange when a page button is clicked', () => {
    const onPageChange = vi.fn();
    const { getByRole } = render(<CustomPagination {...defaultProps} lastPage={5} onPageChange={onPageChange} />);

    fireEvent.click(getByRole('button', { name: /page 2/i }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageSizeChange when the page size select changes', () => {
    const onPageSizeChange = vi.fn();
    const { getByRole } = render(<CustomPagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    fireEvent.mouseDown(getByRole('combobox', { name: /rows per page/i }));
    fireEvent.click(getByRole('option', { name: /25/i }));

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('renders the page size select with the current pageSize selected', () => {
    const { getByRole } = render(<CustomPagination {...defaultProps} pageSize={25} />);

    expect(getByRole('combobox', { name: /rows per page/i })).toHaveTextContent('25');
  });

  it('disables previous/next navigation when on the only page', () => {
    const { getByRole } = render(<CustomPagination {...defaultProps} currentPage={1} lastPage={1} totalCount={5} />);

    expect(getByRole('button', { name: /go to previous page/i })).toBeDisabled();
    expect(getByRole('button', { name: /go to next page/i })).toBeDisabled();
  });
});
