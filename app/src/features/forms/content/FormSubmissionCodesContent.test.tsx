import { cleanup, fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { FormSubmissionCodesContent } from './FormSubmissionCodesContent';

vi.mock('hooks/useApi');

const pagination = { total: 2, current_page: 1, last_page: 1, per_page: 100 };

const mockUseApi = {
  forms: {
    getFormCodesets: vi.fn(),
    getFormCodesetCodes: vi.fn()
  }
};

describe('FormSubmissionCodesContent', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.forms.getFormCodesets.mockResolvedValue({
      codesets: [
        {
          contributor_codeset_id: 50,
          contributor_id: 3,
          key: 'sex',
          label: 'Sex',
          description: null,
          external_id: null,
          record_end_date: null
        },
        {
          contributor_codeset_id: 51,
          contributor_id: 3,
          key: 'old',
          label: 'Retired codeset',
          description: null,
          external_id: null,
          record_end_date: '2026-01-01'
        }
      ],
      pagination
    });
    mockUseApi.forms.getFormCodesetCodes.mockResolvedValue({
      codes: [
        {
          contributor_codeset_code_id: 500,
          contributor_codeset_id: 50,
          codeset_label: 'Sex',
          key: 'female',
          label: 'Female',
          description: null,
          external_id: null,
          record_end_date: null
        }
      ],
      pagination
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists the contributor's active codesets without letting submitters add any", async () => {
    const { findByText, queryByText, queryByRole } = render(<FormSubmissionCodesContent slug="caribou" />);

    expect(await findByText('Sex')).toBeInTheDocument();
    expect(queryByText('Retired codeset')).not.toBeInTheDocument();
    expect(queryByRole('button', { name: 'Add Codeset' })).not.toBeInTheDocument();
  });

  it('shows the codes of the selected codeset in the sidebar and closes it', async () => {
    const { findByText, getByRole, queryByText } = render(<FormSubmissionCodesContent slug="caribou" />);

    fireEvent.click(await findByText('Sex'));

    expect(await findByText('Female')).toBeInTheDocument();
    expect(mockUseApi.forms.getFormCodesetCodes).toHaveBeenCalledWith(
      'caribou',
      50,
      expect.objectContaining({ page: 1 }),
      expect.anything()
    );

    fireEvent.click(getByRole('button', { name: 'Close codes' }));

    expect(queryByText('Female')).not.toBeInTheDocument();
  });
});
