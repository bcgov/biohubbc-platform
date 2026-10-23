import Stack from '@mui/material/Stack';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { CustomMultiAutocompleteFormik } from 'components/fields/CustomMultiAutocompleteFormik';

export interface IBoardTicketAddFormValues {
  /** The existing tickets to put on the board. */
  ticketIds: string[];
}

interface IBoardTicketAddFormProps {
  /** Tickets matching the search that are not on the board yet. */
  ticketOptions: ICustomMultiAutocompleteOption[];
  onTicketSearch: (search: string) => void;
}

/**
 * Field for putting existing tickets on a board: a search of the tickets. Rendered inside an `EditDialog`, which owns
 * the Formik state.
 *
 * @param {IBoardTicketAddFormProps} props The ticket options and the ticket search handler.
 * @returns {JSX.Element} The add tickets form field.
 */
export const BoardTicketAddForm = (props: IBoardTicketAddFormProps) => {
  const { ticketOptions, onTicketSearch } = props;

  return (
    <Stack sx={{ mt: 1 }}>
      <CustomMultiAutocompleteFormik
        id="board-ticket-add-tickets"
        name="ticketIds"
        label="Tickets"
        required
        chipVisible
        options={ticketOptions}
        onSearchInput={onTicketSearch}
      />
    </Stack>
  );
};
