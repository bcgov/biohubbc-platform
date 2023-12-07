import { mdiChevronDown, mdiSortAlphabeticalAscending, mdiSortAlphabeticalDescending } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useTheme from '@mui/system/useTheme';
import sortBy from 'lodash-es/sortBy';
import { useState } from 'react';
import { IDataset } from '../DatasetListPage';

type SortBy = 'asc' | 'desc';

interface IDatasetSortMenu {
  data: IDataset[];
  handleSortedData: (data: IDataset[]) => void;
}

/**
 * Renders 'Sort By' button for DatasetsListPage
 * Note: currently supports title and date sorting
 *
 * @param {IDatasetSortMenu} props
 * @returns {*}
 */
const DatasetSortMenu = (props: IDatasetSortMenu) => {
  const theme = useTheme();

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
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
   * @param {keyof IDataset} sortKey - property to sory datasets by
   * @param {SortBy} [sortDirection] - ascending or descending sort
   */
  const handleSort = (sortKey: keyof IDataset, sortDirection: SortBy) => {
    const sortedData = sortDirection === 'asc' ? sortBy(props.data, sortKey) : sortBy(props.data, sortKey).reverse();
    props.handleSortedData(sortedData);
    handleClose();
  };

  const sortMenuItem = (sortKey: keyof IDataset, itemName: string, sortBy: SortBy = 'asc') => {
    const label = `${itemName} ${sortBy === 'asc' ? 'ascending' : 'descending'}`;
    return (
      <MenuItem
        onClick={() => {
          setSelectedItem(label);
          handleSort(sortKey, sortBy);
        }}
        selected={selectedItem === label}
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
        variant="contained"
        disableElevation
        size="small"
        endIcon={<Icon path={mdiChevronDown} size={1} />}>
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

export default DatasetSortMenu;
