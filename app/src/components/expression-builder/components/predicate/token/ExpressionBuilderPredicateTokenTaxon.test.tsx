import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { ExpressionBuilderPredicateTokenTaxon } from './ExpressionBuilderPredicateTokenTaxon';

const searchTaxonMock = vi.hoisted(() => vi.fn());

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    search: {
      searchTaxon: searchTaxonMock
    }
  })
}));

const taxonSearchResponse = (itisTsn: number, scientificName: string) => ({
  taxonomy: [
    {
      taxon_id: itisTsn,
      itis_tsn: itisTsn,
      itis_scientific_name: scientificName,
      common_name: null,
      rank: 'Species',
      relevancy_score: 1
    }
  ],
  pagination: { total: 1, per_page: 25, current_page: 1, last_page: 1 }
});

const TaxonHarness = ({ onChange }: { onChange: (value: number | undefined) => void }) => {
  const [value, setValue] = useState<number | undefined>();

  return (
    <ExpressionBuilderPredicateTokenTaxon
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
    />
  );
};

describe('ExpressionBuilderPredicateTokenTaxon', () => {
  beforeEach(() => {
    searchTaxonMock.mockReset();
  });

  it('clears the committed TSN when selected taxon text is edited without choosing a replacement', async () => {
    const onChange = vi.fn();
    searchTaxonMock.mockResolvedValue(taxonSearchResponse(180701, 'Ovis canadensis'));
    render(<TaxonHarness onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Taxon'), { target: { value: '180701' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Ovis canadensis' }));

    expect(onChange).toHaveBeenLastCalledWith(180701);

    fireEvent.change(screen.getByLabelText('Taxon'), { target: { value: 'Cervus' } });

    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('keeps the newest autocomplete results when an older request resolves last', async () => {
    let resolveOvisSearch: (response: ReturnType<typeof taxonSearchResponse>) => void = () => undefined;
    let resolveCervusSearch: (response: ReturnType<typeof taxonSearchResponse>) => void = () => undefined;
    const ovisSearch = new Promise<ReturnType<typeof taxonSearchResponse>>((resolve) => {
      resolveOvisSearch = resolve;
    });
    const cervusSearch = new Promise<ReturnType<typeof taxonSearchResponse>>((resolve) => {
      resolveCervusSearch = resolve;
    });

    searchTaxonMock.mockImplementation(({ keyword }: { keyword: string }) =>
      keyword === 'Ovis' ? ovisSearch : cervusSearch
    );
    render(<TaxonHarness onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Taxon'), { target: { value: 'Ovis' } });
    await waitFor(() => expect(searchTaxonMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Taxon'), { target: { value: 'Cervus' } });
    await waitFor(() => expect(searchTaxonMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveCervusSearch(taxonSearchResponse(180694, 'Cervus canadensis'));
      await cervusSearch;
    });
    expect(await screen.findByRole('option', { name: 'Cervus canadensis' })).toBeVisible();

    await act(async () => {
      resolveOvisSearch(taxonSearchResponse(180701, 'Ovis canadensis'));
      await ovisSearch;
    });

    expect(screen.queryByRole('option', { name: 'Ovis canadensis' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cervus canadensis' })).toBeVisible();
  });
});
