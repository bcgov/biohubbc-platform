import { mdiChevronDown, mdiSortAlphabeticalAscending, mdiSortAlphabeticalDescending } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useTheme from '@mui/system/useTheme';
import { FuseResult } from 'fuse.js';
import { ISubmission } from 'interfaces/useSubmissionsApi.interface';
import sortBy from 'lodash-es/sortBy';
import { useState } from 'react';

type SortBy = 'asc' | 'desc';

interface ISubmissionsListSortMenuProps {
  data: FuseResult<ISubmission>[];
  handleSortedFuzzyData: (data: FuseResult<ISubmission>[]) => void;
}

/**
 * Renders 'Sort By' button for SubmissionsListPage
 * Note: currently supports title and date sorting
 *
 * @param {ISubmissionsListSortMenuProps} props
 * @returns {*}
 */
const SubmissionsListSortMenu = (props: ISubmissionsListSortMenuProps) => {
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
  const handleSort = (sortKey: keyof ISubmission, sortDirection: SortBy) => {
    const sortedData =
      sortDirection === 'asc'
        ? sortBy(props.data, (fuzzyDataset) => fuzzyDataset.item[sortKey])
        : sortBy(props.data, (fuzzyDataset) => fuzzyDataset.item[sortKey]).reverse();
    props.handleSortedFuzzyData(sortedData);
    handleClose();
  };

  const sortMenuItem = (sortKey: keyof ISubmission, itemName: string, sortBy: SortBy = 'asc') => {
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
    <div>
      <Button
        id="sort-button"
        onClick={handleClick}
        variant="outlined"
        disableElevation
        size="small"
        endIcon={<Icon path={mdiChevronDown} size={0.75} />}>
        Sort By
      </Button>
      <Menu id="sort-menu" anchorEl={anchorEl} open={open} onClose={handleClose}>
        {sortMenuItem('name', 'Title')}
        {sortMenuItem('name', 'Title', 'desc')}
        {sortMenuItem('submission_date', 'Date')}
        {sortMenuItem('submission_date', 'Date', 'desc')}
      </Menu>
    </div>
  );
};

export default SubmissionsListSortMenu;
