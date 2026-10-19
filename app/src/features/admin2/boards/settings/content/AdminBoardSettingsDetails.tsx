import { mdiPencil } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageSection } from 'components/section/PageSection';
import { TagChip } from 'components/tags/TagChip';
import { IBoardDetail } from 'interfaces/useBoardsApi.interface';

interface IAdminBoardSettingsDetailsProps {
  board: IBoardDetail;
  onEdit: () => void;
}

/**
 * Board section of the board settings: the board's color, name, description and tags, with an edit action.
 *
 * @param {IAdminBoardSettingsDetailsProps} props The board and its edit action.
 * @returns {JSX.Element} The board details section.
 */
export const AdminBoardSettingsDetails = (props: IAdminBoardSettingsDetailsProps) => {
  const { board, onEdit } = props;

  return (
    <PageSection
      id="board-details"
      label="Board"
      headerContent={
        <Button variant="outlined" startIcon={<Icon path={mdiPencil} size={0.8} />} onClick={onEdit}>
          Edit Board
        </Button>
      }>
      <Stack gap={1.5} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box
            aria-label={`board color ${board.color}`}
            sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: board.color, border: 1, borderColor: 'divider' }}
          />
          <Typography variant="h5" component="h3">
            {board.name}
          </Typography>
        </Stack>
        {board.description ? (
          <Typography variant="body2" color="text.secondary">
            {board.description}
          </Typography>
        ) : null}
        <Stack gap={0.5}>
          <Typography variant="subtitle2" fontWeight={700}>
            Board tags
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {board.tags.map((tag) => (
              <TagChip key={tag.tag_id} tag={tag} />
            ))}
            {board.tags.length ? null : (
              <Typography variant="body2" color="text.secondary">
                No tags
              </Typography>
            )}
          </Stack>
        </Stack>
      </Stack>
    </PageSection>
  );
};
