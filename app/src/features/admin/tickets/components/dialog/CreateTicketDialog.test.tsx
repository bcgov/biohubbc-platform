import { fireEvent, waitFor } from '@testing-library/react';
import { CodesContext, ICodesContext } from 'contexts/codesContext';
import { DataLoader } from 'hooks/useDataLoader';
import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { render } from 'test-helpers/test-utils';
import { CreateTicketDialog } from './CreateTicketDialog';

describe('CreateTicketDialog', () => {
  const renderDialog = (onCreate = vi.fn()) => {
    const mockCodesData: IGetAllCodeSetsResponse = {
      feature_type_with_properties: [],
      ticket_priorities: ['low', 'medium', 'high', 'critical']
    };

    const mockCodesDataLoader: DataLoader<[], IGetAllCodeSetsResponse, unknown> = {
      data: mockCodesData,
      error: undefined,
      isLoading: false,
      isReady: true,
      load: vi.fn().mockResolvedValue(mockCodesData),
      refresh: vi.fn().mockResolvedValue(mockCodesData),
      clear: vi.fn(),
      setData: vi.fn()
    };

    const mockCodesContext: ICodesContext = {
      codesDataLoader: {
        ...mockCodesDataLoader
      }
    };

    return {
      onCreate,
      ...render(
        <CodesContext.Provider value={mockCodesContext}>
          <CreateTicketDialog open={true} isSaving={false} onClose={vi.fn()} onCreate={onCreate} />
        </CodesContext.Provider>
      )
    };
  };

  it('does not submit when required fields are missing', async () => {
    const onCreate = vi.fn();
    const { getByTestId } = renderDialog(onCreate);

    fireEvent.click(getByTestId('edit-dialog-save-button'));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits with default medium priority when omitted', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    const { getByLabelText, getByTestId } = renderDialog(onCreate);

    fireEvent.change(getByLabelText(/Subject/i), { target: { value: 'Test Ticket' } });
    fireEvent.change(getByLabelText(/Description/i), { target: { value: 'Details' } });

    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        title: 'Test Ticket',
        description: 'Details',
        priority: 'medium'
      });
    });
  });
});
