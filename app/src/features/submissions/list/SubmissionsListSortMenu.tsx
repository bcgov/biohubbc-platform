import { mdiChevronDown, mdiSortAlphabeticalAscending, mdiSortAlphabeticalDescending } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useTheme from '@mui/system/useTheme';
import { FuseResult } from 'fuse.js';
import { SubmissionRecordPublished } from 'interfaces/useSubmissionsApi.interface';
import sortBy from 'lodash-es/sortBy';
import { useState } from 'react';
import { pluralize as p } from 'utils/Utils';

type SortBy = 'asc' | 'desc';

interface ISubmissionsListSortMenuProps {
  submissions: FuseResult<SubmissionRecordPublished>[];
  handleSortedFuzzyData: (data: FuseResult<SubmissionRecordPublished>[]) => void;
}

/**
 * Renders 'Sort By' button for SubmissionsListPage
 * Note: currently supports title and date sorting
 *
 * @param {ISubmissionsListSortMenuProps} props
 * @returns {*}
 */
const SubmissionsListSortMenu = (props: ISubmissionsListSortMenuProps) => {
  const { submissions, handleSortedFuzzyData } = props;

  const theme = useTheme();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  /**
   * sorts datasets by property
   *
   * @param {keyof IDataset} sortKey - property to sort datasets by
   * @param {SortBy} [sortDirection] - ascending or descending sort
   */
  const handleSort = (sortKey: keyof SubmissionRecordPublished, sortDirection: SortBy) => {
    const sortedData =
      sortDirection === 'asc'
        ? sortBy(submissions, (fuzzyDataset) => fuzzyDataset.item[sortKey])
        : sortBy(submissions, (fuzzyDataset) => fuzzyDataset.item[sortKey]).reverse();
    handleSortedFuzzyData(sortedData);
    handleClose();
  };

  const sortMenuItem = (sortKey: keyof SubmissionRecordPublished, itemName: string, sortBy: SortBy = 'asc') => {
    const label = `${itemName} ${sortBy === 'asc' ? 'ascending' : 'descending'}`;
    return (
      <MenuItem
        onClick={() => {
          handleSort(sortKey, sortBy);
        }}
        dense>
        <Icon
          color={theme.palette.text.secondary}
          path={sortBy === 'asc' ? mdiSortAlphabeticalAscending : mdiSortAlphabeticalDescending}
          size={1}
          style={{ marginRight: theme.spacing(1) }}
        />
        {label}
      </MenuItem>
    );
  };

  return (
    <Stack mb={4} flexDirection="row" alignItems="center" justifyContent="space-between">
      <Typography variant="h4" component="h2">
        {`${submissions.length} ${p(submissions.length, 'record')} found`}
      </Typography>
      <Button
        id="sort-button"
        onClick={handleClick}
        variant="outlined"
        disableElevation
        size="small"
        endIcon={<Icon path={mdiChevronDown} size={0.75} />}
        disabled={!submissions.length}>
        Sort By
      </Button>
      <Menu id="sort-menu" anchorEl={anchorEl} open={open} onClose={handleClose}>
        {sortMenuItem('name', 'Title')}
        {sortMenuItem('name', 'Title', 'desc')}
        {sortMenuItem('submitted_timestamp', 'Date')}
        {sortMenuItem('submitted_timestamp', 'Date', 'desc')}
      </Menu>
    </Stack>
  );
};

export default SubmissionsListSortMenu;
