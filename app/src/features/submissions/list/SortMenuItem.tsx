import { mdiSortAlphabeticalAscending, mdiSortAlphabeticalDescending } from '@mdi/js';
import Icon from '@mdi/react';
import MenuItem from '@mui/material/MenuItem';
import useTheme from '@mui/system/useTheme';
import { FuseResult } from 'fuse.js';
import { SubmissionRecord } from 'interfaces/useSubmissionsApi.interface';
import sortBy from 'lodash-es/sortBy';
import { useState } from 'react';
import { SortSubmission } from './SubmissionsListSortMenu';

interface ISortMenuItemProps<TSubmission> {
  submissions: TSubmission[];
  handleSort: (data: TSubmission[]) => void;
  sortKey: keyof SubmissionRecord;
  name: string;
}

const SortMenuItem = <TSubmission extends SortSubmission>(props: ISortMenuItemProps<TSubmission>) => {
  const { submissions, handleSort, sortKey, name } = props;

  const theme = useTheme();
  const [sortAscending, setSortAscending] = useState(true);

  /**
   * sorts by property
   *
   * @param {keyof SubmissionRecord} sortKey - property to sort datasets by
   */
  const sort = (sortKey: keyof SubmissionRecord, ascending: boolean) => {
    const getSortKey = (submission: SortSubmission) =>
      // uncertain why this needs to be cast to FuseResult when checking for item property?
      'item' in submission ? (submission as FuseResult<SubmissionRecord>).item[sortKey] : submission[sortKey];
    const sortedData: TSubmission[] = ascending
      ? sortBy(submissions, getSortKey)
      : sortBy(submissions, getSortKey).reverse();
    handleSort(sortedData);
  };
  return (
    <MenuItem
      onClick={() => {
        const toggleSort = !sortAscending;
        sort(sortKey, toggleSort);
        setSortAscending(toggleSort);
      }}
      dense>
      <Icon
        path={sortAscending ? mdiSortAlphabeticalAscending : mdiSortAlphabeticalDescending}
        size={1}
        style={{ marginRight: theme.spacing(1) }}
      />
      {name}
    </MenuItem>
  );
};

export default SortMenuItem;
