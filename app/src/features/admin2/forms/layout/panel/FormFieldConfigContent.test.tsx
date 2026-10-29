import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { FormFieldConfigContent } from './FormFieldConfigContent';

vi.mock('hooks/useApi');

const pagination = { total: 1, current_page: 1, last_page: 1, per_page: 100 };

const mockUseApi = {
  contributors: { listContributorCodesets: vi.fn() }
};

describe('FormFieldConfigContent', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.contributors.listContributorCodesets.mockResolvedValue({
      codesets: [
        {
          contributor_codeset_id: 50,
          contributor_id: 3,
          key: 'sex',
          label: 'Sex',
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

  it("offers the contributor's codesets for a code field", async () => {
    const onChange = vi.fn();
    const { getByRole, findByRole } = render(
      <FormFieldConfigContent
        contributorId={3}
        field={{
          featurePropertyId: 200,
          displayName: 'Sex',
          typeName: 'code',
          label: 'Sex',
          description: null,
          contributorCodesetId: null
        }}
        onChange={onChange}
        readOnly={false}
      />
    );

    await waitFor(() =>
      expect(mockUseApi.contributors.listContributorCodesets).toHaveBeenCalledWith(3, expect.anything())
    );
    fireEvent.mouseDown(getByRole('combobox', { name: /Codeset/ }));
    fireEvent.click(await findByRole('option', { name: 'Sex' }));

    expect(onChange).toHaveBeenCalledWith({ contributorCodesetId: 50 });
  });

  it('offers no codeset for other fields', () => {
    const { queryByRole } = render(
      <FormFieldConfigContent
        contributorId={3}
        field={{
          featurePropertyId: 201,
          displayName: 'Notes',
          typeName: 'string',
          label: 'Notes',
          description: null,
          contributorCodesetId: null
        }}
        onChange={vi.fn()}
        readOnly={false}
      />
    );

    expect(queryByRole('combobox', { name: /Codeset/ })).not.toBeInTheDocument();
    expect(mockUseApi.contributors.listContributorCodesets).not.toHaveBeenCalled();
  });
});
