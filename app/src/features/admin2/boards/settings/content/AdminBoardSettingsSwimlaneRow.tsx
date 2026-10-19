import { mdiArrowDown, mdiArrowUp, mdiDotsVertical, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { TagChip } from 'components/tags/TagChip';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { IBoardSwimlane } from 'interfaces/useBoardsApi.interface';

interface IAdminBoardSettingsSwimlaneRowProps {
  swimlane: IBoardSwimlane;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onVisibilityChange: (isVisible: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One swimlane in the board settings: its color, name, description and tags, a visibility switch, buttons to move it
 * left or right on the board (up or down in this list), and edit and delete actions.
 *
 * @param {IAdminBoardSettingsSwimlaneRowProps} props The swimlane, its position and its actions.
 * @returns {JSX.Element} The swimlane row.
 */
export const AdminBoardSettingsSwimlaneRow = (props: IAdminBoardSettingsSwimlaneRowProps) => {
  const { swimlane, isFirst, isLast, onMoveUp, onMoveDown, onVisibilityChange, onEdit, onDelete } = props;

  return (
    <Paper
      variant="outlined"
      data-testid={`swimlane-row-${swimlane.board_swimlane_id}`}
      sx={{ p: 1.5, borderLeft: 6, borderLeftColor: swimlane.color ?? 'grey.400' }}>
      <Stack direction="row" alignItems="center" gap={2}>
        <Stack direction="column">
          <IconButton size="small" aria-label={`move ${swimlane.name} up`} disabled={isFirst} onClick={onMoveUp}>
            <Icon path={mdiArrowUp} size={0.75} />
          </IconButton>
          <IconButton size="small" aria-label={`move ${swimlane.name} down`} disabled={isLast} onClick={onMoveDown}>
            <Icon path={mdiArrowDown} size={0.75} />
          </IconButton>
        </Stack>
        <Stack gap={0.5} sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Typography variant="body1" fontWeight={700} noWrap title={swimlane.name}>
            {swimlane.name}
          </Typography>
          {swimlane.description ? (
            <Typography variant="body2" color="text.secondary">
              {swimlane.description}
            </Typography>
          ) : null}
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {swimlane.tags.map((tag) => (
              <TagChip key={tag.tag_id} tag={tag} />
            ))}
          </Stack>
        </Stack>
        <FormControlLabel
          label="Visible"
          control={
            <Switch
              checked={swimlane.is_visible}
              onChange={(event) => onVisibilityChange(event.target.checked)}
              slotProps={{ input: { 'aria-label': `${swimlane.name} visible` } }}
            />
          }
        />
        <Box>
          <CustomMenuIconButton
            buttonTitle="Swimlane actions"
            buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
            menuItems={[
              { menuIcon: <Icon path={mdiPencil} size={0.875} />, menuLabel: 'Edit swimlane', menuOnClick: onEdit },
              {
                menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                menuLabel: 'Delete swimlane',
                menuOnClick: onDelete
              }
            ]}
          />
        </Box>
      </Stack>
    </Paper>
  );
};
