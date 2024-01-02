import { mdiChevronDown } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import { FuseResult } from 'fuse.js';
import { SubmissionRecord } from 'interfaces/useSubmissionsApi.interface';
import React, { useState } from 'react';
import SortMenuItem from './SortMenuItem';

export type SortSubmission = FuseResult<SubmissionRecord> | SubmissionRecord;

export interface ISubmissionsListSortMenuProps<TSubmission> {
  submissions: TSubmission[];
  handleSubmissions: (data: TSubmission[]) => void;
  sortMenuItems: Partial<Record<keyof SubmissionRecord, string>>;
}

/**
 * Renders 'Sort By' button for Submission pages
 *
 * Note: supports both submission and fuzzy submission types
 * @param {ISubmissionsListSortMenuProps} props
 * @returns {*}
 */
const SubmissionsListSortMenu = <TSubmission extends SortSubmission>(
  props: ISubmissionsListSortMenuProps<TSubmission>
) => {
  const { submissions, sortMenuItems, handleSubmissions } = props;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSort = (submissions: TSubmission[]) => {
    handleClose();
    handleSubmissions(submissions);
  };

  return (
    <Stack mb={4} flexDirection="row" alignItems="center" justifyContent="space-between">
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
      <Menu id="sort-menu" anchorEl={anchorEl} open={open} onClose={handleClose} keepMounted>
        {Object.keys(sortMenuItems).map((key) => (
          <SortMenuItem
            key={key}
            submissions={submissions}
            handleSort={handleSort}
            name={sortMenuItems[key]}
            sortKey={key as keyof SubmissionRecord}
          />
        ))}
      </Menu>
    </Stack>
  );
};

export default SubmissionsListSortMenu;
