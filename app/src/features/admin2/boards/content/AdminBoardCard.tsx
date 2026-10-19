import { mdiCogOutline, mdiDotsVertical, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TagChip } from 'components/tags/TagChip';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { IBoardSummary } from 'interfaces/useBoardsApi.interface';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { pluralize } from 'utils/Utils';

interface IAdminBoardCardProps {
  board: IBoardSummary;
  onEditBoard: (board: IBoardSummary) => void;
  onDeleteBoard: (board: IBoardSummary) => void;
}

/**
 * One board in the boards list: its color, name, description, tags and lane count. The card opens the board; its
 * menu opens the board's settings, edits or deletes it.
 *
 * @param {IAdminBoardCardProps} props The board and its actions.
 * @returns {JSX.Element} The board card.
 */
export const AdminBoardCard = (props: IAdminBoardCardProps) => {
  const { board, onEditBoard, onDeleteBoard } = props;
  const navigate = useNavigate();
  const laneLabel = `${board.swimlane_count} ${pluralize(board.swimlane_count, 'swimlane')}`;

  return (
    <Card
      variant="outlined"
      data-testid={`board-card-${board.board_id}`}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderTop: 6, borderTopColor: board.color }}>
      <Stack direction="row" alignItems="flex-start" sx={{ flex: '1 1 auto' }}>
        <CardActionArea
          component={RouterLink}
          to={`/admin/boards/${board.board_id}`}
          sx={{ p: 2, height: '100%', alignSelf: 'stretch' }}>
          <Stack gap={1}>
            <Typography variant="h5" component="h3">
              {board.name}
            </Typography>
            {board.description ? (
              <Typography variant="body2" color="text.secondary">
                {board.description}
              </Typography>
            ) : null}
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {board.tags.map((tag) => (
                <TagChip key={tag.tag_id} tag={tag} />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {laneLabel}
            </Typography>
          </Stack>
        </CardActionArea>
        <Box sx={{ p: 1 }}>
          <CustomMenuIconButton
            buttonTitle="Board actions"
            buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
            menuItems={[
              {
                menuIcon: <Icon path={mdiCogOutline} size={0.875} />,
                menuLabel: 'Board settings',
                menuOnClick: () => navigate(`/admin/boards/${board.board_id}/settings`)
              },
              {
                menuIcon: <Icon path={mdiPencil} size={0.875} />,
                menuLabel: 'Edit board',
                menuOnClick: () => onEditBoard(board)
              },
              {
                menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                menuLabel: 'Delete board',
                menuOnClick: () => onDeleteBoard(board)
              }
            ]}
          />
        </Box>
      </Stack>
    </Card>
  );
};
