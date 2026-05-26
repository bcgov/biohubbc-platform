import { screen } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { TicketMarkdownPreview } from './TicketMarkdownPreview';

describe('TicketMarkdownPreview', () => {
  it('renders draft artifact references as non-interactive file links', () => {
    render(<TicketMarkdownPreview content="[draft file](/artifact/3ea79946-8cf2-4792-9239-5b148f9f95eb)" />);

    expect(screen.getByText('draft file')).toBeVisible();
    expect(screen.queryByText('File not found')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'draft file' })).not.toBeInTheDocument();
  });
});
