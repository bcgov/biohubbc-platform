import { cleanup, waitFor } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock, vi } from 'vitest';
import { AdminDataRequestFeatureTypePage } from './AdminDataRequestFeatureTypePage';

// Use one router module for the DOM components and shared query hooks in Vitest.
vi.mock('react-router-dom', () => vi.importActual('react-router'));

vi.mock('hooks/useApi');
vi.mock('features/search/result/layout/map/SearchResultMapContainer', () => ({
  SearchResultMapContainer: () => <div data-testid="search-result-map" />
}));

const expression = { type: 'expression', operator: 'AND', clauses: [] };

const mockUseApi = {
  dataRequest: {
    getDataRequestFeatureTypes: vi.fn()
  },
  search: {
    searchFeatures: vi.fn(),
    countFeatures: vi.fn()
  }
};

const renderContainer = (route: string) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/admin/data-requests/:dataRequestId/feature-types/:featureType"
          element={<AdminDataRequestFeatureTypePage />}
        />
        <Route path="/page-not-found" element={<div data-testid="not-found-page" />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminDataRequestFeatureTypePage', () => {
  beforeEach(() => {
    (useApi as Mock).mockReturnValue(mockUseApi);
    mockUseApi.dataRequest.getDataRequestFeatureTypes.mockResolvedValue({
      feature_types: [{ feature_type_name: 'telemetry', expression }]
    });
    mockUseApi.search.searchFeatures.mockResolvedValue({
      features: [],
      properties: [],
      has_inaccessible_secured_features: false,
      pagination: { limit: 10, sort: 'relevancy_score', order: 'desc', next_cursor: null, previous_cursor: null }
    });
    mockUseApi.search.countFeatures.mockResolvedValue({ total: 7 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("searches the feature type with the expression of the request's policy", async () => {
    const { getByRole, findByRole } = renderContainer('/admin/data-requests/request-1/feature-types/telemetry');

    expect(await findByRole('heading', { name: 'Features (7)' })).toBeVisible();

    expect(getByRole('heading', { level: 1 })).toBeVisible();
    expect(getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin');
    expect(getByRole('link', { name: 'Data Requests' })).toHaveAttribute('href', '/admin/data-requests');
    expect(getByRole('link', { name: 'request-1' })).toHaveAttribute('href', '/admin/data-requests/request-1');
    expect(getByRole('tab', { name: 'Features' })).toHaveAttribute('aria-selected', 'true');

    expect(mockUseApi.search.searchFeatures).toHaveBeenCalledWith(
      'telemetry',
      expression,
      expect.anything(),
      expect.anything()
    );
    expect(mockUseApi.search.countFeatures).toHaveBeenCalledWith('telemetry', expression, expect.anything());
  });

  it('pages with the cursor in the URL, like the main search', async () => {
    const { findByRole } = renderContainer(
      '/admin/data-requests/request-1/feature-types/telemetry?cursor=next-page&limit=25'
    );

    expect(await findByRole('heading', { name: 'Features (7)' })).toBeVisible();

    expect(mockUseApi.search.searchFeatures.mock.calls[0][2]).toEqual(
      expect.objectContaining({ cursor: 'next-page', limit: 25 })
    );
  });

  it('redirects to not found for a feature type the data request does not ask for', async () => {
    const { getByTestId } = renderContainer('/admin/data-requests/request-1/feature-types/observation');

    await waitFor(() => {
      expect(getByTestId('not-found-page')).toBeVisible();
    });
    expect(mockUseApi.search.searchFeatures).not.toHaveBeenCalled();
  });

  it.each([400, 404])('redirects to not found when the API answers %s', async (status) => {
    mockUseApi.dataRequest.getDataRequestFeatureTypes.mockRejectedValue(
      new AxiosError('Not found', String(status), undefined, undefined, { status } as AxiosResponse)
    );

    const { getByTestId } = renderContainer('/admin/data-requests/missing/feature-types/telemetry');

    await waitFor(() => {
      expect(getByTestId('not-found-page')).toBeVisible();
    });
  });
});
