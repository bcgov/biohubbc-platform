import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, InputAdornment } from '@mui/material';

interface ExpressionBuilderPredicateValueClearAdornmentProps {
  /** Clears the predicate value field using the parent-owned draft state. */
  onClear: () => unknown;
}

/**
 * Renders the clear button shown at the end of predicate value inputs.
 *
 * Use this as a text-field `endAdornment` only when the current value is
 * present. The button stops pointer propagation so clearing a value does not
 * trigger parent token drag/drop handlers or autocomplete focus behavior.
 *
 * @param {ExpressionBuilderPredicateValueClearAdornmentProps} props - Clear callback for the value input.
 * @returns {JSX.Element} Input adornment containing the clear-value button.
 */
export const ExpressionBuilderPredicateValueClearAdornment = ({
  onClear
}: ExpressionBuilderPredicateValueClearAdornmentProps) => (
  <InputAdornment position="end">
    <IconButton
      aria-label="Clear value"
      size="small"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      sx={{ height: 24, width: 24 }}>
      <Icon path={mdiClose} size={0.6} />
    </IconButton>
  </InputAdornment>
);
