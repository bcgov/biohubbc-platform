import { mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { Container } from '@mui/material';
import Button from '@mui/material/Button';
import { PageSection } from 'components/section/PageSection';
import { SearchResultContent, SearchResultContentProps } from './SearchResultContent';

interface SearchResultPanelProps extends SearchResultContentProps {
  /** Whether the create-download action is disabled. */
  isCreateDownloadDisabled: boolean;
  /** Opens the create-download flow for the current search. */
  onCreateDownloadClick: () => void;
}

/**
 * Renders the search page's Results section around the reusable result content.
 *
 * @param {SearchResultPanelProps} props - Result content props and create-download action state.
 * @returns {JSX.Element} The complete search-page Results section.
 */
export const SearchResultPanel = ({
  isCreateDownloadDisabled,
  onCreateDownloadClick,
  ...contentProps
}: SearchResultPanelProps) => (
  <Container
    maxWidth="lg"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      py: 2,
      '& > .MuiPaper-root': {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0
      }
    }}>
    <PageSection
      id="search-results"
      label="Results"
      headerContent={
        <Button
          size="small"
          color="primary"
          onClick={onCreateDownloadClick}
          disabled={isCreateDownloadDisabled}
          startIcon={<Icon path={mdiDownload} size={0.8} />}
          sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
          Create Download
        </Button>
      }>
      <SearchResultContent {...contentProps} />
    </PageSection>
  </Container>
);
