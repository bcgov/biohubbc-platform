import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { PropertyValueLink } from './PropertyValueLink';

describe('PropertyValueLink', () => {
  it('renders an in-app link carrying the label, title and data attributes', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <PropertyValueLink
          to="/submission/1/taxon/180543"
          label="Ursus americanus"
          title="TSN 180543 · Species"
          italic
          dataAttributes={{ 'data-taxon-id': 180543, 'data-tsn': 180543 }}
        />
      </MemoryRouter>
    );

    const link = getByRole('link', { name: 'Ursus americanus' });
    expect(link).toHaveAttribute('href', '/submission/1/taxon/180543');
    expect(link).toHaveAttribute('title', 'TSN 180543 · Species');
    expect(link).toHaveAttribute('data-taxon-id', '180543');
    expect(link).toHaveAttribute('data-tsn', '180543');
    expect(link.querySelector('i')).toHaveTextContent('Ursus americanus');
  });

  it('renders upright text by default', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <PropertyValueLink to="/submission/1/taxon/1" label="Mammalia" />
      </MemoryRouter>
    );

    expect(getByRole('link', { name: 'Mammalia' }).querySelector('i')).toBeNull();
  });

  it('does not propagate its click to an enclosing clickable row', () => {
    const onRowClick = vi.fn();
    const { getByRole } = render(
      <MemoryRouter>
        <div onClick={onRowClick}>
          <PropertyValueLink to="/submission/1/taxon/1" label="Ursus americanus" />
        </div>
      </MemoryRouter>
    );

    fireEvent.click(getByRole('link', { name: 'Ursus americanus' }));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});
