import { Button, Stack } from '@mui/material';
import { useSearchExpressionBuilderContext } from './SearchExpressionBuilderContext';
import { SearchExpressionBuilderSlotProps } from './SearchExpressionBuilder.interface';

/**
 * Renders search-specific expression builder Apply and Cancel actions.
 *
 * @param {SearchExpressionBuilderSlotProps} props - Slot callbacks from the shared expression builder.
 * @returns {JSX.Element}
 */
export const SearchExpressionBuilderFooter = ({ onApply }: SearchExpressionBuilderSlotProps) => {
  const { onCancel } = useSearchExpressionBuilderContext();

  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      gap={1}
      sx={{
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        flex: '0 0 auto'
      }}>
      <Stack gap={1} flexDirection="row" p={2}>
        <Button variant="contained" onClick={onApply} size="small">
          Apply
        </Button>
        <Button variant="outlined" color="inherit" onClick={onCancel} size="small">
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
};
